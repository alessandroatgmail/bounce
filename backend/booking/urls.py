from rest_framework.routers import SimpleRouter
from .views import ContributionViewSet, UserBookingViewSet, UserContributionViewSet

router = SimpleRouter()
router.register('contributions', ContributionViewSet, basename='contribution')
router.register('my-memberships', UserContributionViewSet, basename='user-contribution')
router.register('my-bookings', UserBookingViewSet, basename='user-booking')

urlpatterns = router.urls
