from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated

from rest_framework.exceptions import PermissionDenied
from rest_framework import generics, permissions
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction
from django.db import models as db_models
from django.core.cache import cache

from conferences import serializers
from conferences.models import Conference, ReviewerInvitation
from conferences.serializers import ConferenceSerializer
from users.models import User
from users.serializers import UserSerializer
from .models import Submission, VersionHistory, SubmissionView
from .serializers import (
    SubmissionSerializer,
    SubmissionCreateSerializer,
    SubmissionUpdateSerializer,
)
from .permissions import check_submission_permission
from notifications.utils import create_notification
from recommendations.services import UserActivityTracker
import random


class SubmissionListCreateView(generics.ListCreateAPIView):
    
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        
        show_archived = self.request.query_params.get('archived', 'false') == 'true'
        
        base_queryset = Submission.objects.filter(is_latest=True)
        
        if not show_archived:
            base_queryset = base_queryset.filter(is_archived=False)
        else:
            base_queryset = base_queryset.filter(is_archived=True)
        
        if user.role == 'ADMIN':
            return base_queryset.order_by('-created_at')
        elif user.role == 'REVIEWER':
            return base_queryset.filter(
                db_models.Q(reviewer=user) | db_models.Q(author=user)
            ).order_by('-created_at')
        else: 
            return base_queryset.filter(author=user).order_by('-created_at')
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return SubmissionCreateSerializer
        return SubmissionSerializer
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    def create(self, request, *args, **kwargs):
        try:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            
            self.perform_create(serializer)
            
            instance = serializer.instance
            
            response_data = {
                'id': instance.id,
                'title': instance.title,
                'abstract': instance.abstract,
                'conference': instance.conference.id,
                'status': instance.status,
                'created_at': instance.created_at,
                'file': instance.file.url if instance.file else None
            }
            
            headers = self.get_success_headers(serializer.data)
            return Response(response_data, status=201, headers=headers)
            
        except PermissionDenied as e:
            return Response(
                {"error": str(e)},
                status=403
            )
        except serializers.ValidationError as e:
            return Response(
                {"error": e.detail},
                status=400
            )
        except Exception as e:
            print(f"Error creating submission: {e}")
            return Response(
                {"error": str(e)},
                status=400
            )
    
    def perform_create(self, serializer):
        user = self.request.user
        conference = serializer.validated_data['conference']
        
        try:
            check_submission_permission(user, conference)
        except PermissionDenied as e:
            raise PermissionDenied(str(e))

        existing = Submission.objects.filter(
            author=user,
            conference=conference,
            status__in=['DRAFT', 'PENDING', 'REVISION_REQUIRED']
        ).exists()
        
        if existing:
            raise PermissionDenied(
                "У вас вже є активна теза на цю конференцію. "
                "Будь ласка, дочекайтеся рецензії або відредагуйте існуючу."
            )
        
        submission = serializer.save(author=user)
        UserActivityTracker.track_submission(user, conference)
        return submission

class SubmissionDetailView(generics.RetrieveUpdateDestroyAPIView):
    
    queryset = Submission.objects.all()
    permission_classes = [permissions.IsAuthenticated]
    
    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return SubmissionUpdateSerializer
        return SubmissionSerializer
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    def retrieve(self, request, *args, **kwargs):
        submission = self.get_object()
        
        if not submission.can_view(request.user):
            raise PermissionDenied("У вас немає прав для перегляду цієї тези")
        
        self._record_view(submission, request.user)
        
        serializer = self.get_serializer(submission)
        return Response(serializer.data)
    
    def _record_view(self, submission, user):
        """Записує унікальний перегляд тези"""
        cache_key = f"submission_view_{submission.id}_user_{user.id}_hour"
        
        if not cache.get(cache_key):
            SubmissionView.objects.get_or_create(
                submission=submission,
                user=user,
                defaults={'viewed_at': timezone.now()}
            )
            
            submission.views_count = SubmissionView.objects.filter(
                submission=submission
            ).count()
            submission.save(update_fields=['views_count'])
            
            cache.set(cache_key, True, 3600)
    
    def perform_update(self, serializer):
        user = self.request.user
        submission = self.get_object()

        if not submission.can_edit(user):
            raise PermissionDenied("У вас немає прав для редагування цієї тези")
        
        with transaction.atomic():
            updated_submission = serializer.save()

            if updated_submission.status == 'PENDING' and not updated_submission.submitted_at:
                updated_submission.submitted_at = timezone.now()
                updated_submission.save(update_fields=['submitted_at'])

                if updated_submission.reviewer:
                    create_notification(
                        updated_submission.reviewer,
                        f"Нова теза '{updated_submission.title}' очікує на рецензування",
                        type='SUBMISSION_PENDING',
                        send_email=False,
                        send_push=True
                    )
    
    def destroy(self, request, *args, **kwargs):
        """Видалення тези"""
        instance = self.get_object()
        user = request.user
        
        if instance.status != 'DRAFT':
            return Response(
                {"error": "Можна видалити тільки чернетку"},
                status=400
            )
        
        if instance.author != user and user.role != 'ADMIN':
            return Response(
                {"error": "Тільки автор або адміністратор може видалити чернетку"},
                status=403
            )
        
        instance.delete()
        
        return Response(
            {"message": "Чернетку успішно видалено"},
            status=200
        )

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_avatar(request):
    """Видалення аватара користувача"""
    user = request.user
    
    if user.avatar:
        user.avatar.delete(save=False)
        user.avatar = None
        user.save()
        
        return Response({
            "message": "Аватар успішно видалено",
            "user": UserSerializer(user, context={'request': request}).data
        })
    
    return Response(
        {"error": "Аватар не знайдено"},
        status=404
    )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def submit_for_review(request, pk):
    
    submission = get_object_or_404(Submission, pk=pk)
    user = request.user
    
    if submission.author != user:
        return Response({"error": "Тільки автор може відправити тезу на рецензію"}, status=403)
    
    if submission.status not in ['DRAFT', 'REVISION_REQUIRED']:
        return Response({"error": "Теза вже відправлена на рецензію"}, status=400)
    
    if submission.conference.submission_deadline < timezone.now().date():
        return Response({"error": "Дедлайн подачі минув"}, status=400)
    
    with transaction.atomic():
        if not submission.reviewer:
            
            reviewers = reviewers.exclude(id=user.id)
            
            if reviewers.exists():
                reviewer = random.choice(list(reviewers))
                submission.reviewer = reviewer
            else:
                submission.reviewer = submission.conference.organizer
        
        submission.status = 'PENDING'
        submission.submitted_at = timezone.now()
        submission.save(update_fields=['status', 'submitted_at', 'reviewer'])
        
        if submission.reviewer:
            create_notification(
                submission.reviewer,
                f"Нова теза '{submission.title}' на конференції '{submission.conference.title}' очікує на рецензування",
                type='SUBMISSION_PENDING',
                send_email=False,
                send_push=True
            )
        
        if submission.conference.organizer != submission.reviewer:
            create_notification(
                submission.conference.organizer,
                f"Нова теза '{submission.title}' подана на конференцію '{submission.conference.title}'",
                type='SUBMISSION_PENDING',
                send_email=False,
                send_push=True
            )
    
    return Response({
        "message": "Тезу відправлено на рецензію",
        "reviewer": submission.reviewer.username if submission.reviewer else None
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def review_submission(request, pk):
    
    submission = get_object_or_404(Submission, pk=pk)
    user = request.user

    if submission.reviewer != user and submission.conference.organizer != user:
        return Response({"error": "Тільки рецензент або організатор може рецензувати"}, status=403)
    
    action = request.data.get('action')
    comment = request.data.get('comment', '')
    
    if action not in ['ACCEPT', 'REJECT', 'REVISION']:
        return Response({"error": "Невірна дія"}, status=400)
    
    with transaction.atomic():
        if action == 'ACCEPT':
            submission.status = 'ACCEPTED'
            message = f"Вашу тезу '{submission.title}' прийнято! Тепер вона доступна для обговорення."
        elif action == 'REJECT':
            submission.status = 'REJECTED'
            message = f"Вашу тезу '{submission.title}' відхилено."
        else:  
            submission.status = 'REVISION_REQUIRED'
            message = f"Теза '{submission.title}' потребує доопрацювання."
        
        submission.reviewer_comment = comment
        submission.save(update_fields=['status', 'reviewer_comment'])
 
        create_notification(
            submission.author,
            message,
            type='SUBMISSION_REVIEW',
            send_email=False,
            send_push=True
        )

        UserActivityTracker.track_action(user, submission.conference, f'REVIEW_{action}')
    
    return Response({
        "message": f"Тезу {dict(Submission.STATUS_CHOICES).get(submission.status)}",
        "status": submission.status
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def submission_versions(request, pk):
    
    submission = get_object_or_404(Submission, pk=pk)

    root = submission
    while root.parent_submission:
        root = root.parent_submission
    
    versions = Submission.objects.filter(
        db_models.Q(id=root.id) | db_models.Q(parent_submission=root)
    ).order_by('-version')
    
    serializer = SubmissionSerializer(versions, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def compare_versions(request, submission_id, version1, version2):

    try:
        v1 = Submission.objects.get(id=version1)
        v2 = Submission.objects.get(id=version2)
    except Submission.DoesNotExist:
        return Response({"error": "Версії не знайдено"}, status=404)

    if v1.parent_submission != v2.parent_submission and v1 != v2.parent_submission and v2 != v1.parent_submission:
        return Response({"error": "Версії не належать одній тезі"}, status=400)

    changes = []
    
    if v1.title != v2.title:
        changes.append({
            'field': 'title',
            'old': v1.title,
            'new': v2.title
        })
    
    if v1.abstract != v2.abstract:
        changes.append({
            'field': 'abstract',
            'old': v1.abstract[:200] + '...' if len(v1.abstract or '') > 200 else v1.abstract,
            'new': v2.abstract[:200] + '...' if len(v2.abstract or '') > 200 else v2.abstract
        })

    history = VersionHistory.objects.filter(
        submission=v2,
        previous_version=v1
    ).first()
    
    return Response({
        'version1': {
            'id': v1.id,
            'version': v1.version,
            'title': v1.title,
            'abstract': v1.abstract,
            'created_at': v1.created_at,
            'status': v1.status
        },
        'version2': {
            'id': v2.id,
            'version': v2.version,
            'title': v2.title,
            'abstract': v2.abstract,
            'created_at': v2.created_at,
            'status': v2.status
        },
        'changes': changes,
        'change_comment': history.change_comment if history else None
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def accepted_submissions(request):
    submissions = Submission.objects.filter(
        status='ACCEPTED',
        is_latest=True,
        is_archived=False,  
        conference__event_date__gte=timezone.now().date()
    ).select_related('author', 'conference').order_by('-created_at')
    
    if request.user.is_authenticated and request.user.interests:
        submissions = submissions.filter(conference__category__in=request.user.interests)
    
    serializer = SubmissionSerializer(submissions, many=True, context={'request': request})
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def author_dashboard(request):
    user = request.user

    submissions = Submission.objects.filter(
        author=user,
        is_latest=True
    ).select_related('conference', 'reviewer').order_by('-created_at')

    data = {
        'draft': SubmissionSerializer(
            submissions.filter(status='DRAFT'), 
            many=True, 
            context={'request': request}
        ).data,
        'pending': SubmissionSerializer(
            submissions.filter(status='PENDING'), 
            many=True, 
            context={'request': request}
        ).data,
        'revision_required': SubmissionSerializer(
            submissions.filter(status='REVISION_REQUIRED'), 
            many=True, 
            context={'request': request}
        ).data,
        'accepted': SubmissionSerializer(
            submissions.filter(status='ACCEPTED'), 
            many=True, 
            context={'request': request}
        ).data,
        'rejected': SubmissionSerializer(
            submissions.filter(status='REJECTED'), 
            many=True, 
            context={'request': request}
        ).data,
        'statistics': {
            'total': submissions.count(),
            'draft': submissions.filter(status='DRAFT').count(),
            'pending': submissions.filter(status='PENDING').count(),
            'revision_required': submissions.filter(status='REVISION_REQUIRED').count(),
            'accepted': submissions.filter(status='ACCEPTED').count(),
            'rejected': submissions.filter(status='REJECTED').count(),
        }
    }
    
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def reviewer_dashboard(request):
    user = request.user

    if user.role != 'REVIEWER':
        return Response(
            {"error": "Тільки рецензенти мають доступ до цього дашборду"}, 
            status=403
        )

    to_review = Submission.objects.filter(
        reviewer=user,
        status='PENDING',
        is_latest=True
    ).select_related('conference', 'author').order_by('-created_at')

    reviewed = Submission.objects.filter(
        reviewer=user,
        is_latest=True
    ).exclude(status='PENDING').select_related('conference', 'author').order_by('-updated_at')

    invitations = ReviewerInvitation.objects.filter(
        reviewer=user, 
        status='PENDING'
    ).select_related('conference')

    stats = {
        'to_review_count': to_review.count(),
        'reviewed_count': reviewed.count(),
        'accepted_count': reviewed.filter(status='ACCEPTED').count(),
        'rejected_count': reviewed.filter(status='REJECTED').count(),
        'revision_count': reviewed.filter(status='REVISION_REQUIRED').count(),
        'pending_invitations': invitations.count(),
    }
    
    data = {
        'to_review': SubmissionSerializer(
            to_review, 
            many=True, 
            context={'request': request}
        ).data,
        'reviewed': SubmissionSerializer(
            reviewed, 
            many=True, 
            context={'request': request}
        ).data,
        'invitations': [{
            'id': inv.id,
            'conference': ConferenceSerializer(inv.conference).data,
            'status': inv.status,
            'created_at': inv.created_at
        } for inv in invitations],
        'statistics': stats
    }
    
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def organizer_dashboard(request):
    user = request.user

    conferences = Conference.objects.filter(
        organizer=user
    ).prefetch_related(
        'submissions', 
        'reviewers',
        'submissions__author'
    ).order_by('-created_at')
    
    data = []
    for conf in conferences:
        submissions = conf.submissions.filter(is_latest=True)

        total = submissions.count()
        pending = submissions.filter(status='PENDING').count()
        accepted = submissions.filter(status='ACCEPTED').count()
        rejected = submissions.filter(status='REJECTED').count()
        revision = submissions.filter(status='REVISION_REQUIRED').count()

        active_reviewers = User.objects.filter(
            assigned_reviews__conference=conf,
            assigned_reviews__is_latest=True
        ).distinct().count()
        
        data.append({
            'id': conf.id,
            'conference_id': conf.conference_id,
            'title': conf.title,
            'category': conf.category,
            'event_date': conf.event_date,
            'submission_deadline': conf.submission_deadline,
            'is_active': conf.submission_deadline >= timezone.now().date(),
            'statistics': {
                'total_submissions': total,
                'pending_submissions': pending,
                'accepted_submissions': accepted,
                'rejected_submissions': rejected,
                'revision_required': revision,
                'acceptance_rate': round((accepted / total * 100) if total > 0 else 0, 1),
                'active_reviewers': active_reviewers,
                'total_reviewers': conf.reviewers.count(),
            },
            'reviewers': UserSerializer(conf.reviewers.all(), many=True).data,
            'recent_submissions': SubmissionSerializer(
                submissions.order_by('-created_at')[:5], 
                many=True, 
                context={'request': request}
            ).data,
            'all_submissions': SubmissionSerializer(
                submissions, 
                many=True, 
                context={'request': request}
            ).data
        })
    
    total_stats = {
        'total_conferences': conferences.count(),
        'active_conferences': conferences.filter(
            submission_deadline__gte=timezone.now().date()
        ).count(),
        'total_submissions': Submission.objects.filter(
            conference__organizer=user,
            is_latest=True
        ).count(),
        'total_accepted': Submission.objects.filter(
            conference__organizer=user,
            status='ACCEPTED',
            is_latest=True
        ).count(),
    }
    
    return Response({
        'conferences': data,
        'statistics': total_stats
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_dashboard(request):
    user = request.user
    
    if user.role != 'ADMIN':
        return Response({"error": "Тільки адміністратор має доступ"}, status=403)

    users_stats = {
        'total': User.objects.count(),
        'authors': User.objects.filter(role='AUTHOR').count(),
        'reviewers': User.objects.filter(role='REVIEWER').count(),
        'pending_reviewers': User.objects.filter(role='REVIEWER', is_approved=False).count(),
        'admins': User.objects.filter(role='ADMIN').count(),
        'pending_reviewers_list': User.objects.filter(role='REVIEWER', is_approved=False).values(
            'id', 'username', 'email', 'first_name', 'last_name', 
            'affiliation', 'orcid_id', 'interests', 'date_joined'
        ).order_by('-date_joined'), 
    }

    now = timezone.now().date()
    conferences_stats = {
        'total': Conference.objects.count(),
        'active': Conference.objects.filter(submission_deadline__gte=now).count(),
        'past': Conference.objects.filter(event_date__lt=now).count(),
        'by_category': Conference.objects.values('category').annotate(
            count=db_models.Count('id')
        ),
    }

    submissions_stats = {
        'total': Submission.objects.filter(is_latest=True).count(),
        'pending': Submission.objects.filter(status='PENDING', is_latest=True).count(),
        'accepted': Submission.objects.filter(status='ACCEPTED', is_latest=True).count(),
        'rejected': Submission.objects.filter(status='REJECTED', is_latest=True).count(),
        'revision': Submission.objects.filter(status='REVISION_REQUIRED', is_latest=True).count(),
        'draft': Submission.objects.filter(status='DRAFT', is_latest=True).count(),
    }

    from discussion.models import Comment
    discussions_stats = {
        'total_comments': Comment.objects.filter(is_deleted=False).count(),
        'comments_today': Comment.objects.filter(
            created_at__date=timezone.now().date(),
            is_deleted=False
        ).count(),
    }

    recent_submissions = Submission.objects.filter(is_latest=True).select_related(
        'author', 'conference'
    ).order_by('-created_at')[:10]
    
    recent_users = User.objects.all().order_by('-date_joined')[:10]
    
    return Response({
        'users': users_stats,
        'conferences': conferences_stats,
        'submissions': submissions_stats,
        'discussions': discussions_stats,
        'recent_submissions': SubmissionSerializer(
            recent_submissions, 
            many=True, 
            context={'request': request}
        ).data,
        'recent_users': UserSerializer(recent_users, many=True).data,
    })

from django.db.models.signals import pre_save, post_delete
from django.dispatch import receiver

@receiver(pre_save, sender=User)
def delete_old_avatar_on_update(sender, instance, **kwargs):
    if not instance.pk:
        return
    
    try:
        old_instance = User.objects.get(pk=instance.pk)
    except User.DoesNotExist:
        return
    
    old_avatar = old_instance.avatar
    new_avatar = instance.avatar
    
    if old_avatar and old_avatar != new_avatar:
        if old_avatar.name != 'avatars/default.jpg': 
            old_avatar.delete(save=False)

@receiver(post_delete, sender=User)
def delete_avatar_on_user_delete(sender, instance, **kwargs):
    """Видаляє аватар при видаленні користувача"""
    if instance.avatar:
        instance.avatar.delete(save=False)