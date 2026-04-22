from rest_framework.routers import SimpleRouter
from .views import MembershipViewSet, MembershipRuleViewSet

router = SimpleRouter()
router.register("memberships", MembershipViewSet, basename="membership")
router.register("rules", MembershipRuleViewSet, basename="membershiprule")

urlpatterns = router.urls
