import pytest
from django.urls import reverse
from rest_framework import status

from users.models import Country, City

CITY_SEARCH_URL = reverse("city-search")


@pytest.fixture
def country(db):
    return Country.objects.create(name="Italy", iso="ITA")


class TestCitySearch:

    def test_exact_match_ranks_first(self, client, country):
        # Alphabetically, and by plain substring order, all of these would
        # normally crowd out the exact match "Roma" from the top of the list.
        City.objects.create(name="Aroma", country=country)
        City.objects.create(name="Cinemaroma", country=country)
        City.objects.create(name="Romano", country=country)
        City.objects.create(name="Roma", country=country)

        response = client.get(CITY_SEARCH_URL, {"q": "roma"})

        assert response.status_code == status.HTTP_200_OK
        names = [c["name"] for c in response.data]
        assert names[0] == "Roma"

    def test_prefix_match_ranks_before_plain_substring_match(self, client, country):
        City.objects.create(name="Aroma", country=country)
        City.objects.create(name="Romano", country=country)

        response = client.get(CITY_SEARCH_URL, {"q": "roma"})

        names = [c["name"] for c in response.data]
        assert names[0] == "Romano"
        assert names[1] == "Aroma"

    def test_short_query_returns_empty(self, client, country):
        City.objects.create(name="Roma", country=country)

        response = client.get(CITY_SEARCH_URL, {"q": "r"})

        assert response.data == []
