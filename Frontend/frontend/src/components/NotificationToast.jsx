import { useState, useEffect } from 'react';
import '../styles/SomeComponents.css';

const NotificationToast = ({ message, type = 'info', duration = 3000, onClose }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      if (onClose) onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!visible) return null;

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return '#4caf50';
      case 'error':
        return '#f44336';
      case 'warning':
        return '#ff9800';
      case 'info':
      default:
        return '#2196f3';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'warning':
        return '⚠';
      default:
        return 'ℹ';
    }
  };

  return (
    <div className="toastContainer">
      <div 
        className="toastContent"
        style={{ backgroundColor: getBackgroundColor() }}
      >
        <span className="toastIcon">{getIcon()}</span>
        <span className="toastMessage">{message}</span>
        <button
          onClick={() => {
            setVisible(false);
            if (onClose) onClose();
          }}
          className="toastCloseButton"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default NotificationToast;