# fixtures/test_data.py

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'qualification.settings')
django.setup()

from users.models import User
from conferences.models import Conference
from submissions.models import Submission
from recommendations.models import UserAction, UserConferenceView
from django.utils import timezone
from datetime import timedelta

def create_test_data():
    print("Створюємо тестові дані...")

    author = User.objects.create_user(
        username='test_author',
        email='author@test.com',
        password='test123',
        first_name='Олександр',
        last_name='Петренко',
        role='AUTHOR',
        interests=['AI', 'DATA', 'WEB'],
        affiliation='КНУ ім. Шевченка',
        receive_email_notifications=True,
        receive_push_notifications=True
    )
    
    reviewer = User.objects.create_user(
        username='test_reviewer',
        email='reviewer@test.com',
        password='test123',
        first_name='Марія',
        last_name='Шевченко',
        role='REVIEWER',
        interests=['MATH', 'AI'],
        affiliation='НАН України',
        receive_email_notifications=True,
        receive_push_notifications=True,
        is_approved=True
    )
    
    print(f"Створено користувачів: {author.username}, {reviewer.username}")
    
    conferences_data = [
        {
            'title': 'Міжнародна конференція зі штучного інтелекту 2024',
            'description': 'Найбільша конференція з AI в Україні',
            'category': 'AI',
            'organizer': reviewer,
            'event_date': timezone.now().date() + timedelta(days=30),
            'submission_deadline': timezone.now().date() + timedelta(days=15),
        },
        {
            'title': 'Аналіз даних та машинне навчання',
            'description': 'Сучасні методи аналізу даних',
            'category': 'DATA',
            'organizer': reviewer,
            'event_date': timezone.now().date() + timedelta(days=45),
            'submission_deadline': timezone.now().date() + timedelta(days=20),
        },
        {
            'title': 'Веб-розробка 2024',
            'description': 'Сучасні технології веб-розробки',
            'category': 'WEB',
            'organizer': reviewer,
            'event_date': timezone.now().date() + timedelta(days=60),
            'submission_deadline': timezone.now().date() + timedelta(days=25),
        },
        {
            'title': 'Математичне моделювання',
            'description': 'Теорія та практика',
            'category': 'MATH',
            'organizer': reviewer,
            'event_date': timezone.now().date() + timedelta(days=20),
            'submission_deadline': timezone.now().date() + timedelta(days=5),
        },
        {
            'title': 'Кібербезпека 2024 (дедлайн минув)',
            'description': 'Неактуальна конференція',
            'category': 'SECURITY',
            'organizer': reviewer,
            'event_date': timezone.now().date() - timedelta(days=10),
            'submission_deadline': timezone.now().date() - timedelta(days=30),
        }
    ]
    
    conferences = []
    for conf_data in conferences_data:
        conf = Conference.objects.create(**conf_data)
        conferences.append(conf)
        print(f"✅ Створено конференцію: {conf.title} (категорія: {conf.category})")
    
    submission = Submission.objects.create(
        conference=conferences[0],  # AI конференція
        title='Нейронні мережі в обробці природної мови',
        abstract='Дослідження сучасних підходів...',
        author=author,
        reviewer=reviewer,
        status='ACCEPTED'
    )
    print(f"Створено тезу: {submission.title} (статус: ACCEPTED)")
    
    UserConferenceView.objects.create(
        user=author,
        conference=conferences[0],
        view_count=5,
        last_viewed=timezone.now()
    )
    
    UserConferenceView.objects.create(
        user=author,
        conference=conferences[1],
        view_count=3,
        last_viewed=timezone.now()
    )
    
    # Дії користувача
    UserAction.objects.create(
        user=author,
        conference=conferences[0],
        action_type='VIEW',
        weight=0.5,
        created_at=timezone.now() - timedelta(days=1)
    )
    
    UserAction.objects.create(
        user=author,
        conference=conferences[0],
        action_type='SUBMIT',
        weight=5.0,
        created_at=timezone.now() - timedelta(days=2)
    )
    
    UserAction.objects.create(
        user=author,
        conference=conferences[1],
        action_type='VIEW',
        weight=0.5,
        created_at=timezone.now() - timedelta(hours=12)
    )
    
    print("Створено історію активності")
    
    print("\n Тестові дані успішно створені!")
    print("\n Дані для входу:")
    print(f"   Автор: username='test_author', password='test123'")
    print(f"   Рецензент: username='test_reviewer', password='test123'")

if __name__ == '__main__':
    create_test_data()