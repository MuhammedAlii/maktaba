import { useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCollection } from '../../hooks/useFirestore';
import {
  HiHome,
  HiUsers,
  HiBookOpen,
  HiFolder,
  HiCog,
  HiX,
  HiChevronDown,
} from 'react-icons/hi';
import {
  HiOutlineHome,
  HiOutlineUsers,
  HiOutlineBookOpen,
  HiOutlineFolder,
  HiOutlineCog,
  HiOutlineUserPlus,
  HiUserPlus,
  HiOutlineBellAlert,
} from 'react-icons/hi2';
import maktabaLogo from '../../assets/maktaba-logo.png';

interface MenuItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  iconActive: React.ComponentType<{ className?: string }>;
  /** admin: yalnızca admin; adminOrRegionSupervisor: admin veya bölge sorumlusu */
  requiredRole?: 'admin' | 'user' | 'adminOrRegionSupervisor';
}

const menuItems: MenuItem[] = [
  { 
    name: 'Dashboard', 
    path: '/', 
    icon: HiOutlineHome,
    iconActive: HiHome,
    requiredRole: undefined // Herkes görebilir
  },
  { 
    name: 'Kullanıcılar', 
    path: '/users', 
    icon: HiOutlineUsers,
    iconActive: HiUsers,
    requiredRole: 'admin' // Sadece admin
  },
  {
    name: 'Dersler',
    path: '/lessons',
    icon: HiOutlineBookOpen,
    iconActive: HiBookOpen,
    requiredRole: 'admin',
  },
  {
    name: 'Bölgeler',
    path: '/regions',
    icon: HiOutlineFolder,
    iconActive: HiFolder,
    requiredRole: 'admin', // Sadece admin
  },
  {
    name: 'Kitaplar',
    path: '/books',
    icon: HiOutlineBookOpen,
    iconActive: HiBookOpen,
    requiredRole: 'admin', // Herkes görebilir
  },
  // { 
  //   name: 'Ayarlar', 
  //   path: '/settings', 
  //   icon: HiOutlineCog,
  //   iconActive: HiCog,
  //   requiredRole: 'admin' // Sadece admin
  // },
];

/** Menüde en altta gösterilir (footer’dan önce). */
const ONAYLAMALAR_MENU_ITEM: MenuItem = {
  name: 'Onaylamalar',
  path: '/onaylamalar',
  icon: HiOutlineUserPlus,
  iconActive: HiUserPlus,
  requiredRole: 'adminOrRegionSupervisor',
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
}

interface User {
  id: string;
  role: string;
  isUserApproved?: boolean;
  regionIds?: string[];
}

interface LessonJoinRequestRow {
  id: string;
  regionId: string;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { isAdmin, isRegionSupervisor, user } = useAuth();
  const location = useLocation();
  const path = location.pathname;
  const { data: users } = useCollection<User>('users');
  const { data: requests } = useCollection<LessonJoinRequestRow>('lessonJoinRequests');

  const supervisedRegionSet = useMemo(() => new Set(user?.regionIds ?? []), [user?.regionIds]);

  const hasPendingApprovals = useMemo(() => {
    if (!users || !requests) return false;
    const pendingUsers = users.filter(
      (u) =>
        u.role === 'user' &&
        u.isUserApproved !== true &&
        (u.regionIds ?? []).length > 0,
    );
    if (isAdmin) {
      return pendingUsers.length > 0 || requests.length > 0;
    }
    if (isRegionSupervisor) {
      const scopedUsers = pendingUsers.filter((u) =>
        (u.regionIds ?? []).some((rid) => supervisedRegionSet.has(rid)),
      );
      const scopedRequests = requests.filter((r) => supervisedRegionSet.has(r.regionId));
      return scopedUsers.length > 0 || scopedRequests.length > 0;
    }
    return false;
  }, [users, requests, isAdmin, isRegionSupervisor, supervisedRegionSet]);

