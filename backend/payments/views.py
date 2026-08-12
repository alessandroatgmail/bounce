from rest_framework import generics
from rest_framework.permissions import IsAdminUser, IsAuthenticated

from .models import Transaction
from .serializers import TransactionSerializer, UserTransactionSerializer


class TransactionListCreateView(generics.ListCreateAPIView):
    serializer_class = TransactionSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = Transaction.objects.select_related('user').prefetch_related('contributions').order_by('-date')
        user_id = self.request.query_params.get('user')
        if user_id:
            qs = qs.filter(user_id=user_id)
        return qs


class UserTransactionListView(generics.ListAPIView):
    serializer_class = UserTransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Transaction.objects.filter(user=self.request.user).prefetch_related(
            'contributions__events', 'contributions__membership',
        ).order_by('-date')
