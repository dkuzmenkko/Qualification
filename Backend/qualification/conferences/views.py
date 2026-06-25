
from django.http import FileResponse, Http404 
from rest_framework import generics, permissions, status
from django.shortcuts import get_object_or_404
from submissions.models import Submission
from .serializers import AnnouncementCreateSerializer, AnnouncementSerializer, ConferenceSerializer, ReviewerInvitationSerializer
from rest_framework.exceptions import PermissionDenied
from rest_framework.views import APIView
from rest_framework.response import Response
from users.models import User
from rest_framework.permissions import IsAuthenticated, AllowAny 
from .models import Announcement, Conference, ReviewerInvitation
from rest_framework.decorators import api_view, permission_classes
from recommendations.services import UserActivityTracker

from conferences import serializers


class ConferenceDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = Conference.objects.all()
    serializer_class = ConferenceSerializer
    permission_classes = [AllowAny]

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        
        if request.user and request.user.is_authenticated:
            UserActivityTracker.track_view(request.user, instance)
 
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def perform_update(self, serializer):
        conference = self.get_object()
        user = self.request.user
        
        if not user.is_authenticated:
            raise PermissionDenied("Тільки авторизовані користувачі можуть редагувати конференцію")
        
        if conference.organizer != user and user.role != 'ADMIN':
            raise PermissionDenied("Тільки організатор може редагувати конференцію")

        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        
        if not user.is_authenticated:
            raise PermissionDenied("Тільки авторизовані користувачі можуть видаляти конференцію")
        
        if instance.organizer != user and user.role != 'ADMIN':
            raise PermissionDenied("Тільки організатор може видаляти конференцію")

        instance.delete()


class AssignReviewerView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        conference = Conference.objects.get(pk=pk)
        user = request.user

        if conference.organizer != user:
            raise PermissionDenied("Тільки організатор може призначати рецензентів")

        reviewer_id = request.data.get('reviewer_id')

        try:
            reviewer = User.objects.get(id=reviewer_id, role='REVIEWER', is_approved=True)
        except User.DoesNotExist:
            raise PermissionDenied("Невірний рецензент")

        conference.reviewers.add(reviewer)

        return Response({"message": "Рецензента призначено"})
 

class ConferenceList(generics.ListCreateAPIView):
    serializer_class = ConferenceSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        queryset = Conference.objects.all().order_by('-created_at')

        category = self.request.query_params.get('category')
        search = self.request.query_params.get('search')
        conf_id = self.request.query_params.get('conference_id')

        if category:
            queryset = queryset.filter(category=category)

        if search:
            queryset = queryset.filter(title__icontains=search)

        if conf_id:
            queryset = queryset.filter(conference_id=conf_id)

        return queryset

    def perform_create(self, serializer):
        if not self.request.user.is_authenticated:
            raise PermissionError("Тільки авторизовані користувачі можуть створювати конференції")

        user = self.request.user

        if user.role not in ['REVIEWER', 'ADMIN']:
            raise PermissionDenied("Тільки рецензенти та адміністратори можуть створювати конференції")
        if user.role == 'REVIEWER' and not user.is_approved:
            raise PermissionDenied("Ваш акаунт рецензента ще не підтверджений адміністратором")
 
        conference = serializer.save(organizer=user)
        conference.reviewers.add(user)

        from recommendations.services import UserActivityTracker
        UserActivityTracker.track_action(user, conference, 'SUBMIT')


