from rest_framework import generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.exceptions import NotFound, PermissionDenied
from django.shortcuts import get_object_or_404
from django.db import models
from django.utils import timezone
from users.models import User
from submissions.models import Submission
from conferences.models import Conference
from .models import UserProfile, ProfileView
from .serializers import (
    UserProfileSerializer,
    PublicProfileSerializer,
    ProfileUpdateSerializer,
    ProfileViewSerializer,
    SubmissionBriefSerializer,
    ConferenceBriefSerializer,
    ReviewedSubmissionSerializer,
)


class MyProfileView(generics.RetrieveUpdateAPIView):
    
    permission_classes = [permissions.IsAuthenticated]
    
    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return ProfileUpdateSerializer
        return UserProfileSerializer
    
    def get_object(self):
        profile, _ = UserProfile.objects.get_or_create(  
            user=self.request.user
        )
        return profile


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def public_profile(request, user_id):
 
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        raise NotFound("Користувача не знайдено")
 
    profile, _ = UserProfile.objects.get_or_create(user=user)
 
    if not profile.is_profile_public and request.user != user and request.user.role != 'ADMIN':
        raise PermissionDenied("Цей профіль закритий для публічного перегляду")
 
    if request.user != user:
        ProfileView.objects.create(
            profile=profile,
            viewer=request.user
        )
        profile.profile_views += 1
        profile.save(update_fields=['profile_views'])
 
    stats = {
        'total_submissions': Submission.objects.filter(
            author=user,
            is_latest=True
        ).count(),
        'accepted_submissions': Submission.objects.filter(
            author=user,
            status='ACCEPTED',
            is_latest=True
        ).count(),
        'organized_conferences': Conference.objects.filter(
            organizer=user
        ).count(),
        'reviewed_submissions': Submission.objects.filter(
            reviewer=user,
            is_latest=True
        ).count(),
        'member_since': user.date_joined.strftime('%d.%m.%Y'),
        'last_active': user.last_activity.strftime('%d.%m.%Y %H:%M') if user.last_activity else None,
    }
 
    recent_submissions = Submission.objects.filter(
        author=user,
        status='ACCEPTED',
        is_latest=True
    ).select_related('conference').order_by('-created_at')[:5]
 
    recent_submissions_data = SubmissionBriefSerializer(
        [{
            'id': sub.id,
            'title': sub.title,
            'conference_title': sub.conference.title,
            'conference_date': sub.conference.event_date.strftime('%d.%m.%Y'),
            'created_at': sub.created_at.strftime('%d.%m.%Y'),
        } for sub in recent_submissions],
        many=True
    ).data
 
    organized = Conference.objects.filter(
        organizer=user
    ).order_by('-created_at')[:5]
 
    organized_data = ConferenceBriefSerializer(
        [{
            'id': conf.id,
            'title': conf.title,
            'conference_id': conf.conference_id,
            'event_date': conf.event_date.strftime('%d.%m.%Y'),
            'submission_deadline': conf.submission_deadline.strftime('%d.%m.%Y'),
        } for conf in organized],
        many=True
    ).data
 
    reviewed = Submission.objects.filter(
        reviewer=user,
        is_latest=True
    ).exclude(status='PENDING').select_related('author', 'conference').order_by('-updated_at')[:5]
 
    reviewed_data = ReviewedSubmissionSerializer(
        [{
            'id': sub.id,
            'title': sub.title,
            'author': sub.author.full_name,
            'conference_title': sub.conference.title,
            'status': sub.get_status_display(),
            'reviewed_at': sub.updated_at.strftime('%d.%m.%Y'),
        } for sub in reviewed],
        many=True
    ).data
 
    data = {
        'user': user,
        'profile': profile,
        'stats': stats,
        'recent_submissions': recent_submissions_data,
        'organized_conferences': organized_data,
        'reviewed_submissions': reviewed_data,
    }
 
    # Передаємо контекст запиту в серіалізатор
    serializer = PublicProfileSerializer(data, context={'request': request})
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def profile_stats(request, user_id):
    """Статистика профілю (тільки для власника)"""
    
    user = get_object_or_404(User, id=user_id)
    
    if request.user != user and request.user.role != 'ADMIN':
        raise PermissionDenied("Тільки власник може бачити статистику")
    
    submissions = Submission.objects.filter(author=user, is_latest=True)
    conferences = Conference.objects.filter(organizer=user)
    
    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile_views = ProfileView.objects.filter(profile=profile).count()
    
    last_30_days = timezone.now() - timezone.timedelta(days=30)
    recent_views = ProfileView.objects.filter(
        profile=profile,
        viewed_at__gte=last_30_days
    ).count()
    
    status_stats = {
        'draft': submissions.filter(status='DRAFT').count(),
        'pending': submissions.filter(status='PENDING').count(),
        'revision_required': submissions.filter(status='REVISION_REQUIRED').count(),
        'accepted': submissions.filter(status='ACCEPTED').count(),
        'rejected': submissions.filter(status='REJECTED').count(),
    }
    
    return Response({
        'submissions': {
            'total': submissions.count(),
            'by_status': status_stats,
            'acceptance_rate': round(
                status_stats['accepted'] / submissions.count() * 100 
                if submissions.count() > 0 else 0, 1
            ),
        },
        'conferences': {
            'total': conferences.count(),
            'active': conferences.filter(
                submission_deadline__gte=timezone.now().date()
            ).count(),
            'past': conferences.filter(
                event_date__lt=timezone.now().date()
            ).count(),
        },
        'profile_views': {
            'total': profile_views,
            'last_30_days': recent_views,
        },
        'reviewer_stats': {
            'total_reviewed': Submission.objects.filter(
                reviewer=user,
                is_latest=True
            ).count(),
            'accepted_as_reviewer': Submission.objects.filter(
                reviewer=user,
                status='ACCEPTED',
                is_latest=True
            ).count(),
        } if user.role == 'REVIEWER' else None,
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def search_users(request):
    
    query = request.query_params.get('q', '')
    limit = int(request.query_params.get('limit', 20))
    
    if not query or len(query) < 2:
        return Response({
            'error': 'Введіть хоча б 2 символи для пошуку'
        }, status=400)

    users = User.objects.filter(
        models.Q(username__icontains=query) |
        models.Q(first_name__icontains=query) |
        models.Q(last_name__icontains=query) |
        models.Q(affiliation__icontains=query)
    ).filter(
        profile__is_profile_public=True
    ).select_related('profile')[:limit]
    
    data = []
    for user in users:
        data.append({
            'id': user.id,
            'username': user.username,
            'full_name': user.full_name,
            'affiliation': user.affiliation,
            'role': user.get_role_display(),
            'profile_views': user.profile.profile_views if hasattr(user, 'profile') else 0,
        })
    
    return Response({
        'query': query,
        'count': len(data),
        'results': data
    })