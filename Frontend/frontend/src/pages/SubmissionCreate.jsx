// src/pages/SubmissionCreate.js

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import '../styles/SubmissionCreate.css';

const SubmissionCreate = () => {
  const { conferenceId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { success, error: showError } = useNotification();
  const [conference, setConference] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    abstract: '',
    file: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [conferenceLoading, setConferenceLoading] = useState(true);
  const [permissionError, setPermissionError] = useState(null);

  useEffect(() => {
    const fetchConference = async () => {
      try {
        const response = await api.get(`/conferences/${conferenceId}/`);
        setConference(response.data);
        
        if (user) {
          if (response.data.organizer?.id === user.id) {
            setPermissionError('Організатор конференції не може подавати тези на власну конференцію');
          }
          else if (response.data.reviewers?.some(r => r.id === user.id)) {
            setPermissionError('Ви є рецензентом цієї конференції і не можете подавати тези');
          }
          else if (user.role !== 'AUTHOR' && user.role !== 'REVIEWER' && user.role !== 'ADMIN') {
            setPermissionError(`Користувач з роллю ${user.role} не може подавати тези`);
          }
          else if (user.role === 'REVIEWER' && !user.is_approved) {
            console.log('Рецензент не підтверджений, але може подавати тези');
          }
        }
      } catch (error) {
        console.error('Error fetching conference:', error);
        setError('Конференцію не знайдено');
      } finally {
        setConferenceLoading(false);
      }
    };
    
    fetchConference();
  }, [conferenceId, user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('Розмір файлу не повинен перевищувати 10MB');
        e.target.value = '';
        return;
      }
      
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        setError('Дозволені формати: PDF, DOC, DOCX');
        e.target.value = '';
        return;
      }
      
      setError('');
      setFormData(prev => ({ ...prev, file }));
    }
  };

  const handleSaveDraft = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const data = new FormData();
      data.append('title', formData.title);
      data.append('abstract', formData.abstract);
      data.append('conference', conferenceId);
      if (formData.file) {
        data.append('file', formData.file);
      }
      
      const response = await api.post('/submissions/', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      success('Чернетку збережено');
      navigate(`/submissions/${response.data.id}`);
      
    } catch (err) {
      if (err.response?.status === 403) {
        showError(err.response?.data?.error || 'У вас немає прав для подання тези');
      } else if (err.response?.data?.error) {
        showError(err.response.data.error);
      } else {
        showError('Помилка при створенні чернетки');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitImmediately = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const data = new FormData();
      data.append('title', formData.title);
      data.append('abstract', formData.abstract);
      data.append('conference', conferenceId);
      if (formData.file) {
        data.append('file', formData.file);
      }
      
      const createResponse = await api.post('/submissions/', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const submissionId = createResponse.data.id;
      if (!submissionId) {
        throw new Error('Сервер не повернув ID тези');
      }
      
      await api.post(`/submissions/${submissionId}/submit/`);
      
      success('Тезу успішно подано на рецензію');
      navigate(`/submissions/${submissionId}`);
      
    } catch (err) {
      if (err.response?.status === 403) {
        showError(err.response?.data?.error || 'У вас немає прав для подання тези');
      } else if (err.response?.data?.error) {
        showError(err.response.data.error);
      } else {
        showError('Помилка при поданні тези: ' + (err.message || 'Невідома помилка'));
      }
    } finally {
      setLoading(false);
    }
  };

  if (conferenceLoading) return <div>Завантаження...</div>;
  if (!conference) return <div>Конференцію не знайдено</div>;
  
  if (permissionError) {
    return (
      <div className="submissionCreateContainer">
        <h1>Помилка доступу</h1>
        <div className="submissionCreatePermissionError">
          <p>{permissionError}</p>
          <button 
            onClick={() => navigate('/conferences')}
            className="submissionCreateBackButton"
          >
            Повернутися до списку конференцій
          </button>
        </div>
      </div>
    );
  }

  const isDeadlinePassed = new Date(conference.submission_deadline) < new Date();

  return (
    <div className="submissionCreateContainer">
      <h1>Подання тези</h1>
      <h2>Конференція: {conference.title}</h2>
      <p><strong>Дедлайн подачі:</strong> {conference.submission_deadline}</p>
      
      {user?.role === 'REVIEWER' && !user.is_approved && (
        <div className="submissionCreateWarning">
          Ваш акаунт рецензента ще не підтверджено, але ви можете подавати тези.
        </div>
      )}
      
      {isDeadlinePassed && (
        <div className="submissionCreateDeadlineWarning">
          Увага! Дедлайн подачі тез вже минув.
        </div>
      )}
      
      {error && (
        <div className="submissionCreateError">
          <strong>Помилка:</strong> {error}
        </div>
      )}
      
      <form className="submissionCreateForm">
        <div className="submissionCreateField">
          <label className="submissionCreateLabel">Назва тези *</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            className="submissionCreateInput"
          />
        </div>
        
        <div className="submissionCreateField">
          <label className="submissionCreateLabel">Анотація</label>
          <textarea
            name="abstract"
            value={formData.abstract}
            onChange={handleChange}
            rows="5"
            className="submissionCreateTextarea"
          />
        </div>
        
        <div className="submissionCreateField">
          <label className="submissionCreateLabel">Файл (PDF, DOC, DOCX) макс. 10MB</label>
          <input
            type="file"
            name="file"
            onChange={handleFileChange}
            accept=".pdf,.doc,.docx"
            className="submissionCreateFileInput"
          />
          <small className="submissionCreateHint">
            Підтримуються формати: PDF, DOC, DOCX. Максимальний розмір: 10MB
          </small>
        </div>
        
        <div className="submissionCreateButtons">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={loading || isDeadlinePassed}
            className="submissionCreateDraftButton"
          >
            {loading ? 'Збереження...' : 'Зберегти як чернетку'}
          </button>
          
          <button
            type="button"
            onClick={handleSubmitImmediately}
            disabled={loading || isDeadlinePassed || !formData.title.trim()}
            className="submissionCreateSubmitButton"
          >
            {loading ? 'Подання...' : 'Подати на рецензію'}
          </button>
        </div>
        
        {!formData.title.trim() && (
          <p className="submissionCreateHintText">
            * Заповніть назву тези для подання на рецензію
          </p>
        )}
      </form>
    </div>
  );
};

export default SubmissionCreate;