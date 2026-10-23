from datetime import timedelta

from django.utils import timezone
from rest_framework import status as http_status

from booking.models import Contribution, ContributionStatus
from event.models import Event
from membership.models import Membership
from users.models import User
from utils.mock_event import make_event_payload

LIST_URL = "/api/booking/contributions-admin/"
IDS_URL = "/api/booking/contributions-admin/ids/"


def make_event():
    payload = make_event_payload()
    return Event.objects.create(
        name=payload["name"],
        status=payload["status"],
        event_type_id=payload["event_type_id"],
        type=payload["type"],
        level_id=payload["level_id"],
        room_id=payload["room_id"],
        start_date=timezone.now() + timedelta(days=30),
        end_date=timezone.now() + timedelta(days=30, hours=2),
        duration=120,
        capacity=payload["capacity"],
    )


def make_membership(name="Monthly Pass"):
    return Membership.objects.create(name=name, contribution=50)


def make_contribution(
    user, event=None, membership=None, status=ContributionStatus.ACCEPTED, days_ago=0,
):
    c = Contribution.objects.create(
        user=user, amount="50.00", status=status, membership=membership,
        date=timezone.now() - timedelta(days=days_ago),
    )
    if event:
        c.events.set([event])
    return c


class TestContributionAdminListPermissions:

    def test_unauthenticated_returns_401(self, client, db):
        assert client.get(LIST_URL).status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_non_admin_returns_403(self, student_client, db):
        assert student_client.get(LIST_URL).status_code == http_status.HTTP_403_FORBIDDEN


class TestContributionAdminListShape:

    def test_lists_expected_fields(self, admin_client, subject_user, world_data):
        subject_user.first_name = "Jane"
        subject_user.last_name = "Doe"
        subject_user.phone = "+39 333 0000000"
        subject_user.save()
        event = make_event()
        membership = make_membership("Full Pass")
        make_contribution(subject_user, event=event, membership=membership, status=ContributionStatus.ACCEPTED)

        res = admin_client.get(LIST_URL)

        assert res.status_code == http_status.HTTP_200_OK
        row = res.data["results"][0]
        assert row["full_name"] == "Jane Doe"
        assert row["email"] == subject_user.email
        assert row["phone"] == "+39 333 0000000"
        assert row["plan"] == "Full Pass"
        assert row["status"] == "accepted"
        assert event.name in row["event"]
        assert row["user"] == subject_user.pk
        assert "date" in row

    def test_response_is_paginated(self, admin_client, subject_user, world_data):
        make_contribution(subject_user)

        res = admin_client.get(LIST_URL)

        assert res.status_code == http_status.HTTP_200_OK
        assert "count" in res.data
        assert "results" in res.data

    def test_contribution_without_event_or_membership_still_listed(self, admin_client, subject_user, db):
        make_contribution(subject_user)

        res = admin_client.get(LIST_URL)

        assert res.status_code == http_status.HTTP_200_OK
        row = res.data["results"][0]
        assert row["event"] in (None, "")
        assert row["plan"] is None


class TestContributionAdminListFilters:

    def test_filters_by_combined_name_or_email_search(self, admin_client, subject_user, partner_user, db):
        subject_user.first_name = "Jane"
        subject_user.last_name = "Doe"
        subject_user.save()
        make_contribution(subject_user)
        make_contribution(partner_user)

        res = admin_client.get(LIST_URL, {"name": "jane"})

        assert res.status_code == http_status.HTTP_200_OK
        assert res.data["count"] == 1
        assert res.data["results"][0]["user"] == subject_user.pk

    def test_filters_by_email_via_the_same_search_param(self, admin_client, subject_user, partner_user, db):
        make_contribution(subject_user)
        make_contribution(partner_user)

        res = admin_client.get(LIST_URL, {"name": subject_user.email})

        assert res.status_code == http_status.HTTP_200_OK
        assert res.data["count"] == 1
        assert res.data["results"][0]["user"] == subject_user.pk

    def test_filters_by_event(self, admin_client, subject_user, partner_user, world_data):
        event = make_event()
        make_contribution(subject_user, event=event)
        make_contribution(partner_user)

        res = admin_client.get(LIST_URL, {"event": event.pk})

        assert res.status_code == http_status.HTTP_200_OK
        assert res.data["count"] == 1
        assert res.data["results"][0]["user"] == subject_user.pk

    def test_filters_by_plan(self, admin_client, subject_user, partner_user, db):
        membership = make_membership()
        make_contribution(subject_user, membership=membership)
        make_contribution(partner_user)

        res = admin_client.get(LIST_URL, {"plan": membership.pk})

        assert res.status_code == http_status.HTTP_200_OK
        assert res.data["count"] == 1
        assert res.data["results"][0]["user"] == subject_user.pk

    def test_filters_by_status(self, admin_client, subject_user, partner_user, db):
        make_contribution(subject_user, status=ContributionStatus.PAYED)
        make_contribution(partner_user, status=ContributionStatus.CANCELLED)

        res = admin_client.get(LIST_URL, {"status": "payed"})

        assert res.status_code == http_status.HTTP_200_OK
        assert res.data["count"] == 1
        assert res.data["results"][0]["user"] == subject_user.pk

    def test_filters_by_date_range(self, admin_client, subject_user, partner_user, db):
        recent = make_contribution(subject_user, days_ago=1)
        old = make_contribution(partner_user, days_ago=30)

        today = timezone.now().date()
        res = admin_client.get(LIST_URL, {
            "date_from": (today - timedelta(days=5)).isoformat(),
            "date_to": today.isoformat(),
        })

        assert res.status_code == http_status.HTTP_200_OK
        returned_ids = {row["id"] for row in res.data["results"]}
        assert recent.pk in returned_ids
        assert old.pk not in returned_ids


class TestContributionAdminIds:

    def test_requires_admin(self, student_client, db):
        assert student_client.get(IDS_URL).status_code == http_status.HTTP_403_FORBIDDEN

    def test_returns_ids_and_distinct_user_ids_matching_filters(self, admin_client, subject_user, partner_user, db):
        c1 = make_contribution(subject_user)
        c2 = make_contribution(subject_user)
        make_contribution(partner_user)
        subject_user.first_name = "Jane"
        subject_user.save()

        res = admin_client.get(IDS_URL, {"name": "jane"})

        assert res.status_code == http_status.HTTP_200_OK
        assert set(res.data["ids"]) == {c1.pk, c2.pk}
        assert res.data["user_ids"] == [subject_user.pk]
        assert res.data["count"] == 2
