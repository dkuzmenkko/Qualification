import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import defaultAvatar from '../assets/default-avatar.png';
import '../styles/ProfileEdit.css';
const ProfileEdit = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const { success: showSuccess, error: showError } = useNotification();
  
  const [userForm, setUserForm] = useState({
    first_name: '',
    last_name: '',
    middle_name: '',
    email: '',
    orcid_id: '',
    affiliation: '',
    interests: [],
    receive_email_notifications: true,
    receive_push_notifications: true,
  });
  
  const [profileForm, setProfileForm] = useState({
    bio: '',
    website: '',
    linkedin: '',
    github: '',
    google_scholar: '',
    is_profile_public: true,
    show_email: false,
    show_orcid: true,
  });
  
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [removeAvatar, setRemoveAvatar] = useState(false);

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

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await api.get('/profiles/me/');
        setProfileForm({
          bio: response.data.bio || '',
          website: response.data.website || '',
          linkedin: response.data.linkedin || '',
          github: response.data.github || '',
          google_scholar: response.data.google_scholar || '',
          is_profile_public: response.data.is_profile_public !== false,
          show_email: response.data.show_email || false,
          show_orcid: response.data.show_orcid !== false,
        });
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };
    
    fetchProfile();
    
    setUserForm({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      middle_name: user.middle_name || '',
      email: user.email || '',
      orcid_id: user.orcid_id || '',
      affiliation: user.affiliation || '',
      interests: user.interests || [],
      receive_email_notifications: user.receive_email_notifications !== false,
      receive_push_notifications: user.receive_push_notifications !== false,
    });
    
    if (user?.avatar_url) {
      setAvatarPreview(user.avatar_url);
    }
    setAvatarError(false);
    setRemoveAvatar(false);
  }, [user]);

  const handleUserChange = (e) => {
    const { name, value, type, checked } = e.target;
    setUserForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleProfileChange = (e) => {
    const { name, value, type, checked } = e.target;
    setProfileForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleInterestToggle = (categoryId) => {
    setUserForm(prev => ({
      ...prev,
      interests: prev.interests.includes(categoryId)
        ? prev.interests.filter(i => i !== categoryId)
        : [...prev.interests, categoryId]
    }));
  };

  const handleAvatarChange = (e) => {
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
    
    setAvatarFile(file);
    setRemoveAvatar(false);
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result);
      setAvatarError(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    setRemoveAvatar(true);
    setAvatarError(false);
  };

  const getAvatarDisplay = () => {
    if (avatarError) return defaultAvatar;
    if (avatarPreview) return avatarPreview;
    if (user?.avatar_url && !removeAvatar) return user.avatar_url;
    return defaultAvatar;
  };

const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);

  try {
    const userUpdateData = { ...userForm };
    delete userUpdateData.avatar; 
    await api.patch('/users/me/update/', userUpdateData); 

    if (avatarFile || removeAvatar) {
      const formData = new FormData();
      if (avatarFile) formData.append('avatar', avatarFile);
      if (removeAvatar) formData.append('avatar', '');
      await api.patch('/users/me/update/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }

    await api.patch('/profiles/me/', profileForm);

    const updatedUser = await api.get('/users/me/');
    updateUser(updatedUser.data);

    showSuccess('Профіль успішно оновлено');
  } catch (err) {
    console.error(err);
    showError(err.response?.data?.error || 'Помилка при оновленні профілю');
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="profileEditContainer">
      <h1 className="profileEditTitle">Редагування профілю</h1>
      
      <form onSubmit={handleSubmit}>
        <div className="profileEditAvatarSection">

          <img 
            src={getAvatarDisplay()}
            alt="Avatar preview"
            className="profileEditAvatar"
            onError={(e) => {
              setAvatarError(true);
              e.target.src = defaultAvatar;
            }}
          />
          
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="profileEditProgress">
              <progress value={uploadProgress} max="100" />
              <span>{uploadProgress}%</span>
            </div>
          )}
          
          <div className="profileEditAvatarButtons">
            <label className="profileEditButton uploadButton">
              {uploadProgress > 0 && uploadProgress < 100 ? 'Завантаження...' : 'Вибрати фото'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleAvatarChange}
                disabled={loading}
              />
            </label>
            
            {(user?.avatar_url || avatarPreview) && !removeAvatar && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="profileEditButton removeButton"
                disabled={loading}
              >
                 Видалити фото
              </button>
            )}
          </div>
          <small className="profileEditAvatarNote">
            Максимальний розмір: 2MB. Дозволені формати: JPEG, PNG, GIF, WEBP
          </small>
        </div>
        
        <h2 className="profileEditSectionTitle">Особиста інформація</h2>
        
        <div className="profileEditField">
          <label>Прізвище:</label>
          <input type="text" name="last_name" value={userForm.last_name} onChange={handleUserChange} />
        </div>
        
        <div className="profileEditField">
          <label>Ім'я:</label>
          <input type="text" name="first_name" value={userForm.first_name} onChange={handleUserChange} />
        </div>
        
        <div className="profileEditField">
          <label>По батькові:</label>
          <input type="text" name="middle_name" value={userForm.middle_name} onChange={handleUserChange} />
        </div>
        
        <div className="profileEditField">
          <label>Email:</label>
          <input type="email" name="email" value={userForm.email} onChange={handleUserChange} />
        </div>
        
        <div className="profileEditField">
          <label>ORCID ID (0000-0000-0000-0000):</label>
          <input type="text" name="orcid_id" value={userForm.orcid_id} onChange={handleUserChange} placeholder="0000-0000-0000-0000" />
        </div>
        
        <div className="profileEditField">
          <label>Місце роботи/навчання:</label>
          <input type="text" name="affiliation" value={userForm.affiliation} onChange={handleUserChange} />
        </div>
        
        <div className="profileEditField">
          <label>Цікаві категорії:</label>
          <div className="profileEditInterests">
            {categories.map(cat => (
              <label key={cat.id}>
                <input
                  type="checkbox"
                  checked={userForm.interests.includes(cat.id)}
                  onChange={() => handleInterestToggle(cat.id)}
                />
                {cat.name}
              </label>
            ))}
          </div>
        </div>
        
        <h2 className="profileEditSectionTitle">Налаштування сповіщень</h2>
        
        <div className="profileEditCheckbox">
          <label>
            <input type="checkbox" name="receive_email_notifications" checked={userForm.receive_email_notifications} onChange={handleUserChange} />
            Отримувати сповіщення на email
          </label>
        </div>
        
        <div className="profileEditCheckbox">
          <label>
            <input type="checkbox" name="receive_push_notifications" checked={userForm.receive_push_notifications} onChange={handleUserChange} />
            Отримувати push-сповіщення
          </label>
        </div>
        
        <h2 className="profileEditSectionTitle">Профіль</h2>
        
        <div className="profileEditField">
          <label>Біографія:</label>
          <textarea name="bio" value={profileForm.bio} onChange={handleProfileChange} rows="5" />
        </div>
        
        <div className="profileEditField">
          <label>Вебсайт:</label>
          <input type="url" name="website" value={profileForm.website} onChange={handleProfileChange} />
        </div>
        
        <div className="profileEditField">
          <label>LinkedIn:</label>
          <input type="url" name="linkedin" value={profileForm.linkedin} onChange={handleProfileChange} />
        </div>
        
        <div className="profileEditField">
          <label>GitHub:</label>
          <input type="url" name="github" value={profileForm.github} onChange={handleProfileChange} />
        </div>
        
        <div className="profileEditField">
          <label>Google Scholar:</label>
          <input type="url" name="google_scholar" value={profileForm.google_scholar} onChange={handleProfileChange} />
        </div>
        
        <div className="profileEditCheckbox">
          <label>
            <input type="checkbox" name="is_profile_public" checked={profileForm.is_profile_public} onChange={handleProfileChange} />
            Публічний профіль
          </label>
        </div>
        
        <div className="profileEditCheckbox">
          <label>
            <input type="checkbox" name="show_email" checked={profileForm.show_email} onChange={handleProfileChange} />
            Показувати email у публічному профілі
          </label>
        </div>
        
        <div className="profileEditCheckbox">
          <label>
            <input type="checkbox" name="show_orcid" checked={profileForm.show_orcid} onChange={handleProfileChange} />
            Показувати ORCID у публічному профілі
          </label>
        </div>
        
        <button type="submit" className="avatarEddditLink" disabled={loading}>
          {loading ? 'Збереження...' : 'Зберегти зміни'}
        </button>
      </form>
    </div>
  );
};

export default ProfileEdit;