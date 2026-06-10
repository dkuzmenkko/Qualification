from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User


class CustomUserAdmin(UserAdmin):
    model = User
    
    list_display = (
        'username', 
        'email', 
        'full_name', 
        'role', 
        'is_approved', 
        'orcid_id',
        'affiliation',
        'is_staff'
    )
    
    list_filter = ('role', 'is_approved', 'is_staff')

    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Особисті дані', {
            'fields': (
                'email', 
                'first_name', 
                'last_name', 
                'middle_name',
                'orcid_id',
                'affiliation'
            )
        }),
        ('Налаштування', {
            'fields': (
                'interests',
                'receive_email_notifications',
                'receive_push_notifications'
            )
        }),
        ('Роль та права', {
            'fields': (
                'role', 
                'is_approved',
                'is_staff', 
                'is_superuser', 
                'groups', 
                'user_permissions'
            )
        }),

        ('Метадані', {
            'fields': ('date_joined',),  
            'classes': ('collapse',)
        }),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': (
                'username', 
                'email', 
                'first_name', 
                'last_name', 
                'middle_name',
                'orcid_id',
                'affiliation',
                'interests',
                'role', 
                'password1', 
                'password2'
            ),
        }),
    )
    
    search_fields = ('username', 'email', 'first_name', 'last_name', 'orcid_id')
    
    ordering = ('username',)
    
    readonly_fields = ('date_joined', 'last_login')  # Додаємо last_login як readonly
    
    def full_name(self, obj):
        return obj.full_name
    full_name.short_description = 'Повне ім\'я'


admin.site.register(User, CustomUserAdmin)