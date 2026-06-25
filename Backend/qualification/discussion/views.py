
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, NotFound
from django.db import transaction
from django.utils import timezone
from submissions.models import Submission
from .models import Comment, CommentVote
from .serializers import (
    CommentSerializer, 
    CommentCreateSerializer, 
    CommentUpdateSerializer,
)


class CommentListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CommentCreateSerializer
        return CommentSerializer
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['submission_id'] = self.kwargs['submission_id']
        context['request'] = self.request
        return context
    
    def get_queryset(self):
        submission_id = self.kwargs['submission_id']
        
        queryset = Comment.objects.filter(
            submission_id=submission_id,
            parent__isnull=True,
            is_deleted=False
        ).select_related('author').prefetch_related('replies')
        sort_by = self.request.query_params.get('sort', 'rating')
        
        if sort_by == 'rating':
            queryset = queryset.order_by('-rating', '-created_at')
        elif sort_by == 'newest':
            queryset = queryset.order_by('-created_at')
        elif sort_by == 'oldest':
            queryset = queryset.order_by('created_at')
        
        return queryset
    
    def perform_create(self, serializer):
        submission_id = self.kwargs['submission_id']
        
        try:
            submission = Submission.objects.get(id=submission_id)
        except Submission.DoesNotExist:
            raise NotFound("Тезу не знайдено")
        
        if submission.status != 'ACCEPTED':
            raise PermissionDenied("Коментувати можна тільки прийняті тези")
        
        if submission.conference.event_date < timezone.now().date():
            raise PermissionDenied("Конференція вже завершена, коментування закрито")
        
        comment = serializer.save(
            author=self.request.user,
            submission=submission
        )
        
        if comment.parent:
            comment.parent.replies_count = comment.parent.replies.filter(is_deleted=False).count()
            comment.parent.save(update_fields=['replies_count'])
        
        submission.comments_count = Comment.objects.filter(
            submission=submission,
            is_deleted=False
        ).count()
        submission.save(update_fields=['comments_count'])
        
        try:
            from recommendations.services import UserActivityTracker
            UserActivityTracker.track_action(
                self.request.user,
                submission.conference,
                'COMMENT'
            )
        except ImportError:
            pass
        
        if submission.author != self.request.user:
            try:
                from notifications.utils import create_notification
                create_notification(
                    submission.author,
                    f"{self.request.user.get_full_name() or self.request.user.username} прокоментував вашу тезу '{submission.title}'",
                    type='COMMENT',
                    send_email=True,
                    send_push=True
                )
            except ImportError:
                pass
        
        if comment.parent and comment.parent.author != self.request.user:
            try:
                from notifications.utils import create_notification
                create_notification(
                    comment.parent.author,
                    f"{self.request.user.get_full_name() or self.request.user.username} відповів на ваш коментар",
                    type='COMMENT_REPLY',
                    send_email=True,
                    send_push=True
                )
            except ImportError:
                pass


