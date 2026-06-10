from django.db import models
from users.models import User


class Notification(models.Model):
    NOTIFICATION_TYPE = [
        ('SUBMISSION_STATUS', 'Зміна статусу тези'),
        ('SUBMISSION_PENDING', 'Нова теза на рецензію'),
        ('REVIEW_INVITE', 'Запрошення стати рецензентом'),
        ('SUBMISSION_REVIEW', 'Результат рецензії'),
        ('COMMENT', 'Новий коментар'),
        ('COMMENT_REPLY', 'Відповідь на коментар'),
        ('VOTE', 'Голос за коментар'),
        ('GENERAL', 'Загальне повідомлення'),
    ]

    user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='notifications'
    )
    message = models.TextField()
    type = models.CharField(
        max_length=50, 
        choices=NOTIFICATION_TYPE, 
        default='GENERAL'
    )
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read']),
            models.Index(fields=['-created_at']),
        ]

    def __str__(self):
        return f"{self.user.username}: {self.message[:50]}"