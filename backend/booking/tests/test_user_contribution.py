import datetime
import pytest
from dateutil.relativedelta import relativedelta
from datetime import timedelta
from django.utils import timezone
from rest_framework import status as http_status

from booking.models import Booking, Contribution
from config.models import SiteSettings
from event.models import Event, EventType, PartnerRole, Status
from membership.models import Membership, MembershipRule
from users.models import User
from utils.mock_event import make_event_payload
from utils.mock_event_type import make_event_type_payload

from booking.models import ContributionStatus

LIST_URL = "/api/booking/my-memberships/"
EVENT_LIST_URL = "/api/events/events/"


def detail_url(pk):
    return f"{LIST_URL}{pk}/"


def add_event_url(pk):
    return f"{LIST_URL}{pk}/add-event/"


# ── Shared helpers ─────────────────────────────────────────────────────────────

def make_membership(name="Plan", contribution=50, max_events=0, duration=0):
    return Membership.objects.create(name=name, contribution=contribution, max_events=max_events, duration=duration)


def make_event_type():
    return EventType.objects.create(**make_event_type_payload())


def make_event_with_type(event_type, start_date=None,):
    now = timezone.now()
    start = start_date or (now + timedelta(days=1))

    payload = make_event_payload()
    return Event.objects.create(
        name=payload["name"],
        status=payload["status"],
        event_type=event_type,
        type=payload["type"],
        level_id=payload["level_id"],
        room_id=payload["room_id"],
        start_date=start,
        end_date=start + timedelta(minutes=90),
        duration=90,
        capacity=payload["capacity"],
    )


def make_parent_with_future_children(n):
    now = timezone.now()
    parent = make_event_with_type(make_event_type(), start_date=now - timedelta(days=1))
    children = [make_event_with_type(make_event_type(), start_date=now + timedelta(hours=i + 1)) for i in range(n)]
    parent.events.set(children)
    return parent, children


# ── Authentication ─────────────────────────────────────────────────────────────

class TestUserContributionAuthentication:

    def test_unauthenticated_list_returns_401(self, client, db):
        assert client.get(LIST_URL).status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_unauthenticated_create_returns_401(self, client, db):
        m = make_membership()
        res = client.post(LIST_URL, {"membership_id": m.pk}, format="json")
        assert res.status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_unauthenticated_retrieve_returns_401(self, client, db):
        assert client.get(detail_url(999)).status_code == http_status.HTTP_401_UNAUTHORIZED

    def test_unauthenticated_add_event_returns_401(self, client, db):
        assert client.post(add_event_url(999), {}, format="json").status_code == http_status.HTTP_401_UNAUTHORIZED


# ── List ──────────────────────────────────────────────────────────────────────

class TestUserContributionList:

    def test_student_sees_own_contributions(self, student_client, student_user, db):
        m = make_membership()
        Contribution.objects.create(amount=50, user=student_user, membership=m)
        res = student_client.get(LIST_URL)
        assert res.status_code == http_status.HTTP_200_OK
        assert len(res.data) == 1

    def test_student_does_not_see_other_users_contributions(self, student_client, subject_user, db):
        m = make_membership()
        Contribution.objects.create(amount=50, user=subject_user, membership=m)
        res = student_client.get(LIST_URL)
        assert res.status_code == http_status.HTTP_200_OK
        assert len(res.data) == 0

    def test_list_returns_correct_fields(self, student_client, student_user, db):
        m = make_membership()
        Contribution.objects.create(amount=50, user=student_user, membership=m)
        res = student_client.get(LIST_URL)
        assert {"id", "membership", "events", "amount"}.issubset(res.data[0].keys())

    def test_membership_is_nested_object(self, student_client, student_user, db):
        m = make_membership(name="Gold")
        Contribution.objects.create(amount=50, user=student_user, membership=m)
        res = student_client.get(LIST_URL)
        assert res.data[0]["membership"]["name"] == "Gold"


# ── Retrieve ──────────────────────────────────────────────────────────────────

