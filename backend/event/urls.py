from rest_framework.routers import DefaultRouter
from .views import EventTypeViewSet, LocationViewSet, RoomViewSet, StyleViewSet, GenreViewSet, ArtistTypeViewSet, ArtistViewSet, EventViewSet

router = DefaultRouter()
router.register("event-types", EventTypeViewSet, basename="event-type")
router.register("locations", LocationViewSet, basename="location")
router.register("rooms", RoomViewSet, basename="room")
router.register("styles", StyleViewSet, basename="style")
router.register("genres", GenreViewSet, basename="genre")
router.register("artist-types", ArtistTypeViewSet, basename="artist-type")
router.register("artists", ArtistViewSet, basename="artist")
router.register("events", EventViewSet, basename="event")

urlpatterns = router.urls
