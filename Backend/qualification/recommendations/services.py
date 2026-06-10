from django.db.models import Count
from django.utils import timezone
from datetime import timedelta
from conferences.models import Conference

from .models import UserAction, UserConferenceView


class RecommendationService:
    ACTION_WEIGHTS = {
        'SUBMIT': 5.0,   
        'FAVORITE': 3.0,  
        'COMMENT': 2.0,   
        'LIKE': 1.5,      
        'VIEW': 0.5,      
    }
    
    TIME_DECAY_DAYS = 90
    
    @classmethod
    def get_recommendations(cls, user, limit=10):
  
        recommendations = []
        
        if user.interests:
            category_recs = cls._get_category_based_recommendations(user, limit)
            recommendations.extend(category_recs)
        
        if len(recommendations) < limit:
            smart_recs = cls._get_smart_recommendations(user, limit - len(recommendations))
            recommendations.extend(smart_recs)
        
        if len(recommendations) < limit:
            popular_recs = cls._get_popular_recommendations(user, limit - len(recommendations))
            recommendations.extend(popular_recs)
        
        seen_ids = set()
        unique_recs = []
        for rec in recommendations:
            if rec.id not in seen_ids:
                seen_ids.add(rec.id)
                unique_recs.append(rec)
        
        return unique_recs[:limit]
    
    @classmethod
    def _get_category_based_recommendations(cls, user, limit):
        return Conference.objects.filter(
            category__in=user.interests,
            submission_deadline__gte=timezone.now().date()
        ).exclude(
            organizer=user
        ).annotate(
            relevance_score=Count('id')
        ).order_by('-created_at')[:limit]
    
    @classmethod
    def _get_smart_recommendations(cls, user, limit):
        cutoff_date = timezone.now() - timedelta(days=cls.TIME_DECAY_DAYS)
        
        category_scores = {}
        
        views = UserConferenceView.objects.filter(
            user=user,
            last_viewed__gte=cutoff_date
        ).select_related('conference')
        
        for view in views:
            category = view.conference.category
            if category not in category_scores:
                category_scores[category] = 0
            category_scores[category] += min(view.view_count * 0.3, 3.0)
        
        actions = UserAction.objects.filter(
            user=user,
            created_at__gte=cutoff_date,
            conference__isnull=False
        ).select_related('conference')
        
        for action in actions:
            category = action.conference.category
            weight = cls.ACTION_WEIGHTS.get(action.action_type, 1.0)
            
            days_ago = (timezone.now() - action.created_at).days
            decay_factor = max(0, 1 - (days_ago / cls.TIME_DECAY_DAYS))
            
            score = weight * decay_factor
            
            if category not in category_scores:
                category_scores[category] = 0
            category_scores[category] += score
        
        sorted_categories = sorted(category_scores.items(), key=lambda x: x[1], reverse=True)
        
        recommendations = []
        for category, score in sorted_categories:
            confs = Conference.objects.filter(
                category=category,
                submission_deadline__gte=timezone.now().date()
            ).exclude(
                organizer=user
            ).exclude(
                id__in=[c.id for c in recommendations]
            ).order_by('-created_at')[:max(2, limit - len(recommendations))]
            
            recommendations.extend(confs)
            
            if len(recommendations) >= limit:
                break
        
        return recommendations[:limit]
    
    @classmethod
    def _get_popular_recommendations(cls, user, limit):
        return Conference.objects.filter(
            submission_deadline__gte=timezone.now().date()
        ).exclude(
            organizer=user
        ).annotate(
            popularity=Count('submissions') + Count('views')
        ).order_by('-popularity')[:limit]
    
    @classmethod
    def get_similar_conferences(cls, conference, limit=5):
        return Conference.objects.filter(
            category=conference.category,
            submission_deadline__gte=timezone.now().date()
        ).exclude(
            id=conference.id
        ).order_by('-created_at')[:limit]


class UserActivityTracker:
    
    @staticmethod
    def track_view(user, conference):
        if not user or not user.is_authenticated or not conference:
            return
        
        try:
            view, created = UserConferenceView.objects.get_or_create(
                user=user,
                conference=conference
            )
            if not created:
                view.view_count += 1
                view.save()
            
            UserAction.objects.create(
                user=user,
                conference=conference,
                action_type='VIEW',
                weight=RecommendationService.ACTION_WEIGHTS['VIEW']
            )
        except Exception as e:
            print(f"Error tracking view: {e}")
    
    @staticmethod
    def track_action(user, conference, action_type):
        if not user or not user.is_authenticated or not conference:
            return
        
        try:
            weight = RecommendationService.ACTION_WEIGHTS.get(action_type, 1.0)
            
            UserAction.objects.create(
                user=user,
                conference=conference,
                action_type=action_type,
                weight=weight
            )
        except Exception as e:
            print(f"Error tracking action: {e}")
    
    @staticmethod
    def track_submission(user, conference):
        """Відстежує подачу тези"""
        if not user or not user.is_authenticated or not conference:
            return
        
        try:
            UserAction.objects.create(
                user=user,
                conference=conference,
                action_type='SUBMIT',
                weight=RecommendationService.ACTION_WEIGHTS['SUBMIT']
            )
        except Exception as e:
            print(f"Error tracking submission: {e}")