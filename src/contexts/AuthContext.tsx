import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { UserData } from '../services/authService';
import { onAuthStateChange, getCurrentUser } from '../services/authService';

interface AuthContextType {
  user: UserData | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isRegionSupervisor: boolean;
  /** Firestore + localStorage kullanıcı bilgisini yeniden yükler (profil güncellemesi sonrası). */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  // İlk render'da localStorage'dan hızlıca yükle
  const getInitialUser = (): UserData | null => {
    try {
      const storedUser = localStorage.getItem('maktaba_user');
      if (storedUser) {
        const userData = JSON.parse(storedUser) as UserData;
        return userData;
      }
    } catch (error) {
      console.error('Error parsing stored user:', error);
      localStorage.removeItem('maktaba_user');
    }
    return null;
  };

  const initialUser = getInitialUser();
  const [user, setUser] = useState<UserData | null>(initialUser);
  // Her zaman başlangıçta loading true - getCurrentUser tamamlanana kadar
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const next = await getCurrentUser();
    if (next) {
      setUser(next);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Eğer localStorage'da user varsa, hemen set et ama loading'i true tut
    // getCurrentUser tamamlanana kadar route'lar render edilmesin
    const storedUser = localStorage.getItem('maktaba_user');
    if (storedUser && isMounted) {
      try {
        const userData = JSON.parse(storedUser) as UserData;
        setUser(userData);
      } catch {
        // Parse hatası - devam et
      }
    }

    // Firestore'dan güncel bilgileri al ve doğrula
    const checkUser = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!isMounted) return;
        
        if (currentUser) {
          setUser(currentUser);
        } else {
          // getCurrentUser null döndüyse, localStorage'ı kontrol et
          const storedUser = localStorage.getItem('maktaba_user');
          if (!storedUser) {
            setUser(null);
          } else {
            // Stored user varsa ama getCurrentUser null döndüyse,
            // getCurrentUser hata durumunda stored user'ı döndürmeli
            // Ama yine de stored user'ı kullan
            try {
              const userData = JSON.parse(storedUser) as UserData;
              setUser(userData);
            } catch {
              setUser(null);
              localStorage.removeItem('maktaba_user');
            }
          }
        }
      } catch (error) {
        console.error('Error checking user:', error);
        if (!isMounted) return;
        
        // Hata durumunda stored user'ı kontrol et
        const storedUser = localStorage.getItem('maktaba_user');
        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser) as UserData;
            setUser(userData);
          } catch {
            setUser(null);
            localStorage.removeItem('maktaba_user');
          }
        } else {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // İlk yüklemede kontrol et - getCurrentUser tamamlanana kadar loading true
    checkUser();

    // localStorage değişikliklerini dinle (diğer tab'lardan veya login'den)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'maktaba_user' && isMounted) {
        if (e.newValue) {
          try {
            const userData = JSON.parse(e.newValue) as UserData;
            setUser(userData);
          } catch (error) {
            console.error('Error parsing storage change:', error);
            setUser(null);
          }
        } else {
          // localStorage'dan silindi - logout
          setUser(null);
          setLoading(false);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Aynı tab'da localStorage değişikliklerini dinle (logout için)
    // Storage event sadece diğer tab'larda çalışır, bu yüzden polling yapıyoruz
    const storageCheckInterval = setInterval(() => {
      if (!isMounted) return;
      const storedUser = localStorage.getItem('maktaba_user');
      if (!storedUser) {
        // localStorage'da yok - logout olmuş olabilir
        // Sadece user varsa temizle (çift kontrol için)
        setUser((currentUser) => {
          if (currentUser) {
            setLoading(false);
            return null;
          }
          return currentUser;
        });
      }
    }, 100);

    // Auth state değişikliklerini dinle (Firebase Auth için)
    // Not: Loading'i burada false yapma, checkUser zaten yapacak
    const unsubscribe = onAuthStateChange((userData) => {
      if (isMounted) {
        setUser(userData);
        // Loading'i burada false yapma - checkUser zaten yapacak
        // Sadece user değiştiğinde güncelle
      }
    });

    return () => {
      isMounted = false;
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(storageCheckInterval);
      unsubscribe();
    };
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isRegionSupervisor: user?.role === 'regionSupervisor',
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

