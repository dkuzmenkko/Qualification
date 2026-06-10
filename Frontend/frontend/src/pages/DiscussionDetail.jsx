// src/pages/DiscussionDetail.js

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import Avatar from '../components/Avatar';
import '../styles/Discussions.css';

const DiscussionDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [submission, setSubmission] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editingComment, setEditingComment] = useState(null);
  const [editText, setEditText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sortBy, setSortBy] = useState('rating');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [subRes, commentsRes, statsRes] = await Promise.all([
          api.get(`/submissions/${id}/`),
          api.get(`/discussion/submissions/${id}/comments/?sort=${sortBy}`),
          api.get(`/discussion/submissions/${id}/comments/stats/`)
        ]);
        setSubmission(subRes.data);
        setComments(commentsRes.data);
        setStats(statsRes.data);
      } catch (error) {
        console.error('Error fetching discussion:', error);
        if (error.response?.status === 403) {
          alert('У вас немає прав для перегляду цього обговорення');
          navigate('/discussions');
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id, navigate, sortBy]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const data = { text: newComment };
      if (replyTo) data.parent = replyTo;
      
      await api.post(`/discussion/submissions/${id}/comments/`, data);
      setNewComment('');
      setReplyTo(null);
      
      const [commentsRes, statsRes] = await Promise.all([
        api.get(`/discussion/submissions/${id}/comments/?sort=${sortBy}`),
        api.get(`/discussion/submissions/${id}/comments/stats/`)
      ]);
      setComments(commentsRes.data);
      setStats(statsRes.data);
      
      const subRes = await api.get(`/submissions/${id}/`);
      setSubmission(subRes.data);
    } catch (error) {
      alert(error.response?.data?.error || 'Помилка при додаванні коментаря');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditComment = async (commentId) => {
    if (!editText.trim()) return;
    setSubmitting(true);
    try {
      await api.patch(`/discussion/comments/${commentId}/`, { text: editText });
      setEditingComment(null);
      setEditText('');
      
      const commentsRes = await api.get(`/discussion/submissions/${id}/comments/?sort=${sortBy}`);
      setComments(commentsRes.data);
    } catch (error) {
      alert(error.response?.data?.error || 'Помилка при редагуванні');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Ви впевнені, що хочете видалити цей коментар?')) return;
    setSubmitting(true);
    try {
      await api.delete(`/discussion/comments/${commentId}/`);
      
      const [commentsRes, statsRes] = await Promise.all([
        api.get(`/discussion/submissions/${id}/comments/?sort=${sortBy}`),
        api.get(`/discussion/submissions/${id}/comments/stats/`)
      ]);
      setComments(commentsRes.data);
      setStats(statsRes.data);
      
      const subRes = await api.get(`/submissions/${id}/`);
      setSubmission(subRes.data);
    } catch (error) {
      alert(error.response?.data?.error || 'Помилка при видаленні');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (commentId, vote) => {
    try {
      await api.post(`/discussion/comments/${commentId}/vote/`, { vote });
      const commentsRes = await api.get(`/discussion/submissions/${id}/comments/?sort=${sortBy}`);
      setComments(commentsRes.data);
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  const handleSortChange = (e) => {
    setSortBy(e.target.value);
  };

  const renderComment = (comment, isReply = false) => {
    const isAuthor = user && comment.author?.id === user.id;
    const isAdmin = user && user.role === 'ADMIN';
    const canEdit = isAuthor || isAdmin;
    const userVote = comment.user_vote;
    
    return (
      <div key={comment.id} className={`discussionComment ${isReply ? 'discussionCommentReply' : ''}`}>
        <div className="discussionCommentCard">
          <div className="discussionCommentHeader">
            <Avatar user={comment.author} size="small" />
            <div className="discussionCommentAuthorInfo">
              <strong>
                <Link to={`/profile/${comment.author?.id}`}>
                  {comment.author?.full_name || comment.author?.username}
                </Link>
              </strong>
              <span className="discussionCommentDate">
                {new Date(comment.created_at).toLocaleString()}
              </span>
              {comment.updated_at !== comment.created_at && (
                <span className="discussionCommentEdited">
                  (відредаговано)
                </span>
              )}
            </div>
            <div className="discussionCommentRating">
              Рейтинг: {comment.rating}
            </div>
          </div>
          
          {comment.is_deleted ? (
            <p className="discussionCommentDeleted">Коментар видалено</p>
          ) : (
            <>
              {editingComment === comment.id ? (
                <div>
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows="3"
                    className="discussionEditTextarea"
                  />
                  <div className="discussionEditActions">
                    <button onClick={() => handleEditComment(comment.id)} disabled={submitting}>
                      Зберегти
                    </button>
                    <button onClick={() => setEditingComment(null)}>
                      Скасувати
                    </button>
                  </div>
                </div>
              ) : (
                <p className="discussionCommentText">{comment.text}</p>
              )}
              
              <div className="discussionCommentActions">
                <button onClick={() => handleVote(comment.id, 1)}>
                  + {comment.likes_count}
                </button>
                <button onClick={() => handleVote(comment.id, -1)}>
                  - {comment.dislikes_count}
                </button>
                {userVote === 1 && <span className="user-vote">(ви лайкнули)</span>}
                {userVote === -1 && <span className="user-vote">(ви дизлайкнули)</span>}
                
                {!comment.is_deleted && (
                  <>
                    <button onClick={() => setReplyTo(comment.id)}>
                      Відповісти
                    </button>
                    {canEdit && !comment.is_deleted && (
                      <>
                        <button 
                          onClick={() => {
                            setEditingComment(comment.id);
                            setEditText(comment.text);
                          }}
                        >
                          Редагувати
                        </button>
                        <button 
                          onClick={() => handleDeleteComment(comment.id)}
                          className="discussionDeleteButton"
                        >
                          Видалити
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
        
        {comment.replies && comment.replies.map(reply => renderComment(reply, true))}
      </div>
    );
  };

  if (loading) return <div>Завантаження...</div>;
  if (!submission) return <div>Обговорення не знайдено</div>;

  const canComment = submission && 
    submission.status === 'ACCEPTED' && 
    submission.conference_detail && 
    new Date(submission.conference_detail.event_date) >= new Date();

  return (
    <div className="discussionDetailContainer">
      <div className="discussionDetailBackLink">
        <Link to="/discussions">Назад до обговорень</Link>
      </div>
      
      <h1>{submission.title}</h1>
      
      <div className="discussionDetailInfo">
        <div className="discussionDetailAuthor">
          <Avatar user={{ id: submission.author, full_name: submission.author_full_name }} size="small" />
          <div>
            <p><strong>Автор:</strong> <Link to={`/profile/${submission.author}`}>{submission.author_full_name}</Link></p>
          </div>
        </div>
        <p><strong>Конференція:</strong> <Link to={`/conferences/${submission.conference}`}>{submission.conference_title}</Link></p>
        <p><strong>Статус:</strong> 
          <span className={`submission-status status-${submission.status?.toLowerCase()}`}>
            {submission.status === 'ACCEPTED' ? 'Прийнято' : submission.status}
          </span>
        </p>
      </div>
      
      {submission.abstract && (
        <div className="discussionDetailAbstract">
          <h3>Анотація</h3>
          <p>{submission.abstract}</p>
        </div>
      )}
      
      {stats && (
        <div className="discussionDetailStats">
          <div className="stat-item">Всього коментарів: {stats.total_comments}</div>
          <div className="stat-item">Основних коментарів: {stats.root_comments}</div>
          <div className="stat-item">Відповідей: {stats.replies}</div>
        </div>
      )}
      
      <div className="discussionDetailSort">
        <h3>Сортування</h3>
        <select value={sortBy} onChange={handleSortChange} className="discussionSortSelect">
          <option value="rating">За рейтингом</option>
          <option value="newest">Спочатку нові</option>
          <option value="oldest">Спочатку старі</option>
        </select>
      </div>
      
{/*       {stats && stats.top_comments && stats.top_comments.length > 0 && (
        <div className="discussionTopComments">
          <h3>Найкращі коментарі</h3>
          {stats.top_comments.map(comment => (
            <div key={comment.id} className="top-comment-item">
              <Avatar user={comment.author} size="small" />
              <div>
                <strong>{comment.author?.full_name || comment.author?.username}</strong>
                <p>{comment.text?.substring(0, 100)}...</p>
              </div>
            </div>
          ))}
        </div>
      )} */}

      <div className="discussionAddComment">
        <h3>Додати коментар</h3>
        {!user ? (
          <p><Link to="/login">Увійдіть</Link>, щоб залишити коментар</p>
        ) : !canComment ? (
          <p>Коментування закрито. Теза має бути прийнята, а конференція ще не завершена.</p>
        ) : (
          <div>
            {replyTo && (
              <div className="discussionReplyTo">
                <p>Відповідь на коментар</p>
                <button onClick={() => setReplyTo(null)}>Скасувати</button>
              </div>
            )}
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Ваш коментар..."
              rows="4"
              className="discussionCommentTextarea"
            />
            <button onClick={handleAddComment} disabled={submitting} className="discussionSubmitButton">
              {submitting ? 'Відправлення...' : 'Відправити коментар'}
            </button>
          </div>
        )}
      </div>
      
      <div className="discussionCommentsSection">
        <h3>Обговорення</h3>
        {comments.length === 0 ? (
          <p>Немає коментарів. Будьте першим, хто прокоментує!</p>
        ) : (
          comments.map(comment => renderComment(comment))
        )}
      </div>
    </div>
  );
};

export default DiscussionDetail;