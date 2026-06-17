import pytest
from datetime import timedelta
from unittest.mock import patch
from django.core import mail
from django.utils import timezone

from booking.models import Contribution, ContributionStatus
from booking.tasks import cancel_expired_contributions
from event.models import Event
from utils.mock_event import make_event_payload


def make_event(payment_days=7):
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
        payment_days=payment_days,
    )


def make_contribution(user, event, status=ContributionStatus.ACCEPTED, days_ago=0):
    c = Contribution.objects.create(
        user=user,
        amount="50.00",
        status=status,
        date=timezone.now() - timedelta(days=days_ago),
    )
    c.events.set([event])
    return c


class TestCancelExpiredContributions:

    def test_expired_contribution_is_cancelled(self, db, subject_user, world_data):
        event = make_event(payment_days=3)
        contribution = make_contribution(subject_user, event, days_ago=10)

        cancel_expired_contributions()

        contribution.refresh_from_db()
        assert contribution.status == ContributionStatus.CANCELLED

    def test_non_expired_contribution_not_cancelled(self, db, subject_user, world_data):
        event = make_event(payment_days=7)
        contribution = make_contribution(subject_user, event, days_ago=3)

        cancel_expired_contributions()

        contribution.refresh_from_db()
        assert contribution.status == ContributionStatus.ACCEPTED

    def test_today_is_deadline_not_cancelled(self, db, subject_user, world_data):
        # deadline == today means not yet past — still has today to pay
        event = make_event(payment_days=3)
        contribution = make_contribution(subject_user, event, days_ago=3)

        cancel_expired_contributions()

        contribution.refresh_from_db()
        assert contribution.status == ContributionStatus.ACCEPTED

    def test_non_accepted_status_not_affected(self, db, subject_user, world_data):
        event = make_event(payment_days=3)
        for status in [ContributionStatus.RECEIVED, ContributionStatus.CONFIRMED, ContributionStatus.PAYED]:
            c = make_contribution(subject_user, event, status=status, days_ago=10)
            cancel_expired_contributions()
            c.refresh_from_db()
            assert c.status == status

    def test_contribution_without_event_is_skipped(self, db, subject_user):
        c = Contribution.objects.create(
            user=subject_user,
            amount="50.00",
            status=ContributionStatus.ACCEPTED,
            date=timezone.now() - timedelta(days=30),
        )

        cancel_expired_contributions()

        c.refresh_from_db()
        assert c.status == ContributionStatus.ACCEPTED

    def test_expired_contribution_sends_email(self, db, subject_user, world_data):
        event = make_event(payment_days=3)
        make_contribution(subject_user, event, days_ago=10)

        cancel_expired_contributions()

        assert len(mail.outbox) == 1
        assert subject_user.email in mail.outbox[0].to

    def test_only_expired_contributions_are_cancelled(self, db, subject_user, world_data):
        event = make_event(payment_days=5)
        expired = make_contribution(subject_user, event, days_ago=10)
        not_expired = make_contribution(subject_user, event, days_ago=2)

        cancel_expired_contributions()

        expired.refresh_from_db()
        not_expired.refresh_from_db()
        assert expired.status == ContributionStatus.CANCELLED
        assert not_expired.status == ContributionStatus.ACCEPTED

    def test_multiple_expired_send_one_email_each(self, db, subject_user, world_data):
        event = make_event(payment_days=3)
        make_contribution(subject_user, event, days_ago=10)
        make_contribution(subject_user, event, days_ago=15)

        cancel_expired_contributions()

        assert len(mail.outbox) == 2


class TestExpiryReminderEmail:

    def test_reminder_sent_two_days_before_deadline(self, db, subject_user, world_data):
        # payment_days=5, date=3 days ago → deadline in 2 days
        event = make_event(payment_days=5)
        make_contribution(subject_user, event, days_ago=3)

        cancel_expired_contributions()

        assert len(mail.outbox) == 1
        assert subject_user.email in mail.outbox[0].to

    def test_reminder_not_sent_three_days_before_deadline(self, db, subject_user, world_data):
        # payment_days=5, date=2 days ago → deadline in 3 days
        event = make_event(payment_days=5)
        make_contribution(subject_user, event, days_ago=2)

        cancel_expired_contributions()

        assert len(mail.outbox) == 0

    def test_reminder_not_sent_one_day_before_deadline(self, db, subject_user, world_data):
        # payment_days=5, date=4 days ago → deadline tomorrow
        event = make_event(payment_days=5)
        make_contribution(subject_user, event, days_ago=4)

        cancel_expired_contributions()

        assert len(mail.outbox) == 0

    def test_reminder_not_sent_for_already_expired(self, db, subject_user, world_data):
        # expired contribution gets cancelled, not a reminder
        event = make_event(payment_days=3)
        contribution = make_contribution(subject_user, event, days_ago=10)

        cancel_expired_contributions()

        contribution.refresh_from_db()
        assert contribution.status == ContributionStatus.CANCELLED
        # email is the cancellation one, not reminder
        assert len(mail.outbox) == 1

    def test_reminder_not_sent_for_non_accepted_status(self, db, subject_user, world_data):
        # RECEIVED contribution 3 days before deadline → no reminder
        event = make_event(payment_days=5)
        make_contribution(subject_user, event, status=ContributionStatus.RECEIVED, days_ago=3)

        cancel_expired_contributions()

        assert len(mail.outbox) == 0

    def test_multiple_reminders_due_send_one_each(self, db, subject_user, world_data):
        event = make_event(payment_days=5)
        make_contribution(subject_user, event, days_ago=3)
        make_contribution(subject_user, event, days_ago=3)

        cancel_expired_contributions()

        assert len(mail.outbox) == 2
