from rest_framework.routers import SimpleRouter
from .views import EmailTemplateViewSet, EmailViewSet, LogViewSet

router = SimpleRouter()
router.register('templates', EmailTemplateViewSet, basename='email-template')
router.register('emails', EmailViewSet, basename='email')
router.register('logs', LogViewSet, basename='email-log')

urlpatterns = router.urls
