import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import '../styles/Home.css';

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [recommendedConferences, setRecommendedConferences] = useState([]);
  const [trendingConferences, setTrendingConferences] = useState([]);
  const [recommendedDiscussions, setRecommendedDiscussions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    if (user && (user.role === 'ADMIN' || user.is_superuser)) {
      navigate('/admin-dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        let recommendations = [];
        let trending = [];
        let discussions = [];
        
        if (user) {
          const recRes = await api.get('/recommendations/?limit=6');
          recommendations = recRes.data;
          
          const trendRes = await api.get('/recommendations/trending/');
          trending = trendRes.data;
          
          const discRes = await api.get('/recommendations/discussions/');
          discussions = discRes.data;
        } else {
          const [confsRes, subsRes] = await Promise.all([
            api.get('/conferences/?limit=6'),
            api.get('/submissions/accepted/?limit=6')
          ]);
          recommendations = confsRes.data;
          trending = confsRes.data;
          discussions = subsRes.data;
        }
        
        const catsRes = await api.get('/users/categories/');
        setCategories(catsRes.data.categories);
        
        setRecommendedConferences(recommendations);
        setTrendingConferences(trending);
        setRecommendedDiscussions(discussions);
        
      } catch (error) {
        console.error('Error fetching home data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [user]);

  const trackConferenceView = async (conferenceId) => {
    if (user) {
      try {
        await api.post(`/recommendations/track-view/${conferenceId}/`);
      } catch (error) {
        console.error('Error tracking view:', error);
      }
    }
  };

  const getConferenceStatus = (eventDate) => {
    const today = new Date();
    const event = new Date(eventDate);
    return event > today ? 'active' : 'past';
  };

  const getTypeLabel = (type) => {
    switch(type) {
      case 'ONLINE': return 'Онлайн';
      case 'OFFLINE': return 'Офлайн';
      case 'HYBRID': return 'Гібрид';
      default: return type || 'Не вказано';
    }
  };

  const getStatusLabel = (status) => {
    return status === 'active' ? 'Активна' : 'Завершена';
  };

  const filteredRecommendedConferences = recommendedConferences.filter(conf => {
    const matchesCategory = selectedCategory === '' || conf.category === selectedCategory;
    const matchesSearch = searchTerm === '' || 
      conf.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (conf.description && conf.description.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Завантаження...</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="heroSection">
        <h1 className="heroTitle">
          {user ? `Вітаємо, ${user.full_name || user.username}!` : ''}
        </h1>
        <p className="heroSubtitle">
          Платформа для подання тез, рецензування та обговорення наукових робіт
        </p>
        
        {!user ? (
          <div className="flexCenter gap15">
            <Link to="/login">
              <button className="btn btnPrimary btnLarge">Увійти</button>
            </Link>
            <Link to="/register">
              <button className="btn btnSuccess btnLarge">Зареєструватися</button>
            </Link>
          </div>
        ) : (
          <div className="flexCenter gap15">
            <Link to="/dashboard">
              <button className="btn btnPrimary btnLarge">Перейти до дашборду</button>
            </Link>
            {(user.role === 'AUTHOR' || user.role === 'REVIEWER') && (
              <button 
                onClick={() => navigate('/submissions')}
                className="btn btnSuccess btnLarge"
              >
                Мої тези
              </button>
            )}
          </div>
        )}
      </div>

      <div className="filterBar">
        <input
          type="text"
          placeholder="Пошук за назвою..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="formInput"
        />
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="formSelect"
        >
          <option value="">Всі категорії</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      <div className="section">
        <h2 className="sectionTitle">
          {user ? 'Рекомендовані для вас конференції' : 'Актуальні конференції'}
        </h2>
        
        {filteredRecommendedConferences.length === 0 ? (
          <div className="emptyState">
            <p>Немає конференцій за вашим запитом</p>
          </div>
        ) : (
          <div className="conferencesList">
            {filteredRecommendedConferences.map(conf => {
              const status = getConferenceStatus(conf.event_date);
              
              return (
                <div key={conf.id} className="conferenceCard" onClick={() => trackConferenceView(conf.id)}>
                  <div className="conferenceCardHeader">
                    <h3 className="conferenceCardTitle">
                      <Link to={`/conferences/${conf.id}`}>
                        {conf.title}
                      </Link>
                    </h3>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <span className={`conferenceStatusBadge ${status === 'active' ? 'statusActive' : 'statusPast'}`}>
                        {getStatusLabel(status)}
                      </span>
                      <span className="conferenceTypeBadge">
                        {getTypeLabel(conf.conference_type)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="conferenceCardInfo">
                    <div className="infoRow">
                      <span className="infoLabel">Категорія:</span>
                      <span className="infoValue conferenceCategory">{conf.category}</span>
                    </div>
                    <div className="infoRow">
                      <span className="infoLabel">ID:</span>
                      <span className="infoValue">{conf.conference_id}</span>
                    </div>
                    <div className="infoRow">
                      <span className="infoLabel">Дата проведення:</span>
                      <span className="infoValue">{new Date(conf.event_date).toLocaleDateString('uk-UA')}</span>
                    </div>
                    <div className="infoRow">
                      <span className="infoLabel">Дедлайн:</span>
                      <span className="infoValue">{new Date(conf.submission_deadline).toLocaleDateString('uk-UA')}</span>
                    </div>
                    {conf.institution && (
                      <div className="infoRow">
                        <span className="infoLabel">Організація:</span>
                        <span className="infoValue">{conf.institution}</span>
                      </div>
                    )}
                  </div>
                  
                  {conf.description && (
                    <div className="conferenceCardDescription">
                      {conf.description.substring(0, 150)}
                      {conf.description.length > 150 && '...'}
                    </div>
                  )}
                  
                  <div className="conferenceCardFooter">
                    <Link to={`/conferences/${conf.id}`} className="conferenceDetailLink">
                      Детальніше →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {trendingConferences.length > 0 && (
        <div className="section">
          <h2 className="sectionTitle">Популярні конференції</h2>
          <div className="popularConferencesGrid">
            {trendingConferences.slice(0, 4).map(conf => (
              <div key={conf.id} className="conferenceCardSmall">
                <div className="conferenceCardHeader">
                  <h4>
                    <Link to={`/conferences/${conf.id}`}>{conf.title}</Link>
                  </h4>
                  <span className="conferenceTypeBadgeSmall">
                    {getTypeLabel(conf.conference_type)}
                  </span>
                </div>
                <div className="infoRow">
                  <span className="infoLabel">Дата:</span>
                  <span>{new Date(conf.event_date).toLocaleDateString('uk-UA')}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="textCenter mt20">
            <Link to="/conferences">
              <button className="btn btnSecondary">Всі конференції →</button>
            </Link>
          </div>
        </div>
      )}

      <div className="section">
        <h2 className="sectionTitle">
          {user ? 'Рекомендовані обговорення' : 'Останні обговорення'}
        </h2>
        
        {recommendedDiscussions.length === 0 ? (
          <div className="emptyState">
            <p>Немає доступних обговорень</p>
          </div>
        ) : (
          <>
            <div className="submissionsList">
              {recommendedDiscussions.slice(0, 6).map(sub => (
                <div key={sub.id} className="submissionCard">
                  <div className="submissionCardHeader">
                    <h3 className="submissionCardTitle">
                      <Link to={`/discussions/${sub.id}`}>
                        {sub.title}
                      </Link>
                    </h3>
                    <span className="submissionStatusBadge statusAccepted">
                      Прийнято
                    </span>
                  </div>
                  
                  <div className="submissionCardInfo">
                    <div className="infoRow">
                      <span className="infoLabel">Конференція:</span>
                      <span className="infoValue">{sub.conference_title}</span>
                    </div>
                    <div className="infoRow">
                      <span className="infoLabel">Автор:</span>
                      <span className="infoValue">{sub.author_full_name}</span>
                    </div>
                  </div>
                  
                  <div className="submissionCardStats">
                    <span className="statItem">
                      <span className="statIcon"></span> {sub.comments_count || 0} коментарів
                    </span>
                    <span className="statItem">
                      <span className="statIcon"></span> {sub.views_count || 0} переглядів
                    </span>
                  </div>
                  
                  {sub.abstract && (
                    <div className="submissionCardAbstract">
                      {sub.abstract.substring(0, 120)}
                      {sub.abstract.length > 120 && '...'}
                    </div>
                  )}
                  
                  <div className="submissionCardFooter">
                    <Link to={`/discussions/${sub.id}`} className="submissionDetailLink">
                      До обговорення →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
            
            {recommendedDiscussions.length > 6 && (
              <div className="textCenter mt20">
                <Link to="/discussions">
                  <button className="btn btnSecondary">
                    Всі обговорення ({recommendedDiscussions.length})
                  </button>
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Home;