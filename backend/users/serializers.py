from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class BounceTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Login with email + password; adds role and email claims to the JWT."""

    username_field = "email"

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["email"] = user.email
        return token
