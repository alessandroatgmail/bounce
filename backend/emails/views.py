from rest_framework import mixins, status, viewsets
from rest_framework.permissions import IsAdminUser
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView
from post_office.models import Email, EmailTemplate, Log

from booking.tasks import send_bulk_emails
from .serializers import EmailSerializer, EmailTemplateSerializer, LogSerializer, SendEmailSerializer


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
        qs = (
            Email.objects
            .select_related('template')
            .prefetch_related('logs')
            .order_by('-created')
        )
        to = self.request.query_params.get('to')
        if to:
            qs = qs.filter(to__icontains=to)
        template_name = self.request.query_params.get('template')
        if template_name:
            qs = qs.filter(template__name=template_name)
        return qs


class SendEmailView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request):
        serializer = SendEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        send_bulk_emails.delay(
            data['user_ids'],
            data['template'],
            data.get('event_id'),
            data.get('membership_id'),
        )
        return Response(status=status.HTTP_202_ACCEPTED)


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
