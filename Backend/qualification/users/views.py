from rest_framework.response import Response
from django.contrib.auth import authenticate
from .serializers import CaptchaSerializer, LoginSerializer, RegisterSerializer, UserSerializer, UserUpdateSerializer, EmailVerificationSerializer, VerifyCodeSerializer, get_captcha_data
from .models import User
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.generics import ListAPIView, RetrieveUpdateAPIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from django.db import models
from rest_framework_simplejwt.tokens import RefreshToken


from django.core.mail import send_mail
from django.conf import settings
from .models import User
import logging

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([AllowAny])
def send_verification_code(request):
    """Відправляє код підтвердження на email"""
    print("=" * 50)
    print("SEND_VERIFICATION_CODE CALLED")
    print(f"Request data: {request.data}")
    
    serializer = EmailVerificationSerializer(data=request.data)
    
    if serializer.is_valid():
        email = serializer.validated_data['email']
        print(f"Valid email: {email}")
        all_users = User.objects.filter(email=email)
        print(f"All users with this email: {all_users.count()}")
        for u in all_users:
            print(f"  - User {u.id}: username={u.username}, verified={u.email_verified}")
        
        try:
            user = User.objects.filter(email=email, email_verified=False).first()
            print(f"Existing unverified user: {user}")
            
            if not user:
                print(f"Creating temporary user for {email}")
                temp_username = email.split('@')[0] + '_' + str(int(timezone.now().timestamp()))[-6:]
                print(f"Temporary username: {temp_username}")
                
                user = User.objects.create(
                    email=email,
                    username=temp_username,
                    email_verified=False,
                    role='AUTHOR',
                    is_active=True
                )
                print(f"Temporary user created: ID={user.id}, username={user.username}")
            else:
                print(f"Using existing unverified user: ID={user.id}, username={user.username}")
            code = user.generate_verification_code()
            print(f"Generated verification code: {code}")
            try:
                send_verification_email(email, code)
                print(f"Email sent to {email}")
                return Response({
                    "message": "Код підтвердження надіслано на email",
                    "email": email
                })
            except Exception as email_error:
                print(f"Email error: {email_error}")
                return Response(
                    {"error": f"Помилка при відправці email: {str(email_error)}"},
                    status=500
                )
                
        except Exception as e:
            print(f"General error: {e}")
            import traceback
            traceback.print_exc()
            return Response(
                {"error": f"Помилка сервера: {str(e)}"},
                status=500
            )
    
    print(f"Serializer errors: {serializer.errors}")
    return Response(serializer.errors, status=400)

@api_view(['POST'])
@permission_classes([AllowAny])
def verify_code(request):
    """Підтверджує код і повертає дані для реєстрації"""
    print("=" * 50)
    print("VERIFY_CODE CALLED")
    print(f"Request data: {request.data}")
    
    serializer = VerifyCodeSerializer(data=request.data)
    
    if serializer.is_valid():
        user = serializer.validated_data['user']
        print(f"User found: ID={user.id}, username={user.username}, verified={user.email_verified}")
        if user.email_verified:
            print("User already verified!")
            return Response(
                {"error": "Email вже підтверджено"},
                status=400
            )
        user.email_verified = True
        user.email_verification_code = None
        user.email_verification_created_at = None
        user.save(update_fields=['email_verified', 'email_verification_code', 'email_verification_created_at'])
        print(f"User marked as verified: {user.email_verified}")
        base_username = user.email.split('@')[0]
        username = base_username
        counter = 1
        
        while User.objects.filter(username=username, email_verified=True).exists():
            username = f"{base_username}{counter}"
            counter += 1
        
        print(f"Suggested username: {username}")
        
        return Response({
            "message": "Email успішно підтверджено",
            "email": user.email,
            "suggested_username": username
        })
    
    print(f"Serializer errors: {serializer.errors}")
    return Response(serializer.errors, status=400)

