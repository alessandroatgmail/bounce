import io

from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework import status as http_status

from document.models import Document

LIST_URL = "/api/documents/documents/"
ADMIN_LIST_URL = "/api/documents/admin/documents/"


def detail_url(pk):
    return f"{LIST_URL}{pk}/"


def make_pdf(name="certificate.pdf"):
    return SimpleUploadedFile(name, b"%PDF-1.4 fake content", content_type="application/pdf")


def make_image(name="certificate.jpg"):
    # A genuine 1x1 JPEG, not just a file named like one — content
    # validation (see test_medical_document_upload_safety.py) checks the
    # actual bytes, not only the extension.
    buf = io.BytesIO()
    Image.new("RGB", (1, 1)).save(buf, format="JPEG")
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/jpeg")


def make_text_file(name="certificate.txt"):
    return SimpleUploadedFile(name, b"not a pdf or image", content_type="text/plain")


# ── Creating a medical certificate ──────────────────────────────────────

class TestMedicalDocumentCreate:

    def test_student_can_upload_medical_certificate_with_emission_date(self, student_client, student_user, db):
        res = student_client.post(
            LIST_URL,
            {"file": make_pdf(), "document_type": "medical_certificate", "emission_date": "2026-09-01"},
            format="multipart",
        )
        assert res.status_code == http_status.HTTP_201_CREATED
        doc = Document.objects.get()
        assert doc.document_type == "medical_certificate"
        assert str(doc.emission_date) == "2026-09-01"

    def test_medical_certificate_accepts_image_file(self, student_client, db):
        res = student_client.post(
            LIST_URL,
            {"file": make_image(), "document_type": "medical_certificate", "emission_date": "2026-09-01"},
            format="multipart",
        )
        assert res.status_code == http_status.HTTP_201_CREATED

    def test_medical_certificate_without_emission_date_returns_400(self, student_client, db):
        res = student_client.post(
            LIST_URL,
            {"file": make_pdf(), "document_type": "medical_certificate"},
            format="multipart",
        )
        assert res.status_code == http_status.HTTP_400_BAD_REQUEST
        assert "emission_date" in res.data
        assert Document.objects.count() == 0

    def test_medical_certificate_rejects_non_pdf_non_image_file(self, student_client, db):
        res = student_client.post(
            LIST_URL,
            {"file": make_text_file(), "document_type": "medical_certificate", "emission_date": "2026-09-01"},
            format="multipart",
        )
        assert res.status_code == http_status.HTTP_400_BAD_REQUEST
        assert "file" in res.data
        assert Document.objects.count() == 0


# ── Backward compatibility: generic (non-medical) uploads are untouched ──

class TestGenericDocumentUnaffected:

    def test_document_type_defaults_to_other(self, student_client, db):
        res = student_client.post(LIST_URL, {"file": make_text_file()}, format="multipart")
        assert res.status_code == http_status.HTTP_201_CREATED
        assert Document.objects.get().document_type == "other"

    def test_generic_document_does_not_require_emission_date(self, student_client, db):
        res = student_client.post(
            LIST_URL, {"file": make_text_file(), "document_type": "other"}, format="multipart",
        )
        assert res.status_code == http_status.HTTP_201_CREATED

    def test_generic_document_accepts_any_file_extension(self, student_client, db):
        res = student_client.post(LIST_URL, {"file": make_text_file()}, format="multipart")
        assert res.status_code == http_status.HTTP_201_CREATED


# ── Admin endpoint follows the same validation ──────────────────────────

class TestAdminMedicalDocument:

    def test_admin_medical_certificate_without_emission_date_returns_400(self, admin_client, student_user, db):
        res = admin_client.post(
            ADMIN_LIST_URL,
            {"file": make_pdf(), "user": student_user.pk, "document_type": "medical_certificate"},
            format="multipart",
        )
        assert res.status_code == http_status.HTTP_400_BAD_REQUEST
        assert Document.objects.count() == 0

    def test_admin_can_create_medical_certificate_for_a_user(self, admin_client, student_user, db):
        res = admin_client.post(
            ADMIN_LIST_URL,
            {
                "file": make_pdf(), "user": student_user.pk,
                "document_type": "medical_certificate", "emission_date": "2026-01-15",
            },
            format="multipart",
        )
        assert res.status_code == http_status.HTTP_201_CREATED
        doc = Document.objects.get()
        assert doc.user == student_user
        assert doc.document_type == "medical_certificate"
        assert str(doc.emission_date) == "2026-01-15"
