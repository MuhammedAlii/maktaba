import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut, 
  onAuthStateChanged
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export interface UserData {
  id: string;
  name: string;
  lastname: string;
  username: string;
  email: string;
  role: 'admin' | 'user' | 'teacher' | 'regionSupervisor';
  isActive: boolean;
  isUserApproved?: boolean;
  phone?: string;
  adres?: string;
  regionIds?: string[];
  userLectureIds?: string[];
  /** Firebase Storage veya harici profil görseli URL */
  photoURL?: string;
}

interface FirestoreUserData extends Omit<UserData, 'id'> {
  password: string;
}

/**
 * Authentication Servisi
 * Firebase Authentication ve Firestore kullanarak kullanıcı yönetimi
 */

/**
 * Email veya kullanıcı adı ve şifre ile giriş yap
 * Önce Firestore'da kontrol eder, sonra Firebase Authentication'da giriş yapar
 */
export const login = async (usernameOrEmail: string, password: string): Promise<UserData> => {
  try {
    const searchTerm = usernameOrEmail.toLowerCase().trim();
    const usersRef = collection(db, 'users');
    
    // Önce email ile ara
    let q = query(usersRef, where('email', '==', searchTerm));
    let querySnapshot = await getDocs(q);
    
    // Email ile bulunamazsa, username ile ara
    if (querySnapshot.empty) {
      q = query(usersRef, where('username', '==', searchTerm));
      querySnapshot = await getDocs(q);
    }

    if (querySnapshot.empty) {
      throw new Error('Kullanıcı adı/email veya şifre hatalı');
    }

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data() as FirestoreUserData;

    // Şifre kontrolü
    if (userData.password !== password) {
      throw new Error('Kullanıcı adı/email veya şifre hatalı');
    }

    // Kullanıcı aktif mi kontrol et
    if (!userData.isActive) {
      throw new Error('Bu kullanıcı hesabı pasif durumda');
    }

    // Email kontrolü - Firebase Auth için email gerekli
    if (!userData.email) {
      throw new Error('Kullanıcı email adresi bulunamadı. Lütfen email adresi ekleyin.');
    }

    // Firebase Authentication'da kullanıcı var mı kontrol et
    let firebaseUser: FirebaseUser | null = null;
    
    try {
      // Önce giriş yapmayı dene
      const userCredential = await signInWithEmailAndPassword(auth, userData.email, password);
      firebaseUser = userCredential.user;
    } catch (authError: unknown) {
      // Firebase Auth hatası - CONFIGURATION_NOT_FOUND veya diğer hatalar
      const error = authError as { code?: string; message?: string };
      
      // Eğer kullanıcı yoksa oluşturmayı dene
      if (error.code === 'auth/user-not-found') {
        try {
          const newUserCredential = await createUserWithEmailAndPassword(auth, userData.email, password);
          firebaseUser = newUserCredential.user;
        } catch (createError: unknown) {
          const createErr = createError as { code?: string; message?: string };
          // CONFIGURATION_NOT_FOUND hatası - Firebase Auth etkinleştirilmemiş
          if (createErr.code === 'auth/configuration-not-found' || createErr.code === 'auth/operation-not-allowed') {
            console.warn('Firebase Authentication etkinleştirilmemiş. Sadece Firestore ile devam ediliyor.');
            // Firebase Auth olmadan devam et - Firestore document ID kullan
            firebaseUser = null;
          } else {
            throw createError;
          }
        }
      } else if (error.code === 'auth/configuration-not-found' || error.code === 'auth/operation-not-allowed') {
        // Firebase Auth etkinleştirilmemiş - sadece Firestore ile devam et
        console.warn('Firebase Authentication etkinleştirilmemiş. Sadece Firestore ile devam ediliyor.');
        firebaseUser = null;
      } else {
        // Diğer hatalar için Firebase Auth'u atla
        console.warn('Firebase Authentication hatası:', error.message);
        firebaseUser = null;
      }
    }

    // Password'u çıkar ve UserData döndür
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...userDataWithoutPassword } = userData;

    // Firebase Auth kullanıcı ID'si varsa onu kullan, yoksa Firestore document ID kullan
    const userId = firebaseUser?.uid || userDoc.id;

    const userDataResult: UserData = {
      id: userId,
      ...userDataWithoutPassword
    };

    // localStorage'a kaydet (Firebase Auth olmasa bile)
    localStorage.setItem('maktaba_user', JSON.stringify(userDataResult));

    return userDataResult;
  } catch (error: unknown) {
    console.error('Login error:', error);
    
    // Hata mesajlarını Türkçe'ye çevir
    if (error instanceof Error && error.message.includes('Kullanıcı adı/email veya şifre hatalı')) {
      throw error;
    }
    
    const authError = error as { code?: string; message?: string };
    
    if (authError.code === 'auth/invalid-email') {
      throw new Error('Geçersiz email adresi');
    } else if (authError.code === 'auth/too-many-requests') {
      throw new Error('Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin');
    } else if (authError.code === 'auth/user-disabled') {
      throw new Error('Bu kullanıcı hesabı devre dışı bırakılmış');
    } else if (authError.code === 'auth/weak-password') {
      throw new Error('Şifre çok zayıf');
    }
    
    throw error;
  }
};

