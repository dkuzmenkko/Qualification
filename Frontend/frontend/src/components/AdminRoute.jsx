
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Завантаження...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (user.role !== 'ADMIN' && !user.is_superuser) {
    return <Navigate to="/dashboard" />;
  }

  return children;
};

export default AdminRoute;