from decimal import Decimal

import stripe
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status

from .models import Contribution, ContributionStatus
from .utils import mark_contributions_payed, send_payment_emails
from payments.models import Transaction, PaymentMethod


def _register_stripe_transaction(session, contributions):
    """Create the payment record for a completed Stripe checkout session.

    Guards against Stripe re-delivering the same webhook (get_or_create on
    stripe_session_id) and against amount_total not being a real number,
    which happens only in tests that don't set it on their mock session.
    """
    amount_total_cents = getattr(session, 'amount_total', None)
    if not isinstance(amount_total_cents, (int, float)):
        return

    User = get_user_model()
    payer = User.objects.filter(email=getattr(session, 'customer_email', None)).first()
    if payer is None and contributions:
        payer = contributions[0].user
    if payer is None:
        return

    transaction, created = Transaction.objects.get_or_create(
        stripe_session_id=session.id,
        defaults={
            'user': payer,
            'method': PaymentMethod.STRIPE,
            'stripe_payment_intent_id': getattr(session, 'payment_intent', '') or '',
            'amount_total': Decimal(amount_total_cents) / 100,
            'currency': getattr(session, 'currency', None) or 'eur',
        },
    )
    if created:
        transaction.contributions.set(contributions)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_checkout_session(request):
    ids = request.data.get('contribution_ids', [])
    if not ids:
        return Response({'error': 'No items selected'}, status=status.HTTP_400_BAD_REQUEST)

    # own + twin (original_contribution__user) + original (twin_contributions__user)
    contributions = Contribution.objects.filter(
        id__in=ids,
        status=ContributionStatus.ACCEPTED,
    ).filter(
        Q(user=request.user)
        | Q(original_contribution__user=request.user)
        | Q(twin_contributions__user=request.user)
    ).distinct().prefetch_related('events', 'discounts', 'membership')

    if not contributions.exists():
        return Response({'error': 'No valid contributions'}, status=status.HTTP_400_BAD_REQUEST)

    stripe.api_key = settings.STRIPE_SECRET_KEY

    line_items = []
    for c in contributions:
        first_event = c.events.first()
        event_name = first_event.name if first_event else 'Registration'
        membership_name = c.membership.name if c.membership else ''
        product_name = f'{event_name} — {membership_name}' if membership_name else event_name
        amount_cents = int(round(float(c.discounted_amount) * 100))
        line_items.append({
            'price_data': {
                'currency': 'eur',
                'unit_amount': amount_cents,
                'product_data': {'name': product_name},
            },
            'quantity': 1,
        })

    is_test = settings.STRIPE_SECRET_KEY.startswith(('sk_test_', 'rk_test_'))

    session = stripe.checkout.Session.create(
        mode='payment',
        line_items=line_items,
        success_url=settings.FRONTEND_URL + '/payment/success?session_id={CHECKOUT_SESSION_ID}',
        cancel_url=settings.FRONTEND_URL + '/?section=payments&tab=topay',
        metadata={'contribution_ids': ','.join(str(c.id) for c in contributions)},
        customer_email=request.user.email,
        **(
            {'custom_text': {'submit': {'message': (
                '🧪 Test mode — use card 4242 4242 4242 4242, '
                'any future expiry (e.g. 12/34), any 3-digit CVC.'
            )}}}
            if is_test else {}
        ),
    )

    return Response({'url': session.url})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def payment_success(request):
    session_id = request.query_params.get('session_id')
    if not session_id:
        return Response({'error': 'Missing session_id'}, status=status.HTTP_400_BAD_REQUEST)

    stripe.api_key = settings.STRIPE_SECRET_KEY
    session = stripe.checkout.Session.retrieve(session_id)

    if session.payment_status != 'paid':
        return Response({'paid': False})

    return Response({'paid': True, 'customer_email': session.customer_email})


@api_view(['POST'])
@permission_classes([AllowAny])
def stripe_webhook(request):
    payload = request.body
    sig = request.META.get('HTTP_STRIPE_SIGNATURE', '')

    try:
        event = stripe.Webhook.construct_event(
            payload, sig, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        return Response({'error': 'Invalid payload'}, status=400)
    except stripe.error.SignatureVerificationError:
        return Response({'error': 'Invalid signature'}, status=400)

    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        metadata = session.metadata
        raw_ids = metadata['contribution_ids'] if (metadata and 'contribution_ids' in metadata) else ''
        ids = [i for i in raw_ids.split(',') if i]
        if ids:
            contributions = list(Contribution.objects.filter(id__in=ids).select_related(
                'user', 'membership'
            ).prefetch_related('events'))
            mark_contributions_payed(contributions)
            send_payment_emails(contributions)
            _register_stripe_transaction(session, contributions)

    return Response({'status': 'ok'})
