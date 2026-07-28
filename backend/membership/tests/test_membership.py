import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework import status as http_status

from membership.models import Membership, MembershipRule
from utils.mock_membership import make_membership_payload

LIST_URL = "/api/membership/memberships/"
RULE_URL = "/api/membership/rules/"

MEMBERSHIP_FIELDS = {"id", "name", "type", "contribution", "color", "max_events", "duration", "rules",
                     "start_date", "end_date"}
RULE_FIELDS = {"id", "membership", "event_type", "max_events"}


def detail_url(pk):
    return f"{LIST_URL}{pk}/"


def detail_rule_url(pk):
    return f"{RULE_URL}{pk}/"


def create_membership(**overrides):
    payload = make_membership_payload(**overrides)
    return Membership.objects.create(
        name=payload["name"],
        type=payload["type"],
        contribution=payload["contribution"],
        color=payload["color"],
    )


def make_rule_payload(membership, event_type, **overrides):
    payload = {
        "membership": membership.pk,
        "event_type_id": event_type.pk,
        "max_events": 4,
    }
    payload.update(overrides)
    return payload


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
        assert set(response.data[0].keys()) == MEMBERSHIP_FIELDS

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
        assert set(response.data.keys()) == MEMBERSHIP_FIELDS

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

    def test_new_membership_has_empty_rules(self, staff_client, db):
        response = staff_client.post(LIST_URL, make_membership_payload(), format="json")
        assert response.data["rules"] == []


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

    def test_retrieve_includes_rules(self, staff_client, db, event_type):
        membership = create_membership()
        MembershipRule.objects.create(membership=membership, event_type=event_type, max_events=3)
        response = staff_client.get(detail_url(membership.pk))
        assert len(response.data["rules"]) == 1
        assert response.data["rules"][0]["max_events"] == 3


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


# ── MembershipRule authentication ─────────────────────────────────────────────

class TestMembershipRuleAuthentication:

    def test_unauthenticated_list_returns_401(self, client, db):
        response = client.get(RULE_URL)
        assert response.status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_unauthenticated_create_returns_401(self, client, db, event_type):
        membership = create_membership()
        response = client.post(RULE_URL, make_rule_payload(membership, event_type), format="json")
        assert response.status_code == http_status.HTTP_401_UNAUTHORIZED


# ── MembershipRule student permissions ───────────────────────────────────────

class TestMembershipRuleStudentPermissions:

    def test_student_can_list_rules(self, student_client, db):
        response = student_client.get(RULE_URL)
        assert response.status_code == http_status.HTTP_200_OK

    def test_student_cannot_create_rule(self, student_client, db, event_type):
        membership = create_membership()
        response = student_client.post(RULE_URL, make_rule_payload(membership, event_type), format="json")
        assert response.status_code == http_status.HTTP_403_FORBIDDEN

    def test_student_cannot_delete_rule(self, student_client, db, event_type):
        membership = create_membership()
        rule = MembershipRule.objects.create(membership=membership, event_type=event_type, max_events=1)
        response = student_client.delete(detail_rule_url(rule.pk))
        assert response.status_code == http_status.HTTP_403_FORBIDDEN


# ── MembershipRule CRUD ───────────────────────────────────────────────────────

