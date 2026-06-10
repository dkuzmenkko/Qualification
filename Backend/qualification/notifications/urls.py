from django.urls import path
from .views import (
    my_notifications, 
    mark_as_read, 
    mark_all_as_read,
    delete_notification,
    delete_all_notifications
)

urlpatterns = [
    path('', my_notifications),
    path('<int:notification_id>/read/', mark_as_read),
    path('read-all/', mark_all_as_read),
    path('<int:notification_id>/delete/', delete_notification),
    path('delete-all/', delete_all_notifications),
]