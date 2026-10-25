"""
GET /api/events/events/?parent_id=<festival_id> returns only that festival's
children, instead of the admin festival grid having to fetch every event in
the system and filter client-side.
"""
import pytest
from utils.mock_festival import make_festival_event

LIST_URL = '/api/events/events/'


@pytest.fixture
def multi_parent_with_children(world_data, db):
    parent = make_festival_event()
    parent.multi_events = True
    parent.save()
    child1 = make_festival_event()
    child2 = make_festival_event()
    parent.events.set([child1, child2])
    return parent, child1, child2


@pytest.mark.django_db
def test_parent_id_returns_only_children(multi_parent_with_children, staff_client, world_data):
    parent, child1, child2 = multi_parent_with_children
    other_unrelated_event = make_festival_event()

    res = staff_client.get(LIST_URL, {'parent_id': parent.pk})
    assert res.status_code == 200

    returned_ids = {e['id'] for e in res.json()['results']}
    assert returned_ids == {child1.pk, child2.pk}
    assert parent.pk not in returned_ids
    assert other_unrelated_event.pk not in returned_ids


@pytest.mark.django_db
def test_parent_id_empty_for_event_with_no_children(world_data, staff_client):
    lonely_event = make_festival_event()

    res = staff_client.get(LIST_URL, {'parent_id': lonely_event.pk})
    assert res.status_code == 200
    assert res.json()['results'] == []
