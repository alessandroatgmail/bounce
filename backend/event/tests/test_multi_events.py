"""
Tests for multi_events flag behaviour on Event.

When multi_events=True:
  - PUT/PATCH that changes status cascades only status to children.
  - PUT does NOT cascade room, dates, duration, artists, etc. to children.

When multi_events=False:
  - Existing PUT cascade behaviour is unchanged (tested in test_cascade_update.py).

Also tests that `free` field is persisted.
"""
import pytest
from event.models import Event
from utils.mock_festival import make_festival_event
from utils.mock_event import make_event_payload
from utils.mock_room import make_room_payload

LIST_URL = '/api/events/events/'


def detail(pk):
    return f'{LIST_URL}{pk}/'


@pytest.fixture
def multi_parent_with_children(world_data, db):
    parent = make_festival_event()
    parent.multi_events = True
    parent.save()
    child1 = make_festival_event()
    child2 = make_festival_event()
    parent.events.set([child1, child2])
    return parent, child1, child2


# ── multi_events=True: status cascade ────────────────────────────────────────

@pytest.mark.django_db
def test_put_multi_events_cascades_status_to_children(multi_parent_with_children, staff_client, world_data):
    parent, child1, child2 = multi_parent_with_children
    assert parent.status == 'draft'

    payload = make_event_payload(
        event_type_id=parent.event_type.pk,
        room_id=parent.room.pk,
        status='published',
        multi_events=True,
        event_ids=[child1.pk, child2.pk],  # keep children linked
    )
    res = staff_client.put(detail(parent.pk), payload, format='json')
    assert res.status_code == 200

    for child in [child1, child2]:
        child.refresh_from_db()
        assert child.status == 'published', f'Expected published, got {child.status}'


@pytest.mark.django_db
def test_patch_multi_events_cascades_status_to_children(multi_parent_with_children, staff_client, world_data):
    parent, child1, child2 = multi_parent_with_children

    res = staff_client.patch(detail(parent.pk), {'status': 'confirmed'}, format='json')
    assert res.status_code == 200

    for child in [child1, child2]:
        child.refresh_from_db()
        assert child.status == 'confirmed'


@pytest.mark.django_db
def test_patch_no_status_change_does_not_touch_children(multi_parent_with_children, staff_client, world_data):
    parent, child1, child2 = multi_parent_with_children
    original_status = child1.status

    res = staff_client.patch(detail(parent.pk), {'capacity': 999}, format='json')
    assert res.status_code == 200

    child1.refresh_from_db()
    assert child1.status == original_status


# ── multi_events=True: does NOT cascade other fields ─────────────────────────

@pytest.mark.django_db
def test_put_multi_events_does_not_cascade_room(multi_parent_with_children, staff_client, world_data):
    from event.models import Room
    parent, child1, child2 = multi_parent_with_children
    original_room_id = child1.room_id

    new_room = Room.objects.create(**make_room_payload())
    payload = make_event_payload(
        event_type_id=parent.event_type.pk,
        room_id=new_room.pk,
        multi_events=True,
        event_ids=[child1.pk, child2.pk],  # keep children linked so cascade guard matters
    )
    res = staff_client.put(detail(parent.pk), payload, format='json')
    assert res.status_code == 200

    child1.refresh_from_db()
    assert child1.room_id == original_room_id, 'Room must not be overwritten on multi_events parent'


@pytest.mark.django_db
def test_put_multi_events_does_not_cascade_dates(multi_parent_with_children, staff_client, world_data):
    parent, child1, child2 = multi_parent_with_children
    # Refresh to ensure start_date is a proper datetime (not a raw string from object.create)
    child1.refresh_from_db()
    original_start = child1.start_date

    payload = make_event_payload(
        event_type_id=parent.event_type.pk,
        room_id=parent.room.pk,
        multi_events=True,
        event_ids=[child1.pk, child2.pk],  # keep children linked so cascade guard matters
    )
    res = staff_client.put(detail(parent.pk), payload, format='json')
    assert res.status_code == 200

    child1.refresh_from_db()
    assert child1.start_date == original_start, 'start_date must not be overwritten on multi_events parent'


# ── free field ────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_free_field_persisted(world_data, staff_client, db):
    payload = make_event_payload()
    payload['free'] = True
    res = staff_client.post(LIST_URL, payload, format='json')
    assert res.status_code == 201
    assert res.data['free'] is True

    event_id = res.data['id']
    res2 = staff_client.patch(detail(event_id), {'free': False}, format='json')
    assert res2.status_code == 200
    assert res2.data['free'] is False


@pytest.mark.django_db
def test_multi_events_field_persisted(world_data, staff_client, db):
    payload = make_event_payload()
    payload['multi_events'] = True
    res = staff_client.post(LIST_URL, payload, format='json')
    assert res.status_code == 201
    assert res.data['multi_events'] is True
