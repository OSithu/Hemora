"""
URL configuration for hemora_backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
import os
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.http import FileResponse

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('accounts.urls')),
    path('api/', include('analysis.urls')),
    path('api-auth/', include('rest_framework.urls')),  # Login/logout for browsable API
]

# Serve media files
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Serve React frontend (production: built files in frontend_build/)
FRONTEND_DIR = os.path.join(settings.BASE_DIR, 'frontend_build')


def serve_react(request, path=''):
    """Serve React frontend files, fallback to index.html for SPA routing."""
    file_path = os.path.join(FRONTEND_DIR, path)
    if path and os.path.isfile(file_path):
        return FileResponse(open(file_path, 'rb'))
    index_path = os.path.join(FRONTEND_DIR, 'index.html')
    if os.path.isfile(index_path):
        return FileResponse(open(index_path, 'rb'), content_type='text/html')
    from django.views.generic import RedirectView
    return RedirectView.as_view(url='/api/', permanent=False)(request)


urlpatterns += [
    re_path(r'^(?!api/|admin/|api-auth/|media/|static/)(?P<path>.*)$', serve_react),
]
