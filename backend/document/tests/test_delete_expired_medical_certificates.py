import os
from datetime import timedelta

from dateutil.relativedelta import relativedelta
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from document.models import Document, DocumentType
from document.tasks import delete_expired_medical_certificates

# A medical certificate is valid for one year from its emission date, then
# kept for a further 90-day grace period before being purged.
GRACE_PERIOD_DAYS = 90


def make_document(user, document_type=DocumentType.OTHER, emission_date=None, name="doc.pdf"):
    return Document.objects.create(
        user=user,
        file=SimpleUploadedFile(name, b"%PDF-1.4 fake content", content_type="application/pdf"),
        document_type=document_type,
        emission_date=emission_date,
    )


def make_medical_certificate(user, emission_date, name="certificate.pdf"):
    return make_document(user, document_type=DocumentType.MEDICAL_CERTIFICATE, emission_date=emission_date, name=name)


class TestDeleteExpiredMedicalCertificates:

    def test_certificate_exactly_at_the_end_of_the_grace_period_is_deleted(self, student_user, db):
        today = timezone.now().date()
        emission_date = today - relativedelta(years=1) - timedelta(days=GRACE_PERIOD_DAYS)
        doc = make_medical_certificate(student_user, emission_date)

        delete_expired_medical_certificates()

        assert not Document.objects.filter(pk=doc.pk).exists()

    def test_certificate_one_day_before_the_grace_period_ends_is_not_deleted(self, student_user, db):
        today = timezone.now().date()
        emission_date = today - relativedelta(years=1) - timedelta(days=GRACE_PERIOD_DAYS - 1)
        doc = make_medical_certificate(student_user, emission_date)

        delete_expired_medical_certificates()

        assert Document.objects.filter(pk=doc.pk).exists()

    def test_certificate_still_within_its_one_year_validity_is_not_deleted(self, student_user, db):
        emission_date = timezone.now().date() - timedelta(days=100)
        doc = make_medical_certificate(student_user, emission_date)

        delete_expired_medical_certificates()

        assert Document.objects.filter(pk=doc.pk).exists()

    def test_non_medical_document_is_never_deleted_regardless_of_age(self, student_user, db):
        very_old = timezone.now().date() - relativedelta(years=5)
        doc = make_document(student_user, document_type=DocumentType.OTHER, emission_date=very_old)

        delete_expired_medical_certificates()

        assert Document.objects.filter(pk=doc.pk).exists()

    def test_medical_certificate_without_emission_date_is_not_deleted(self, student_user, db):
        """Shouldn't happen via the API (emission_date is required for this
        type), but a stray row with none must not crash the task or be
        treated as infinitely expired."""
        doc = make_document(student_user, document_type=DocumentType.MEDICAL_CERTIFICATE, emission_date=None)

        delete_expired_medical_certificates()

        assert Document.objects.filter(pk=doc.pk).exists()

    def test_deleting_an_expired_certificate_also_removes_its_file_from_storage(self, student_user, db):
        today = timezone.now().date()
        emission_date = today - relativedelta(years=1) - timedelta(days=GRACE_PERIOD_DAYS)
        doc = make_medical_certificate(student_user, emission_date)
        file_path = doc.file.path
        assert os.path.exists(file_path)

        delete_expired_medical_certificates()

        assert not os.path.exists(file_path)

    def test_multiple_expired_certificates_are_all_deleted(self, student_user, other_user, db):
        today = timezone.now().date()
        emission_date = today - relativedelta(years=1) - timedelta(days=GRACE_PERIOD_DAYS)
        doc1 = make_medical_certificate(student_user, emission_date, name="cert1.pdf")
        doc2 = make_medical_certificate(other_user, emission_date, name="cert2.pdf")

        delete_expired_medical_certificates()

        assert Document.objects.count() == 0
        assert not Document.objects.filter(pk__in=[doc1.pk, doc2.pk]).exists()
