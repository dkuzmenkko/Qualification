# notifications/views.py
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Notification
from .serializers import NotificationSerializer


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_notifications(request):
    user = request.user
    notifications = Notification.objects.filter(user=user).order_by('-created_at')
    serializer = NotificationSerializer(notifications, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_as_read(request, notification_id):
    notification = Notification.objects.filter(id=notification_id, user=request.user).first()
    if notification:
        notification.is_read = True
        notification.save()
        return Response({"success": True})
    return Response({"error": "Повідомлення не знайдено"}, status=404)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_all_as_read(request):
    """Позначити всі сповіщення як прочитані"""
    Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
    return Response({"success": True, "message": "Всі сповіщення позначено як прочитані"})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_notification(request, notification_id):
    """Видалити сповіщення"""
    notification = Notification.objects.filter(id=notification_id, user=request.user).first()
    if notification:
        notification.delete()
        return Response({"success": True})
    return Response({"error": "Повідомлення не знайдено"}, status=404)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_all_notifications(request):
    """Видалити всі сповіщення"""
    Notification.objects.filter(user=request.user).delete()
    return Response({"success": True, "message": "Всі сповіщення видалено"})