from rest_framework import serializers
from post_office.models import Email, EmailTemplate, Log


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
