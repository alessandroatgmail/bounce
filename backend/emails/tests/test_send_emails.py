from datetime import timedelta

import pytest
from django.core import mail
from django.utils import timezone
from post_office.models import EmailTemplate

from booking.models import Contribution
from event.models import Event
from membership.models import Membership
from users.models import User
from utils.mock_event import make_event_payload

SEND_URL = '/api/emails/send/'


def _body(sent):
    return sent.body or sent.alternatives[0][0]


@pytest.fixture
def template(db):
    # post_office's mail.send(language=...) looks up the template for that
    # exact language; new users default to language='it' (users/models.py).
    # Markers let tests tell "key present but empty" (rendered '') apart
    # from "key holds this specific id".
    return EmailTemplate.objects.create(
        name='newsletter',
        language='it',
        subject='Hello {{ user.first_name }}',
        html_content='<p>C:{{ contribution.id }}|E:{{ event.id }}|M:{{ membership.id }}</p>',
    )


@pytest.fixture
def user_a(db):
    return User.objects.create_user(
        email='a@bounce.com', password='StrongPass123!', first_name='Anna', is_active=True,
    )


@pytest.fixture
def user_b(db):
    return User.objects.create_user(
        email='b@bounce.com', password='StrongPass123!', first_name='Bea', is_active=True,
    )


@pytest.fixture
def membership(db):
    return Membership.objects.create(name='Gold Pack')


@pytest.fixture
def other_membership(db):
    return Membership.objects.create(name='Silver Pack')


@pytest.fixture
def event(world_data):
    payload = make_event_payload()
    start = timezone.now() + timedelta(days=5)
    return Event.objects.create(
        name=payload['name'],
        status=payload['status'],
        event_type_id=payload['event_type_id'],
        type=payload['type'],
        level_id=payload['level_id'],
        room_id=payload['room_id'],
        start_date=start,
        end_date=start + timedelta(minutes=90),
        duration=90,
        capacity=payload['capacity'],
    )


@pytest.fixture
def other_event(world_data):
    payload = make_event_payload()
    start = timezone.now() + timedelta(days=6)
    return Event.objects.create(
        name=payload['name'],
        status=payload['status'],
        event_type_id=payload['event_type_id'],
        type=payload['type'],
        level_id=payload['level_id'],
        room_id=payload['room_id'],
        start_date=start,
        end_date=start + timedelta(minutes=90),
        duration=90,
        capacity=payload['capacity'],
    )


# ---------------------------------------------------------------------------
# Auth / permissions
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestSendEmailPermissions:
    def test_unauthenticated_forbidden(self, template, user_a):
        from rest_framework.test import APIClient
        res = APIClient().post(
            SEND_URL, {'user_ids': [user_a.id], 'template': template.name}, format='json',
        )
        assert res.status_code == 401
        assert len(mail.outbox) == 0

    def test_student_forbidden(self, student_client, template, user_a):
        res = student_client.post(
            SEND_URL, {'user_ids': [user_a.id], 'template': template.name}, format='json',
        )
        assert res.status_code == 403
        assert len(mail.outbox) == 0


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestSendEmailValidation:
    def test_missing_user_ids(self, admin_client, template):
        res = admin_client.post(SEND_URL, {'template': template.name}, format='json')
        assert res.status_code == 400
        assert 'user_ids' in res.data

    def test_empty_user_ids(self, admin_client, template):
        res = admin_client.post(
            SEND_URL, {'user_ids': [], 'template': template.name}, format='json',
        )
        assert res.status_code == 400
        assert 'user_ids' in res.data

    def test_unknown_user_id(self, admin_client, template):
        res = admin_client.post(
            SEND_URL, {'user_ids': [999999], 'template': template.name}, format='json',
        )
        assert res.status_code == 400
        assert 'user_ids' in res.data

    def test_missing_template(self, admin_client, user_a):
        res = admin_client.post(SEND_URL, {'user_ids': [user_a.id]}, format='json')
        assert res.status_code == 400
        assert 'template' in res.data

    def test_unknown_template(self, admin_client, user_a):
        res = admin_client.post(
            SEND_URL, {'user_ids': [user_a.id], 'template': 'does_not_exist'}, format='json',
        )
        assert res.status_code == 400
        assert 'template' in res.data
        assert len(mail.outbox) == 0

    def test_unknown_event_id(self, admin_client, template, user_a):
        res = admin_client.post(
            SEND_URL,
            {'user_ids': [user_a.id], 'template': template.name, 'event_id': 999999},
            format='json',
        )
        assert res.status_code == 400
        assert 'event_id' in res.data

    def test_unknown_membership_id(self, admin_client, template, user_a):
        res = admin_client.post(
            SEND_URL,
            {'user_ids': [user_a.id], 'template': template.name, 'membership_id': 999999},
            format='json',
        )
        assert res.status_code == 400
        assert 'membership_id' in res.data


