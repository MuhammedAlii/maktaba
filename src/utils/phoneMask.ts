/**
 * Telefon numarası maskesi: 0(5__)___-__-__
 * Sadece rakamları alır, formatlar.
 */
export function formatPhoneInput(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (digits.length === 0) return '';
  let result = '0';
  if (digits.length > 0) result += '(' + digits.slice(0, 3);
  if (digits.length >= 3) result += ')';
  if (digits.length > 3) result += digits.slice(3, 6);
  if (digits.length > 6) result += '-' + digits.slice(6, 8);
  if (digits.length > 8) result += '-' + digits.slice(8, 10);
  return result;
}

/**
 * Maskelenmiş telefonu sadece rakamlara çevirir (DB için).
 */
export function parsePhoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}
