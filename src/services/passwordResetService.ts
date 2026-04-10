import { collection, query, where, getDocs, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { firestoreHelpers } from '../hooks/useFirestore';

const CODE_EXPIRY_MINUTES = 3;
const CODE_LENGTH = 6;

function generateCode(): string {
  return Math.floor(Math.pow(10, CODE_LENGTH - 1) + Math.random() * 9 * Math.pow(10, CODE_LENGTH - 1)).toString();
}

export async function requestPasswordReset(email: string): Promise<{ code?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('Lütfen email adresinizi girin.');
  }

  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('email', '==', normalizedEmail));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    throw new Error('Bu email adresiyle kayıtlı kullanıcı bulunamadı.');
  }

  const code = generateCode();
  const expiresAt = Timestamp.fromMillis(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

  const resetRef = collection(db, 'passwordResetCodes');
  await addDoc(resetRef, {
    email: normalizedEmail,
    code,
    expiresAt,
    createdAt: Timestamp.now(),
  });

  try {
    const { sendPasswordResetEmail } = await import('./emailService');
    await sendPasswordResetEmail(normalizedEmail, code);
    return {};
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'EMAILJS_NOT_CONFIGURED') {
      console.warn('Email servisi yapılandırılmadı, kod ekranda gösterilecek');
      return { code };
    }
    throw err;
  }
}

export async function verifyCode(email: string, code: string): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedCode = code.trim();
  if (!normalizedEmail || !trimmedCode) return false;

  const resetRef = collection(db, 'passwordResetCodes');
  const q = query(resetRef, where('email', '==', normalizedEmail));
  const snapshot = await getDocs(q);
  const now = Timestamp.now();

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const expiresAt = data.expiresAt as Timestamp | undefined;
    if (expiresAt?.toMillis && expiresAt.toMillis() < now.toMillis()) continue;
    if (data.code === trimmedCode) return true;
  }
  return false;
}

export async function verifyCodeAndResetPassword(
  email: string,
  code: string,
  newPassword: string
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedCode = code.trim();

  if (!normalizedEmail || !trimmedCode || !newPassword) {
    throw new Error('Lütfen tüm alanları doldurun.');
  }

  if (newPassword.length < 6) {
    throw new Error('Şifre en az 6 karakter olmalıdır.');
  }

  const resetRef = collection(db, 'passwordResetCodes');
  const q = query(resetRef, where('email', '==', normalizedEmail));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    throw new Error('Geçersiz veya süresi dolmuş kod.');
  }

  const now = Timestamp.now();
  let foundDoc: { id: string; code: string; expiresAt: Timestamp } | null = null;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    if (data.expiresAt?.toMillis && data.expiresAt.toMillis() < now.toMillis()) {
      await deleteDoc(doc(db, 'passwordResetCodes', docSnap.id));
      continue;
    }
    if (data.code === trimmedCode) {
      foundDoc = { id: docSnap.id, code: data.code, expiresAt: data.expiresAt };
      break;
    }
  }

  if (!foundDoc) {
    throw new Error('Geçersiz veya süresi dolmuş kod.');
  }

  const usersRef = collection(db, 'users');
  const userQ = query(usersRef, where('email', '==', normalizedEmail));
  const userSnapshot = await getDocs(userQ);

  if (userSnapshot.empty) {
    throw new Error('Kullanıcı bulunamadı.');
  }

  const userDoc = userSnapshot.docs[0];
  await firestoreHelpers.update('users', userDoc.id, { password: newPassword });
  await deleteDoc(doc(db, 'passwordResetCodes', foundDoc.id));
}
