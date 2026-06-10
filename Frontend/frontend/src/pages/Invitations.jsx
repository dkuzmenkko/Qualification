import React, { useState, useEffect } from 'react';
import api from '../services/api';
import '../styles/Invitations.css';

const Invitations = () => {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState({});

  useEffect(() => {
    const fetchInvitations = async () => {
      try {
        const response = await api.get('/conferences/my-invitations/');
        setInvitations(response.data);
      } catch (error) {
        console.error('Error fetching invitations:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchInvitations();
  }, []);

  const handleRespond = async (conferenceId, action) => {
    setResponding(prev => ({ ...prev, [conferenceId]: true }));
    try {
      await api.post('/conferences/invitation/respond/', {
        conference_id: conferenceId,
        action: action
      });
      setInvitations(prev => prev.filter(inv => inv.conference.id !== conferenceId));
      alert(action === 'ACCEPT' ? 'Запрошення прийнято' : 'Запрошення відхилено');
    } catch (error) {
      console.error('Error responding to invitation:', error);
      alert('Помилка при відповіді на запрошення');
    } finally {
      setResponding(prev => ({ ...prev, [conferenceId]: false }));
    }
  };

  if (loading) return <div>Завантаження...</div>;

  return (
    <div className="invitationsContainer">
      <h1>Запрошення рецензента</h1>
      
      {invitations.length === 0 ? (
        <p className="invitationsEmpty">У вас немає активних запрошень</p>
      ) : (
        <div className="invitationsList">
          {invitations.map(inv => (
            <div key={inv.id} className="invitationsCard">
              <h2 className="invitationsTitle">{inv.conference.title}</h2>
              <p><strong>Організатор:</strong> {inv.conference.organizer?.full_name || inv.conference.organizer?.username}</p>
              <p><strong>Дата проведення:</strong> {inv.conference.event_date}</p>
              <p><strong>Дедлайн подачі:</strong> {inv.conference.submission_deadline}</p>
              <p><strong>Отримано:</strong> {new Date(inv.created_at).toLocaleString()}</p>
              
              <div className="invitationsButtons">
                <button 
                  onClick={() => handleRespond(inv.conference.id, 'ACCEPT')}
                  disabled={responding[inv.conference.id]}
                  className="invitationsAcceptButton"
                >
                  {responding[inv.conference.id] ? 'Обробка...' : 'Прийняти'}
                </button>
                <button 
                  onClick={() => handleRespond(inv.conference.id, 'REJECT')}
                  disabled={responding[inv.conference.id]}
                  className="invitationsRejectButton"
                >
                  {responding[inv.conference.id] ? 'Обробка...' : 'Відхилити'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Invitations;