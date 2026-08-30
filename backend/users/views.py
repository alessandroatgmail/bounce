import io
import uuid
import redis
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from django.contrib.auth import get_user_model
from django.http import HttpResponse

from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.conf import settings
from django.db.models import Case, IntegerField, Q, Value, When
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode

from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from utils.tasks import send_password_reset_email

from .models import City
from .serializers import BounceTokenObtainPairSerializer, ChangePasswordSerializer, PasswordResetConfirmSerializer, PasswordResetRequestSerializer, ProfileImageSerializer, ProfileUpdateSerializer, RegisterSerializer, UserListSerializer, UserProfileSerializer


def _blacklist_user_tokens(user):
    """Blacklist all outstanding (non-expired) refresh tokens for the given user."""
    outstanding = OutstandingToken.objects.filter(user=user, expires_at__gt=timezone.now())
    for token in outstanding:
        BlacklistedToken.objects.get_or_create(token=token)


class LoginView(TokenObtainPairView):
    serializer_class = BounceTokenObtainPairSerializer

    @extend_schema(
        request=BounceTokenObtainPairSerializer,
        responses={
            200: inline_serializer(
                name="BounceTokenObtainPairResponse",
                fields={
                    "access": serializers.CharField(),
                    "refresh": serializers.CharField(),
                },
            ),
            401: inline_serializer(
                name="LoginErrorResponse",
                fields={"detail": serializers.CharField()},
            ),
        },
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


class RegisterView(APIView):
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer

    @extend_schema(
        request=RegisterSerializer,
        responses={
            201: inline_serializer(
                name="RegisterResponse",
                fields={
                    "id": serializers.IntegerField(),
                    "email": serializers.EmailField(),
                    "first_name": serializers.CharField(),
                    "last_name": serializers.CharField(),
                    "role": serializers.CharField(),
                },
            ),
            400: inline_serializer(
                name="RegisterErrorResponse",
                fields={"detail": serializers.CharField()},
            ),
        },
    )
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        return Response(
            {
                "id": user.pk,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "role": user.role,
            },
            status=status.HTTP_201_CREATED,
        )


class ActivateView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        responses={
            200: inline_serializer(
                name="ActivateResponse",
                fields={"detail": serializers.CharField()},
            ),
            400: inline_serializer(
                name="ActivateErrorResponse",
                fields={"detail": serializers.CharField()},
            ),
        }
    )
    def get(self, request, uidb64, token):
        User = get_user_model()
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({"detail": "Invalid activation link."}, status=status.HTTP_400_BAD_REQUEST)

        if user.is_active:
            return Response({"detail": "Account is already active."}, status=status.HTTP_200_OK)

        if not default_token_generator.check_token(user, token):
            return Response({"detail": "Activation link is invalid or has expired."}, status=status.HTTP_400_BAD_REQUEST)

        user.is_active = True
        user.save(update_fields=["is_active"])

        # Bookings that named this email as partner before the account
        # existed: mirror their contributions onto the new user.
        from booking.service import create_partner_contributions_for_user
        create_partner_contributions_for_user(user)

        return Response({"detail": "Account activated successfully."}, status=status.HTTP_200_OK)


