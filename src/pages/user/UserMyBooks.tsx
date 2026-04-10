import { useState, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useCollection, firestoreHelpers } from '../../hooks/useFirestore';
import { useAuth } from '../../contexts/AuthContext';
import { where } from 'firebase/firestore';
import {
  HiArrowLeft,
  HiBookOpen,
  HiCheck,
} from 'react-icons/hi';
import {
  showError,
  showLoading,
  hideLoading,
  showConfirm,
} from '../../services/notificationService';

interface Book {
  id: string;
  title: string;
  author: string;
  pageCount?: number;
}

interface UserReadingProgress {
  id: string;
  userId: string;
  bookId: string;
  completedPages: number;
  totalPages: number;
}

const SAVE_DEBOUNCE_MS = 800;

export default function UserMyBooks() {
  const { user } = useAuth();
  const [sliderValues, setSliderValues] = useState<Record<string, number>>({});
  const saveTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const { data: readingProgress } = useCollection<UserReadingProgress>(
    'userReadingProgress',
    user ? [where('userId', '==', user.id)] : []
  );
  const { data: books } = useCollection<Book>('books');

  const bookMap = useMemo(() => {
    const m = new Map<string, Book>();
    books?.forEach((b) => m.set(b.id, b));
    return m;
  }, [books]);

  const readingWithBooks = useMemo(() => {
    if (!readingProgress) return [];
    return readingProgress.map((rp) => ({
      ...rp,
      book: bookMap.get(rp.bookId),
    }));
  }, [readingProgress, bookMap]);

  const saveProgress = useCallback(async (item: UserReadingProgress & { book?: Book }, newCompleted: number) => {
    const total = item.totalPages || 0;
    if (total > 0 && newCompleted > total) return;

    try {
      showLoading('İlerleme kaydediliyor...');
      await firestoreHelpers.update<UserReadingProgress>(
        'userReadingProgress',
        item.id,
        { completedPages: newCompleted },
      );
      hideLoading();
      setSliderValues((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      const totalCheck = item.totalPages || 0;
      if (totalCheck > 0 && newCompleted >= totalCheck) {
        // // await showSuccess('Kitap okuma tamamlandı!');
      } else {
        // // await showSuccess('İlerleme kaydedildi.');
      }
    } catch (error) {
      console.error(error);
      hideLoading();
      await showError('İlerleme kaydedilirken bir hata oluştu.');
    }
  }, []);

  const handleSliderChange = useCallback(
    (item: UserReadingProgress & { book?: Book }, newVal: number) => {
      setSliderValues((prev) => ({ ...prev, [item.id]: newVal }));

      const existingTimeout = saveTimeoutRef.current[item.id];
      if (existingTimeout) clearTimeout(existingTimeout);

      saveTimeoutRef.current[item.id] = setTimeout(() => {
        delete saveTimeoutRef.current[item.id];
        saveProgress(item, newVal);
      }, SAVE_DEBOUNCE_MS);
    },
    [saveProgress],
  );

  const handleCompleteBook = async (rp: UserReadingProgress) => {
    const total = rp.totalPages || 0;
    if (total <= 0) {
      await showError('Kitabın sayfa sayısı tanımlı değil.', 'Hata');
      return;
    }

    const book = bookMap.get(rp.bookId);
    const confirmed = await showConfirm(
      `"${book?.title || 'Bu kitap'}" okunmuş olarak işaretlenecek (${total} sayfa). Devam etmek istiyor musunuz?`,
      'Kitabı Tamamla',
      {
        confirmButtonText: 'Evet, Tamamla',
        cancelButtonText: 'İptal',
        icon: 'question',
        confirmButtonColor: '#16a34a',
      },
    );
    if (!confirmed) return;

    try {
      showLoading('Kaydediliyor...');
      await firestoreHelpers.update<UserReadingProgress>(
        'userReadingProgress',
        rp.id,
        { completedPages: total },
      );
      hideLoading();
      // // await showSuccess('Kitap tamamlandı olarak işaretlendi.');
    } catch (error) {
      console.error(error);
      hideLoading();
      await showError('İşlem sırasında bir hata oluştu.');
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-emerald-600"
      >
        <HiArrowLeft className="w-4 h-4" />
        Ana sayfa
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <HiBookOpen className="w-7 h-7 text-emerald-600" />
          Kitaplarım
        </h1>
        <p className="text-gray-600 mt-1">
          Tanımlı kitaplarınız ve okuma ilerlemeniz
        </p>
      </div>

      {readingWithBooks.length === 0 ? (
        <div className="rounded-2xl bg-gray-50 border border-gray-200 p-8 text-center">
          <HiBookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">Size tanımlı kitap bulunmuyor.</p>
          <Link to="/" className="inline-block mt-4 text-emerald-600 hover:text-emerald-700 font-medium">
            Ana sayfaya dön
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {readingWithBooks.map((item) => {
            const total = item.totalPages || item.book?.pageCount || 0;
            const completed = sliderValues[item.id] ?? item.completedPages ?? 0;
            const percent =
              total > 0
                ? Math.min(100, Math.round((completed / total) * 100))
                : 0;
            const isCompleted = total > 0 && completed >= total;

            return (
              <div
                key={item.id}
                className="p-5 rounded-xl sm:rounded-2xl border border-gray-200 bg-white shadow-soft hover:shadow-medium transition-all"
              >
                <div className="flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-base font-semibold text-gray-900">
                        {item.book?.title || 'Bilinmeyen Kitap'}
                      </p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {item.book?.author}
                      </p>
                    </div>
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-sm font-medium flex-shrink-0">
                        <HiCheck className="w-4 h-4" />
                        Tamamlandı
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-blue-600 flex-shrink-0">
                        %{percent}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {total > 0 ? (
                      <div className="relative h-5 flex items-center">
                        {/* Arka plan çubuğu */}
                        <div className="absolute inset-0 h-3 rounded-full bg-gray-200" />
                        {/* Dolu kısım - thumb ile aynı koordinat: 10px + (100%-20px)*ratio */}
                        <div
                          className={`absolute left-0 h-3 transition-all duration-150 mb-[8px] ${
                            percent >= 100 ? 'rounded-full' : 'rounded-l-full'
                          }`}
                          style={{
                            width: percent >= 100
                              ? '100%'
                              : `calc(10px + (100% - 20px) * ${(Math.min(100, percent) / 100)})`,
                            backgroundColor: isCompleted ? '#10b981' : '#2563eb',
                          }}
                        />
                        {/* Sürüklenebilir slider - yuvarlak çentik */}
                        <input
                          type="range"
                          min={0}
                          max={total}
                          value={completed}
                          onChange={(e) => handleSliderChange(item, parseInt(e.target.value, 10))}
                          className={`book-progress-slider absolute inset-0 w-full ${isCompleted ? 'book-progress-slider--completed' : ''}`}
                        />
                      </div>
                    ) : (
                      <div className="w-full h-3 rounded-full bg-gray-200" />
                    )}
                    <p className="text-xs text-gray-500">
                      {Math.round(completed)} / {total} sayfa
                    </p>
                  </div>
                  {!isCompleted && total > 0 && (
                    <button
                      type="button"
                      onClick={() => handleCompleteBook(item)}
                      className="self-start inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                    >
                      <HiCheck className="w-4 h-4" />
                      Kitabı tamamla
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
