import io

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status as http_status

from document.models import Document

LIST_URL = "/api/documents/documents/"


def detail_url(pk):
    return f"{LIST_URL}{pk}/"


def make_file(name="doc.txt", content=b"hello world"):
    return SimpleUploadedFile(name, content, content_type="text/plain")


def make_document(user, name="existing.txt"):
    return Document.objects.create(user=user, file=make_file(name))


# ── Authentication ─────────────────────────────────────────────────────────

class TestDocumentAuthentication:

    def test_unauthenticated_list_returns_401(self, client, db):
        assert client.get(LIST_URL).status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_unauthenticated_create_returns_401(self, client, db):
        res = client.post(LIST_URL, {"file": make_file()}, format="multipart")
        assert res.status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_unauthenticated_retrieve_returns_401(self, client, db):
        assert client.get(detail_url(999)).status_code == http_status.HTTP_401_UNAUTHORIZED


# ── Create ───────────────────────────────────────────────────────────────

class TestDocumentCreate:

    def test_student_can_upload_document(self, student_client, student_user, db):
        res = student_client.post(LIST_URL, {"file": make_file()}, format="multipart")
        assert res.status_code == http_status.HTTP_201_CREATED
        assert Document.objects.count() == 1
        assert Document.objects.get().user == student_user

    def test_user_is_always_set_to_the_authenticated_user(self, student_client, student_user, other_user, db):
        """Even if a different user id is sent in the payload, the owner is the requester."""
        res = student_client.post(
            LIST_URL, {"file": make_file(), "user": other_user.pk}, format="multipart",
        )
        assert res.status_code == http_status.HTTP_201_CREATED
        assert res.data["user"] == student_user.pk
        assert Document.objects.get().user == student_user


# ── List ─────────────────────────────────────────────────────────────────

class TestDocumentList:

    def test_student_sees_own_documents(self, student_client, student_user, db):
        make_document(student_user)
        res = student_client.get(LIST_URL)
        assert res.status_code == http_status.HTTP_200_OK
        assert len(res.data) == 1

    def test_student_does_not_see_other_users_documents(self, student_client, other_user, db):
        make_document(other_user)
        res = student_client.get(LIST_URL)
        assert res.status_code == http_status.HTTP_200_OK
        assert len(res.data) == 0


# ── Retrieve ─────────────────────────────────────────────────────────────

class TestDocumentRetrieve:

    def test_student_can_retrieve_own(self, student_client, student_user, db):
        doc = make_document(student_user)
        assert student_client.get(detail_url(doc.pk)).status_code == http_status.HTTP_200_OK

    def test_student_cannot_retrieve_other_users_document(self, student_client, other_user, db):
        doc = make_document(other_user)
        assert student_client.get(detail_url(doc.pk)).status_code == http_status.HTTP_404_NOT_FOUND


# ── No update / delete on the self-service endpoint ─────────────────────

class TestDocumentNoMutation:

    def test_student_cannot_update_own_document(self, student_client, student_user, db):
        doc = make_document(student_user)
        res = student_client.patch(detail_url(doc.pk), {"file": make_file("new.txt")}, format="multipart")
        assert res.status_code == http_status.HTTP_405_METHOD_NOT_ALLOWED

    def test_student_cannot_delete_own_document(self, student_client, student_user, db):
        doc = make_document(student_user)
        res = student_client.delete(detail_url(doc.pk))
        assert res.status_code == http_status.HTTP_405_METHOD_NOT_ALLOWED
