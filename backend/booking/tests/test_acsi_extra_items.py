"""
GET /api/booking/extra-items/acsi/ — admin-only list of contributions that
carry the ACSI Membership extra item, for staff to see who needs their card
checked/renewed before an upcoming event.
"""
from datetime import timedelta, date

import pytest
from django.utils import timezone

from booking.models import Contribution, ContributionStatus, ExtraItem
from event.models import Event
from users.models import User
from utils.mock_event import make_event_payload

ACSI_URL = '/api/booking/extra-items/acsi/'


def make_event(start_date, **overrides):
    payload = make_event_payload(**overrides)
    for key in ('style_ids', 'genre_ids', 'artist_ids', 'event_ids'):
        payload.pop(key)
    end = start_date + timedelta(hours=1)
    payload['start_date'] = start_date
    payload['end_date'] = end
    return Event.objects.create(**payload)


def make_student(email, **overrides):
    local = email.split('@')[0]
    return User.objects.create_user(
        email=email, password='StrongPass123!',
        first_name=local.capitalize(), last_name='Test', is_active=True,
        **overrides,
    )


def make_acsi_contribution(user, event, acsi_item, status=ContributionStatus.CONFIRMED):
    contribution = Contribution.objects.create(user=user, amount=0, status=status)
    contribution.events.add(event)
    contribution.extra_items.add(acsi_item)
    return contribution


@pytest.fixture
def acsi_item(db):
    return ExtraItem.objects.create(
        name='ACSI Membership', name_it='Tessera ACSI', name_en='ACSI Membership', value=15,
    )


class TestAcsiExtraItems:
    def test_student_forbidden(self, student_client):
        res = student_client.get(ACSI_URL)
        assert res.status_code == 403

    def test_lists_contribution_with_acsi_item(self, admin_client, world_data, acsi_item):
        user = make_student('acsi1@bounce.com', acsi_expiration_date=date(2027, 1, 1))
        event = make_event(timezone.now() + timedelta(days=10))
        make_acsi_contribution(user, event, acsi_item)

        res = admin_client.get(ACSI_URL)
        assert res.status_code == 200
        entry = res.data['results'][0]
        assert entry['user']['id'] == user.id
        assert entry['user']['first_name'] == user.first_name
        assert entry['user']['last_name'] == user.last_name
        assert entry['user']['acsi_expiration_date'] == '2027-01-01'
        assert entry['event_start_date'][:10] == event.start_date.date().isoformat()
        assert entry['event_name'] == event.name

    def test_excludes_contribution_without_acsi_item(self, admin_client, world_data):
        user = make_student('noacsi@bounce.com')
        event = make_event(timezone.now() + timedelta(days=10))
        Contribution.objects.create(user=user, amount=0, status=ContributionStatus.CONFIRMED).events.add(event)

        res = admin_client.get(ACSI_URL)
        assert res.status_code == 200
        assert res.data['count'] == 0

    def test_excludes_cancelled_contribution(self, admin_client, world_data, acsi_item):
        user = make_student('cancelled@bounce.com')
        event = make_event(timezone.now() + timedelta(days=10))
        make_acsi_contribution(user, event, acsi_item, status=ContributionStatus.CANCELLED)

        res = admin_client.get(ACSI_URL)
        assert res.status_code == 200
        assert res.data['count'] == 0

    def test_uses_earliest_event_date_when_multiple_events(self, admin_client, world_data, acsi_item):
        user = make_student('multi@bounce.com')
        later = make_event(timezone.now() + timedelta(days=30))
        sooner = make_event(timezone.now() + timedelta(days=5))
        contribution = make_acsi_contribution(user, later, acsi_item)
        contribution.events.add(sooner)

        res = admin_client.get(ACSI_URL)
        assert res.status_code == 200
        entry = res.data['results'][0]
        assert entry['event_start_date'][:10] == sooner.start_date.date().isoformat()
        assert entry['event_name'] == sooner.name

    def test_ordered_by_soonest_event_first(self, admin_client, world_data, acsi_item):
        user_a = make_student('later@bounce.com')
        user_b = make_student('sooner@bounce.com')
        later_event = make_event(timezone.now() + timedelta(days=30))
        sooner_event = make_event(timezone.now() + timedelta(days=3))
        make_acsi_contribution(user_a, later_event, acsi_item)
        make_acsi_contribution(user_b, sooner_event, acsi_item)

        res = admin_client.get(ACSI_URL)
        assert res.status_code == 200
        first_names = [e['user']['first_name'] for e in res.data['results']]
        assert first_names[0] == user_b.first_name
        assert first_names[1] == user_a.first_name

    def test_filters_by_user_id(self, admin_client, world_data, acsi_item):
        user_a = make_student('a@bounce.com')
        user_b = make_student('b@bounce.com')
        event = make_event(timezone.now() + timedelta(days=10))
        make_acsi_contribution(user_a, event, acsi_item)
        make_acsi_contribution(user_b, event, acsi_item)

        res = admin_client.get(ACSI_URL, {'user': user_a.id})
        assert res.status_code == 200
        assert res.data['count'] == 1
        assert res.data['results'][0]['user']['id'] == user_a.id
