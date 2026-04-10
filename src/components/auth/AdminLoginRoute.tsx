import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AdminLogin from '../../pages/auth/AdminLogin';

export default function AdminLoginRoute() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <AdminLogin />;
}