class TestUserContributionRetrieve:

    def test_student_can_retrieve_own(self, student_client, student_user, db):
        m = make_membership()
        c = Contribution.objects.create(amount=50, user=student_user, membership=m)
        assert student_client.get(detail_url(c.pk)).status_code == http_status.HTTP_200_OK

    def test_student_cannot_retrieve_other_users(self, student_client, subject_user, db):
        m = make_membership()
        c = Contribution.objects.create(amount=50, user=subject_user, membership=m)
        assert student_client.get(detail_url(c.pk)).status_code == http_status.HTTP_404_NOT_FOUND


# ── Create ────────────────────────────────────────────────────────────────────

class TestUserContributionCreate:

    def test_create_without_event_returns_201(self, student_client, db):
        m = make_membership(contribution=80)
        res = student_client.post(LIST_URL, {"membership_id": m.pk}, format="json")
        assert res.status_code == http_status.HTTP_201_CREATED

    def test_amount_is_taken_from_membership(self, student_client, db):
        m = make_membership(contribution=75)
        res = student_client.post(LIST_URL, {"membership_id": m.pk}, format="json")
        assert float(res.data["amount"]) == pytest.approx(75)

    def test_contribution_is_assigned_to_requesting_user(self, student_client, student_user, db):
        m = make_membership()
        student_client.post(LIST_URL, {"membership_id": m.pk}, format="json")
        assert Contribution.objects.filter(user=student_user).exists()

    def test_create_without_event_creates_no_bookings(self, student_client, student_user, db):
        m = make_membership()
        student_client.post(LIST_URL, {"membership_id": m.pk}, format="json")
        assert Booking.objects.filter(user=student_user).count() == 0

    def test_create_with_event_returns_201(self, student_client, world_data):
        m = make_membership()
        parent, _ = make_parent_with_future_children(2)
        res = student_client.post(LIST_URL, {"membership_id": m.pk, "event_id": parent.pk}, format="json")
        assert res.status_code == http_status.HTTP_201_CREATED

    def test_create_with_event_does_not_sync_bookings_until_confirmed(self, student_client, student_user, world_data):
        m = make_membership()
        parent, children = make_parent_with_future_children(3)
        student_client.post(LIST_URL, {"membership_id": m.pk, "event_id": parent.pk}, format="json")
        assert Booking.objects.filter(user=student_user).count() == 0

    def test_create_missing_membership_id_returns_400(self, student_client, db):
        res = student_client.post(LIST_URL, {}, format="json")
        assert res.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_create_invalid_membership_id_returns_400(self, student_client, db):
        res = student_client.post(LIST_URL, {"membership_id": 9999}, format="json")
        assert res.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_create_validates_event_type_rule(self, student_client, world_data):
        et_a = make_event_type()
        et_b = make_event_type()
        m = make_membership()
        MembershipRule.objects.create(membership=m, event_type=et_a, max_events=1)
        event_b = make_event_with_type(et_b)
        res = student_client.post(LIST_URL, {"membership_id": m.pk, "event_id": event_b.pk}, format="json")
        assert res.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_create_validates_total_max_events(self, student_client, world_data):
        et = make_event_type()
        m = make_membership(max_events=0)  # unlimited — next test shows the cap
        MembershipRule.objects.create(membership=m, event_type=et, max_events=1)
        event = make_event_with_type(et)
        res = student_client.post(LIST_URL, {"membership_id": m.pk, "event_id": event.pk}, format="json")
        assert res.status_code == http_status.HTTP_201_CREATED

    def test_membership_without_rules_accepts_any_event(self, student_client, world_data):
        m = make_membership()
        et = make_event_type()
        event = make_event_with_type(et)
        res = student_client.post(LIST_URL, {"membership_id": m.pk, "event_id": event.pk}, format="json")
        assert res.status_code == http_status.HTTP_201_CREATED


# ── add_event action ──────────────────────────────────────────────────────────

