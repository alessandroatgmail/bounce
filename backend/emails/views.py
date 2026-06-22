from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAdminUser
from rest_framework.pagination import PageNumberPagination
from post_office.models import Email, EmailTemplate, Log

from .serializers import EmailSerializer, EmailTemplateSerializer, LogSerializer


class StandardPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 100


class EmailTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = EmailTemplateSerializer
    permission_classes = [IsAdminUser]
    pagination_class = StandardPagination

    def get_queryset(self):
        return EmailTemplate.objects.all().order_by('name', 'language')


class EmailViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = EmailSerializer
    permission_classes = [IsAdminUser]
    pagination_class = StandardPagination

    def get_queryset(self):
        return (
            Email.objects
            .select_related('template')
            .prefetch_related('logs')
            .order_by('-created')
        )


class LogViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = LogSerializer
    permission_classes = [IsAdminUser]
    pagination_class = StandardPagination

    def get_queryset(self):
        qs = Log.objects.select_related('email').order_by('-date')
        email_id = self.request.query_params.get('email')
        if email_id:
            qs = qs.filter(email_id=email_id)
        return qs
