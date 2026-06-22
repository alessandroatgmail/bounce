from post_office.models import EmailTemplate, Email, Log
from rest_framework import serializers

class EmailTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailTemplate
        fields = '__all__'

class EmailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Email
        fields = '__all__'

class logSerializer(serializers.ModelSerializer):
    class Meta:
        model = Log
        fields = '__all__'
        