class InviteReviewerView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            conference = Conference.objects.get(pk=pk)
        except Conference.DoesNotExist:
            return Response({"error": "Конференція не знайдена"}, status=status.HTTP_404_NOT_FOUND)

        user = request.user

        if conference.organizer != user:
            raise PermissionDenied("Тільки організатор може запрошувати рецензентів")

        reviewer_username = request.data.get('reviewer_username')
        if not reviewer_username:
            return Response({"error": "Не вказано reviewer_username"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            reviewer = User.objects.get(username=reviewer_username, role='REVIEWER', is_approved=True)
        except User.DoesNotExist:
            return Response({"error": "Невірний рецензент"}, status=status.HTTP_400_BAD_REQUEST)

        invitation, created = ReviewerInvitation.objects.get_or_create(
            conference=conference,
            reviewer=reviewer
        )
        if not created:
            return Response({"error": "Рецензент вже запрошений"}, status=status.HTTP_400_BAD_REQUEST)

        from notifications.utils import create_notification

        message = f"Ви отримали запрошення стати рецензентом конференції '{conference.title}'."
        create_notification(
            reviewer,
            message,
            type='REVIEW_INVITE',
            send_email=True,
            send_push=True)

        return Response({"message": "Запрошення створено, очікуємо підтвердження"})


class RespondInvitationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, invitation_id):
        user = request.user
        try:
            invitation = ReviewerInvitation.objects.get(id=invitation_id, reviewer=user)
        except ReviewerInvitation.DoesNotExist:
            return Response({"error": "Запрошення не знайдено"}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get('action')
        if action not in ['ACCEPT', 'REJECT']:
            return Response({"error": "Невірна дія"}, status=status.HTTP_400_BAD_REQUEST)

        if action == 'ACCEPT':
            invitation.status = 'ACCEPTED'
            invitation.save()
            invitation.conference.reviewers.add(user)
        else:
            invitation.status = 'REJECTED'
            invitation.save()

        return Response({"message": f"Ви {invitation.status.lower()}"})
 

class RespondInvitationByConferenceView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        conference_id = request.data.get('conference_id')
        action = request.data.get('action')

        if not conference_id:
            return Response({"error": "Не вказано conference_id"}, status=400)

        if action not in ['ACCEPT', 'REJECT']:
            return Response({"error": "Невірна дія"}, status=400)

        try:
            invitation = ReviewerInvitation.objects.get(
                conference_id=conference_id,
                reviewer=user
            )
        except ReviewerInvitation.DoesNotExist:
            return Response({"error": "Запрошення не знайдено"}, status=404)

        if action == 'ACCEPT':
            invitation.status = 'ACCEPTED'
            invitation.save()
            invitation.conference.reviewers.add(user)
        else:
            invitation.status = 'REJECTED'
            invitation.save()

        return Response({"message": f"Ви {invitation.status.lower()}"})
 

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_invitations(request):
    invitations = ReviewerInvitation.objects.filter(reviewer=request.user, status='PENDING')
    serializer = ReviewerInvitationSerializer(invitations, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def conference_submissions(request, pk):
    try:
        conference = Conference.objects.get(pk=pk)
    except Conference.DoesNotExist:
        return Response({"error": "Конференцію не знайдено"}, status=404)
    
    user = request.user
    
    if conference.organizer != user and user.role != 'ADMIN':
        return Response({"error": "Тільки організатор може переглядати всі тези"}, status=403)
    
    submissions = Submission.objects.filter(
        conference=conference,
        is_latest=True
    ).select_related('author', 'reviewer').order_by('-created_at')
    
    from submissions.serializers import SubmissionSerializer
    serializer = SubmissionSerializer(submissions, many=True, context={'request': request})
    
    return Response({
        'conference': ConferenceSerializer(conference).data,
        'submissions': serializer.data,
        'statistics': {
            'total': submissions.count(),
            'pending': submissions.filter(status='PENDING').count(),
            'accepted': submissions.filter(status='ACCEPTED').count(),
            'rejected': submissions.filter(status='REJECTED').count(),
            'revision': submissions.filter(status='REVISION_REQUIRED').count(),
            'draft': submissions.filter(status='DRAFT').count(),
        }
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def download_guidelines(request, conference_id):
    """Завантаження файлу інструкції через API"""
    conference = get_object_or_404(Conference, conference_id=conference_id)
    
    if not conference.guidelines_file:
        raise Http404("Файл інструкції не знайдено")
    return FileResponse(
        conference.guidelines_file.open('rb'),
        content_type='application/pdf',
        as_attachment=False
    )

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_conference(request, conference_id):
    if request.user.role != 'ADMIN' and not request.user.is_superuser:
        return Response(
            {"error": "Тільки адміністратор може видаляти конференції"}, 
            status=403
        )
    
    try:
        conference = Conference.objects.get(id=conference_id)
    except Conference.DoesNotExist:
        return Response(
            {"error": "Конференцію не знайдено"}, 
            status=404
        )
    
    title = conference.title
    conference.delete()
    
    return Response({
        "message": f"Конференцію {title} успішно видалено",
        "conference_id": conference_id
    })

from django.db import transaction
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def conference_announcements(request, conference_id):
    try:
        conference = Conference.objects.get(id=conference_id)
    except Conference.DoesNotExist:
        return Response({"error": "Конференцію не знайдено"}, status=404)
    if conference.organizer != request.user and request.user.role != 'ADMIN':
        return Response({"error": "Тільки організатор може переглядати оголошення"}, status=403)
    
    announcements = conference.announcements.all()
    serializer = AnnouncementSerializer(announcements, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_announcement(request, conference_id):
    try:
        conference = Conference.objects.get(id=conference_id)
    except Conference.DoesNotExist:
        return Response({"error": "Конференцію не знайдено"}, status=404)
    if conference.organizer != request.user and request.user.role != 'ADMIN':
        return Response({"error": "Тільки організатор може створювати оголошення"}, status=403)
    
    serializer = AnnouncementCreateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)
    
    with transaction.atomic():
        announcement = serializer.save(
            conference=conference,
            created_by=request.user
        )
        recipients = announcement.get_recipients()
        announcement.sent_to_count = len(recipients)
        announcement.sent_at = timezone.now()
        announcement.save(update_fields=['sent_to_count', 'sent_at'])
        from notifications.utils import create_notification
        
        for recipient in recipients:
            create_notification(
                recipient,
                f"Нове оголошення на конференції '{conference.title}': {announcement.title}\n\n{announcement.content[:200]}",
                type='GENERAL',
                send_email=announcement.send_email,
                send_push=announcement.send_push
            )
    
    return Response({
        "message": f"Оголошення створено та відправлено {announcement.sent_to_count} учасникам",
        "announcement": AnnouncementSerializer(announcement, context={'request': request}).data
    }, status=201)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_announcement(request, conference_id, announcement_id):
    """Видалити оголошення"""
    try:
        conference = Conference.objects.get(id=conference_id)
    except Conference.DoesNotExist:
        return Response({"error": "Конференцію не знайдено"}, status=404)
    
    if conference.organizer != request.user and request.user.role != 'ADMIN':
        return Response({"error": "Тільки організатор може видаляти оголошення"}, status=403)
    
    try:
        announcement = Announcement.objects.get(id=announcement_id, conference=conference)
    except Announcement.DoesNotExist:
        return Response({"error": "Оголошення не знайдено"}, status=404)
    
    announcement.delete()
    
    return Response({"message": "Оголошення видалено"})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def resend_announcement(request, conference_id, announcement_id):
    """Повторно відправити оголошення (наприклад, для нових учасників)"""
    try:
        conference = Conference.objects.get(id=conference_id)
    except Conference.DoesNotExist:
        return Response({"error": "Конференцію не знайдено"}, status=404)
    
    if conference.organizer != request.user and request.user.role != 'ADMIN':
        return Response({"error": "Тільки організатор може повторно відправляти оголошення"}, status=403)
    
    try:
        announcement = Announcement.objects.get(id=announcement_id, conference=conference)
    except Announcement.DoesNotExist:
        return Response({"error": "Оголошення не знайдено"}, status=404)
    
    recipients = announcement.get_recipients()
    
    from notifications.utils import create_notification
    
    for recipient in recipients:
        create_notification(
            recipient,
            f"Оновлення на конференції '{conference.title}': {announcement.title}\n\n{announcement.content[:200]}",
            type='GENERAL',
            send_email=announcement.send_email,
            send_push=announcement.send_push
        )
    
    return Response({
        "message": f"Оголошення повторно відправлено {len(recipients)} учасникам"
    })