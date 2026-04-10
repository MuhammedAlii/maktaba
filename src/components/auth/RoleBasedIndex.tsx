import { useAuth } from '../../contexts/AuthContext';
import Dashboard from '../../pages/dashboard/Dashboard';
import UserHome from '../../pages/user/UserHome';

export default function RoleBasedIndex() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'regionSupervisor';

  return isAdmin ? <Dashboard /> : <UserHome />;
}