/**
 * Kullanıcı kaydı (self-registration)
 * Rol otomatik 'user', isUserApproved false olarak kaydedilir
 */
export interface RegisterData {
  name: string;
  lastname: string;
  username: string;
  email: string;
  phone: string;
  regionId: string;
  adres: string;
  password: string;
}

export const register = async (data: RegisterData): Promise<void> => {
  const username = data.username.trim().toLowerCase();
  const email = data.email.trim().toLowerCase();
  const usersRef = collection(db, 'users');

  const [usernameQuery, emailQuery] = await Promise.all([
    getDocs(query(usersRef, where('username', '==', username))),
    getDocs(query(usersRef, where('email', '==', email))),
  ]);

  if (!usernameQuery.empty) {
    throw new Error('Bu kullanıcı adı zaten kullanılıyor.');
  }
  if (!emailQuery.empty) {
    throw new Error('Bu email adresi zaten kayıtlı.');
  }

  const regionIds = data.regionId ? [data.regionId] : [];

  await addDoc(usersRef, {
    name: data.name.trim(),
    lastname: data.lastname.trim(),
    username,
    email,
    password: data.password,
    phone: data.phone.trim() || '',
    adres: data.adres.trim() || '',
    regionIds,
    role: 'user',
    isActive: true,
    isUserApproved: false,
    createAt: Timestamp.now(),
  });
};

/**
 * Çıkış yap
 */
export const logout = async (): Promise<void> => {
  try {
    // Firebase Auth'dan çıkış yap (eğer etkinse)
    try {
      await signOut(auth);
    } catch (error) {
      // Firebase Auth hatası - devam et
      console.warn('Firebase Auth logout error:', error);
    }
    // localStorage'dan temizle
    localStorage.removeItem('maktaba_user');
    // Bildirim anahtarları - çıkışta temizle, yeniden girişte tekrar gösterilsin
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith('maktaba_today_lesson_') || key === 'maktaba_admin_pending_approvals_shown') {
        sessionStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Logout error:', error);
    // Yine de localStorage'dan temizle
    localStorage.removeItem('maktaba_user');
    throw error;
  }
};

/**
 * Kullanıcı durumunu dinle (session yönetimi)
 * Firebase Auth yoksa localStorage'dan kontrol eder
 */
