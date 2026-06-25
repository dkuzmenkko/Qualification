import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import defaultAvatar from '../assets/default-avatar.png';
import '../styles/Profile.css';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const { success, error: showError } = useNotification();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [views, setViews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [avatarTimestamp, setAvatarTimestamp] = useState(Date.now());
  const [errorShown, setErrorShown] = useState(false);
  
  const isInitialLoadRef = useRef(false);

  const fetchProfile = useCallback(async () => {
    try {
      const [profileRes, statsRes, viewsRes] = await Promise.all([
        api.get('/profiles/me/'),
        api.get(`/profiles/user/${user.id}/stats/`),
        api.get('/profiles/views/')
      ]);
      setProfile(profileRes.data);
      setStats(statsRes.data);
      setViews(viewsRes.data);
      setErrorShown(false); 
    } catch (error) {
      console.error('Error fetching profile:', error);
      if (!errorShown) {
        setErrorShown(true);
        if (error.response?.status !== 404) {
          showError('Помилка завантаження профілю');
        }
      }
    } finally {
      setLoading(false);
    }
  }, [user.id, showError, errorShown]);

  useEffect(() => {
    if (!isInitialLoadRef.current && user?.id) {
      isInitialLoadRef.current = true;
      fetchProfile();
    }
  }, [fetchProfile, user?.id]);

  useEffect(() => {
    setAvatarError(false);
    setAvatarTimestamp(Date.now());
  }, [user?.avatar_url]);

  const getAvatarUrl = () => {
    if (avatarError) return defaultAvatar;
    if (user?.avatar_url) {
      const separator = user.avatar_url.includes('?') ? '&' : '?';
      return `${user.avatar_url}${separator}t=${avatarTimestamp}`;
    }
    return defaultAvatar;
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
      showError('Розмір фото не повинен перевищувати 2MB');
      return;
    }
    
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      showError('Дозволені формати: JPEG, PNG, GIF, WEBP');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const response = await api.patch('/users/me/update/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      updateUser(response.data.user);
      setAvatarTimestamp(Date.now());
      setAvatarError(false);
      success('Фото профілю оновлено');
    } catch (error) {
      console.error('Upload error:', error);
      showError(error.response?.data?.error || 'Помилка завантаження фото');
    } finally {
      setUploading(false);
    }
  };

 const handleRemoveAvatar = async () => {
  if (!window.confirm('Ви впевнені, що хочете видалити фото профілю?')) return;

  setUploading(true);
  try {
    const response = await api.delete('/users/me/avatar/delete/');
    
    if (response.data.user) {
      updateUser(response.data.user);
      setAvatarTimestamp(Date.now());
      setAvatarError(false);
      success('Фото профілю видалено');
    }
  } catch (error) {
    console.error('Remove error:', error);
    console.error('Response status:', error.response?.status);
    console.error('Response data:', error.response?.data);
    showError(error.response?.data?.error || 'Помилка видалення фото');
  } finally {
    setUploading(false);
  }
};

  if (loading) return <div className="loading">Завантаження...</div>;

  return (
    <div className="profileContainer">
      <h1>Мій профіль</h1>

      <div className="profileHeader">
        <div className="avatarWrapper">
          <img
            src={getAvatarUrl()}
            alt={user?.full_name || user?.username || 'Користувач'}
            className="profileAvatar"
            onError={() => setAvatarError(true)}
          />
        </div>

        <div className="profileInfo">
          <h2 className="profileName">{user?.full_name || user?.username}</h2>
          <p className="profileText"><strong>Email:</strong> {user?.email}</p>
          <p className="profileText">
            <strong>Роль:</strong> {
              user?.role === 'AUTHOR' ? 'Автор' : 
              user?.role === 'REVIEWER' ? 'Рецензент' : 
              user?.role === 'ADMIN' ? 'Адміністратор' : 'Організатор'
            }
          </p>

          <div className="profileActions">
            <label className={`btn uploadBtn ${uploading ? 'disabled' : ''}`}>
              {uploading ? 'Завантаження...' : 'Завантажити фото'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleAvatarUpload}
                disabled={uploading}
                style={{ display: 'none' }}
              />
            </label>

            {user?.avatar_url && (
              <button
                onClick={handleRemoveAvatar}
                className={`btn removeBtn ${uploading ? 'disabled' : ''}`}
                disabled={uploading}
              >
                Видалити фото
              </button>
            )}

            <Link to="/profile/edit" className="btn editBtn">
              Редагувати профіль
            </Link>
          </div>
        </div>
      </div>

      <div className="profileSection">
        <h2>Основна інформація</h2>
        <p><strong>ПІБ:</strong> {user?.full_name || user?.username}</p>
        <p><strong>Email:</strong> {user?.email}</p>
        <p><strong>Роль:</strong> {
          user?.role === 'AUTHOR' ? 'Автор' : 
          user?.role === 'REVIEWER' ? 'Рецензент' : 
          user?.role === 'ADMIN' ? 'Адміністратор' : 'Організатор'
        }</p>
        {user?.orcid_id && <p><strong>ORCID:</strong> {user.orcid_id}</p>}
        {user?.affiliation && <p><strong>Місце роботи/навчання:</strong> {user.affiliation}</p>}
        {user?.interests && user.interests.length > 0 && (
          <p><strong>Інтереси:</strong> {Array.isArray(user.interests) ? user.interests.join(', ') : user.interests}</p>
        )}
      </div>

      <div className="profileSection">
        <h2>Профіль</h2>
        <p><strong>Біографія:</strong> {profile?.bio || 'Не вказано'}</p>
        {profile?.website && <p><strong>Вебсайт:</strong> <a href={profile.website} target="_blank" rel="noopener noreferrer">{profile.website}</a></p>}
        {profile?.github && <p><strong>GitHub:</strong> <a href={profile.github} target="_blank" rel="noopener noreferrer">{profile.github}</a></p>}
        {profile?.linkedin && <p><strong>LinkedIn:</strong> <a href={profile.linkedin} target="_blank" rel="noopener noreferrer">{profile.linkedin}</a></p>}
        <p><strong>Профіль публічний:</strong> {profile?.is_profile_public ? 'Так' : 'Ні'}</p>
        <p><strong>Показувати email:</strong> {profile?.show_email ? 'Так' : 'Ні'}</p>
        <p><strong>Переглядів профілю:</strong> {profile?.profile_views || 0}</p>
      </div>

      {stats && (
        <div className="profileSection">
          <h2>Статистика</h2>

          <div className="profileStatsSubsection">
            <h3>Тези</h3>
            <p>Всього: {stats.submissions?.total || 0}</p>
            <p>Чернетки: {stats.submissions?.by_status?.draft || 0}</p>
            <p>На рецензуванні: {stats.submissions?.by_status?.pending || 0}</p>
            <p>Прийнято: {stats.submissions?.by_status?.accepted || 0}</p>
            <p>Відхилено: {stats.submissions?.by_status?.rejected || 0}</p>
            <p>Відсоток прийняття: {stats.submissions?.acceptance_rate || 0}%</p>
          </div>

          <div className="profileStatsSubsection">
            <h3>Конференції</h3>
            <p>Всього організовано: {stats.conferences?.total || 0}</p>
            <p>Активні: {stats.conferences?.active || 0}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;