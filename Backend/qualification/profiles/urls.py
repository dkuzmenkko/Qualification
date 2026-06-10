from django.urls import path
from . import views

urlpatterns = [
    path('me/', views.MyProfileView.as_view(), name='my-profile'),
    path('user/<int:user_id>/', views.public_profile, name='public-profile'),
    path('user/<int:user_id>/stats/', views.profile_stats, name='profile-stats'),
    path('search/', views.search_users, name='search-users'),
]