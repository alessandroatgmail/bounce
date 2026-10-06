from django.urls import path

from .views import CheckInView, GetLogView, RegisterListView, UpdateAttendanceView

urlpatterns = [
    path('check-in/', CheckInView.as_view(), name='scanner-check-in'),
    path('register/<int:event_id>/', RegisterListView.as_view(), name='scanner-register-list'),
    path('bookings/<int:booking_id>/attendance/', UpdateAttendanceView.as_view(), name='scanner-update-attendance'),
    path('log/<int:event_id>/', GetLogView.as_view(), name='scanner-get-log'),
]
