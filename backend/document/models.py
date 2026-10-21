from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone


class DocumentType(models.TextChoices):
    OTHER = "other", "Other"
    MEDICAL_CERTIFICATE = "medical_certificate", "Medical Certificate"


class Document(models.Model):
    file = models.FileField(upload_to='documents/%Y/%m/%d')
    user = models.ForeignKey(get_user_model(), on_delete=models.PROTECT)
    date = models.DateTimeField(default=timezone.now)
    document_type = models.CharField(max_length=30, choices=DocumentType.choices, default=DocumentType.OTHER)
    # When the document itself was issued (e.g. the date on a medical
    # certificate) — distinct from `date`, which is the upload timestamp.
    emission_date = models.DateField(null=True, blank=True)
