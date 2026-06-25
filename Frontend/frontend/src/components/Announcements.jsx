import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useNotification } from '../contexts/NotificationContext';
import '../styles/ConferenceDetail.css';

const Announcements = ({ conferenceId, isOrganizer }) => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    send_email: true,
    send_push: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState({});
  const { success, error: showError } = useNotification();

  useEffect(() => {
    if (isOrganizer) {
      fetchAnnouncements();
    }
  }, [conferenceId, isOrganizer]);

  const fetchAnnouncements = async () => {
    try {
      const response = await api.get(`/conferences/${conferenceId}/announcements/`);
      setAnnouncements(response.data);
    } catch (error) {
      console.error('Error fetching announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const response = await api.post(`/conferences/${conferenceId}/announcements/create/`, formData);
      success(response.data.message);
      setFormData({
        title: '',
        content: '',
        send_email: true,
        send_push: true,
      });
      setShowForm(false);
      await fetchAnnouncements();
    } catch (error) {
      showError(error.response?.data?.error || 'Помилка при створенні оголошення');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async (announcementId) => {
    setResending(prev => ({ ...prev, [announcementId]: true }));
    try {
      const response = await api.post(`/conferences/${conferenceId}/announcements/${announcementId}/resend/`);
      success(response.data.message);
    } catch (error) {
      showError(error.response?.data?.error || 'Помилка при повторній відправці');
    } finally {
      setResending(prev => ({ ...prev, [announcementId]: false }));
    }
  };

  const handleDelete = async (announcementId) => {
    if (!window.confirm('Ви впевнені, що хочете видалити це оголошення?')) return;
    try {
      await api.delete(`/conferences/${conferenceId}/announcements/${announcementId}/delete/`);
      success('Оголошення видалено');
      await fetchAnnouncements();
    } catch (error) {
      showError(error.response?.data?.error || 'Помилка при видаленні');
    }
  };

  if (!isOrganizer) return null;
  if (loading) return <div className="loading">Завантаження...</div>;

  return (
    <div className="announcements-section">
      <div className="announcements-header">
        <h2>Оголошення для учасників</h2>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="announcements-add-button"
        >
          {showForm ? 'Скасувати' : 'Створити оголошення'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="announcements-form">
          <div className="form-group">
            <label>Заголовок *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              placeholder="Тема оголошення"
            />
          </div>

          <div className="form-group">
            <label>Текст оголошення *</label>
            <textarea
              name="content"
              value={formData.content}
              onChange={handleChange}
              required
              rows="5"
              placeholder="Детальний текст оголошення..."
            />
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                name="send_email"
                checked={formData.send_email}
                onChange={handleChange}
              />
              Відправити на email
            </label>
            <label>
              <input
                type="checkbox"
                name="send_push"
                checked={formData.send_push}
                onChange={handleChange}
              />
              Відправити push-сповіщення
            </label>
          </div>

          <div className="form-actions">
            <button type="submit" disabled={submitting} className="submit-button">
              {submitting ? 'Відправлення...' : 'Відправити оголошення'}
            </button>
          </div>
        </form>
      )}

      <div className="announcements-list">
        <h3>Історія оголошень</h3>
        {announcements.length === 0 ? (
          <p className="no-announcements">Немає створених оголошень</p>
        ) : (
          announcements.map(ann => (
            <div key={ann.id} className="announcement-card">
              <div className="announcement-header">
                <div>
                  <h4>{ann.title}</h4>
                  <span className="announcement-date">
                    {new Date(ann.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="announcement-stats">
                  <span className="stat-badge">
                    {ann.send_email ? 'Email так' : 'Email ні'}
                  </span>
                  <span className="stat-badge">
                    {ann.send_push ? 'Push так' : 'Push ні'}
                  </span>
                  <span className="stat-badge">
                    {ann.sent_to_count} отримувачів
                  </span>
                </div>
              </div>
              <div className="announcement-content">
                <p>{ann.content}</p>
              </div>
              <div className="announcement-footer">
                <span className="author">
                  Відправник: {ann.created_by_name || ann.created_by_username}
                </span>
                {ann.sent_at && (
                  <span className="sent-at">
                    Відправлено: {new Date(ann.sent_at).toLocaleString()}
                  </span>
                )}
                <div className="announcement-actions">
                  <button 
                    onClick={() => handleResend(ann.id)}
                    disabled={resending[ann.id]}
                    className="resend-button"
                  >
                    {resending[ann.id] ? 'Відправка...' : 'Повторно відправити'}
                  </button>
                  <button 
                    onClick={() => handleDelete(ann.id)}
                    className="delete-button"
                  >
                    Видалити
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Announcements;