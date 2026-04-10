const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Ağ / geçici hatalarda kaç kez denenecek (ilk deneme dahil toplam 3). */
const UPLOAD_MAX_ATTEMPTS = 3;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

type CloudinaryUploadResponse = {
  secure_url?: string;
  error?: { message?: string };
};

export function validateUserProfilePhoto(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Yalnızca JPEG, PNG veya WebP yükleyebilirsiniz.';
  }
  if (file.size > MAX_BYTES) {
    return 'Dosya boyutu en fazla 2 MB olabilir.';
  }
  return null;
}

function getCloudinaryConfig(): { cloudName: string; uploadPreset: string } {
  const cloudName = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined)?.trim();
  const uploadPreset = (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined)?.trim();
  if (!cloudName || !uploadPreset) {
    throw new Error(
      'Cloudinary yapılandırması eksik: .env dosyasında VITE_CLOUDINARY_CLOUD_NAME ve VITE_CLOUDINARY_UPLOAD_PRESET tanımlayın.',
    );
  }
  return { cloudName, uploadPreset };
}

function describeUploadFailure(err: unknown, attempts: number): Error {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : '';
  const base = raw.trim() || 'Profil fotoğrafı yüklenemedi.';
  return new Error(`${base} (${attempts} denemeden sonra).`);
}

function newProfilePhotoPublicId(userId: string): string {
  const suffix =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  return `maktaba/profile_photos/${userId}/${suffix}`;
}

async function uploadToCloudinaryOnce(userId: string, file: File): Promise<string> {
  const { cloudName, uploadPreset } = getCloudinaryConfig();

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  // Unsigned preset’lerde genelde overwrite kapalı; aynı public_id tekrar kullanılamaz.
  // Her yüklemede benzersiz id → Firestore’daki photoURL yeni görsele güncellenir (eski dosyalar Cloudinary’de kalabilir).
  formData.append('public_id', newProfilePhotoPublicId(userId));

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  const res = await fetch(url, { method: 'POST', body: formData });

  let data: CloudinaryUploadResponse;
  try {
    data = (await res.json()) as CloudinaryUploadResponse;
  } catch {
    throw new Error(`Cloudinary yanıtı okunamadı (HTTP ${res.status}).`);
  }

  if (!res.ok) {
    const detail = data.error?.message?.trim();
    throw new Error(detail || `Cloudinary yükleme hatası (HTTP ${res.status}).`);
  }

  const secureUrl = data.secure_url?.trim();
  if (!secureUrl) {
    throw new Error('Cloudinary güvenli URL döndürmedi.');
  }
  return secureUrl;
}

/**
 * Profil fotoğrafını Cloudinary'ye yükler; Firestore'da saklanacak HTTPS URL döner.
 * Unsigned yüklemede overwrite olmadığı için her seferinde benzersiz public_id kullanılır.
 *
 * Geçici ağ / API hatalarında en fazla 3 kez dener; hepsi başarısızsa hata fırlatır.
 */
export async function uploadUserProfilePhoto(userId: string, file: File): Promise<string> {
  const msg = validateUserProfilePhoto(file);
  if (msg) throw new Error(msg);

  let lastError: unknown;

  for (let attempt = 1; attempt <= UPLOAD_MAX_ATTEMPTS; attempt++) {
    try {
      return await uploadToCloudinaryOnce(userId, file);
    } catch (e) {
      lastError = e;
      if (attempt < UPLOAD_MAX_ATTEMPTS) {
        await delay(400 * attempt);
      }
    }
  }

  throw describeUploadFailure(lastError, UPLOAD_MAX_ATTEMPTS);
}
