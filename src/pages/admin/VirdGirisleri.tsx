import { useEffect, useMemo, useState } from 'react';
import { where } from 'firebase/firestore';
import { useCollection, firestoreHelpers } from '../../hooks/useFirestore';
import { useAuth } from '../../contexts/AuthContext';
import {
  showError,
  showLoading,
  hideLoading,
  showSuccess,
} from '../../services/notificationService';
import { useNavigate } from 'react-router-dom';
import { HiBookOpen, HiCalendar } from 'react-icons/hi';
import ReactDatePicker from 'react-datepicker';
import { tr } from 'date-fns/locale/tr';
import { toDateKey } from '../../utils/dateKey';

type VirdType = 'quran' | 'book' | 'zikr';

interface User {
  id: string;
  name: string;
  lastname?: string;
  email?: string;
  role: string;
  regionIds?: string[];
  isActive?: boolean;
}

interface Vird {
  id: string;
  type: VirdType;
  name: string;
  totalTarget: number;
  isActive?: boolean;
}

interface UserVirdEntry {
  id: string;
  userId: string;
  virdId: string;
  dateKey: string; // YYYY-MM-DD
  amount: number;
}

export default function VirdGirisleri() {
  const navigate = useNavigate();
  const { user: authUser, isAdmin, isRegionSupervisor } = useAuth();

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const todayKey = useMemo(() => toDateKey(today), [today]);
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [selectedDates, setSelectedDates] = useState<Date[]>([today]);
  const [datesOverLimit, setDatesOverLimit] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const { data: users } = useCollection<User>('users');

  const myRegionId = isRegionSupervisor ? authUser?.regionIds?.[0] : null;

  const scopedUsers = useMemo(() => {
    const list = (users ?? []).filter((u) => u.isActive !== false);
    if (!isRegionSupervisor || !myRegionId) return list;
    return list.filter((u) => (u.regionIds ?? []).includes(myRegionId));
  }, [users, isRegionSupervisor, myRegionId]);

  useEffect(() => {
    if (!selectedUserId) return;
    if (scopedUsers.some((u) => u.id === selectedUserId)) return;
    if (isRegionSupervisor && authUser?.id && scopedUsers.some((u) => u.id === authUser.id)) {
      setSelectedUserId(authUser.id);
    } else {
      setSelectedUserId(scopedUsers[0]?.id ?? '');
    }
  }, [scopedUsers, selectedUserId, isRegionSupervisor, authUser?.id]);

  useEffect(() => {
    if (!authUser) return;
    if (selectedUserId) return;
    // Region supervisor default: kendi kullanıcısı
    if (isRegionSupervisor) {
      setSelectedUserId(authUser.id);
      return;
    }
    // Admin default: ilk kullanıcı
    if (scopedUsers.length > 0) {
      setSelectedUserId(scopedUsers[0].id);
    }
  }, [authUser, scopedUsers, isRegionSupervisor, selectedUserId]);

  const { data: activeVirds, loading: virdsLoading } = useCollection<Vird>('virds', [
    where('isActive', '==', true),
  ]);

  const queryUserId = selectedUserId || '';
  const singleDateKeyForQuery = useMemo(() => {
    // Tek gün seçiliyse o günün verisini göster
    if (selectedDates.length === 1) return toDateKey(selectedDates[0]);
    return '';
  }, [selectedDates]);

  const selectedDateLabel = useMemo(() => {
    const fmt = (d: Date) =>
      `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;

    if (selectedDates.length === 1) return fmt(selectedDates[0]);
    if (selectedDates.length === 0) return '-';
    return `${selectedDates.length} gün seçildi`;
  }, [selectedDates]);

  const selectedDateKeySet = useMemo(() => {
    return new Set(selectedDates.map((d) => toDateKey(d)));
  }, [selectedDates]);

  useEffect(() => {
    if (selectedDates.length === 1) {
      setSelectedDateKey(toDateKey(selectedDates[0]));
    }
  }, [selectedDates]);

  const { data: entries } = useCollection<UserVirdEntry>(
    'userVirdEntries',
    singleDateKeyForQuery
      ? [where('userId', '==', queryUserId), where('dateKey', '==', singleDateKeyForQuery)]
      : [where('userId', '==', '__none__')]
  );

  const entryByVirdId = useMemo(() => {
    const m = new Map<string, UserVirdEntry>();
    (entries ?? []).forEach((e) => m.set(e.virdId, e));
    return m;
  }, [entries]);

  /** String: inputta 0 silinip yeni sayı yazılabilsin. */
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!activeVirds) return;
    if (selectedDates.length > 1) {
      // Toplu girişte değerler seçilen tüm günlere uygulanır, varsayılan 0.
      const next: Record<string, string> = {};
      activeVirds.forEach((v) => {
        next[v.id] = '0';
      });
      setAmounts(next);
      return;
    }
    const next: Record<string, string> = {};
    activeVirds.forEach((v) => {
      next[v.id] = String(entryByVirdId.get(v.id)?.amount ?? 0);
    });
    setAmounts(next);
  }, [activeVirds, entryByVirdId, selectedDates]);

  if (!authUser) return null;

  const unitLabel = (type: VirdType) => {
    if (type === 'quran') return 'sayfa';
    if (type === 'book') return 'sayfa';
    return 'adet';
  };

  const handleSave = async () => {
    if (!selectedUserId) return;
    if (saving) return;

    if (isRegionSupervisor && myRegionId) {
      if (!scopedUsers.some((u) => u.id === selectedUserId)) {
        await showError(
          'Yalnızca kendi bölgenizdeki aktif kullanıcılar için vird girişi yapabilirsiniz.',
        );
        return;
      }
    }

    try {
      setSaving(true);
      showLoading('Vird girişi kaydediliyor...');

      const dateKeys = (() => {
        const keys = selectedDates
          .map((d) => {
            const dd = new Date(d);
            dd.setHours(0, 0, 0, 0);
            return toDateKey(dd);
          })
          .filter((k) => k <= todayKey); // ileri tarih olmasın
        return Array.from(new Set(keys)).sort();
      })();

      if (dateKeys.length === 0) {
        hideLoading();
        await showError('Lütfen geçerli bir tarih seçin.');
        return;
      }

      // Firestore 'in' sorgusu limiti 10
      if (dateKeys.length > 10) {
        hideLoading();
        await showError('Toplu girişte en fazla 10 tarih seçebilirsiniz.');
        return;
      }

      // Seçilen tüm tarihler için mevcut kayıtları çek
      const existingForDates = await firestoreHelpers.getAll<UserVirdEntry>('userVirdEntries', [
        where('userId', '==', selectedUserId),
        where('dateKey', 'in', dateKeys),
      ]);
      const existingByKey = new Map<string, UserVirdEntry>();
      existingForDates.forEach((e) => existingByKey.set(`${e.dateKey}__${e.virdId}`, e));

      const virds = activeVirds ?? [];
      await Promise.all(
        dateKeys.flatMap((dk) =>
          virds.map(async (v) => {
            const raw = (amounts[v.id] ?? '').trim();
            const amount = raw === '' ? 0 : Math.max(0, parseInt(raw, 10) || 0);
            const existing = existingByKey.get(`${dk}__${v.id}`);

            if (existing) {
              await firestoreHelpers.update<UserVirdEntry>('userVirdEntries', existing.id, {
                amount,
              });
            } else {
              await firestoreHelpers.add<UserVirdEntry>('userVirdEntries', {
                userId: selectedUserId,
                virdId: v.id,
                dateKey: dk,
                amount,
              });
            }
          }),
        ),
      );

      hideLoading();
      await showSuccess(dateKeys.length > 1 ? 'Toplu vird girişi kaydedildi.' : 'Vird girişi kaydedildi.');
    } catch (err) {
      hideLoading();
      await showError(
        err instanceof Error ? err.message : 'Vird girişi kaydedilirken bir hata oluştu.',
      );
    } finally {
      setSaving(false);
    }
  };

  const selectedUser = scopedUsers.find((u) => u.id === selectedUserId);

  return (
    <div className="space-y-6 animate-fade-in min-w-0 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <HiBookOpen className="w-7 h-7 text-emerald-600" />
            Vird Girişleri
          </h1>
          <p className="text-gray-600 mt-1">
            Admin ve bölge sorumluları seçilen kullanıcı için geri/ileri tarihte vird girdisi yapabilir.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-soft border border-gray-100 p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Kullanıcı
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              disabled={saving || scopedUsers.length === 0}
            >
              {scopedUsers.length === 0 ? (
                <option value="">Kullanıcı yok</option>
              ) : (
                scopedUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} {u.lastname ?? ''}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Tarih
            </label>
            <div className="relative">
              <HiCalendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none z-10" />
              <ReactDatePicker
                selected={selectedDates[0] ?? today}
                value={selectedDateLabel}
                onChange={() => {
                  // Çoklu seçim için onSelect ile state yönetiyoruz.
                }}
                onSelect={(d) => {
                  const picked = d ?? today;
                  const nn = new Date(picked);
                  nn.setHours(0, 0, 0, 0);
                  if (toDateKey(nn) > todayKey) return;

                  setDatesOverLimit(false);
                  setSelectedDates((prev) => {
                    const has = prev.some((x) => toDateKey(x) === toDateKey(nn));
                    if (!has && prev.length >= 10) {
                      setDatesOverLimit(true);
                      return prev;
                    }
                    const next = has
                      ? prev.filter((x) => toDateKey(x) !== toDateKey(nn))
                      : [...prev, nn];

                    const uniq = Array.from(
                      new Map(
                        next
                          .map((x) => {
                            const dd = new Date(x);
                            dd.setHours(0, 0, 0, 0);
                            return dd;
                          })
                          .filter((x) => toDateKey(x) <= todayKey)
                          .map((x) => [toDateKey(x), x] as const),
                      ).values(),
                    ).sort((a, b) => a.getTime() - b.getTime());

                    if (uniq.length > 10) {
                      setDatesOverLimit(true);
                      return uniq.slice(0, 10);
                    }
                    return uniq.length > 0 ? uniq : [today];
                  });
                }}
                maxDate={today}
                locale={tr}
                dateFormat="dd.MM.yyyy"
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                disabled={saving}
                wrapperClassName="!block !w-full"
                shouldCloseOnSelect={false}
                dayClassName={(date) =>
                  selectedDateKeySet.has(toDateKey(date))
                    ? 'maktaba-multi-selected-day'
                    : selectedDates.length >= 10
                      ? 'maktaba-multi-disabled-day'
                      : ''
                }
              />
            </div>

            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="text-xs text-gray-500">
                Birden fazla gün seçilebilir. <span className="font-medium">Max 10</span>. İleri tarih seçilemez.
              </div>
              <div className="text-xs text-gray-500">
                Seçili: {selectedDates.length} gün
              </div>
            </div>

            {datesOverLimit && (
              <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                En fazla 10 gün seçebilirsiniz. Seçim 10 gün ile sınırlandı.
              </div>
            )}

          </div>
        </div>

        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">
                {selectedUser ? `${selectedUser.name} ${selectedUser.lastname ?? ''}` : 'Seçili kullanıcı'}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {selectedDates.length === 1 ? selectedDateKey : `${selectedDates.length} gün seçildi`}
              </div>
            </div>
            <div className="text-xs text-gray-500 hidden sm:block">
              {isAdmin ? 'Admin' : 'Bölge Sorunlusu'}
            </div>
          </div>

          {virdsLoading ? (
            <div className="p-10 text-center text-gray-600">Virdler yükleniyor...</div>
          ) : (
            <div className="p-4 sm:p-6 space-y-4">
              {activeVirds && activeVirds.length > 0 ? (
                activeVirds.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-gray-900 truncate">
                        {v.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Hedef toplam: {v.totalTarget} {unitLabel(v.type)}
                      </div>
                    </div>
                    <div className="w-40 shrink-0">
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Okunan
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        value={amounts[v.id] ?? ''}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '') {
                            setAmounts((prev) => ({ ...prev, [v.id]: '' }));
                            return;
                          }
                          if (!/^\d+$/.test(raw)) return;
                          setAmounts((prev) => ({ ...prev, [v.id]: raw }));
                        }}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                        disabled={saving}
                      />
                      <div className="text-[11px] text-gray-400 mt-1">
                        {unitLabel(v.type)}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-10 text-center text-gray-600">
                  Aktif vird bulunamadı.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          disabled={saving}
        >
          Geri
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl text-sm font-medium hover:from-primary-700 hover:to-primary-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={saving || !selectedUserId}
        >
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>
    </div>
  );
}

