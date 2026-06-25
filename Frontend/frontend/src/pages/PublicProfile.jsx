import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import Avatar from '../components/Avatar';
import '../styles/Profile.css';

const PublicProfile = () => {
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await api.get(`/profiles/user/${userId}/`);
        console.log('Profile data:', response.data);
        setProfile(response.data);
      } catch (error) {
        if (error.response?.status === 403) {
          setError('Цей профіль закритий для публічного перегляду');
        } else {
          setError('Користувача не знайдено');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [userId]);

  if (loading) return <div className="loading">Завантаження...</div>;
  if (error) return <div className="error-message">{error}</div>;
  if (!profile) return <div className="error-message">Профіль не знайдено</div>;

  const userObject = profile.user;

  return (
    <div className="publicProfileContainer">
      <div className="profileHeader">
        <div className="profileAvatar">
          <Avatar user={userObject} size="xlarge" link={false} />
        </div>
        <div className="profileInfo">
          <h1 className="name">{userObject.full_name || userObject.username}</h1>
          <p className="role"><strong>Роль:</strong> {userObject.role_display}</p>
          {userObject.affiliation && (
            <p><strong>Місце роботи/навчання:</strong> {userObject.affiliation}</p>
          )}
          {profile.profile?.show_orcid && userObject.orcid_id && (
            <p><strong>ORCID:</strong> {userObject.orcid_id}</p>
          )}
          {profile.profile?.show_email && userObject.email && (
            <p><strong>Email:</strong> {userObject.email}</p>
          )}
          {userObject.interests && userObject.interests.length > 0 && (
            <p><strong>Інтереси:</strong> {userObject.interests.join(', ')}</p>
          )}
        </div>
      </div>

      {profile.profile?.bio && (
        <div className="profileSection">
          <h2>Біографія</h2>
          <p>{profile.profile.bio}</p>
        </div>
      )}

      <div className="profileSection">
        <h2>Статистика</h2>
        <div className="statsGrid">
          <div className="statCard">
            <div className="statNumber">{profile.stats.total_submissions}</div>
            <div className="statLabel">Всього тез</div>
          </div>
          <div className="statCard">
            <div className="statNumber">{profile.stats.accepted_submissions}</div>
            <div className="statLabel">Прийнято тез</div>
          </div>
          <div className="statCard">
            <div className="statNumber">{profile.stats.organized_conferences}</div>
            <div className="statLabel">Організовано конференцій</div>
          </div>
          {profile.stats.reviewed_submissions > 0 && (
            <div className="statCard">
              <div className="statNumber">{profile.stats.reviewed_submissions}</div>
              <div className="statLabel">Перевірено тез</div>
            </div>
          )}
        </div>
        <div className="statsMeta">
          <p><strong>Користувач з:</strong> {profile.stats.member_since}</p>
          {profile.stats.last_active && (
            <p><strong>Остання активність:</strong> {profile.stats.last_active}</p>
          )}
        </div>
      </div>

      {profile.recent_submissions?.length > 0 && (
        <div className="profileSection">
          <h2>Останні прийняті тези</h2>
          <div className="submissionList">
            {profile.recent_submissions.map(sub => (
              <div key={sub.id} className="submissionItem">
                <p className="submissionTitle"><strong>{sub.title}</strong></p>
                <p className="submissionMeta">
                  Конференція: {sub.conference_title} | Дата: {sub.conference_date}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {profile.organized_conferences?.length > 0 && (
        <div className="profileSection">
          <h2>Організовані конференції</h2>
          <div className="submissionList">
            {profile.organized_conferences.map(conf => (
              <div key={conf.id} className="submissionItem">
                <p className="submissionTitle">
                  <strong>{conf.title}</strong> ({conf.conference_id})
                </p>
                <p className="submissionMeta">Дата: {conf.event_date}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicProfile;