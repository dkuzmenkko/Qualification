
import os
from django.db import models
from django.utils import timezone
from users.models import User
from conferences.models import Conference


def submission_file_path(instance, filename):
    """Генерує шлях для збереження файлу тези"""
    return f'submissions/{instance.conference.conference_id}/{instance.author.id}/{filename}'


class Submission(models.Model):
    STATUS_CHOICES = [
        ('DRAFT', 'Чернетка'),
        ('PENDING', 'На рецензуванні'),
        ('REVISION_REQUIRED', 'Потребує доопрацювання'),
        ('ACCEPTED', 'Прийнято'),
        ('REJECTED', 'Відхилено'),
    ]

    conference = models.ForeignKey(
        Conference,
        on_delete=models.CASCADE,
        related_name='submissions'
    )

    is_archived = models.BooleanField(
        "В архіві",
        default=False,
        help_text="Чи знаходиться теза в архіві"
    )
    
    archived_at = models.DateTimeField(
        "Дата архівації",
        null=True,
        blank=True,
        help_text="Дата, коли тезу було переміщено в архів"
    )

    title = models.CharField("Назва роботи", max_length=200)
    abstract = models.TextField("Текст тез", blank=True, null=True)
    file = models.FileField(
        "Файл",
        upload_to=submission_file_path,  # Використовуємо кастомний шлях
        blank=True,
        null=True
    )

    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='submissions'
    )

    reviewer = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_reviews'
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='DRAFT'
    )

    reviewer_comment = models.TextField(blank=True, null=True)
 
    version = models.IntegerField(default=1)
    is_latest = models.BooleanField(default=True)
    parent_submission = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='versions'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    comments_count = models.IntegerField(default=0)
    views_count = models.IntegerField(default=0)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['conference', 'status']),
            models.Index(fields=['author', 'is_latest']),
            models.Index(fields=['-version']),
            models.Index(fields=['status', 'is_latest']),
            models.Index(fields=['conference', 'status', 'is_latest']),
        ]

    def can_edit(self, user):
        if user == self.author:
            return self.status in ['DRAFT', 'REVISION_REQUIRED']
        elif user == self.reviewer:
            return True
        elif user.role == 'ADMIN':
            return True
        return False
    
    def can_delete(self, user):
        if self.status != 'DRAFT':
            return False
 
        if user == self.author:
            return True

        if user.role == 'ADMIN':
            return True
        
        return False
 
    def can_view(self, user):
        """Перевіряє, чи може користувач переглядати тезу"""
        if not user.is_authenticated:
            return False
        if self.is_archived:
            return (user == self.author or 
                    user == self.reviewer or 
                    user == self.conference.organizer or 
                    user.role == 'ADMIN')
        if user == self.author:
            return True
        if user == self.reviewer:
            return True
        if user.role == 'ADMIN':
            return True
        if user == self.conference.organizer:
            return True
        return True 
 
    def update_comments_count(self):
        from discussion.models import Comment
        self.comments_count = Comment.objects.filter(
            submission=self,
            is_deleted=False
        ).count()
        self.save(update_fields=['comments_count'])
 
    def create_new_version(self, title=None, abstract=None, file=None, comment=""):
        self.is_latest = False
        self.save(update_fields=['is_latest'])

        new_version = Submission.objects.create(
            conference=self.conference,
            title=title or self.title,
            abstract=abstract or self.abstract,
            file=file or self.file,
            author=self.author,
            reviewer=self.reviewer,
            status='PENDING',
            version=self.version + 1,
            is_latest=True,
            parent_submission=self
        )

        VersionHistory.objects.create(
            submission=new_version,
            previous_version=self,
            change_comment=comment,
            changed_by=self.author
        )
 
        return new_version
 
    def get_version_history(self):
        return self.versions.all().order_by('-version')
 
    def get_latest_version(self):
        if self.is_latest:
            return self
        return Submission.objects.filter(
            parent_submission=self if self.parent_submission else self,
            is_latest=True
        ).first()
    
    def get_file_url(self):
        if self.file:
            return self.file.url
        return None
    
    def get_file_name(self):
        """Повертає назву файлу"""
        if self.file:
            return os.path.basename(self.file.name)
        return None
 
    def __str__(self):
        return f"{self.title} (v{self.version}) - {self.author.username}"


class VersionHistory(models.Model):
 
    submission = models.ForeignKey(
        Submission,
        on_delete=models.CASCADE,
        related_name='history'
    )
 
    previous_version = models.ForeignKey(
        Submission,
        on_delete=models.SET_NULL,
        null=True,
        related_name='next_versions'
    )
 
    change_comment = models.TextField("Коментар до змін", blank=True)
    changed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='version_changes'
    )
 
    created_at = models.DateTimeField(auto_now_add=True)
 
    class Meta:
        ordering = ['-created_at']
        verbose_name = "Історія версій"
        verbose_name_plural = "Історія версій"
 
    def __str__(self):
        return f"Версія {self.submission.version} ← {self.previous_version.version if self.previous_version else 'нова'}"


class SubmissionView(models.Model):
    
    submission = models.ForeignKey(
        Submission,
        on_delete=models.CASCADE,
        related_name='views'
    )
    
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='submission_views'
    )
    
    viewed_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('submission', 'user')
        indexes = [
            models.Index(fields=['submission', 'user']),
            models.Index(fields=['viewed_at']),
        ]
        verbose_name = "Перегляд тези"
        verbose_name_plural = "Перегляди тез"
    
    def __str__(self):
        return f"{self.user.username} переглянув {self.submission.title} о {self.viewed_at}"
    