class TestUserContributionAddEvent:

    def test_add_event_returns_200(self, student_client, student_user, world_data):
        m = make_membership()
        c = Contribution.objects.create(amount=50, user=student_user, membership=m)
        parent, _ = make_parent_with_future_children(1)
        res = student_client.post(add_event_url(c.pk), {"event_id": parent.pk}, format="json")
        assert res.status_code == http_status.HTTP_200_OK

    def test_add_event_persists_on_contribution(self, student_client, student_user, world_data):
        m = make_membership()
        c = Contribution.objects.create(amount=50, user=student_user, membership=m)
        parent, _ = make_parent_with_future_children(1)
        student_client.post(add_event_url(c.pk), {"event_id": parent.pk}, format="json")
        assert c.events.filter(pk=parent.pk).exists()

    def test_add_event_does_not_sync_bookings_when_not_confirmed(self, student_client, student_user, world_data):
        m = make_membership()
        c = Contribution.objects.create(amount=50, user=student_user, membership=m)
        parent, children = make_parent_with_future_children(2)
        student_client.post(add_event_url(c.pk), {"event_id": parent.pk}, format="json")
        assert Booking.objects.filter(user=student_user).count() == 0

    def test_add_event_syncs_bookings_when_confirmed(self, student_client, student_user, world_data):
        from booking.models import ContributionStatus
        m = make_membership()
        c = Contribution.objects.create(amount=50, user=student_user, membership=m)
        Contribution.objects.filter(pk=c.pk).update(status=ContributionStatus.CONFIRMED)
        c.refresh_from_db()
        parent, children = make_parent_with_future_children(2)
        student_client.post(add_event_url(c.pk), {"event_id": parent.pk}, format="json")
        assert Booking.objects.filter(user=student_user).count() == 2

    def test_add_event_returns_updated_contribution(self, student_client, student_user, world_data):
        m = make_membership()
        c = Contribution.objects.create(amount=50, user=student_user, membership=m)
        parent, _ = make_parent_with_future_children(1)
        res = student_client.post(add_event_url(c.pk), {"event_id": parent.pk}, format="json")
        assert parent.pk in res.data["events"]

    def test_add_event_missing_event_id_returns_400(self, student_client, student_user, db):
        m = make_membership()
        c = Contribution.objects.create(amount=50, user=student_user, membership=m)
        res = student_client.post(add_event_url(c.pk), {}, format="json")
        assert res.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_add_event_invalid_event_id_returns_400(self, student_client, student_user, db):
        m = make_membership()
        c = Contribution.objects.create(amount=50, user=student_user, membership=m)
        res = student_client.post(add_event_url(c.pk), {"event_id": 9999}, format="json")
        assert res.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_add_event_to_other_users_contribution_returns_404(self, student_client, subject_user, world_data):
        m = make_membership()
        c = Contribution.objects.create(amount=50, user=subject_user, membership=m)
        parent, _ = make_parent_with_future_children(1)
        res = student_client.post(add_event_url(c.pk), {"event_id": parent.pk}, format="json")
        assert res.status_code == http_status.HTTP_404_NOT_FOUND

    def test_add_event_validates_event_type_rule(self, student_client, student_user, world_data):
        et_a = make_event_type()
        et_b = make_event_type()
        m = make_membership()
        MembershipRule.objects.create(membership=m, event_type=et_a, max_events=1)
        c = Contribution.objects.create(amount=50, user=student_user, membership=m)
        event_b = make_event_with_type(et_b)
        res = student_client.post(add_event_url(c.pk), {"event_id": event_b.pk}, format="json")
        assert res.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_add_event_validates_per_type_max(self, student_client, student_user, world_data):
        et = make_event_type()
        m = make_membership()
        MembershipRule.objects.create(membership=m, event_type=et, max_events=1)
        first_event = make_event_with_type(et)
        c = Contribution.objects.create(amount=50, user=student_user, membership=m)
        c.events.add(first_event)
        second_event = make_event_with_type(et)
        res = student_client.post(add_event_url(c.pk), {"event_id": second_event.pk}, format="json")
        assert res.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_add_event_validates_total_max_events(self, student_client, student_user, world_data):
        et = make_event_type()
        m = make_membership(max_events=1)
        first_event = make_event_with_type(et)
        c = Contribution.objects.create(amount=50, user=student_user, membership=m)
        c.events.add(first_event)
        second_event = make_event_with_type(et)
        res = student_client.post(add_event_url(c.pk), {"event_id": second_event.pk}, format="json")
        assert res.status_code == http_status.HTTP_400_BAD_REQUEST


