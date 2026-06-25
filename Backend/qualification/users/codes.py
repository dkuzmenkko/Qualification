from django.core.management.base import BaseCommand
from django.utils import timezone
from users.models import User


class Command(BaseCommand):
    help = 'Очищує застарілі коди верифікації'

    def handle(self, *args, **options):
        cutoff = timezone.now() - timezone.timedelta(hours=24)
        old_users = User.objects.filter(
            email_verified=False,
            date_joined__lt=cutoff
        )
        
        count = old_users.count()
        old_users.delete()
        
        self.stdout.write(f"Видалено {count} застарілих непідтверджених користувачів")