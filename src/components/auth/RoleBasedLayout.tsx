import { useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import MainLayout from '../layout/MainLayout';
import UserAppLayout from '../layout/UserAppLayout';
import PwaInstallFab from '../pwa/PwaInstallFab';

const ADMIN_PATHS = ['/users', '/regions', '/lessons', '/settings', '/onaylamalar'];
const REGION_SUPERVISOR_PATHS = [
  '/users',
  '/books',
  '/lessons',
  '/onaylamalar',
  '/vird-girisi',
  '/vird-raporlari',
];

export default function RoleBasedLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const path = location.pathname;
  const isAdmin = user?.role === 'admin';
  const isRegionSupervisor = user?.role === 'regionSupervisor';

  if (isAdmin) {
    if (path === '/vird-takip') {
      return <Navigate to="/" replace />;
    }
    return (
      <>
        <MainLayout />
        <PwaInstallFab />
      </>
    );
  }

  if (isRegionSupervisor) {
    const myRegionId = user?.regionIds?.[0];
    const canAccessOwnRegionDetail =
      Boolean(myRegionId) &&
      (path === `/regions/${myRegionId}` || path.startsWith(`/regions/${myRegionId}/`));
    const isAllowed =
      path === '/profile' ||
      path.startsWith('/profile/') ||
      REGION_SUPERVISOR_PATHS.some((p) => path === p || path.startsWith(p)) ||
      canAccessOwnRegionDetail;
    if (!isAllowed) {
      return <Navigate to="/users" replace />;
    }
    return (
      <>
        <MainLayout />
        <PwaInstallFab />
      </>
    );
  }

  const isAdminPath = ADMIN_PATHS.some((p) => path.startsWith(p));
  if (isAdminPath) {
    return <Navigate to="/" replace />;
  }

  const isUserAllowed =
    path === '/' ||
    path === '/profile' ||
    path.startsWith('/profile/') ||
    path.startsWith('/my-books') ||
    path.startsWith('/region-lessons') ||
    path.startsWith('/my-lessons') ||
    path.startsWith('/teachers') ||
    path.startsWith('/notifications') ||
    path.startsWith('/vird-takip');
  if (!isUserAllowed) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <UserAppLayout />
      <PwaInstallFab />
    </>
  );
}
