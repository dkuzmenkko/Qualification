
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from django.http import HttpResponse 
from django.shortcuts import get_object_or_404
from django.utils import timezone
from conferences.models import Conference
from submissions.models import Submission
from .services import ExcelExporter, PDFExporter
from .models import ExportHistory


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_participants(request, conference_id):
    """
    Експорт учасників конференції у форматі Excel
    """
    conference = get_object_or_404(Conference, id=conference_id)
    user = request.user
    if conference.organizer != user and user.role != 'ADMIN':
        raise PermissionDenied("Тільки організатор може експортувати учасників")
    
    try:
        submissions = Submission.objects.filter(
            conference=conference,
            is_latest=True
        ).select_related('author', 'reviewer').order_by('-created_at')
        
        print(f"Exporting participants for conference {conference.id}, found {submissions.count()} submissions")
        excel_file = ExcelExporter.export_participants(conference, submissions)
        ExportHistory.objects.create(
            user=user,
            conference=conference,
            export_type='PARTICIPANTS',
            file_name=f"participants_{conference.conference_id}_{timezone.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        )
        response = HttpResponse(
            excel_file.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="participants_{conference.conference_id}.xlsx"'
        
        return response
        
    except Exception as e:
        print(f"Error exporting participants: {e}")
        import traceback
        traceback.print_exc()
        return Response(
            {"error": f"Помилка при експорті: {str(e)}"},
            status=500
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_submissions_list(request, conference_id):
    """
    Експорт списку тез конференції у форматі Excel
    """
    conference = get_object_or_404(Conference, id=conference_id)
    user = request.user
    if conference.organizer != user and user.role != 'ADMIN':
        raise PermissionDenied("Тільки організатор може експортувати список тез")
    
    try:
        submissions = Submission.objects.filter(
            conference=conference,
            is_latest=True
        ).select_related('author', 'reviewer').order_by('-created_at')
        
        print(f"Exporting submissions for conference {conference.id}, found {submissions.count()} submissions")
        excel_file = ExcelExporter.export_submissions_list(conference, submissions)
        ExportHistory.objects.create(
            user=user,
            conference=conference,
            export_type='SUBMISSIONS',
            file_name=f"submissions_{conference.conference_id}_{timezone.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        )
        response = HttpResponse(
            excel_file.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="submissions_{conference.conference_id}.xlsx"'
        
        return response
        
    except Exception as e:
        print(f"Error exporting submissions: {e}")
        import traceback
        traceback.print_exc()
        return Response(
            {"error": f"Помилка при експорті: {str(e)}"},
            status=500
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_submission_pdf(request, submission_id):
    """
    Експорт окремої тези у форматі PDF
    """
    submission = get_object_or_404(Submission, id=submission_id, is_latest=True)
    user = request.user
    if (submission.author != user and
        submission.reviewer != user and
        submission.conference.organizer != user and
        user.role != 'ADMIN'):
        raise PermissionDenied("У вас немає прав для експорту цієї тези")
    
    try:
        response = PDFExporter.export_submission_pdf(submission)
        
        ExportHistory.objects.create(
            user=user,
            conference=submission.conference,
            export_type='SUBMISSION_PDF',
            file_name=f"thesis_{submission.id}_{timezone.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        )
        
        return response
        
    except Exception as e:
        print(f"Error exporting submission PDF: {e}")
        import traceback
        traceback.print_exc()
        return Response(
            {"error": f"Помилка при експорті PDF: {str(e)}"},
            status=500
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_history(request):
    """
    Історія експортів користувача
    """
    history = ExportHistory.objects.filter(user=request.user).order_by('-created_at')[:50]
    
    data = []
    for exp in history:
        data.append({
            'id': exp.id,
            'export_type': exp.get_export_type_display(),
            'conference_title': exp.conference.title if exp.conference else None,
            'conference_id': exp.conference.conference_id if exp.conference else None,
            'file_name': exp.file_name,
            'created_at': exp.created_at.strftime('%d.%m.%Y %H:%M')
        })
    
    return Response(data)