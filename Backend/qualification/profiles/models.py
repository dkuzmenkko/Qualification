from django.db import models
from users.models import User


class UserProfile(models.Model):
    
    user = models.OneToOneField(
        User, 
        on_delete=models.CASCADE, 
        related_name='profile'
    )
    
    is_profile_public = models.BooleanField(
        "Публічний профіль",
        default=True,
        help_text="Чи можуть інші користувачі бачити ваш профіль"
    )
    
    show_email = models.BooleanField(
        "Показувати email",
        default=False,
        help_text="Чи показувати email у публічному профілі"
    )
    
    show_orcid = models.BooleanField(
        "Показувати ORCID",
        default=True,
        help_text="Чи показувати ORCID ID у публічному профілі"
    )
    
    bio = models.TextField(
        "Біографія",
        blank=True,
        null=True,
        help_text="Коротка інформація про себе"
    )
    
    website = models.URLField("Вебсайт", blank=True, null=True)
    linkedin = models.URLField("LinkedIn", blank=True, null=True)
    github = models.URLField("GitHub", blank=True, null=True)
    google_scholar = models.URLField("Google Scholar", blank=True, null=True)
    
    profile_views = models.IntegerField("Переглядів профілю", default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Профіль користувача"
        verbose_name_plural = "Профілі користувачів"
    
    def __str__(self):
        return f"Профіль {self.user.full_name}"


class ProfileView(models.Model):
    
    profile = models.ForeignKey(
        UserProfile, 
        on_delete=models.CASCADE, 
        related_name='views'
    )
    viewer = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='profile_views'
    )
    viewed_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-viewed_at']
    
    def __str__(self):
        return f"{self.viewer.username} -> {self.profile.user.username}"