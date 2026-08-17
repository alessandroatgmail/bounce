from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)

from django.http import HttpResponse
from django.urls import path


def healthz(request):
    """Liveness probe used by the Docker healthcheck.

    Intentionally does NOT touch the database: this endpoint answers
    "is the process able to serve requests", not "is every dependency
    up". Mixing the two makes the container restart in a loop whenever
    the database has a transient hiccup.
    """
    return HttpResponse("ok", content_type="text/plain")

urlpatterns = [
    # Mounted at d-admin/ so it can't collide with the frontend's /admin
    # SPA route (nginx proxies /d-admin/ here).
    path("healthz/", healthz),
    path('d-admin/', admin.site.urls),
    path('api/auth/', include('users.urls')),
    path('api/events/', include('event.urls')),
    path('api/membership/', include('membership.urls')),
    path('api/festival/', include('festival.urls')),
    path('api/booking/', include('booking.urls')),
    path('api/emails/', include('emails.urls')),
    path('api/documents/', include('document.urls')),
    path('api/payments/', include('payments.urls')),

    # generates the raw schema file (yaml/json)
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),

    # swagger UI — visual interactive documentation
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),

    # redoc UI — alternative documentation UI
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
