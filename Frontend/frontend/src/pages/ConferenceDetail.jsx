// src/pages/ConferenceDetail.js

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import '../styles/ConferenceDetail.css';
import Announcements from '../components/Announcements';
import Avatar from '../components/Avatar';

const ConferenceDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [conference, setConference] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviting, setInviting] = useState(false);
  const [assigningReviewer, setAssigningReviewer] = useState(false);
  const [selectedReviewerId, setSelectedReviewerId] = useState('');
  const [similarConferences, setSimilarConferences] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [openingFile, setOpeningFile] = useState(false);
  const { success, error: showError } = useNotification();
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [confRes, subsRes, invitesRes, similarRes] = await Promise.all([
          api.get(`/conferences/${id}/`),
          api.get('/submissions/', { params: { conference: id } }),
          api.get('/conferences/my-invitations/'),
          api.get(`/recommendations/similar/${id}/`).catch(() => ({ data: [] }))
        ]);
        
        setConference(confRes.data);
        setSubmissions(subsRes.data.filter(s => s.conference === parseInt(id)));
        setReviewers(confRes.data.reviewers || []);
        setInvitations(invitesRes.data);
        setSimilarConferences(similarRes.data);
      } catch (error) {
        console.error('Error fetching conference:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    
    api.post(`/recommendations/track-view/${id}/`).catch(console.error);
  }, [id]);

  const handleInviteReviewer = async () => {
    if (!inviteUsername.trim()) return;
    setInviting(true);
    try {
      await api.post(`/conferences/${id}/invite-reviewer/`, {
        reviewer_username: inviteUsername
      });
      success(`Запрошення надіслано користувачу ${inviteUsername}`);
      setInviteUsername('');
    } catch (err) {
      showError(err.response?.data?.error || 'Помилка при запрошенні');
    } finally {
      setInviting(false);
    }
  };

  const handleAssignReviewer = async () => {
    if (!selectedReviewerId) return;
    setAssigningReviewer(true);
    try {
      await api.post(`/conferences/${id}/assign-reviewer/`, {
        reviewer_id: selectedReviewerId
      });
      success('Рецензента призначено');
      const confRes = await api.get(`/conferences/${id}/`);
      setReviewers(confRes.data.reviewers || []);
      setSelectedReviewerId('');
    } catch (err) {
      showError(err.response?.data?.error || 'Помилка при призначенні');
    } finally {
      setAssigningReviewer(false);
    }
  };
  
  const handleExportParticipants = async () => {
    if (!conference) return;
    setExporting(true);
    try {
      const response = await api.get(`/exports/conferences/${conference.id}/participants/`, {
        responseType: 'blob'
      });
      
      if (response.headers['content-type'] === 'application/json') {
        const text = await response.data.text();
        const error = JSON.parse(text);
        throw new Error(error.error || 'Помилка при експорті');
      }
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `participants_${conference.conference_id}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      success('Експорт учасників завершено');
    } catch (err) {
      showError('Помилка при експорті учасників: ' + (err.message || 'Невідома помилка'));
    } finally {
      setExporting(false);
    }
  };

  const handleExportSubmissions = async () => {
    if (!conference) return;
    setExporting(true);
    try {
      const response = await api.get(`/exports/conferences/${conference.id}/submissions/`, {
        responseType: 'blob'
      });
      
      if (response.headers['content-type'] === 'application/json') {
        const text = await response.data.text();
        const error = JSON.parse(text);
        throw new Error(error.error || 'Помилка при експорті');
      }
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `submissions_${conference.conference_id}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      success('Експорт тез завершено');
    } catch (err) {
      showError('Помилка при експорті тез: ' + (err.message || 'Невідома помилка'));
    } finally {
      setExporting(false);
    }
  };

  const handleOpenFile = async (conferenceId) => {
    setOpeningFile(true);
    try {
      const response = await api.get(`/conferences/${conferenceId}/download-guidelines/`, {
        responseType: 'blob'
      });
      
      const contentType = response.headers['content-type'];
      const blob = new Blob([response.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      
      const newWindow = window.open(url, '_blank');
      
      if (!newWindow) {
        const link = document.createElement('a');
        link.href = url;
        link.download = `guidelines_${conferenceId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);
      
    } catch (error) {
      console.error('Error opening file:', error);
      showError('Не вдалося відкрити файл. Можливо, файл пошкоджений або відсутній.');
    } finally {
      setOpeningFile(false);
    }
  };

  if (loading) return <div className="loading">Завантаження...</div>;
  if (!conference) return <div>Конференцію не знайдено</div>;

  const isOrganizer = user && conference && conference.organizer?.id === user.id;
  const isReviewerOfThisConference = user && conference && conference.reviewers?.some(r => r.id === user.id);
  const hasPendingInvitation = invitations.some(inv => inv.conference?.id === conference?.id && inv.status === 'PENDING');
  const isDeadlineActive = conference && new Date(conference.submission_deadline) >= new Date();
  const canSubmit = user && isDeadlineActive && !isOrganizer && !isReviewerOfThisConference;

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

  return (
    <div className="conferenceDetailContainer">
      {!canSubmit && user && isDeadlineActive && (
        <div className="conferenceDetailCannotSubmit">
          {isOrganizer && (
            <p>Організатор конференції не може подавати тези на власну конференцію</p>
          )}
          {isReviewerOfThisConference && (
            <p>Ви є рецензентом цієї конференції і не можете подавати тези</p>
          )}
        </div>
      )}

      <div className="conferenceDetailBackLink">
        <Link to="/conferences">Назад до списку конференцій</Link>
      </div>
      
      <div className="conferenceDetailHeader">
        <h1>{conference.title}</h1>
      </div>

      <div className="conferenceDetailInfoGrid">
        <div className="infoGrid">
          <div className="infoItem">
            <span className="infoLabel">ID:</span>
            <span className="infoValue">{conference.conference_id}</span>
          </div>
          <div className="infoItem">
            <span className="infoLabel">Категорія:</span>
            <span className="infoValue">{conference.category}</span>
          </div>
          <div className="infoItem organizer-info">
            <span className="infoLabel">Організатор:</span>
            <span className="infoValue">
              <Avatar user={conference.organizer} size="small" />
              <Link to={`/profile/${conference.organizer?.id}`}>
                {conference.organizer?.full_name || conference.organizer?.username}
              </Link>
            </span>
          </div>
          <div className="infoItem">
            <span className="infoLabel">Тип проведення:</span>
            <span className="infoValue">
              <span className={`conference-type-badge conference-type-${conference.conference_type?.toLowerCase()}`}>
                {conference.conference_type === 'ONLINE' && 'Онлайн'}
                {conference.conference_type === 'OFFLINE' && 'Офлайн'}
                {conference.conference_type === 'HYBRID' && 'Гібридний'}
              </span>
              {conference.conference_type === 'ONLINE' && conference.online_link && (
                <a href={conference.online_link} target="_blank" rel="noopener noreferrer" className="online-link"> (Посилання)</a>
              )}
              {conference.conference_type === 'HYBRID' && conference.online_link && (
                <a href={conference.online_link} target="_blank" rel="noopener noreferrer" className="online-link"> (Посилання)</a>
              )}
            </span>
          </div>
          <div className="infoItem">
            <span className="infoLabel">Дата проведення:</span>
            <span className="infoValue">{conference.event_date}</span>
          </div>
          <div className="infoItem">
            <span className="infoLabel">Дедлайн подачі:</span>
            <span className="infoValue">
              {conference.submission_deadline}
              {!isDeadlineActive ? (
                <span className="deadline-past"> (Дедлайн минув)</span>
              ) : (
                <span className="deadline-open"> (Прийом відкрито)</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {conference.institution && (
        <div className="conferenceDetailInstitution">
          <span className="institutionLabel">Навчальний заклад/Організація:</span>
          <span className="institutionValue">{conference.institution}</span>
        </div>
      )}

      {(conference.conference_type === 'OFFLINE' || conference.conference_type === 'HYBRID') && conference.address && (
        <div className="conferenceDetailAddress">
          <span className="addressLabel">Адреса проведення:</span>
          <span className="addressValue">{conference.address}</span>
        </div>
      )}

      <div className="conferenceDetailReviewersSection">
        <h3>Рецензенти</h3>
        <div className="conferenceDetailReviewersList">
          {reviewers.length === 0 ? (
            <span className="noReviewers">Немає призначених рецензентів</span>
          ) : (
            reviewers.map(rev => (
              <Link key={rev.id} to={`/profile/${rev.id}`} className="conferenceDetailReviewerLink">
                <div className="conferenceDetailReviewerCard">
                  <Avatar user={rev} size="small" />
                  <span>{rev.full_name || rev.username}</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      <div className="conferenceDetailDescription">
        <div className="descriptionHeader">
          <h3>Опис конференції</h3>
        </div>
        <div className="descriptionContent">
          {conference.description || 'Опис відсутній'}
        </div>
      </div>

      <div className="conferenceDetailFilesSection">
        <h3>Матеріали конференції</h3>
        {conference.guidelines_file && (
          <div className="conferenceDetailFileItem">
            <button 
              onClick={() => handleOpenFile(conference.conference_id)}
              disabled={openingFile}
              className="conferenceDetailFileButton"
            >
              {openingFile ? 'Завантаження...' : 'Інструкція для авторів'}
            </button>
          </div>
        )}
        {conference.additional_files && conference.additional_files.length > 0 && (
          <div className="conferenceDetailAdditionalFiles">
            <h4>Додаткові матеріали:</h4>
            {conference.additional_files.map((file, index) => (
              <div key={index} className="conferenceDetailFileItem">
                <a href={file.url} target="_blank" rel="noopener noreferrer" className="conferenceDetailFileLink">
                  {file.name}
                </a>
              </div>
            ))}
          </div>
        )}
        {!conference.guidelines_file && (!conference.additional_files || conference.additional_files.length === 0) && (
          <span className="noFiles">Немає завантажених матеріалів</span>
        )}
      </div>

      {canSubmit && (
        <div className="conferenceDetailSubmitSection">
          <button
            onClick={() => navigate(`/submissions/create/${conference.id}`)}
            className="conferenceDetailSubmitButton"
          >
            Подати тезу
          </button>
        </div>
      )}
      
      {isOrganizer && (
        <div className="conferenceDetailOrganizerSection">
          <h2>Управління конференцією</h2>
          
          <div className="conferenceDetailInviteSection">
            <h3>Запросити рецензента</h3>
            <div className="conferenceDetailInviteInfo">
              <p className="invite-info-text">
                <strong>Важливо:</strong> Для запрошення рецензента потрібно вказати 
                <span className="highlight-text"> username (логін)</span> користувача, а не його ім'я та прізвище.
              </p>
              <p className="invite-info-example">
                Наприклад: <code>reviewer_ivan</code> або <code>ivan_petrenko</code>
              </p>
            </div>
            <div className="conferenceDetailInviteForm">
              <div className="invite-input-wrapper">
                <input
                  type="text"
                  placeholder="Введіть username рецензента"
                  value={inviteUsername}
                  onChange={(e) => setInviteUsername(e.target.value)}
                  className="conferenceDetailInviteInput"
                />
                <button 
                  onClick={handleInviteReviewer} 
                  disabled={inviting || !inviteUsername.trim()}
                  className="conferenceDetailInviteButton"
                >
                  {inviting ? 'Запрошення...' : 'Відправити запрошення'}
                </button>
              </div>
              <div className="invite-help-text">
                <span>Як знайти username?</span>
                <ul>
                  <li>Перейдіть в розділ <Link to="/users">Користувачі</Link></li>
                  <li>Знайдіть потрібного рецензента</li>
                  <li>Скопіюйте його <strong>username</strong> (логін)</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="conferenceDetailExportButtons">
            <button 
              onClick={handleExportParticipants}
              disabled={exporting}
              className="conferenceDetailExportButton"
            >
              {exporting ? 'Експорт...' : 'Експортувати учасників'}
            </button>
            
            <button 
              onClick={handleExportSubmissions}
              disabled={exporting}
              className="conferenceDetailExportButton"
            >
              {exporting ? 'Експорт...' : 'Експортувати тези'}
            </button>
          </div>
          
          <Announcements conferenceId={conference.id} isOrganizer={isOrganizer} />
        </div>
      )}
      
      {user && user.role === 'ADMIN' && (
        <div className="conferenceDetailAdminSection">
          <h2>Адміністрування</h2>
          <div>
            <h3>Призначити рецензента (за ID)</h3>
            <div className="conferenceDetailAssignForm">
              <input
                type="text"
                placeholder="ID рецензента"
                value={selectedReviewerId}
                onChange={(e) => setSelectedReviewerId(e.target.value)}
                className="conferenceDetailAssignInput"
              />
              <button 
                onClick={handleAssignReviewer} 
                disabled={assigningReviewer || !selectedReviewerId}
                className="conferenceDetailAssignButton"
              >
                {assigningReviewer ? 'Призначення...' : 'Призначити'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {hasPendingInvitation && (
        <div className="conferenceDetailInvitationAlert">
          <p>У вас є запрошення стати рецензентом цієї конференції</p>
          <Link to="/invitations">
            <button className="conferenceDetailInvitationResponseButton">
              Відповісти на запрошення
            </button>
          </Link>
        </div>
      )}
      
      <div className="conferenceDetailSubmissionsSection">
        <h2>Подані тези ({submissions.length})</h2>
        {submissions.length === 0 ? (
          <p className="noSubmissions">Немає поданих тез</p>
        ) : (
          submissions.map(sub => (
            <div key={sub.id} className="conferenceDetailSubmissionCard">
              <div className="conferenceDetailSubmissionContent">
                <div>
                  <Link to={`/submissions/${sub.id}`} className="conferenceDetailSubmissionTitle">
                    {sub.title}
                  </Link>
                  <p className="conferenceDetailSubmissionMeta">
                    Автор: {sub.author_full_name} | Статус: {getStatusText(sub.status)}
                  </p>
                </div>
                {canSubmit && sub.status === 'DRAFT' && sub.author === user?.id && (
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
                    className="conferenceDetailSubmitReviewButton"
                  >
                    Відправити
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      
      {similarConferences.length > 0 && (
        <div className="conferenceDetailSimilarSection">
          <h2>Схожі конференції</h2>
          <div className="conferenceDetailSimilarList">
            {similarConferences.map(conf => (
              <Link key={conf.id} to={`/conferences/${conf.id}`} className="conferenceDetailSimilarLink">
                <div className="conferenceDetailSimilarCard">
                  <h3 className="conferenceDetailSimilarTitle">{conf.title}</h3>
                  <p className="conferenceDetailSimilarDate">{conf.event_date}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConferenceDetail;