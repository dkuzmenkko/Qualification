
from django.urls import path
from . import views
from .views import AssignReviewerView, InviteReviewerView, RespondInvitationView, RespondInvitationByConferenceView

urlpatterns = [
    path('', views.ConferenceList.as_view()),
    path('<int:pk>/', views.ConferenceDetail.as_view()),
    path('<int:pk>/assign-reviewer/', AssignReviewerView.as_view()),
    path('<int:pk>/invite-reviewer/', InviteReviewerView.as_view()),
    path('<int:pk>/submissions/', views.conference_submissions, name='conference-submissions'),
    path('<int:conference_id>/delete/', views.delete_conference, name='delete-conference'),  # Додаємо
    path('invitation/<int:invitation_id>/respond/', RespondInvitationView.as_view()),
    path('invitation/respond/', RespondInvitationByConferenceView.as_view(), name='respond-invitation-by-conference'),
    path('my-invitations/', views.my_invitations),
    path('<str:conference_id>/download-guidelines/', views.download_guidelines, name='download-guidelines'),
    path('<int:conference_id>/announcements/', views.conference_announcements, name='conference-announcements'),
    path('<int:conference_id>/announcements/create/', views.create_announcement, name='create-announcement'),
    path('<int:conference_id>/announcements/<int:announcement_id>/delete/', views.delete_announcement, name='delete-announcement'),
    path('<int:conference_id>/announcements/<int:announcement_id>/resend/', views.resend_announcement, name='resend-announcement'),
    
    path('invitation/<int:invitation_id>/respond/', RespondInvitationView.as_view()),
    path('invitation/respond/', RespondInvitationByConferenceView.as_view(), name='respond-invitation-by-conference'),
    path('my-invitations/', views.my_invitations),
    path('<str:conference_id>/download-guidelines/', views.download_guidelines, name='download-guidelines'),
]