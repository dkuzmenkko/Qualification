import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import defaultAvatar from '../assets/default-avatar.png';
import SubmitByConferenceId from './SubmitByConferenceId';
import '../styles/Navigation.css';

const Navigation = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [imageError, setImageError] = useState(false);
  const [avatarKey, setAvatarKey] = useState(0);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifs, setLoadingNotifs] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const dropdownRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (user?.avatar_url) setAvatarKey(prev => prev + 1);
    setImageError(false);
    setIsImageLoading(true);
  }, [user?.avatar_url]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    if (!user) return;
    setLoadingNotifs(true);
    try {
      const response = await api.get('/notifications/');
      setNotifications(response.data);
      const unread = response.data.filter(n => !n.is_read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoadingNotifs(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      intervalRef.current = setInterval(() => {
        fetchNotifications();
      }, 30000);
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [user]);

  useEffect(() => {
    if (dropdownOpen) {
      fetchNotifications();
    }
  }, [dropdownOpen]);

  const getTypeText = (type) => {
    switch(type) {
      case 'SUBMISSION_STATUS': return 'Зміна статусу тези';
      case 'SUBMISSION_PENDING': return 'Нова теза на рецензію';
      case 'REVIEW_INVITE': return 'Запрошення рецензента';
      case 'SUBMISSION_REVIEW': return 'Результат рецензії';
      case 'COMMENT': return 'Новий коментар';
      case 'COMMENT_REPLY': return 'Відповідь на коментар';
      case 'VOTE': return 'Голос за коментар';
      default: return 'Загальне повідомлення';
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/read/`);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error(error);
    }
  };

  const handleOpenSubmitModal = () => {
    setShowSubmitModal(true);
    setDropdownOpen(false);
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.post('/notifications/read-all/');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Ви впевнені, що хочете видалити це сповіщення?')) return;
    try {
      await api.delete(`/notifications/${id}/delete/`);
      const wasUnread = notifications.find(n => n.id === id)?.is_read === false;
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (wasUnread) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('Ви впевнені, що хочете видалити всі сповіщення?')) return;
    try {
      await api.delete('/notifications/delete-all/');
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error(error);
    }
  };

  const getAvatarSrc = () => {
    if (imageError) return defaultAvatar;
    if (user?.avatar_url) {
      const timestamp = `t=${avatarKey}`;
      return user.avatar_url.includes('?')
        ? `${user.avatar_url}&${timestamp}`
        : `${user.avatar_url}?${timestamp}`;
    }
    return defaultAvatar;
  };

  const hideNavigationPaths = ['/login', '/register'];
  if (hideNavigationPaths.includes(location.pathname)) return null;

  if (user && (user.role === 'ADMIN' || user.is_superuser)) {
    return (
      <nav className="navadmin">
        <div className="flexstart gap20">
          <Link to="/admin-dashboard" className="navlinkwhite bold18">
            Адмін панель
          </Link>
          <Link to="/my-conferences" className="navlinkwhite">
            Мої конференції
          </Link>
          <Link to="/conferences/create" className="navlinkwhite greenbold">
            + Створити конференцію
          </Link>
          <Link to="/users" className="navlinkwhite">
            Користувачі
          </Link>
        </div>
        <div className="flexstart gap20">
          <span className="textwhite">
            {user.full_name || user.username} (Адміністратор)
          </span>
          <button onClick={logout} className="btn danger">Вийти</button>
        </div>
      </nav>
    );
  }

  return (
    <nav className="navuser">
      <div className="flexstart gap20 wrap">
        <Link to="/" className="navlink bold">Головна</Link>
        <Link to="/conferences" className="navlink">Конференції</Link>
        <Link to="/discussions" className="navlink">Обговорення</Link>
        <Link to="/search" className="navlink">Пошук</Link>
        <Link to="/archives" className="navlink">Архів</Link>
        <Link to="/users" className="navlink new">Користувачі</Link>
      </div>

      <div className="flexstart gap20 wrap">
        {user ? (
          <>
            <Link to="/dashboard" className="navlink">Кабінет</Link>
            <Link to="/profile" className="navlink">Профіль</Link>
            
            {(user.role === 'AUTHOR' || user.role === 'REVIEWER') && (
              <button 
                onClick={handleOpenSubmitModal}
                className="submit-button-nav"
              >
                Подати тезу
              </button>
            )}
            
            {user.role === 'REVIEWER' && user.is_approved && (
              <>
                <Link to="/conferences/create" className="navlink greenbold">
                  + Створити конференцію
                </Link>
                <Link to="/my-conferences" className="navlink bluebold">
                  Мої конференції
                </Link>
              </>
            )}
            
            {user.role === 'ORGANIZER' && (
              <Link to="/my-conferences" className="navlink bluebold">
                Мої конференції
              </Link>
            )}

            <div className="profile-dropdown" ref={dropdownRef}>
              <div className="flexstart gap10" onClick={() => setDropdownOpen(prev => !prev)}>
                <div className="avatar-wrapper" style={{ position: 'relative' }}>
                  <img
                    src={getAvatarSrc()}
                    alt="Avatar"
                    className="avatar clickable"
                    onError={() => setImageError(true)}
                  />
                  {unreadCount > 0 && (
                    <span className="notification-badge">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </div>
                <span className="textmuted">
                  {user.full_name || user.username} ({user.role === 'AUTHOR' ? 'Автор' : user.role === 'REVIEWER' ? 'Рецензент' : 'Організатор'})
                </span>
              </div>

              {dropdownOpen && (
                <div className="dropdown-menu notifications-dropdown">
                  <h3 className="dropdown-title">
                    Повідомлення
                    {unreadCount > 0 && (
                      <span className="dropdown-unread-count">{unreadCount} непрочитаних</span>
                    )}
                  </h3>

                  <div className="dropdown-actions-column">
                    {unreadCount > 0 && (
                      <button onClick={handleMarkAllAsRead} className="btn mark-all">
                        Позначити всі як прочитані
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button onClick={handleDeleteAll} className="btn delete-all">
                        Видалити всі
                      </button>
                    )}
                  </div>

                  <div className="notificationsList">
                    {loadingNotifs ? (
                      <p>Завантаження...</p>
                    ) : notifications.length === 0 ? (
                      <p>У вас немає сповіщень</p>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className={`notificationsCard ${n.is_read ? 'read' : 'unread'}`}>
                          <div className="notificationsCardTitle">{getTypeText(n.type)}</div>
                          <div className="notificationsCardMessage">{n.message}</div>
                          <small className="notificationsCardDate">{new Date(n.created_at).toLocaleString()}</small>
                          <div className="card-buttons">
                            {!n.is_read && <button onClick={() => handleMarkAsRead(n.id)} className="btn small">Прочитано</button>}
                            <button onClick={() => handleDelete(n.id)} className="btn small">Видалити</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <button onClick={logout} className="btn logout">
                    Вийти з аккаунта
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <Link to="/login" className="navlink bluebold">Вхід</Link>
            <Link to="/register" className="navlink greenbold">Реєстрація</Link>
          </>
        )}
      </div>
      
      <SubmitByConferenceId 
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
      />
    </nav>
  );
};

export default Navigation;