  const virdChildren = useMemo((): MenuItem[] => {
    const items: MenuItem[] = [];

    if (isAdmin) {
      items.push({
        name: 'Vird Oluştur',
        path: '/vird-katalog',
        icon: HiOutlineCog,
        iconActive: HiCog,
        requiredRole: 'admin',
      });
    }

    items.push(
      {
        name: 'Vird Raporu',
        path: '/vird-raporlari',
        icon: HiOutlineBellAlert,
        iconActive: HiOutlineBellAlert,
      },
      {
        name: 'Vird Girişleri',
        path: '/vird-girisi',
        icon: HiOutlineUserPlus,
        iconActive: HiUserPlus,
      },
    );

    return items;
  }, [isAdmin]);

  const isVirdPathActive = path.startsWith('/vird-');
  const [isVirdOpen, setIsVirdOpen] = useState<boolean>(isVirdPathActive);

  // Role-based menu filtreleme
  const filteredMenuItems = menuItems.filter((item) => {
    // Bölge Sorunlusu: sadece kendi ekranları
    if (isRegionSupervisor) {
      return (
        item.path === '/' ||
        item.path === '/users' ||
        item.path === '/books' ||
        item.path === '/lessons'
      );
    }

    if (!item.requiredRole) return true; // Herkes görebilir
    if (item.requiredRole === 'adminOrRegionSupervisor') return isAdmin || isRegionSupervisor;
    if (item.requiredRole === 'admin') return isAdmin; // Sadece admin
    return true;
  });

  const showOnaylamalar = isAdmin || isRegionSupervisor;

  const showVirdGroupForRole = isAdmin || isRegionSupervisor;
  const visibleVirdChildren = showVirdGroupForRole ? virdChildren : [];
  const supervisorRegionId =
    isRegionSupervisor && user?.regionIds?.[0] ? user.regionIds[0] : undefined;

  return (
    <>
      {/* Mobile overlay - tıklandığında menüyü kapatır */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300 animate-fade-in"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - mobilde soldan kayan, desktop'ta sabit */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-screen w-72 max-w-[85vw] sm:max-w-[320px]
          bg-gradient-to-b from-dark-900 via-dark-800 to-dark-900 text-white
          border-r border-dark-700
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:w-72 lg:max-w-none
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-6 border-b border-dark-700">
            <div className="flex items-center gap-3">

              <div className="w-10 h-10 rounded-xl from-primary-500 to-primary-600 flex items-center justify-center shadow-medium">
                <img src={maktabaLogo} alt="Maktaba" className="w-10 h-10" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Maktaba</h1>
                <p className="text-xs text-dark-400">Admin Panel</p>
              </div>

            </div>
            <button
              onClick={onClose}
              className="lg:hidden text-dark-400 hover:text-white hover:bg-dark-700 p-2 rounded-lg transition-colors"
              aria-label="Menüyü kapat"
            >
              <HiX className="w-5 h-5" />
            </button>
          </div>

          {/* Menu Items */}
          <nav className="flex-1 overflow-y-auto p-4 mt-2">
            <ul className="space-y-1">
              {filteredMenuItems.flatMap((item) => {
                const Icon = item.icon;
                const IconActive = item.iconActive;
                
                const nodes: React.ReactNode[] = [
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                          isActive
                            ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-medium'
                            : 'text-dark-300 hover:bg-dark-700 hover:text-white'
                        }`
                      }
                      onClick={onClose}
                    >
                      {({ isActive }) => {
                        const IconComponent = isActive ? IconActive : Icon;
                        return (
                          <>
                            <IconComponent className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-dark-400 group-hover:text-white'}`} />
                            <span className="font-medium flex-1 min-w-0">{item.name}</span>
                            {isActive && (
                              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-scale-in"></div>
                            )}
                          </>
                        );
                      }}
                    </NavLink>
                  </li>,
                ];

