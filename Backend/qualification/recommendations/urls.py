from django.urls import path
from . import views

urlpatterns = [
    path('', views.RecommendationsView.as_view(), name='recommendations'),
    path('trending/', views.trending_conferences, name='trending'),
    path('discussions/', views.recommended_discussions, name='recommended-discussions'),
    path('similar/<int:conference_id>/', views.SimilarConferencesView.as_view(), name='similar-conferences'),
    path('track-view/<int:conference_id>/', views.track_conference_view, name='track-view'),
    path('track-favorite/<int:conference_id>/', views.track_favorite, name='track-favorite'),
    path('my-activity/', views.my_activity, name='my-activity'),
    path('search/', views.global_search, name='global-search'),
]