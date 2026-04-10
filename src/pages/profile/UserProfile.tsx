import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc, deleteField } from 'firebase/firestore';
import { updatePassword } from 'firebase/auth';
import { db, auth } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { firestoreHelpers } from '../../hooks/useFirestore';
import {
  uploadUserProfilePhoto,
  validateUserProfilePhoto,
} from '../../services/userPhotoService';
import { formatPhoneInput } from '../../utils/phoneMask';
import { getUserInitials } from '../../utils/userDisplay';
import {
  showError,
  showLoading,
  hideLoading,
} from '../../services/notificationService';
import { HiArrowLeft, HiPhotograph, HiX } from 'react-icons/hi';

export default function UserProfile() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState('');
  const [lastname, setLastname] = useState('');
  const [phone, setPhone] = useState('');
  const [adres, setAdres] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** Sunucudaki URL geçersiz veya ağ hatası — baş harflere dön */
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name || '');
    setLastname(user.lastname || '');
    setPhone(formatPhoneInput(user.phone || ''));
    setAdres(user.adres || '');
    setRemovePhoto(false);
    setAvatarFile(null);
    setAvatarPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setPhotoLoadFailed(false);
  }, [user]);

  useEffect(() => {
    setPhotoLoadFailed(false);
  }, [avatarPreview, removePhoto, user?.photoURL]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(null);
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  if (!user) {
    return null;
  }

  const roleLabel =
    user.role === 'admin'
      ? 'Yönetici'
      : user.role === 'regionSupervisor'
        ? 'Bölge sorumlusu'
        : user.role === 'teacher'
          ? 'Hoca'
          : 'Kullanıcı';

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateUserProfilePhoto(file);
    if (err) {
      void showError(err);
      e.target.value = '';
      return;
    }
    setAvatarFile(file);
    setRemovePhoto(false);
  };

  const verifyFirestorePassword = async (plain: string): Promise<boolean> => {
    const snap = await getDoc(doc(db, 'users', user.id));
    if (!snap.exists()) return false;
    const pw = (snap.data() as { password?: string }).password;
    return pw === plain;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedName = name.trim();
    const trimmedLast = lastname.trim();
    if (!trimmedName || !trimmedLast) {
      void showError('Ad ve soyad zorunludur.');
      return;
    }

    if (newPassword.length > 0) {
      if (newPassword.length < 6) {
        void showError('Yeni şifre en az 6 karakter olmalıdır.');
        return;
      }
      if (!currentPassword) {
        void showError('Şifre değiştirmek için mevcut şifrenizi girin.');
        return;
      }
    }

    setIsSubmitting(true);
    showLoading('Profil kaydediliyor...');

    try {
      if (newPassword.length > 0) {
        const ok = await verifyFirestorePassword(currentPassword);
        if (!ok) {
          hideLoading();
          setIsSubmitting(false);
          void showError('Mevcut şifre hatalı.');
          return;
        }
      }

      const updates: Record<string, unknown> = {
        name: trimmedName,
        lastname: trimmedLast,
        phone: phone.trim(),
        adres: adres.trim(),
      };

      if (newPassword.length > 0) {
        updates.password = newPassword;
      }

      if (removePhoto && user.photoURL) {
        updates.photoURL = deleteField();
      }

      await firestoreHelpers.update('users', user.id, updates);

      if (avatarFile) {
        try {
          const url = await uploadUserProfilePhoto(user.id, avatarFile);
          await firestoreHelpers.update('users', user.id, { photoURL: url });
        } catch (photoErr) {
          console.error(photoErr);
          hideLoading();
          setIsSubmitting(false);
          void showError(
            photoErr instanceof Error
              ? photoErr.message
              : 'Fotoğraf yüklenemedi; diğer bilgiler kaydedildi.',
          );
          await refreshUser();
          return;
        }
      }

      if (newPassword.length > 0 && auth.currentUser) {
        try {
          await updatePassword(auth.currentUser, newPassword);
        } catch (authErr) {
          console.warn('Firebase Auth şifre güncellenemedi (Firestore güncellendi):', authErr);
        }
      }

      await refreshUser();
      setAvatarFile(null);
      setAvatarPreview(null);
      setRemovePhoto(false);
      setCurrentPassword('');
      setNewPassword('');
      if (fileInputRef.current) fileInputRef.current.value = '';

      hideLoading();
      setIsSubmitting(false);
    } catch (err) {
      console.error(err);
      hideLoading();
      setIsSubmitting(false);
      void showError('Profil kaydedilirken bir hata oluştu.');
    }
  };

  const displayPhotoSrc =
    removePhoto ? null : avatarPreview ?? (user.photoURL?.trim() || null);
  const showPhoto =
    Boolean(displayPhotoSrc) && !photoLoadFailed;

  const initialsText = getUserInitials(name.trim() || user.name, lastname.trim() || user.lastname);

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-800 mb-6"
      >
        <HiArrowLeft className="w-4 h-4" />
        Ana sayfaya dön
      </Link>

      <div className="bg-white rounded-2xl border border-emerald-100 shadow-lg shadow-emerald-900/5 overflow-hidden">
        <div className="px-6 py-5 border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50">
          <h1 className="text-2xl font-bold text-gray-900">Profilim</h1>
          <p className="text-sm text-gray-600 mt-1">
            Profil fotoğrafınız ve kişisel bilgilerinizi güncelleyin.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Profil fotoğrafı
            </label>
            <div className="flex flex-wrap items-center gap-4">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-2xl font-bold overflow-hidden ring-2 ring-emerald-100 shadow-md shrink-0">
                {showPhoto ? (
                  <img
                    src={displayPhotoSrc!}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={() => setPhotoLoadFailed(true)}
                  />
                ) : (
                  <span>{initialsText}</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
                >
                  <HiPhotograph className="w-5 h-5" />
                  Fotoğraf seç
                </button>
                {user.photoURL && !removePhoto && !avatarFile && (
                  <button
                    type="button"
                    onClick={() => {
                      setRemovePhoto(true);
                      setAvatarFile(null);
                      setAvatarPreview(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="inline-flex items-center gap-2 text-sm text-red-600 hover:text-red-700"
                  >
                    <HiX className="w-4 h-4" />
                    Fotoğrafı kaldır
                  </button>
                )}
                {(avatarFile || removePhoto) && (
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarFile(null);
                      setAvatarPreview(null);
                      setRemovePhoto(false);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-sm text-gray-600 hover:text-gray-800"
                  >
                    İptal
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">En fazla 2 MB, JPEG / PNG / WebP.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ad</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Soyad</label>
              <input
                value={lastname}
                onChange={(e) => setLastname(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
            <input
              value={phone}
              onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adres</label>
            <textarea
              value={adres}
              onChange={(e) => setAdres(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-y"
            />
          </div>

          <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-800">Hesap bilgileri</p>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">E-posta</span>
                <p className="font-medium text-gray-900 mt-0.5">{user.email}</p>
              </div>
              <div>
                <span className="text-gray-500">Kullanıcı adı</span>
                <p className="font-medium text-gray-900 mt-0.5">@{user.username}</p>
              </div>
              <div>
                <span className="text-gray-500">Rol</span>
                <p className="font-medium text-gray-900 mt-0.5">{roleLabel}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              E-posta ve kullanıcı adı değişikliği için yöneticiye başvurun.
            </p>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-semibold text-gray-800">Şifre değiştir (isteğe bağlı)</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mevcut şifre
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                placeholder="Yalnızca şifre değiştirirken gerekli"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Yeni şifre</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                placeholder="Boş bırakırsanız şifre değişmez"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold shadow-md hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
