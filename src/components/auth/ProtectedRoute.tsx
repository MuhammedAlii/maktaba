import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'admin' | 'user' | 'adminOrRegionSupervisor';
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, loading, isAdmin, isRegionSupervisor } = useAuth();

  // Yükleniyor
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-4 border-primary-600 mb-4"></div>
          <p className="text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Giriş yapılmamış - ana giriş sayfasına yönlendir
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Rol kontrolü
  if (requiredRole === 'admin' && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (requiredRole === 'adminOrRegionSupervisor' && !(isAdmin || isRegionSupervisor)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

