from rest_framework import serializers
from users.models import User
from .models import UserProfile, ProfileView


class UserProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='user.full_name', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    role = serializers.CharField(source='user.get_role_display', read_only=True)
    avatar_url = serializers.SerializerMethodField()
    
    class Meta:
        model = UserProfile
        fields = [
            'id',
            'user',
            'full_name',
            'username',
            'role',
            'bio',
            'website',
            'linkedin',
            'github',
            'google_scholar',
            'is_profile_public',
            'show_email',
            'show_orcid',
            'profile_views',
            'created_at',
            'updated_at',
            'avatar_url',
        ]
        read_only_fields = ['profile_views', 'created_at', 'updated_at']
    
    def get_avatar_url(self, obj):
        if obj.user.avatar:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.user.avatar.url)
            return obj.user.avatar.url
        return None


class PublicUserSerializer(serializers.ModelSerializer):
    
    full_name = serializers.ReadOnlyField()
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    avatar_url = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'full_name',
            'role_display',
            'orcid_id',
            'affiliation',
            'interests',
            'last_activity',
            'avatar_url',
        ]
    
    def get_avatar_url(self, obj):
        if obj.avatar:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
        return None


class PublicProfileSerializer(serializers.Serializer):
    
    user = PublicUserSerializer()
    profile = UserProfileSerializer()
    stats = serializers.DictField()
    recent_submissions = serializers.ListField()
    organized_conferences = serializers.ListField()
    reviewed_submissions = serializers.ListField()
    
    def to_representation(self, instance):
        user = instance['user']
        profile = instance['profile']
        request = self.context.get('request')
        
        data = {
            'user': PublicUserSerializer(user, context={'request': request}).data,
            'profile': UserProfileSerializer(profile, context={'request': request}).data if profile else None,
        }
        
        if profile and profile.show_email:
            data['user']['email'] = user.email
        
        if profile and not profile.show_orcid:
            data['user'].pop('orcid_id', None)
        
        data['stats'] = instance.get('stats', {})
        
        data['recent_submissions'] = instance.get('recent_submissions', [])
        
        data['organized_conferences'] = instance.get('organized_conferences', [])
        
        data['reviewed_submissions'] = instance.get('reviewed_submissions', [])
        
        return data

class ProfileUpdateSerializer(serializers.ModelSerializer):
    
    class Meta:
        model = UserProfile
        fields = [
            'bio',
            'website',
            'linkedin',
            'github',
            'google_scholar',
            'is_profile_public',
            'show_email',
            'show_orcid',
        ]


class ProfileViewSerializer(serializers.ModelSerializer):
    
    viewer_name = serializers.CharField(source='viewer.full_name', read_only=True)
    viewer_username = serializers.CharField(source='viewer.username', read_only=True)
    
    class Meta:
        model = ProfileView
        fields = [
            'id',
            'viewer',
            'viewer_name',
            'viewer_username',
            'viewed_at',
        ]
        read_only_fields = ['viewed_at']


class SubmissionBriefSerializer(serializers.Serializer):
    
    id = serializers.IntegerField()
    title = serializers.CharField()
    conference_title = serializers.CharField()
    conference_date = serializers.CharField()
    created_at = serializers.CharField()


class ConferenceBriefSerializer(serializers.Serializer):
    
    id = serializers.IntegerField()
    title = serializers.CharField()
    conference_id = serializers.CharField()
    event_date = serializers.CharField()
    submission_deadline = serializers.CharField()


class ReviewedSubmissionSerializer(serializers.Serializer):
    
    id = serializers.IntegerField()
    title = serializers.CharField()
    author = serializers.CharField()
    conference_title = serializers.CharField()
    status = serializers.CharField()
    reviewed_at = serializers.CharField()