# ── end_date auto-computation ─────────────────────────────────────────────────

class TestUserContributionEndDate:

    def test_end_date_set_when_membership_has_duration(self, student_client, world_data, db):
        from dateutil.relativedelta import relativedelta as rd
        from datetime import timedelta
        et = make_event_type()
        e = make_event_with_type(et)
        m = make_membership(contribution=50, duration=3)
        print (f"Event end date: {e.end_date}")
        res = student_client.post(LIST_URL,
                                  {"membership_id": m.pk, "event_id":e.pk}, format="json")
        print (res.data)
        assert res.status_code == http_status.HTTP_201_CREATED

        c = Contribution.objects.get(pk=res.data["id"])
        assert c.events.count() == 1
        assert e in c.events.all()
        print (f"Event end date: {e.end_date}")
        assert c.end_date is not None

    def test_end_date_none_when_duration_is_zero(self, student_client, db):
        m = make_membership(contribution=50, duration=0)
        res = student_client.post(LIST_URL, {"membership_id": m.pk}, format="json")
        assert res.status_code == http_status.HTTP_201_CREATED
        c = Contribution.objects.get(pk=res.data["id"])
        assert c.end_date is None

    def test_end_date_in_response(self, student_client, world_data, db):
        et = make_event_type()
        e = make_event_with_type(et)
        m = make_membership(contribution=50, duration=1)
        res = student_client.post(LIST_URL, {"membership_id": m.pk, "event_id": e.pk}, format="json")
        assert res.status_code == http_status.HTTP_201_CREATED
        assert "end_date" in res.data
        assert res.data["end_date"] is not None


def upgrade_url(pk):
    return f"{LIST_URL}{pk}/upgrade/"


# ── Season end date validation ─────────────────────────────────────────────────

class TestSeasonEndDateValidation:

    def _set_season_end(self, days_from_now):
        end = (timezone.now() + timedelta(days=days_from_now)).date()
        s = SiteSettings.load()
        s.season_end = end
        s.save()
        return end

    def test_new_contribution_exceeding_season_end_returns_400(self, student_client, db):
        # Season ends in 10 days, membership lasts 2 months → exceeds season
        self._set_season_end(10)
        m = make_membership(contribution=50, duration=2)
        res = student_client.post(LIST_URL, {"membership_id": m.pk}, format="json")
        assert res.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_new_contribution_within_season_end_returns_201(self, student_client, db):
        # Season ends in 3 months, membership lasts 1 month → ok
        self._set_season_end(90)
        m = make_membership(contribution=50, duration=1)
        res = student_client.post(LIST_URL, {"membership_id": m.pk}, format="json")
        assert res.status_code == http_status.HTTP_201_CREATED

    def test_new_contribution_no_season_configured_returns_201(self, student_client, db):
        # No season_end set → no restriction
        s = SiteSettings.load()
        s.season_end = None
        s.save()
        m = make_membership(contribution=50, duration=2)
        res = student_client.post(LIST_URL, {"membership_id": m.pk}, format="json")
        assert res.status_code == http_status.HTTP_201_CREATED

    def test_new_contribution_no_duration_no_season_check(self, student_client, db):
        # Membership has no duration → season check doesn't apply
        self._set_season_end(5)
        m = make_membership(contribution=50, duration=0)
        res = student_client.post(LIST_URL, {"membership_id": m.pk}, format="json")
        assert res.status_code == http_status.HTTP_201_CREATED

    def test_error_message_mentions_season_end(self, student_client, db):
        season_end = self._set_season_end(10)
        m = make_membership(contribution=50, duration=2)
        res = student_client.post(LIST_URL, {"membership_id": m.pk}, format="json")
        assert str(season_end) in str(res.data)


# ── Upgrade action ────────────────────────────────────────────────────────────

