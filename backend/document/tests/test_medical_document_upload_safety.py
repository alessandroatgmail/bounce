"""
A medical certificate's extension alone (checked in test_medical_documents.py)
isn't enough: an attacker can rename anything to "certificate.pdf" or
"certificate.jpg". These tests check the upload is also harmless in ways the
extension can't guarantee — the bytes actually match the claimed type, the
file isn't absurdly large, and a crafted filename can't escape MEDIA_ROOT.
"""
import io
import os

from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework import status as http_status

from document.models import Document

LIST_URL = "/api/documents/documents/"

GENUINE_PDF_HEADER = b"%PDF-1.4\n"


def make_genuine_png(name="certificate.png"):
    # The real-image check fully decodes the file (Pillow's verify()), not
    # just its magic bytes, so a fake PNG signature + garbage isn't enough.
    buf = io.BytesIO()
    Image.new("RGB", (1, 1)).save(buf, format="PNG")
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/png")


def entry(file, emission_date="2026-09-01"):
    return {"file": file, "document_type": "medical_certificate", "emission_date": emission_date}


class TestContentMustMatchItsExtension:

    def test_rejects_pdf_extension_whose_content_is_not_a_pdf(self, student_client, db):
        fake = SimpleUploadedFile("certificate.pdf", b"just some text, not a pdf", content_type="application/pdf")
        res = student_client.post(LIST_URL, entry(fake), format="multipart")
        assert res.status_code == http_status.HTTP_400_BAD_REQUEST
        assert "file" in res.data
        assert Document.objects.count() == 0

    def test_rejects_image_extension_whose_content_is_not_an_image(self, student_client, db):
        fake = SimpleUploadedFile("certificate.png", b"just some text, not a png", content_type="image/png")
        res = student_client.post(LIST_URL, entry(fake), format="multipart")
        assert res.status_code == http_status.HTTP_400_BAD_REQUEST
        assert "file" in res.data
        assert Document.objects.count() == 0

    def test_rejects_an_executable_disguised_with_an_image_extension(self, student_client, db):
        # ELF header — a Linux executable renamed to look like a PNG.
        disguised = SimpleUploadedFile(
            "certificate.png", b"\x7fELF\x02\x01\x01\x00" + b"\x00" * 50, content_type="image/png",
        )
        res = student_client.post(LIST_URL, entry(disguised), format="multipart")
        assert res.status_code == http_status.HTTP_400_BAD_REQUEST
        assert Document.objects.count() == 0

    def test_accepts_a_genuine_pdf(self, student_client, db):
        real = SimpleUploadedFile("certificate.pdf", GENUINE_PDF_HEADER + b"rest of a real pdf body", content_type="application/pdf")
        res = student_client.post(LIST_URL, entry(real), format="multipart")
        assert res.status_code == http_status.HTTP_201_CREATED

    def test_accepts_a_genuine_png(self, student_client, db):
        res = student_client.post(LIST_URL, entry(make_genuine_png()), format="multipart")
        assert res.status_code == http_status.HTTP_201_CREATED


class TestServerSideSizeLimit:

    def test_rejects_an_oversized_file_even_without_relying_on_the_frontend_check(self, student_client, db):
        oversized = SimpleUploadedFile(
            "certificate.pdf",
            GENUINE_PDF_HEADER + b"0" * (5 * 1024 * 1024 + 1),
            content_type="application/pdf",
        )
        res = student_client.post(LIST_URL, entry(oversized), format="multipart")
        assert res.status_code == http_status.HTTP_400_BAD_REQUEST
        assert "file" in res.data
        assert Document.objects.count() == 0

    def test_accepts_a_file_right_at_the_size_limit(self, student_client, db):
        at_limit = SimpleUploadedFile(
            "certificate.pdf",
            GENUINE_PDF_HEADER + b"0" * (5 * 1024 * 1024 - len(GENUINE_PDF_HEADER)),
            content_type="application/pdf",
        )
        res = student_client.post(LIST_URL, entry(at_limit), format="multipart")
        assert res.status_code == http_status.HTTP_201_CREATED


class TestFilenameCannotEscapeMediaRoot:

    def test_a_path_traversal_filename_is_rejected_or_safely_contained(self, student_client, db, settings):
        traversal = SimpleUploadedFile(
            "../../../../etc/passwd.pdf", GENUINE_PDF_HEADER + b"rest of a real pdf body", content_type="application/pdf",
        )
        res = student_client.post(LIST_URL, entry(traversal), format="multipart")
        if res.status_code == http_status.HTTP_201_CREATED:
            doc = Document.objects.get()
            media_root = os.path.abspath(settings.MEDIA_ROOT)
            stored_path = os.path.abspath(doc.file.path)
            assert os.path.commonpath([media_root, stored_path]) == media_root
        else:
            assert Document.objects.count() == 0
