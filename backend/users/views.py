from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import BounceTokenObtainPairSerializer


class LoginView(TokenObtainPairView):
    serializer_class = BounceTokenObtainPairSerializer
