import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useNotification } from '../contexts/NotificationContext';
import '../styles/SubmitByConferenceId.css';

const SubmitByConferenceId = ({ isOpen, onClose }) => {
  const [conferenceId, setConferenceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [conferenceInfo, setConferenceInfo] = useState(null);
  const [checking, setChecking] = useState(false);
  const navigate = useNavigate();
  const { success, error: showError } = useNotification();

  const handleCheckConference = async () => {
    if (!conferenceId.trim()) {
      setError('Введіть ID конференції');
      return;
    }

    setChecking(true);
    setError('');
    setConferenceInfo(null);

    try {
      const response = await api.get('/conferences/', {
        params: { conference_id: conferenceId }
      });
      
      if (response.data && response.data.length > 0) {
        const conference = response.data[0];
        
        const isDeadlineActive = new Date(conference.submission_deadline) >= new Date();
        
        if (!isDeadlineActive) {
          setError('Дедлайн подачі тез на цю конференцію вже минув');
          setConferenceInfo(null);
        } else {
          setConferenceInfo(conference);
        }
      } else {
        setError('Конференцію з таким ID не знайдено');
      }
    } catch (err) {
      setError('Помилка при пошуку конференції');
      console.error(err);
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = () => {
    if (conferenceInfo) {
      onClose();
      navigate(`/submissions/create/${conferenceInfo.id}`);
      success(`Подача тези на конференцію "${conferenceInfo.title}"`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="submit-modal-overlay" onClick={onClose}>
      <div className="submit-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="submit-modal-header">
          <h2>Подати тезу</h2>
          <button className="submit-modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="submit-modal-body">
          <p className="submit-modal-description">
            Введіть ID конференції, на яку ви хочете подати тезу.
            ID можна знайти на сторінці конференції.
          </p>
          
          <div className="submit-input-group">
            <label>ID конференції</label>
            <div className="submit-input-with-button">
              <input
                type="text"
                value={conferenceId}
                onChange={(e) => {
                  setConferenceId(e.target.value);
                  setError('');
                  setConferenceInfo(null);
                }}
                placeholder="Наприклад: 00000013"
                className="submit-input"
                disabled={checking}
              />
              <button 
                onClick={handleCheckConference}
                disabled={checking || !conferenceId.trim()}
                className="submit-check-button"
              >
                {checking ? 'Перевірка...' : 'Перевірити'}
              </button>
            </div>
          </div>
          
          {error && (
            <div className="submit-error">
              {error}
            </div>
          )}
          
          {conferenceInfo && (
            <div className="submit-conference-info">
              <h3>Знайдено конференцію:</h3>
              <div className="conference-details">
                <p><strong>Назва:</strong> {conferenceInfo.title}</p>
                <p><strong>Категорія:</strong> {conferenceInfo.category}</p>
                <p><strong>Дедлайн подачі:</strong> {conferenceInfo.submission_deadline}</p>
                <p><strong>Дата проведення:</strong> {conferenceInfo.event_date}</p>
                {conferenceInfo.institution && (
                  <p><strong>Організація:</strong> {conferenceInfo.institution}</p>
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="submit-modal-footer">
          <button onClick={onClose} className="submit-cancel-button">
            Скасувати
          </button>
          <button 
            onClick={handleSubmit}
            disabled={!conferenceInfo}
            className="submit-button"
          >
            Подати тезу
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubmitByConferenceId;