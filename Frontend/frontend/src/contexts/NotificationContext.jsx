import { createContext, useContext, useState, useCallback } from 'react';
import NotificationToast from '../components/NotificationToast';

const NotificationContext = createContext();

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const showNotification = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type, duration }]);
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  const success = useCallback((message, duration = 3000) => {
    showNotification(message, 'success', duration);
  }, [showNotification]);

  const error = useCallback((message, duration = 4000) => {
    showNotification(message, 'error', duration);
  }, [showNotification]);

  const warning = useCallback((message, duration = 3000) => {
    showNotification(message, 'warning', duration);
  }, [showNotification]);

  const info = useCallback((message, duration = 3000) => {
    showNotification(message, 'info', duration);
  }, [showNotification]);

  return (
    <NotificationContext.Provider value={{ showNotification, success, error, warning, info }}>
      {children}
      {notifications.map(notification => (
        <NotificationToast
          key={notification.id}
          message={notification.message}
          type={notification.type}
          duration={notification.duration}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </NotificationContext.Provider>
  );
};