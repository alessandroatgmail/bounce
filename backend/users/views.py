from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.conf import settings
from django.db.models import Q
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode

from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import City
from .serializers import BounceTokenObtainPairSerializer, RegisterSerializer, UserListSerializer


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

        # send_mail(
        #     subject="Welcome to Bounce — confirm your registration",
        #     message=(
        #         f"Hi {user.first_name},\n\n"
        #         "Thank you for registering at Bounce Dance School.\n"
        #         "Your account is pending approval. You will receive a confirmation email once it is activated.\n\n"
        #         "— The Bounce Team"
        #     ),
        #     from_email=settings.DEFAULT_FROM_EMAIL,
        #     recipient_list=[user.email],
        #     fail_silently=False,
        # )

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
            .order_by("name")[:10]
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
