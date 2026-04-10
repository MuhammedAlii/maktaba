import { useState, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register, type RegisterData } from '../../services/authService';
import { useAuth } from '../../contexts/AuthContext';
import { formatPhoneInput } from '../../utils/phoneMask';
import { showError, showLoading, hideLoading } from '../../services/notificationService';
import { useCollection } from '../../hooks/useFirestore';
import { where } from 'firebase/firestore';
import loginUserBg from '../../assets/login_user_bg.jpg';
import maktabaLogo from '../../assets/maktaba-logo.png';

interface Region {
  id: string;
  name: string;
  isActive?: boolean;
}

export default function UserRegister() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { data: regions } = useCollection<Region>('regions', [
    where('isActive', '==', true),
  ]);
  const regionDropdownRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    lastname: '',
    username: '',
    email: '',
    phone: '',
    regionId: '',
    adres: '',
    password: '',
    passwordConfirm: '',
  });
  const [isRegionOpen, setIsRegionOpen] = useState(false);
  const [regionSearch, setRegionSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [navigate, isAuthenticated, authLoading]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (regionDropdownRef.current && !regionDropdownRef.current.contains(e.target as Node)) {
        setIsRegionOpen(false);
      }
    };
    if (isRegionOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isRegionOpen]);

  const filteredRegions = regions.filter((r) =>
    r.name.toLowerCase().includes(regionSearch.toLowerCase())
  );
  const selectedRegion = regions.find((r) => r.id === formData.regionId);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.passwordConfirm) {
      await showError('Şifreler eşleşmiyor.');
      return;
    }
    if (formData.password.length < 6) {
      await showError('Şifre en az 6 karakter olmalıdır.');
      return;
    }
    if (!formData.name.trim() || !formData.lastname.trim() || !formData.username.trim() || !formData.email.trim()) {
      await showError('Ad, soyad, kullanıcı adı ve email zorunludur.');
      return;
    }

    setIsSubmitting(true);
    showLoading('Kayıt oluşturuluyor...');

    try {
      const data: RegisterData = {
        name: formData.name.trim(),
        lastname: formData.lastname.trim(),
        username: formData.username.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        regionId: formData.regionId,
        adres: formData.adres.trim(),
        password: formData.password,
      };
      await register(data);
      hideLoading();
      // await showSuccess('Kayıt başarılı! Giriş yapabilirsiniz. Hesabınız admin tarafından onaylandıktan sonra derslere katılabileceksiniz.');
      navigate('/');
    } catch (error: unknown) {
      hideLoading();
      await showError(error instanceof Error ? error.message : 'Kayıt sırasında bir hata oluştu.');
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
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

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${loginUserBg})` }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" aria-hidden />
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/95 shadow-large mb-3 ring-4 ring-white/30 overflow-hidden">
            <img src={maktabaLogo} alt="Maktaba" className="w-10 h-10 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-white drop-shadow-lg">Kayıt Ol</h1>
          <p className="text-white/90 text-sm drop-shadow">Maktaba üyesi olun</p>
        </div>

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 border border-white/20 max-h-[calc(100vh-12rem)] overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Ad</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                  placeholder="Adınız"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Soyad</label>
                <input
                  type="text"
                  value={formData.lastname}
                  onChange={(e) => setFormData((p) => ({ ...p, lastname: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                  placeholder="Soyadınız"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Kullanıcı adı</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData((p) => ({ ...p, username: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                placeholder="kullaniciadi"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                placeholder="email@ornek.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Telefon</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData((p) => ({ ...p, phone: formatPhoneInput(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                placeholder="0(5__)___-__-__"
              />
            </div>

            <div ref={regionDropdownRef}>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Bölge</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsRegionOpen(!isRegionOpen)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm text-left bg-white focus:ring-2 focus:ring-emerald-500"
                >
                  {selectedRegion ? selectedRegion.name : 'Bölge seçin'}
                </button>
                {isRegionOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto">
                    <input
                      type="text"
                      value={regionSearch}
                      onChange={(e) => setRegionSearch(e.target.value)}
                      placeholder="Bölge ara..."
                      className="w-full px-3 py-2 border-b text-sm"
                    />
                    {filteredRegions.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setFormData((p) => ({ ...p, regionId: r.id }));
                          setIsRegionOpen(false);
                          setRegionSearch('');
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                      >
                        {r.name}
                      </button>
                    ))}
                    {filteredRegions.length === 0 && (
                      <p className="px-3 py-2 text-sm text-gray-500">Bölge bulunamadı</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Adres</label>
              <textarea
                value={formData.adres}
                onChange={(e) => setFormData((p) => ({ ...p, adres: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 resize-none"
                placeholder="Adresiniz"
                rows={2}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Şifre</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                placeholder="En az 6 karakter"
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Şifre (tekrar)</label>
              <input
                type="password"
                value={formData.passwordConfirm}
                onChange={(e) => setFormData((p) => ({ ...p, passwordConfirm: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                placeholder="Şifrenizi tekrar girin"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Kaydediliyor...' : 'Kayıt Ol'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-600">
            Zaten hesabınız var mı?{' '}
            <Link to="/" className="text-emerald-600 hover:text-emerald-700 font-medium">
              Giriş yap
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
