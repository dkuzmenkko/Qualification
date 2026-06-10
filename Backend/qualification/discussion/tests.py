from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework import status
from conferences.models import Conference
from submissions.models import Submission
from discussion.models import Comment

User = get_user_model()

class DiscussionTest(TestCase):
    
    def setUp(self):
        self.client = APIClient()
        
        self.author = User.objects.create_user(
            username='author',
            password='test123',
            role='AUTHOR'
        )
        
        self.reviewer = User.objects.create_user(
            username='reviewer',
            password='test123',
            role='REVIEWER',
            is_approved=True
        )
        
        self.other_user = User.objects.create_user(
            username='other',
            password='test123',
            role='AUTHOR'
        )
        
        self.conference = Conference.objects.create(
            title='Test Conference',
            category='AI',
            organizer=self.reviewer,
            event_date=timezone.now().date() + timedelta(days=30),
            submission_deadline=timezone.now().date() + timedelta(days=15)
        )
        
        self.submission = Submission.objects.create(
            conference=self.conference,
            title='Test Thesis',
            abstract='Test abstract',
            author=self.author,
            reviewer=self.reviewer,
            status='ACCEPTED'
        )
        
        self.root_comment = Comment.objects.create(
            submission=self.submission,
            author=self.author,
            text='This is a root comment'
        )
        
        self.reply_comment = Comment.objects.create(
            submission=self.submission,
            author=self.other_user,
            parent=self.root_comment,
            text='This is a reply'
        )
        
        self.client.force_authenticate(user=self.other_user)
    
    def test_create_comment(self):
        response = self.client.post(
            f'/api/discussion/submissions/{self.submission.id}/comments/',
            {'text': 'New comment'},
            format='json'
        )
        print("Response data:", response.data)
        print("Response status:", response.status_code)        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Comment.objects.count(), 3)
    
    def test_create_reply(self):
        response = self.client.post(
            f'/api/discussion/submissions/{self.submission.id}/comments/',
            {'text': 'New reply', 'parent': self.root_comment.id},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Comment.objects.count(), 3)
        
        self.root_comment.refresh_from_db()
        self.assertEqual(self.root_comment.replies_count, 2)
    
    def test_vote_comment(self):
        response = self.client.post(
            f'/api/discussion/comments/{self.root_comment.id}/vote/',
            {'vote': 1},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.root_comment.refresh_from_db()
        self.assertEqual(self.root_comment.likes_count, 1)
        self.assertEqual(self.root_comment.rating, 1)
    
    def test_change_vote(self):
        self.client.post(
            f'/api/discussion/comments/{self.root_comment.id}/vote/',
            {'vote': 1},
            format='json'
        )
        
        response = self.client.post(
            f'/api/discussion/comments/{self.root_comment.id}/vote/',
            {'vote': -1},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.root_comment.refresh_from_db()
        self.assertEqual(self.root_comment.likes_count, 0)
        self.assertEqual(self.root_comment.dislikes_count, 1)
        self.assertEqual(self.root_comment.rating, -1)
    
    def test_cancel_vote(self):
        self.client.post(
            f'/api/discussion/comments/{self.root_comment.id}/vote/',
            {'vote': 1},
            format='json'
        )
        
        response = self.client.post(
            f'/api/discussion/comments/{self.root_comment.id}/vote/',
            {'vote': 1},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.root_comment.refresh_from_db()
        self.assertEqual(self.root_comment.likes_count, 0)
        self.assertEqual(self.root_comment.rating, 0)
    
    def test_update_comment(self):
        comment = Comment.objects.create(
            submission=self.submission,
            author=self.other_user,
            text='Original text'
        )
        
        response = self.client.patch(
            f'/api/discussion/comments/{comment.id}/',
            {'text': 'Updated text'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        comment.refresh_from_db()
        self.assertEqual(comment.text, 'Updated text')
    
    def test_cannot_update_others_comment(self):
        response = self.client.patch(
            f'/api/discussion/comments/{self.root_comment.id}/',
            {'text': 'Hacked text'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_delete_comment(self):
        comment = Comment.objects.create(
            submission=self.submission,
            author=self.other_user,
            text='To be deleted'
        )
        
        response = self.client.delete(
            f'/api/discussion/comments/{comment.id}/'
        )
        
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        comment.refresh_from_db()
        self.assertTrue(comment.is_deleted)
    
    def test_get_comments_stats(self):
        response = self.client.get(
            f'/api/discussion/submissions/{self.submission.id}/comments/stats/'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_comments'], 2)
        self.assertEqual(response.data['root_comments'], 1)
        self.assertEqual(response.data['replies'], 1)