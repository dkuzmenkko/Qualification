from django.urls import path
from . import views

urlpatterns = [
    path('submissions/<int:submission_id>/comments/', views.CommentListCreateView.as_view(), name='comment-list-create'),
    path('submissions/<int:submission_id>/comments/stats/', views.get_comments_stats, name='comment-stats'),
    path('comments/<int:pk>/', views.CommentDetailView.as_view(), name='comment-detail'),
    path('comments/<int:comment_id>/vote/', views.vote_comment, name='comment-vote'),
    path('comments/<int:comment_id>/replies/', views.get_comment_replies, name='comment-replies'),
]