import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import Avatar from '../components/Avatar';
import '../styles/Submissions.css';

const Submissions = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { success, error: showError } = useNotification();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [conferences, setConferences] = useState([]);
  const [filters, setFilters] = useState({
    status: '',
    conference: '',
    my_conferences: false,
    to_review: false,
    reviewed_by_me: false,
    my_reviews: '',
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setFilters({
      status: params.get('status') || '',
      conference: params.get('conference') || '',
      my_conferences: params.get('my_conferences') === 'true',
      to_review: params.get('to_review') === 'true',
      reviewed_by_me: params.get('reviewed_by_me') === 'true',
      my_reviews: params.get('my_reviews') || '',
    });
  }, [location.search]);

  useEffect(() => {
    const fetchConferences = async () => {
      try {
        const response = await api.get('/conferences/');
        setConferences(response.data);
      } catch (error) {
        console.error('Error fetching conferences:', error);
      }
    };
    fetchConferences();
  }, []);

  useEffect(() => {
    const fetchSubmissions = async () => {
      setLoading(true);
      try {
        const response = await api.get('/submissions/');
        let data = response.data;
        
        if (filters.status) {
          data = data.filter(sub => sub.status === filters.status);
        }
        
        if (filters.conference) {
          data = data.filter(sub => sub.conference === parseInt(filters.conference));
        }
        
        if (filters.to_review && user.role === 'REVIEWER') {
          data = data.filter(sub => sub.reviewer === user.id && sub.status === 'PENDING');
        }
        
        if (filters.reviewed_by_me && user.role === 'REVIEWER') {
          data = data.filter(sub => sub.reviewer === user.id && sub.status !== 'PENDING');
        }
        
        if (filters.my_reviews && user.role === 'REVIEWER') {
          if (filters.my_reviews === 'accepted') {
            data = data.filter(sub => sub.reviewer === user.id && sub.status === 'ACCEPTED');
          } else if (filters.my_reviews === 'rejected') {
            data = data.filter(sub => sub.reviewer === user.id && sub.status === 'REJECTED');
          } else if (filters.my_reviews === 'revision') {
            data = data.filter(sub => sub.reviewer === user.id && sub.status === 'REVISION_REQUIRED');
          }
        }
        
        if (filters.my_conferences && user.role === 'ORGANIZER') {
          const myConfIds = conferences.filter(c => c.organizer?.id === user.id).map(c => c.id);
          data = data.filter(sub => myConfIds.includes(sub.conference));
        }
        
        setSubmissions(data);
      } catch (error) {
        console.error('Error fetching submissions:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSubmissions();
  }, [filters, user, conferences]);

  const getStatusColor = (status) => {
    switch(status) {
      case 'DRAFT': return '#9e9e9e';
      case 'PENDING': return '#ff9800';
      case 'REVISION_REQUIRED': return '#ff9800';
      case 'ACCEPTED': return '#4caf50';
      case 'REJECTED': return '#f44336';
      default: return '#000';
    }
  };

  const getStatusText = (status) => {
    switch(status) {
      case 'DRAFT': return 'Чернетка';
      case 'PENDING': return 'На рецензуванні';
      case 'REVISION_REQUIRED': return 'Потребує доопрацювання';
      case 'ACCEPTED': return 'Прийнято';
      case 'REJECTED': return 'Відхилено';
      default: return status;
    }
  };

  const clearFilters = () => {
    navigate('/submissions');
  };

  const getActiveFilterName = () => {
    if (filters.to_review) return 'Тези, що очікують рецензування';
    if (filters.reviewed_by_me) return 'Перевірені мною тези';
    if (filters.my_reviews === 'accepted') return 'Прийняті мною тези';
    if (filters.my_reviews === 'rejected') return 'Відхилені мною тези';
    if (filters.my_reviews === 'revision') return 'Тези, що потребують доопрацювання';
    if (filters.status === 'DRAFT') return 'Чернетки';
    if (filters.status === 'PENDING') return 'На рецензуванні';
    if (filters.status === 'REVISION_REQUIRED') return 'Потребують доопрацювання';
    if (filters.status === 'ACCEPTED') return 'Прийняті тези';
    if (filters.status === 'REJECTED') return 'Відхилені тези';
    if (filters.conference) {
      const conf = conferences.find(c => c.id === parseInt(filters.conference));
      return `Тези конференції: ${conf?.title || filters.conference}`;
    }
    if (filters.my_conferences) return 'Тези моїх конференцій';
    return null;
  };

  const activeFilterName = getActiveFilterName();

  if (loading) return <div className="loading">Завантаження...</div>;

  const availableConferences = conferences.filter(conf => {
    const isDeadlineActive = new Date(conf.submission_deadline) >= new Date();
    const isNotOrganizer = conf.organizer?.id !== user?.id;
    const isNotReviewer = !conf.reviewers?.some(r => r.id === user?.id);
    
    return isDeadlineActive && isNotOrganizer && isNotReviewer;
  });

  const handleDelete = async (subId) => {
    if (window.confirm('Ви впевнені, що хочете видалити цю чернетку?')) {
      try {
        await api.delete(`/submissions/${subId}/`);
        setSubmissions(prev => prev.filter(s => s.id !== subId));
        success('Чернетку видалено');
      } catch (error) {
        showError(error.response?.data?.error || 'Помилка при видаленні');
      }
    }
  };

  return (
    <div className="submissionsContainer">
      <div className="submissionsHeader">
        <h1>Мої тези</h1>
        
        {availableConferences.length > 0 && (
          <select 
            onChange={(e) => {
              if (e.target.value) {
                navigate(`/submissions/create/${e.target.value}`);
              }
            }}
            defaultValue=""
            className="submissionsCreateSelect"
          >
            <option value="" disabled>Подати нову тезу</option>
            {availableConferences.map(conf => (
              <option key={conf.id} value={conf.id}>
                {conf.title} (до {conf.submission_deadline})
              </option>
            ))}
          </select>
        )}
      </div>
      
      <div className="submissionsFilterSection">
        <h2>Фільтри</h2>
        <div className="submissionsFilterControls">
          <select
            name="status"
            value={filters.status}
            onChange={(e) => {
              const params = new URLSearchParams(location.search);
              if (e.target.value) params.set('status', e.target.value);
              else params.delete('status');
              navigate(`/submissions?${params.toString()}`);
            }}
            className="submissionsFilterSelect"
          >
            <option value="">Всі статуси</option>
            <option value="DRAFT">Чернетки</option>
            <option value="PENDING">На рецензуванні</option>
            <option value="REVISION_REQUIRED">Потребують доопрацювання</option>
            <option value="ACCEPTED">Прийняті</option>
            <option value="REJECTED">Відхилені</option>
          </select>

          {user?.role === 'ORGANIZER' && (
            <label className="submissionsFilterCheckbox">
              <input
                type="checkbox"
                checked={filters.my_conferences}
                onChange={(e) => {
                  const params = new URLSearchParams(location.search);
                  if (e.target.checked) params.set('my_conferences', 'true');
                  else params.delete('my_conferences');
                  navigate(`/submissions?${params.toString()}`);
                }}
              />
              <span>Мої конференції</span>
            </label>
          )}

          {user?.role === 'REVIEWER' && (
            <>
              <label className="submissionsFilterCheckbox">
                <input
                  type="checkbox"
                  checked={filters.to_review}
                  onChange={(e) => {
                    const params = new URLSearchParams(location.search);
                    if (e.target.checked) {
                      params.set('to_review', 'true');
                      params.delete('reviewed_by_me');
                      params.delete('my_reviews');
                    } else params.delete('to_review');
                    navigate(`/submissions?${params.toString()}`);
                  }}
                />
                <span>Очікують рецензії</span>
              </label>

              <label className="submissionsFilterCheckbox">
                <input
                  type="checkbox"
                  checked={filters.reviewed_by_me}
                  onChange={(e) => {
                    const params = new URLSearchParams(location.search);
                    if (e.target.checked) {
                      params.set('reviewed_by_me', 'true');
                      params.delete('to_review');
                      params.delete('my_reviews');
                    } else params.delete('reviewed_by_me');
                    navigate(`/submissions?${params.toString()}`);
                  }}
                />
                <span>Перевірені мною</span>
              </label>

              <select
                name="my_reviews"
                value={filters.my_reviews}
                onChange={(e) => {
                  const params = new URLSearchParams(location.search);
                  if (e.target.value) params.set('my_reviews', e.target.value);
                  else params.delete('my_reviews');
                  navigate(`/submissions?${params.toString()}`);
                }}
                className="submissionsFilterSelect"
              >
                <option value="">Мої рецензії</option>
                <option value="accepted">Прийняті мною</option>
                <option value="rejected">Відхилені мною</option>
                <option value="revision">Потребують доопрацювання</option>
              </select>
            </>
          )}
        </div>
      </div>
      
      {activeFilterName && (
        <div className="submissionsActiveFilter">
          <span>
            <strong>Активний фільтр:</strong> {activeFilterName}
            {` (${submissions.length} тез)`}
          </span>
          <button onClick={clearFilters} className="submissionsClearButton">
            Очистити фільтри
          </button>
        </div>
      )}
      
      {submissions.length === 0 ? (
        <div className="submissionsEmpty">
          <p>Немає тез, що відповідають фільтру</p>
          {activeFilterName && (
            <button onClick={clearFilters} className="submissionsShowAllButton">
              Показати всі тези
            </button>
          )}
          {availableConferences.length > 0 && (
            <p className="submissionsHint">
              Доступно {availableConferences.length} конференцій для подання тез
            </p>
          )}
        </div>
      ) : (
        submissions.map(sub => (
          <div key={sub.id} className="submissionsCard">
            <div className="submissionsCardContent">
              <div className="submissionsCardInfo">
                <h2 className="submissionsCardTitle">
                  <Link to={`/submissions/${sub.id}`}>{sub.title}</Link>
                </h2>
                <p><strong>Конференція:</strong> {sub.conference_title}</p>
                
                <p className="submissionsAuthorRow">
                  <strong>Автор:</strong>
                  <span className="submissionsAuthorInfo">
                    <Avatar user={{ id: sub.author, full_name: sub.author_full_name, username: sub.author_username }} size="small" />
                    <Link to={`/profile/${sub.author}`}>{sub.author_full_name}</Link>
                  </span>
                </p>
                
                <p>
                  <strong>Статус:</strong> 
                  <span className="submissionsStatusBadge" style={{ backgroundColor: `${getStatusColor(sub.status)}20`, color: getStatusColor(sub.status) }}>
                    {getStatusText(sub.status)}
                  </span>
                </p>
                <p><strong>Версія:</strong> {sub.version}</p>
                <p><strong>Створено:</strong> {new Date(sub.created_at).toLocaleString()}</p>
                
                {sub.reviewer && (
                  <p className="submissionsReviewerRow">
                    <strong>Рецензент:</strong>
                    <span className="submissionsReviewerInfo">
                      <Avatar user={{ id: sub.reviewer, full_name: sub.reviewer_username, username: sub.reviewer_username }} size="small" />
                      <Link to={`/profile/${sub.reviewer}`}>{sub.reviewer_username}</Link>
                    </span>
                  </p>
                )}
                
                {sub.reviewer_comment && (
                  <p><strong>Коментар рецензента:</strong> {sub.reviewer_comment.substring(0, 100)}...</p>
                )}
              </div>
              <div className="submissionsCardActions">
                {sub.can_edit && sub.status !== 'PENDING' && (
                  <Link to={`/submissions/edit/${sub.id}`}>
                    <button className="submissionsEditButton">Редагувати</button>
                  </Link>
                )}
                {sub.status === 'DRAFT' && (
                  <button 
                    onClick={async () => {
                      if (window.confirm('Відправити тезу на рецензію?')) {
                        try {
                          await api.post(`/submissions/${sub.id}/submit/`);
                          success('Тезу відправлено на рецензію');
                          window.location.reload();
                        } catch (error) {
                          showError(error.response?.data?.error || 'Помилка при відправленні');
                        }
                      }
                    }}
                    className="submissionsSubmitButton"
                  >
                    Відправити на рецензію
                  </button>
                )}
                {sub.status === 'DRAFT' && sub.can_delete && (
                  <button 
                    onClick={() => handleDelete(sub.id)}
                    className="submissionsDeleteButton"
                  >
                    Видалити
                  </button>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default Submissions;