# ---------------------------------------------------------------------------
# No event_id: one email per user
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestSendEmailPerUser:
    def test_no_event_no_membership_one_email_per_user(self, admin_client, template, user_a, user_b):
        res = admin_client.post(
            SEND_URL,
            {'user_ids': [user_a.id, user_b.id], 'template': template.name},
            format='json',
        )
        assert res.status_code == 202
        assert len(mail.outbox) == 2
        recipients = {tuple(m.to) for m in mail.outbox}
        assert recipients == {(user_a.email,), (user_b.email,)}

    def test_no_event_context_has_no_contribution(self, admin_client, template, user_a):
        admin_client.post(
            SEND_URL, {'user_ids': [user_a.id], 'template': template.name}, format='json',
        )
        assert 'C:|' in _body(mail.outbox[0])

    def test_no_event_extra_contributions_do_not_multiply_send(self, admin_client, template, user_a):
        Contribution.objects.create(amount='10.00', user=user_a)
        Contribution.objects.create(amount='20.00', user=user_a)
        admin_client.post(
            SEND_URL, {'user_ids': [user_a.id], 'template': template.name}, format='json',
        )
        assert len(mail.outbox) == 1

    def test_membership_only_adds_membership_to_context(self, admin_client, template, user_a, membership):
        admin_client.post(
            SEND_URL,
            {'user_ids': [user_a.id], 'template': template.name, 'membership_id': membership.id},
            format='json',
        )
        assert len(mail.outbox) == 1
        assert f'M:{membership.id}' in _body(mail.outbox[0])
        assert 'C:|' in _body(mail.outbox[0])


# ---------------------------------------------------------------------------
# event_id given: one email per matching Contribution
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestSendEmailPerContribution:
    def test_event_with_no_matching_contribution_sends_nothing(self, admin_client, template, user_a, event):
        res = admin_client.post(
            SEND_URL,
            {'user_ids': [user_a.id], 'template': template.name, 'event_id': event.id},
            format='json',
        )
        assert res.status_code == 202
        assert len(mail.outbox) == 0

    def test_event_with_one_matching_contribution(self, admin_client, template, user_a, event):
        contribution = Contribution.objects.create(amount='30.00', user=user_a)
        contribution.events.add(event)

        admin_client.post(
            SEND_URL,
            {'user_ids': [user_a.id], 'template': template.name, 'event_id': event.id},
            format='json',
        )
        assert len(mail.outbox) == 1
        body = _body(mail.outbox[0])
        assert f'C:{contribution.id}' in body
        assert f'E:{event.id}' in body

    def test_event_ignores_contribution_for_a_different_event(self, admin_client, template, user_a, event, other_event):
        contribution = Contribution.objects.create(amount='30.00', user=user_a)
        contribution.events.add(other_event)

        admin_client.post(
            SEND_URL,
            {'user_ids': [user_a.id], 'template': template.name, 'event_id': event.id},
            format='json',
        )
        assert len(mail.outbox) == 0

    def test_event_with_two_contributions_sends_two_emails(self, admin_client, template, user_a, event):
        c1 = Contribution.objects.create(amount='10.00', user=user_a)
        c1.events.add(event)
        c2 = Contribution.objects.create(amount='20.00', user=user_a)
        c2.events.add(event)

        admin_client.post(
            SEND_URL,
            {'user_ids': [user_a.id], 'template': template.name, 'event_id': event.id},
            format='json',
        )
        assert len(mail.outbox) == 2
        bodies = {_body(m) for m in mail.outbox}
        assert f'C:{c1.id}' in ''.join(bodies)
        assert f'C:{c2.id}' in ''.join(bodies)

    def test_event_across_multiple_users(self, admin_client, template, user_a, user_b, event):
        ca = Contribution.objects.create(amount='10.00', user=user_a)
        ca.events.add(event)
        cb = Contribution.objects.create(amount='20.00', user=user_b)
        cb.events.add(event)

        admin_client.post(
            SEND_URL,
            {'user_ids': [user_a.id, user_b.id], 'template': template.name, 'event_id': event.id},
            format='json',
        )
        assert len(mail.outbox) == 2
        recipients = {tuple(m.to) for m in mail.outbox}
        assert recipients == {(user_a.email,), (user_b.email,)}

    def test_contribution_membership_included_when_present(self, admin_client, template, user_a, event, membership):
        contribution = Contribution.objects.create(amount='30.00', user=user_a, membership=membership)
        contribution.events.add(event)

        admin_client.post(
            SEND_URL,
            {'user_ids': [user_a.id], 'template': template.name, 'event_id': event.id},
            format='json',
        )
        assert len(mail.outbox) == 1
        assert f'M:{membership.id}' in _body(mail.outbox[0])

    def test_event_and_membership_together_narrows_to_matching_contribution(
        self, admin_client, template, user_a, event, membership, other_membership,
    ):
        matching = Contribution.objects.create(amount='10.00', user=user_a, membership=membership)
        matching.events.add(event)
        other = Contribution.objects.create(amount='20.00', user=user_a, membership=other_membership)
        other.events.add(event)

        admin_client.post(
            SEND_URL,
            {
                'user_ids': [user_a.id], 'template': template.name,
                'event_id': event.id, 'membership_id': membership.id,
            },
            format='json',
        )
        assert len(mail.outbox) == 1
        body = _body(mail.outbox[0])
        assert f'C:{matching.id}' in body
        assert f'C:{other.id}' not in body
