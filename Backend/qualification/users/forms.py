from django import forms
from captcha.fields import CaptchaField
from django.contrib.auth.forms import UserCreationForm
from .models import User


class CustomUserCreationForm(UserCreationForm):
    captcha = CaptchaField(label='Код з картинки')
    
    class Meta:
        model = User
        fields = ('username', 'email', 'first_name', 'last_name', 'role')


class LoginForm(forms.Form):
    username = forms.CharField(max_length=150, label='Ім\'я користувача')
    password = forms.CharField(widget=forms.PasswordInput, label='Пароль')
    captcha = CaptchaField(label='Код з картинки')