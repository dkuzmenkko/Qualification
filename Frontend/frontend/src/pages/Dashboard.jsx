import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import '../styles/Dashboard.css';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [myConferences, setMyConferences] = useState([]);
  const [mySubmissions, setMySubmissions] = useState([]); // Додано для тез автора

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        let response;
        
        // Отримуємо дані залежно від ролі
        if (user.role === 'AUTHOR') {
          response = await api.get('/submissions/dashboard/author/');
        } else if (user.role === 'REVIEWER') {
          response = await api.get('/submissions/dashboard/reviewer/');
        } else if (user.role === 'ADMIN') {
          response = await api.get('/submissions/dashboard/admin/');
        } else if (user.role === 'ORGANIZER') {
          response = await api.get('/submissions/dashboard/organizer/');
        } else {
          response = await api.get('/submissions/dashboard/author/');
        }
        setDashboardData(response.data);
        
        // Отримуємо конференції, де користувач є організатором
        // Це стосується як REVIEWER, так і ORGANIZER
        const confsRes = await api.get('/conferences/');
        const myConfs = confsRes.data.filter(conf => conf.organizer?.id === user.id);
        setMyConferences(myConfs);
        
        // Отримуємо тези, де користувач є автором (для рецензентів, які також подають тези)
        if (user.role === 'REVIEWER') {
          const subsRes = await api.get('/submissions/');
          const authorSubs = subsRes.data.filter(sub => sub.author === user.id);
          setMySubmissions(authorSubs);
        }
        
      } catch (error) {
        console.error('Error fetching dashboard:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDashboard();
  }, [user]);

  const navigateToSubmissions = (status = null, filterType = null) => {
    const params = new URLSearchParams();
    
    if (status) {
      params.append('status', status);
    }
    
    if (filterType === 'my_reviews_accepted') {
      params.append('my_reviews', 'accepted');
    } else if (filterType === 'my_reviews_rejected') {
      params.append('my_reviews', 'rejected');
    } else if (filterType === 'my_reviews_revision') {
      params.append('my_reviews', 'revision');
    } else if (filterType === 'reviewed') {
      params.append('reviewed_by_me', 'true');
    } else if (filterType === 'to_review') {
      params.append('to_review', 'true');
    }
    
    navigate(`/submissions?${params.toString()}`);
  };

  const navigateToUsers = (role = null, pending = false) => {
    const params = new URLSearchParams();
    if (role) params.append('role', role);
    if (pending) params.append('pending', 'true');
    navigate(`/users?${params.toString()}`);
  };

  const navigateToConferences = (status = null, category = null) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (category) params.append('category', category);
    navigate(`/conferences?${params.toString()}`);
  };

  const navigateToInvitations = () => {
    navigate('/invitations');
  };

  if (loading) return <div>Завантаження...</div>;
  if (!dashboardData) return <div>Помилка завантаження даних</div>;

  // Дашборд для автора
  if (user.role === 'AUTHOR') {
    return (
      <div className="dashboardContainer">
        <div className="dashboardHeader">
          <h1>Дашборд автора</h1>
          <p className="dashboardSubtitle">
            Огляд ваших тез та активності
          </p>
        </div>
        
        <div className="dashboardSection">
          <h2>Статистика</h2>
          <div className="dashboardStatsGrid">
            <div className="dashboardStatCard dashboardStatCardDefault" onClick={() => navigateToSubmissions()}>
              <h3>Всього тез</h3>
              <p className="dashboardStatNumber">{dashboardData.statistics.total}</p>
            </div>
            
            <div className="dashboardStatCard dashboardStatCardBlue" onClick={() => navigateToSubmissions('DRAFT')}>
              <h3>Чернетки</h3>
              <p className="dashboardStatNumber">{dashboardData.statistics.draft}</p>
            </div>
            
            <div className="dashboardStatCard dashboardStatCardOrange" onClick={() => navigateToSubmissions('PENDING')}>
              <h3>На рецензуванні</h3>
              <p className="dashboardStatNumber">{dashboardData.statistics.pending}</p>
            </div>
            
            <div className="dashboardStatCard dashboardStatCardAmber" onClick={() => navigateToSubmissions('REVISION_REQUIRED')}>
              <h3>Потребують доопрацювання</h3>
              <p className="dashboardStatNumber">{dashboardData.statistics.revision_required}</p>
            </div>
            
            <div className="dashboardStatCard dashboardStatCardGreen" onClick={() => navigateToSubmissions('ACCEPTED')}>
              <h3>Прийнято</h3>
              <p className="dashboardStatNumber">{dashboardData.statistics.accepted}</p>
            </div>
            
            <div className="dashboardStatCard dashboardStatCardRed" onClick={() => navigateToSubmissions('REJECTED')}>
              <h3>Відхилено</h3>
              <p className="dashboardStatNumber">{dashboardData.statistics.rejected}</p>
            </div>
          </div>
        </div>
        
        <div className="dashboardActions">
          <Link to="/submissions">
            <button className="dashboardPrimaryButton">Переглянути всі тези</button>
          </Link>
        </div>
        
        {dashboardData.draft && dashboardData.draft.length > 0 && (
          <div className="dashboardSection">
            <h2>Чернетки</h2>
            {dashboardData.draft.map(sub => (
              <div key={sub.id} className="dashboardDraftItem">
                <Link to={`/submissions/${sub.id}`}>{sub.title}</Link>
                <Link to={`/submissions/edit/${sub.id}`} className="dashboardEditLink">Редагувати</Link>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  
  // Дашборд для рецензента (з можливістю бачити і рецензії, і свої тези, і конференції)
  if (user.role === 'REVIEWER') {
    return (
      <div className="dashboardContainer">
        <div className="dashboardHeader">
          <h1>Кабінет рецензента</h1>
          <p className="dashboardSubtitle">
            Огляд ваших рецензій, тез та конференцій
          </p>
        </div>
        
        {/* Секція статистики рецензій */}
        <div className="dashboardSection">
          <h2>Статистика рецензій</h2>
          <div className="dashboardStatsGrid">
            <div className="dashboardStatCard dashboardStatCardOrange" onClick={() => navigateToSubmissions(null, 'to_review')}>
              <h3>На рецензування</h3>
              <p className="dashboardStatNumber">{dashboardData.statistics.to_review_count}</p>
            </div>
            
            <div className="dashboardStatCard dashboardStatCardLightBlue" onClick={() => navigateToSubmissions(null, 'reviewed')}>
              <h3>Перевірено</h3>
              <p className="dashboardStatNumber">{dashboardData.statistics.reviewed_count}</p>
            </div>
            
            <div className="dashboardStatCard dashboardStatCardGreen" onClick={() => navigateToSubmissions(null, 'my_reviews_accepted')}>
              <h3>Прийнято (мої рецензії)</h3>
              <p className="dashboardStatNumber">{dashboardData.statistics.accepted_count}</p>
            </div>
            
            <div className="dashboardStatCard dashboardStatCardRed" onClick={() => navigateToSubmissions(null, 'my_reviews_rejected')}>
              <h3>Відхилено (мої рецензії)</h3>
              <p className="dashboardStatNumber">{dashboardData.statistics.rejected_count}</p>
            </div>
            
            <div className="dashboardStatCard dashboardStatCardAmber" onClick={() => navigateToSubmissions(null, 'my_reviews_revision')}>
              <h3>Потребують доопрацювання</h3>
              <p className="dashboardStatNumber">{dashboardData.statistics.revision_count}</p>
            </div>
            
            <div className="dashboardStatCard dashboardStatCardCyan" onClick={navigateToInvitations}>
              <h3>Запрошень очікує</h3>
              <p className="dashboardStatNumber">{dashboardData.statistics.pending_invitations}</p>
            </div>
          </div>
        </div>
        
        {/* Секція моїх тез (як автор) */}
        {mySubmissions.length > 0 && (
          <div className="dashboardSection">
            <h2>Мої подані тези (як автор)</h2>
            <div className="dashboardMyConferencesList">
              {mySubmissions.slice(0, 5).map(sub => (
                <div key={sub.id} className="dashboardOrganizerConferenceCard">
                  <div>
                    <Link to={`/submissions/${sub.id}`} className="dashboardConferenceLink">
                      {sub.title}
                    </Link>
                    <p className="dashboardConferenceMeta">
                      Статус: {sub.status === 'DRAFT' ? 'Чернетка' : 
                               sub.status === 'PENDING' ? 'На рецензуванні' :
                               sub.status === 'ACCEPTED' ? 'Прийнято' : 
                               sub.status === 'REJECTED' ? 'Відхилено' : 'Потребує доопрацювання'}
                    </p>
                  </div>
                  <Link to={`/submissions/${sub.id}`}>
                    <button className="dashboardSmallButton">Переглянути</button>
                  </Link>
                </div>
              ))}
            </div>
            {mySubmissions.length > 5 && (
              <Link to="/submissions">
                <button className="dashboardSecondaryButton">Всі мої тези →</button>
              </Link>
            )}
          </div>
        )}
        
        {/* Секція моїх конференцій (як організатор) */}
        {myConferences.length > 0 && (
          <div className="dashboardSection">
            <h2>Мої конференції (як організатор)</h2>
            <div className="dashboardMyConferencesList">
              {myConferences.slice(0, 5).map(conf => {
                const isActive = new Date(conf.submission_deadline) >= new Date();
                return (
                  <div key={conf.id} className={`dashboardConferenceCard ${isActive ? 'dashboardConferenceActive' : 'dashboardConferenceInactive'}`}>
                    <div className="dashboardConferenceHeader">
                      <div>
                        <h3 className="dashboardConferenceTitle">
                          <Link to={`/conferences/${conf.id}`}>{conf.title}</Link>
                          {isActive && (
                            <span className="dashboardActiveBadge">Активна</span>
                          )}
                        </h3>
                        <p><strong>ID:</strong> {conf.conference_id}</p>
                        <p><strong>Дата:</strong> {conf.event_date}</p>
                        <p><strong>Дедлайн:</strong> {conf.submission_deadline}</p>
                        <p><strong>Рецензентів:</strong> {conf.reviewers?.length || 0}</p>
                      </div>
                      <div className="dashboardConferenceActions">
                        <Link to={`/conferences/${conf.id}`}>
                          <button className="dashboardSmallButton dashboardBlueButton">Управління</button>
                        </Link>
                        <Link to={`/submissions?conference=${conf.id}`}>
                          <button className="dashboardSmallButton dashboardOrangeButton">Тези</button>
                        </Link>
                      </div>
                    </div>
                    
                    <div className="dashboardExportButtons">
                      <Link to={`/exports/conferences/${conf.id}/participants/`}>
                        <button className="dashboardExportButton">Експортувати учасників</button>
                      </Link>
                      <Link to={`/exports/conferences/${conf.id}/submissions/`}>
                        <button className="dashboardExportButton">Експортувати тези</button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {myConferences.length > 5 && (
              <div className="dashboardViewAll">
                <Link to="/my-conferences">
                  <button className="dashboardPrimaryButton">Показати всі {myConferences.length} конференцій →</button>
                </Link>
              </div>
            )}
          </div>
        )}
        
        {/* Запрошення */}
        {dashboardData.invitations && dashboardData.invitations.length > 0 && (
          <div className="dashboardSection">
            <h2>Запрошення</h2>
            {dashboardData.invitations.map(inv => (
              <div key={inv.id} className="dashboardInvitationItem">
                <p>Конференція: {inv.conference.title}</p>
                <Link to="/invitations">Відповісти</Link>
              </div>
            ))}
          </div>
        )}
        
        {/* Кнопка створення конференції */}
        {user.is_approved && (
          <div className="dashboardActions">
            <Link to="/conferences/create">
              <button className="dashboardSuccessButton">+ Створити нову конференцію</button>
            </Link>
          </div>
        )}
      </div>
    );
  }
  
  // Дашборд для організатора
  if (user.role === 'ORGANIZER') {
    return (
      <div className="dashboardContainer">
        <div className="dashboardHeader">
          <h1>Дашборд організатора</h1>
          <p className="dashboardSubtitle">
            Огляд ваших конференцій та активності
          </p>
        </div>
        
        <div className="dashboardActionButtons">
          <Link to="/my-conferences">
            <button className="dashboardSuccessButton"> Всі мої конференції</button>
          </Link>
          <Link to="/conferences/create">
            <button className="dashboardPrimaryButton">+ Створити конференцію</button>
          </Link>
        </div>
        
        <div className="dashboardSection">
          <h2>Загальна статистика</h2>
          <div className="dashboardStatsGrid">
            <div className="dashboardStatCard dashboardStatCardDefault" onClick={() => navigate('/my-conferences')}>
              <h3>Всього конференцій</h3>
              <p className="dashboardStatNumber">{dashboardData.statistics.total_conferences}</p>
            </div>
            
            <div className="dashboardStatCard dashboardStatCardGreen" onClick={() => navigate('/my-conferences')}>
              <h3>Активних конференцій</h3>
              <p className="dashboardStatNumber">{dashboardData.statistics.active_conferences}</p>
            </div>
            
            <div className="dashboardStatCard dashboardStatCardBlue" onClick={() => navigate('/submissions?my_conferences=true')}>
              <h3>Всього тез</h3>
              <p className="dashboardStatNumber">{dashboardData.statistics.total_submissions}</p>
            </div>
            
            <div className="dashboardStatCard dashboardStatCardGreen" onClick={() => navigate('/submissions?my_conferences=true&status=ACCEPTED')}>
              <h3>Прийнято тез</h3>
              <p className="dashboardStatNumber">{dashboardData.statistics.total_accepted}</p>
            </div>
          </div>
        </div>
        
        {myConferences.length > 0 && (
          <div className="dashboardSection">
            <h2>Мої конференції</h2>
            <div className="dashboardMyConferencesList">
              {myConferences.slice(0, 5).map(conf => {
                const isActive = new Date(conf.submission_deadline) >= new Date();
                return (
                  <div key={conf.id} className={`dashboardConferenceCard ${isActive ? 'dashboardConferenceActive' : 'dashboardConferenceInactive'}`}>
                    <div className="dashboardConferenceHeader">
                      <div>
                        <h3 className="dashboardConferenceTitle">
                          <Link to={`/conferences/${conf.id}`}>{conf.title}</Link>
                          {isActive && (
                            <span className="dashboardActiveBadge">Активна</span>
                          )}
                        </h3>
                        <p><strong>ID:</strong> {conf.conference_id}</p>
                        <p><strong>Дата:</strong> {conf.event_date}</p>
                        <p><strong>Дедлайн:</strong> {conf.submission_deadline}</p>
                        <p><strong>Рецензентів:</strong> {conf.reviewers?.length || 0}</p>
                      </div>
                      <div className="dashboardConferenceActions">
                        <Link to={`/conferences/${conf.id}`}>
                          <button className="dashboardSmallButton dashboardBlueButton">Управління</button>
                        </Link>
                        <Link to={`/submissions?conference=${conf.id}`}>
                          <button className="dashboardSmallButton dashboardOrangeButton">Тези ({conf.submissions?.length || 0})</button>
                        </Link>
                      </div>
                    </div>
                    
                    <div className="dashboardExportButtons">
                      <Link to={`/exports/conferences/${conf.id}/participants/`}>
                        <button className="dashboardExportButton">Експортувати учасників</button>
                      </Link>
                      <Link to={`/exports/conferences/${conf.id}/submissions/`}>
                        <button className="dashboardExportButton">Експортувати тези</button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {myConferences.length > 5 && (
              <div className="dashboardViewAll">
                <Link to="/my-conferences">
                  <button className="dashboardPrimaryButton">Показати всі {myConferences.length} конференцій →</button>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
 
  return (
    <div className="dashboardContainer">
      <h1>Дашборд</h1>
      <p>Роль не визначена</p>
    </div>
  );
};

export default Dashboard;