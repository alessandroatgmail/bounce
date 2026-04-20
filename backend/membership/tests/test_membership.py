import pytest
from rest_framework import status as http_status

from membership.models import Membership
from utils.mock_membership import make_membership_payload

LIST_URL = "/api/membership/memberships/"


def detail_url(pk):
    return f"{LIST_URL}{pk}/"


def create_membership(**overrides):
    payload = make_membership_payload(**overrides)
    return Membership.objects.create(
        name=payload["name"],
        type=payload["type"],
        contribution=payload["contribution"],
        max_courses=payload["max_courses"],
        max_parties=payload["max_parties"],
        color=payload["color"],
    )


# ── Authentication ────────────────────────────────────────────────────────────

class TestMembershipAuthentication:

    def test_unauthenticated_list_returns_401(self, client):
        response = client.get(LIST_URL)
        assert response.status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_unauthenticated_retrieve_returns_401(self, client, db):
        membership = create_membership()
        response = client.get(detail_url(membership.pk))
        assert response.status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_unauthenticated_create_returns_401(self, client):
        response = client.post(LIST_URL, make_membership_payload(), format="json")
        assert response.status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_unauthenticated_update_returns_401(self, client, db):
        membership = create_membership()
        response = client.put(detail_url(membership.pk), make_membership_payload(), format="json")
        assert response.status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_unauthenticated_delete_returns_401(self, client, db):
        membership = create_membership()
        response = client.delete(detail_url(membership.pk))
        assert response.status_code == http_status.HTTP_401_UNAUTHORIZED


# ── Student permissions ───────────────────────────────────────────────────────

class TestMembershipStudentPermissions:

    def test_student_cannot_create_membership(self, student_client, db):
        response = student_client.post(LIST_URL, make_membership_payload(), format="json")
        assert response.status_code == http_status.HTTP_403_FORBIDDEN

    def test_student_cannot_update_membership(self, student_client, db):
        membership = create_membership()
        response = student_client.put(detail_url(membership.pk), make_membership_payload(), format="json")
        assert response.status_code == http_status.HTTP_403_FORBIDDEN

    def test_student_cannot_partial_update_membership(self, student_client, db):
        membership = create_membership()
        response = student_client.patch(detail_url(membership.pk), {"name": "hacked"}, format="json")
        assert response.status_code == http_status.HTTP_403_FORBIDDEN

    def test_student_cannot_delete_membership(self, student_client, db):
        membership = create_membership()
        response = student_client.delete(detail_url(membership.pk))
        assert response.status_code == http_status.HTTP_403_FORBIDDEN


# ── Student read access ───────────────────────────────────────────────────────

class TestMembershipStudentReadAccess:

    def test_student_can_list_memberships(self, student_client, db):
        create_membership()
        create_membership()
        response = student_client.get(LIST_URL)
        assert response.status_code == http_status.HTTP_200_OK
        assert len(response.data) == 2

    def test_student_can_retrieve_membership(self, student_client, db):
        membership = create_membership()
        response = student_client.get(detail_url(membership.pk))
        assert response.status_code == http_status.HTTP_200_OK

    def test_student_list_empty_returns_empty_array(self, student_client, db):
        response = student_client.get(LIST_URL)
        assert response.data == []


# ── Staff list ────────────────────────────────────────────────────────────────

class TestMembershipStaffList:

    def test_staff_can_list_memberships(self, staff_client, db):
        create_membership()
        create_membership()
        response = staff_client.get(LIST_URL)
        assert response.status_code == http_status.HTTP_200_OK
        assert len(response.data) == 2

    def test_list_returns_correct_fields(self, staff_client, db):
        create_membership()
        response = staff_client.get(LIST_URL)
        expected = {"id", "name", "type", "contribution", "max_courses", "max_parties", "color", "events"}
        assert set(response.data[0].keys()) == expected

    def test_empty_list_returns_empty_array(self, staff_client, db):
        response = staff_client.get(LIST_URL)
        assert response.data == []


# ── Staff create ──────────────────────────────────────────────────────────────

class TestMembershipCreate:

    def test_staff_can_create_membership(self, staff_client, db):
        response = staff_client.post(LIST_URL, make_membership_payload(), format="json")
        assert response.status_code == http_status.HTTP_201_CREATED

    def test_create_persists_to_db(self, staff_client, db):
        payload = make_membership_payload()
        staff_client.post(LIST_URL, payload, format="json")
        assert Membership.objects.filter(name=payload["name"]).exists()

    def test_create_returns_correct_fields(self, staff_client, db):
        response = staff_client.post(LIST_URL, make_membership_payload(), format="json")
        expected = {"id", "name", "type", "contribution", "max_courses", "max_parties", "color", "events"}
        assert set(response.data.keys()) == expected

    def test_create_stores_color(self, staff_client, db):
        payload = make_membership_payload(color="#123456")
        response = staff_client.post(LIST_URL, payload, format="json")
        assert response.data["color"] == "#123456"

    def test_create_without_color_stores_null(self, staff_client, db):
        payload = make_membership_payload(color=None)
        response = staff_client.post(LIST_URL, payload, format="json")
        assert response.data["color"] is None

    def test_create_invalid_color_returns_400(self, staff_client, db):
        payload = make_membership_payload(color="not-a-color")
        response = staff_client.post(LIST_URL, payload, format="json")
        assert response.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_create_default_contribution_is_zero(self, staff_client, db):
        payload = make_membership_payload()
        del payload["contribution"]
        response = staff_client.post(LIST_URL, payload, format="json")
        assert response.data["contribution"] == 0

    def test_create_default_type_is_single(self, staff_client, db):
        payload = make_membership_payload()
        del payload["type"]
        response = staff_client.post(LIST_URL, payload, format="json")
        assert response.data["type"] == "single"

    @pytest.mark.parametrize("field", ["name"])
    def test_create_missing_required_field_returns_400(self, staff_client, db, field):
        payload = make_membership_payload()
        del payload[field]
        response = staff_client.post(LIST_URL, payload, format="json")
        assert response.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_create_invalid_type_returns_400(self, staff_client, db):
        payload = make_membership_payload(type="invalid_type")
        response = staff_client.post(LIST_URL, payload, format="json")
        assert response.status_code == http_status.HTTP_400_BAD_REQUEST

    @pytest.mark.parametrize("membership_type", ["single", "monthly", "quarter", "year"])
    def test_create_all_valid_types(self, staff_client, db, membership_type):
        payload = make_membership_payload(type=membership_type)
        response = staff_client.post(LIST_URL, payload, format="json")
        assert response.status_code == http_status.HTTP_201_CREATED
        assert response.data["type"] == membership_type