                // Insert Vird group right after Dashboard
                if (item.path === '/' && visibleVirdChildren.length > 0) {
                  nodes.push(
                    <li key="vird-group" className="pt-2">
                      <button
                        type="button"
                        onClick={() => setIsVirdOpen((v) => !v)}
                        className={`w-full group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                          isVirdPathActive
                            ? 'bg-dark-700/60 text-white'
                            : 'text-dark-300 hover:bg-dark-700 hover:text-white'
                        }`}
                        aria-expanded={isVirdOpen}
                      >
                        <HiOutlineBookOpen
                          className={`w-5 h-5 flex-shrink-0 ${
                            isVirdPathActive ? 'text-white' : 'text-dark-400 group-hover:text-white'
                          }`}
                        />
                        <span className="font-medium flex-1 min-w-0 text-left">Vird</span>
                        <HiChevronDown
                          className={`w-5 h-5 flex-shrink-0 transition-transform ${
                            isVirdOpen ? 'rotate-180' : ''
                          } ${isVirdPathActive ? 'text-white' : 'text-dark-400 group-hover:text-white'}`}
                        />
                      </button>

                      {isVirdOpen && (
                        <ul className="mt-1 ml-2 space-y-1">
                          {visibleVirdChildren.map((child) => {
                            const Icon = child.icon;
                            const IconActive = child.iconActive;
                            return (
                              <li key={child.path}>
                                <NavLink
                                  to={child.path}
                                  className={({ isActive }) =>
                                    `group flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                                      isActive
                                        ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-medium'
                                        : 'text-dark-300 hover:bg-dark-700 hover:text-white'
                                    }`
                                  }
                                  onClick={onClose}
                                >
                                  {({ isActive }) => {
                                    const IconComponent = isActive ? IconActive : Icon;
                                    return (
                                      <>
                                        <IconComponent
                                          className={`w-4.5 h-4.5 flex-shrink-0 ${
                                            isActive ? 'text-white' : 'text-dark-400 group-hover:text-white'
                                          }`}
                                        />
                                        <span className="font-medium flex-1 min-w-0 text-sm">{child.name}</span>
                                        {isActive && (
                                          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-scale-in"></div>
                                        )}
                                      </>
                                    );
                                  }}
                                </NavLink>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>,
                  );
                }

                return nodes;
              })}
              {supervisorRegionId && (
                <li key="region-settings" className="pt-1">
                  <NavLink
                    to={`/regions/${supervisorRegionId}`}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                        isActive
                          ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-medium'
                          : 'text-dark-300 hover:bg-dark-700 hover:text-white'
                      }`
                    }
                    onClick={onClose}
                  >
                    {({ isActive }) => {
                      const IconComponent = isActive ? HiFolder : HiOutlineFolder;
                      return (
                        <>
                          <IconComponent
                            className={`w-5 h-5 flex-shrink-0 ${
                              isActive ? 'text-white' : 'text-dark-400 group-hover:text-white'
                            }`}
                          />
                          <span className="font-medium flex-1 min-w-0">Bölge Ayarları</span>
                          {isActive && (
                            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-scale-in" />
                          )}
                        </>
                      );
                    }}
                  </NavLink>
                </li>
              )}
              {showOnaylamalar && (
                <li key={ONAYLAMALAR_MENU_ITEM.path} className="pt-1">
                  <NavLink
                    to={ONAYLAMALAR_MENU_ITEM.path}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                        isActive
                          ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-medium'
                          : 'text-dark-300 hover:bg-dark-700 hover:text-white'
                      }`
                    }
                    onClick={onClose}
                  >
                    {({ isActive }) => {
                      const Icon = ONAYLAMALAR_MENU_ITEM.icon;
                      const IconActive = ONAYLAMALAR_MENU_ITEM.iconActive;
                      const IconComponent = isActive ? IconActive : Icon;
                      return (
                        <>
                          <IconComponent
                            className={`w-5 h-5 flex-shrink-0 ${
                              isActive ? 'text-white' : 'text-dark-400 group-hover:text-white'
                            }`}
                          />
                          <span className="font-medium flex-1 min-w-0">{ONAYLAMALAR_MENU_ITEM.name}</span>
                          {hasPendingApprovals && (
                            <HiOutlineBellAlert
                              className="flex-shrink-0 w-5 h-5 text-amber-400"
                              title="Onay bekleyen kayıt var"
                            />
                          )}
                          {isActive && !hasPendingApprovals && (
                            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-scale-in" />
                          )}
                        </>
                      );
                    }}
                  </NavLink>
                </li>
              )}
            </ul>
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-dark-700">
            <div className="bg-dark-700/50 rounded-xl p-4">
              <p className="text-xs text-dark-400 mb-1">Versiyon</p>
              <p className="text-sm font-medium text-white">v1.0.0</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