export const onAuthStateChange = (callback: (user: UserData | null) => void) => {
  // localStorage'dan kontrol et ve hemen callback çağır
  const storedUser = localStorage.getItem('maktaba_user');
  if (storedUser) {
    try {
      const userData = JSON.parse(storedUser) as UserData;
      // Hemen callback çağır (hızlı yükleme için)
      callback(userData);
      
      // Firestore'dan güncel bilgileri al (arka planda güncelleme için)
      getDoc(doc(db, 'users', userData.id)).then((userDoc) => {
        if (userDoc.exists()) {
          const currentUserData = userDoc.data() as Omit<UserData, 'id'> & { password?: string };
          if (currentUserData.isActive) {
            // Password'u çıkar
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { password, ...userDataWithoutPassword } = currentUserData;
            const updatedUser: UserData = {
              id: userData.id,
              ...userDataWithoutPassword
            };
            localStorage.setItem('maktaba_user', JSON.stringify(updatedUser));
            callback(updatedUser);
          } else {
            localStorage.removeItem('maktaba_user');
            callback(null);
          }
        } else {
          localStorage.removeItem('maktaba_user');
          callback(null);
        }
      }).catch(() => {
        // Hata durumunda stored user'ı kullan (zaten callback çağrıldı)
      });
    } catch {
      localStorage.removeItem('maktaba_user');
      callback(null);
    }
  } else {
    // localStorage'da yoksa null döndür
    callback(null);
  }

  // Firebase Auth state değişikliklerini dinle (eğer etkinse)
  return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
    if (firebaseUser) {
      try {
        // Firestore'dan kullanıcı bilgilerini al
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        
        if (userDoc.exists()) {
          const userData = userDoc.data() as Omit<UserData, 'id'>;
          
          // Kullanıcı aktif mi kontrol et
          if (userData.isActive) {
            const user: UserData = {
              id: firebaseUser.uid,
              ...userData
            };
            // localStorage'a kaydet
            localStorage.setItem('maktaba_user', JSON.stringify(user));
            callback(user);
          } else {
            // Kullanıcı pasifse çıkış yap
            await signOut(auth);
            localStorage.removeItem('maktaba_user');
            callback(null);
          }
        } else {
          localStorage.removeItem('maktaba_user');
          callback(null);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        localStorage.removeItem('maktaba_user');
        callback(null);
      }
    } else {
      localStorage.removeItem('maktaba_user');
      callback(null);
    }
  });
};

/**
 * Mevcut kullanıcı bilgilerini al
 * Önce localStorage'dan, sonra Firestore'dan doğrular
 */
export const getCurrentUser = async (): Promise<UserData | null> => {
  // Önce localStorage'dan kontrol et
  const storedUser = localStorage.getItem('maktaba_user');
  if (!storedUser) {
    return null;
  }

  let parsedUser: UserData;
  try {
    parsedUser = JSON.parse(storedUser) as UserData;
  } catch (error) {
    console.error('Error parsing stored user:', error);
    localStorage.removeItem('maktaba_user');
    return null;
  }

  // Firestore'dan güncel bilgileri kontrol et (timeout ile - hata durumunda stored user kullan)
  try {
    const userDoc = await Promise.race([
      getDoc(doc(db, 'users', parsedUser.id)),
      new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 3000)
      )
    ]) as { exists: () => boolean; data: () => Omit<UserData, 'id'> & { password?: string } } | null;

    if (userDoc && typeof userDoc.exists === 'function' && userDoc.exists()) {
      const currentUserData = userDoc.data() as Omit<UserData, 'id'> & { password?: string };
      
      // Kullanıcı aktif mi kontrol et
      if (!currentUserData.isActive) {
        localStorage.removeItem('maktaba_user');
        return null;
      }

      // Güncel bilgileri döndür (password hariç)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...userDataWithoutPassword } = currentUserData;
      const updatedUser: UserData = {
        id: parsedUser.id,
        ...userDataWithoutPassword
      };

      // localStorage'ı güncelle
      localStorage.setItem('maktaba_user', JSON.stringify(updatedUser));
      return updatedUser;
    } else if (userDoc && typeof userDoc.exists === 'function' && !userDoc.exists()) {
      // Firestore'da yoksa temizle
      localStorage.removeItem('maktaba_user');
      return null;
    } else {
      // Beklenmeyen durum - stored user'ı kullan
      return parsedUser;
    }
  } catch (firestoreError) {
    // Firestore hatası veya timeout - stored user'ı kullan (offline mod veya hızlı yükleme)
    console.warn('Firestore check failed, using stored user:', firestoreError);
    // Stored user'ı döndür - hata durumunda bile kullanıcı giriş yapmış olabilir
    return parsedUser;
  }
};

