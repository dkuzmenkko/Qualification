import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import '../styles/Exports.css';

const Exports = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [conferences, setConferences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [historyRes, confsRes] = await Promise.all([
          api.get('/exports/history/'),
          api.get('/conferences/')
        ]);
        setHistory(historyRes.data);
        const myConfs = confsRes.data.filter(c => c.organizer?.id === user?.id);
        setConferences(myConfs);
      } catch (error) {
        console.error('Error fetching export data:', error);
        setError('Помилка завантаження даних');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [user?.id]);

  const handleExport = async (conferenceId, type) => {
    setExporting(prev => ({ ...prev, [type]: true }));
    setError('');
    
    try {
      let url;
      if (type === 'participants') {
        url = `/exports/conferences/${conferenceId}/participants/`;
      } else {
        url = `/exports/conferences/${conferenceId}/submissions/`;
      }
      
      console.log('Exporting from:', url);
      
      const response = await api.get(url, {
        responseType: 'blob',
        headers: {
          'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      });
      
      const contentType = response.headers['content-type'];
      if (!contentType || !contentType.includes('spreadsheetml') && !contentType.includes('excel')) {
        const text = await response.data.text();
        console.error('Server returned non-excel response:', text);
        throw new Error('Сервер повернув помилку замість файлу');
      }
      
      const blob = new Blob([response.data], { type: contentType });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `${type}_${conferenceId}_${new Date().toISOString().slice(0,19)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      const historyRes = await api.get('/exports/history/');
      setHistory(historyRes.data);
      
      alert('Файл успішно завантажено!');
      
    } catch (error) {
      console.error('Error exporting:', error);
      if (error.response?.status === 403) {
        setError('У вас немає прав для експорту цієї конференції');
      } else if (error.response?.status === 404) {
        setError('Конференцію не знайдено');
      } else {
        setError(`Помилка при експорті: ${error.message || 'невідома помилка'}`);
      }
    } finally {
      setExporting(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleExportSubmissionPDF = async (submissionId) => {
    setExporting(prev => ({ ...prev, pdf: true }));
    setError('');
    
    try {
      const response = await api.get(`/exports/submissions/${submissionId}/pdf/`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `thesis_${submissionId}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      const historyRes = await api.get('/exports/history/');
      setHistory(historyRes.data);
      
    } catch (error) {
      console.error('Error exporting PDF:', error);
      setError('Помилка при експорті PDF');
    } finally {
      setExporting(prev => ({ ...prev, pdf: false }));
    }
  };

  const getExportTypeText = (type) => {
    switch(type) {
      case 'PARTICIPANTS': return 'Список учасників';
      case 'SUBMISSIONS': return 'Список тез';
      case 'SUBMISSION_PDF': return 'Теза PDF';
      default: return type;
    }
  };

  if (loading) return <div>Завантаження...</div>;

  return (
    <div className="exportsContainer">
      <h1>Експорт даних</h1>
      
      {error && (
        <div className="exportsError">
          <strong>Помилка:</strong> {error}
        </div>
      )}
      
      {conferences.length === 0 && user?.role === 'REVIEWER' ? (
        <div className="exportsEmptyState">
          <p>У вас немає конференцій, для яких ви є організатором.</p>
          <Link to="/conferences/create">Створити конференцію</Link>
        </div>
      ) : conferences.length === 0 ? (
        <p>У вас немає конференцій для експорту</p>
      ) : (
        <div>
          <h2>Ваші конференції</h2>
          {conferences.map(conf => (
            <div key={conf.id} className="exportsConferenceCard">
              <h3>{conf.title}</h3>
              <p><strong>ID:</strong> {conf.conference_id}</p>
              <p><strong>Дата проведення:</strong> {conf.event_date}</p>
              <p><strong>Дедлайн подачі:</strong> {conf.submission_deadline}</p>
              
              <div className="exportsButtons">
                <button 
                  onClick={() => handleExport(conf.id, 'participants')}
                  disabled={exporting.participants}
                  className="exportsButton exportsParticipantsButton"
                >
                  {exporting.participants ? 'Експорт учасників...' : 'Експортувати учасників (Excel)'}
                </button>
                <button 
                  onClick={() => handleExport(conf.id, 'submissions')}
                  disabled={exporting.submissions}
                  className="exportsButton exportsSubmissionsButton"
                >
                  {exporting.submissions ? 'Експорт тез...' : 'Експортувати тези (Excel)'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="exportsHistorySection">
        <h2>Історія експортів</h2>
        {history.length === 0 ? (
          <p>Немає історії експортів</p>
        ) : (
          <table className="exportsTable">
            <thead>
              <tr>
                <th>Тип</th>
                <th>Конференція</th>
                <th>Файл</th>
                <th>Дата</th>
              </tr>
            </thead>
            <tbody>
              {history.map(exp => (
                <tr key={exp.id}>
                  <td>{getExportTypeText(exp.export_type)}</td>
                  <td>{exp.conference_title || '-'}</td>
                  <td>{exp.file_name}</td>
                  <td>{exp.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Exports;