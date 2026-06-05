from rest_framework.routers import SimpleRouter
from .views import EventTypeViewSet, LocationViewSet, RoomViewSet, StyleViewSet, GenreViewSet, ArtistTypeViewSet, ArtistViewSet, LevelViewSet, EventViewSet, PartnerRoleViewSet

router = SimpleRouter()
router.register("partner-roles", PartnerRoleViewSet, basename="partner-role")
router.register("event-types", EventTypeViewSet, basename="event-type")
router.register("locations", LocationViewSet, basename="location")
router.register("rooms", RoomViewSet, basename="room")
router.register("styles", StyleViewSet, basename="style")
router.register("genres", GenreViewSet, basename="genre")
router.register("artist-types", ArtistTypeViewSet, basename="artist-type")
router.register("artists", ArtistViewSet, basename="artist")
router.register("levels", LevelViewSet, basename="level")
router.register("events", EventViewSet, basename="event")

urlpatterns = router.urls
