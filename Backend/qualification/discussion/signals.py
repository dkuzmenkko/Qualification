from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import Comment


@receiver(post_save, sender=Comment)
def update_submission_comments_count_on_save(sender, instance, created, **kwargs):
    if hasattr(instance.submission, 'update_comments_count'):
        instance.submission.update_comments_count()


@receiver(post_delete, sender=Comment)
def update_submission_comments_count_on_delete(sender, instance, **kwargs):
    if hasattr(instance.submission, 'update_comments_count'):
        instance.submission.update_comments_count()