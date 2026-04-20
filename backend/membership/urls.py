from rest_framework.routers import SimpleRouter
from .views import MembershipViewSet

router = SimpleRouter()
router.register("memberships", MembershipViewSet, basename="membership")

urlpatterns = router.urls
