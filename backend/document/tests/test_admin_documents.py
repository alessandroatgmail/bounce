from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status as http_status

from document.models import Document

LIST_URL = "/api/documents/admin/documents/"


def detail_url(pk):
    return f"{LIST_URL}{pk}/"


def make_file(name="doc.txt", content=b"hello world"):
    return SimpleUploadedFile(name, content, content_type="text/plain")


def make_document(user, name="existing.txt"):
    return Document.objects.create(user=user, file=make_file(name))


# ── Authentication / permissions ────────────────────────────────────────

class TestAdminDocumentPermissions:

    def test_unauthenticated_list_returns_401(self, client, db):
        assert client.get(LIST_URL).status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_student_list_returns_403(self, student_client, db):
        assert student_client.get(LIST_URL).status_code == http_status.HTTP_403_FORBIDDEN

    def test_student_create_returns_403(self, student_client, student_user, db):
        res = student_client.post(LIST_URL, {"file": make_file(), "user": student_user.pk}, format="multipart")
        assert res.status_code == http_status.HTTP_403_FORBIDDEN


# ── Create ───────────────────────────────────────────────────────────────

class TestAdminDocumentCreate:

    def test_admin_can_create_document_for_any_user(self, admin_client, student_user, db):
        res = admin_client.post(
            LIST_URL, {"file": make_file(), "user": student_user.pk}, format="multipart",
        )
        assert res.status_code == http_status.HTTP_201_CREATED
        assert res.data["user"] == student_user.pk
        assert Document.objects.get().user == student_user


# ── List / retrieve ──────────────────────────────────────────────────────

class TestAdminDocumentReadAll:

    def test_admin_sees_documents_from_every_user(self, admin_client, student_user, other_user, db):
        make_document(student_user)
        make_document(other_user)
        res = admin_client.get(LIST_URL)
        assert res.status_code == http_status.HTTP_200_OK
        assert len(res.data) == 2

    def test_admin_can_filter_by_user(self, admin_client, student_user, other_user, db):
        make_document(student_user)
        make_document(other_user)
        res = admin_client.get(LIST_URL, {"user": student_user.pk})
        assert res.status_code == http_status.HTTP_200_OK
        assert len(res.data) == 1
        assert res.data[0]["user"] == student_user.pk

    def test_admin_can_retrieve_any_document(self, admin_client, other_user, db):
        doc = make_document(other_user)
        assert admin_client.get(detail_url(doc.pk)).status_code == http_status.HTTP_200_OK


# ── Update ───────────────────────────────────────────────────────────────

class TestAdminDocumentUpdate:

    def test_admin_can_update_document_file(self, admin_client, student_user, db):
        doc = make_document(student_user)
        res = admin_client.patch(detail_url(doc.pk), {"file": make_file("replacement.txt")}, format="multipart")
        assert res.status_code == http_status.HTTP_200_OK
        doc.refresh_from_db()
        assert "replacement" in doc.file.name

    def test_admin_can_reassign_document_to_another_user(self, admin_client, student_user, other_user, db):
        doc = make_document(student_user)
        res = admin_client.patch(detail_url(doc.pk), {"user": other_user.pk}, format="multipart")
        assert res.status_code == http_status.HTTP_200_OK
        doc.refresh_from_db()
        assert doc.user == other_user


# ── Delete ───────────────────────────────────────────────────────────────

class TestAdminDocumentDelete:

    def test_admin_can_delete_any_document(self, admin_client, student_user, db):
        doc = make_document(student_user)
        res = admin_client.delete(detail_url(doc.pk))
        assert res.status_code == http_status.HTTP_204_NO_CONTENT
        assert Document.objects.count() == 0
