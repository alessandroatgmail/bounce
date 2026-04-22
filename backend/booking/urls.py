from rest_framework.routers import SimpleRouter
from .views import ContributionViewSet

router = SimpleRouter()
router.register('contributions', ContributionViewSet, basename='contribution')

urlpatterns = router.urls
