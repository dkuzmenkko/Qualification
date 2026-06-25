
from rest_framework.exceptions import PermissionDenied
from django.utils import timezone


def check_submission_permission(user, conference):
    """
    Перевіряє, чи може користувач подати тезу на конференцію
    
    Правила:
    - Автори (role='AUTHOR') завжди можуть подавати тези
    - Рецензенти можуть подавати тези, але НЕ на конференції, де вони є рецензентами
    - Організатор конференції НЕ може подавати тези на свою конференцію
    - Дедлайн подачі не повинен минути
    """
    if conference.submission_deadline < timezone.now().date():
        raise PermissionDenied("Дедлайн подачі тез вже минув")
    if conference.organizer == user:
        raise PermissionDenied("Організатор конференції не може подавати тези")
    if user in conference.reviewers.all():
        raise PermissionDenied("Ви є рецензентом цієї конференції і не можете подавати тези")
    if user.role == 'ADMIN':
        return True
    if user.role in ['AUTHOR', 'REVIEWER']:
        return True
    raise PermissionDenied(f"Користувач з роллю {user.role} не може подавати тези")