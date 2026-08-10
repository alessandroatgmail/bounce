from rest_framework.routers import SimpleRouter

from .views import AdminDocumentViewSet, DocumentViewSet

router = SimpleRouter()
router.register("documents", DocumentViewSet, basename="document")
router.register("admin/documents", AdminDocumentViewSet, basename="admin-document")

urlpatterns = router.urls
