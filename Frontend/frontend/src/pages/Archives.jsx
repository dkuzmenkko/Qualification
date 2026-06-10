// src/pages/Archives.js

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import Avatar from '../components/Avatar';
import '../styles/Archives.css';

const Archives = () => {
  const { user } = useAuth();
  const { success, error: showError } = useNotification();
  const [activeTab, setActiveTab] = useState('conferences');
  const [pastConferences, setPastConferences] = useState([]);
  const [archivedSubmissions, setArchivedSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    category: '',
    search: '',
    year: '',
    status: ''
  });
  const [categories, setCategories] = useState([]);
  const [years, setYears] = useState([]);

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

  useEffect(() => {
    const fetchArchives = async () => {
      setLoading(true);
      try {
        // Отримуємо всі конференції
        const confResponse = await api.get('/conferences/');
        const today = new Date().toISOString().split('T')[0];
        
        // Фільтруємо минулі конференції (дата проведення < сьогодні)
        let past = confResponse.data.filter(conf => conf.event_date < today);
        
        // Фільтрація за категорією
        if (filters.category) {
          past = past.filter(conf => conf.category === filters.category);
        }
        
        // Фільтрація за пошуком
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          past = past.filter(conf => 
            conf.title.toLowerCase().includes(searchLower) ||
            conf.conference_id.toLowerCase().includes(searchLower)
          );
        }
        
        // Фільтрація за роком
        if (filters.year) {
          past = past.filter(conf => conf.event_date.startsWith(filters.year));
        }
        
        setPastConferences(past);
        
        // Отримуємо роки для фільтрації
        const uniqueYears = [...new Set(confResponse.data.map(conf => conf.event_date.substring(0, 4)))];
        setYears(uniqueYears.sort().reverse());
        
        // Отримуємо архівні тези (тільки ті, що is_archived = true)
        if (user) {
          const subsResponse = await api.get('/submissions/', {
            params: { archived: 'true' }
          });
          setArchivedSubmissions(subsResponse.data);
        }
        
      } catch (error) {
        console.error('Error fetching archives:', error);
        showError('Помилка завантаження архіву');
      } finally {
        setLoading(false);
      }
    };
    
    fetchArchives();
  }, [filters, user, showError]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({
      category: '',
      search: '',
      year: '',
      status: ''
    });
  };

  if (loading) return <div>Завантаження...</div>;

  return (
    <div className="archivesContainer">
      <h1>Архів</h1>
      <p className="archivesDescription">
        Тут зберігаються завершені конференції та тези, які були автоматично 
        переміщені до архіву через 1 рік після публікації
      </p>
      
      <div className="archivesTabs">
        <button 
          className={`archivesTab ${activeTab === 'conferences' ? 'active' : ''}`}
          onClick={() => setActiveTab('conferences')}
        >
          Завершені конференції ({pastConferences.length})
        </button>
        <button 
          className={`archivesTab ${activeTab === 'submissions' ? 'active' : ''}`}
          onClick={() => setActiveTab('submissions')}
        >
          Архівні тези ({archivedSubmissions.length})
        </button>
      </div>
      
      <div className="archivesFilters">
        <div className="archivesFilterRow">
          <input
            type="text"
            name="search"
            placeholder="Пошук..."
            value={filters.search}
            onChange={handleFilterChange}
            className="archivesSearchInput"
          />
          
          {activeTab === 'conferences' && (
            <>
              <select 
                name="category" 
                value={filters.category} 
                onChange={handleFilterChange}
                className="archivesFilterSelect"
              >
                <option value="">Всі категорії</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              
              <select 
                name="year" 
                value={filters.year} 
                onChange={handleFilterChange}
                className="archivesFilterSelect"
              >
                <option value="">Всі роки</option>
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </>
          )}
          
          {(filters.category || filters.search || filters.year || filters.status) && (
            <button onClick={clearFilters} className="archivesClearButton">
              Очистити фільтри
            </button>
          )}
        </div>
      </div>
      
      {activeTab === 'conferences' && (
        <div className="archivesConferencesList">
          {pastConferences.length === 0 ? (
            <div className="archivesEmpty">
              <p>Немає завершених конференцій</p>
            </div>
          ) : (
            pastConferences.map(conf => (
              <div key={conf.id} className="archivesConferenceCard">
                <div className="archivesConferenceHeader">
                  <h3>
                    <Link to={`/conferences/${conf.id}`}>{conf.title}</Link>
                  </h3>
                  <span className="archivesConferenceYear">{conf.event_date.substring(0, 4)}</span>
                </div>
                <div className="archivesConferenceInfo">
                  <p><strong>ID:</strong> {conf.conference_id}</p>
                  <p><strong>Категорія:</strong> {conf.category}</p>
                  <p><strong>Дата проведення:</strong> {conf.event_date}</p>
                  <p><strong>Організатор:</strong> {conf.organizer?.full_name || conf.organizer?.username}</p>
                  {conf.institution && (
                    <p><strong>Організація:</strong> {conf.institution}</p>
                  )}
                </div>
                <div className="archivesConferenceStats">
                  <span>Тези: {conf.submissions?.length || 0}</span>
                  <span>Рецензенти: {conf.reviewers?.length || 0}</span>
                </div>
                <Link to={`/conferences/${conf.id}`} className="archivesViewLink">
                  Переглянути конференцію →
                </Link>
              </div>
            ))
          )}
        </div>
      )}
      
      {activeTab === 'submissions' && user && (
        <div className="archivesSubmissionsList">
          {archivedSubmissions.length === 0 ? (
            <div className="archivesEmpty">
              <p>Немає архівних тез</p>
              <p className="archivesHint">
                Тези автоматично потрапляють до архіву через 1 рік після публікації
              </p>
            </div>
          ) : (
            archivedSubmissions.map(sub => {
              const canView = sub.author === user?.id || 
                              sub.reviewer === user?.id || 
                              user?.role === 'ADMIN' ||
                              sub.conference_detail?.organizer?.id === user?.id;
              
              if (!canView) return null;
              
              return (
                <div key={sub.id} className="archivesSubmissionCard">
                  <div className="archivesSubmissionHeader">
                    <h3>
                      <Link to={`/submissions/${sub.id}`}>{sub.title}</Link>
                    </h3>
                    <span className="archivesArchiveBadge">В архіві</span>
                  </div>
                  <div className="archivesSubmissionInfo">
                    <p><strong>Конференція:</strong> {sub.conference_title}</p>
                    <div className="submission-author">
                      <strong>Автор:</strong>
                      <Avatar user={{ id: sub.author, full_name: sub.author_full_name }} size="small" />
                      <Link to={`/profile/${sub.author}`}>{sub.author_full_name}</Link>
                    </div>
                    <p><strong>Статус:</strong> {
                      sub.status === 'ACCEPTED' ? 'Прийнято' :
                      sub.status === 'REJECTED' ? 'Відхилено' : sub.status
                    }</p>
                    <p><strong>Дата подання:</strong> {new Date(sub.created_at).toLocaleDateString()}</p>
                    {sub.archived_at && (
                      <p><strong>Дата архівації:</strong> {new Date(sub.archived_at).toLocaleDateString()}</p>
                    )}
                  </div>
                  <Link to={`/submissions/${sub.id}`} className="archivesViewLink">
                    Переглянути тезу →
                  </Link>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default Archives;