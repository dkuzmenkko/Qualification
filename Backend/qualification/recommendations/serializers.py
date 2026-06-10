from rest_framework import serializers
from conferences.serializers import ConferenceSerializer
from .models import UserAction, UserConferenceView


class UserActionSerializer(serializers.ModelSerializer):
    conference_title = serializers.CharField(source='conference.title', read_only=True)
    
    class Meta:
        model = UserAction
        fields = ['id', 'user', 'conference', 'conference_title', 'action_type', 'weight', 'created_at']
        read_only_fields = ['user', 'created_at']


class UserConferenceViewSerializer(serializers.ModelSerializer):
    conference = ConferenceSerializer(read_only=True)
    
    class Meta:
        model = UserConferenceView
        fields = ['id', 'user', 'conference', 'view_count', 'last_viewed']