"""
AccommodationType — admin catalog of bookable room types (e.g. "Hotel Airone,
Triple, 13 rooms"). It's a side-table extension of a specific ExtraItem row:
the ExtraItem carries the billable price, AccommodationType carries the
location/capacity details. A plain ExtraItem (e.g. ACSI Membership) has no
AccommodationType attached.
"""
import pytest
from django.db import IntegrityError

from booking.models import AccommodationType, ExtraItem
from event.models import Location
from utils.mock_location import make_location_payload


@pytest.fixture
def extra_item(db):
    return ExtraItem.objects.create(
        name='Airone Triple', name_it='Airone Tripla', name_en='Airone Triple', value=120,
    )


@pytest.fixture
def location(world_data):
    return Location.objects.create(**make_location_payload(name='Hotel Airone'))


class TestAccommodationType:
    def test_create_linked_to_extra_item(self, extra_item, location):
        accommodation_type = AccommodationType.objects.create(
            extra_item=extra_item,
            location=location,
            occupants_per_room=3,
            available_rooms=13,
        )
        assert accommodation_type.extra_item_id == extra_item.id
        assert accommodation_type.location_id == location.id
        assert accommodation_type.occupants_per_room == 3
        assert accommodation_type.available_rooms == 13

    def test_reverse_accessor_from_extra_item(self, extra_item, location):
        accommodation_type = AccommodationType.objects.create(
            extra_item=extra_item,
            location=location,
            occupants_per_room=3,
            available_rooms=13,
        )
        assert extra_item.accommodation_type == accommodation_type

    def test_plain_extra_item_has_no_accommodation_type(self, extra_item):
        with pytest.raises(ExtraItem.accommodation_type.RelatedObjectDoesNotExist):
            extra_item.accommodation_type

    def test_extra_item_can_only_back_one_accommodation_type(self, extra_item, location):
        AccommodationType.objects.create(
            extra_item=extra_item,
            location=location,
            occupants_per_room=3,
            available_rooms=13,
        )
        with pytest.raises(IntegrityError):
            AccommodationType.objects.create(
                extra_item=extra_item,
                location=location,
                occupants_per_room=2,
                available_rooms=22,
            )
