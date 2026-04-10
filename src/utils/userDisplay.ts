/**
 * Kullanıcı adı gösterimi (avatar baş harfleri vb.) — tek kaynak.
 */
export function getUserInitials(
  name?: string | null,
  lastname?: string | null,
): string {
  const nameInitial = name?.[0]?.toUpperCase() || '';
  const lastnameInitial = lastname?.[0]?.toUpperCase() || '';
  const pair = (nameInitial + lastnameInitial).slice(0, 2);
  return pair || '??';
}
