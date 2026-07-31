from django.urls import path
from rest_framework.routers import SimpleRouter
from .views import EventTypeViewSet, LocationViewSet, RoomViewSet, StyleViewSet, GenreViewSet, ArtistTypeViewSet, ArtistViewSet, LevelViewSet, EventViewSet, EventAdminListView, PartnerRoleViewSet, EventRegisterView, EventDescriptionViewSet

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
router.register("event-descriptions", EventDescriptionViewSet, basename="event-description")

urlpatterns = [
    path("register/<int:event_id>/", EventRegisterView.as_view(), name="event-register"),
    path("admin/", EventAdminListView.as_view(), name="event-admin-list"),
] + router.urls
