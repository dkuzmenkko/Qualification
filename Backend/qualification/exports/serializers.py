from rest_framework import serializers
from .models import ExportHistory


class ExportHistorySerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    conference_title = serializers.CharField(source='conference.title', read_only=True)
    
    class Meta:
        model = ExportHistory
        fields = [
            'id', 'user', 'user_name', 'conference', 'conference_title',
            'export_type', 'file_name', 'created_at'
        ]
        read_only_fields = ['user', 'created_at']