import { useState, useRef, useEffect } from 'react';
import { Outlet, Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import TodayLessonNotification from '../user/TodayLessonNotification';
import { HiChevronDown, HiUser, HiLogout } from 'react-icons/hi';
import { logout } from '../../services/authService';
import { showConfirm, showLoading, hideLoading } from '../../services/notificationService';
import maktabaLogo from '../../assets/maktaba-logo.png';
import { getUserInitials } from '../../utils/userDisplay';

function HeaderUserAvatar({
  photoURL,
  initials,
  variant,
}: {
  photoURL?: string;
  initials: string;
  variant: 'toolbar' | 'menuBanner';
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const trimmed = photoURL?.trim();
  const showImg = Boolean(trimmed) && !imgFailed;

  const sizeClass =
    variant === 'menuBanner'
      ? 'w-12 h-12 rounded-xl text-base font-bold'
      : 'w-9 h-9 sm:w-10 sm:h-10 rounded-xl text-sm font-semibold';

  const idleClass =
    variant === 'menuBanner'
      ? 'bg-white/20 backdrop-blur-sm text-white'
      : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-medium';

  const photoRingClass =
    variant === 'menuBanner' ? 'ring-2 ring-white/50 shadow-md' : 'ring-2 ring-emerald-200/90 shadow-medium';

  return (
    <div
      className={`${sizeClass} flex items-center justify-center flex-shrink-0 overflow-hidden ${
        showImg ? photoRingClass : idleClass
      }`}
    >
      {showImg ? (
        <img
          src={trimmed}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        initials
      )}
    </div>
  );
}

export default function UserAppLayout() {
  const { user } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    const confirmed = await showConfirm(
      'Çıkış yapmak istediğinizden emin misiniz?',
      'Çıkış Yap',
      {
        confirmButtonText: 'Evet, Çıkış Yap',
        cancelButtonText: 'İptal',
      }
    );
    if (!confirmed) return;
    showLoading('Çıkış yapılıyor...');
    try {
      await logout();
      hideLoading();
      window.location.href = '/';
    } catch {
      hideLoading();
      window.location.href = '/';
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayName = [user?.name, user?.lastname].filter(Boolean).join(' ') || user?.username || 'Kullanıcı';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-teal-50/20">
      <TodayLessonNotification />
      {/* Header - sticky, minimal */}
      <header
        className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-emerald-100/80 shadow-sm"
        style={{ paddingTop: 'var(--maktaba-safe-top)' }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <Link to="/" className="flex items-center gap-2 flex-shrink-0 min-w-0">
              <img src={maktabaLogo} alt="Maktaba" className="w-8 h-8 sm:w-9 sm:h-9 object-contain" />
              <span className="font-bold text-lg sm:text-xl bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                Maktaba
              </span>
            </Link>

            {/* User Menu - Admin Header ile aynı tasarım */}
            <div className="relative flex-shrink-0" ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-xl hover:bg-emerald-50/80 transition-colors"
              >
                <HeaderUserAvatar
                  key={`hdr-${user?.photoURL ?? ''}`}
                  photoURL={user?.photoURL}
                  initials={user ? getUserInitials(user.name, user.lastname) : '??'}
                  variant="toolbar"
                />
                <div className="hidden sm:block text-left min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                  <p className="text-xs text-gray-500">Kullanıcı</p>
                </div>
                <HiChevronDown
                  className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${
                    showUserMenu ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Dropdown Menu - Admin Header ile aynı */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-large border border-gray-200 z-50 overflow-hidden animate-slide-in">
                  <div className="p-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
                    <div className="flex items-center gap-3">
                      <HeaderUserAvatar
                        key={`menu-${user?.photoURL ?? ''}`}
                        photoURL={user?.photoURL}
                        initials={user ? getUserInitials(user.name, user.lastname) : '??'}
                        variant="menuBanner"
                      />
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{displayName}</p>
                        <p className="text-sm text-white/80 truncate">{user?.email || ''}</p>
                      </div>
                    </div>
                  </div>
                  <div className="py-2">
                    <NavLink
                      to="/profile"
                      onClick={() => setShowUserMenu(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-800 font-medium'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`
                      }
                    >
                      <HiUser className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      <span>Profil</span>
                    </NavLink>
                    {/* <a
                      href="#"
                      onClick={(e) => { e.preventDefault(); setShowUserMenu(false); }}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <HiCog className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      <span>Ayarlar</span>
                    </a> */}
                    <hr className="my-2 border-gray-200" />
                    <button
                      onClick={() => { setShowUserMenu(false); handleLogout(); }}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 w-full transition-colors"
                    >
                      <HiLogout className="w-5 h-5 flex-shrink-0" />
                      <span>Çıkış Yap</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 sm:pb-8">
        <Outlet />
      </main>
    </div>
  );
}
