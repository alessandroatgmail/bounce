from django.urls import path

from .views import CheckInView

urlpatterns = [
    path('check-in/', CheckInView.as_view(), name='scanner-check-in'),
]
