import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../../services/authService';
import { useAuth } from '../../contexts/AuthContext';
import { showError, showLoading, hideLoading } from '../../services/notificationService';
import { HiBookOpen, HiLockClosed, HiMail } from 'react-icons/hi';

export default function AdminLogin() {
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-large mb-4">
            <HiBookOpen className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Maktaba</h1>
          <p className="text-gray-600">Admin Paneline Hoş Geldiniz</p>
        </div>

        <div className="bg-white rounded-2xl shadow-large p-8 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Yönetici Girişi</h2>

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
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
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
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="Şifrenizi girin"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all font-semibold shadow-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>

          <p className="mt-6 text-center">
            <a href="/" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              Kullanıcı girişine dön
            </a>
          </p>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">© 2025 Maktaba Admin Panel</p>
      </div>
    </div>
  );
}
