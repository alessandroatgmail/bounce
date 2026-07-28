from rest_framework.routers import SimpleRouter
from .views import MembershipViewSet, MembershipRuleViewSet, DiscountViewSet

router = SimpleRouter()
router.register("memberships", MembershipViewSet, basename="membership")
router.register("rules", MembershipRuleViewSet, basename="membershiprule")
router.register("discounts", DiscountViewSet, basename="discount")

urlpatterns = router.urls
