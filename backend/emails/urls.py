from django.urls import path
from rest_framework.routers import SimpleRouter
from .views import EmailTemplateViewSet, EmailViewSet, LogViewSet, SendEmailView

router = SimpleRouter()
router.register('templates', EmailTemplateViewSet, basename='email-template')
router.register('emails', EmailViewSet, basename='email')
router.register('logs', LogViewSet, basename='email-log')

urlpatterns = router.urls + [
    path('send/', SendEmailView.as_view(), name='send-email'),
]
