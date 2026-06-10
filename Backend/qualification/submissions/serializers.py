# submissions/serializers.py

from django.utils import timezone
from rest_framework import serializers
from .models import Submission, VersionHistory, SubmissionView
from conferences.serializers import ConferenceSerializer


class VersionHistorySerializer(serializers.ModelSerializer):
    previous_version_title = serializers.CharField(
        source='previous_version.title',
        read_only=True
    )
    previous_version_version = serializers.IntegerField(
        source='previous_version.version',
        read_only=True
    )
    changed_by_name = serializers.CharField(
        source='changed_by.full_name',
        read_only=True
    )
 
    class Meta:
        model = VersionHistory
        fields = [
            'id',
            'change_comment',
            'changed_by',
            'changed_by_name',
            'created_at',
            'previous_version',
            'previous_version_title',
            'previous_version_version',
        ]
        read_only_fields = ['created_at']


# submissions/serializers.py

class SubmissionSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source='author.username', read_only=True)
    author_full_name = serializers.CharField(source='author.full_name', read_only=True)
    reviewer_username = serializers.CharField(source='reviewer.username', read_only=True, allow_null=True)
    reviewer_full_name = serializers.CharField(source='reviewer.full_name', read_only=True, allow_null=True)
    conference_title = serializers.CharField(source='conference.title', read_only=True)
    conference_detail = ConferenceSerializer(source='conference', read_only=True)
    file_url = serializers.SerializerMethodField()
    file_name = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()  # Додаємо поле
    can_view = serializers.SerializerMethodField()
    version_history = serializers.SerializerMethodField()
    has_newer_version = serializers.SerializerMethodField()
 
    class Meta:
        model = Submission
        fields = [
            'id',
            'title',
            'abstract',
            'file',
            'file_url',
            'file_name',
            'status',
            'author',
            'author_username',
            'author_full_name',
            'reviewer',
            'reviewer_username',
            'reviewer_full_name',
            'reviewer_comment',
            'conference',
            'conference_title',
            'conference_detail',
            'version',
            'is_latest',
            'parent_submission',
            'created_at',
            'updated_at',
            'submitted_at',
            'comments_count',
            'views_count',
            'can_edit',
            'can_delete',  # Додаємо
            'can_view',
            'version_history',
            'has_newer_version',
        ]
        read_only_fields = [
            'author',
            'reviewer',
            'status',
            'created_at',
            'updated_at',
            'version',
            'is_latest',
            'submitted_at',
            'comments_count',
            'views_count'
        ]
    
    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None
    
    def get_file_name(self, obj):
        return obj.get_file_name()
 
    def get_can_edit(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            return obj.can_edit(request.user)
        return False
    
    def get_can_delete(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            return obj.can_delete(request.user)
        return False
 
    def get_can_view(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            return obj.can_view(request.user)
        return False
 
    def get_version_history(self, obj):
        if not obj.is_latest and obj.parent_submission:
            root = obj.parent_submission
            while root.parent_submission:
                root = root.parent_submission
            history = VersionHistory.objects.filter(
                submission__in=root.versions.all()
            ).select_related('previous_version', 'changed_by')[:10]
        else:
            history = VersionHistory.objects.filter(
                submission=obj
            ).select_related('previous_version', 'changed_by')[:10]
 
        return VersionHistorySerializer(history, many=True).data
 
    def get_has_newer_version(self, obj):
        if obj.is_latest:
            return False
        return Submission.objects.filter(
            parent_submission=obj.parent_submission if obj.parent_submission else obj,
            is_latest=True
        ).exists()


class SubmissionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Submission
        fields = ['id', 'title', 'abstract', 'file', 'conference']  # Додаємо id в fields
        read_only_fields = ['id']  # ID тільки для читання
 
    def validate(self, data):
        conference = data.get('conference')
        
        if conference.submission_deadline < timezone.now().date():
            raise serializers.ValidationError(
                "Дедлайн подачі тез вже минув"
            )
        
        # Перевірка типу файлу
        file = data.get('file')
        if file:
            import os
            ext = os.path.splitext(file.name)[1].lower()
            if ext not in ['.pdf', '.doc', '.docx']:
                raise serializers.ValidationError({
                    'file': f"Недопустимий тип файлу. Дозволені: .pdf, .doc, .docx"
                })
            
            if file.size > 10 * 1024 * 1024:
                raise serializers.ValidationError({
                    'file': "Розмір файлу не повинен перевищувати 10MB"
                })
        
        # Перевірка назви
        title = data.get('title', '').strip()
        if not title:
            raise serializers.ValidationError({
                'title': "Назва тези обов'язкова"
            })
        
        return data
 
    def create(self, validated_data):
        validated_data['status'] = 'DRAFT'
        validated_data['version'] = 1
        validated_data['is_latest'] = True
        submission = super().create(validated_data)
        return submission


class SubmissionUpdateSerializer(serializers.ModelSerializer):
 
    change_comment = serializers.CharField(write_only=True, required=False, allow_blank=True)
 
    class Meta:
        model = Submission
        fields = ['title', 'abstract', 'file', 'change_comment']
 
    def validate(self, data):
        submission = self.instance
 
        if submission.status not in ['DRAFT', 'REVISION_REQUIRED']:
            raise serializers.ValidationError(
                "Не можна редагувати тезу після її відправлення на рецензію"
            )
        
        # Перевірка файлу
        file = data.get('file')
        if file:
            allowed_extensions = ['.pdf', '.doc', '.docx']
            import os
            ext = os.path.splitext(file.name)[1].lower()
            if ext not in allowed_extensions:
                raise serializers.ValidationError({
                    'file': f"Недопустимий тип файлу. Дозволені: {', '.join(allowed_extensions)}"
                })
            
            if file.size > 10 * 1024 * 1024:
                raise serializers.ValidationError({
                    'file': "Розмір файлу не повинен перевищувати 10MB"
                })
 
        return data
 
    def update(self, instance, validated_data):
        change_comment = validated_data.pop('change_comment', '')

        if instance.status == 'REVISION_REQUIRED':
            new_version = instance.create_new_version(
                title=validated_data.get('title', instance.title),
                abstract=validated_data.get('abstract', instance.abstract),
                file=validated_data.get('file', instance.file),
                comment=change_comment
            )
            return new_version
        else:
            for key, value in validated_data.items():
                setattr(instance, key, value)
            instance.save()
            return instance