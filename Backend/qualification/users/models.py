
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
import secrets
import string
import os

def avatar_upload_path(instance, filename):
    ext = filename.split('.')[-1]
    filename = f"user_{instance.id}_{int(timezone.now().timestamp())}.{ext}"
    return os.path.join('avatars', filename)


class User(AbstractUser):
    ROLE_CHOICES = [
        ('AUTHOR', 'Автор'),
        ('REVIEWER', 'Рецензент'),
        ('ADMIN', 'Адміністратор'),
    ]
    
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
  
    middle_name = models.CharField("По батькові", max_length=100, blank=True, null=True)
    created_at = models.DateTimeField("Дата створення", auto_now_add=True, null=True)
    orcid_id = models.CharField(
        "ORCID ID", 
        max_length=19,  
        blank=True, 
        null=True,
        help_text="Формат: 0000-0000-0000-0000"
    )

    avatar = models.ImageField(
        "Аватар",
        upload_to=avatar_upload_path,
        blank=True,
        null=True
    )
    
    
    affiliation = models.CharField(
        "Місце роботи/навчання", 
        max_length=255, 
        blank=True, 
        null=True
    )
    
    interests = models.JSONField(
        "Цікаві категорії",
        default=list,
        blank=True,
        help_text="Список категорій, які цікавлять користувача"
    )

    receive_email_notifications = models.BooleanField(
        "Отримувати сповіщення на email",
        default=True
    )
    
    receive_push_notifications = models.BooleanField(
        "Отримувати push-сповіщення",
        default=True
    )

    role = models.CharField(
        "Роль користувача",
        max_length=10,
        choices=ROLE_CHOICES,
        default='AUTHOR'
    )
    
    is_approved = models.BooleanField(
        "Підтверджений рецензент",
        default=False,
        help_text="Чи підтверджений рецензент адміністратором"
    )
  
    last_activity = models.DateTimeField("Остання активність", auto_now=True)

    email_verified = models.BooleanField(
        "Email підтверджено",
        default=False
    )
    
    email_verification_code = models.CharField(
        "Код верифікації",
        max_length=6,
        blank=True,
        null=True
    )
    
    email_verification_created_at = models.DateTimeField(
        "Дата створення коду",
        blank=True,
        null=True
    )
    
    def generate_verification_code(self):
        code = ''.join(secrets.choice(string.digits) for _ in range(6))
        self.email_verification_code = code
        self.email_verification_created_at = timezone.now()
        self.save(update_fields=['email_verification_code', 'email_verification_created_at'])
        return code
    
    def is_verification_code_valid(self, code):
        if not self.email_verification_code or not self.email_verification_created_at:
            return False
        
        if self.email_verification_code != code:
            return False
        
        expiration = self.email_verification_created_at + timezone.timedelta(minutes=5)
        return timezone.now() <= expiration
    
    @property
    def full_name(self):
        name_parts = []
        
        if self.last_name:
            name_parts.append(self.last_name)
        if self.first_name:
            name_parts.append(self.first_name)
        if self.middle_name:
            name_parts.append(self.middle_name)
        
        return ' '.join(name_parts) if name_parts else self.username

    def get_short_name(self):
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.username

    def __str__(self):
        return f"{self.full_name} ({self.get_role_display()})" if self.full_name != self.username else f"{self.username} ({self.get_role_display()})"