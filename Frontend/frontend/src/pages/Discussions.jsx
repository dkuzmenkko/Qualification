import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import Avatar from '../components/Avatar';
import '../styles/Discussions.css';

const Discussions = () => {
  const { user } = useAuth();
  const [discussions, setDiscussions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    category: '',
    search: '',
  });
  const [categories, setCategories] = useState([]);

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
    const fetchDiscussions = async () => {
      setLoading(true);
      try {
        const response = await api.get('/submissions/accepted/');
        let data = response.data;
        
        if (filters.category) {
          data = data.filter(sub => sub.conference_detail?.category === filters.category);
        }
        
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          data = data.filter(sub => 
            sub.title.toLowerCase().includes(searchLower) ||
            sub.abstract?.toLowerCase().includes(searchLower) ||
            sub.author_full_name?.toLowerCase().includes(searchLower)
          );
        }
        
        setDiscussions(data);
      } catch (error) {
        console.error('Error fetching discussions:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDiscussions();
  }, [filters]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  if (loading) return <div>Завантаження...</div>;

  return (
    <div className="discussionsContainer">
      <h1>Обговорення тез</h1>
      <p className="discussionsDescription">
        Тут ви можете обговорювати прийняті тези активних конференцій
      </p>
      
      <div className="discussionsFilters">
        <div className="discussionsFilterRow">
          <input
            type="text"
            name="search"
            placeholder="Пошук за назвою тези..."
            value={filters.search}
            onChange={handleFilterChange}
            className="discussionsSearchInput"
          />
          
          <select 
            name="category" 
            value={filters.category} 
            onChange={handleFilterChange}
            className="discussionsFilterSelect"
          >
            <option value="">Всі категорії</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
      </div>
      
      {discussions.length === 0 ? (
        <div className="discussionsEmpty">
          <p>Немає доступних обговорень</p>
          <p className="discussionsHint">
            Тут відображаються прийняті тези активних конференцій (не старші 1 року)
          </p>
        </div>
      ) : (
        <div className="discussionsList">
          {discussions.map(discussion => (
            <div key={discussion.id} className="discussionCard">
              <div className="discussionCardHeader">
                <h3>
                  <Link to={`/discussions/${discussion.id}`}>{discussion.title}</Link>
                </h3>
                <span className="discussionStatus">Прийнято</span>
              </div>
              <div className="discussionCardInfo">
                <div className="discussion-author">
                  <Avatar user={{ id: discussion.author, full_name: discussion.author_full_name }} size="small" />
                  <Link to={`/profile/${discussion.author}`}>{discussion.author_full_name}</Link>
                </div>
                <p><strong>Конференція:</strong> {discussion.conference_title}</p>
                <p><strong>Категорія:</strong> {discussion.conference_detail?.category}</p>
                <p><strong>Дата:</strong> {new Date(discussion.created_at).toLocaleDateString()}</p>
              </div>
              {discussion.abstract && (
                <p className="discussionCardAbstract">
                  {discussion.abstract.substring(0, 200)}
                  {discussion.abstract.length > 200 && '...'}
                </p>
              )}
              <div className="discussionCardStats">
                <span>Коментарів: {discussion.comments_count}</span>
                <span>Переглядів: {discussion.views_count}</span>
              </div>
              <div className="discussionCardFooter">
                <Link to={`/discussions/${discussion.id}`} className="discussionViewLink">
                  Перейти до обговорення
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Discussions;