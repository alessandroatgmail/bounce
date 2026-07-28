from django.urls import path
from rest_framework.routers import SimpleRouter
from .views import BookingViewSet, ContributionOverviewViewSet, ContributionViewSet, UserBookingViewSet, UserContributionViewSet
from .views_checkout import create_checkout_session, stripe_webhook, payment_success

router = SimpleRouter()
router.register('bookings', BookingViewSet, basename='booking')
router.register('contributions-overview', ContributionOverviewViewSet, basename='contribution-overview')
router.register('contributions', ContributionViewSet, basename='contribution')
router.register('my-memberships', UserContributionViewSet, basename='user-contribution')
router.register('my-bookings', UserBookingViewSet, basename='user-booking')

urlpatterns = router.urls + [
    path('checkout-session/', create_checkout_session, name='checkout-session'),
    path('stripe-webhook/', stripe_webhook, name='stripe-webhook'),
    path('payment/success/', payment_success, name='payment-success'),
]
