import { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const refreshIntervalRef = useRef(null);

  const refreshToken = useCallback(async () => {
    const refreshTokenValue = localStorage.getItem('refresh_token');
    if (!refreshTokenValue) return false;

    try {
      const response = await api.post('/token/refresh/', {
        refresh: refreshTokenValue
      });
      
      const newAccessToken = response.data.access;
      localStorage.setItem('access_token', newAccessToken);
      api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
      
      return true;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      logout();
      return false;
    }
  }, []);

  const isTokenExpired = useCallback((token) => {
    if (!token) return true;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000; 
      return Date.now() >= exp;
    } catch (error) {
      return true;
    }
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem('access_token');
    if (storedToken && !isTokenExpired(storedToken)) {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      
      refreshIntervalRef.current = setInterval(() => {
        refreshToken();
      }, 4 * 60 * 1000); 
    }
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [refreshToken, isTokenExpired]);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await api.get('/users/me/');
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      if (error.response?.status === 401) {
        logout();
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('access_token');
      
      if (storedToken) {
        if (isTokenExpired(storedToken)) {
          const refreshed = await refreshToken();
          if (!refreshed) {
            setLoading(false);
            return;
          }
        } else {
          api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        }
        
        await fetchCurrentUser();
      } else {
        setLoading(false);
      }
    };
    
    initAuth();
  }, [fetchCurrentUser, isTokenExpired, refreshToken]);

  const login = async (username, password, captchaValue, captchaKey) => {
    const response = await api.post('/users/login/', { 
      username, 
      password,
      captcha_key: captchaKey,
      captcha_response: captchaValue
    });
    const { token: accessToken, user: userData, refresh: refreshTokenValue } = response.data;
    
    localStorage.setItem('access_token', accessToken);
    if (refreshTokenValue) {
      localStorage.setItem('refresh_token', refreshTokenValue);
    }
    
    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    setUser(userData);
    return userData;
  };

  const register = async (userData) => {
    const response = await api.post('/users/register/', userData);
    const { token: accessToken, user: userDataResponse, refresh: refreshTokenValue } = response.data;
    
    localStorage.setItem('access_token', accessToken);
    if (refreshTokenValue) {
      localStorage.setItem('refresh_token', refreshTokenValue);
    }
    
    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    setUser(userDataResponse);
    return userDataResponse;
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
    delete api.defaults.headers.common['Authorization'];
    
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }
  };

  const updateUser = (userData) => {
    setUser(userData);
  };

  const refreshUser = async () => {
    try {
      const response = await api.get('/users/me/');
      setUser(response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to refresh user:', error);
      return null;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      register, 
      logout, 
      updateUser, 
      refreshUser,
      loading 
    }}>
      {children}
    </AuthContext.Provider>
  );
};