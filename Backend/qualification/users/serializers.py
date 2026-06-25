from rest_framework import serializers
from .models import User
from captcha.models import CaptchaStore
from captcha.helpers import captcha_image_url

class EmailVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField()
    
    def validate_email(self, value):
        user = User.objects.filter(email=value, email_verified=True).first()
        
        if user:
            raise serializers.ValidationError("Цей email вже зареєстровано та підтверджено")
        
        return value

class VerifyCodeSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=6)
    
    def validate(self, data):
        try:
            user = User.objects.get(email=data['email'])
        except User.DoesNotExist:
            raise serializers.ValidationError("Email не знайдено. Спочатку отримайте код підтвердження.")
        
        if user.email_verified:
            raise serializers.ValidationError("Email вже підтверджено")
        
        if not user.is_verification_code_valid(data['code']):
            raise serializers.ValidationError("Невірний або прострочений код підтвердження")
        
        data['user'] = user
        return data

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)
    captcha_key = serializers.CharField(write_only=True)
    captcha_response = serializers.CharField(write_only=True)
 
    class Meta:
        model = User
        fields = [
            'username',
            'email',
            'first_name',
            'last_name',
            'middle_name',
            'role',
            'orcid_id',
            'affiliation',
            'interests',
            'password',
            'confirm_password',
            'captcha_key',
            'captcha_response',
        ]
 
    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "Паролі не співпадають"})
        
        captcha_key = data.get('captcha_key')
        captcha_response = data.get('captcha_response')
        
        if captcha_key and captcha_response:
            try:
                captcha = CaptchaStore.objects.get(hashkey=captcha_key)
                if captcha.response != captcha_response.lower():
                    raise serializers.ValidationError({"captcha": "Невірний код з картинки"})
                if captcha.expiration:
                    from django.utils import timezone
                    if captcha.expiration < timezone.now():
                        raise serializers.ValidationError({"captcha": "Код застарів"})
                captcha.delete()
            except CaptchaStore.DoesNotExist:
                raise serializers.ValidationError({"captcha": "Невірний ключ капчі"})
        else:
            raise serializers.ValidationError({"captcha": "Будь ласка, введіть код з картинки"})

        orcid_id = data.get('orcid_id')
        if orcid_id and len(orcid_id) != 19:
            raise serializers.ValidationError({"orcid_id": "ORCID ID повинен мати формат 0000-0000-0000-0000"})

        interests = data.get('interests', [])
        valid_categories = [choice[0] for choice in User.CATEGORY_CHOICES]
        for interest in interests:
            if interest not in valid_categories:
                raise serializers.ValidationError({"interests": f"Невірна категорія: {interest}"})
        
        return data

    def create(self, validated_data):
        validated_data.pop('confirm_password', None)
        validated_data.pop('captcha_key', None)
        validated_data.pop('captcha_response', None)
        
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            middle_name=validated_data.get('middle_name'),
            role=validated_data.get('role', 'AUTHOR'),
            orcid_id=validated_data.get('orcid_id'),
            affiliation=validated_data.get('affiliation'),
            interests=validated_data.get('interests', []),
            password=validated_data['password']
        )

        if user.role == 'REVIEWER':
            user.is_approved = False
        else:
            user.is_approved = True

        user.save()
        return user

class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()
    captcha_key = serializers.CharField()
    captcha_response = serializers.CharField()
    
    def validate(self, data):
        captcha_key = data.get('captcha_key')
        captcha_response = data.get('captcha_response')
        
        if captcha_key and captcha_response:
            try:
                captcha = CaptchaStore.objects.get(hashkey=captcha_key)
                if captcha.response != captcha_response.lower():
                    raise serializers.ValidationError({"captcha": "Невірний код з картинки"})
                if captcha.expiration:
                    from django.utils import timezone
                    if captcha.expiration < timezone.now():
                        raise serializers.ValidationError({"captcha": "Код застарів"})
                captcha.delete()
            except CaptchaStore.DoesNotExist:
                raise serializers.ValidationError({"captcha": "Невірний ключ капчі"})
        else:
            raise serializers.ValidationError({"captcha": "Будь ласка, введіть код з картинки"})
        
        return data

