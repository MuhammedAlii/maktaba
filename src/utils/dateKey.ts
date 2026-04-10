/**
 * Yerel takvim günü için YYYY-MM-DD (vird / rapor dateKey alanları ile uyumlu).
 */
export function toDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * YYYY-MM-DD → yerel gece yarısı Date
 */
export function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map((x) => Number(x));
  return new Date(y, m - 1, d);
}
