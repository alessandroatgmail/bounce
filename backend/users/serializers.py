from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Country, User, City


class BounceTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Login with email + password; adds role and email claims to the JWT."""

    username_field = "email"

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["email"] = user.email
        return token


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password2 = serializers.CharField(write_only=True, min_length=8)
    country = serializers.PrimaryKeyRelatedField(queryset=Country.objects.all())
    place_of_birth = serializers.PrimaryKeyRelatedField(queryset=City.objects.all())
    city = serializers.PrimaryKeyRelatedField(queryset=City.objects.all())

    class Meta:
        model = User
        fields = [
            "email",
            "password",
            "password2",
            "first_name",
            "last_name",
            "phone",
            "date_of_birth",
            "place_of_birth",
            "ci",
            "address",
            "city",
            "postal_code",
            "country",
            "acsi",
            "acsi_number",
            "acsi_expiration_date",
            "privacy_consent",
            "marketing_consent",
        ]
        extra_kwargs = {
            "first_name": {"required": True},
            "last_name": {"required": True},
            "phone": {"required": True},
            "date_of_birth": {"required": True},
            "ci": {"required": True},
            "address": {"required": True},
            "postal_code": {"required": True},
            "privacy_consent": {"required": True},
        }

    def validate_privacy_consent(self, value):
        if not value:
            raise serializers.ValidationError("You must accept the privacy policy to register.")
        return value

    def validate(self, attrs):
        password = attrs.get("password")
        password2 = attrs.get("password2")

        if password != password2:
            raise serializers.ValidationError({"password2": "Passwords do not match."})

        try:
            validate_password(password)
        except DjangoValidationError as e:
            raise serializers.ValidationError({"password": list(e.messages)})

        if attrs.get("acsi"):
            if not attrs.get("acsi_number"):
                raise serializers.ValidationError({"acsi_number": "Required when ACSI membership is active."})
            if not attrs.get("acsi_expiration_date"):
                raise serializers.ValidationError({"acsi_expiration_date": "Required when ACSI membership is active."})

        return attrs

    def create(self, validated_data):
        validated_data.pop("password2")
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.is_active = False
        user.save()
        return user


class UserListSerializer(serializers.ModelSerializer):
    memberships = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'first_name', 'last_name', 'email', 'role', 'memberships']

    def get_memberships(self, obj):
        seen = set()
        result = []
        for c in obj.contribution_set.all():
            if c.membership_id and c.membership_id not in seen:
                seen.add(c.membership_id)
                result.append({
                    'id': c.membership.id,
                    'name': c.membership.name,
                    'color': c.membership.color,
                })
        return result
