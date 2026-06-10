from django.db.models.signals import post_save
from django.dispatch import receiver
from submissions.models import Submission
from .services import UserActivityTracker


@receiver(post_save, sender=Submission)
def track_submission_created(sender, instance, created, **_):
    if created:
        UserActivityTracker.track_submission(instance.author, instance.conference)