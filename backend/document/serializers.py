from PIL import Image, UnidentifiedImageError
from rest_framework import serializers

from .models import Document, DocumentType

MEDICAL_CERTIFICATE_EXTENSIONS = {"pdf", "jpg", "jpeg", "png", "gif", "webp"}
MEDICAL_CERTIFICATE_MAX_SIZE = 5 * 1024 * 1024


def _looks_like_a_pdf(file) -> bool:
    file.seek(0)
    header = file.read(5)
    file.seek(0)
    return header == b"%PDF-"


def _looks_like_an_image(file) -> bool:
    file.seek(0)
    try:
        Image.open(file).verify()
        return True
    except (UnidentifiedImageError, OSError):
        return False
    finally:
        file.seek(0)


class DocumentValidationMixin:
    """Shared across the self-service and admin serializers: a medical
    certificate must say when it was issued, must be a PDF or image under
    5MB, and its content must actually match that extension — an attacker
    can rename anything to "certificate.pdf". Any other document_type
    keeps accepting any file, unrestricted, as before this type existed."""

    def validate(self, attrs):
        document_type = attrs.get(
            "document_type", getattr(self.instance, "document_type", DocumentType.OTHER),
        )
        if document_type == DocumentType.MEDICAL_CERTIFICATE:
            emission_date = attrs.get(
                "emission_date", getattr(self.instance, "emission_date", None),
            )
            if not emission_date:
                raise serializers.ValidationError({
                    "emission_date": "Emission date is required for a medical certificate.",
                })
            file = attrs.get("file")
            if file:
                extension = file.name.rsplit(".", 1)[-1].lower() if "." in file.name else ""
                if extension not in MEDICAL_CERTIFICATE_EXTENSIONS:
                    raise serializers.ValidationError({
                        "file": "A medical certificate must be a PDF or image file.",
                    })
                if file.size > MEDICAL_CERTIFICATE_MAX_SIZE:
                    raise serializers.ValidationError({
                        "file": "A medical certificate must be at most 5MB.",
                    })
                content_matches = (
                    _looks_like_a_pdf(file) if extension == "pdf" else _looks_like_an_image(file)
                )
                if not content_matches:
                    raise serializers.ValidationError({
                        "file": "The file's content doesn't match a PDF or image.",
                    })
        return attrs


class DocumentSerializer(DocumentValidationMixin, serializers.ModelSerializer):
    """User-facing: user is always the authenticated request user, set in the view."""

    class Meta:
        model = Document
        fields = ["id", "file", "user", "date", "document_type", "emission_date"]
        read_only_fields = ["id", "user", "date"]


class AdminDocumentSerializer(DocumentValidationMixin, serializers.ModelSerializer):
    """Admin-facing: user is explicitly chosen, targeting any account."""

    class Meta:
        model = Document
        fields = ["id", "file", "user", "date", "document_type", "emission_date"]
        read_only_fields = ["id", "date"]