@api_view(['POST'])
@permission_classes([AllowAny])
def register_api(request):
    """Реєстрація нового користувача (після підтвердження email)"""
    print("=" * 50)
    print("REGISTER_API CALLED")
    print(f"Request data: {request.data}")
    
    serializer = RegisterSerializer(data=request.data)
    
    if serializer.is_valid():
        email = serializer.validated_data['email']
        print(f"Validated email: {email}")
        try:
            user = User.objects.get(email=email)
            print(f"Found user: {user.id}, username: {user.username}, email_verified: {user.email_verified}")
            
            if not user.email_verified:
                return Response(
                    {"error": "Email не підтверджено. Спочатку підтвердіть email."},
                    status=400
                )
        except User.DoesNotExist:
            print(f"User with email {email} not found")
            return Response(
                {"error": "Email не знайдено. Спочатку підтвердіть email."},
                status=400
            )
        new_username = serializer.validated_data['username']
        print(f"New username: {new_username}")
        
        if User.objects.filter(username=new_username).exclude(id=user.id).exists():
            return Response(
                {"error": f"Користувач з ім'ям '{new_username}' вже існує"},
                status=400
            )
        old_username = user.username
        print(f"Old username: {old_username}")
        user.first_name = serializer.validated_data.get('first_name', user.first_name)
        user.last_name = serializer.validated_data.get('last_name', user.last_name)
        user.middle_name = serializer.validated_data.get('middle_name', user.middle_name)
        user.role = serializer.validated_data.get('role', user.role)
        user.orcid_id = serializer.validated_data.get('orcid_id', user.orcid_id)
        user.affiliation = serializer.validated_data.get('affiliation', user.affiliation)
        user.interests = serializer.validated_data.get('interests', user.interests)
        user.username = new_username
        user.set_password(serializer.validated_data['password'])
        if user.role == 'REVIEWER':
            user.is_approved = False
        else:
            user.is_approved = True
        
        try:
            user.save()
            print(f"User saved successfully. New username: {user.username}")
        except Exception as e:
            print(f"Error saving user: {e}")
            return Response(
                {"error": f"Помилка збереження: {str(e)}"},
                status=500
            )
        refresh = RefreshToken.for_user(user)
        return Response({
            "message": "Реєстрація успішна",
            "role": user.role,
            "token": str(refresh.access_token),
            "refresh": str(refresh),
            "user": UserSerializer(user).data
        }, status=201)
    
    print(f"Serializer errors: {serializer.errors}")
    return Response(serializer.errors, status=400)

@api_view(['POST'])
@permission_classes([AllowAny])
def login_api(request):
    """Вхід в систему"""
    serializer = LoginSerializer(data=request.data)
    
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)
    
    username = request.data.get('username')
    password = request.data.get('password')
 
    user = authenticate(username=username, password=password)
 
    if user is None:
        return Response({"error": "Невірне ім'я користувача або пароль"}, status=400)
    if user.is_superuser:
        if user.role != 'ADMIN':
            user.role = 'ADMIN'
            user.save(update_fields=['role'])
        
        user.last_activity = timezone.now()
        user.save(update_fields=['last_activity'])
        
        refresh = RefreshToken.for_user(user)
        return Response({
            "message": "Успішний вхід (адміністратор)",
            "role": user.role,
            "token": str(refresh.access_token),
            "refresh": str(refresh),
            "user": UserSerializer(user, context={'request': request}).data
        })

    if not user.email_verified:
        return Response(
            {"error": "Email не підтверджено. Будь ласка, підтвердіть email перед входом."},
            status=403
        )

    if user.role == 'REVIEWER' and not user.is_approved:
        return Response({"error": "Ваш акаунт ще не підтверджений адміністратором"}, status=403)

    user.last_activity = timezone.now()
    user.save(update_fields=['last_activity'])
 
    refresh = RefreshToken.for_user(user)
    return Response({
        "message": "Успішний вхід",
        "role": user.role,
        "token": str(refresh.access_token),
        "refresh": str(refresh),
        "user": UserSerializer(user, context={'request': request}).data
    })


def send_verification_email(email, code):
    """Відправка email з кодом підтвердження"""
    subject = 'Підтвердження email для реєстрації'
    message = f"""
    Доброго дня!
    
    Ви отримали цей лист, оскільки ваш email був використаний для реєстрації в системі управління конференціями.
    
    Ваш код підтвердження: {code}
    
    Код дійсний протягом 5 хвилин.
    
    Якщо ви не реєструвалися в системі, проігноруйте цей лист.
    
    З повагою,
    Команда системи управління конференціями
    """
    
    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=False,
    )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    user = request.user
    return Response(UserSerializer(user, context={'request': request}).data)


class UserListView(ListAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = super().get_queryset()

        role = self.request.query_params.get('role')
        if role:
            queryset = queryset.filter(role=role)

        if self.request.user.role == 'ADMIN':
            is_approved = self.request.query_params.get('is_approved')
            if is_approved is not None:
                queryset = queryset.filter(is_approved=is_approved.lower() == 'true')

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                models.Q(username__icontains=search) |
                models.Q(first_name__icontains=search) |
                models.Q(last_name__icontains=search) |
                models.Q(email__icontains=search)
            )
        
        return queryset