class TestMembershipRuleCRUD:

    def test_staff_can_create_rule(self, staff_client, db, event_type):
        membership = create_membership()
        response = staff_client.post(RULE_URL, make_rule_payload(membership, event_type), format="json")
        assert response.status_code == http_status.HTTP_201_CREATED

    def test_create_rule_persists(self, staff_client, db, event_type):
        membership = create_membership()
        staff_client.post(RULE_URL, make_rule_payload(membership, event_type), format="json")
        assert MembershipRule.objects.filter(membership=membership, event_type=event_type).exists()

    def test_create_rule_returns_correct_fields(self, staff_client, db, event_type):
        membership = create_membership()
        response = staff_client.post(RULE_URL, make_rule_payload(membership, event_type), format="json")
        assert set(response.data.keys()) == RULE_FIELDS

    def test_rule_event_type_is_nested(self, staff_client, db, event_type):
        membership = create_membership()
        response = staff_client.post(RULE_URL, make_rule_payload(membership, event_type), format="json")
        assert isinstance(response.data["event_type"], dict)
        assert response.data["event_type"]["id"] == event_type.pk

    def test_create_rule_stores_max_events(self, staff_client, db, event_type):
        membership = create_membership()
        response = staff_client.post(RULE_URL, make_rule_payload(membership, event_type, max_events=8), format="json")
        assert response.data["max_events"] == 8

    def test_staff_can_update_rule(self, staff_client, db, event_type):
        membership = create_membership()
        rule = MembershipRule.objects.create(membership=membership, event_type=event_type, max_events=1)
        payload = make_rule_payload(membership, event_type, max_events=10)
        response = staff_client.put(detail_rule_url(rule.pk), payload, format="json")
        assert response.status_code == http_status.HTTP_200_OK
        rule.refresh_from_db()
        assert rule.max_events == 10

    def test_staff_can_patch_rule(self, staff_client, db, event_type):
        membership = create_membership()
        rule = MembershipRule.objects.create(membership=membership, event_type=event_type, max_events=1)
        response = staff_client.patch(detail_rule_url(rule.pk), {"max_events": 5}, format="json")
        assert response.status_code == http_status.HTTP_200_OK
        rule.refresh_from_db()
        assert rule.max_events == 5

    def test_staff_can_delete_rule(self, staff_client, db, event_type):
        membership = create_membership()
        rule = MembershipRule.objects.create(membership=membership, event_type=event_type, max_events=1)
        response = staff_client.delete(detail_rule_url(rule.pk))
        assert response.status_code == http_status.HTTP_204_NO_CONTENT
        assert not MembershipRule.objects.filter(pk=rule.pk).exists()

    def test_delete_rule_nonexistent_returns_404(self, staff_client, db):
        response = staff_client.delete(detail_rule_url(9999))
        assert response.status_code == http_status.HTTP_404_NOT_FOUND

    def test_filter_rules_by_membership(self, staff_client, db, event_type):
        m1 = create_membership()
        m2 = create_membership()
        MembershipRule.objects.create(membership=m1, event_type=event_type, max_events=2)
        MembershipRule.objects.create(membership=m2, event_type=event_type, max_events=3)
        response = staff_client.get(f"{RULE_URL}?membership={m1.pk}")
        assert len(response.data) == 1
        assert response.data[0]["membership"] == m1.pk

    def test_list_rules_returns_all_without_filter(self, staff_client, db, event_type):
        m1 = create_membership()
        m2 = create_membership()
        MembershipRule.objects.create(membership=m1, event_type=event_type, max_events=1)
        MembershipRule.objects.create(membership=m2, event_type=event_type, max_events=2)
        response = staff_client.get(RULE_URL)
        assert len(response.data) == 2

    def test_membership_retrieve_includes_rules(self, staff_client, db, event_type):
        membership = create_membership()
        MembershipRule.objects.create(membership=membership, event_type=event_type, max_events=5)
        response = staff_client.get(detail_url(membership.pk))
        assert len(response.data["rules"]) == 1
        assert response.data["rules"][0]["max_events"] == 5
        assert response.data["rules"][0]["event_type"]["id"] == event_type.pk


# ── Duration field ────────────────────────────────────────────────────────────

class TestMembershipDuration:

    def test_duration_is_returned_in_list(self, staff_client, db):
        Membership.objects.create(name="Plan", contribution=50, duration=3)
        response = staff_client.get(LIST_URL)
        assert response.data[0]["duration"] == 3

    def test_duration_is_returned_in_retrieve(self, staff_client, db):
        m = Membership.objects.create(name="Plan", contribution=50, duration=6)
        response = staff_client.get(detail_url(m.pk))
        assert response.data["duration"] == 6

    def test_create_with_duration(self, staff_client, db):
        payload = make_membership_payload(duration=12)
        response = staff_client.post(LIST_URL, payload, format="json")
        assert response.status_code == http_status.HTTP_201_CREATED
        assert response.data["duration"] == 12

    def test_duration_default_is_zero(self, staff_client, db):
        payload = make_membership_payload()
        payload.pop("duration", None)
        response = staff_client.post(LIST_URL, payload, format="json")
        assert response.status_code == http_status.HTTP_201_CREATED
        assert response.data["duration"] == 0

    def test_update_duration(self, staff_client, db):
        m = Membership.objects.create(name="Plan", contribution=50, duration=1)
        payload = make_membership_payload(duration=24)
        response = staff_client.put(detail_url(m.pk), payload, format="json")
        assert response.status_code == http_status.HTTP_200_OK
        m.refresh_from_db()
        assert m.duration == 24

    def test_response_includes_duration_field(self, staff_client, db):
        payload = make_membership_payload()
        response = staff_client.post(LIST_URL, payload, format="json")
        assert "duration" in response.data


# ── Booking window (start_date / end_date) ────────────────────────────────────

def make_windowed_membership(start=None, end=None, **overrides):
    payload = make_membership_payload(**overrides)
    return Membership.objects.create(
        name=payload["name"],
        type=payload["type"],
        contribution=payload["contribution"],
        start_date=start,
        end_date=end,
    )


