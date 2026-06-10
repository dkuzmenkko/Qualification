import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import '../styles/Search.css';

const Search = () => {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim() || query.length < 2) return;
    
    setLoading(true);
    setSearched(true);
    
    try {
      const response = await api.get(`/recommendations/search/?q=${encodeURIComponent(query)}&type=${type}`);
      setResults(response.data.results);
    } catch (error) {
      console.error('Search error:', error);
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="searchContainer">
      <h1>Глобальний пошук</h1>
      
      <form onSubmit={handleSearch} className="searchForm">
        <div className="searchFormGroup">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Введіть запит (мінімум 2 символи)"
            required
            className="searchInput"
          />
          <select value={type} onChange={(e) => setType(e.target.value)} className="searchSelect">
            <option value="all">Всі</option>
            <option value="conferences">Конференції</option>
            <option value="submissions">Тези</option>
            {user && (user.role === 'ADMIN' || user.role === 'REVIEWER') && (
              <option value="users">Користувачі</option>
            )}
          </select>
          <button type="submit" disabled={loading} className="searchButton">
            {loading ? 'Пошук...' : 'Шукати'}
          </button>
        </div>
      </form>
      
      {searched && !loading && results && (
        <div className="searchResults">
          <h2>Результати пошуку: "{query}"</h2>
          
          {results.conferences && results.conferences.length > 0 && (
            <div className="searchResultSection">
              <h3>Конференції</h3>
              {results.conferences.map(conf => (
                <div key={conf.id} className="searchResultCard">
                  <Link to={`/conferences/${conf.id}`} className="searchResultTitle">{conf.title}</Link>
                  <p>{conf.description?.substring(0, 150)}</p>
                </div>
              ))}
            </div>
          )}
          
          {results.submissions && results.submissions.length > 0 && (
            <div className="searchResultSection">
              <h3>Тези</h3>
              {results.submissions.map(sub => (
                <div key={sub.id} className="searchResultCard">
                  <Link to={`/submissions/${sub.id}`} className="searchResultTitle">{sub.title}</Link>
                  <p>Автор: {sub.author_full_name}</p>
                  <p>Конференція: {sub.conference_title}</p>
                </div>
              ))}
            </div>
          )}
          
          {results.users && results.users.length > 0 && (
            <div className="searchResultSection">
              <h3>Користувачі</h3>
              {results.users.map(userData => (
                <div key={userData.id} className="searchResultCard">
                  <Link to={`/profile/${userData.id}`} className="searchResultTitle">{userData.full_name || userData.username}</Link>
                  <p>Email: {userData.email}</p>
                  <p>Роль: {userData.role}</p>
                </div>
              ))}
            </div>
          )}
          
          {(!results.conferences?.length && !results.submissions?.length && !results.users?.length) && (
            <p className="searchNoResults">Нічого не знайдено</p>
          )}
        </div>
      )}
    </div>
  );
};

export default Search;