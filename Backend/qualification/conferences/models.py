from django.db import models
from users.models import User
from django.apps import AppConfig


def conference_file_path(instance, filename):
    return f'conferences/{instance.conference_id}/{filename}'

class Conference(models.Model):
    CATEGORY_CHOICES = [
        ('MATH', 'Математика'),
        ('CS', 'Інформатика'),
        ('AI', 'Штучний інтелект'),
        ('WEB', 'Веб-розробка'),
        ('DATA', 'Аналіз даних'),
        ('SECURITY', 'Кібербезпека'),
        ('PHYSICS', 'Фізика'),
        ('BIOLOGY', 'Біологія'),
        ('CHEMISTRY', 'Хімія'),
    ]
    

    CONFERENCE_TYPE_CHOICES = [
        ('OFFLINE', 'Офлайн'),
        ('ONLINE', 'Онлайн'),
        ('HYBRID', 'Гібридний (офлайн + онлайн)'),
    ]

    DOCUMENT_TYPE_CHOICES = [
        ('GUIDELINES', 'Інструкція для авторів'),
        ('PROGRAM', 'Програма конференції'),
        ('REQUIREMENTS', 'Вимоги до тез'),
        ('SCHEDULE', 'Розклад'),
        ('OTHER', 'Інше'),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)

    organizer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='organized_conferences')
    reviewers = models.ManyToManyField(User, blank=True, related_name='review_conferences')

    created_at = models.DateTimeField(auto_now_add=True)

    event_date = models.DateField()
    submission_deadline = models.DateField()

    conference_id = models.CharField(max_length=8, unique=True, editable=False)

    institution = models.CharField(
        "Навчальний заклад/Організація",
        max_length=255,
        blank=True,
        null=True,
        help_text="Назва навчального закладу або організації, що проводить конференцію"
    )

    conference_type = models.CharField(
        "Тип проведення",
        max_length=20,
        choices=CONFERENCE_TYPE_CHOICES,
        default='ONLINE',
        help_text="Оберіть формат проведення конференції"
    )

    online_link = models.URLField(
        "Посилання для онлайн участі",
        blank=True,
        null=True,
        help_text="Zoom, Google Meet, або інше посилання для онлайн підключення"
    )
    
    address = models.TextField(
        "Адреса проведення",
        blank=True,
        null=True,
        help_text="Фізична адреса місця проведення конференції"
    )

    guidelines_file = models.FileField(
        "Інструкція для авторів",
        upload_to=conference_file_path,
        blank=True,
        null=True,
        help_text="PDF файл з інструкціями для авторів"
    )

    additional_files = models.JSONField(
        "Додаткові файли",
        default=list,
        blank=True,
        help_text="Список додаткових файлів (назва, URL, тип)"
    )    

    def save(self, *args, **kwargs):
        if not self.conference_id:
            last = Conference.objects.order_by('-id').first()
            next_id = 1 if not last else last.id + 1
            self.conference_id = str(next_id).zfill(8)
        super().save(*args, **kwargs)

    def get_guidelines_url(self):
        if self.guidelines_file:
            return self.guidelines_file.url
        return None

    def get_guidelines_filename(self):
        if self.guidelines_file:
            import os
            return os.path.basename(self.guidelines_file.name)
        return None

    def __str__(self):
        return f"{self.title} ({self.conference_id})"
 
class ReviewerInvitation(models.Model):
    conference = models.ForeignKey('Conference', on_delete=models.CASCADE, related_name='invitations')
    reviewer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reviewer_invitations')
    STATUS_CHOICES = [
        ('PENDING', 'Очікує відповіді'),
        ('ACCEPTED', 'Прийнято'),
        ('REJECTED', 'Відхилено'),
    ]
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('conference', 'reviewer')

    def __str__(self):
        return f"{self.reviewer.username} -> {self.conference.title} ({self.status})"


class Announcement(models.Model):
    
    conference = models.ForeignKey(
        'Conference',
        on_delete=models.CASCADE,
        related_name='announcements'
    )
    
    title = models.CharField("Заголовок", max_length=200)
    content = models.TextField("Текст оголошення")
    
    send_email = models.BooleanField("Відправити email", default=True)
    send_push = models.BooleanField("Відправити push", default=True)
    
    sent_to_count = models.IntegerField("Кількість отримувачів", default=0)
    
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_announcements'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = "Оголошення"
        verbose_name_plural = "Оголошення"
    
    def __str__(self):
        return f"{self.title} - {self.conference.title}"
    
    def get_recipients(self):
        """Отримує список учасників конференції для розсилки"""
        recipients = set()
        
        for submission in self.conference.submissions.filter(is_latest=True):
            recipients.add(submission.author)
        
        for reviewer in self.conference.reviewers.all():
            recipients.add(reviewer)
        
        recipients.add(self.conference.organizer)
        
        return list(recipients)

class ConferencesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'conferences'
