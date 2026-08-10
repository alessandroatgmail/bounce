from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAdminUser, IsAuthenticated

from .models import Document
from .serializers import AdminDocumentSerializer, DocumentSerializer


class DocumentViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Self-service: a user can upload and view only their own documents."""

    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Document.objects.filter(user=self.request.user).order_by("-date")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class AdminDocumentViewSet(viewsets.ModelViewSet):
    """Admin: full CRUD over every user's documents."""

    serializer_class = AdminDocumentSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = Document.objects.all().order_by("-date")
        user_id = self.request.query_params.get("user")
        if user_id:
            qs = qs.filter(user_id=user_id)
        return qs
