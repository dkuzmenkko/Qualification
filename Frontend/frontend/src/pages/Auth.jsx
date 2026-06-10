// src/pages/Auth.js

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import api from '../services/api';
import CaptchaModal from '../components/CaptchaModal';
import '../styles/Auth.css';

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, refreshUser } = useAuth();
  const { success, error: showError, warning } = useNotification();
  
  const getInitialMode = () => {
    const path = location.pathname;
    if (path === '/register') return 'register';
    if (path === '/verify-email') return 'verify';
    return 'login';
  };
  
  const [mode, setMode] = useState(getInitialMode());
  const [loading, setLoading] = useState(false);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaAction, setCaptchaAction] = useState(null);
  
  // Логін
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Реєстрація
  const [registerStep, setRegisterStep] = useState('form');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [tempRegisterData, setTempRegisterData] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    middle_name: '',
    role: 'AUTHOR',
    orcid_id: '',
    affiliation: '',
    interests: [],
    password: '',
    confirm_password: '',
  });
  
  // Верифікація email
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyStep, setVerifyStep] = useState('email');

  const categories = [
    { id: 'MATH', name: 'Математика' },
    { id: 'CS', name: 'Інформатика' },
    { id: 'AI', name: 'Штучний інтелект' },
    { id: 'WEB', name: 'Веб-розробка' },
    { id: 'DATA', name: 'Аналіз даних' },
    { id: 'SECURITY', name: 'Кібербезпека' },
    { id: 'PHYSICS', name: 'Фізика' },
    { id: 'BIOLOGY', name: 'Біологія' },
    { id: 'CHEMISTRY', name: 'Хімія' },
  ];

  const changeMode = (newMode) => {
    setMode(newMode);
    if (newMode === 'login') {
      navigate('/login');
    } else if (newMode === 'register') {
      navigate('/register');
    } else if (newMode === 'verify') {
      navigate('/verify-email');
    }
  };

  // ==================== ЛОГІН ====================
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (!username || !password) {
      showError('Заповніть всі поля');
      return;
    }
    setCaptchaAction('login');
    setShowCaptcha(true);
  };

  const handleLoginVerify = async (captchaValue, captchaKey) => {
    setLoading(true);
    try {
      await login(username, password, captchaValue, captchaKey);
      
      const freshUser = await refreshUser();
      
      if (freshUser.role === 'REVIEWER') {
        if (!freshUser.is_approved) {
          warning('Ваш акаунт рецензента ще не підтверджено. Ви отримаєте сповіщення після підтвердження.', 5000);
        } else {
          success(`Ласкаво просимо, ${freshUser.full_name || freshUser.username}!`, 3000);
        }
      } else if (freshUser.role === 'ADMIN' || freshUser.is_superuser) {
        success(`Ласкаво просимо, Адміністратор!`, 3000);
      } else {
        success(`Ласкаво просимо, ${freshUser.full_name || freshUser.username}!`, 3000);
      }
      
      navigate('/');
    } catch (err) {
      const errorMessage = err.response?.data?.error || 
                          err.response?.data?.captcha || 
                          'Невірне ім\'я користувача або пароль';
      showError(errorMessage, 4000);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ==================== РЕЄСТРАЦІЯ - КРОК 1: Відправка коду ====================
  const handleRegisterChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleInterestToggle = (categoryId) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(categoryId)
        ? prev.interests.filter(i => i !== categoryId)
        : [...prev.interests, categoryId]
    }));
  };

  const handleRegisterFormSubmit = (e) => {
    e.preventDefault();
    if (!formData.email) {
      showError('Введіть email');
      return;
    }
    if (formData.password !== formData.confirm_password) {
      showError('Паролі не співпадають');
      return;
    }
    if (formData.password.length < 8) {
      showError('Пароль має містити мінімум 8 символів');
      return;
    }
    setCaptchaAction('register');
    setShowCaptcha(true);
  };

  const handleSendVerificationCode = async (captchaValue, captchaKey) => {
    setLoading(true);
    try {
      await api.post('/users/send-verification-code/', { 
        email: formData.email, 
        captcha_key: captchaKey, 
        captcha_response: captchaValue
      });
      success('Код підтвердження надіслано на email');
      setVerificationEmail(formData.email);
      setRegisterStep('verification');
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.response?.data?.captcha || 'Помилка при відправці коду';
      showError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
      setShowCaptcha(false);
    }
  };

  // ==================== РЕЄСТРАЦІЯ - КРОК 2: Перевірка коду та фінальна реєстрація ====================
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    if (!verificationCode || verificationCode.length !== 6) {
      showError('Введіть 6-значний код підтвердження');
      return;
    }
    
    // Зберігаємо дані для подальшого використання після капчі
    setTempRegisterData({
      formData,
      verificationEmail,
      verificationCode
    });
    
    // Відкриваємо капчу для фінальної реєстрації
    setCaptchaAction('finalRegister');
    setShowCaptcha(true);
  };

  const handleFinalRegisterWithCaptcha = async (captchaValue, captchaKey) => {
    setLoading(true);
    try {
      // Спочатку верифікуємо код
      await api.post('/users/verify-code/', { 
        email: tempRegisterData.verificationEmail, 
        code: tempRegisterData.verificationCode 
      });
      
      // Потім реєструємося з капчею
      const response = await register({
        ...tempRegisterData.formData,
        email: tempRegisterData.verificationEmail,
        captcha_key: captchaKey,
        captcha_response: captchaValue
      });
      
      if (response.role === 'REVIEWER') {
        success('Реєстрація успішна! Ваш акаунт рецензента очікує підтвердження адміністратором.', 5000);
      } else {
        success('Реєстрація успішна! Ласкаво просимо до системи.', 3000);
      }
      
      navigate('/');
    } catch (err) {
      const errors = err.response?.data;
      if (typeof errors === 'object') {
        const errorMessages = [];
        Object.entries(errors).forEach(([field, messages]) => {
          if (Array.isArray(messages)) {
            errorMessages.push(`${field}: ${messages.join(', ')}`);
          } else {
            errorMessages.push(`${field}: ${messages}`);
          }
        });
        showError(errorMessages.join('\n'), 5000);
      } else {
        showError('Помилка реєстрації. Спробуйте ще раз.', 4000);
      }
    } finally {
      setLoading(false);
      setShowCaptcha(false);
      setTempRegisterData(null);
    }
  };

  const handleResendCode = async () => {
    setLoading(true);
    try {
      await api.post('/users/send-verification-code/', { email: verificationEmail });
      success('Новий код надіслано на email');
    } catch (err) {
      showError(err.response?.data?.error || 'Помилка при відправці коду');
    } finally {
      setLoading(false);
    }
  };

  // ==================== ВЕРИФІКАЦІЯ EMAIL (ОКРЕМА) ====================
  const handleSendEmailVerificationCode = async (captchaValue, captchaKey) => {
    setLoading(true);
    try {
      await api.post('/users/send-verification-code/', { 
        email: verifyEmail,
        captcha_key: captchaKey, 
        captcha_response: captchaValue
      });
      success('Код підтвердження надіслано на email');
      setVerifyStep('code');
    } catch (err) {
      showError(err.response?.data?.error || 'Помилка при відправці коду');
      throw err;
    } finally {
      setLoading(false);
      setShowCaptcha(false);
    }
  };

  const handleSendEmailCodeSubmit = (e) => {
    e.preventDefault();
    if (!verifyEmail) {
      showError('Введіть email');
      return;
    }
    setCaptchaAction('verifyEmail');
    setShowCaptcha(true);
  };

  const handleVerifyEmailCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await api.post('/users/verify-code/', { email: verifyEmail, code: verifyCode });
      
      success('Email успішно підтверджено');
      
      setFormData(prev => ({ ...prev, email: response.data.email }));
      changeMode('register');
      setRegisterStep('form');
    } catch (err) {
      showError(err.response?.data?.error || 'Невірний код підтвердження');
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmailCode = async () => {
    setLoading(true);
    try {
      await api.post('/users/send-verification-code/', { email: verifyEmail });
      success('Новий код надіслано на email');
    } catch (err) {
      showError(err.response?.data?.error || 'Помилка при відправці коду');
    } finally {
      setLoading(false);
    }
  };

  // ==================== ЗАГАЛЬНА ОБРОБКА КАПЧІ ====================
  const handleCaptchaVerify = async (captchaValue, captchaKey) => {
    if (captchaAction === 'login') {
      await handleLoginVerify(captchaValue, captchaKey);
    } else if (captchaAction === 'register') {
      await handleSendVerificationCode(captchaValue, captchaKey);
    } else if (captchaAction === 'verifyEmail') {
      await handleSendEmailVerificationCode(captchaValue, captchaKey);
    } else if (captchaAction === 'finalRegister') {
      await handleFinalRegisterWithCaptcha(captchaValue, captchaKey);
    }
  };

  // ==================== UI КОМПОНЕНТИ ====================
  const getPanelTitle = () => {
    switch (mode) {
      case 'login':
        return 'З Поверненням!';
      case 'register':
        return registerStep === 'form' ? 'Створення акаунту' : 'Підтвердження email';
      case 'verify':
        return 'Верифікація email';
      default:
        return '';
    }
  };

  const getPanelDescription = () => {
    switch (mode) {
      case 'login':
        return 'Для продовження роботи потрібно увійти в свій акаунт.';
      case 'register':
        return registerStep === 'form' ? 'Заповніть форму для реєстрації' : 'Введіть отриманий код';
      case 'verify':
        return verifyStep === 'email' ? 'Підтвердіть email перед реєстрацією' : 'Введіть код підтвердження';
      default:
        return '';
    }
  };

  const renderLogin = () => (
    <form onSubmit={handleLoginSubmit} className="auth-form">
      <div className="auth-field">
        <label className="auth-label">Ім'я користувача</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          className="auth-input"
          placeholder="Введіть ім'я користувача"
        />
      </div>
      
      <div className="auth-field">
        <label className="auth-label">Пароль</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="auth-input"
          placeholder="Введіть пароль"
        />
      </div>
      
      <button 
        type="submit" 
        disabled={loading}
        className="auth-button auth-button-primary"
      >
        {loading ? 'Вхід...' : 'Увійти'}
      </button>
      
      <div className="auth-links">
        <button type="button" onClick={() => changeMode('register')} className="auth-link-text">
          Створити новий акаунт
        </button>
      </div>
    </form>
  );

  const renderRegisterForm = () => (
    <form onSubmit={handleRegisterFormSubmit} className="auth-register-form">
      <div className="auth-register-wrapper">
        <div className="auth-scrollable-fields">
          <div className="auth-field">
            <label className="auth-label">Email *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleRegisterChange}
              required
              placeholder="your@email.com"
              className="auth-input"
            />
          </div>
          
          <div className="auth-field">
            <label className="auth-label">Ім'я користувача *</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleRegisterChange}
              required
              className="auth-input"
              placeholder="Введіть ім'я користувача"
            />
          </div>
          
          <div className="auth-row">
            <div className="auth-field-half">
              <label className="auth-label">Прізвище *</label>
              <input 
                type="text" 
                name="last_name" 
                value={formData.last_name} 
                onChange={handleRegisterChange} 
                required 
                className="auth-input" 
                placeholder="Прізвище"
              />
            </div>
            <div className="auth-field-half">
              <label className="auth-label">Ім'я *</label>
              <input 
                type="text" 
                name="first_name" 
                value={formData.first_name} 
                onChange={handleRegisterChange} 
                required 
                className="auth-input" 
                placeholder="Ім'я"
              />
            </div>
          </div>
          
          <div className="auth-field">
            <label className="auth-label">По батькові</label>
            <input 
              type="text" 
              name="middle_name" 
              value={formData.middle_name} 
              onChange={handleRegisterChange} 
              className="auth-input" 
              placeholder="По батькові"
            />
          </div>
          
          <div className="auth-field">
            <label className="auth-label">Роль</label>
            <select 
              name="role" 
              value={formData.role} 
              onChange={handleRegisterChange} 
              className="auth-select"
            >
              <option value="AUTHOR">Автор (може подавати тези)</option>
              <option value="REVIEWER">Рецензент (може створювати конференції та рецензувати)</option>
            </select>
          </div>
          
          <div className="auth-field">
            <label className="auth-label">ORCID ID (0000-0000-0000-0000)</label>
            <input 
              type="text" 
              name="orcid_id" 
              value={formData.orcid_id} 
              onChange={handleRegisterChange} 
              placeholder="0000-0000-0000-0000" 
              className="auth-input" 
            />
          </div>
          
          <div className="auth-field">
            <label className="auth-label">Місце роботи/навчання</label>
            <input 
              type="text" 
              name="affiliation" 
              value={formData.affiliation} 
              onChange={handleRegisterChange} 
              className="auth-input" 
              placeholder="Назва установи"
            />
          </div>
          
          <div className="auth-field">
            <label className="auth-label">Цікаві категорії</label>
            <div className="auth-chips-group">
              {categories.map(cat => (
                <div
                  key={cat.id}
                  className={`auth-chip ${formData.interests.includes(cat.id) ? 'auth-chip-active' : ''}`}
                  onClick={() => handleInterestToggle(cat.id)}
                >
                  {cat.name}
                </div>
              ))}
            </div>
            <small className="auth-hint">Виберіть категорії, які вас цікавлять</small>
          </div>
          
          <div className="auth-field">
            <label className="auth-label">Пароль *</label>
            <input 
              type="password" 
              name="password" 
              value={formData.password} 
              onChange={handleRegisterChange} 
              required 
              className="auth-input" 
              placeholder="Мінімум 8 символів"
            />
          </div>
          
          <div className="auth-field">
            <label className="auth-label">Підтвердження пароля *</label>
            <input 
              type="password" 
              name="confirm_password" 
              value={formData.confirm_password} 
              onChange={handleRegisterChange} 
              required 
              className="auth-input" 
              placeholder="Повторіть пароль"
            />
          </div>
        </div>
        <div className="auth-sticky-footer">
          <button 
            type="submit" 
            disabled={loading}
            className="auth-button auth-button-primary"
          >
            Продовжити
          </button>
          
          <div className="auth-links">
            <button type="button" onClick={() => changeMode('login')} className="auth-link-text">
              Вже є акаунт? Увійти
            </button>
          </div>
        </div>
      </div>
    </form>
  );

  const renderRegisterVerification = () => (
    <form onSubmit={handleVerifyCode} className="auth-form">
      <p className="auth-subtitle">
        <span className="auth-email-text">На email </span>
        <span className="auth-email-highlight">{verificationEmail}</span>
        <span className="auth-email-text"> надіслано код підтвердження</span>
      </p>
      <div className="auth-field">
        <label className="auth-label">Код підтвердження *</label>
        <input 
          type="text" 
          value={verificationCode} 
          onChange={(e) => setVerificationCode(e.target.value)} 
          required 
          placeholder="Введіть 6-значний код" 
          maxLength="6" 
          className="auth-input auth-code-input"
        />
        <small className="auth-hint">Код дійсний протягом 5 хвилин</small>
      </div>
      
      <button 
        type="submit" 
        disabled={loading || verificationCode.length !== 6} 
        className="auth-button auth-button-primary"
      >
        {loading ? 'Перевірка...' : 'Зареєструватися'}
      </button>
      
      <button 
        type="button" 
        onClick={handleResendCode} 
        disabled={loading} 
        className="auth-button-secondary"
      >
        Надіслати код повторно
      </button>
      
      <div className="auth-links">
        <button type="button" onClick={() => setRegisterStep('form')} className="auth-link-text">
          Повернутися до реєстрації
        </button>
      </div>
    </form>
  );

  const renderStandaloneVerification = () => (
    <>
      {verifyStep === 'email' && (
        <form onSubmit={handleSendEmailCodeSubmit} className="auth-form">
          <div className="auth-field">
            <label className="auth-label">Email *</label>
            <input
              type="email"
              value={verifyEmail}
              onChange={(e) => setVerifyEmail(e.target.value)}
              required
              placeholder="your@email.com"
              className="auth-input"
            />
            <small className="auth-hint">
              На цю адресу буде надіслано код підтвердження
            </small>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="auth-button auth-button-primary"
          >
            {loading ? 'Надсилання...' : 'Надіслати код'}
          </button>
          
          <div className="auth-links">
            <button type="button" onClick={() => changeMode('login')} className="auth-link">
              Вже є акаунт? Увійти
            </button>
          </div>
        </form>
      )}
      
      {verifyStep === 'code' && (
        <form onSubmit={handleVerifyEmailCode} className="auth-form">
          <div className="auth-field">
            <label className="auth-label">Email</label>
            <input
              type="email"
              value={verifyEmail}
              disabled
              className="auth-input auth-input-disabled"
            />
          </div>
          
          <div className="auth-field">
            <label className="auth-label">Код підтвердження *</label>
            <input
              type="text"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value)}
              required
              placeholder="Введіть 6-значний код"
              maxLength="6"
              className="auth-input auth-code-input"
            />
            <small className="auth-hint">
              Код дійсний протягом 5 хвилин
            </small>
          </div>
          
          <button
            type="submit"
            disabled={loading || verifyCode.length !== 6}
            className="auth-button auth-button-primary"
          >
            {loading ? 'Перевірка...' : 'Підтвердити та продовжити'}
          </button>
          
          <button
            type="button"
            onClick={handleResendEmailCode}
            disabled={loading}
            className="auth-button auth-button-secondary"
          >
            Надіслати код повторно
          </button>
          
          <div className="auth-links">
            <button type="button" onClick={() => setVerifyStep('email')} className="auth-link">
              Змінити email
            </button>
          </div>
        </form>
      )}
    </>
  );

  return (
    <div className="auth-container">
      {/* LEFT SIDE */}
      <div className="auth-left">
        <div className="auth-left-overlay"></div>
        <div className="auth-left-content">
          <h1>Наукова <br /> платформа</h1>
          <p>Об'єднуємо дослідників та розвиваємо науку</p>
        </div>
        <button 
          className="auth-back-button"
          onClick={() => navigate('/')}
        >
          ← Головна сторінка
        </button>
      </div>

      {/* RIGHT SIDE */}
      <div className="auth-right">
        <div className="auth-card">
          <div className="auth-header">
            <h2 className="auth-title">{getPanelTitle()}</h2>
            <p className="auth-subtitle">{getPanelDescription()}</p>
          </div>

          {mode === 'login' && renderLogin()}
          {mode === 'register' && registerStep === 'form' && renderRegisterForm()}
          {mode === 'register' && registerStep === 'verification' && renderRegisterVerification()}
          {mode === 'verify' && renderStandaloneVerification()}
        </div>
      </div>

      <CaptchaModal
        isOpen={showCaptcha}
        onClose={() => setShowCaptcha(false)}
        onVerify={handleCaptchaVerify}
        title="Підтвердження дії"
      />
    </div>
  );
};

export default Auth;