class TestMembershipDates:

    def test_create_with_dates(self, staff_client, db):
        start = timezone.now() - timedelta(days=1)
        end = timezone.now() + timedelta(days=30)
        payload = make_membership_payload(
            start_date=start.isoformat(), end_date=end.isoformat(),
        )
        response = staff_client.post(LIST_URL, payload, format="json")
        assert response.status_code == http_status.HTTP_201_CREATED
        assert response.data["start_date"] is not None
        assert response.data["end_date"] is not None

    def test_create_persists_dates_to_db(self, staff_client, db):
        start = timezone.now() - timedelta(days=1)
        end = timezone.now() + timedelta(days=30)
        payload = make_membership_payload(
            start_date=start.isoformat(), end_date=end.isoformat(),
        )
        response = staff_client.post(LIST_URL, payload, format="json")
        membership = Membership.objects.get(pk=response.data["id"])
        assert membership.start_date == start
        assert membership.end_date == end

    def test_dates_default_to_null(self, staff_client, db):
        payload = make_membership_payload()
        payload.pop("start_date", None)
        payload.pop("end_date", None)
        response = staff_client.post(LIST_URL, payload, format="json")
        assert response.status_code == http_status.HTTP_201_CREATED
        assert response.data["start_date"] is None
        assert response.data["end_date"] is None

    def test_dates_returned_in_retrieve(self, staff_client, db):
        start = timezone.now() - timedelta(days=2)
        end = timezone.now() + timedelta(days=2)
        membership = make_windowed_membership(start=start, end=end)
        response = staff_client.get(detail_url(membership.pk))
        assert response.data["start_date"] is not None
        assert response.data["end_date"] is not None

    def test_patch_dates(self, staff_client, db):
        membership = make_windowed_membership()
        end = timezone.now() + timedelta(days=10)
        response = staff_client.patch(
            detail_url(membership.pk), {"end_date": end.isoformat()}, format="json",
        )
        assert response.status_code == http_status.HTTP_200_OK
        membership.refresh_from_db()
        assert membership.end_date == end

    def test_patch_clear_dates(self, staff_client, db):
        membership = make_windowed_membership(
            start=timezone.now() - timedelta(days=1),
            end=timezone.now() + timedelta(days=1),
        )
        response = staff_client.patch(
            detail_url(membership.pk), {"start_date": None, "end_date": None}, format="json",
        )
        assert response.status_code == http_status.HTTP_200_OK
        membership.refresh_from_db()
        assert membership.start_date is None
        assert membership.end_date is None


class TestMembershipStudentWindowVisibility:
    """Students must only see memberships whose booking window covers now."""

    def test_student_sees_membership_inside_window(self, student_client, db):
        make_windowed_membership(
            start=timezone.now() - timedelta(days=1),
            end=timezone.now() + timedelta(days=1),
        )
        response = student_client.get(LIST_URL)
        assert len(response.data) == 1

    def test_student_sees_membership_without_window(self, student_client, db):
        make_windowed_membership(start=None, end=None)
        response = student_client.get(LIST_URL)
        assert len(response.data) == 1

    def test_student_does_not_see_expired_membership(self, student_client, db):
        make_windowed_membership(end=timezone.now() - timedelta(minutes=1))
        response = student_client.get(LIST_URL)
        assert response.data == []

    def test_student_does_not_see_not_yet_started_membership(self, student_client, db):
        make_windowed_membership(start=timezone.now() + timedelta(minutes=1))
        response = student_client.get(LIST_URL)
        assert response.data == []

    def test_student_sees_membership_with_only_past_start(self, student_client, db):
        make_windowed_membership(start=timezone.now() - timedelta(days=1))
        response = student_client.get(LIST_URL)
        assert len(response.data) == 1

    def test_student_sees_membership_with_only_future_end(self, student_client, db):
        make_windowed_membership(end=timezone.now() + timedelta(days=1))
        response = student_client.get(LIST_URL)
        assert len(response.data) == 1

    def test_student_retrieve_out_of_window_returns_404(self, student_client, db):
        membership = make_windowed_membership(end=timezone.now() - timedelta(days=1))
        response = student_client.get(detail_url(membership.pk))
        assert response.status_code == http_status.HTTP_404_NOT_FOUND

    def test_student_list_mixes_only_available(self, student_client, db):
        available = make_windowed_membership(
            start=timezone.now() - timedelta(days=1),
            end=timezone.now() + timedelta(days=1),
        )
        make_windowed_membership(end=timezone.now() - timedelta(days=1))
        make_windowed_membership(start=timezone.now() + timedelta(days=1))
        response = student_client.get(LIST_URL)
        assert [m["id"] for m in response.data] == [available.pk]

    def test_staff_sees_out_of_window_memberships(self, staff_client, db):
        make_windowed_membership(end=timezone.now() - timedelta(days=1))
        make_windowed_membership(start=timezone.now() + timedelta(days=1))
        response = staff_client.get(LIST_URL)
        assert len(response.data) == 2

    def test_staff_can_retrieve_out_of_window_membership(self, staff_client, db):
        membership = make_windowed_membership(end=timezone.now() - timedelta(days=1))
        response = staff_client.get(detail_url(membership.pk))
        assert response.status_code == http_status.HTTP_200_OK
