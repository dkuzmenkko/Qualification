import { useState, useEffect } from 'react';
import api from '../services/api';
import '../styles/SomeComponents.css';

const CaptchaModal = ({ isOpen, onClose, onVerify, title = "Підтвердження" }) => {
  const [captchaKey, setCaptchaKey] = useState('');
  const [captchaImage, setCaptchaImage] = useState('');
  const [captchaValue, setCaptchaValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const loadCaptcha = async () => {
    setLoading(true);
    setError('');
    setCaptchaValue('');
    try {
      const response = await api.get('/users/captcha/');
      setCaptchaKey(response.data.key);
      setCaptchaImage(`http://localhost:8000${response.data.image_url}`);
    } catch (err) {
      console.error('Error loading captcha:', err);
      setError('Помилка завантаження капчі');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCaptcha();
    }
  }, [isOpen]);

  const handleVerify = async () => {
    if (!captchaValue.trim()) {
      setError('Введіть код з картинки');
      return;
    }
    
    setVerifying(true);
    try {
      await onVerify(captchaValue, captchaKey);
      onClose();
      setCaptchaValue('');
    } catch (err) {
      setError(err.response?.data?.captcha || 'Невірний код, спробуйте ще раз');
      loadCaptcha();
    } finally {
      setVerifying(false);
    }
  };

  const handleRefresh = () => {
    loadCaptcha();
  };

  if (!isOpen) return null;

  return (
    <div className="captchaModalOverlay">
      <div className="captchaModalContainer">
        <div className="captchaModalHeader">
          <h2 className="captchaModalTitle">{title}</h2>
          <button className="captchaModalCloseButton" onClick={onClose}>
            ✕
          </button>
        </div>
        
        <div className="captchaModalBody">
          <label className="captchaModalLabel">
            Код з картинки
          </label>
          
          <div className="captchaModalImageSection">
            {loading ? (
              <div className="captchaModalLoadingBox">
                Завантаження...
              </div>
            ) : (
              <img 
                src={captchaImage} 
                alt="CAPTCHA" 
                className="captchaModalImage"
                onError={() => setError('Помилка завантаження зображення')}
              />
            )}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="captchaModalRefreshButton"
            >
              ↻
            </button>
          </div>
          
          <input
            type="text"
            value={captchaValue}
            onChange={(e) => setCaptchaValue(e.target.value)}
            placeholder="Введіть код з картинки"
            disabled={loading}
            className="captchaModalInput"
          />
          
          {error && (
            <div className="captchaModalError">
              {error}
            </div>
          )}
        </div>
        
        <div className="captchaModalFooter">
          <button
            onClick={onClose}
            className="captchaModalCancelButton"
          >
            Скасувати
          </button>
          <button
            onClick={handleVerify}
            disabled={verifying || loading}
            className="captchaModalVerifyButton"
            style={{ opacity: verifying ? 0.6 : 1 }}
          >
            {verifying ? 'Перевірка...' : 'Підтвердити'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CaptchaModal;