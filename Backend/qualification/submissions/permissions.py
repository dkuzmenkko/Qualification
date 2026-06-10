# submissions/permissions.py

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
    
    # Перевірка дедлайну
    if conference.submission_deadline < timezone.now().date():
        raise PermissionDenied("Дедлайн подачі тез вже минув")
    
    # Організатор не може подавати тези на свою конференцію
    if conference.organizer == user:
        raise PermissionDenied("Організатор конференції не може подавати тези")
    
    # Рецензент не може подавати тези на конференцію, де він є рецензентом
    if user in conference.reviewers.all():
        raise PermissionDenied("Ви є рецензентом цієї конференції і не можете подавати тези")
    
    # Адміністратор може подавати тези (але краще перевірити)
    if user.role == 'ADMIN':
        return True
    
    # Автори та рецензенти (які не є рецензентами цієї конференції) можуть подавати
    if user.role in ['AUTHOR', 'REVIEWER']:
        return True
    
    # Інші ролі не можуть подавати
    raise PermissionDenied(f"Користувач з роллю {user.role} не може подавати тези")