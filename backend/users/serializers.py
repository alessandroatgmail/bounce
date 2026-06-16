from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Country, Region, User, City


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


class CityNestedSerializer(serializers.ModelSerializer):
    class Meta:
        model = City
        fields = ["id", "name"]


class CountryNestedSerializer(serializers.ModelSerializer):
    class Meta:
        model = Country
        fields = ["id", "name"]


class UserProfileSerializer(serializers.ModelSerializer):
    place_of_birth = CityNestedSerializer(read_only=True)
    city = CityNestedSerializer(read_only=True)
    country = CountryNestedSerializer(read_only=True)
    profile_image = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "uuid",
            "email",
            "first_name",
            "last_name",
            "phone",
            "role",
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
            "is_active",
            "date_joined",
            "profile_image",
        ]

    def get_profile_image(self, obj):
        if not obj.profile_image:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.profile_image.url)
        return obj.profile_image.url


class ProfileImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['profile_image']


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=8, write_only=True)
    new_password2 = serializers.CharField(min_length=8, write_only=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password2']:
            raise serializers.ValidationError({'new_password2': 'Passwords do not match.'})
        try:
            validate_password(attrs['new_password'])
        except DjangoValidationError as e:
            raise serializers.ValidationError({'new_password': list(e.messages)})
        return attrs


class ProfileUpdateSerializer(serializers.ModelSerializer):
    place_of_birth = serializers.PrimaryKeyRelatedField(
        queryset=City.objects.all(), allow_null=True, required=False
    )
    city = serializers.PrimaryKeyRelatedField(
        queryset=City.objects.all(), allow_null=True, required=False
    )
    country = serializers.PrimaryKeyRelatedField(
        queryset=Country.objects.all(), allow_null=True, required=False
    )

    class Meta:
        model = User
        fields = [
            'first_name', 'last_name', 'phone',
            'date_of_birth', 'place_of_birth', 'ci',
            'address', 'city', 'postal_code', 'country',
            'acsi', 'acsi_number', 'acsi_expiration_date',
            'privacy_consent', 'marketing_consent',
        ]

    def validate(self, attrs):
        instance = self.instance
        acsi = attrs.get('acsi', getattr(instance, 'acsi', False) if instance else False)
        if acsi:
            acsi_number = attrs.get('acsi_number', getattr(instance, 'acsi_number', None) if instance else None)
            acsi_exp = attrs.get('acsi_expiration_date', getattr(instance, 'acsi_expiration_date', None) if instance else None)
            if not acsi_number:
                raise serializers.ValidationError({'acsi_number': 'Required when ACSI membership is active.'})
            if not acsi_exp:
                raise serializers.ValidationError({'acsi_expiration_date': 'Required when ACSI membership is active.'})
        return attrs


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
