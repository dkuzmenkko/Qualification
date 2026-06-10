import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import '../styles/SubmissionDetail.css'; 

const SubmissionDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [submission, setSubmission] = useState(null);
  const [versions, setVersions] = useState([]);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reviewAction, setReviewAction] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const { success, error: showError } = useNotification();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [subRes, versionsRes, commentsRes] = await Promise.all([
          api.get(`/submissions/${id}/`),
          api.get(`/submissions/${id}/versions/`),
          api.get(`/discussion/submissions/${id}/comments/`)
        ]);
        setSubmission(subRes.data);
        setVersions(versionsRes.data);
        setComments(commentsRes.data);
      } catch (error) {
        console.error('Error fetching submission:', error);
        if (error.response?.status === 403) {
          alert('У вас немає прав для перегляду цієї тези');
          navigate('/');
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id, navigate]);

  const handleSubmitForReview = async () => {
    if (!window.confirm('Відправити тезу на рецензію?')) return;
    setSubmitting(true);
    try {
      await api.post(`/submissions/${id}/submit/`);
      success('Тезу відправлено на рецензію');
      const subRes = await api.get(`/submissions/${id}/`);
      setSubmission(subRes.data);
    } catch (err) {
      showError(err.response?.data?.error || 'Помилка при відправленні');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Ви впевнені, що хочете видалити цю чернетку?')) return;
    setDeleting(true);
    try {
      await api.delete(`/submissions/${id}/`);
      success('Чернетку успішно видалено');
      navigate('/submissions');
    } catch (err) {
      showError(err.response?.data?.error || 'Помилка при видаленні');
    } finally {
      setDeleting(false);
    }
  };

  const handleReview = async () => {
    if (!reviewAction) {
      showError('Виберіть дію');
      return;
    }
    setReviewing(true);
    try {
      await api.post(`/submissions/${id}/review/`, {
        action: reviewAction,
        comment: reviewComment
      });
      const actionText = reviewAction === 'ACCEPT' ? 'прийнято' : 
                         reviewAction === 'REJECT' ? 'відхилено' : 'відправлено на доопрацювання';
      success(`Тезу ${actionText}`);
      const subRes = await api.get(`/submissions/${id}/`);
      setSubmission(subRes.data);
      setReviewAction('');
      setReviewComment('');
    } catch (err) {
      showError(err.response?.data?.error || 'Помилка при рецензуванні');
    } finally {
      setReviewing(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      const data = { text: newComment };
      if (replyTo) data.parent = replyTo;
      
      await api.post(`/discussion/submissions/${id}/comments/`, data);
      success('Коментар додано');
      setNewComment('');
      setReplyTo(null);
      
      const commentsRes = await api.get(`/discussion/submissions/${id}/comments/`);
      setComments(commentsRes.data);
    } catch (err) {
      showError(err.response?.data?.error || 'Помилка при додаванні коментаря');
    }
  };

  const handleVote = async (commentId, vote) => {
    try {
      await api.post(`/discussion/comments/${commentId}/vote/`, { vote });
      const commentsRes = await api.get(`/discussion/submissions/${id}/comments/`);
      setComments(commentsRes.data);
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  const handleExportPDF = async () => {
    try {
      const response = await api.get(`/exports/submissions/${id}/pdf/`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `thesis_${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      success('PDF експортовано');
    } catch (err) {
      showError('Помилка при експорті PDF');
    }
  };

  const isAuthor = user && submission && submission.author === user.id;
  const isReviewer = user && submission && submission.reviewer === user.id;
  const isOrganizer = user && submission && submission.conference_detail?.organizer?.id === user.id;
  const canReview = (isReviewer || isOrganizer) && submission.status === 'PENDING';
  const canSubmit = isAuthor && (submission?.status === 'DRAFT' || submission?.status === 'REVISION_REQUIRED');
  const canEdit = isAuthor && (submission?.status === 'DRAFT' || submission?.status === 'REVISION_REQUIRED');
  const canDelete = submission?.can_delete === true;

  if (loading) return <div>Завантаження...</div>;
  if (!submission) return <div>Тезу не знайдено</div>;

  return (
    <div className="submissionDetailContainer">
      <div className="submissionDetailBackLink">
        <Link to="/submissions">← Назад до списку тез</Link>
      </div>
    
      <h1>{submission.title}</h1>
      
      <div className="submissionDetailInfo">
        <p><strong>Конференція:</strong> <Link to={`/conferences/${submission.conference}`}>{submission.conference_title}</Link></p>
        <p><strong>Автор:</strong> <Link to={`/profile/${submission.author}`}>{submission.author_full_name}</Link></p>
        {submission.reviewer && (
          <p><strong>Рецензент:</strong> <Link to={`/profile/${submission.reviewer}`}>{submission.reviewer_username}</Link></p>
        )}
        <p>
          <strong>Статус:</strong> 
          <span className={`submissionDetailStatus submissionDetailStatus${submission.status}`}>
            {submission.status === 'DRAFT' ? 'Чернетка' : 
             submission.status === 'PENDING' ? 'На рецензуванні' :
             submission.status === 'REVISION_REQUIRED' ? 'Потребує доопрацювання' :
             submission.status === 'ACCEPTED' ? 'Прийнято' : 'Відхилено'}
          </span>
        </p>
        <p><strong>Версія:</strong> {submission.version}</p>
        <p><strong>Створено:</strong> {new Date(submission.created_at).toLocaleString()}</p>
        {submission.submitted_at && (
          <p><strong>Відправлено на рецензію:</strong> {new Date(submission.submitted_at).toLocaleString()}</p>
        )}
        <p><strong>Переглядів:</strong> {submission.views_count}</p>
        <p><strong>Коментарів:</strong> {submission.comments_count}</p>
      </div>
      
      {submission.abstract && (
        <div className="submissionDetailAbstract">
          <h2>Анотація</h2>
          <p>{submission.abstract}</p>
        </div>
      )}
      
      {submission.file_url && (
        <div className="submissionDetailFile">
          <h2>Файл</h2>
          <a href={submission.file_url} target="_blank" rel="noopener noreferrer" className="submissionDetailFileLink">
            Завантажити файл {submission.file_name && `(${submission.file_name})`}
          </a>
        </div>
      )}
      
      {submission.reviewer_comment && (
        <div className="submissionDetailReviewerComment">
          <h2>Коментар рецензента</h2>
          <p>{submission.reviewer_comment}</p>
        </div>
      )}
      
      <div className="submissionDetailActions">
        <button onClick={handleExportPDF} className="submissionDetailExportButton">
          Експортувати PDF
        </button>
        
        {canSubmit && (
          <button onClick={handleSubmitForReview} disabled={submitting} className="submissionDetailSubmitButton">
            {submitting ? 'Відправлення...' : 'Відправити на рецензію'}
          </button>
        )}
        
        {canEdit && (
          <Link to={`/submissions/edit/${submission.id}`}>
            <button className="submissionDetailEditButton">Редагувати</button>
          </Link>
        )}
        
        {canDelete && (
          <button onClick={handleDelete} disabled={deleting} className="submissionDetailDeleteButton">
            {deleting ? 'Видалення...' : 'Видалити чернетку'}
          </button>
        )}
      </div>
      
      {canReview && (
        <div className="submissionDetailReviewSection">
          <h2>Рецензування</h2>
          <div className="submissionDetailReviewField">
            <label className="submissionDetailReviewLabel">Результат рецензії *</label>
            <select value={reviewAction} onChange={(e) => setReviewAction(e.target.value)} className="submissionDetailReviewSelect">
              <option value="">Виберіть дію</option>
              <option value="ACCEPT">Прийняти</option>
              <option value="REJECT">Відхилити</option>
              <option value="REVISION">Потребує доопрацювання</option>
            </select>
          </div>
          <div className="submissionDetailReviewField">
            <label className="submissionDetailReviewLabel">Коментар рецензента</label>
            <textarea
              placeholder="Ваш коментар до тези..."
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              rows="4"
              className="submissionDetailReviewTextarea"
            />
          </div>
          <button onClick={handleReview} disabled={reviewing || !reviewAction} className="submissionDetailReviewSubmitButton">
            {reviewing ? 'Відправлення...' : 'Відправити рецензію'}
          </button>
        </div>
      )}
      
      <div className="submissionDetailVersions">
        <h2>Версії</h2>
        <div className="submissionDetailVersionsList">
          {versions.map(ver => (
            <div key={ver.id} className={`submissionDetailVersionItem ${ver.id === submission.id ? 'submissionDetailVersionCurrent' : 'submissionDetailVersionOld'}`}>
              <span><strong>Версія {ver.version}</strong></span>
              <span>Статус: {ver.status === 'DRAFT' ? 'Чернетка' : 
                ver.status === 'PENDING' ? 'На рецензуванні' :
                ver.status === 'REVISION_REQUIRED' ? 'Потребує доопрацювання' :
                ver.status === 'ACCEPTED' ? 'Прийнято' : 'Відхилено'}</span>
              <span>{new Date(ver.created_at).toLocaleString()}</span>
              {ver.id !== submission.id && (
                <Link to={`/submissions/${ver.id}`}>Переглянути</Link>
              )}
              {ver.id === submission.id && (
                <span className="submissionDetailVersionCurrentBadge">Поточна версія</span>
              )}
            </div>
          ))}
        </div>
      </div>
      
      <div className="submissionDetailDiscussion">
        <h2>Обговорення</h2>
        
        <div className="submissionDetailAddComment">
          <h3>Додати коментар</h3>
          {replyTo && (
            <div className="submissionDetailReplyTo">
              <span>Відповідь на коментар</span>
              <button onClick={() => setReplyTo(null)}>✕</button>
            </div>
          )}
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Ваш коментар..."
            rows="3"
            className="submissionDetailCommentTextarea"
          />
          <button onClick={handleAddComment} disabled={!newComment.trim()} className="submissionDetailAddCommentButton">
            Відправити коментар
          </button>
        </div>
        
        {comments.length === 0 ? (
          <p>Немає коментарів. Будьте першим, хто прокоментує!</p>
        ) : (
          comments.map(comment => (
            <div key={comment.id} className="submissionDetailComment">
              <div className="submissionDetailCommentCard">
                <div className="submissionDetailCommentHeader">
                  <div>
                    <strong><Link to={`/profile/${comment.author?.id}`}>{comment.author?.full_name || comment.author?.username}</Link></strong>
                    <span className="submissionDetailCommentDate">
                      {new Date(comment.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div>Рейтинг: {comment.rating}</div>
                </div>
            
                
                {comment.is_deleted ? (
                  <p className="submissionDetailCommentDeleted">Коментар видалено</p>
                ) : (
                  <>
                    <p className="submissionDetailCommentText">{comment.text}</p>
                    <div className="submissionDetailCommentActions">
                      <button onClick={() => handleVote(comment.id, 1)}>+ {comment.likes_count}</button>
                      <button onClick={() => handleVote(comment.id, -1)}>- {comment.dislikes_count}</button>
                      <button onClick={() => setReplyTo(comment.id)}>Відповісти</button>
                    </div>
                  </>
                )}
              </div>
              
              {comment.replies && comment.replies.map(reply => (
                <div key={reply.id} className="submissionDetailCommentReply">
                  <div className="submissionDetailCommentCard">
                    <div className="submissionDetailCommentHeader">
                      <div>
                        <strong><Link to={`/profile/${reply.author?.id}`}>{reply.author?.full_name || reply.author?.username}</Link></strong>
                        <span className="submissionDetailCommentDate">
                          {new Date(reply.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <p>{reply.text}</p>
                    <div className="submissionDetailCommentActions">
                      <button onClick={() => handleVote(reply.id, 1)}>+{reply.likes_count}</button>
                      <button onClick={() => handleVote(reply.id, -1)}>-{reply.dislikes_count}</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SubmissionDetail;