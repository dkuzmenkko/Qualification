
from django.db import models
from users.models import User
from conferences.models import Conference


class ExportHistory(models.Model):
    
    EXPORT_TYPES = [
        ('SUBMISSIONS', 'Список тез'),
        ('PARTICIPANTS', 'Список учасників'),
        ('SUBMISSION_PDF', 'Теза PDF'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='exports')
    conference = models.ForeignKey(Conference, on_delete=models.CASCADE, null=True, blank=True)
    export_type = models.CharField(max_length=20, choices=EXPORT_TYPES)
    file_name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.username} - {self.export_type} - {self.created_at}"