class UserDetailView(RetrieveUpdateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    
def get_permissions(self):
    if self.request.method in ['PUT', 'PATCH']:
        obj = self.get_object()
        if obj != self.request.user and self.request.user.role != 'ADMIN':
            self.permission_classes = [IsAuthenticated]
            raise PermissionDenied("Тільки адміністратор може редагувати інших користувачів")
    return super().get_permissions()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def approve_reviewer(request, user_id):
    if request.user.role != 'ADMIN':
        return Response({"error": "Тільки адміністратор може підтверджувати рецензентів"}, status=403)
    
    try:
        user = User.objects.get(id=user_id, role='REVIEWER')
    except User.DoesNotExist:
        return Response({"error": "Рецензента не знайдено"}, status=404)
    
    user.is_approved = True
    user.save()

    from notifications.utils import create_notification
    create_notification(
        user,
        f"Ваш акаунт рецензента підтверджено! Тепер ви можете отримувати запрошення та створювати конференції.",
        type='GENERAL',
        send_email=True,
        send_push=True
    )
    
    return Response({"message": f"Рецензент {user.username} підтверджений"})


@api_view(['GET'])
@permission_classes([AllowAny])
def get_categories(request):
    return Response({
        "categories": [{"id": choice[0], "name": choice[1]} for choice in User.CATEGORY_CHOICES]
    })

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_user(request, user_id):
    """Видалення користувача (тільки для адміністратора)"""
    if request.user.role != 'ADMIN' and not request.user.is_superuser:
        return Response(
            {"error": "Тільки адміністратор може видаляти користувачів"}, 
            status=403
        )
    
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response(
            {"error": "Користувача не знайдено"}, 
            status=404
        )
    if user.id == request.user.id:
        return Response(
            {"error": "Ви не можете видалити власний акаунт"}, 
            status=400
        )
    if user.role == 'ADMIN' or user.is_superuser:
        return Response(
            {"error": "Не можна видаляти інших адміністраторів"}, 
            status=403
        )
    
    username = user.username
    user.delete()
    
    return Response({
        "message": f"Користувача {username} успішно видалено",
        "user_id": user_id
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def get_captcha(request):
    """Отримання captcha"""
    try:
        captcha_data = get_captcha_data()
        return Response(captcha_data)
    except Exception as e:
        return Response(
            {"error": f"Помилка генерації капчі: {str(e)}"},
            status=500
        )



@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_avatar(request):
    """Видалення аватара користувача"""
    user = request.user
    
    if user.avatar:
        user.avatar.delete(save=False)
        user.avatar = None
        user.save(update_fields=['avatar'])
        
        return Response({
            "message": "Аватар успішно видалено",
            "user": UserSerializer(user, context={'request': request}).data
        })
    
    return Response(
        {"error": "Аватар не знайдено"},
        status=404
    )

@api_view(['PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def update_profile(request):
    """Оновлення профілю користувача з підтримкою аватара"""
    user = request.user
    
    print("=" * 50)
    print(f"METHOD: {request.method}")
    print(f"Content-Type: {request.content_type}")
    print(f"FILES keys: {request.FILES.keys() if request.FILES else 'No files'}")
    print(f"POST keys: {request.POST.keys() if request.POST else 'No POST data'}")
    if request.method == 'PATCH' and request.FILES:
        data = {}
        for key, value in request.POST.items():
            data[key] = value
        for key, file in request.FILES.items():
            data[key] = file
        
        print(f"Processed data keys: {data.keys()}")
        print(f"Avatar file present: {'avatar' in data}")
        
        serializer = UserUpdateSerializer(user, data=data, partial=True, context={'request': request})
    else:
        serializer = UserUpdateSerializer(user, data=request.data, partial=(request.method == 'PATCH'), context={'request': request})
    
    if serializer.is_valid():
        updated_user = serializer.save()
        
        print(f"Avatar after save: {updated_user.avatar}")
        if updated_user.avatar:
            print(f"Avatar URL: {updated_user.avatar.url}")
        
        response_serializer = UserSerializer(updated_user, context={'request': request})
        return Response({
            "message": "Профіль успішно оновлено",
            "user": response_serializer.data
        })
    
    print(f"Serializer errors: {serializer.errors}")
    return Response(serializer.errors, status=400)
