from django.db import models as db_models
from users.models import User
from users.serializers import UserSerializer
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from conferences.models import Conference
from conferences.serializers import ConferenceSerializer
from submissions.models import Submission
from .services import RecommendationService, UserActivityTracker
from .serializers import UserActionSerializer
from submissions.serializers import SubmissionSerializer 

class RecommendationsView(generics.ListAPIView):
    
    serializer_class = ConferenceSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        limit = int(self.request.query_params.get('limit', 10))
        
        recommendations = RecommendationService.get_recommendations(user, limit)
        return recommendations


class SimilarConferencesView(generics.ListAPIView):
    
    serializer_class = ConferenceSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        conference_id = self.kwargs.get('conference_id')
        try:
            conference = Conference.objects.get(id=conference_id)
        except Conference.DoesNotExist:
            return Conference.objects.none()
        
        limit = int(self.request.query_params.get('limit', 5))
        return RecommendationService.get_similar_conferences(conference, limit)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def track_conference_view(request, conference_id):
    try:
        conference = Conference.objects.get(id=conference_id)
    except Conference.DoesNotExist:
        return Response({"error": "Конференцію не знайдено"}, status=404)
    
    UserActivityTracker.track_view(request.user, conference)
    return Response({"message": "Перегляд відстежено"})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def track_favorite(request, conference_id):
    try:
        conference = Conference.objects.get(id=conference_id)
    except Conference.DoesNotExist:
        return Response({"error": "Конференцію не знайдено"}, status=404)
    
    UserActivityTracker.track_action(request.user, conference, 'FAVORITE')
    return Response({"message": "Відстежено"})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_activity(request):
    from .models import UserAction
    
    limit = int(request.query_params.get('limit', 20))
    actions = UserAction.objects.filter(
        user=request.user
    ).select_related('conference')[:limit]
    
    serializer = UserActionSerializer(actions, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def trending_conferences(request):
    from django.db.models import Count
    
    trending = Conference.objects.filter(
        submission_deadline__gte=timezone.now().date()
    ).annotate(
        activity_count=Count('actions') + Count('views')
    ).order_by('-activity_count')[:10]
    
    serializer = ConferenceSerializer(trending, many=True)
    return Response(serializer.data)



@api_view(['GET'])
@permission_classes([IsAuthenticated])
def recommended_discussions(request):
    user = request.user
    
    try:
        if user.interests:
            accepted_submissions = Submission.objects.filter(
                status='ACCEPTED',
                conference__category__in=user.interests,
                conference__event_date__gte=timezone.now().date()
            ).select_related('conference', 'author').order_by('-created_at')[:10]
        else:
            accepted_submissions = Submission.objects.filter(
                status='ACCEPTED',
                conference__event_date__gte=timezone.now().date()
            ).order_by('-created_at')[:10]
        
        serializer = SubmissionSerializer(accepted_submissions, many=True, context={'request': request})
        return Response(serializer.data)
    
    except Exception as e:
        print(f"Error in recommended_discussions: {e}")
        return Response(
            {"error": str(e), "detail": "Помилка при отриманні рекомендацій обговорень"},
            status=500
        )
    

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def global_search(request):
    
    query = request.query_params.get('q', '')
    search_type = request.query_params.get('type', 'all')  
    limit = int(request.query_params.get('limit', 10))
    
    if not query or len(query) < 2:
        return Response({
            'error': 'Введіть хоча б 2 символи для пошуку'
        }, status=400)
    
    results = {}
    
    if search_type in ['all', 'conferences']:
        conferences = Conference.objects.filter(
            db_models.Q(title__icontains=query) |
            db_models.Q(description__icontains=query) |
            db_models.Q(conference_id__icontains=query)
        ).filter(
            submission_deadline__gte=timezone.now().date()
        ).order_by('-created_at')[:limit]
        
        results['conferences'] = ConferenceSerializer(conferences, many=True).data
    
    if search_type in ['all', 'submissions']:
        submissions = Submission.objects.filter(
            db_models.Q(title__icontains=query) |
            db_models.Q(abstract__icontains=query)
        ).filter(
            is_latest=True,
            status='ACCEPTED'  # Тільки прийняті тези
        ).select_related('author', 'conference')[:limit]
        
        results['submissions'] = SubmissionSerializer(
            submissions, 
            many=True, 
            context={'request': request}
        ).data
    
    if search_type in ['all', 'users'] and request.user.role in ['ADMIN', 'REVIEWER']:
        users = User.objects.filter(
            db_models.Q(username__icontains=query) |
            db_models.Q(first_name__icontains=query) |
            db_models.Q(last_name__icontains=query) |
            db_models.Q(email__icontains=query) |
            db_models.Q(orcid_id__icontains=query)
        )[:limit]
        
        results['users'] = UserSerializer(users, many=True).data
    
    return Response({
        'query': query,
        'type': search_type,
        'results': results
    })