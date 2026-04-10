import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import RoleBasedLayout from './components/auth/RoleBasedLayout';
import RoleBasedIndex from './components/auth/RoleBasedIndex';
import LandingOrApp from './components/auth/LandingOrApp';
import AdminLoginRoute from './components/auth/AdminLoginRoute';
import UserRegisterRoute from './components/auth/UserRegisterRoute';
import ForgotPasswordRoute from './components/auth/ForgotPasswordRoute';
import Users from './pages/users/Users';
import UserDetail from './pages/users/UserDetail';
import Books from './pages/books/Books';
import Regions from './pages/regions/Regions';
import RegionDetail from './pages/regions/RegionDetail';
import Settings from './pages/settings/Settings';
import Lessons from './pages/lessons/Lessons';
import Onaylamalar from './pages/admin/Onaylamalar';
import UserLessons from './pages/user/UserLessons';
import UserMyLessons from './pages/user/UserMyLessons';
import UserLessonDetail from './pages/user/UserLessonDetail';
import UserTeachers from './pages/user/UserTeachers';
import UserTeacherDetail from './pages/user/UserTeacherDetail';
import UserNotifications from './pages/user/UserNotifications';
import UserMyBooks from './pages/user/UserMyBooks';
import UserVirdTakip from './pages/user/UserVirdTakip';
import UserProfile from './pages/profile/UserProfile';
import Virdler from './pages/admin/Virdler';
import VirdGirisleri from './pages/admin/VirdGirisleri';
import VirdRaporlari from './pages/admin/VirdRaporlari';

// App Routes - AuthContext yüklendikten sonra render edilir
function AppRoutes() {
  const { loading } = useAuth();

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

  return (
    <Routes>
      {/* /admin - Yönetici giriş sayfası */}
      <Route path="/admin" element={<AdminLoginRoute />} />

      {/* /register - Kullanıcı kayıt sayfası */}
      <Route path="/register" element={<UserRegisterRoute />} />

      {/* /forgot-password - Şifremi unuttum */}
      <Route path="/forgot-password" element={<ForgotPasswordRoute />} />

      {/* /login - Geriye dönük uyumluluk için /'e yönlendir */}
      <Route path="/login" element={<Navigate to="/" replace />} />

      {/* / - Normal kullanıcı girişi veya uygulama */}
      <Route path="/" element={<LandingOrApp />}>
        <Route
          element={
            <ProtectedRoute>
              <RoleBasedLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<RoleBasedIndex />} />
            
            {/* Sadece Admin */}
            <Route
              path="users"
              element={
                <ProtectedRoute requiredRole="adminOrRegionSupervisor">
                  <Users />
                </ProtectedRoute>
              }
            />
            <Route
              path="users/:userId"
              element={
                <ProtectedRoute requiredRole="adminOrRegionSupervisor">
                  <UserDetail />
                </ProtectedRoute>
              }
            />
          <Route
            path="regions"
            element={
              <ProtectedRoute requiredRole="admin">
                <Regions />
              </ProtectedRoute>
            }
          />
          <Route
            path="lessons"
            element={
                <ProtectedRoute requiredRole="adminOrRegionSupervisor">
                <Lessons />
              </ProtectedRoute>
            }
          />
          <Route
            path="onaylamalar"
            element={
              <ProtectedRoute requiredRole="adminOrRegionSupervisor">
                <Onaylamalar />
              </ProtectedRoute>
            }
          />
          <Route
            path="regions/:regionId"
            element={
              <ProtectedRoute requiredRole="adminOrRegionSupervisor">
                <RegionDetail />
              </ProtectedRoute>
            }
          />
            <Route
              path="settings"
              element={
                <ProtectedRoute requiredRole="admin">
                  <Settings />
                </ProtectedRoute>
              }
            />

            {/* Vird - Admin / Bölge Sorunlusu */}
            <Route
              path="vird-girisi"
              element={
                <ProtectedRoute requiredRole="adminOrRegionSupervisor">
                  <VirdGirisleri />
                </ProtectedRoute>
              }
            />
            <Route
              path="vird-raporlari"
              element={
                <ProtectedRoute requiredRole="adminOrRegionSupervisor">
                  <VirdRaporlari />
                </ProtectedRoute>
              }
            />
            {/* Vird - Katalog (Sadece Admin) */}
            <Route
              path="vird-katalog"
              element={
                <ProtectedRoute requiredRole="admin">
                  <Virdler />
                </ProtectedRoute>
              }
            />
            
            {/* Admin - Kitaplar yönetimi */}
            <Route
              path="books"
              element={
                <ProtectedRoute>
                  <Books />
                </ProtectedRoute>
              }
            />
            {/* User - Benim kitaplarım */}
            <Route
              path="my-books"
              element={
                <ProtectedRoute>
                  <UserMyBooks />
                </ProtectedRoute>
              }
            />

            {/* User - Günlük vird takibi */}
            <Route
              path="vird-takip"
              element={
                <ProtectedRoute>
                  <UserVirdTakip />
                </ProtectedRoute>
              }
            />
            {/* User - Bölgedeki dersler (tüm liste) */}
            <Route
              path="region-lessons"
              element={
                <ProtectedRoute>
                  <UserLessons />
                </ProtectedRoute>
              }
            />
            {/* User - Benim derslerim (liste + detay) */}
            <Route
              path="my-lessons"
              element={
                <ProtectedRoute>
                  <UserMyLessons />
                </ProtectedRoute>
              }
            />
            <Route
              path="my-lessons/:scheduleId"
              element={
                <ProtectedRoute>
                  <UserLessonDetail />
                </ProtectedRoute>
              }
            />
            {/* User - Bölge hocaları (tüm liste) */}
            <Route
              path="teachers"
              element={
                <ProtectedRoute>
                  <UserTeachers />
                </ProtectedRoute>
              }
            />
            {/* User - Hoca detay sayfası */}
            <Route
              path="teachers/:teacherId"
              element={
                <ProtectedRoute>
                  <UserTeacherDetail />
                </ProtectedRoute>
              }
            />
            {/* User - Bildirimler */}
            <Route
              path="notifications"
              element={
                <ProtectedRoute>
                  <UserNotifications />
                </ProtectedRoute>
              }
            />
            {/* Oturum açmış herkes — kullanıcı arayüzü ve yönetici paneli */}
            <Route
              path="profile"
              element={
                <ProtectedRoute>
                  <UserProfile />
                </ProtectedRoute>
              }
            />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
