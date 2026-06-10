from .models import Notification
from django.conf import settings
from django.core.mail import send_mail 

def create_notification(user, message, type='GENERAL', send_email=False, send_push=False):

    Notification.objects.create(
        user=user, 
        message=message, 
        type=type
    )
    
    if send_push and user.receive_push_notifications:
        try:
            from webpush import send_user_notification
            payload = {
                "head": "Нове повідомлення",
                "body": message[:200],
                "icon": "/static/icons/notification.png",
                "badge": "/static/icons/badge.png",
                "url": "/notifications"
            }
            send_user_notification(user=user, payload=payload, ttl=1000)
        except Exception as e:
            print(f"Помилка при відправці push: {e}")
    
    if send_email and user.receive_email_notifications and user.email:
        try:
            send_mail(
                subject='Нове повідомлення від системи конференцій',
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=True,
            )
        except Exception as e:
            print(f"Помилка при відправці email: {e}")