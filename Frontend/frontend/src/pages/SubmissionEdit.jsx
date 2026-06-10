import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import '../styles/SubmissionEdit.css';

const SubmissionEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [submission, setSubmission] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    abstract: '',
    file: null,
    change_comment: '',
  });
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSubmission = async () => {
      try {
        const response = await api.get(`/submissions/${id}/`);
        setSubmission(response.data);
        setFormData({
          title: response.data.title,
          abstract: response.data.abstract || '',
          file: null,
          change_comment: '',
        });
      } catch (error) {
        console.error('Error fetching submission:', error);
        setError('Не вдалося завантажити тезу');
      } finally {
        setFetchLoading(false);
      }
    };
    
    fetchSubmission();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    setFormData(prev => ({ ...prev, file: e.target.files[0] }));
  };

  const handleSaveChanges = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const data = new FormData();
    data.append('title', formData.title);
    data.append('abstract', formData.abstract);
    if (formData.file) {
      data.append('file', formData.file);
    }
    if (formData.change_comment) {
      data.append('change_comment', formData.change_comment);
    }
    
    try {
      const response = await api.patch(`/submissions/${id}/`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      navigate(`/submissions/${response.data.id}`);
    } catch (error) {
      const errors = error.response?.data;
      if (typeof errors === 'object') {
        setError(Object.values(errors).flat().join(', '));
      } else {
        setError('Помилка при оновленні тези');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!window.confirm('Відправити тезу на рецензію?')) return;
    setSubmitLoading(true);
    try {
      await api.post(`/submissions/${id}/submit/`);
      const response = await api.get(`/submissions/${id}/`);
      navigate(`/submissions/${response.data.id}`);
    } catch (error) {
      alert(error.response?.data?.error || 'Помилка при відправленні');
    } finally {
      setSubmitLoading(false);
    }
  };

  if (fetchLoading) return <div className="loading">Завантаження...</div>;
  if (!submission) return <div className="error">Тезу не знайдено</div>;

  const canSubmit = submission.status === 'DRAFT' || submission.status === 'REVISION_REQUIRED';
  const isRevision = submission.status === 'REVISION_REQUIRED';

  return (
    <div className="submissionEditContainer">
      <div className="submissionEditBackLink">
        <a href="#" onClick={(e) => { e.preventDefault(); navigate(`/submissions/${id}`); }} className="submissionEditBackLink">
          Назад до тези
        </a>
      </div>
      
      <h1>Редагування тези</h1>
      
      {error && <div className="submissionEditError">{error}</div>}
      
      <div className="submissionEditInfo">
        <div className="submissionEditInfoRow">
          <strong>Поточний статус:</strong>
          <span className={`submissionEditStatus status-${submission.status?.toLowerCase()}`}>
            {submission.status === 'DRAFT' ? 'Чернетка' :
             submission.status === 'REVISION_REQUIRED' ? 'Потребує доопрацювання' :
             submission.status === 'PENDING' ? 'На рецензуванні' :
             submission.status === 'ACCEPTED' ? 'Прийнято' :
             submission.status === 'REJECTED' ? 'Відхилено' :
             submission.status}
          </span>
        </div>
        <div className="submissionEditInfoRow">
          <strong>Версія:</strong> {submission.version}
        </div>
        {submission.reviewer_comment && (
          <div className="submissionEditInfoRow submissionEditReviewerComment">
            <strong>Коментар рецензента:</strong>
            <p>{submission.reviewer_comment}</p>
          </div>
        )}
      </div>
      
      <form className="submissionEditForm">
        <div className="submissionEditField">
          <label className="submissionEditLabel">Назва тези *</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            className="submissionEditInput"
          />
        </div>
        
        <div className="submissionEditField">
          <label className="submissionEditLabel">Анотація</label>
          <textarea
            name="abstract"
            value={formData.abstract}
            onChange={handleChange}
            rows="5"
            className="submissionEditTextarea"
          />
        </div>
        
        <div className="submissionEditField">
          <label className="submissionEditLabel">Новий файл (залиште порожнім, щоб залишити поточний)</label>
          <input
            type="file"
            name="file"
            onChange={handleFileChange}
            accept=".pdf,.doc,.docx"
            className="submissionEditFileInput"
          />
          {submission.file && (
            <small className="submissionEditCurrentFile">
              Поточний файл: <a href={submission.file} target="_blank" rel="noopener noreferrer">завантажити</a>
            </small>
          )}
        </div>
        
        {isRevision && (
          <div className="submissionEditField">
            <label className="submissionEditLabel">Коментар до змін *</label>
            <textarea
              name="change_comment"
              value={formData.change_comment}
              onChange={handleChange}
              placeholder="Опишіть внесені зміни..."
              rows="3"
              className="submissionEditTextarea"
            />
            <small className="submissionEditHint">
              Обов'язково опишіть, які зміни ви внесли після отримання зауважень
            </small>
          </div>
        )}
        
        <div className="submissionEditButtons">
          <button
            type="button"
            onClick={handleSaveChanges}
            disabled={loading}
            className="submissionEditSaveButton"
          >
            {loading ? 'Збереження...' : 'Зберегти зміни'}
          </button>
          
          {canSubmit && (
            <button
              type="button"
              onClick={handleSubmitForReview}
              disabled={submitLoading || (isRevision && !formData.change_comment.trim())}
              className="submissionEditSubmitButton"
            >
              {submitLoading ? 'Відправлення...' : 'Відправити на рецензію'}
            </button>
          )}
          
          <button
            type="button"
            onClick={() => navigate(`/submissions/${id}`)}
            className="submissionEditCancelButton"
          >
            Скасувати
          </button>
        </div>
        
        {isRevision && !formData.change_comment.trim() && (
          <p className="submissionEditWarning">
            Для відправлення на рецензію після доопрацювання обов'язково заповніть коментар до змін
          </p>
        )}
      </form>
    </div>
  );
};

export default SubmissionEdit;