import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useCollection, firestoreHelpers } from '../../hooks/useFirestore';
import { where, Timestamp, deleteField } from 'firebase/firestore';
import {
  uploadUserProfilePhoto,
  validateUserProfilePhoto,
} from '../../services/userPhotoService';
import { 
  showError, 
  showConfirm,
  showLoading,
  hideLoading
} from '../../services/notificationService';
import { useAuth } from '../../contexts/AuthContext';
import { 
  HiPlus, 
  HiPencil, 
  HiTrash, 
  HiSearch,
  HiUser,
  HiX,
  HiRefresh
} from 'react-icons/hi';
import { formatPhoneInput } from '../../utils/phoneMask';
import { getUserInitials } from '../../utils/userDisplay';

interface User {
  id: string;
  name: string;
  lastname: string;
  username: string;
  email: string;
  password: string;
  role: string;
  isActive: boolean;
  isUserApproved?: boolean;
  createAt?: Timestamp;
  phone?: string;
  adres?: string;
  regionIds?: string[];
  photoURL?: string;
}

interface RegionOption {
  id: string;
  name: string;
  isActive: boolean;
}

function normalizeInput(value: string): { raw: string; lower: string; candidates: string[] } {
  const raw = value.trim();
  const lower = raw.toLowerCase();
  const candidates = Array.from(new Set([raw, lower])).filter(Boolean);
  return { raw, lower, candidates };
}

