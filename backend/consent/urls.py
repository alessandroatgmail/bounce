from rest_framework.routers import SimpleRouter

from .views import CommunicationViewSet, ConsentViewSet

router = SimpleRouter()
router.register('communications', CommunicationViewSet, basename='communication')
router.register('consents', ConsentViewSet, basename='consent')

urlpatterns = router.urls