class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()
    avatar_url = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'middle_name',
            'full_name',
            'role',
            'is_approved',
            'orcid_id',
            'affiliation',
            'interests',
            'receive_email_notifications',
            'receive_push_notifications',
            'last_activity',
            'email_verified',
            'is_superuser',
            'is_staff',
            'avatar',
            'avatar_url',
        ]
        read_only_fields = ['last_activity', 'email_verified', 'is_superuser', 'is_staff']
    
    def get_avatar_url(self, obj):
        if obj.avatar:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
        return None
    
    def to_representation(self, instance):
        representation = super().to_representation(instance)
        
        interests = representation.get('interests')
        if interests is None:
            representation['interests'] = []
        elif isinstance(interests, str):
            try:
                import json
                parsed = json.loads(interests)
                representation['interests'] = parsed if isinstance(parsed, list) else []
            except:
                representation['interests'] = []
        elif not isinstance(interests, list):
            representation['interests'] = []
        
        return representation

class UserUpdateSerializer(serializers.ModelSerializer):
    
    class Meta:
        model = User
        fields = [
            'first_name',
            'last_name',
            'middle_name',
            'email',
            'orcid_id',
            'affiliation',
            'interests',
            'receive_email_notifications',
            'receive_push_notifications',
            'avatar',
        ]
    
    def validate_avatar(self, value):
        if value:
            if value.size > 2 * 1024 * 1024:
                raise serializers.ValidationError("Розмір фото не повинен перевищувати 2MB")
            
            allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
            if value.content_type not in allowed_types:
                raise serializers.ValidationError("Дозволені формати: JPEG, PNG, GIF, WEBP")
        return value
    
    def update(self, instance, validated_data):
        avatar = validated_data.pop('avatar', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        if avatar is not None:
            if instance.avatar:
                instance.avatar.delete(save=False)
            instance.avatar = avatar
        elif 'avatar' in self.initial_data and self.initial_data.get('avatar') == '':
            if instance.avatar:
                instance.avatar.delete(save=False)
            instance.avatar = None
        
        instance.save()
        return instance
    
    def validate_interests(self, value):
        if isinstance(value, str):
            try:
                import json
                value = json.loads(value)
            except:
                value = []
        
        if not isinstance(value, list):
            value = []
        
        valid_categories = [choice[0] for choice in User.CATEGORY_CHOICES]
        for interest in value:
            if interest not in valid_categories:
                raise serializers.ValidationError(f"Невірна категорія: {interest}")
        
        return value
    
    def to_internal_value(self, data):
        mutable_data = data.copy() if hasattr(data, 'copy') else dict(data)
        
        if 'interests' in mutable_data and isinstance(mutable_data['interests'], str):
            try:
                import json
                mutable_data['interests'] = json.loads(mutable_data['interests'])
            except:
                mutable_data['interests'] = []
        
        return super().to_internal_value(mutable_data)

class CaptchaSerializer(serializers.Serializer):
    key = serializers.CharField()
    image_url = serializers.CharField()
    
    def to_representation(self, instance):
        return super().to_representation(instance)

def get_captcha_data():
    captcha_key = CaptchaStore.generate_key()
    return {
        'key': captcha_key,
        'image_url': captcha_image_url(captcha_key)
    }

class CaptchaValidateSerializer(serializers.Serializer):
    key = serializers.CharField()
    response = serializers.CharField()
    
    def validate(self, data):
        try:
            captcha = CaptchaStore.objects.get(hashkey=data['key'])
            if captcha.response != data['response'].lower():
                raise serializers.ValidationError("Невірний код з картинки")
            if captcha.expiration:
                from django.utils import timezone
                if captcha.expiration < timezone.now():
                    raise serializers.ValidationError("Код застарів")
            captcha.delete()
        except CaptchaStore.DoesNotExist:
            raise serializers.ValidationError("Невірний ключ капчі")
        
        return data