class CitySearchView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        responses={
            200: inline_serializer(
                name="CitySearchResponse",
                fields={
                    "id": serializers.IntegerField(),
                    "name": serializers.CharField(),
                    "country_id": serializers.IntegerField(),
                    "country_name": serializers.CharField(),
                },
                many=True,
            )
        }
    )
    def get(self, request):
        q = request.query_params.get("q", "").strip()
        if len(q) < 2:
            return Response([])
        cities = (
            City.objects.filter(name__icontains=q)
            .select_related("country")
            .annotate(
                rank=Case(
                    When(name__iexact=q, then=Value(0)),
                    When(name__istartswith=q, then=Value(1)),
                    default=Value(2),
                    output_field=IntegerField(),
                )
            )
            .order_by("rank", "name")[:10]
        )
        data = [
            {
                "id": city.pk,
                "name": city.name,
                "country_id": city.country_id,
                "country_name": city.country.name,
            }
            for city in cities
        ]
        return Response(data)


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        request=PasswordResetRequestSerializer,
        responses={200: inline_serializer('PasswordResetRequestResponse', {'detail': serializers.CharField()})},
    )
    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        User = get_user_model()
        try:
            user = User.objects.get(email__iexact=email, is_active=True)
            send_password_reset_email.delay(user.id)
        except User.DoesNotExist:
            pass
        return Response({'detail': 'If an account with that email exists, a reset link has been sent.'})


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        request=PasswordResetConfirmSerializer,
        responses={
            200: inline_serializer('PasswordResetConfirmResponse', {'detail': serializers.CharField()}),
            400: inline_serializer('PasswordResetConfirmError', {'detail': serializers.CharField()}),
        },
    )
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uid = serializer.validated_data['uid']
        token = serializer.validated_data['token']
        new_password = serializer.validated_data['new_password']
        User = get_user_model()
        try:
            pk = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=pk)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({'detail': 'Invalid reset link.'}, status=status.HTTP_400_BAD_REQUEST)
        if not default_token_generator.check_token(user, token):
            return Response({'detail': 'Reset link is invalid or has expired.'}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(new_password)
        user.save(update_fields=['password'])
        return Response({'detail': 'Password reset successfully.'})


class UserListPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class UserListView(ListAPIView):
    serializer_class = UserListSerializer
    permission_classes = [IsAdminUser]
    pagination_class = UserListPagination

    def get_queryset(self):
        User = get_user_model()
        qs = (
            User.objects
            .prefetch_related('contribution_set__membership')
            .order_by('last_name', 'first_name')
        )

        name = self.request.query_params.get('name', '').strip()
        if name:
            qs = qs.filter(Q(first_name__icontains=name) | Q(last_name__icontains=name))

        membership_id = self.request.query_params.get('membership', '').strip()
        if membership_id:
            qs = qs.filter(contribution_set__membership__id=membership_id).distinct()

        event_id = self.request.query_params.get('event', '').strip()
        if event_id:
            qs = qs.filter(contribution_set__events__id=event_id).distinct()

        return qs

# We connect to the same Redis instance used by Channels/Celery.
# decode_responses=True so we get strings back instead of bytes.
# Rimuovi redis_client a livello di modulo e usa una funzione
def _get_redis_client():
    from django.conf import settings
    url = getattr(settings, "REDIS_TEST_URL", None)
    if url and getattr(settings, "TESTING", False):
        return redis.Redis.from_url(url, decode_responses=True)
    return redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=inline_serializer(
            name="LogoutRequest",
            fields={"refresh": serializers.CharField()},
        ),
        responses={
            204: None,
            400: inline_serializer(
                name="LogoutErrorResponse",
                fields={"detail": serializers.CharField()},
            ),
        },
    )
    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response({"detail": "Refresh token is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            RefreshToken(refresh_token).blacklist()
        except TokenError:
            return Response({"detail": "Token is invalid or already blacklisted."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CheckEmailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        email = request.query_params.get('email', '').strip()
        if not email:
            return Response({'detail': 'email query parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)
        User = get_user_model()
        try:
            user = User.objects.get(email__iexact=email, is_active=True)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response({'id': user.pk, 'first_name': user.first_name, 'last_name': user.last_name})


class MeView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @extend_schema(responses={200: UserProfileSerializer})
    def get(self, request):
        serializer = UserProfileSerializer(request.user, context={'request': request})
        return Response(serializer.data)

    @extend_schema(request=ProfileImageSerializer, responses={200: UserProfileSerializer})
    def patch(self, request):
        serializer = ProfileImageSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserProfileSerializer(request.user, context={'request': request}).data)

    @extend_schema(request=ProfileUpdateSerializer, responses={200: UserProfileSerializer})
    def put(self, request):
        serializer = ProfileUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        if not user.privacy_consent:
            user.is_active = False
            user.save(update_fields=['is_active'])
        return Response(UserProfileSerializer(user, context={'request': request}).data)

    @extend_schema(responses={200: inline_serializer('AnonymizeResponse', {'detail': serializers.CharField()})})
    def delete(self, request):
        user = request.user
        _blacklist_user_tokens(user)
        anon_email = f'deleted-{user.uuid}@deleted.invalid'
        user.email = anon_email
        user.first_name = ''
        user.last_name = ''
        user.phone = ''
        user.address = ''
        user.ci = ''
        user.postal_code = ''
        user.date_of_birth = None
        user.place_of_birth = None
        user.city = None
        user.country = None
        user.acsi = False
        user.acsi_number = None
        user.acsi_starting_date = None
        user.acsi_expiration_date = None
        user.privacy_consent = False
        user.marketing_consent = False
        user.is_active = False
        if user.profile_image:
            user.profile_image.delete(save=False)
            user.profile_image = None
        user.save()
        return Response({'detail': 'Account anonymized.'}, status=status.HTTP_200_OK)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=ChangePasswordSerializer,
        responses={
            200: inline_serializer('ChangePasswordResponse', {'detail': serializers.CharField()}),
            400: inline_serializer('ChangePasswordError', {'detail': serializers.CharField()}),
        },
    )
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save(update_fields=['password'])
        return Response({'detail': 'Password changed successfully.'})


class DeactivateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: inline_serializer('DeactivateResponse', {'detail': serializers.CharField()})})
    def post(self, request):
        user = request.user
        user.is_active = False
        user.save(update_fields=['is_active'])
        _blacklist_user_tokens(user)
        return Response({'detail': 'Account deactivated.'}, status=status.HTTP_200_OK)


class AdminActivateUserView(APIView):
    permission_classes = [IsAdminUser]

    @extend_schema(responses={200: inline_serializer('AdminActivateResponse', {'detail': serializers.CharField()})})
    def patch(self, request, user_id):
        User = get_user_model()
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
        user.is_active = True
        user.save(update_fields=['is_active'])

        # Same activation hook as the self-service link (idempotent).
        from booking.service import create_partner_contributions_for_user
        create_partner_contributions_for_user(user)

        return Response({'detail': 'User activated.'}, status=status.HTTP_200_OK)


class QRCodeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        import qrcode
        qr = qrcode.make(str(request.user.uuid))
        buffer = io.BytesIO()
        qr.save(buffer, format='PNG')
        buffer.seek(0)
        return HttpResponse(buffer.getvalue(), content_type='image/png')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ws_ticket(request):
    ticket = str(uuid.uuid4())
    redis_key = f"ws_ticket:{ticket}"
    _get_redis_client().setex(redis_key, 15, str(request.user.id))
    return Response({"ticket": ticket})