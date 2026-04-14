from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import BounceTokenObtainPairSerializer

from drf_spectacular.utils import extend_schema
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from drf_spectacular.utils import inline_serializer
from rest_framework import serializers


class LoginView(TokenObtainPairView):
    serializer_class = BounceTokenObtainPairSerializer

    @extend_schema(
        request=BounceTokenObtainPairSerializer,  # what we send
        responses={
            200: inline_serializer(
                name='BounceTokenObtainPairResponse',
                fields={
                    'access': serializers.CharField(),
                    'refresh': serializers.CharField(),
                }
            ),
            401: inline_serializer(
                name='LoginErrorResponse',
                fields={
                    'detail': serializers.CharField()
                }
            )
        }
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)

