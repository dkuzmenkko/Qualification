from rest_framework import serializers
from .models import Comment, CommentVote
from users.serializers import UserSerializer


class CommentVoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommentVote
        fields = ['id', 'user', 'comment', 'vote', 'created_at']
        read_only_fields = ['user', 'created_at']


class CommentSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    replies = serializers.SerializerMethodField()
    user_vote = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()
    
    class Meta:
        model = Comment
        fields = [
            'id',
            'submission',
            'author',
            'parent',
            'text',
            'rating',
            'likes_count',
            'dislikes_count',
            'replies_count',
            'created_at',
            'updated_at',
            'is_deleted',
            'replies',
            'user_vote',
            'can_edit',
            'can_delete'
        ]
        read_only_fields = [
            'submission', 
            'author', 
            'rating', 
            'likes_count', 
            'dislikes_count', 
            'replies_count',
            'created_at',
            'updated_at'
        ]
    
    def get_replies(self, obj):
        if obj.is_root:
            replies = obj.replies.filter(is_deleted=False).order_by('-rating', 'created_at')
            return CommentSerializer(replies, many=True, context=self.context).data
        return []
    
    def get_user_vote(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            try:
                vote = CommentVote.objects.get(
                    user=request.user,
                    comment=obj
                )
                return vote.vote
            except CommentVote.DoesNotExist:
                return None
        return None
    
    def get_can_edit(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.author == request.user and not obj.is_deleted
        return False
    
    def get_can_delete(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.author == request.user or request.user.role == 'ADMIN'
        return False


class CommentCreateSerializer(serializers.ModelSerializer):
    
    parent = serializers.PrimaryKeyRelatedField(
        queryset=Comment.objects.all(),
        required=False,
        allow_null=True
    )
    
    class Meta:
        model = Comment
        fields = ['text', 'parent']
    
    def validate_parent(self, value):
        if value:
            if value.is_deleted:
                raise serializers.ValidationError("Не можна відповідати на видалений коментар")
            submission_id = self.context.get('submission_id')
            if submission_id and value.submission_id != submission_id:
                raise serializers.ValidationError("Коментар належить іншій тезі")
        return value
    
    def validate_text(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Коментар не може бути порожнім")
        if len(value) > 5000:
            raise serializers.ValidationError("Коментар занадто довгий (макс. 5000 символів)")
        return value.strip()


class CommentUpdateSerializer(serializers.ModelSerializer):
    
    class Meta:
        model = Comment
        fields = ['text']
    
    def validate_text(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Коментар не може бути порожнім")
        if len(value) > 5000:
            raise serializers.ValidationError("Коментар занадто довгий (макс. 5000 символів)")
        return value.strip()