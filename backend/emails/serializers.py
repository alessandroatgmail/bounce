from django.contrib.auth import get_user_model
from rest_framework import serializers
from post_office.models import Email, EmailTemplate, Log

from event.models import Event
from membership.models import Membership

User = get_user_model()


class SendEmailSerializer(serializers.Serializer):
    user_ids = serializers.ListField(
        child=serializers.IntegerField(), allow_empty=False,
    )
    template = serializers.CharField()
    event_id = serializers.IntegerField(required=False, allow_null=True)
    membership_id = serializers.IntegerField(required=False, allow_null=True)

    def validate_user_ids(self, value):
        existing = set(User.objects.filter(id__in=value).values_list('id', flat=True))
        missing = sorted(set(value) - existing)
        if missing:
            raise serializers.ValidationError(f"User(s) not found: {missing}")
        return value

    def validate_template(self, value):
        if not EmailTemplate.objects.filter(name=value).exists():
            raise serializers.ValidationError(f"Unknown email template: {value}")
        return value

    def validate_event_id(self, value):
        if value is not None and not Event.objects.filter(id=value).exists():
            raise serializers.ValidationError(f"Event not found: {value}")
        return value

    def validate_membership_id(self, value):
        if value is not None and not Membership.objects.filter(id=value).exists():
            raise serializers.ValidationError(f"Membership not found: {value}")
        return value


class EmailTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailTemplate
        fields = [
            'id', 'name', 'description', 'subject', 'content',
            'html_content', 'language', 'default_template',
            'created', 'last_updated',
        ]
        read_only_fields = ['id', 'created', 'last_updated']


class LogSerializer(serializers.ModelSerializer):
    email_to = serializers.SerializerMethodField()

    def get_email_to(self, obj):
        return obj.email.to if obj.email_id else None

    class Meta:
        model = Log
        fields = ['id', 'email', 'email_to', 'date', 'status', 'exception_type', 'message']
        read_only_fields = ['id', 'email', 'email_to', 'date', 'status', 'exception_type', 'message']


class EmailSerializer(serializers.ModelSerializer):
    logs = LogSerializer(many=True, read_only=True)
    template_name = serializers.SerializerMethodField()

    def get_template_name(self, obj):
        return obj.template.name if obj.template else None

    class Meta:
        model = Email
        fields = [
            'id', 'from_email', 'to', 'cc', 'bcc', 'subject',
            'message', 'html_message', 'status', 'priority',
            'created', 'last_updated', 'scheduled_time', 'expires_at',
            'message_id', 'number_of_retries', 'template', 'template_name',
            'context', 'backend_alias', 'logs',
        ]
        read_only_fields = fields
