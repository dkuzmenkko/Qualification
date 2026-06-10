from django.db import models
from users.models import User
from conferences.models import Conference


class UserAction(models.Model):
    
    ACTION_TYPES = [
        ('VIEW', 'Перегляд'),
        ('SUBMIT', 'Подача тези'),
        ('LIKE', 'Лайк'),
        ('COMMENT', 'Коментар'),
        ('FAVORITE', 'Додано в обране'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='actions')
    conference = models.ForeignKey(Conference, on_delete=models.CASCADE, null=True, blank=True, related_name='actions')
    action_type = models.CharField(max_length=20, choices=ACTION_TYPES)
    weight = models.FloatField(default=1.0)  
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'action_type']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f"{self.user.username} - {self.action_type} - {self.conference.title if self.conference else 'N/A'}"


class UserConferenceView(models.Model):
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='conference_views')
    conference = models.ForeignKey(Conference, on_delete=models.CASCADE, related_name='views')
    view_count = models.PositiveIntegerField(default=1)
    last_viewed = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('user', 'conference')
    
    def __str__(self):
        return f"{self.user.username} -> {self.conference.title} ({self.view_count})"