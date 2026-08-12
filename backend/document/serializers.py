from rest_framework import serializers

from .models import Document


class DocumentSerializer(serializers.ModelSerializer):
    """User-facing: user is always the authenticated request user, set in the view."""

    class Meta:
        model = Document
        fields = ["id", "file", "user", "date"]
        read_only_fields = ["id", "user", "date"]


class AdminDocumentSerializer(serializers.ModelSerializer):
    """Admin-facing: user is explicitly chosen, targeting any account."""

    class Meta:
        model = Document
        fields = ["id", "file", "user", "date"]
        read_only_fields = ["id", "date"]
