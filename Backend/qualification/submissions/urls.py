from django.urls import path
from . import views

urlpatterns = [
    path('', views.SubmissionListCreateView.as_view(), name='submission-list'),
    path('<int:pk>/', views.SubmissionDetailView.as_view(), name='submission-detail'),
    
    path('<int:pk>/submit/', views.submit_for_review, name='submit-for-review'),
    path('<int:pk>/review/', views.review_submission, name='review-submission'),

    path('<int:pk>/versions/', views.submission_versions, name='submission-versions'),
    path('<int:submission_id>/compare/<int:version1>/<int:version2>/', 
         views.compare_versions, 
         name='compare-versions'),

    path('dashboard/author/', views.author_dashboard, name='dashboard-author'),
    path('dashboard/reviewer/', views.reviewer_dashboard, name='dashboard-reviewer'),
    path('dashboard/organizer/', views.organizer_dashboard, name='dashboard-organizer'),
    path('dashboard/admin/', views.admin_dashboard, name='dashboard-admin'),
    path('accepted/', views.accepted_submissions, name='accepted-submissions'),
  
]