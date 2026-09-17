from rest_framework import generics
from rest_framework.permissions import IsAdminUser, IsAuthenticated

from .models import Transaction
from .paginations import TransactionPagination
from .serializers import TransactionSerializer, UserTransactionSerializer


class TransactionListCreateView(generics.ListCreateAPIView):
    serializer_class = TransactionSerializer
    permission_classes = [IsAdminUser]
    pagination_class = TransactionPagination

    def get_queryset(self):
        qs = Transaction.objects.select_related('user').prefetch_related('contributions').order_by('-date')
        params = self.request.query_params
        user_id = params.get('user')
        if user_id:
            qs = qs.filter(user_id=user_id)

        event_id = params.get('event')
        style_id = params.get('style')
        level_id = params.get('level')
        if event_id:
            qs = qs.filter(contributions__events__id=event_id)
        if style_id:
            qs = qs.filter(contributions__events__styles__id=style_id)
        if level_id:
            qs = qs.filter(contributions__events__level__id=level_id)
        if event_id or style_id or level_id:
            qs = qs.distinct()
        return qs


class TransactionDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = TransactionSerializer
    permission_classes = [IsAdminUser]
    queryset = Transaction.objects.select_related('user').prefetch_related('contributions')


class UserTransactionListView(generics.ListAPIView):
    serializer_class = UserTransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Transaction.objects.filter(user=self.request.user).prefetch_related(
            'contributions__events', 'contributions__membership',
        ).order_by('-date')
