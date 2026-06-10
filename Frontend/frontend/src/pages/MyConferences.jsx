import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import '../styles/MyConferences.css';

const MyConferences = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conferences, setConferences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState({});


const [exporting, setExporting] = useState({});

const handleExportParticipants = async (confId) => {
  setExporting(prev => ({ ...prev, [confId]: 'participants' }));
  try {
    const response = await api.get(`/exports/conferences/${confId}/participants/`, {
      responseType: 'blob'
    });
    
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `participants_${confId}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    alert('Помилка при експорті учасників');
  } finally {
    setExporting(prev => ({ ...prev, [confId]: null }));
  }
};

const handleExportSubmissions = async (confId) => {
  setExporting(prev => ({ ...prev, [confId]: 'submissions' }));
  try {
    const response = await api.get(`/exports/conferences/${confId}/submissions/`, {
      responseType: 'blob'
    });
    
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `submissions_${confId}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    alert('Помилка при експорті тез');
  } finally {
    setExporting(prev => ({ ...prev, [confId]: null }));
  }
};

  useEffect(() => {
    const fetchMyConferences = async () => {
      try {
        const response = await api.get('/conferences/');
        const myConfs = response.data.filter(conf => conf.organizer?.id === user?.id);
        setConferences(myConfs);
      } catch (error) {
        console.error('Error fetching my conferences:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMyConferences();
  }, [user]);

  const handleDelete = async (confId, confTitle) => {
    if (!window.confirm(`Ви впевнені, що хочете видалити конференцію "${confTitle}"? Цю дію не можна скасувати.`)) {
      return;
    }
    
    setDeleting(prev => ({ ...prev, [confId]: true }));
    try {
      await api.delete(`/conferences/${confId}/`);
      setConferences(prev => prev.filter(c => c.id !== confId));
      alert('Конференцію успішно видалено');
    } catch (error) {
      alert(error.response?.data?.error || 'Помилка при видаленні конференції');
    } finally {
      setDeleting(prev => ({ ...prev, [confId]: false }));
    }
  };

  if (loading) return <div>Завантаження...</div>;

  const now = new Date();
  const activeConferences = conferences.filter(conf => new Date(conf.submission_deadline) >= now);
  const pastConferences = conferences.filter(conf => new Date(conf.submission_deadline) < now);

  return (
    <div className="myConferencesContainer">
      <div className="myConferencesHeader">
        <h1>Мої конференції</h1>
        <Link to="/conferences/create">
          <button className="myConferencesCreateButton">
            + Створити конференцію
          </button>
        </Link>
      </div>
      
      {conferences.length === 0 ? (
        <div className="myConferencesEmpty">
          <p>Ви ще не створили жодної конференції.</p>
          <Link to="/conferences/create">
            <button className="myConferencesFirstButton">
              Створити першу конференцію
            </button>
          </Link>
        </div>
      ) : (
        <div>
          {activeConferences.length > 0 && (
            <div className="myConferencesSection">
              <h2>Активні конференції ({activeConferences.length})</h2>
              <div className="myConferencesList">
                {activeConferences.map(conf => (
                  <div key={conf.id} className="myConferencesCard myConferencesCardActive">
                    <div className="myConferencesCardHeader">
                      <div className="myConferencesCardInfo">
                        <h3 className="myConferencesCardTitle">
                          <Link to={`/conferences/${conf.id}`}>
                            {conf.title}
                          </Link>
                          <span className="myConferencesActiveBadge">
                            Активна
                          </span>
                        </h3>
                        <p><strong>ID:</strong> {conf.conference_id}</p>
                        <p><strong>Категорія:</strong> {conf.category}</p>
                        <p><strong>Дата проведення:</strong> {conf.event_date}</p>
                        <p><strong>Дедлайн подачі:</strong> {conf.submission_deadline}</p>
                        <p><strong>Організатор:</strong> {conf.organizer?.full_name || conf.organizer?.username}</p>
                        <p><strong>Рецензентів:</strong> {conf.reviewers?.length || 0}</p>
                      </div>
                      <div className="myConferencesCardActions">
                        <Link to={`/conferences/${conf.id}`}>
                          <button className="myConferencesViewButton">Переглянути</button>
                        </Link>
                        <button 
                          onClick={() => handleDelete(conf.id, conf.title)}
                          disabled={deleting[conf.id]}
                          className="myConferencesDeleteButton"
                        >
                          {deleting[conf.id] ? 'Видалення...' : 'Видалити'}
                        </button>
                      </div>
                    </div>
                    
 <div className="myConferencesExportButtons">
  <button 
    onClick={() => handleExportParticipants(conf.id)}
    disabled={exporting[conf.id]}
    className="myConferencesExportButton"
  >
    {exporting[conf.id] === 'participants' ? 'Експорт...' : 'Експортувати учасників'}
  </button>
  
  <button 
    onClick={() => handleExportSubmissions(conf.id)}
    disabled={exporting[conf.id]}
    className="myConferencesExportButton"
  >
    {exporting[conf.id] === 'submissions' ? 'Експорт...' : 'Експортувати тези'}
  </button>
  
  <Link to={`/submissions?conference=${conf.id}`}>
    <button className="myConferencesSubmissionsButton">
      Всі тези
    </button>
  </Link>
</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {pastConferences.length > 0 && (
            <div className="myConferencesSection">
              <h2>Завершені конференції ({pastConferences.length})</h2>
              <div className="myConferencesList">
                {pastConferences.map(conf => (
                  <div key={conf.id} className="myConferencesCard myConferencesCardPast">
                    <div className="myConferencesCardHeader">
                      <div className="myConferencesCardInfo">
                        <h3 className="myConferencesCardTitle">
                          <Link to={`/conferences/${conf.id}`}>
                            {conf.title}
                          </Link>
                          <span className="myConferencesPastBadge">
                            Завершена
                          </span>
                        </h3>
                        <p><strong>ID:</strong> {conf.conference_id}</p>
                        <p><strong>Категорія:</strong> {conf.category}</p>
                        <p><strong>Дата проведення:</strong> {conf.event_date}</p>
                        <p><strong>Дедлайн подачі:</strong> {conf.submission_deadline}</p>
                        <p><strong>Організатор:</strong> {conf.organizer?.full_name || conf.organizer?.username}</p>
                      </div>
                      <div className="myConferencesCardActions">
                        <Link to={`/conferences/${conf.id}`}>
                          <button className="myConferencesViewButton">Переглянути</button>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MyConferences;