class CommentDetailView(generics.RetrieveUpdateDestroyAPIView):
    
    queryset = Comment.objects.all()
    permission_classes = [permissions.IsAuthenticated]
    
    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return CommentUpdateSerializer
        return CommentSerializer
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    def perform_update(self, serializer):
        comment = self.get_object()
        
        if comment.author != self.request.user:
            raise PermissionDenied("Тільки автор може редагувати коментар")
        
        if comment.is_deleted:
            raise PermissionDenied("Не можна редагувати видалений коментар")
        
        serializer.save()
    
    def perform_destroy(self, instance):
        comment = self.get_object()
        
        if comment.author != self.request.user and self.request.user.role != 'ADMIN':
            raise PermissionDenied("Ви не можете видалити цей коментар")
        
        comment.delete()
        
        if comment.parent:
            comment.parent.replies_count = comment.parent.replies.filter(is_deleted=False).count()
            comment.parent.save(update_fields=['replies_count'])
        
        comment.submission.comments_count = Comment.objects.filter(
            submission=comment.submission,
            is_deleted=False
        ).count()
        comment.submission.save(update_fields=['comments_count'])


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def vote_comment(request, comment_id):
    
    try:
        comment = Comment.objects.get(id=comment_id, is_deleted=False)
    except Comment.DoesNotExist:
        return Response({"error": "Коментар не знайдено"}, status=status.HTTP_404_NOT_FOUND)
    
    vote_value = request.data.get('vote')
    
    if vote_value not in [1, -1]:
        return Response(
            {"error": "Невірне значення голосу. Використовуйте 1 (лайк) або -1 (дизлайк)"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    user = request.user
    
    with transaction.atomic():
        vote, created = CommentVote.objects.get_or_create(
            user=user,
            comment=comment,
            defaults={'vote': vote_value}
        )
        
        if not created:
            if vote.vote == vote_value:
                vote.delete()
                message = "Голос скасовано"
                
                if vote_value == 1:
                    comment.likes_count -= 1
                else:
                    comment.dislikes_count -= 1
            else:
                old_vote = vote.vote
                vote.vote = vote_value
                vote.save()
                message = "Голос змінено"
                
                if old_vote == 1:
                    comment.likes_count -= 1
                else:
                    comment.dislikes_count -= 1
                
                if vote_value == 1:
                    comment.likes_count += 1
                else:
                    comment.dislikes_count += 1
        else:
            message = "Голос додано"
            
            if vote_value == 1:
                comment.likes_count += 1
            else:
                comment.dislikes_count += 1
        
        comment.rating = comment.likes_count - comment.dislikes_count
        comment.save(update_fields=['rating', 'likes_count', 'dislikes_count'])
        
        if vote_value == 1:
            try:
                from recommendations.services import UserActivityTracker
                UserActivityTracker.track_action(user, comment.submission.conference, 'LIKE')
            except ImportError:
                pass
        
        if comment.author != user:
            try:
                from notifications.utils import create_notification
                vote_text = "лайкнув" if vote_value == 1 else "дизлайкнув"
                create_notification(
                    comment.author,
                    f"{user.get_full_name() or user.username} {vote_text} ваш коментар",
                    type='VOTE',
                    send_email=False,
                    send_push=True
                )
            except ImportError:
                pass
    
    return Response({
        "message": message,
        "rating": comment.rating,
        "likes_count": comment.likes_count,
        "dislikes_count": comment.dislikes_count,
        "user_vote": vote_value if not (not created and vote_value == vote.vote) else None
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_comment_replies(request, comment_id):
    
    try:
        comment = Comment.objects.get(id=comment_id, is_deleted=False)
    except Comment.DoesNotExist:
        return Response({"error": "Коментар не знайдено"}, status=status.HTTP_404_NOT_FOUND)
    
    replies = comment.replies.filter(is_deleted=False).select_related('author')
    
    sort_by = request.query_params.get('sort', 'rating')
    if sort_by == 'rating':
        replies = replies.order_by('-rating', '-created_at')
    elif sort_by == 'newest':
        replies = replies.order_by('-created_at')
    elif sort_by == 'oldest':
        replies = replies.order_by('created_at')
    
    serializer = CommentSerializer(replies, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_comments_stats(request, submission_id):
    
    try:
        submission = Submission.objects.get(id=submission_id)
    except Submission.DoesNotExist:
        return Response({"error": "Тезу не знайдено"}, status=status.HTTP_404_NOT_FOUND)
    
    total_comments = Comment.objects.filter(
        submission=submission,
        is_deleted=False
    ).count()
    
    root_comments = Comment.objects.filter(
        submission=submission,
        parent__isnull=True,
        is_deleted=False
    ).count()
    
    replies = total_comments - root_comments
    
    top_comments = Comment.objects.filter(
        submission=submission,
        is_deleted=False
    ).order_by('-rating')[:5]
    
    top_serializer = CommentSerializer(top_comments, many=True, context={'request': request})
    
    return Response({
        "total_comments": total_comments,
        "root_comments": root_comments,
        "replies": replies,
        "top_comments": top_serializer.data
    })