# ── Staff retrieve ────────────────────────────────────────────────────────────

class TestMembershipRetrieve:

    def test_staff_can_retrieve_membership(self, staff_client, db):
        membership = create_membership()
        response = staff_client.get(detail_url(membership.pk))
        assert response.status_code == http_status.HTTP_200_OK

    def test_retrieve_returns_correct_data(self, staff_client, db):
        membership = create_membership(name="Gold", contribution=100)
        response = staff_client.get(detail_url(membership.pk))
        assert response.data["name"] == "Gold"
        assert response.data["contribution"] == 100

    def test_retrieve_nonexistent_returns_404(self, staff_client, db):
        response = staff_client.get(detail_url(9999))
        assert response.status_code == http_status.HTTP_404_NOT_FOUND


# ── Staff update ──────────────────────────────────────────────────────────────

class TestMembershipUpdate:

    def test_staff_can_full_update_membership(self, staff_client, db):
        membership = create_membership()
        response = staff_client.put(detail_url(membership.pk), make_membership_payload(), format="json")
        assert response.status_code == http_status.HTTP_200_OK

    def test_full_update_changes_fields(self, staff_client, db):
        membership = create_membership()
        payload = make_membership_payload(name="Updated", contribution=999)
        staff_client.put(detail_url(membership.pk), payload, format="json")
        membership.refresh_from_db()
        assert membership.name == "Updated"
        assert membership.contribution == 999

    def test_full_update_changes_color(self, staff_client, db):
        membership = create_membership(color="#aaaaaa")
        payload = make_membership_payload(color="#bbbbbb")
        staff_client.put(detail_url(membership.pk), payload, format="json")
        membership.refresh_from_db()
        assert membership.color == "#bbbbbb"

    def test_update_nonexistent_returns_404(self, staff_client, db):
        response = staff_client.put(detail_url(9999), make_membership_payload(), format="json")
        assert response.status_code == http_status.HTTP_404_NOT_FOUND


# ── Staff partial update ──────────────────────────────────────────────────────

class TestMembershipPartialUpdate:

    def test_staff_can_patch_membership(self, staff_client, db):
        membership = create_membership()
        response = staff_client.patch(detail_url(membership.pk), {"name": "Patched"}, format="json")
        assert response.status_code == http_status.HTTP_200_OK

    def test_patch_changes_only_provided_fields(self, staff_client, db):
        membership = create_membership(contribution=50)
        staff_client.patch(detail_url(membership.pk), {"name": "Patched"}, format="json")
        membership.refresh_from_db()
        assert membership.name == "Patched"
        assert membership.contribution == 50

    def test_patch_color(self, staff_client, db):
        membership = create_membership(color="#111111")
        staff_client.patch(detail_url(membership.pk), {"color": "#ffffff"}, format="json")
        membership.refresh_from_db()
        assert membership.color == "#ffffff"

    def test_patch_clear_color(self, staff_client, db):
        membership = create_membership(color="#111111")
        staff_client.patch(detail_url(membership.pk), {"color": None}, format="json")
        membership.refresh_from_db()
        assert membership.color in (None, "")

    def test_patch_nonexistent_returns_404(self, staff_client, db):
        response = staff_client.patch(detail_url(9999), {"name": "x"}, format="json")
        assert response.status_code == http_status.HTTP_404_NOT_FOUND


# ── Staff delete ──────────────────────────────────────────────────────────────

class TestMembershipDelete:

    def test_staff_can_delete_membership(self, staff_client, db):
        membership = create_membership()
        response = staff_client.delete(detail_url(membership.pk))
        assert response.status_code == http_status.HTTP_204_NO_CONTENT

    def test_delete_removes_from_db(self, staff_client, db):
        membership = create_membership()
        pk = membership.pk
        staff_client.delete(detail_url(pk))
        assert not Membership.objects.filter(pk=pk).exists()

    def test_delete_nonexistent_returns_404(self, staff_client, db):
        response = staff_client.delete(detail_url(9999))
        assert response.status_code == http_status.HTTP_404_NOT_FOUND

    def test_delete_does_not_affect_other_memberships(self, staff_client, db):
        m1 = create_membership()
        m2 = create_membership()
        staff_client.delete(detail_url(m1.pk))
        assert Membership.objects.filter(pk=m2.pk).exists()