function UserListAvatar({
  photoURL,
  initials,
}: {
  photoURL?: string;
  initials: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const trimmed = photoURL?.trim();
  const showImg = Boolean(trimmed) && !imgFailed;

  return (
    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-semibold text-sm shadow-medium shrink-0 overflow-hidden">
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

export default function Users() {
  // Real-time veri akışı - Firebase'den otomatik güncelleme
  // Tüm kullanıcıları getir
  const { data: users, loading, error } = useCollection<User>('users');
  const { data: regions } = useCollection<RegionOption>('regions', [
    where('isActive', '==', true)
  ]);
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const isRegionSupervisor = authUser?.role === 'regionSupervisor';
  const isAdmin = authUser?.role === 'admin';
  const myRegionId = isRegionSupervisor ? authUser?.regionIds?.[0] : undefined;

  const scopedRegions =
    isRegionSupervisor && myRegionId ? regions.filter((r) => r.id === myRegionId) : regions;
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({ 
    name: '', 
    lastname: '', 
    username: '',
    email: '', 
    password: '', 
    role: 'user',
    phone: '',
    adres: '',
    regionId: ''
  });
  const [editFormData, setEditFormData] = useState({ 
    name: '', 
    lastname: '', 
    username: '',
    email: '', 
    password: '', 
    role: 'user',
    phone: '',
    adres: '',
    regionId: '',
    isUserApproved: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  type AvailabilityState = 'idle' | 'checking' | 'available' | 'taken';
  const [addUsernameAvailability, setAddUsernameAvailability] = useState<AvailabilityState>('idle');
  const [addEmailAvailability, setAddEmailAvailability] = useState<AvailabilityState>('idle');

  const [inactiveActionMenuUserId, setInactiveActionMenuUserId] = useState<string | null>(null);
  const inactiveMenuRef = useRef<HTMLDivElement>(null);
  const [inactiveMenuPosition, setInactiveMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [editRegionIds, setEditRegionIds] = useState<string[]>([]);
  const [isRegionDropdownOpen, setIsRegionDropdownOpen] = useState(false);
  const [regionSearch, setRegionSearch] = useState('');
  const regionDropdownRef = useRef<HTMLDivElement | null>(null);

  const [addRegionIds, setAddRegionIds] = useState<string[]>([]);
  const [isAddRegionDropdownOpen, setIsAddRegionDropdownOpen] = useState(false);
  const [addRegionSearch, setAddRegionSearch] = useState('');
  const addRegionDropdownRef = useRef<HTMLDivElement | null>(null);
  const addPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const editPhotoInputRef = useRef<HTMLInputElement | null>(null);

  const [addAvatarFile, setAddAvatarFile] = useState<File | null>(null);
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [removeExistingPhoto, setRemoveExistingPhoto] = useState(false);

  const addAvatarPreviewUrl = useMemo(
    () => (addAvatarFile ? URL.createObjectURL(addAvatarFile) : null),
    [addAvatarFile],
  );
  const editAvatarPreviewUrl = useMemo(
    () => (editAvatarFile ? URL.createObjectURL(editAvatarFile) : null),
    [editAvatarFile],
  );

  useEffect(() => {
    return () => {
      if (addAvatarPreviewUrl) URL.revokeObjectURL(addAvatarPreviewUrl);
    };
  }, [addAvatarPreviewUrl]);

  useEffect(() => {
    return () => {
      if (editAvatarPreviewUrl) URL.revokeObjectURL(editAvatarPreviewUrl);
    };
  }, [editAvatarPreviewUrl]);

  const filteredRegions = scopedRegions.filter((region) =>
    region.name.toLowerCase().includes(regionSearch.toLowerCase())
  );

  const filteredAddRegions = scopedRegions.filter((region) =>
    region.name.toLowerCase().includes(addRegionSearch.toLowerCase())
  );

  // Hata durumunda bildirim göster
  useEffect(() => {
    if (error) {
      showError(error.message, 'Veri Yükleme Hatası');
    }
  }, [error]);

  // Admin olmayan kullanıcı, add modalda admin/regionSupervisor rolü seçemesin.
  useEffect(() => {
    if (isAdmin) return;
    if (formData.role === 'admin' || formData.role === 'regionSupervisor') {
      setFormData((prev) => ({ ...prev, role: 'user' }));
      setAddRegionIds((prev) => prev.slice(0, 1));
    }
  }, [isAdmin, formData.role]);

  // Admin olmayan kullanıcı, edit modalda admin/regionSupervisor rolü seçemesin.
  useEffect(() => {
    if (isAdmin) return;
    if (editFormData.role === 'admin' || editFormData.role === 'regionSupervisor') {
      setEditFormData((prev) => ({ ...prev, role: 'user', isUserApproved: prev.isUserApproved ?? false }));
      setEditRegionIds((prev) => prev.slice(0, 1));
    }
  }, [isAdmin, editFormData.role]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        regionDropdownRef.current &&
        !regionDropdownRef.current.contains(event.target as Node)
      ) {
        setIsRegionDropdownOpen(false);
      }
    }

    if (isRegionDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isRegionDropdownOpen]);

  useEffect(() => {
    function handleClickOutsideAdd(event: MouseEvent) {
      if (
        addRegionDropdownRef.current &&
        !addRegionDropdownRef.current.contains(event.target as Node)
      ) {
        setIsAddRegionDropdownOpen(false);
      }
    }

    if (isAddRegionDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutsideAdd);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutsideAdd);
    };
  }, [isAddRegionDropdownOpen]);

  // Yeni kullanıcı ekle
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    showLoading('Kullanıcı ekleniyor...');
    
    try {
      const normalizedUsername = normalizeInput(formData.username);
      const normalizedEmail = normalizeInput(formData.email);

      if (!normalizedUsername.raw || !normalizedEmail.raw) {
        throw new Error('Kullanıcı adı ve email zorunludur.');
      }

      if (addUsernameAvailability === 'taken') {
        throw new Error('Bu kullanıcı adı zaten kullanılıyor.');
      }
      if (addEmailAvailability === 'taken') {
        throw new Error('Bu email adresi zaten kayıtlı.');
      }

      const [existingUsername, existingEmail] = await Promise.all([
        firestoreHelpers.getAll<User>('users', [
          where(
            'username',
            normalizedUsername.candidates.length > 1 ? 'in' : '==',
            normalizedUsername.candidates.length > 1
              ? normalizedUsername.candidates
              : normalizedUsername.lower,
          ),
          firestoreHelpers.query.limit(1),
        ]),
        firestoreHelpers.getAll<User>('users', [
          where(
            'email',
            normalizedEmail.candidates.length > 1 ? 'in' : '==',
            normalizedEmail.candidates.length > 1 ? normalizedEmail.candidates : normalizedEmail.lower,
          ),
          firestoreHelpers.query.limit(1),
        ]),
      ]);

      if (existingUsername.length > 0) {
        throw new Error('Bu kullanıcı adı zaten kullanılıyor.');
      }
      if (existingEmail.length > 0) {
        throw new Error('Bu email adresi zaten kayıtlı.');
      }

      // Firebase'e yeni kullanıcı ekle
      // Firebase yapısına göre: name, lastname, username, email, password, role, phone, adres, regionId, isActive, createAt
      const rawRegionIds =
        isRegionSupervisor && myRegionId
          ? addRegionIds.filter((rid) => rid === myRegionId)
          : addRegionIds;
      const regionIds =
        formData.role === 'teacher'
          ? rawRegionIds
          : rawRegionIds.length > 0
          ? [rawRegionIds[0]]
          : [];

      const newId = await firestoreHelpers.add<User>('users', {
        name: formData.name.trim(),
        lastname: formData.lastname.trim(),
        username: normalizedUsername.lower,
        email: normalizedEmail.lower,
        password: formData.password,
        role: formData.role,
        phone: formData.phone.trim() || '',
        adres: formData.adres.trim() || '',
        regionIds,
        isActive: true,
        // Admin / bölge sorumlusu eklediyse normal kullanıcı da onay beklemesin.
        isUserApproved:
          authUser?.role === 'admin' ||
          authUser?.role === 'regionSupervisor' ||
          formData.role === 'admin' ||
          formData.role === 'teacher' ||
          formData.role === 'regionSupervisor',
        createAt: Timestamp.now()
      });

      if (addAvatarFile) {
        try {
          const url = await uploadUserProfilePhoto(newId, addAvatarFile);
          await firestoreHelpers.update<User>('users', newId, { photoURL: url });
        } catch (photoErr) {
          console.error(photoErr);
          await showError(
            photoErr instanceof Error
              ? photoErr.message
              : 'Kullanıcı oluşturuldu ancak profil fotoğrafı yüklenemedi.',
          );
        }
      }
      
      // Formu temizle ve modal'ı kapat
      setShowModal(false);
      setFormData({ name: '', lastname: '', username: '', email: '', password: '', role: 'user', phone: '', adres: '', regionId: '' });
      setAddRegionIds([]);
      setAddAvatarFile(null);
      setAddUsernameAvailability('idle');
      setAddEmailAvailability('idle');
      if (addPhotoInputRef.current) addPhotoInputRef.current.value = '';
      
      hideLoading();
      // Başarı mesajı
      // await showSuccess('Kullanıcı başarıyla eklendi!');
    } catch (error) {
      console.error('Kullanıcı eklenirken hata:', error);
      hideLoading();
      await showError(
        error instanceof Error ? error.message : 'Kullanıcı eklenirken bir hata oluştu!',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!showModal) return;

    const username = formData.username;
    const email = formData.email;

    const t = window.setTimeout(() => {
      const u = normalizeInput(username);
      if (u.raw.length >= 3) {
        setAddUsernameAvailability('checking');
        firestoreHelpers
          .getAll<User>('users', [
            where(
              'username',
              u.candidates.length > 1 ? 'in' : '==',
              u.candidates.length > 1 ? u.candidates : u.lower,
            ),
            firestoreHelpers.query.limit(1),
          ])
          .then((res) => setAddUsernameAvailability(res.length > 0 ? 'taken' : 'available'))
          .catch(() => setAddUsernameAvailability('idle'));
      } else {
        setAddUsernameAvailability('idle');
      }

      const e = normalizeInput(email);
      if (e.raw.includes('@') && e.raw.length >= 6) {
        setAddEmailAvailability('checking');
        firestoreHelpers
          .getAll<User>('users', [
            where(
              'email',
              e.candidates.length > 1 ? 'in' : '==',
              e.candidates.length > 1 ? e.candidates : e.lower,
            ),
            firestoreHelpers.query.limit(1),
          ])
          .then((res) => setAddEmailAvailability(res.length > 0 ? 'taken' : 'available'))
          .catch(() => setAddEmailAvailability('idle'));
      } else {
        setAddEmailAvailability('idle');
      }
    }, 450);

    return () => window.clearTimeout(t);
  }, [showModal, formData.username, formData.email]);

  // Kullanıcı sil (soft delete - Firebase'den silinmez, sadece isActive false yapılır)
  const handleDeleteUser = async (id: string) => {
    const confirmed = await showConfirm(
      'Bu kullanıcıyı silmek istediğinizden emin misiniz?',
      'Kullanıcı Silme',
      {
        confirmButtonText: 'Evet, Sil',
        cancelButtonText: 'İptal',
        icon: 'warning'
      }
    );

    if (!confirmed) {
      return;
    }

    showLoading('Kullanıcı siliniyor...');

    try {
      // Firebase'den silme, sadece isActive durumunu false yap (soft delete)
      await firestoreHelpers.update('users', id, {
        isActive: false
      });
      hideLoading();
      // await showSuccess('Kullanıcı başarıyla silindi!');
    } catch (error) {
      console.error('Kullanıcı silinirken hata:', error);
      hideLoading();
      await showError('Kullanıcı silinirken bir hata oluştu!');
    }
  };

  // Kullanıcıyı yeniden aktifleştir
  const handleActivateUser = async (id: string) => {
    const confirmed = await showConfirm(
      'Bu kullanıcıyı tekrar aktifleştirmek istediğinizden emin misiniz?',
      'Kullanıcıyı Aktifleştir',
      {
        confirmButtonText: 'Evet, Aktifleştir',
        cancelButtonText: 'İptal',
        icon: 'warning'
      }
    );

    if (!confirmed) {
      return;
    }

    showLoading('Kullanıcı aktifleştiriliyor...');

    try {
      await firestoreHelpers.update('users', id, {
        isActive: true
      });
      hideLoading();
      // await showSuccess('Kullanıcı tekrar aktifleştirildi!');
    } catch (error) {
      console.error('Kullanıcı aktifleştirilirken hata:', error);
      hideLoading();
      await showError('Kullanıcı aktifleştirilirken bir hata oluştu!');
    }
  };

  const handleHardDeleteUser = async (id: string) => {
    const confirmed = await showConfirm(
      'Bu kullanıcı kalıcı olarak silinecek. Bu işlem geri alınamaz. Devam edilsin mi?',
      'Kullanıcıyı Kalıcı Sil',
      {
        confirmButtonText: 'Evet, Kalıcı Sil',
        cancelButtonText: 'İptal',
        icon: 'warning',
        confirmButtonColor: '#dc2626',
      },
    );
    if (!confirmed) return;

    showLoading('Kullanıcı siliniyor...');
    try {
      await firestoreHelpers.delete('users', id);
      hideLoading();
    } catch (error) {
      console.error('Kullanıcı kalıcı silinirken hata:', error);
      hideLoading();
      await showError(
        error instanceof Error ? error.message : 'Kullanıcı silinirken bir hata oluştu!',
      );
    }
  };

  useEffect(() => {
    if (!inactiveActionMenuUserId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInactiveActionMenuUserId(null);
    };
    const onMouseDown = (e: MouseEvent) => {
      const el = inactiveMenuRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) setInactiveActionMenuUserId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [inactiveActionMenuUserId]);

  useEffect(() => {
    if (!inactiveActionMenuUserId) {
      setInactiveMenuPosition(null);
    }
  }, [inactiveActionMenuUserId]);

  // Kullanıcı düzenleme modal'ını aç
  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditAvatarFile(null);
    setRemoveExistingPhoto(false);
    if (editPhotoInputRef.current) editPhotoInputRef.current.value = '';
    setEditFormData({
      name: user.name || '',
      lastname: user.lastname || '',
      username: user.username || '',
      email: user.email || '',
      password: '',
      role: user.role || 'user',
      phone: formatPhoneInput(user.phone || ''),
      adres: user.adres || '',
      regionId: user.regionIds && user.regionIds.length > 0 ? user.regionIds[0] : '',
      isUserApproved:
        user.isUserApproved ??
        (user.role === 'admin' ||
          user.role === 'teacher' ||
          user.role === 'regionSupervisor')
    });
    setEditRegionIds(
      isRegionSupervisor && myRegionId
        ? (user.regionIds ?? []).filter((rid) => rid === myRegionId)
        : user.regionIds ?? [],
    );
    setShowEditModal(true);
  };

  // Kullanıcı güncelle
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsSubmitting(true);
    showLoading('Kullanıcı güncelleniyor...');
    
    try {
      const normalizedUsername = normalizeInput(editFormData.username);
      const normalizedEmail = normalizeInput(editFormData.email);

      if (!normalizedUsername.raw || !normalizedEmail.raw) {
        throw new Error('Kullanıcı adı ve email zorunludur.');
      }

      // Username/email başka bir kullanıcıda var mı kontrol et (edit ekranı)
      const [existingUsername, existingEmail] = await Promise.all([
        firestoreHelpers.getAll<User>('users', [
          where(
            'username',
            normalizedUsername.candidates.length > 1 ? 'in' : '==',
            normalizedUsername.candidates.length > 1
              ? normalizedUsername.candidates
              : normalizedUsername.lower,
          ),
          firestoreHelpers.query.limit(5),
        ]),
        firestoreHelpers.getAll<User>('users', [
          where(
            'email',
            normalizedEmail.candidates.length > 1 ? 'in' : '==',
            normalizedEmail.candidates.length > 1 ? normalizedEmail.candidates : normalizedEmail.lower,
          ),
          firestoreHelpers.query.limit(5),
        ]),
      ]);

      if (existingUsername.some((u) => u.id !== editingUser.id)) {
        throw new Error('Bu kullanıcı adı zaten kullanılıyor.');
      }
      if (existingEmail.some((u) => u.id !== editingUser.id)) {
        throw new Error('Bu email adresi zaten kayıtlı.');
      }

      const updates: Partial<User> = {
        name: editFormData.name.trim(),
        lastname: editFormData.lastname.trim(),
        username: normalizedUsername.lower,
        email: normalizedEmail.lower,
        role: editFormData.role,
        phone: editFormData.phone.trim() || '',
        adres: editFormData.adres.trim() || '',
      };

      // Bölge atamaları: öğretmenler için çoklu, diğer roller için tek seçim
      const effectiveEditRegionIds =
        isRegionSupervisor && myRegionId
          ? (editRegionIds ?? []).filter((rid) => rid === myRegionId)
          : editRegionIds;

      if (effectiveEditRegionIds && effectiveEditRegionIds.length > 0) {
        updates.regionIds =
          editFormData.role === 'teacher'
            ? effectiveEditRegionIds
            : [effectiveEditRegionIds[0]];
      } else {
        updates.regionIds = [];
      }

      updates.isUserApproved =
        editFormData.role !== 'user'
          ? true
          : authUser?.role === 'admin' ||
              authUser?.role === 'regionSupervisor' ||
              editFormData.isUserApproved;

      // Şifre değiştirilmişse ekle
      if (editFormData.password && editFormData.password.length > 0) {
        updates.password = editFormData.password;
      }

      await firestoreHelpers.update('users', editingUser.id, updates);

      if (editAvatarFile) {
        try {
          const url = await uploadUserProfilePhoto(editingUser.id, editAvatarFile);
          await firestoreHelpers.update('users', editingUser.id, { photoURL: url });
        } catch (photoErr) {
          hideLoading();
          setIsSubmitting(false);
          console.error(photoErr);
          await showError(
            photoErr instanceof Error
              ? photoErr.message
              : 'Profil fotoğrafı yüklenemedi. Diğer bilgiler kaydedildi.',
          );
          return;
        }
      } else if (removeExistingPhoto) {
        await firestoreHelpers.update('users', editingUser.id, {
          photoURL: deleteField(),
        } as unknown as Partial<User>);
      }
      
      setShowEditModal(false);
      setEditingUser(null);
      setEditFormData({ name: '', lastname: '', username: '', email: '', password: '', role: 'user', phone: '', adres: '', regionId: '', isUserApproved: false });
      setEditAvatarFile(null);
      setRemoveExistingPhoto(false);
      if (editPhotoInputRef.current) editPhotoInputRef.current.value = '';
      hideLoading();
      // await showSuccess('Kullanıcı başarıyla güncellendi!');
    } catch (error) {
      console.error('Kullanıcı güncellenirken hata:', error);
      hideLoading();
      await showError(
        error instanceof Error ? error.message : 'Kullanıcı güncellenirken bir hata oluştu!',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sadece admin olmayan ve (teacher ise her zaman, user ise sadece onaylı) kullanıcılar listede görünsün
  const nonAdminUsers = users.filter(
    (user) =>
      user.role !== 'admin' &&
      (user.role !== 'user' || user.isUserApproved === true)
  );

  const visibleUsers = isRegionSupervisor && myRegionId
    ? nonAdminUsers.filter((u) => (u.regionIds ?? []).includes(myRegionId))
    : nonAdminUsers;

  // Arama filtresi (admin olmayanlar üzerinde)
  const filteredUsers = visibleUsers.filter(user =>
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.lastname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'teacher':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'regionSupervisor':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'user':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Kullanıcılar</h1>
          <p className="text-gray-500 mt-1">
            {loading
              ? 'Yükleniyor...'
              : searchTerm
              ? `${filteredUsers.length} / ${visibleUsers.length} kullanıcı`
              : `${visibleUsers.length} kullanıcı`}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2 text-gray-700"
          >
            <HiRefresh className="w-5 h-5" />
            <span className="hidden sm:inline">Yenile</span>
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all shadow-medium flex items-center gap-2"
          >
            <HiPlus className="w-5 h-5" />
            <span>Yeni Kullanıcı</span>
          </button>
        </div>
      </div>

      {/* Hata Mesajı - Artık notificationService kullanılıyor, bu bölüm opsiyonel */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-800">Hata: {error.message}</p>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-soft p-4">
        <div className="relative">
          <HiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Kullanıcı ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-soft overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-4"></div>
            <p className="text-gray-600">Yükleniyor...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center">
            <HiUser className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 font-medium mb-1">
              {searchTerm ? 'Kullanıcı bulunamadı' : 'Henüz kullanıcı yok'}
            </p>
            <p className="text-sm text-gray-500">
              {searchTerm ? 'Arama terimini değiştirmeyi deneyin' : 'Yeni kullanıcı ekleyerek başlayın'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Ad Soyad
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Bölge
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Rol
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Durum
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Onay
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <UserListAvatar
                          key={`${user.id}-${user.photoURL ?? ''}`}
                          photoURL={user.photoURL}
                          initials={getUserInitials(user.name, user.lastname)}
                        />
                        <div>
                          <div className="text-sm font-semibold text-gray-900">
                            {user.name} {user.lastname}
                          </div>
                          <div className="text-xs text-gray-500">
                            @{user.username}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap max-w-xs">
                      <div className="text-xs text-gray-600">
                        {(isRegionSupervisor && myRegionId
                          ? user.regionIds?.filter((rid) => rid === myRegionId)
                          : user.regionIds) && (isRegionSupervisor && myRegionId
                          ? (user.regionIds ?? []).filter((rid) => rid === myRegionId).length > 0
                          : (user.regionIds ?? []).length > 0)
                          ? (isRegionSupervisor && myRegionId
                              ? (user.regionIds ?? []).filter((rid) => rid === myRegionId)
                              : user.regionIds ?? []
                            )
                              .map(
                                (id) =>
                                  regions.find((r) => r.id === id)?.name || `Bölge (${id})`
                              )
                              .join(', ')
                          : 'Bölge atanmadı'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 inline-flex text-xs font-semibold rounded-full border ${getRoleColor(user.role)}`}>
                        {user.role === 'admin'
                          ? 'Admin'
                          : user.role === 'teacher'
                          ? 'Hoca'
                          : user.role === 'regionSupervisor'
                          ? 'Bölge Sorunlusu'
                          : 'Kullanıcı'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 inline-flex text-xs font-semibold rounded-full border ${
                          user.isActive
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}
                      >
                        {user.isActive ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.role === 'admin' || user.role === 'teacher' || user.role === 'regionSupervisor' ? (
                        <span className="text-xs text-gray-500">—</span>
                      ) : (
                        <span className="px-3 py-1 inline-flex text-xs font-semibold rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                          Onaylı
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => user.isActive && navigate(`/users/${user.id}`)}
                          disabled={!user.isActive}
                          title={!user.isActive ? 'Pasif kullanıcılar için devre dışı' : 'Detay'}
                          className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                        >
                          Detay
                        </button>
                        <button
                          onClick={() => user.isActive && handleEditUser(user)}
                          disabled={!user.isActive}
                          title={!user.isActive ? 'Pasif kullanıcılar için devre dışı' : 'Düzenle'}
                          className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                        >
                          <HiPencil className="w-5 h-5" />
                        </button>
                        {user.isActive ? (
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <HiTrash className="w-5 h-5" />
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                setInactiveActionMenuUserId((prev) => (prev === user.id ? null : user.id));
                                setInactiveMenuPosition({
                                  top: rect.bottom + 8,
                                  left: rect.right,
                                });
                              }}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="İşlemler"
                            >
                              <HiRefresh className="w-5 h-5" />
                            </button>

                            {inactiveActionMenuUserId === user.id &&
                              inactiveMenuPosition &&
                              createPortal(
                                <div
                                  ref={inactiveMenuRef}
                                  className="fixed z-[9999] w-52 -translate-x-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden"
                                  style={{
                                    top: inactiveMenuPosition.top,
                                    left: inactiveMenuPosition.left,
                                  }}
                                  role="menu"
                                >
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      setInactiveActionMenuUserId(null);
                                      setInactiveMenuPosition(null);
                                      await handleActivateUser(user.id);
                                    }}
                                    className="w-full px-3 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-50"
                                    role="menuitem"
                                  >
                                    Kullanıcıyı aktif et
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      setInactiveActionMenuUserId(null);
                                      setInactiveMenuPosition(null);
                                      await handleHardDeleteUser(user.id);
                                    }}
                                    className="w-full px-3 py-2.5 text-left text-sm text-red-700 hover:bg-red-50"
                                    role="menuitem"
                                  >
                                    Sistemden tamamen sil
                                  </button>
                                </div>,
                                document.body,
                              )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && editingUser && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in"
          style={{ marginTop: '0px' }}
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-large animate-scale-in">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Kullanıcı Düzenle</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingUser(null);
                  setEditFormData({ name: '', lastname: '', username: '', email: '', password: '', role: 'user', phone: '', adres: '', regionId: '', isUserApproved: false });
                  setEditAvatarFile(null);
                  setRemoveExistingPhoto(false);
                  if (editPhotoInputRef.current) editPhotoInputRef.current.value = '';
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={isSubmitting}
              >
                <HiX className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateUser} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">İsim *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    placeholder="Ad"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Soyisim *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.lastname}
                    onChange={(e) => setEditFormData({ ...editFormData, lastname: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    placeholder="Soyad"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-gray-200 bg-gray-50">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 border-2 border-white shadow-md shrink-0 mx-auto sm:mx-0">
                  {editAvatarPreviewUrl ||
                  (!removeExistingPhoto && editingUser.photoURL) ? (
                    <img
                      src={editAvatarPreviewUrl ?? editingUser.photoURL}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <HiUser className="w-12 h-12" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Profil fotoğrafı
                  </label>
                  <input
                    ref={editPhotoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={isSubmitting}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const err = validateUserProfilePhoto(f);
                      if (err) {
                        void showError(err);
                        e.target.value = '';
                        return;
                      }
                      setEditAvatarFile(f);
                      setRemoveExistingPhoto(false);
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => editPhotoInputRef.current?.click()}
                      className="px-3 py-2 text-sm font-medium rounded-lg border border-primary-200 text-primary-700 bg-white hover:bg-primary-50 transition-colors"
                    >
                      {editAvatarPreviewUrl || editingUser.photoURL
                        ? 'Fotoğrafı değiştir'
                        : 'Fotoğraf seç'}
                    </button>
                    {editAvatarFile && (
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => {
                          setEditAvatarFile(null);
                          if (editPhotoInputRef.current) editPhotoInputRef.current.value = '';
                        }}
                        className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        Seçimi iptal
                      </button>
                    )}
                    {!editAvatarFile && editingUser.photoURL && !removeExistingPhoto && (
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => setRemoveExistingPhoto(true)}
                        className="px-3 py-2 text-sm font-medium rounded-lg border border-red-200 text-red-600 bg-white hover:bg-red-50 transition-colors"
                      >
                        Mevcut resmi kaldır
                      </button>
                    )}
                    {removeExistingPhoto && !editAvatarFile && (
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => setRemoveExistingPhoto(false)}
                        className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        Kaldırmayı vazgeç
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    JPEG, PNG veya WebP; en fazla 2 MB. Firebase Storage kullanılır.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Kullanıcı Adı *</label>
                <input
                  type="text"
                  required
                  value={editFormData.username}
                  onChange={(e) => setEditFormData({ ...editFormData, username: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="kullanıcı adı"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  required
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="email@example.com"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Rol *</label>
                <select
                  value={editFormData.role}
                  onChange={(e) => {
                    const role = e.target.value;
                    setEditFormData({
                      ...editFormData,
                      role,
                      isUserApproved:
                        role === 'admin' ||
                        role === 'teacher' ||
                        role === 'regionSupervisor'
                          ? true
                          : editFormData.isUserApproved,
                    });
                    // teacher için çoklu, diğer roller için tek bölge
                    setEditRegionIds((prev) =>
                      role === 'teacher' ? prev : prev.slice(0, 1),
                    );
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  disabled={isSubmitting}
                >
                  <option value="user">Kullanıcı</option>
                  <option value="teacher">Hoca</option>
                  {isAdmin && <option value="admin">Admin</option>}
                  {isAdmin && <option value="regionSupervisor">Bölge Sorunlusu</option>}
                </select>
              </div>
              {editFormData.role === 'user' && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="editIsUserApproved"
                    checked={editFormData.isUserApproved}
                    onChange={(e) => setEditFormData({ ...editFormData, isUserApproved: e.target.checked })}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    disabled={isSubmitting}
                  />
                  <label htmlFor="editIsUserApproved" className="text-sm font-medium text-gray-700">
                    Kullanıcı onaylı (derslere katılabilir)
                  </label>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Telefon</label>
                  <input
                    type="tel"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: formatPhoneInput(e.target.value) })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    placeholder="0(5__)___-__-__"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Bölge
                  </label>
                  <div className="relative" ref={regionDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsRegionDropdownOpen((prev) => !prev)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-left flex items-center gap-2 hover:bg-gray-50 transition-colors"
                      disabled={isSubmitting}
                    >
                      <div className="flex-1 flex flex-wrap items-center gap-1 min-h-[1.75rem]">
                        {editRegionIds.length === 0 ? (
                          <span className="text-sm text-gray-400">
                            Henüz bölge seçilmedi
                          </span>
                        ) : (
                          editRegionIds
                            .map((id) => regions.find((r) => r.id === id))
                            .filter(Boolean)
                            .map((region) => (
                              <span
                                key={region!.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-xs border border-primary-200"
                              >
                                <span className="max-w-[120px] truncate">
                                  {region!.name}
                                </span>
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditRegionIds((prev) =>
                                      prev.filter((rid) => rid !== region!.id)
                                    );
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setEditRegionIds((prev) =>
                                        prev.filter((rid) => rid !== region!.id)
                                      );
                                    }
                                  }}
                                  className="text-primary-500 hover:text-primary-700 cursor-pointer rounded px-0.5 focus:outline-none focus:ring-2 focus:ring-primary-400"
                                  aria-label="Bölgeyi kaldır"
                                >
                                  ×
                                </span>
                              </span>
                            ))
                        )}
                      </div>
                      <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
                        {editRegionIds.length > 0 && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditRegionIds([]);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditRegionIds([]);
                              }
                            }}
                            className="text-gray-400 hover:text-gray-600 text-xs cursor-pointer rounded px-0.5 focus:outline-none focus:ring-2 focus:ring-gray-300"
                            aria-label="Tüm bölgeleri temizle"
                          >
                            ✕
                          </span>
                        )}
                        <span className="text-gray-400 text-xs">▼</span>
                      </div>
                    </button>

                    {isRegionDropdownOpen && (
                      <div className="absolute z-20 mt-1 w-full border border-gray-200 rounded-xl bg-white shadow-lg">
                        <div className="px-3 pt-2 pb-2 border-b border-gray-100">
                          <input
                            type="text"
                            placeholder="Bölge ara..."
                            value={regionSearch}
                            onChange={(e) => setRegionSearch(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                            disabled={isSubmitting}
                          />
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {filteredRegions.length === 0 ? (
                            <p className="px-4 py-3 text-xs text-gray-500">
                              Uygun bölge bulunamadı.
                            </p>
                          ) : (
                            <ul className="py-1">
                              {filteredRegions.map((region) => {
                                const checked = editRegionIds.includes(region.id);
                                return (
                                  <li
                                    key={region.id}
                                    className="px-3 py-1.5 flex items-center gap-2 hover:bg-gray-50 cursor-pointer"
                                    onClick={() => {
                                      setEditRegionIds((prev) => {
                                        const exists = prev.includes(region.id);
                                        if (exists) {
                                          return prev.filter((id) => id !== region.id);
                                        }
                                        if (editFormData.role === 'teacher') {
                                          return [...prev, region.id];
                                        }
                                        // admin / user için yalnızca tek bölge
                                        return [region.id];
                                      });
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => {
                                        setEditRegionIds((prev) => {
                                          const exists = prev.includes(region.id);
                                          if (exists) {
                                            return prev.filter((id) => id !== region.id);
                                          }
                                          if (editFormData.role === 'teacher') {
                                            return [...prev, region.id];
                                          }
                                          return [region.id];
                                        });
                                      }}
                                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <span className="text-xs text-gray-800">
                                      {region.name}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Adres</label>
                <textarea
                  value={editFormData.adres}
                  onChange={(e) => setEditFormData({ ...editFormData, adres: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
                  placeholder="Adres bilgisi"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Şifre (Değiştirmek için doldurun)</label>
                <input
                  type="password"
                  value={editFormData.password}
                  onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="Yeni şifre (boş bırakabilirsiniz)"
                  disabled={isSubmitting}
                  minLength={6}
                />
                <p className="text-xs text-gray-500 mt-1">Minimum 6 karakter (değiştirmek istemiyorsanız boş bırakın)</p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingUser(null);
                    setEditFormData({ name: '', lastname: '', username: '', email: '', password: '', role: 'user', phone: '', adres: '', regionId: '', isUserApproved: false });
                    setEditRegionIds([]);
                    setEditAvatarFile(null);
                    setRemoveExistingPhoto(false);
                    if (editPhotoInputRef.current) editPhotoInputRef.current.value = '';
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium text-gray-700"
                  disabled={isSubmitting}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all font-medium shadow-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Güncelleniyor...' : 'Güncelle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in"
          style={{ marginTop: '0px' }}
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-large animate-scale-in">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Yeni Kullanıcı</h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setAddAvatarFile(null);
                  setAddUsernameAvailability('idle');
                  setAddEmailAvailability('idle');
                  if (addPhotoInputRef.current) addPhotoInputRef.current.value = '';
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={isSubmitting}
              >
                <HiX className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddUser} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">İsim *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    placeholder="Ad"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Soyisim *</label>
                  <input
                    type="text"
                    required
                    value={formData.lastname}
                    onChange={(e) => setFormData({ ...formData, lastname: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    placeholder="Soyad"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-gray-200 bg-gray-50">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 border-2 border-white shadow-md shrink-0 mx-auto sm:mx-0">
                  {addAvatarPreviewUrl ? (
                    <img
                      src={addAvatarPreviewUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <HiUser className="w-12 h-12" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Profil fotoğrafı
                  </label>
                  <input
                    ref={addPhotoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={isSubmitting}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const err = validateUserProfilePhoto(f);
                      if (err) {
                        void showError(err);
                        e.target.value = '';
                        return;
                      }
                      setAddAvatarFile(f);
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => addPhotoInputRef.current?.click()}
                      className="px-3 py-2 text-sm font-medium rounded-lg border border-primary-200 text-primary-700 bg-white hover:bg-primary-50 transition-colors"
                    >
                      {addAvatarFile ? 'Fotoğrafı değiştir' : 'Fotoğraf seç'}
                    </button>
                    {addAvatarFile && (
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => {
                          setAddAvatarFile(null);
                          if (addPhotoInputRef.current) addPhotoInputRef.current.value = '';
                        }}
                        className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        Temizle
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    JPEG, PNG veya WebP; en fazla 2 MB. İsteğe bağlı; kayıttan sonra da eklenebilir.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Kullanıcı Adı *</label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="kullanıcı adı"
                  disabled={isSubmitting}
                />
                {addUsernameAvailability === 'checking' && (
                  <p className="mt-1 text-xs text-gray-500">Kontrol ediliyor…</p>
                )}
                {addUsernameAvailability === 'taken' && (
                  <p className="mt-1 text-xs text-red-600">Bu kullanıcı adı zaten kullanılıyor.</p>
                )}
                {addUsernameAvailability === 'available' && (
                  <p className="mt-1 text-xs text-emerald-700">Kullanılabilir.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="email@example.com"
                  disabled={isSubmitting}
                />
                {addEmailAvailability === 'checking' && (
                  <p className="mt-1 text-xs text-gray-500">Kontrol ediliyor…</p>
                )}
                {addEmailAvailability === 'taken' && (
                  <p className="mt-1 text-xs text-red-600">Bu email adresi zaten kayıtlı.</p>
                )}
                {addEmailAvailability === 'available' && (
                  <p className="mt-1 text-xs text-emerald-700">Kullanılabilir.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Rol *</label>
                <select
                  value={formData.role}
                  onChange={(e) => {
                    const role = e.target.value;
                    setFormData({ ...formData, role });
                    setAddRegionIds((prev) => (role === 'teacher' ? prev : prev.slice(0, 1)));
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  disabled={isSubmitting}
                >
                  <option value="user">Kullanıcı</option>
                  <option value="teacher">Hoca</option>
                  {isAdmin && <option value="admin">Admin</option>}
                  {isAdmin && <option value="regionSupervisor">Bölge Sorunlusu</option>}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Telefon</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: formatPhoneInput(e.target.value) })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    placeholder="0(5__)___-__-__"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Bölge
                  </label>
                  <div className="relative" ref={addRegionDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsAddRegionDropdownOpen((prev) => !prev)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-left flex items-center gap-2 hover:bg-gray-50 transition-colors"
                      disabled={isSubmitting}
                    >
                      <div className="flex-1 flex flex-wrap items-center gap-1 min-h-[1.75rem]">
                        {addRegionIds.length === 0 ? (
                          <span className="text-sm text-gray-400">
                            Henüz bölge seçilmedi
                          </span>
                        ) : (
                          addRegionIds
                            .map((id) => regions.find((r) => r.id === id))
                            .filter(Boolean)
                            .map((region) => (
                              <span
                                key={region!.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-xs border border-primary-200"
                              >
                                <span className="max-w-[120px] truncate">
                                  {region!.name}
                                </span>
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAddRegionIds((prev) =>
                                      prev.filter((rid) => rid !== region!.id)
                                    );
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setAddRegionIds((prev) =>
                                        prev.filter((rid) => rid !== region!.id)
                                      );
                                    }
                                  }}
                                  className="text-primary-500 hover:text-primary-700 cursor-pointer rounded px-0.5 focus:outline-none focus:ring-2 focus:ring-primary-400"
                                  aria-label="Bölgeyi kaldır"
                                >
                                  ×
                                </span>
                              </span>
                            ))
                        )}
                      </div>
                      <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
                        {addRegionIds.length > 0 && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              setAddRegionIds([]);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                setAddRegionIds([]);
                              }
                            }}
                            className="text-gray-400 hover:text-gray-600 text-xs cursor-pointer rounded px-0.5 focus:outline-none focus:ring-2 focus:ring-gray-300"
                            aria-label="Tüm bölgeleri temizle"
                          >
                            ✕
                          </span>
                        )}
                        <span className="text-gray-400 text-xs">▼</span>
                      </div>
                    </button>

                    {isAddRegionDropdownOpen && (
                      <div className="absolute z-20 mt-1 w-full border border-gray-200 rounded-xl bg-white shadow-lg">
                        <div className="px-3 pt-2 pb-2 border-b border-gray-100">
                          <input
                            type="text"
                            placeholder="Bölge ara..."
                            value={addRegionSearch}
                            onChange={(e) => setAddRegionSearch(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                            disabled={isSubmitting}
                          />
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {filteredAddRegions.length === 0 ? (
                            <p className="px-4 py-3 text-xs text-gray-500">
                              Uygun bölge bulunamadı.
                            </p>
                          ) : (
                            <ul className="py-1">
                              {filteredAddRegions.map((region) => {
                                const checked = addRegionIds.includes(region.id);
                                return (
                                  <li
                                    key={region.id}
                                    className="px-3 py-1.5 flex items-center gap-2 hover:bg-gray-50 cursor-pointer"
                                    onClick={() => {
                                      setAddRegionIds((prev) => {
                                        const exists = prev.includes(region.id);
                                        if (exists) {
                                          return prev.filter((id) => id !== region.id);
                                        }
                                        if (formData.role === 'teacher') {
                                          return [...prev, region.id];
                                        }
                                        // admin / user için yalnızca tek bölge
                                        return [region.id];
                                      });
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => {
                                        setAddRegionIds((prev) => {
                                          const exists = prev.includes(region.id);
                                          if (exists) {
                                            return prev.filter((id) => id !== region.id);
                                          }
                                          if (formData.role === 'teacher') {
                                            return [...prev, region.id];
                                          }
                                          return [region.id];
                                        });
                                      }}
                                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <span className="text-xs text-gray-800">
                                      {region.name}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Adres</label>
                <textarea
                  value={formData.adres}
                  onChange={(e) => setFormData({ ...formData, adres: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
                  placeholder="Adres bilgisi"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Şifre *</label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="Şifre girin"
                  disabled={isSubmitting}
                  minLength={6}
                />
                <p className="text-xs text-gray-500 mt-1">Minimum 6 karakter</p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setAddAvatarFile(null);
                    if (addPhotoInputRef.current) addPhotoInputRef.current.value = '';
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium text-gray-700"
                  disabled={isSubmitting}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all font-medium shadow-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
