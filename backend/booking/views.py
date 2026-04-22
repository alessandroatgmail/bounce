from rest_framework import viewsets
from rest_framework.permissions import IsAdminUser

from .models import Contribution
from .serializers import ContributionSerializer


class ContributionViewSet(viewsets.ModelViewSet):
    serializer_class = ContributionSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = Contribution.objects.select_related('user', 'membership').prefetch_related('events')
        user_id = self.request.query_params.get('user')
        if user_id:
            qs = qs.filter(user_id=user_id)
        return qs
