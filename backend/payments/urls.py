from django.urls import path
from .views import TransactionListCreateView, UserTransactionListView

urlpatterns = [
    path('transactions/', TransactionListCreateView.as_view(), name='transaction-list-create'),
    path('my-transactions/', UserTransactionListView.as_view(), name='user-transaction-list'),
]
