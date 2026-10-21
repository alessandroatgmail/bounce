from datetime import timedelta

from celery import shared_task
from celery.utils.log import get_task_logger
from dateutil.relativedelta import relativedelta
from django.utils import timezone

from .models import Document, DocumentType

logger = get_task_logger(__name__)

# A medical certificate is valid for one year from its emission date, then
# kept for a further 90-day grace period before being purged.
VALIDITY_PERIOD = relativedelta(years=1)
GRACE_PERIOD_DAYS = 90


@shared_task
def delete_expired_medical_certificates() -> None:
    today = timezone.now().date()
    candidates = Document.objects.filter(
        document_type=DocumentType.MEDICAL_CERTIFICATE, emission_date__isnull=False,
    )
    deleted = 0
    for document in candidates:
        delete_after = document.emission_date + VALIDITY_PERIOD + timedelta(days=GRACE_PERIOD_DAYS)
        if delete_after <= today:
            document.file.delete(save=False)
            document.delete()
            deleted += 1
    logger.info(f"Deleted {deleted} expired medical certificates, today={today}")
