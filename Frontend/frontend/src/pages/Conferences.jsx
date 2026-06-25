import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import '../styles/Conferences.css';

const Conferences = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [conferences, setConferences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    category: '',
    search: '',
    status: '',
    conference_type: '',
  });
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setFilters({
      category: params.get('category') || '',
      search: params.get('search') || '',
      status: params.get('status') || '',
      conference_type: params.get('conference_type') || '',
    });
  }, [location.search]);

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
    const fetchConferences = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filters.category) params.append('category', filters.category);
        if (filters.search) params.append('search', filters.search);
        
        const response = await api.get(`/conferences/?${params.toString()}`);
        let data = response.data;
        
        const today = new Date().toISOString().split('T')[0];
        if (filters.status === 'active') {
          data = data.filter(c => c.submission_deadline >= today);
        } else if (filters.status === 'past') {
          data = data.filter(c => c.event_date < today);
        }
        
        if (filters.conference_type) {
          data = data.filter(c => c.conference_type === filters.conference_type);
        }
        
        setConferences(data);
      } catch (error) {
        console.error('Error fetching conferences:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchConferences();
  }, [filters]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    const params = new URLSearchParams(location.search);
    
    if (value) {
      params.set(name, value);
    } else {
      params.delete(name);
    }
    
    navigate(`/conferences?${params.toString()}`);
  };

  const clearFilters = () => {
    navigate('/conferences');
  };

  const getConferenceTypeIcon = (type) => {
    switch(type) {
      case 'ONLINE':
        return { text: 'Онлайн', className: 'conference-type-online' };
      case 'OFFLINE':
        return { text: 'Офлайн', className: 'conference-type-offline' };
      case 'HYBRID':
        return { text: 'Гібридний', className: 'conference-type-hybrid' };
      default:
        return { text: 'Не вказано', className: '' };
    }
  };

  if (loading) return <div className="loading">Завантаження...</div>;

  const getActiveFilterName = () => {
    if (filters.status === 'active') return 'Активні конференції';
    if (filters.status === 'past') return 'Минулі конференції';
    if (filters.category) {
      const cat = categories.find(c => c.id === filters.category);
      return `Категорія: ${cat?.name || filters.category}`;
    }
    if (filters.conference_type) {
      const typeMap = {
        'ONLINE': 'Онлайн',
        'OFFLINE': 'Офлайн',
        'HYBRID': 'Гібридний'
      };
      return `Тип: ${typeMap[filters.conference_type] || filters.conference_type}`;
    }
    if (filters.search) return `Пошук: "${filters.search}"`;
    return null;
  };

  const activeFilterName = getActiveFilterName();

  return (
    <div className="conferencesContainer">
      <h1>Конференції</h1>
      
      <div className="conferencesFilterSection">
        <h2>Фільтри</h2>
        <div className="conferencesFilterControls">
          <input
            type="text"
            name="search"
            placeholder="Пошук за назвою..."
            value={filters.search}
            onChange={handleFilterChange}
            className="conferencesSearchInput"
          />
          
          <select 
            name="category" 
            value={filters.category} 
            onChange={handleFilterChange}
            className="conferencesSelect"
          >
            <option value="">Всі категорії</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          
          <select 
            name="conference_type" 
            value={filters.conference_type} 
            onChange={handleFilterChange}
            className="conferencesSelect"
          >
            <option value="">Всі типи</option>
            <option value="ONLINE">Онлайн</option>
            <option value="OFFLINE">Офлайн</option>
            <option value="HYBRID">Гібридний</option>
          </select>
          
          <select 
            name="status" 
            value={filters.status} 
            onChange={handleFilterChange}
            className="conferencesSelect"
          >
            <option value="">Всі статуси</option>
            <option value="active">Активні</option>
            <option value="past">Минулі</option>
          </select>
        </div>
        
        {activeFilterName && (
          <div className="conferencesActiveFilter">
            <span>
              <strong>Активний фільтр:</strong> {activeFilterName}
              {` (${conferences.length} конференцій)`}
            </span>
            <button 
              onClick={clearFilters}
              className="conferencesClearButton"
            >
              Очистити фільтри
            </button>
          </div>
        )}
      </div>
      
      {conferences.length === 0 ? (
        <div className="conferencesEmptyState">
          <p>Конференцій не знайдено</p>
          {activeFilterName && (
            <button onClick={clearFilters} className="conferencesShowAllButton">Показати всі конференції</button>
          )}
        </div>
      ) : (
        <div className="conferencesList">
          {conferences.map(conf => {
            const typeInfo = getConferenceTypeIcon(conf.conference_type);
            const isActive = new Date(conf.submission_deadline) >= new Date();
            
            return (
              <div key={conf.id} className="conferencesCard">
                <div className="conferencesCardHeader">
                  <h2 className="conferencesCardTitle">
                    <Link to={`/conferences/${conf.id}`}>{conf.title}</Link>
                  </h2>
                  <span className={`conference-status-badge ${isActive ? 'status-active' : 'status-past'}`}>
                    {isActive ? 'Активна' : 'Завершена'}
                  </span>
                </div>
                
                <div className="conferencesCardInfo">
                  <div className="info-row">
                    <span className="info-label">ID:</span>
                    <span className="info-value">{conf.conference_id}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Категорія:</span>
                    <span className="info-value conferencesCategory">{conf.category}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Тип проведення:</span>
                    <span className={`info-value conference-type-badge ${typeInfo.className}`}>
                      {typeInfo.icon} {typeInfo.text}
                    </span>
                  </div>
                  {conf.institution && (
                    <div className="info-row">
                      <span className="info-label">Організація:</span>
                      <span className="info-value">{conf.institution}</span>
                    </div>
                  )}
                  <div className="info-row">
                    <span className="info-label">Організатор:</span>
                    <span className="info-value">{conf.organizer?.full_name || conf.organizer?.username}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Дата проведення:</span>
                    <span className="info-value">{conf.event_date}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Дедлайн подачі:</span>
                    <span className="info-value">{conf.submission_deadline}</span>
                  </div>
                </div>
                
                {conf.description && (
                  <p className="conferencesCardDescription">{conf.description.substring(0, 200)}...</p>
                )}
                
                <div className="conferencesCardFooter">
                  <Link to={`/conferences/${conf.id}`} className="conferencesDetailLink">
                    Детальніше →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Conferences;