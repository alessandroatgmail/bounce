from rest_framework.routers import SimpleRouter
from .views import ContributionViewSet, UserContributionViewSet

router = SimpleRouter()
router.register('contributions', ContributionViewSet, basename='contribution')
router.register('my-memberships', UserContributionViewSet, basename='user-contribution')

urlpatterns = router.urls
