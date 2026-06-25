
import os
from django.core.management.base import BaseCommand
from django.utils import timezone
from submissions.models import Submission
from notifications.utils import create_notification


class Command(BaseCommand):
    help = 'Архівує тези, старші за 1 рік'

    def handle(self, *args, **options):
        self.stdout.write('Починаємо архівацію старих тез...')
        one_year_ago = timezone.now() - timezone.timedelta(days=365)
        submissions_to_archive = Submission.objects.filter(
            is_archived=False,
            created_at__lte=one_year_ago,
            is_latest=True
        )
        
        count = submissions_to_archive.count()
        self.stdout.write(f'Знайдено {count} тез для архівації')
        
        archived_count = 0
        for submission in submissions_to_archive:
            submission.archive()
            archived_count += 1
            create_notification(
                submission.author,
                f"Вашу тезу '{submission.title}' переміщено до архіву (через 1 рік після публікації)",
                type='SUBMISSION_STATUS',
                send_email=False,
                send_push=True
            )
            
            self.stdout.write(f'  - Архівовано: {submission.title}')
        
        self.stdout.write(self.style.SUCCESS(
            f'Успішно архівовано {archived_count} тез'
        ))