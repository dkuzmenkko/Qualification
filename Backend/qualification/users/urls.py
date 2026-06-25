
from django.urls import path
from .views import (
    register_api,
    login_api,
    current_user,
    update_profile,
    UserListView,
    UserDetailView,
    approve_reviewer,
    get_categories,
    send_verification_code,
    verify_code,
    delete_user,
    get_captcha,
    delete_avatar
)

urlpatterns = [
    path('register/', register_api),
    path('login/', login_api),
    path('me/avatar/delete/', delete_avatar),  
    path('me/update/', update_profile),
    path('me/', current_user),
    
    path('list/', UserListView.as_view()),
    path('<int:pk>/', UserDetailView.as_view()),
    path('approve-reviewer/<int:user_id>/', approve_reviewer),
    path('categories/', get_categories),
    path('send-verification-code/', send_verification_code),
    path('verify-code/', verify_code),
    path('<int:user_id>/delete/', delete_user),
    path('captcha/', get_captcha),
]