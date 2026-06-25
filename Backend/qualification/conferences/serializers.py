from rest_framework import serializers
from .models import Announcement, Conference, ReviewerInvitation
from users.serializers import UserSerializer  
from django.utils import timezone

class ConferenceSerializer(serializers.ModelSerializer):
    organizer = UserSerializer(read_only=True)
    reviewers = UserSerializer(read_only=True, many=True)
    guidelines_url = serializers.SerializerMethodField()
    guidelines_filename = serializers.SerializerMethodField()
    conference_type_display = serializers.CharField(source='get_conference_type_display', read_only=True)

    class Meta:
        model = Conference
        fields = [
            'id',
            'conference_id',
            'title',
            'description',
            'category',
            'event_date',
            'submission_deadline',
            'organizer',
            'reviewers',
            'created_at',
            'institution',
            'conference_type',
            'conference_type_display',
            'online_link',
            'address',
            'guidelines_file',
            'guidelines_url',
            'guidelines_filename',
            'additional_files',
        ]
        read_only_fields = ['id', 'conference_id', 'organizer', 'reviewers', 'created_at']

    def get_guidelines_url(self, obj):
        return obj.get_guidelines_url()
    
    def get_guidelines_filename(self, obj):
        return obj.get_guidelines_filename()
    

    def validate_title(self, value):
        """Валідація назви"""
        if not value or not value.strip():
            raise serializers.ValidationError("Назва конференції не може бути порожньою")
        if len(value.strip()) < 3:
            raise serializers.ValidationError("Назва повинна містити хоча б 3 символи")
        return value.strip()

    def validate_category(self, value):
        """Валідація категорії"""
        valid_categories = [choice[0] for choice in Conference.CATEGORY_CHOICES]
        if value not in valid_categories:
            raise serializers.ValidationError(
                f"Невірна категорія. Доступні: {', '.join(valid_categories)}"
            )
        return value

    def validate(self, data):
        event_date = data.get('event_date')
        submission_deadline = data.get('submission_deadline')
        
        if submission_deadline and event_date:
            if submission_deadline > event_date:
                raise serializers.ValidationError(
                    "Дедлайн подачі не може бути пізніше дати проведення"
                )
        
        if submission_deadline and submission_deadline < timezone.now().date():
            raise serializers.ValidationError(
                "Дедлайн не може бути в минулому"
            )
        

        conference_type = data.get('conference_type')
        online_link = data.get('online_link')
        
        if conference_type in ['ONLINE', 'HYBRID'] and not online_link:
            raise serializers.ValidationError({
                'online_link': "Для онлайн або гібридної конференції обов'язково вкажіть посилання"
            })
        if conference_type in ['OFFLINE', 'HYBRID']:
            address = data.get('address')
            if not address:
                raise serializers.ValidationError({
                    'address': "Для офлайн або гібридної конференції обов'язково вкажіть адресу"
                })

        guidelines_file = data.get('guidelines_file')
        if guidelines_file:
            import os
            ext = os.path.splitext(guidelines_file.name)[1].lower()
            if ext not in ['.pdf', '.doc', '.docx']:
                raise serializers.ValidationError({
                    'guidelines_file': "Дозволені формати: PDF, DOC, DOCX"
                })
            
            if guidelines_file.size > 10 * 1024 * 1024:
                raise serializers.ValidationError({
                    'guidelines_file': "Розмір файлу не повинен перевищувати 10MB"
                })
        
        return data

class ReviewerInvitationSerializer(serializers.ModelSerializer):
    reviewer = UserSerializer(read_only=True)
    conference = ConferenceSerializer(read_only=True)

    class Meta:
        model = ReviewerInvitation
        fields = ['id', 'conference', 'reviewer', 'status', 'created_at']

class AnnouncementSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    recipient_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Announcement
        fields = [
            'id', 'conference', 'title', 'content', 
            'send_email', 'send_push', 'sent_to_count', 
            'created_by', 'created_by_name', 'created_by_username',
            'created_at', 'sent_at', 'recipient_count'
        ]
        read_only_fields = ['sent_to_count', 'created_at', 'sent_at', 'created_by']
    
    def get_recipient_count(self, obj):
        return len(obj.get_recipients())


class AnnouncementCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Announcement
        fields = ['title', 'content', 'send_email', 'send_push']