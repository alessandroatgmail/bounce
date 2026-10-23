from django.urls import path
from rest_framework.routers import SimpleRouter
from .views import BookingViewSet, ContributionAdminIdsView, ContributionAdminListView, ContributionOverviewViewSet, ContributionViewSet, ExtraItemViewSet, UserBookingViewSet, UserContributionViewSet
from .views_checkout import create_checkout_session, stripe_webhook, payment_success

router = SimpleRouter()
router.register('bookings', BookingViewSet, basename='booking')
router.register('contributions-overview', ContributionOverviewViewSet, basename='contribution-overview')
router.register('contributions', ContributionViewSet, basename='contribution')
router.register('extra-items', ExtraItemViewSet, basename='extra-item')
router.register('my-memberships', UserContributionViewSet, basename='user-contribution')
router.register('my-bookings', UserBookingViewSet, basename='user-booking')

urlpatterns = router.urls + [
    path('checkout-session/', create_checkout_session, name='checkout-session'),
    path('stripe-webhook/', stripe_webhook, name='stripe-webhook'),
    path('payment/success/', payment_success, name='payment-success'),
    path('contributions-admin/', ContributionAdminListView.as_view(), name='contribution-admin-list'),
    path('contributions-admin/ids/', ContributionAdminIdsView.as_view(), name='contribution-admin-ids'),
]
