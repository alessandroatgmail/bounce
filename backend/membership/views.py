from rest_framework import viewsets
from rest_framework.permissions import IsAdminUser, IsAuthenticated

from .models import Membership, MembershipRule, Discount, available_memberships
from .serializers import MembershipSerializer, MembershipRuleSerializer, DiscountSerializer


class MembershipViewSet(viewsets.ModelViewSet):
    queryset = Membership.objects.all()
    serializer_class = MembershipSerializer

    def get_queryset(self):
        qs = Membership.objects.all()
        if not self.request.user.is_staff:
            qs = available_memberships(qs)
        return qs

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return [IsAdminUser()]


class MembershipRuleViewSet(viewsets.ModelViewSet):
    serializer_class = MembershipRuleSerializer

    def get_queryset(self):
        qs = MembershipRule.objects.select_related("event_type", "membership")
        membership_id = self.request.query_params.get("membership")
        if membership_id:
            qs = qs.filter(membership_id=membership_id)
        return qs

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return [IsAdminUser()]


class DiscountViewSet(viewsets.ModelViewSet):
    serializer_class = DiscountSerializer
    queryset = Discount.objects.all()

    def get_permissions(self):
        return [IsAdminUser()]