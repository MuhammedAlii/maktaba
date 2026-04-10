import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useCollection, firestoreHelpers } from '../../hooks/useFirestore';
import { showError, showLoading, hideLoading, showSuccess, showConfirm } from '../../services/notificationService';
import { HiBookOpen, HiTrash } from 'react-icons/hi';

type VirdType = 'quran' | 'book' | 'zikr';

interface Book {
  id: string;
  title: string;
  pageCount?: number;
  isActive?: boolean;
}

interface Vird {
  id: string;
  type: VirdType;
  name: string;
  totalTarget: number;
  bookId?: string;
  isActive?: boolean;
}

const QURAN_TOTAL_PAGES_DEFAULT = 604;

export default function Virdler() {
  const { data: virds, loading: virdsLoading } = useCollection<Vird>('virds');
  const { data: books, loading: booksLoading } = useCollection<Book>('books');

  const [type, setType] = useState<VirdType>('quran');
  const [bookId, setBookId] = useState<string>('');
  const [zikrName, setZikrName] = useState<string>('');
  const [zikrTotal, setZikrTotal] = useState<number>(100);
  const [active, setActive] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);

  const selectedBook = useMemo(() => books?.find((b) => b.id === bookId), [books, bookId]);

  useEffect(() => {
    if (type === 'quran') {
      setZikrName('');
    }
    if (type === 'zikr') {
      setBookId('');
    }
  }, [type]);

  const resetForm = () => {
    setType('quran');
    setBookId('');
    setZikrName('');
    setZikrTotal(100);
    setActive(true);
  };

  const handleAddVird = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;

    try {
      setSaving(true);
      showLoading('Vird ekleniyor...');

      let payload: Omit<Vird, 'id'>;

      if (type === 'quran') {
        payload = {
          type,
          name: 'Kur\'an-ı Kerim',
          totalTarget: QURAN_TOTAL_PAGES_DEFAULT,
          isActive: active,
        };
      } else if (type === 'book') {
        if (!bookId) throw new Error('Lütfen bir kitap seçin.');
        const pages = selectedBook?.pageCount;
        if (!pages || pages <= 0) throw new Error('Seçilen kitabın sayfa sayısı tanımlı değil.');
        payload = {
          type,
          name: selectedBook?.title || 'Kitap',
          bookId,
          totalTarget: pages,
          isActive: active,
        };
      } else {
        if (!zikrName.trim()) throw new Error('Lütfen zikrin adını girin.');
        if (!zikrTotal || zikrTotal <= 0) throw new Error('Lütfen zikrin adedini 0\'dan büyük girin.');
        payload = {
          type,
          name: zikrName.trim(),
          totalTarget: Number(zikrTotal),
          isActive: active,
        };
      }

      await firestoreHelpers.add<Vird>('virds', payload);
      hideLoading();
      await showSuccess('Vird eklendi.');
      resetForm();
    } catch (err) {
      hideLoading();
      await showError(err instanceof Error ? err.message : 'Vird eklenirken bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (v: Vird) => {
    try {
      setSaving(true);
      showLoading('Durum güncelleniyor...');
      await firestoreHelpers.update<Vird>('virds', v.id, { isActive: !v.isActive });
      hideLoading();
      await showSuccess('Durum güncellendi.');
    } catch (err) {
      hideLoading();
      await showError(err instanceof Error ? err.message : 'Durum güncellenirken hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (v: Vird) => {
    const ok = await showConfirm(
      `Bu virdi silmek istiyor musunuz? (${v.name})`,
      'Vird Silme',
      {
        confirmButtonText: 'Evet, Sil',
        cancelButtonText: 'İptal',
        icon: 'warning',
      },
    );
    if (!ok) return;

    try {
      setSaving(true);
      showLoading('Vird siliniyor...');
      await firestoreHelpers.delete('virds', v.id);
      hideLoading();
      await showSuccess('Vird silindi.');
    } catch (err) {
      hideLoading();
      await showError(err instanceof Error ? err.message : 'Vird silinirken hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  if (virdsLoading) {
    return (
      <div className="p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-4" />
        <p className="text-gray-600">Virdler yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in min-w-0 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <HiBookOpen className="w-7 h-7 text-emerald-600" />
            Vird Kataloğu
          </h1>
          <p className="text-gray-600 mt-1">
            Admin virdleri tanımlar ve aktif virdler kullanıcıların günlük giriş ekranında görünür.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-soft border border-gray-100 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-gray-900">Vird Ekle</h2>
          <button
            type="button"
            onClick={() => resetForm()}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            disabled={saving}
          >
            Formu Sıfırla
          </button>
        </div>

        <form onSubmit={handleAddVird} className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Vird Türü</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as VirdType)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                disabled={saving}
              >
                <option value="quran">Kur'an-ı Kerim</option>
                <option value="book">Kitap</option>
                <option value="zikr">Zikir</option>
              </select>
            </div>

            {type === 'book' && (
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Kitap Seç</label>
                <select
                  value={bookId}
                  onChange={(e) => setBookId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  disabled={saving || booksLoading}
                >
                  <option value="">Kitap seçin...</option>
                  {(books ?? []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title} {b.pageCount ? `(${b.pageCount} sayfa)` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {type === 'zikr' && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Zikrin Adı</label>
                  <input
                    type="text"
                    value={zikrName}
                    onChange={(e) => setZikrName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    disabled={saving}
                    placeholder="Örn: Subhanallah"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Hedef Adet</label>
                  <input
                    type="number"
                    min={1}
                    value={zikrTotal}
                    onChange={(e) => setZikrTotal(Number(e.target.value))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    disabled={saving}
                  />
                </div>
              </>
            )}

            {type === 'quran' && (
              <div className="sm:col-span-3">
                <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
                  <div className="font-semibold text-gray-900">Kur'an-ı Kerim virdi</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Toplam hedef sayfa: <span className="font-medium">{QURAN_TOTAL_PAGES_DEFAULT}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="virdActive"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              disabled={saving}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="virdActive" className="text-sm font-medium text-gray-700">
              Aktif olsun (kullanıcı ekranında görünsün)
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all font-medium shadow-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Ekleniyor...' : 'Vird Ekle'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-soft border border-gray-100 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Mevcut Virdler</h2>
          <p className="text-sm text-gray-500 mt-1">Aktif virdler günlük girişte görünür.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Vird
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Tür
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Hedef
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Aktif
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  İşlem
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(virds ?? []).map((v) => (
                <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">{v.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-xs text-gray-500">{v.type}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-700">{v.totalTarget}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={!!v.isActive}
                      onChange={() => handleToggleActive(v)}
                      disabled={saving}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleDelete(v)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        disabled={saving}
                        title="Vird sil"
                      >
                        <HiTrash className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {(virds ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                    Henüz vird tanımlı değil.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

