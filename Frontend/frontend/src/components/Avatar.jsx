import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import defaultAvatar from '../assets/default-avatar.png';
import '../styles/Avatar.css';



const Avatar = ({ user, size = 'medium', showName = false, link = true, className = '' }) => {
  const [imageError, setImageError] = useState(false);

  const getAvatarSrc = () => {
    if (imageError) return defaultAvatar;
    if (user?.avatar_url) {
      return user.avatar_url;
    }
    return defaultAvatar;
  };

  const getSizeClass = () => {
    switch(size) {
      case 'small': return 'avatar-small';
      case 'large': return 'avatar-large';
      case 'xlarge': return 'avatar-xlarge';
      default: return 'avatar-medium';
    }
  };

  const avatarContent = (
    <div className={`avatar-container ${className}`}>
      <img
        src={getAvatarSrc()}
        alt={user?.full_name || user?.username || 'Користувач'}
        className={`avatar-image ${getSizeClass()}`}
        onError={() => setImageError(true)}
      />
      {showName && (
        <span className="avatar-name">
          {user?.full_name || user?.username}
        </span>
      )}
    </div>
  );

  if (link && user?.id) {
    return <Link to={`/profile/${user.id}`} className="avatar-link">{avatarContent}</Link>;
  }

  return avatarContent;
};

export default Avatar;