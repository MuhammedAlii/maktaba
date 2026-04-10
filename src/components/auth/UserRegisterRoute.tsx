import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import UserRegister from '../../pages/auth/UserRegister';

export default function UserRegisterRoute() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <UserRegister />;
}
