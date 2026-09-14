from django.urls import path
from .views import TransactionListCreateView, TransactionDetailView, UserTransactionListView

urlpatterns = [
    path('transactions/', TransactionListCreateView.as_view(), name='transaction-list-create'),
    path('transactions/<int:pk>/', TransactionDetailView.as_view(), name='transaction-detail'),
    path('my-transactions/', UserTransactionListView.as_view(), name='user-transaction-list'),
]
