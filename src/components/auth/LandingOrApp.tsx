import { useLocation, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import UserLogin from '../../pages/auth/UserLogin';
import AdminLogin from '../../pages/auth/AdminLogin';

export default function LandingOrApp() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const pathname = location.pathname;

  if (!isAuthenticated) {
    if (pathname === '/admin') {
      return <AdminLogin />;
    }
    if (pathname === '/' || pathname === '') {
      return <UserLogin />;
    }
    return <Navigate to="/" replace />;
  }

  if (pathname === '/admin') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
