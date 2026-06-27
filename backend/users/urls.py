from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView

from .views import ActivateView, AdminActivateUserView, ChangePasswordView, CheckEmailView, CitySearchView, DeactivateView, LoginView, LogoutView, MeView, PasswordResetConfirmView, PasswordResetRequestView, QRCodeView, RegisterView, UserListView, ws_ticket

urlpatterns = [
    path("token/", LoginView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("token/verify/", TokenVerifyView.as_view(), name="token_verify"),
    path('ws-ticket/', ws_ticket, name='ws-ticket'),
    path("me/", MeView.as_view(), name="me"),
    path("me/password/", ChangePasswordView.as_view(), name="me-password"),
    path("me/deactivate/", DeactivateView.as_view(), name="me-deactivate"),
    path("me/qrcode/", QRCodeView.as_view(), name="me-qrcode"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("register/", RegisterView.as_view(), name="register"),
    path("password-reset/", PasswordResetRequestView.as_view(), name="password-reset"),
    path("password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
    path("activate/<uidb64>/<token>/", ActivateView.as_view(), name="activate"),
    path("cities/", CitySearchView.as_view(), name="city-search"),
    path("users/", UserListView.as_view(), name="user-list"),
    path("users/<int:user_id>/activate/", AdminActivateUserView.as_view(), name="admin-activate-user"),
    path("check-email/", CheckEmailView.as_view(), name="check-email"),
]
