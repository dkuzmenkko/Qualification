from django.contrib import admin
from .models import Submission


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ('title', 'conference', 'author', 'status')
    list_filter = ('status', 'conference')
    search_fields = ('title',)