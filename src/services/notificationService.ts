import Swal from 'sweetalert2';

/**
 * Bildirim Servisi
 * Tüm uygulama genelinde kullanılacak bildirim yönetimi
 */

interface ConfirmOptions {
  title?: string;
  text?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  icon?: 'warning' | 'error' | 'info' | 'question';
  confirmButtonColor?: string;
}

/**
 * Başarı bildirimi
 */
export const showSuccess = (message: string, title: string = 'Başarılı!') => {
  return Swal.fire({
    icon: 'success',
    title,
    text: message,
    confirmButtonText: 'Tamam',
    confirmButtonColor: '#2563eb',
    timer: 3000,
    timerProgressBar: true,
    toast: false,
    showConfirmButton: true,
  });
};

/**
 * Hata bildirimi
 */
export const showError = (message: string, title: string = 'Hata!') => {
  return Swal.fire({
    icon: 'error',
    title,
    text: message,
    confirmButtonText: 'Tamam',
    confirmButtonColor: '#dc2626',
    toast: false,
    showConfirmButton: true,
  });
};

/**
 * Bilgi bildirimi
 */
export const showInfo = (message: string, title: string = 'Bilgi') => {
  return Swal.fire({
    icon: 'info',
    title,
    text: message,
    confirmButtonText: 'Tamam',
    confirmButtonColor: '#2563eb',
    timer: 3000,
    timerProgressBar: true,
    toast: false,
    showConfirmButton: true,
  });
};

/**
 * Uyarı bildirimi
 */
export const showWarning = (message: string, title: string = 'Uyarı!') => {
  return Swal.fire({
    icon: 'warning',
    title,
    text: message,
    confirmButtonText: 'Tamam',
    confirmButtonColor: '#f59e0b',
    toast: false,
    showConfirmButton: true,
  });
};

/**
 * Onay dialogu (Silme işlemleri için)
 */
export const showConfirm = (
  message: string,
  title: string = 'Emin misiniz?',
  options?: ConfirmOptions
): Promise<boolean> => {
  return Swal.fire({
    title: options?.title || title,
    text: options?.text || message,
    icon: options?.icon || 'warning',
    showCancelButton: true,
    confirmButtonColor: options?.confirmButtonColor ?? '#dc2626',
    cancelButtonColor: '#6b7280',
    confirmButtonText: options?.confirmButtonText || 'Evet, Sil',
    cancelButtonText: options?.cancelButtonText || 'İptal',
    reverseButtons: true,
  }).then((result) => {
    return result.isConfirmed;
  });
};

/**
 * Yükleme göstergesi
 */
export const showLoading = (message: string = 'Yükleniyor...') => {
  Swal.fire({
    title: message,
    allowOutsideClick: false,
    allowEscapeKey: false,
    allowEnterKey: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });
};

/**
 * Yükleme göstergesini kapat
 */
export const hideLoading = () => {
  Swal.close();
};

/**
 * Toast bildirimi (küçük, sağ üst köşe)
 */
export const showToast = (
  message: string,
  type: 'success' | 'error' | 'info' | 'warning' = 'success'
) => {
  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer);
      toast.addEventListener('mouseleave', Swal.resumeTimer);
    },
  });

  return Toast.fire({
    icon: type,
    title: message,
  });
};

