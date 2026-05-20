from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('users.urls')),
    path('api/events/', include('event.urls')),
    path('api/membership/', include('membership.urls')),
    path('api/festival/', include('festival.urls')),
    path('api/booking/', include('booking.urls')),

    # generates the raw schema file (yaml/json)
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),

    # swagger UI — visual interactive documentation
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),

    # redoc UI — alternative documentation UI
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
