import { useLocation, Link } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { logout } from '../../services/authService';
import { showConfirm, showLoading, hideLoading } from '../../services/notificationService';
import {
  HiChevronDown,
  HiUser,
  HiLogout,
  HiBell,
  HiSearch,
  HiMenu,
} from 'react-icons/hi';
import { getUserInitials } from '../../utils/userDisplay';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/users': 'Kullanıcılar',
  '/books': 'Kitaplar',
  '/regions': 'Bölgeler',
  '/lessons': 'Dersler',
  '/onaylamalar': 'Onaylamalar',
  '/settings': 'Ayarlar',
  '/profile': 'Profilim',
};

const pageDescriptions: Record<string, string> = {
  '/': 'Genel bakış ve istatistikler',
  '/users': 'Kullanıcı yönetimi ve bilgileri',
  '/books': 'Kitap kataloğu ve yönetimi',
  '/regions': 'Bölge ve ders yönetimi',
  '/lessons': 'Ders tanımları',
  '/onaylamalar': 'Kullanıcı ve ders katılım onayları',
  '/settings': 'Sistem ve kullanıcı ayarları',
  '/profile': 'Profil fotoğrafı ve kişisel bilgileriniz',
};

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const location = useLocation();
  const { user } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Çıkış yap
  const handleLogout = async () => {
    const confirmed = await showConfirm(
      'Çıkış yapmak istediğinizden emin misiniz?',
      'Çıkış Yap',
      {
        confirmButtonText: 'Evet, Çıkış Yap',
        cancelButtonText: 'İptal'
      }
    );

    if (!confirmed) {
      return;
    }

    showLoading('Çıkış yapılıyor...');
    try {
      await logout();
      hideLoading();
      // window.location.replace kullan ki tüm state'ler sıfırlansın ve AuthContext güncellensin
      window.location.replace('/login');
    } catch (error) {
      hideLoading();
      console.error('Logout error:', error);
      // Hata olsa bile yönlendir
      window.location.replace('/login');
    }
  };

  const path = location.pathname;
  let currentPageTitle = pageTitles[path] || '';
  let currentPageDescription = pageDescriptions[path] || '';

  if (!currentPageTitle && path.startsWith('/regions/') && path !== '/regions') {
    currentPageTitle =
      user?.role === 'regionSupervisor' ? 'Bölge Ayarları' : 'Bölge Detayı';
    currentPageDescription =
      user?.role === 'regionSupervisor'
        ? 'Kendi bölgenizin kullanıcıları, dersleri ve kitapları'
        : 'Bölge ve ders yönetimi';
  }
  if (!currentPageTitle) {
    currentPageTitle = 'Sayfa';
  }

  // Click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-soft">
      <div className="flex items-center justify-between gap-4 px-4 lg:px-6 py-3 sm:py-4">
        {/* Sol: Mobil menü butonu + Sayfa başlığı */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="lg:hidden flex-shrink-0 p-2.5 -ml-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
              aria-label="Menüyü aç"
            >
              <HiMenu className="w-6 h-6" />
            </button>
          )}
          <div className="min-w-0">
            <h2 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
              {currentPageTitle}
            </h2>
            {currentPageDescription && (
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5 hidden sm:block truncate">{currentPageDescription}</p>
            )}
          </div>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl border border-gray-200 hover:border-primary-300 focus-within:border-primary-500 transition-colors">
            <HiSearch className="w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Ara..."
              className="bg-transparent border-0 outline-none text-sm text-gray-700 placeholder-gray-400 w-48"
            />
          </div>

          {/* Notifications */}
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <HiBell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
          </button>

          {/* User Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-medium">
                <span className="text-white font-semibold text-sm">
                  {user ? getUserInitials(user.name, user.lastname) : '??'}
                </span>
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-sm font-semibold text-gray-900">
                  {user ? `${user.name} ${user.lastname}` : 'Kullanıcı'}
                </p>
                <p className="text-xs text-gray-500">
                  {user?.role === 'admin' ? 'Admin' : 'Kullanıcı'}
                </p>
              </div>
              <HiChevronDown
                className={`w-5 h-5 text-gray-400 transition-transform ${
                  showUserMenu ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-large border border-gray-200 z-50 overflow-hidden animate-slide-in">
                <div className="p-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                      <span className="text-white font-bold">
                        {user ? getUserInitials(user.name, user.lastname) : '??'}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold">
                        {user ? `${user.name} ${user.lastname}` : 'Kullanıcı'}
                      </p>
                      <p className="text-sm text-white/80">{user?.email || ''}</p>
                    </div>
                  </div>
                </div>
                <div className="py-2">
                  <Link
                    to="/profile"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <HiUser className="w-5 h-5 text-gray-400" />
                    <span>Profil</span>
                  </Link>
                  {/* <a
                    href="#settings"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <HiCog className="w-5 h-5 text-gray-400" />
                    <span>Ayarlar</span>
                  </a> */}
                  <hr className="my-2 border-gray-200" />
                  <button 
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 w-full transition-colors"
                  >
                    <HiLogout className="w-5 h-5" />
                    <span>Çıkış Yap</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
