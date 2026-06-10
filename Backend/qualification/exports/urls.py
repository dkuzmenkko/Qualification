# exports/urls.py

from django.urls import path
from . import views

urlpatterns = [
    path('conferences/<int:conference_id>/participants/',
         views.export_participants,
         name='export-participants'),
    
    path('conferences/<int:conference_id>/submissions/',
         views.export_submissions_list,
         name='export-submissions-list'),
    
    path('submissions/<int:submission_id>/pdf/',
         views.export_submission_pdf,
         name='export-submission-pdf'),
    
    path('history/',
         views.export_history,
         name='export-history'),
]