// src/pages/ConferenceCreate.js

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useNotification } from '../contexts/NotificationContext';
import '../styles/ConferenceCreate.css';

const ConferenceCreate = () => {
  const navigate = useNavigate();
  const { success, error: showError } = useNotification();
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    event_date: '',
    submission_deadline: '',
    institution: '',
    conference_type: 'ONLINE',
    online_link: '',
    address: '',
    guidelines_file: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.get('/users/categories/');
        setCategories(response.data.categories);
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };
    fetchCategories();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleConferenceTypeChange = (e) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, conference_type: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('Розмір файлу не повинен перевищувати 10MB');
        e.target.value = '';
        setFileName('');
        return;
      }
      
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        setError('Дозволені формати: PDF, DOC, DOCX');
        e.target.value = '';
        setFileName('');
        return;
      }
      
      setError('');
      setFormData(prev => ({ ...prev, guidelines_file: file }));
      setFileName(file.name);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const data = new FormData();
    data.append('title', formData.title);
    data.append('description', formData.description);
    data.append('category', formData.category);
    data.append('event_date', formData.event_date);
    data.append('submission_deadline', formData.submission_deadline);
    data.append('institution', formData.institution);
    data.append('conference_type', formData.conference_type);
    if (formData.online_link) {
      data.append('online_link', formData.online_link);
    }
    if (formData.address) {
      data.append('address', formData.address);
    }
    if (formData.guidelines_file) {
      data.append('guidelines_file', formData.guidelines_file);
    }
    
    try {
      const response = await api.post('/conferences/', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      success('Конференцію успішно створено');
      navigate(`/conferences/${response.data.id}`);
    } catch (err) {
      const errors = err.response?.data;
      if (typeof errors === 'object') {
        setError(Object.values(errors).flat().join(', '));
      } else {
        setError('Помилка при створенні конференції');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="conferenceCreateContainer">
      <h1>Створення конференції</h1>
      
      {error && <div className="conferenceCreateError">{error}</div>}
      
      <form onSubmit={handleSubmit} className="conferenceCreateForm">
        <div className="conferenceCreateField">
          <label className="conferenceCreateLabel">Назва конференції *</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            className="conferenceCreateInput"
          />
        </div>
        
        <div className="conferenceCreateField">
          <label className="conferenceCreateLabel">Опис</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows="5"
            className="conferenceCreateTextarea"
          />
        </div>
        
        <div className="conferenceCreateRow">
          <div className="conferenceCreateField">
            <label className="conferenceCreateLabel">Категорія *</label>
            <select 
              name="category" 
              value={formData.category} 
              onChange={handleChange} 
              required
              className="conferenceCreateSelect"
            >
              <option value="">Виберіть категорію</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          
          <div className="conferenceCreateField">
            <label className="conferenceCreateLabel">Навчальний заклад/Організація</label>
            <input
              type="text"
              name="institution"
              value={formData.institution}
              onChange={handleChange}
              placeholder="Назва закладу або організації"
              className="conferenceCreateInput"
            />
          </div>
        </div>
        
        <div className="conferenceCreateRow">
          <div className="conferenceCreateField">
            <label className="conferenceCreateLabel">Дата проведення *</label>
            <input
              type="date"
              name="event_date"
              value={formData.event_date}
              onChange={handleChange}
              required
              className="conferenceCreateInput"
            />
          </div>
          
          <div className="conferenceCreateField">
            <label className="conferenceCreateLabel">Дедлайн подачі *</label>
            <input
              type="date"
              name="submission_deadline"
              value={formData.submission_deadline}
              onChange={handleChange}
              required
              className="conferenceCreateInput"
            />
          </div>
        </div>
        
        <div className="conferenceCreateField">
          <label className="conferenceCreateLabel">Тип проведення *</label>
          <div className="conferenceTypeRadioGroup">
            <label className="radio-label">
              <input
                type="radio"
                name="conference_type"
                value="ONLINE"
                checked={formData.conference_type === 'ONLINE'}
                onChange={handleConferenceTypeChange}
              />
              <span>Онлайн</span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="conference_type"
                value="OFFLINE"
                checked={formData.conference_type === 'OFFLINE'}
                onChange={handleConferenceTypeChange}
              />
              <span>Офлайн</span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="conference_type"
                value="HYBRID"
                checked={formData.conference_type === 'HYBRID'}
                onChange={handleConferenceTypeChange}
              />
              <span>Гібридний (офлайн + онлайн)</span>
            </label>
          </div>
        </div>
        
        {(formData.conference_type === 'ONLINE' || formData.conference_type === 'HYBRID') && (
          <div className="conferenceCreateField">
            <label className="conferenceCreateLabel">
              Посилання для онлайн участі *
              {(formData.conference_type === 'ONLINE' || formData.conference_type === 'HYBRID') && (
                <span className="required-star">*</span>
              )}
            </label>
            <input
              type="url"
              name="online_link"
              value={formData.online_link}
              onChange={handleChange}
              placeholder="https://zoom.us/... або https://meet.google.com/..."
              className="conferenceCreateInput"
            />
            <small className="conferenceCreateHint">
              Посилання на Zoom, Google Meet або іншу платформу для онлайн підключення
            </small>
          </div>
        )}
        
        {(formData.conference_type === 'OFFLINE' || formData.conference_type === 'HYBRID') && (
          <div className="conferenceCreateField">
            <label className="conferenceCreateLabel">
              Адреса проведення *
              {(formData.conference_type === 'OFFLINE' || formData.conference_type === 'HYBRID') && (
                <span className="required-star">*</span>
              )}
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Місто, вулиця, номер будинку, аудиторія..."
              rows="3"
              className="conferenceCreateTextarea"
            />
          </div>
        )}
        
        <div className="conferenceCreateField">
          <label className="conferenceCreateLabel">
            Інструкція для авторів (PDF, DOC, DOCX, макс. 10MB)
          </label>
          <div className="conferenceCreateFileWrapper">
            <input
              type="file"
              name="guidelines_file"
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx"
              className="conferenceCreateFileInput"
              id="guidelines-file"
            />
            <label htmlFor="guidelines-file" className="conferenceCreateFileLabel">
              {fileName || 'Виберіть файл'}
            </label>
          </div>
          <small className="conferenceCreateHint">
            Завантажте PDF з інструкціями для авторів (не обов'язково)
          </small>
        </div>
        
        <div className="conferenceCreateButtons">
          <button 
            type="submit" 
            disabled={loading}
            className="conferenceCreateSubmitButton"
          >
            {loading ? 'Створення...' : 'Створити конференцію'}
          </button>
          <button 
            type="button" 
            onClick={() => navigate('/conferences')}
            className="conferenceCreateCancelButton"
          >
            Скасувати
          </button>
        </div>
      </form>
    </div>
  );
};

export default ConferenceCreate;