class TestUpgrade:

    def _set_season_end(self, days_from_now):
        end = (timezone.now() + timedelta(days=days_from_now)).date()
        s = SiteSettings.load()
        s.season_end = end
        s.save()
        return end

    def test_upgrade_returns_201(self, student_client, student_user, db):
        self._set_season_end(30)
        m_old = make_membership(contribution=50, duration=1)
        m_new = make_membership(name="Premium", contribution=100, duration=2)
        c = Contribution.objects.create(amount=50, user=student_user, membership=m_old)
        res = student_client.post(upgrade_url(c.pk), {"membership_id": m_new.pk}, format="json")
        assert res.status_code == http_status.HTTP_201_CREATED

    def test_upgrade_closes_old_contribution(self, student_client, student_user, db):
        self._set_season_end(30)
        m_old = make_membership(contribution=50, duration=1)
        m_new = make_membership(name="Premium", contribution=100, duration=2)
        c = Contribution.objects.create(amount=50, user=student_user, membership=m_old)
        student_client.post(upgrade_url(c.pk), {"membership_id": m_new.pk}, format="json")
        c.refresh_from_db()
        assert c.end_date is not None
        assert abs((c.end_date - timezone.now()).total_seconds()) < 5

    def test_upgrade_new_contribution_ends_at_season_end(self, student_client, student_user, db):
        season_end = self._set_season_end(30)
        m_old = make_membership(contribution=50, duration=1)
        m_new = make_membership(name="Premium", contribution=100, duration=2)
        c = Contribution.objects.create(amount=50, user=student_user, membership=m_old)
        res = student_client.post(upgrade_url(c.pk), {"membership_id": m_new.pk}, format="json")
        new_c = Contribution.objects.get(pk=res.data["id"])
        assert new_c.end_date is not None
        assert new_c.end_date.date() == season_end

    def test_upgrade_sets_upgraded_from(self, student_client, student_user, db):
        self._set_season_end(30)
        m_old = make_membership(contribution=50, duration=1)
        m_new = make_membership(name="Premium", contribution=100, duration=2)
        c = Contribution.objects.create(amount=50, user=student_user, membership=m_old)
        res = student_client.post(upgrade_url(c.pk), {"membership_id": m_new.pk}, format="json")
        new_c = Contribution.objects.get(pk=res.data["id"])
        assert new_c.upgraded_from_id == c.pk

    def test_upgrade_new_contribution_amount_from_new_membership(self, student_client, student_user, db):
        self._set_season_end(30)
        m_old = make_membership(contribution=50, duration=1)
        m_new = make_membership(name="Premium", contribution=120, duration=2)
        c = Contribution.objects.create(amount=50, user=student_user, membership=m_old)
        res = student_client.post(upgrade_url(c.pk), {"membership_id": m_new.pk}, format="json")
        assert float(res.data["amount"]) == pytest.approx(120)

    def test_upgrade_missing_membership_id_returns_400(self, student_client, student_user, db):
        m = make_membership(contribution=50, duration=1)
        c = Contribution.objects.create(amount=50, user=student_user, membership=m)
        res = student_client.post(upgrade_url(c.pk), {}, format="json")
        assert res.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_upgrade_invalid_membership_id_returns_400(self, student_client, student_user, db):
        m = make_membership(contribution=50, duration=1)
        c = Contribution.objects.create(amount=50, user=student_user, membership=m)
        res = student_client.post(upgrade_url(c.pk), {"membership_id": 9999}, format="json")
        assert res.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_upgrade_other_users_contribution_returns_404(self, student_client, subject_user, db):
        m_old = make_membership(contribution=50, duration=1)
        m_new = make_membership(name="Premium", contribution=100, duration=2)
        c = Contribution.objects.create(amount=50, user=subject_user, membership=m_old)
        res = student_client.post(upgrade_url(c.pk), {"membership_id": m_new.pk}, format="json")
        assert res.status_code == http_status.HTTP_404_NOT_FOUND

    def test_upgrade_transfers_events_to_new_contribution(self, student_client, student_user, world_data):
        self._set_season_end(30)
        m_old = make_membership(contribution=50, duration=1)
        m_new = make_membership(name="Premium", contribution=100, duration=2)
        et = make_event_type()
        event1 = make_event_with_type(et)
        event2 = make_event_with_type(et)
        c = Contribution.objects.create(amount=50, user=student_user, membership=m_old)
        c.events.set([event1, event2])
        res = student_client.post(upgrade_url(c.pk), {"membership_id": m_new.pk}, format="json")
        new_c = Contribution.objects.get(pk=res.data["id"])
        assert set(new_c.events.values_list("id", flat=True)) == {event1.pk, event2.pk}

    def test_upgrade_events_no_duplicates(self, student_client, student_user, world_data):
        self._set_season_end(30)
        m_old = make_membership(contribution=50, duration=1)
        m_new = make_membership(name="Premium", contribution=100, duration=2)
        et = make_event_type()
        event = make_event_with_type(et)
        c = Contribution.objects.create(amount=50, user=student_user, membership=m_old)
        c.events.set([event])
        res = student_client.post(upgrade_url(c.pk), {"membership_id": m_new.pk}, format="json")
        new_c = Contribution.objects.get(pk=res.data["id"])
        assert new_c.events.count() == 1

    def test_upgrade_without_season_falls_back_to_membership_duration(self, student_client, student_user, db):
        s = SiteSettings.load()
        s.season_end = None
        s.save()
        m_old = make_membership(contribution=50, duration=1)
        m_new = make_membership(name="Premium", contribution=100, duration=3)
        c = Contribution.objects.create(amount=50, user=student_user, membership=m_old)
        res = student_client.post(upgrade_url(c.pk), {"membership_id": m_new.pk}, format="json")
        assert res.status_code == http_status.HTTP_201_CREATED
        new_c = Contribution.objects.get(pk=res.data["id"])
        expected = (timezone.now() + relativedelta(months=3)).date()
        assert new_c.end_date.date() == expected


# ── booking with partner action ────────────────────────────────────────────────────────────

class TestPartner:

    def test_create_contribution_with_partner_201(self, world_data, student_client, student_user, partner_user, db):
        from django.core import mail

        et = make_event_type()
        et.partners = 2
        leader = PartnerRole.objects.get(name='Leader')
        follower = PartnerRole.objects.get(name='Follower')
        et.partner_roles.add(leader)
        et.partner_roles.add(follower)
        et.save()
        first_event = make_event_with_type(et)
        first_event.capacity = 0
        first_event.save()
        m = make_membership()
        payload = {
            "membership_id": m.pk,
            "role_id": leader.id,
            "partner_email": "partner@email.com",
            "partner_id": partner_user.id,
            "event_id": first_event.id,
        }

        response = student_client.post(LIST_URL, payload, format="json")
        assert response.status_code == http_status.HTTP_201_CREATED
        assert "partner" in response.data
        assert "role" in response.data

        partner_contribution = Contribution.objects.filter(user=partner_user).first()
        original_contribution = Contribution.objects.get(id=response.data['id'])
        assert partner_contribution is not None
        assert first_event in partner_contribution.events.all()
        assert partner_contribution.partner == student_user
        assert partner_contribution.original_contribution == original_contribution

        # Verify that two emails were sent — one to the registrant, one to the partner
        assert len(mail.outbox) == 2
        recipients = [e.to[0] for e in mail.outbox]
        assert student_user.email in recipients
        assert partner_user.email in recipients

        # Build a mapping recipient -> email message, so the test does not
        # depend on the order in which emails were sent
        emails_by_recipient = {e.to[0]: e for e in mail.outbox}

        student_email = emails_by_recipient[student_user.email]
        partner_email = emails_by_recipient[partner_user.email]

        # Both subjects must mention the event name
        assert first_event.name in student_email.subject
        assert first_event.name in partner_email.subject

        # The registrant's email body must mention the partner's name
        assert partner_user.first_name in student_email.body

        # (optional, symmetric check) the partner's email body mentions the registrant
        assert student_user.first_name in partner_email.body

    def test_create_contribution_without_role_400(self, world_data, student_client, student_user, partner_user, db):
        et = make_event_type()
        et.partners = 2
        leader = PartnerRole.objects.get(name='Leader')
        follower = PartnerRole.objects.get(name='Follower')
        et.partner_roles.add(leader)
        et.partner_roles.add(follower)
        et.save()
        first_event = make_event_with_type(et)
        m = make_membership()
        # MembershipRule.objects.create(membership=m, event_type=et, max_events=1)
        payload = {
            "membership_id": m.pk,
            "partner_email": "partner@email.com",
            "partner_id": partner_user.id,
            "event_id": first_event.id,
        }

        response = student_client.post(LIST_URL, payload, format="json")
        print (response.data)
        assert response.status_code == http_status.HTTP_400_BAD_REQUEST
        partner_contribution = Contribution.objects.filter(user=partner_user).first()
        assert partner_contribution is None


class TestAutomaticAcceptance:
    """
    Test is some rules are met the status goes directly to accepted check also emails are sent
    """

    def test_create_contribution_with_partner_201(self, world_data, student_client, student_user, partner_user, db):
        """
        Test if couple under capacity status shall be accepted
        """
        from django.core import mail

        et = make_event_type()
        et.partners = 2
        leader = PartnerRole.objects.get(name='Leader')
        follower = PartnerRole.objects.get(name='Follower')
        et.partner_roles.add(leader)
        et.partner_roles.add(follower)
        et.save()
        first_event = make_event_with_type(et)
        first_event.capacity = 20
        first_event.save()
        m = make_membership()
        payload = {
            "membership_id": m.pk,
            "role_id": leader.id,
            "partner_email": "partner@email.com",
            "partner_id": partner_user.id,
            "event_id": first_event.id,
        }

        response = student_client.post(LIST_URL, payload, format="json")
        assert response.status_code == http_status.HTTP_201_CREATED
        assert "partner" in response.data
        assert "role" in response.data

        partner_contribution = Contribution.objects.filter(user=partner_user).first()
        original_contribution = Contribution.objects.get(id=response.data['id'])

        assert partner_contribution is not None
        assert partner_contribution.status == ContributionStatus.ACCEPTED
        assert original_contribution.status == ContributionStatus.ACCEPTED

        # Verify that 4 emails were sent — 2 for receiving the registration and 2 for being accepted
        assert len(mail.outbox) == 4

        # The acceptance emails are the ones whose subject mentions "accettazione"
        accepted_by_recipient = {
            e.to[0]: e for e in mail.outbox if "accettazione" in e.subject
        }
        assert set(accepted_by_recipient) == {student_user.email, partner_user.email}

        student_accepted = accepted_by_recipient[student_user.email]
        partner_accepted = accepted_by_recipient[partner_user.email]

        # Each acceptance email must show the partner's first/last name and the recipient's role
        assert original_contribution.partner.first_name in student_accepted.body
        assert original_contribution.partner.last_name in student_accepted.body
        assert str(original_contribution.role) in student_accepted.body

        assert partner_contribution.partner.first_name in partner_accepted.body
        assert partner_contribution.partner.last_name in partner_accepted.body
        assert str(partner_contribution.role) in partner_accepted.body

    def test_create_contribution_single_201(self, world_data, student_client, student_user, partner_user, db):
        """
        Test if couple under capacity status shall be accepted
        """
        from django.core import mail

        et = make_event_type()
        first_event = make_event_with_type(et)
        first_event.capacity = 20
        first_event.save()
        m = make_membership()
        payload = {
            "membership_id": m.pk,
            "event_id": first_event.id,
        }

        response = student_client.post(LIST_URL, payload, format="json")
        assert response.status_code == http_status.HTTP_201_CREATED

        original_contribution = Contribution.objects.get(id=response.data['id'])

        assert original_contribution.status == ContributionStatus.ACCEPTED

        # Verify that 2 emails were sent — 1 for receiving the registration and 1 for being accepted
        assert len(mail.outbox) == 2

    def test_retreve_event_after_booked_show_already_booked(self, world_data, student_client, student_user, partner_user, db):
        """
        Test if event has update already_booked
        """
        from django.core import mail

        et = make_event_type()
        first_event = make_event_with_type(et)
        first_event.capacity = 20
        first_event.status = Status.PUBLISHED
        first_event.save()
        m = make_membership()
        payload = {
            "membership_id": m.pk,
            "event_id": first_event.id,
        }

        response = student_client.post(LIST_URL, payload, format="json")
        assert response.status_code == http_status.HTTP_201_CREATED

        original_contribution = Contribution.objects.get(id=response.data['id'])

        assert original_contribution.status == ContributionStatus.ACCEPTED

        response = student_client.get(EVENT_LIST_URL)
        assert response.status_code == http_status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['id'] == first_event.id
        assert "already_booked" in response.data[0]
        assert response.data[0]["already_booked"] is True

    def test_retreve_event_booked_by_partner_shows_booker_name(self, world_data, student_client, student_user, partner_user, db):
        """
        Test that booked_by returns the booker's name for the partner,
        and stays empty for the user who made the booking.
        """
        from rest_framework.test import APIClient

        student_user.first_name = "Anna"
        student_user.last_name = "Rossi"
        student_user.save()

        et = make_event_type()
        et.partners = 2
        leader = PartnerRole.objects.get(name='Leader')
        follower = PartnerRole.objects.get(name='Follower')
        et.partner_roles.add(leader)
        et.partner_roles.add(follower)
        et.save()
        first_event = make_event_with_type(et)
        first_event.capacity = 20
        first_event.status = Status.PUBLISHED
        first_event.save()
        m = make_membership()
        payload = {
            "membership_id": m.pk,
            "role_id": leader.id,
            "partner_email": "partner@email.com",
            "partner_id": partner_user.id,
            "event_id": first_event.id,
        }

        response = student_client.post(LIST_URL, payload, format="json")
        assert response.status_code == http_status.HTTP_201_CREATED

        # The partner sees who booked them in
        partner_api = APIClient()
        partner_api.force_authenticate(user=partner_user)
        response = partner_api.get(EVENT_LIST_URL)
        assert response.status_code == http_status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["already_booked"] is True
        assert response.data[0]["booked_by"] == "Anna Rossi"

        # The booker themselves gets no booked_by
        response = student_client.get(EVENT_LIST_URL)
        assert response.status_code == http_status.HTTP_200_OK
        assert response.data[0]["already_booked"] is True
        assert response.data[0]["booked_by"] is None

