import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import Avatar from '../components/Avatar';
import '../styles/UsersList.css';

const UsersList = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { success, error: showError } = useNotification();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    role: '',
    search: '',
    pending: false,
  });
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setFilters({
      role: params.get('role') || '',
      search: params.get('search') || '',
      pending: params.get('pending') === 'true',
    });
  }, [location.search]);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        
        if (filters.role) params.append('role', filters.role);
        if (filters.search) params.append('search', filters.search);
        
        if (filters.pending && user?.role === 'ADMIN') {
          params.append('is_approved', 'false');
        }
        
        const response = await api.get(`/users/list/?${params.toString()}`);
        
        let data = response.data;
        if (user?.role !== 'ADMIN') {
          data = data.filter(u => 
            (u.role === 'AUTHOR') || 
            (u.role === 'REVIEWER' && u.is_approved === true)
          );
        }
        
        setUsers(data);
        setTotalCount(data.length);
      } catch (error) {
        console.error('Error fetching users:', error);
        showError('Помилка завантаження користувачів');
      } finally {
        setLoading(false);
      }
    };
    
    if (user) {
      fetchUsers();
    }
  }, [filters, user, showError]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    const params = new URLSearchParams(location.search);
    
    if (value) {
      params.set(name, value);
    } else {
      params.delete(name);
    }
    
    navigate(`/users?${params.toString()}`);
  };

  const clearFilters = () => {
    navigate('/users');
  };

  const getRoleText = (role) => {
    switch(role) {
      case 'AUTHOR': return 'Автор';
      case 'REVIEWER': return 'Рецензент';
      case 'ADMIN': return 'Адміністратор';
      default: return role;
    }
  };

  const getRoleClass = (role) => {
    switch(role) {
      case 'AUTHOR': return 'role-author';
      case 'REVIEWER': return 'role-reviewer';
      case 'ADMIN': return 'role-admin';
      default: return '';
    }
  };

  const canSeePendingFilter = user?.role === 'ADMIN';

  if (loading) return <div className="loading">Завантаження...</div>;

  const activeFilterName = () => {
    if (filters.pending && canSeePendingFilter) return 'Очікують підтвердження';
    if (filters.search) return `Пошук: "${filters.search}"`;
    if (filters.role === 'AUTHOR') return 'Автори';
    if (filters.role === 'REVIEWER') return 'Рецензенти';
    if (filters.role === 'ADMIN') return 'Адміністратори';
    return null;
  };

  const filterName = activeFilterName();

  return (
    <div className="usersListContainer">
      <div className="usersListHeader">
        <h1>Користувачі</h1>
        <span className="usersCount">Всього: {totalCount}</span>
      </div>
      
      <div className="usersFilterSection">
        <h2>Фільтри</h2>
        <div className="usersFilterControls">
          <input
            type="text"
            name="search"
            placeholder="Пошук за іменем, email або username..."
            value={filters.search}
            onChange={handleFilterChange}
            className="usersSearchInput"
          />
          
          <select 
            name="role" 
            value={filters.role} 
            onChange={handleFilterChange}
            className="usersSelect"
          >
            <option value="">Всі ролі</option>
            <option value="AUTHOR">Автори</option>
            <option value="REVIEWER">Рецензенти</option>
            {user?.role === 'ADMIN' && (
              <option value="ADMIN">Адміністратори</option>
            )}
          </select>
          
          {canSeePendingFilter && (
            <label className="usersCheckboxLabel">
              <input
                type="checkbox"
                name="pending"
                checked={filters.pending}
                onChange={(e) => {
                  const params = new URLSearchParams(location.search);
                  if (e.target.checked) {
                    params.set('pending', 'true');
                  } else {
                    params.delete('pending');
                  }
                  navigate(`/users?${params.toString()}`);
                }}
              />
              Тільки непідтверджені
            </label>
          )}
        </div>
        
        {filterName && (
          <div className="usersActiveFilter">
            <span>
              <strong>Активний фільтр:</strong> {filterName}
              {` (${users.length} користувачів)`}
            </span>
            <button 
              onClick={clearFilters}
              className="usersClearButton"
            >
              Очистити фільтри
            </button>
          </div>
        )}
      </div>
      
      {users.length === 0 ? (
        <div className="usersEmptyState">
          <p>Користувачів не знайдено</p>
          {filterName && (
            <button onClick={clearFilters} className="usersShowAllButton">
              Показати всіх користувачів
            </button>
          )}
        </div>
      ) : (
        <div className="usersList">
          <table className="usersTable">
            <thead>
              <tr>
                <th>Аватар</th>
                <th>ID</th>
                <th>Username</th>
                <th>ПІБ</th>
                <th>Email</th>
                <th>Роль</th>
                <th>Статус</th>
                <th>Організація</th>
                <th>Дії</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td className="user-avatar">
                    <Avatar user={u} size="small" />
                  </td>
                  <td className="user-id">{u.id}</td>
                  <td className="user-username">
                    <strong className="username-copyable">{u.username}</strong>
                    <button 
                      className="copy-username-btn"
                      onClick={() => {
                        navigator.clipboard.writeText(u.username);
                        success(`Username "${u.username}" скопійовано`);
                      }}
                      title="Скопіювати username"
                    >
                      Копіювати
                    </button>
                  </td>
                  <td className="user-name">
                    <Link to={`/profile/${u.id}`}>
                      {u.full_name || 'Не вказано'}
                    </Link>
                  </td>
                  <td className="user-email">{u.email}</td>
                  <td className="user-role">
                    <span className={`role-badge ${getRoleClass(u.role)}`}>
                      {getRoleText(u.role)}
                    </span>
                  </td>
                  <td className="user-status">
                    {u.role === 'REVIEWER' ? (
                      u.is_approved ? (
                        <span className="status-approved">Підтверджений</span>
                      ) : (
                        <span className="status-pending">Очікує</span>
                      )
                    ) : (
                      <span className="status-active">Активний</span>
                    )}
                  </td>
                  <td className="user-affiliation">
                    {u.affiliation || '-'}
                  </td>
                  <td className="user-actions">
                    <Link to={`/profile/${u.id}`} className="action-btn view-btn">
                     Переглянути
                    </Link>
                    {user?.role === 'ADMIN' && u.role === 'REVIEWER' && !u.is_approved && (
                      <button 
                        onClick={async () => {
                          if (window.confirm(`Підтвердити рецензента ${u.full_name || u.username}?`)) {
                            try {
                              await api.post(`/users/approve-reviewer/${u.id}/`);
                              success('Рецензента підтверджено');
                              const params = new URLSearchParams();
                              if (filters.role) params.append('role', filters.role);
                              if (filters.search) params.append('search', filters.search);
                              const response = await api.get(`/users/list/?${params.toString()}`);
                              setUsers(response.data);
                            } catch (error) {
                              showError('Помилка при підтвердженні');
                            }
                          }
                        }}
                        className="action-btn approve-btn"
                      >
                        Підтвердити
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default UsersList;