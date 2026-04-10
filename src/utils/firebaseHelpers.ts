/**
 * Firebase yardımcı fonksiyonları
 * Bu dosya, Firebase işlemlerini kolaylaştırmak için yardımcı fonksiyonlar içerir
 */

import { Timestamp } from 'firebase/firestore';

/** Firestore Timestamp veya benzeri düz obje */
type TimestampLike = {
  toDate?: () => Date;
  seconds?: number;
};

export type DateInput = Date | string | number | TimestampLike | null | undefined;

/**
 * Firestore Timestamp'i JavaScript Date'e çevir
 */
export function timestampToDate(input: DateInput): Date {
  if (input == null) {
    return new Date(NaN);
  }
  if (input instanceof Date) {
    return input;
  }
  if (typeof input === 'string' || typeof input === 'number') {
    return new Date(input);
  }
  if (typeof input.toDate === 'function') {
    return input.toDate();
  }
  if (typeof input.seconds === 'number') {
    return new Date(input.seconds * 1000);
  }
  return new Date(NaN);
}

/**
 * Tarih formatla
 */
export function formatDate(date: DateInput): string {
  let dateObj: Date;
  
  if (date instanceof Date) {
    dateObj = date;
  } else if (typeof date === 'string') {
    dateObj = new Date(date);
  } else if (typeof date === 'number') {
    dateObj = new Date(date);
  } else {
    dateObj = timestampToDate(date);
  }

  return new Intl.DateTimeFormat('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(dateObj);
}

/**
 * Göreceli zaman formatla (örn: "2 saat önce")
 */
export function formatRelativeTime(date: DateInput): string {
  let dateObj: Date;

  if (date instanceof Date) {
    dateObj = date;
  } else if (typeof date === 'string') {
    dateObj = new Date(date);
  } else if (typeof date === 'number') {
    dateObj = new Date(date);
  } else {
    dateObj = timestampToDate(date);
  }
  
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return 'Az önce';
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} dakika önce`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} saat önce`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} gün önce`;
  }
  
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks} hafta önce`;
  }
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} ay önce`;
  }
  
  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears} yıl önce`;
}

/**
 * Firestore için şu anki zamanı Timestamp olarak al
 */
export function getCurrentTimestamp(): Timestamp {
  return Timestamp.now();
}

