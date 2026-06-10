import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import '../styles/AdminDashboard.css';

const AdminDashboard = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { success, error: showError } = useNotification();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [pendingReviewers, setPendingReviewers] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);
  const [recentSubmissions, setRecentSubmissions] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [allConferences, setAllConferences] = useState([]);
  const [approving, setApproving] = useState({});
  const [deleting, setDeleting] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');

  useEffect(() => {
    if (user && (user.role !== 'ADMIN' && !user.is_superuser)) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboardRes, usersRes, conferencesRes] = await Promise.all([
        api.get('/submissions/dashboard/admin/'),
        api.get('/users/list/'),
        api.get('/conferences/')
      ]);
      
      setStats(dashboardRes.data);
      setPendingReviewers(dashboardRes.data.users?.pending_reviewers_list || []);
      setRecentUsers(dashboardRes.data.recent_users || []);
      setRecentSubmissions(dashboardRes.data.recent_submissions || []);
      setAllUsers(usersRes.data);
      setAllConferences(conferencesRes.data);
    } catch (error) {
      console.error('Error fetching admin data:', error);
      showError('Помилка завантаження даних');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleApproveReviewer = async (userId) => {
    setApproving(prev => ({ ...prev, [userId]: true }));
    try {
      await api.post(`/users/approve-reviewer/${userId}/`);
      setPendingReviewers(prev => prev.filter(u => u.id !== userId));
      
      if (user && user.id === userId) {
        await refreshUser();
      }
      
      success('Рецензента успішно підтверджено');
      fetchDashboardData();
    } catch (error) {
      showError('Помилка при підтвердженні рецензента');
    } finally {
      setApproving(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm(`Ви впевнені, що хочете видалити користувача "${username}"? Цю дію не можна скасувати.`)) {
      return;
    }
    
    setDeleting(prev => ({ ...prev, [userId]: true }));
    try {
      await api.delete(`/users/${userId}/delete/`);
      success(`Користувача "${username}" видалено`);
      setAllUsers(prev => prev.filter(u => u.id !== userId));
      setRecentUsers(prev => prev.filter(u => u.id !== userId));
      setPendingReviewers(prev => prev.filter(u => u.id !== userId));
    } catch (error) {
      console.error('Delete user error:', error);
      const errorMessage = error.response?.data?.error || 'Помилка при видаленні користувача';
      showError(errorMessage);
    } finally {
      setDeleting(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleDeleteConference = async (confId, title) => {
    if (!window.confirm(`Ви впевнені, що хочете видалити конференцію "${title}"? Цю дію не можна скасувати.`)) {
      return;
    }
    
    setDeleting(prev => ({ ...prev, [confId]: true }));
    try {
      await api.delete(`/conferences/${confId}/delete/`);
      success(`Конференцію "${title}" видалено`);
      setAllConferences(prev => prev.filter(c => c.id !== confId));
    } catch (error) {
      console.error('Delete conference error:', error);
      const errorMessage = error.response?.data?.error || 'Помилка при видаленні конференції';
      showError(errorMessage);
    } finally {
      setDeleting(prev => ({ ...prev, [confId]: false }));
    }
  };

  const filteredUsers = allUsers.filter(u => {
    const matchesSearch = searchTerm === '' || 
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.full_name && u.full_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesRole = userRoleFilter === '' || u.role === userRoleFilter;
    
    return matchesSearch && matchesRole;
  });

  if (loading) return <div className="loading">Завантаження...</div>;

  return (
    <div className="adminDashboardContainer">
      <div className="adminHeader">
        <h1>Адміністративна панель</h1>
      </div>
      
      <div className="adminTabs">
        <button
          onClick={() => setActiveTab('overview')}
          className={`adminTabButton ${activeTab === 'overview' ? 'adminTabActive' : 'adminTabInactive'}`}
        >
          Огляд
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`adminTabButton ${activeTab === 'users' ? 'adminTabActive' : 'adminTabInactive'}`}
        >
          Користувачі ({allUsers.length})
        </button>
        <button
          onClick={() => setActiveTab('conferences')}
          className={`adminTabButton ${activeTab === 'conferences' ? 'adminTabActive' : 'adminTabInactive'}`}
        >
          Конференції ({allConferences.length})
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`adminTabButton ${activeTab === 'pending' ? 'adminTabActive' : 'adminTabInactive'}`}
        >
          Очікують ({pendingReviewers.length})
        </button>
      </div>
      
      {activeTab === 'overview' && (
        <div>
          <div className="adminStatsGrid">
            <div className="adminStatCard adminStatCardBlue">
              <h3>Користувачі</h3>
              <p className="adminStatNumber">{stats.users?.total || 0}</p>
              <div className="adminStatLabels">
                <span>Автори: {stats.users?.authors || 0}</span>
                <span>Рецензенти: {stats.users?.reviewers || 0}</span>
                <span>Адміни: {stats.users?.admins || 0}</span>
              </div>
            </div>
            
            <div className="adminStatCard adminStatCardGreen">
              <h3>Конференції</h3>
              <p className="adminStatNumber">{stats.conferences?.total || 0}</p>
              <div className="adminStatLabels">
                <span>Активні: {stats.conferences?.active || 0}</span>
                <span>Минулі: {stats.conferences?.past || 0}</span>
              </div>
            </div>
            
            <div className="adminStatCard adminStatCardOrange">
              <h3>Тези</h3>
              <p className="adminStatNumber">{stats.submissions?.total || 0}</p>
              <div className="adminStatLabels">
                <span>Прийнято: {stats.submissions?.accepted || 0}</span>
                <span>На рецензії: {stats.submissions?.pending || 0}</span>
                <span>Відхилено: {stats.submissions?.rejected || 0}</span>
              </div>
            </div>
            
            <div className="adminStatCard adminStatCardPink">
              <h3>Обговорення</h3>
              <p className="adminStatNumber">{stats.discussions?.total_comments || 0}</p>
              <div className="adminStatLabels">
                <span>Сьогодні: {stats.discussions?.comments_today || 0}</span>
              </div>
            </div>
          </div>
          
          <div className="adminRecentSection">
            <div>
              <h2>Останні користувачі</h2>
              {recentUsers.slice(0, 5).map(u => (
                <div key={u.id} className="adminRecentItem">
                  <Link to={`/profile/${u.id}`} className="adminRecentLink">{u.full_name || u.username}</Link>
                  <span className="adminRecentRole">{u.role === 'AUTHOR' ? 'Автор' : u.role === 'REVIEWER' ? 'Рецензент' : 'Адмін'}</span>
                  <span className="adminRecentStatus">
                    {u.is_approved ? 'Підтверджений' : 'Очікує'}
                  </span>
                </div>
              ))}
              <Link to="/users" className="adminViewAllLink">Всі користувачі →</Link>
            </div>
            
            <div>
              <h2>Останні тези</h2>
              {recentSubmissions.slice(0, 5).map(sub => (
                <div key={sub.id} className="adminRecentItem">
                  <Link to={`/submissions/${sub.id}`}>{sub.title}</Link>
                  <p className="adminRecentMeta">
                    {sub.author_full_name} - {sub.conference_title}
                  </p>
                </div>
              ))}
              <Link to="/submissions" className="adminViewAllLink">Всі тези →</Link>
            </div>
          </div>
        </div>
      )}
      
      {activeTab === 'users' && (
        <div>
          <div className="adminFilterSection">
            <input
              type="text"
              placeholder="Пошук за іменем, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="adminSearchInput"
            />
            <select
              value={userRoleFilter}
              onChange={(e) => setUserRoleFilter(e.target.value)}
              className="adminRoleSelect"
            >
              <option value="">Всі ролі</option>
              <option value="AUTHOR">Автори</option>
              <option value="REVIEWER">Рецензенти</option>
              <option value="ADMIN">Адміністратори</option>
            </select>
          </div>
          
          <div className="adminTableWrapper">
            <table className="adminTable">
              <thead>
                <tr className="adminTableHeader">
                  <th className="adminTableCell">ID</th>
                  <th className="adminTableCell">ПІБ</th>
                  <th className="adminTableCell">Email</th>
                  <th className="adminTableCell">Роль</th>
                  <th className="adminTableCell">Статус</th>
                  <th className="adminTableCell">Дії</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.id} className="adminTableRow">
                    <td className="adminTableCell">{u.id}</td>
                    <td className="adminTableCell">
                      <Link to={`/profile/${u.id}`}>{u.full_name || u.username}</Link>
                    </td>
                    <td className="adminTableCell">{u.email}</td>
                    <td className="adminTableCell">
                      {u.role === 'AUTHOR' ? 'Автор' : u.role === 'REVIEWER' ? 'Рецензент' : 'Адмін'}
                    </td>
                    <td className="adminTableCell">
                      {u.role === 'REVIEWER' && (
                        <span className={u.is_approved ? 'adminStatusApproved' : 'adminStatusPending'}>
                          {u.is_approved ? 'Підтверджений' : 'Очікує'}
                        </span>
                      )}
                      {u.email_verified === false && (
                        <span className="adminStatusUnverified"> (Email не підтверджено)</span>
                      )}
                    </td>
                    <td className="adminTableCell">
                      {u.role === 'REVIEWER' && !u.is_approved && (
                        <button
                          onClick={() => handleApproveReviewer(u.id)}
                          disabled={approving[u.id]}
                          className="adminApproveButton"
                        >
                          {approving[u.id] ? '...' : 'Підтвердити'}
                        </button>
                      )}
                      {u.id !== user?.id && (
                        <button
                          onClick={() => handleDeleteUser(u.id, u.username)}
                          disabled={deleting[u.id]}
                          className="adminDeleteButton"
                        >
                          {deleting[u.id] ? '...' : 'Видалити'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredUsers.length === 0 && (
            <p className="adminEmptyMessage">Користувачів не знайдено</p>
          )}
        </div>
      )}
      
      {activeTab === 'conferences' && (
        <div>
          <div className="adminTableWrapper">
            <table className="adminTable">
              <thead>
                <tr className="adminTableHeader">
                  <th className="adminTableCell">ID</th>
                  <th className="adminTableCell">Назва</th>
                  <th className="adminTableCell">Організатор</th>
                  <th className="adminTableCell">Дата</th>
                  <th className="adminTableCell">Статус</th>
                  <th className="adminTableCell">Дії</th>
                </tr>
              </thead>
              <tbody>
                {allConferences.map(conf => {
                  const isActive = new Date(conf.submission_deadline) >= new Date();
                  return (
                    <tr key={conf.id} className="adminTableRow">
                      <td className="adminTableCell">{conf.conference_id}</td>
                      <td className="adminTableCell">
                        <Link to={`/conferences/${conf.id}`}>{conf.title}</Link>
                      </td>
                      <td className="adminTableCell">{conf.organizer?.full_name || conf.organizer?.username}</td>
                      <td className="adminTableCell">{conf.event_date}</td>
                      <td className="adminTableCell">
                        <span className={isActive ? 'adminStatusActive' : 'adminStatusInactive'}>
                          {isActive ? 'Активна' : 'Завершена'}
                        </span>
                      </td>
                      <td className="adminTableCell">
                        <button
                          onClick={() => handleDeleteConference(conf.id, conf.title)}
                          disabled={deleting[conf.id]}
                          className="adminDeleteButton"
                        >
                          {deleting[conf.id] ? '...' : 'Видалити'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {allConferences.length === 0 && (
            <p className="adminEmptyMessage">Конференцій не знайдено</p>
          )}
        </div>
      )}
      
      {activeTab === 'pending' && (
        <div>
          <h2>Рецензенти, що очікують підтвердження ({pendingReviewers.length})</h2>
          
          {pendingReviewers.length === 0 ? (
            <p className="adminEmptyPendingMessage">
              Немає рецензентів, що очікують підтвердження
            </p>
          ) : (
            pendingReviewers.map(reviewer => (
              <div key={reviewer.id} className="adminPendingCard">
                <div className="adminPendingContent">
                  <div>
                    <h3 className="adminPendingName">{reviewer.full_name || reviewer.username}</h3>
                    <p><strong>Email:</strong> {reviewer.email}</p>
                    <p><strong>Місце роботи:</strong> {reviewer.affiliation || '-'}</p>
                    <p><strong>ORCID:</strong> {reviewer.orcid_id || '-'}</p>
                    <p><strong>Інтереси:</strong> {reviewer.interests?.join(', ') || '-'}</p>
                    <p><strong>Зареєстровано:</strong> {new Date(reviewer.date_joined).toLocaleString()}</p>
                  </div>
                  <div>
                    <button 
                      onClick={() => handleApproveReviewer(reviewer.id)}
                      disabled={approving[reviewer.id]}
                      className="adminApproveReviewerButton"
                    >
                      {approving[reviewer.id] ? 'Підтвердження...' : 'Підтвердити рецензента'}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;