class TestDoubleBokking:
    """
    Test user shouldn't be able to book same events twice
    """

    def test_create_contribution_with_partner_400(self, world_data,
                                                  student_client, student_user,
                                                  partner_user, partner_client, db):
        """
        Test if partner register again fails
        """
        from django.core import mail

        et = make_event_type()
        et.partners = 2
        leader = PartnerRole.objects.get(name='Leader')
        follower = PartnerRole.objects.get(name='Follower')
        et.partner_roles.add(leader)
        et.partner_roles.add(follower)
        et.save()
        first_event = make_event_with_type(et)
        first_event.capacity = 20
        first_event.save()
        m = make_membership()
        payload = {
            "membership_id": m.pk,
            "role_id": leader.id,
            "partner_email": "partner@email.com",
            "partner_id": partner_user.id,
            "event_id": first_event.id,
        }

        response = student_client.post(LIST_URL, payload, format="json")
        assert response.status_code == http_status.HTTP_201_CREATED
        assert "partner" in response.data
        assert "role" in response.data

        partner_contribution = Contribution.objects.filter(user=partner_user).first()
        original_contribution = Contribution.objects.get(id=response.data['id'])

        assert partner_contribution is not None
        payload = {
            "membership_id": m.pk,
            "role_id": follower.id,
            "partner_email": "partner@email.com",
            "event_id": first_event.id,
        }

        response = partner_client.post(LIST_URL, payload, format="json")
        assert response.status_code == http_status.HTTP_400_BAD_REQUEST

    def test_create_contribution_single_201(self, world_data, student_client, student_user, partner_user, db):
        """
        Test if couple under capacity status shall be accepted
        """
        from django.core import mail

        et = make_event_type()
        first_event = make_event_with_type(et)
        first_event.capacity = 20
        first_event.save()
        m = make_membership()
        payload = {
            "membership_id": m.pk,
            "event_id": first_event.id,
        }

        response = student_client.post(LIST_URL, payload, format="json")
        assert response.status_code == http_status.HTTP_201_CREATED

        original_contribution = Contribution.objects.get(id=response.data['id'])

        assert original_contribution.status == ContributionStatus.ACCEPTED

        payload = {
            "membership_id": m.pk,
            "event_id": first_event.id,
        }

        response = student_client.post(LIST_URL, payload, format="json")
        assert response.status_code == http_status.HTTP_400_BAD_REQUEST

