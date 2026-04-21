import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { where } from 'firebase/firestore';
import { useCollection, firestoreHelpers } from '../../hooks/useFirestore';
import { useAuth } from '../../contexts/AuthContext';
import {
  showError,
  showLoading,
  hideLoading,
  showSuccess,
} from '../../services/notificationService';
import { HiArrowLeft, HiClock, HiBookOpen, HiSparkles } from 'react-icons/hi';
import { toDateKey } from '../../utils/dateKey';

type VirdType = 'quran' | 'book' | 'zikr';

interface Vird {
  id: string;
  type: VirdType;
  name: string;
  totalTarget: number;
  bookId?: string;
  isActive?: boolean;
}

interface UserVirdEntry {
  id: string;
  userId: string;
  virdId: string;
  dateKey: string; // YYYY-MM-DD
  amount: number;
}

export default function UserVirdTakip() {
  const { user } = useAuth();
  const isApproved = user?.role !== 'user' || user?.isUserApproved === true;

  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const [saving, setSaving] = useState(false);
  const queryUserId = user?.id ?? '';

  const { data: activeVirds, loading: virdsLoading } = useCollection<Vird>('virds', [
    where('isActive', '==', true),
  ]);

  const { data: entries } = useCollection<UserVirdEntry>(
    'userVirdEntries',
    [where('userId', '==', queryUserId), where('dateKey', '==', todayKey)],
  );

  const entryByVirdId = useMemo(() => {
    const m = new Map<string, UserVirdEntry>();
    (entries ?? []).forEach((e) => m.set(e.virdId, e));
    return m;
  }, [entries]);

  /** Input değerleri string: boş bırakıp yeniden yazılabilsin (kontrollü number ile 0 silinmiyordu). */
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!activeVirds) return;
    const next: Record<string, string> = {};
    activeVirds.forEach((v) => {
      next[v.id] = String(entryByVirdId.get(v.id)?.amount ?? 0);
    });
    setAmounts(next);
  }, [activeVirds, entryByVirdId]);

  if (!user) return null;

  if (user.role === 'user' && user.isUserApproved !== true) {
    return (
      <div className="space-y-6 animate-fade-in max-w-lg mx-auto">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-6 text-center">
          <HiBookOpen className="w-12 h-12 text-amber-600 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-gray-900">Vird girişi için onay gerekli</h1>
          <p className="text-sm text-gray-600 mt-2">
            Hesabınız yönetici tarafından onaylandığında günlük vird kaydı yapabilirsiniz.
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 transition-all"
          >
            Ana sayfaya dön
          </Link>
        </div>
      </div>
    );
  }

  const unitLabel = (type: VirdType) => {
    if (type === 'quran') return 'sayfa';
    if (type === 'book') return 'sayfa';
    return 'adet';
  };

  const handleSave = async () => {
    if (!user || saving || !isApproved) return;
    setSaving(true);

    try {
      showLoading('Vird girdisi kaydediliyor...');

      const virds = activeVirds ?? [];
      await Promise.all(
        virds.map(async (v) => {
          const raw = (amounts[v.id] ?? '').trim();
          const amount = raw === '' ? 0 : Math.max(0, parseInt(raw, 10) || 0);
          const existing = entryByVirdId.get(v.id);

          if (existing) {
            await firestoreHelpers.update<UserVirdEntry>('userVirdEntries', existing.id, {
              amount,
            });
          } else {
            await firestoreHelpers.add<UserVirdEntry>('userVirdEntries', {
              userId: user.id,
              virdId: v.id,
              dateKey: todayKey,
              amount,
            });
          }
        }),
      );

      hideLoading();
      await showSuccess('Günlük vird girdisi kaydedildi.');
    } catch (err) {
      hideLoading();
      await showError(
        err instanceof Error ? err.message : 'Günlük vird girdisi kaydedilirken bir hata oluştu.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4 flex-wrap">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            window.location.href = '/';
          }}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-emerald-600"
        >
          <HiArrowLeft className="w-4 h-4" />
          Ana sayfa
        </a>
      </div>

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
          <HiBookOpen className="w-7 h-7 text-emerald-600" />
          Vird Takibi
        </h1>
        <p className="text-gray-600 mt-1 flex items-center gap-2">
          <HiClock className="w-4 h-4 text-gray-400" />
          Bugün: {new Date().toLocaleDateString('tr-TR')}
        </p>
      </div>

      {virdsLoading ? (
        <div className="p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-4" />
          <p className="text-gray-600">Virdler yükleniyor...</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-soft border border-gray-100 overflow-hidden">
          <div className="p-4 sm:p-6 space-y-4">
            {activeVirds && activeVirds.length > 0 ? (
              activeVirds.map((v) => (
                <div
                  key={v.id}
                  className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 rounded-xl border border-gray-200 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-gray-900 truncate">{v.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Hedef toplam: {v.totalTarget} {unitLabel(v.type)}
                    </div>
                  </div>
                  <div className="w-full sm:w-40 shrink-0">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Bugün
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
                    />
                    <div className="text-[11px] text-gray-400 mt-1">{unitLabel(v.type)}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-gray-50 border border-gray-200 p-10 text-center">
                <HiSparkles className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-700 font-semibold">Henüz aktif vird bulunmuyor</p>
                <p className="text-sm text-gray-500 mt-1">Admin virdleri tanımladığında burada görüntülenecek.</p>
              </div>
            )}
          </div>

          <div className="p-4 sm:p-6 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={saving}
            >
              Yenile
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl text-sm font-medium hover:from-primary-700 hover:to-primary-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={saving || !activeVirds || activeVirds.length === 0 || !isApproved}
            >
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

