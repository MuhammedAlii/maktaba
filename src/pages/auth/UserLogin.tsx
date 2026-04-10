import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../../services/authService';
import { useAuth } from '../../contexts/AuthContext';
import { showError, showLoading, hideLoading } from '../../services/notificationService';
import { HiLockClosed, HiMail } from 'react-icons/hi';
import loginUserBg from '../../assets/login_user_bg.jpg';
import maktabaLogo from '../../assets/maktaba-logo.png';

export default function UserLogin() {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [navigate, isAuthenticated, loading]);

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

  if (isAuthenticated) {
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!usernameOrEmail || !password) {
      await showError('Lütfen kullanıcı adı/email ve şifre girin');
      return;
    }

    setIsSubmitting(true);
    showLoading('Giriş yapılıyor...');

    try {
      await login(usernameOrEmail, password);
      hideLoading();
      // showSuccess('Giriş başarılı! Yönlendiriliyorsunuz...');
      setTimeout(() => {
        window.location.replace('/');
      }, 500);
    } catch (error: unknown) {
      hideLoading();
      const errorMessage =
        error instanceof Error ? error.message : 'Giriş yapılırken bir hata oluştu';
      await showError(errorMessage);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      {/* Arka plan görseli */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${loginUserBg})` }}
        aria-hidden
      />
      {/* Blur ve karartma katmanı */}
      <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" aria-hidden />
      {/* İçerik */}
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/95 shadow-large mb-4 ring-4 ring-white/30 overflow-hidden">
            <img src={maktabaLogo} alt="Maktaba" className="w-12 h-12 object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-white drop-shadow-lg mb-2">Maktaba</h1>
          <p className="text-white/90 drop-shadow">Kitaplarınız ve dersleriniz burada</p>
        </div>

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/20">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Giriş Yap</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Kullanıcı Adı veya Email
              </label>
              <div className="relative">
                <HiMail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder="kullanıcı adı veya email"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Şifre</label>
              <div className="relative">
                <HiLockClosed className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder="Şifrenizi girin"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all font-semibold shadow-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm">
            <Link
              to="/register"
              className="text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Kayıt Ol
            </Link>
            <span className="text-gray-400">|</span>
            <Link
              to="/forgot-password"
              className="text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Şifremi Unuttum
            </Link>
            <span className="text-gray-400">|</span>
            <Link
              to="/admin"
              className="text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Admin girişi
            </Link>
          </div>
        </div>

        <p className="text-center text-sm text-white/80 mt-6 drop-shadow">© 2025 Maktaba</p>
      </div>
    </div>
  );
}
