from django.contrib import admin
from .models import Conference


@admin.register(Conference)
class ConferenceAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'organizer', 'created_at')
    search_fields = ('title',)
    list_filter = ('category',)