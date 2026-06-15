import uuid as uuid_lib

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class Role(models.TextChoices):
    STUDENT = "student", "Student"
    TEACHER = "teacher", "Teacher"
    ADMIN = "admin", "Admin"

class Language(models.TextChoices):
    IT = 'it', 'Italiano'
    EN = 'en', 'English'

class Country(models.Model):
    name = models.CharField(max_length=255, unique=True)
    iso = models.CharField(max_length=3, unique=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "countries"

    def __str__(self):
        return self.name


class Region(models.Model):
    name = models.CharField(max_length=255)
    country = models.ForeignKey(Country, on_delete=models.CASCADE, related_name="regions")

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "regions"
        unique_together = ("name", "country")

    def __str__(self):
        return self.name


class City(models.Model):
    name = models.CharField(max_length=255)
    country = models.ForeignKey(Country, on_delete=models.CASCADE, related_name="cities")
    region = models.ForeignKey(Region, on_delete=models.SET_NULL, null=True, blank=True, related_name="cities")

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "cities"
        unique_together = ("name", "country")

    def __str__(self):
        return self.name


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Custom user model for Bounce dance school — email is the login identifier."""

    uuid = models.UUIDField(default=uuid_lib.uuid4, editable=False, unique=True)
    profile_image = models.ImageField(upload_to='profiles/', null=True, blank=True)

    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.STUDENT)

    date_of_birth = models.DateField(null=True, blank=True)
    place_of_birth = models.ForeignKey(City, on_delete=models.PROTECT, null=True, blank=True, related_name="users_birth")
    ci = models.CharField(max_length=50, blank=True, verbose_name="Codice Fiscale/N.I.")
    address = models.TextField(blank=True)
    city = models.ForeignKey(City, on_delete=models.PROTECT, null=True, blank=True, related_name="users")
    postal_code = models.CharField(max_length=10, blank=True)
    country = models.ForeignKey(Country, on_delete=models.PROTECT, null=True, blank=True)

    acsi = models.BooleanField(default=False)
    acsi_number = models.IntegerField(null=True, blank=True)
    acsi_expiration_date = models.DateField(null=True, blank=True)

    privacy_consent = models.BooleanField(default=False)
    marketing_consent = models.BooleanField(default=False)

    is_active = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)

    date_joined = models.DateTimeField(auto_now_add=True)

    language = models.CharField(
        max_length=2,
        choices=Language.choices,
        default=Language.IT,
    )

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        ordering = ["email"]

    def __str__(self):
        return f"{self.email} ({self.role})"

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip()
