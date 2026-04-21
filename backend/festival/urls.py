from rest_framework.routers import SimpleRouter
from .views import FestivalDayViewSet, FestivalRoomViewSet

router = SimpleRouter()
router.register('festival-days', FestivalDayViewSet, basename='festival-day')
router.register('festival-rooms', FestivalRoomViewSet, basename='festival-room')

urlpatterns = router.urls
