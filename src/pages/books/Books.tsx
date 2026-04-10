import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { where } from 'firebase/firestore';
import { useCollection, firestoreHelpers } from '../../hooks/useFirestore';
import { useAuth } from '../../contexts/AuthContext';
import { 
  showSuccess, 
  showError, 
  showConfirm,
  showLoading,
  hideLoading
} from '../../services/notificationService';
import {
  HiPlus,
  HiPencil,
  HiTrash,
  HiSearch,
  HiBookOpen,
  HiX,
  HiRefresh,
  HiUsers,
  HiOfficeBuilding,
} from 'react-icons/hi';

interface Book {
  id: string;
  title: string;
  author: string;
  category?: string;
  isbn?: string;
  pageCount?: number;
  regionIds?: string[];
  createdAt?: Date;
}

interface RegionOption {
  id: string;
  name: string;
  isActive: boolean;
}

interface UserReadingProgress {
  id: string;
  userId: string;
  bookId: string;
  completedPages: number;
  totalPages: number;
}

interface User {
  id: string;
  name: string;
  lastname?: string;
  email?: string;
  username?: string;
  regionIds?: string[];
}

export default function Books() {
  // Real-time veri akışı - Firebase'den otomatik güncelleme
  const { data: books, loading, error } = useCollection<Book>('books');
  const { data: regions } = useCollection<RegionOption>('regions');
  const { data: userReadingProgress } =
    useCollection<UserReadingProgress>('userReadingProgress');
  const { data: allUsers } = useCollection<User>('users');

  const { user: authUser } = useAuth();
  const isRegionSupervisor = authUser?.role === 'regionSupervisor';
  const myRegionId = isRegionSupervisor ? authUser?.regionIds?.[0] : undefined;

  const [showModal, setShowModal] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [selectedBookForUsers, setSelectedBookForUsers] = useState<Book | null>(
    null,
  );
  const [showRegionsModal, setShowRegionsModal] = useState(false);
  const [selectedBookForRegions, setSelectedBookForRegions] =
    useState<Book | null>(null);
  const [regionsToAddIds, setRegionsToAddIds] = useState<string[]>([]);
  const [isRegionsAddDropdownOpen, setIsRegionsAddDropdownOpen] =
    useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const regionsAddButtonRef = useRef<HTMLButtonElement>(null);
  const regionsAddDropdownRef = useRef<HTMLDivElement>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [addTab, setAddTab] = useState<'manual' | 'isbn'>('manual');
  const [isbnSearch, setIsbnSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    pages: '',
    isbn: '',
  });
  const [editFormData, setEditFormData] = useState({
    title: '',
    author: '',
    pages: '',
    isbn: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [addBookRegionIds, setAddBookRegionIds] = useState<string[]>([]);
  const [isAddBookRegionOpen, setIsAddBookRegionOpen] = useState(false);
  const [addBookRegionSearch, setAddBookRegionSearch] = useState('');
  const addBookRegionButtonRef = useRef<HTMLButtonElement>(null);
  const addBookRegionDropdownRef = useRef<HTMLDivElement>(null);
  const [addBookRegionDropdownPosition, setAddBookRegionDropdownPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const scopedRegionsForBookAdd = useMemo(() => {
    const list = [...(regions ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name, 'tr'),
    );
    if (isRegionSupervisor && myRegionId) {
      return list.filter((r) => r.id === myRegionId);
    }
    return list;
  }, [regions, isRegionSupervisor, myRegionId]);

  const filteredAddBookRegions = scopedRegionsForBookAdd.filter((r) =>
    r.name.toLowerCase().includes(addBookRegionSearch.toLowerCase()),
  );

  const addBookRegionAllIds = useMemo(
    () => scopedRegionsForBookAdd.map((r) => r.id),
    [scopedRegionsForBookAdd],
  );

  const addBookRegionsAllSelected =
    addBookRegionAllIds.length > 0 &&
    addBookRegionAllIds.every((id) => addBookRegionIds.includes(id));

  const updateAddBookRegionDropdownPosition = () => {
    const btn = addBookRegionButtonRef.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setAddBookRegionDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  };

  useEffect(() => {
    if (isAddBookRegionOpen) {
      updateAddBookRegionDropdownPosition();
      window.addEventListener('scroll', updateAddBookRegionDropdownPosition, true);
      window.addEventListener('resize', updateAddBookRegionDropdownPosition);
      return () => {
        window.removeEventListener('scroll', updateAddBookRegionDropdownPosition, true);
        window.removeEventListener('resize', updateAddBookRegionDropdownPosition);
      };
    }
    setAddBookRegionDropdownPosition(null);
  }, [isAddBookRegionOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        isAddBookRegionOpen &&
        addBookRegionButtonRef.current &&
        !addBookRegionButtonRef.current.contains(target) &&
        addBookRegionDropdownRef.current &&
        !addBookRegionDropdownRef.current.contains(target)
      ) {
        setIsAddBookRegionOpen(false);
        setAddBookRegionDropdownPosition(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAddBookRegionOpen]);

  const updateDropdownPosition = () => {
    const btn = regionsAddButtonRef.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  };

  useEffect(() => {
    if (isRegionsAddDropdownOpen) {
      updateDropdownPosition();
      window.addEventListener('scroll', updateDropdownPosition, true);
      window.addEventListener('resize', updateDropdownPosition);
      return () => {
        window.removeEventListener('scroll', updateDropdownPosition, true);
        window.removeEventListener('resize', updateDropdownPosition);
      };
    } else {
      setDropdownPosition(null);
    }
  }, [isRegionsAddDropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        isRegionsAddDropdownOpen &&
        regionsAddButtonRef.current &&
        !regionsAddButtonRef.current.contains(target) &&
        regionsAddDropdownRef.current &&
        !regionsAddDropdownRef.current.contains(target)
      ) {
        setIsRegionsAddDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isRegionsAddDropdownOpen]);

  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();

    const effectiveRegionIds =
      isRegionSupervisor && myRegionId
        ? addBookRegionIds.filter((id) => id === myRegionId)
        : [...addBookRegionIds];

    if (effectiveRegionIds.length === 0) {
      await showError('En az bir bölge seçmelisiniz.');
      return;
    }

    setIsSubmitting(true);
    showLoading('Kitap ekleniyor...');
    
    try {
      await firestoreHelpers.add<Book>('books', {
        title: formData.title.trim(),
        author: formData.author.trim(),
        isbn: formData.isbn?.trim() || '',
        pageCount: formData.pages ? Number(formData.pages) : undefined,
        regionIds: effectiveRegionIds,
        createdAt: new Date(),
      });
      
      setShowModal(false);
      setFormData({ title: '', author: '', pages: '', isbn: '' });
      setAddBookRegionIds([]);
      setAddBookRegionSearch('');
      setIsAddBookRegionOpen(false);
      setAddBookRegionDropdownPosition(null);
      setAddTab('manual');
      setIsbnSearch('');
      setSearchError(null);
      hideLoading();
      // await showSuccess('Kitap başarıyla eklendi!');
    } catch (error) {
      console.error('Kitap eklenirken hata:', error);
      hideLoading();
      await showError('Kitap eklenirken bir hata oluştu!');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Kitap düzenleme modal'ını aç
  const handleEditBook = (book: Book) => {
    setEditingBook(book);
    setEditFormData({
      title: book.title || '',
      author: book.author || '',
      pages: book.pageCount ? String(book.pageCount) : '',
      isbn: book.isbn || '',
    });
    setShowEditModal(true);
  };

  // Kitap güncelle
  const handleUpdateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBook) return;

    setIsSubmitting(true);
    showLoading('Kitap güncelleniyor...');
    
    try {
      await firestoreHelpers.update('books', editingBook.id, {
        title: editFormData.title.trim(),
        author: editFormData.author.trim(),
        isbn: editFormData.isbn?.trim() || '',
        pageCount: editFormData.pages ? Number(editFormData.pages) : undefined,
      });
      
      setShowEditModal(false);
      setEditingBook(null);
      setEditFormData({ title: '', author: '', pages: '', isbn: '' });
      hideLoading();
      // await showSuccess('Kitap başarıyla güncellendi!');
    } catch (error) {
      console.error('Kitap güncellenirken hata:', error);
      hideLoading();
      await showError('Kitap güncellenirken bir hata oluştu!');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBook = async (id: string) => {
    const confirmed = await showConfirm(
      'Bu kitabı silmek istediğinizden emin misiniz? Kullanıcılara tanımlı okuma kayıtları da silinecektir.',
      'Kitap Silme',
      {
        confirmButtonText: 'Evet, Sil',
        cancelButtonText: 'İptal',
        icon: 'warning',
      },
    );

    if (!confirmed) {
      return;
    }

    showLoading('Kitap siliniyor...');

    try {
      const progressRecords = await firestoreHelpers.getAll<{ id: string }>(
        'userReadingProgress',
        [where('bookId', '==', id)],
      );
      await Promise.all(
        progressRecords.map((rec) =>
          firestoreHelpers.delete('userReadingProgress', rec.id),
        ),
      );
      await firestoreHelpers.delete('books', id);
      hideLoading();
      // await showSuccess('Kitap başarıyla silindi!');
    } catch (error) {
      console.error('Kitap silinirken hata:', error);
      hideLoading();
      await showError('Kitap silinirken bir hata oluştu!');
    }
  };

  const scopedBooks =
    isRegionSupervisor && myRegionId
      ? books.filter((book) => (book.regionIds ?? []).includes(myRegionId))
      : books;

  const filteredBooks = scopedBooks.filter(
    (book) =>
      book.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.author?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.isbn?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const availableRegionsForBookModal = useMemo(() => {
    if (!selectedBookForRegions) return [];
    const current = selectedBookForRegions.regionIds ?? [];
    return (regions ?? [])
      .filter((r) => {
        if (isRegionSupervisor && myRegionId && r.id !== myRegionId) return false;
        return !current.includes(r.id);
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, [regions, selectedBookForRegions, isRegionSupervisor, myRegionId]);

  const regionsModalAddAllIds = useMemo(
    () => availableRegionsForBookModal.map((r) => r.id),
    [availableRegionsForBookModal],
  );

  const regionsModalAddAllSelected =
    regionsModalAddAllIds.length > 0 &&
    regionsModalAddAllIds.every((id) => regionsToAddIds.includes(id));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Kitaplar</h1>
          <p className="text-gray-500 mt-1">
            {loading
              ? 'Yükleniyor...'
              : searchTerm
                ? `${filteredBooks.length} / ${scopedBooks.length} kitap`
                : `${scopedBooks.length} kitap`}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2 text-gray-700"
          >
            <HiRefresh className="w-5 h-5" />
            <span className="hidden sm:inline">Yenile</span>
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all shadow-medium flex items-center gap-2"
          >
            <HiPlus className="w-5 h-5" />
            <span>Yeni Kitap</span>
          </button>
        </div>
      </div>

      {/* Hata Mesajı */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-800">Hata: {error.message}</p>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-soft p-4">
        <div className="relative">
          <HiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Kitap, yazar, kategori veya ISBN ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Books Table */}
      <div className="bg-white rounded-xl shadow-soft overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-4"></div>
            <p className="text-gray-600">Yükleniyor...</p>
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="p-12 text-center">
            <HiBookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 font-medium mb-1">
              {searchTerm ? 'Kitap bulunamadı' : 'Henüz kitap yok'}
            </p>
            <p className="text-sm text-gray-500">
              {searchTerm ? 'Arama terimini değiştirmeyi deneyin' : 'Yeni kitap ekleyerek başlayın'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Kitap
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Yazar
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    ISBN
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Sayfa Sayısı
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredBooks.map((book) => (
                  <tr key={book.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white shadow-medium">
                          <HiBookOpen className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{book.title}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{book.author}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600 font-mono">
                        {book.isbn || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {book.pageCount ?? '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedBookForUsers(book);
                            setShowUsersModal(true);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Tanımlı kişiler"
                        >
                          <HiUsers className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedBookForRegions(book);
                            setRegionsToAddIds([]);
                            setShowRegionsModal(true);
                          }}
                          className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Tanımlı bölgeler"
                        >
                          <HiOfficeBuilding className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleEditBook(book)}
                          className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Düzenle"
                        >
                          <HiPencil className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteBook(book.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Sil"
                        >
                          <HiTrash className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && editingBook && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in"
          style={{ marginTop: '0px' }}
        >
          <div className="bg-white rounded-2xl max-w-md w-full shadow-large animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-gray-900">Kitap Düzenle</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingBook(null);
                  setEditFormData({ title: '', author: '', pages: '', isbn: '' });
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={isSubmitting}
              >
                <HiX className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateBook} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Başlık *</label>
                <input
                  type="text"
                  required
                  value={editFormData.title}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="Kitap adı"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Yazar *</label>
                <input
                  type="text"
                  required
                  value={editFormData.author}
                  onChange={(e) => setEditFormData({ ...editFormData, author: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="Yazar adı"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Sayfa Sayısı</label>
                <input
                  type="number"
                  min={1}
                  value={editFormData.pages}
                  onChange={(e) => setEditFormData({ ...editFormData, pages: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="Örn: 100"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">ISBN (opsiyonel)</label>
                <input
                  type="text"
                  value={editFormData.isbn}
                  onChange={(e) => setEditFormData({ ...editFormData, isbn: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all font-mono"
                  placeholder="978-0-123456-78-9"
                  disabled={isSubmitting}
                />
              </div>
              {editingBook && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-700 mb-1">Bulunduğu Bölgeler</p>
                  <p className="text-xs text-gray-500">
                    {editingBook.regionIds && editingBook.regionIds.length > 0
                      ? editingBook.regionIds
                          .map(
                            (id) =>
                              regions.find((r) => r.id === id)?.name || `Bölge (${id})`
                          )
                          .join(', ')
                      : 'Bu kitap henüz hiçbir bölgeye eklenmemiş.'}
                  </p>
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingBook(null);
                    setEditFormData({ title: '', author: '', pages: '', isbn: '' });
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium text-gray-700"
                  disabled={isSubmitting}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all font-medium shadow-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Güncelleniyor...' : 'Güncelle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in"
          style={{ marginTop: '0px' }}
        >
          <div className="bg-white rounded-2xl max-w-md w-full shadow-large animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-gray-900">Yeni Kitap</h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setFormData({ title: '', author: '', pages: '', isbn: '' });
                  setAddBookRegionIds([]);
                  setAddBookRegionSearch('');
                  setIsAddBookRegionOpen(false);
                  setAddBookRegionDropdownPosition(null);
                  setAddTab('manual');
                  setIsbnSearch('');
                  setSearchError(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={isSubmitting}
              >
                <HiX className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 pt-4">
              <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1 text-sm font-medium">
                <button
                  type="button"
                  onClick={() => setAddTab('manual')}
                  className={`flex-1 px-3 py-2 rounded-lg transition-colors ${
                    addTab === 'manual'
                      ? 'bg-white text-primary-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Manuel
                </button>
                <button
                  type="button"
                  onClick={() => setAddTab('isbn')}
                  className={`flex-1 px-3 py-2 rounded-lg transition-colors ${
                    addTab === 'isbn'
                      ? 'bg-white text-primary-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  ISBN ile Ara
                </button>
              </div>
            </div>
            <form onSubmit={handleAddBook} className="p-6 space-y-5">
              {addTab === 'manual' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Başlık *</label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      placeholder="Kitap adı"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Yazar *</label>
                    <input
                      type="text"
                      required
                      value={formData.author}
                      onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      placeholder="Yazar adı"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Sayfa Sayısı</label>
                    <input
                      type="number"
                      min={1}
                      value={formData.pages}
                      onChange={(e) => setFormData({ ...formData, pages: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      placeholder="Örn: 100"
                      disabled={isSubmitting}
                    />
                  </div>
                </>
              )}

              {addTab === 'isbn' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      ISBN Numarası
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={isbnSearch}
                        onChange={(e) => setIsbnSearch(e.target.value)}
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all font-mono"
                        placeholder="9780140328721"
                        disabled={isSubmitting || isSearching}
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (!isbnSearch.trim()) return;
                          try {
                            setIsSearching(true);
                            setSearchError(null);
                            const isbn = isbnSearch.trim();

                            // Önce Google Books API
                            const res = await fetch(
                              `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(
                                isbn
                              )}`
                            );
                            let found = false;

                            if (res.ok) {
                              const data = await res.json();
                              const volume = data.items?.[0]?.volumeInfo;
                              if (volume) {
                                setFormData((prev) => ({
                                  ...prev,
                                  title: volume.title || prev.title,
                                  author:
                                    (Array.isArray(volume.authors) &&
                                      volume.authors[0]) ||
                                    prev.author,
                                  pages: volume.pageCount
                                    ? String(volume.pageCount)
                                    : prev.pages,
                                  isbn,
                                }));
                                found = true;
                              }
                            }

                            // Google Books sonuç vermezse OpenLibrary API'yi dene
                            if (!found) {
                              const olRes = await fetch(
                                `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(
                                  isbn
                                )}&format=json&jscmd=data`
                              );
                              if (olRes.ok) {
                                const olData = await olRes.json();
                                const key = `ISBN:${isbn}`;
                                const bookData = olData[key];
                                if (bookData) {
                                  setFormData((prev) => ({
                                    ...prev,
                                    title: bookData.title || prev.title,
                                    author:
                                      (Array.isArray(bookData.authors) &&
                                        bookData.authors[0]?.name) ||
                                      prev.author,
                                    pages: bookData.number_of_pages
                                      ? String(bookData.number_of_pages)
                                      : prev.pages,
                                    isbn,
                                  }));
                                  found = true;
                                }
                              }
                            }

                            // İki API'den de sonuç yoksa formu temizle
                            if (!found) {
                              setSearchError(
                                'Bu ISBN için kitap bulunamadı. Form sıfırlandı.'
                              );
                              setFormData({ title: '', author: '', pages: '', isbn: '' });
                            }
                          } catch (err) {
                            console.error(err);
                            setSearchError('Kitap bilgileri alınırken bir hata oluştu.');
                          } finally {
                            setIsSearching(false);
                          }
                        }}
                        className="px-4 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-medium shadow-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isSubmitting || isSearching}
                      >
                        {isSearching ? 'Aranıyor...' : 'Ara'}
                      </button>
                    </div>
                    {searchError && (
                      <p className="mt-2 text-xs text-red-600">{searchError}</p>
                    )}
                  </div>
                  <div className="pt-2 space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Başlık *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                        placeholder="Kitap adı"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Yazar *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.author}
                        onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                        placeholder="Yazar adı"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Sayfa Sayısı
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={formData.pages}
                        onChange={(e) => setFormData({ ...formData, pages: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                        placeholder="Örn: 100"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Bölgeler <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <button
                    type="button"
                    ref={addBookRegionButtonRef}
                    onClick={() => {
                      const next = !isAddBookRegionOpen;
                      if (next && addBookRegionButtonRef.current) {
                        const rect = addBookRegionButtonRef.current.getBoundingClientRect();
                        setAddBookRegionDropdownPosition({
                          top: rect.bottom + 4,
                          left: rect.left,
                          width: rect.width,
                        });
                      } else if (!next) {
                        setAddBookRegionDropdownPosition(null);
                      }
                      setIsAddBookRegionOpen(next);
                    }}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-left flex items-center gap-2 hover:bg-gray-50 transition-colors"
                    disabled={isSubmitting || scopedRegionsForBookAdd.length === 0}
                  >
                    <div className="flex-1 flex flex-wrap items-center gap-1 min-h-[1.75rem]">
                      {addBookRegionIds.length === 0 ? (
                        <span className="text-sm text-gray-400">Bölge seçin (zorunlu)</span>
                      ) : (
                        addBookRegionIds
                          .map((id) => scopedRegionsForBookAdd.find((r) => r.id === id))
                          .filter(Boolean)
                          .map((region) => (
                            <span
                              key={region!.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-xs border border-primary-200"
                            >
                              <span className="max-w-[140px] truncate">
                                {region!.name}
                                {!region!.isActive ? ' (pasif)' : ''}
                              </span>
                              <button
                                type="button"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  setAddBookRegionIds((prev) =>
                                    prev.filter((rid) => rid !== region!.id),
                                  );
                                }}
                                className="text-primary-500 hover:text-primary-700"
                              >
                                ×
                              </button>
                            </span>
                          ))
                      )}
                    </div>
                    <span className="text-gray-400 text-xs">▼</span>
                  </button>
                </div>

                {isAddBookRegionOpen &&
                  addBookRegionDropdownPosition &&
                  scopedRegionsForBookAdd.length > 0 &&
                  createPortal(
                    <div
                      ref={addBookRegionDropdownRef}
                      className="fixed z-[9999] border border-gray-200 rounded-xl bg-white shadow-xl flex flex-col max-h-72 overflow-hidden"
                      style={{
                        top: addBookRegionDropdownPosition.top,
                        left: addBookRegionDropdownPosition.left,
                        width: addBookRegionDropdownPosition.width,
                      }}
                    >
                      {scopedRegionsForBookAdd.length >= 2 && (
                        <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              if (addBookRegionsAllSelected) {
                                setAddBookRegionIds([]);
                              } else {
                                setAddBookRegionIds([...addBookRegionAllIds]);
                              }
                            }}
                            className="text-xs font-semibold text-primary-600 hover:text-primary-800"
                          >
                            {addBookRegionsAllSelected ? 'Seçimi kaldır' : 'Tümünü seç'}
                          </button>
                        </div>
                      )}
                      <div className="px-3 pt-2 pb-2 border-b border-gray-100 shrink-0">
                        <input
                          type="text"
                          placeholder="Bölge ara..."
                          value={addBookRegionSearch}
                          onChange={(e) => setAddBookRegionSearch(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          disabled={isSubmitting}
                        />
                      </div>
                      <ul className="py-1 max-h-52 overflow-y-auto min-h-0">
                        {filteredAddBookRegions.length === 0 ? (
                          <li className="px-3 py-2 text-xs text-gray-500">
                            Uygun bölge yok.
                          </li>
                        ) : (
                          filteredAddBookRegions.map((region) => {
                            const checked = addBookRegionIds.includes(region.id);
                            return (
                              <li
                                key={region.id}
                                className="px-3 py-1.5 flex items-center gap-2 hover:bg-gray-50 cursor-pointer"
                                onClick={() => {
                                  setAddBookRegionIds((prev) =>
                                    checked
                                      ? prev.filter((id) => id !== region.id)
                                      : [...prev, region.id],
                                  );
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    setAddBookRegionIds((prev) =>
                                      checked
                                        ? prev.filter((id) => id !== region.id)
                                        : [...prev, region.id],
                                    );
                                  }}
                                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                  onClick={(ev) => ev.stopPropagation()}
                                />
                                <span className="text-xs text-gray-800">{region.name}</span>
                                {!region.isActive && (
                                  <span className="text-[10px] text-amber-600 shrink-0">
                                    (pasif)
                                  </span>
                                )}
                              </li>
                            );
                          })
                        )}
                      </ul>
                    </div>,
                    document.body,
                  )}
                {scopedRegionsForBookAdd.length === 0 && (
                  <p className="mt-1 text-xs text-amber-700">
                    Tanımlı aktif bölge yok; önce bölge ekleyin.
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setFormData({ title: '', author: '', pages: '', isbn: '' });
                    setAddBookRegionIds([]);
                    setAddBookRegionSearch('');
                    setIsAddBookRegionOpen(false);
                    setAddBookRegionDropdownPosition(null);
                    setAddTab('manual');
                    setIsbnSearch('');
                    setSearchError(null);
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium text-gray-700"
                  disabled={isSubmitting}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    scopedRegionsForBookAdd.length === 0 ||
                    (isRegionSupervisor && myRegionId
                      ? !addBookRegionIds.includes(myRegionId)
                      : addBookRegionIds.length === 0)
                  }
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all font-medium shadow-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tanımlı kişiler modal */}
      {showUsersModal && selectedBookForUsers && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowUsersModal(false);
            setSelectedBookForUsers(null);
          }}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-large overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Tanımlı kişiler
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {selectedBookForUsers.title}
              </p>
            </div>
            <div className="max-h-72 overflow-y-auto p-4">
              {(() => {
                const userIds = (userReadingProgress ?? [])
                  .filter((rp) => rp.bookId === selectedBookForUsers.id)
                  .map((rp) => rp.userId);
                const usersWithBook = (allUsers ?? []).filter((u) =>
                  userIds.includes(u.id) &&
                  (!isRegionSupervisor ||
                    (myRegionId ? (u.regionIds ?? []).includes(myRegionId) : false)),
                );
                if (usersWithBook.length === 0) {
                  return (
                    <p className="text-sm text-gray-500 text-center py-8">
                      Bu kitap henüz hiçbir kullanıcıya tanımlanmamış.
                    </p>
                  );
                }
                return (
                  <ul className="space-y-2">
                    {usersWithBook.map((u) => (
                      <li
                        key={u.id}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {u.name} {u.lastname ?? ''}
                          </p>
                          <p className="text-xs text-gray-500">
                            {u.email ?? u.username ?? '-'}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>
            <div className="p-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => {
                  setShowUsersModal(false);
                  setSelectedBookForUsers(null);
                }}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tanımlı bölgeler modal */}
      {showRegionsModal && selectedBookForRegions && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowRegionsModal(false);
            setSelectedBookForRegions(null);
            setRegionsToAddIds([]);
            setIsRegionsAddDropdownOpen(false);
            setDropdownPosition(null);
          }}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] shadow-large overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">
                Kitabın bölgeleri
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {selectedBookForRegions.title}
              </p>
            </div>
            <div className="p-4 space-y-4 flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="min-h-0 overflow-y-auto max-h-48">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Tanımlı bölgeler
                </p>
                {(selectedBookForRegions.regionIds ?? []).length === 0 ? (
                  <p className="text-sm text-gray-500 py-2">
                    Henüz bölge tanımlanmamış.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {(selectedBookForRegions.regionIds ?? [])
                      .filter((regionId) => !isRegionSupervisor || regionId === myRegionId)
                      .map((regionId) => {
                      const region = regions?.find((r) => r.id === regionId);
                      return (
                        <li
                          key={regionId}
                          className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-gray-50"
                        >
                          <span className="text-sm font-medium text-gray-900">
                            {region?.name ?? `Bölge (${regionId})`}
                          </span>
                          {(!isRegionSupervisor || regionId === myRegionId) && (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const confirmed = await showConfirm(
                                    'Bu kitabı bu bölgeden çıkarmak istediğinizden emin misiniz?',
                                    'Bölgeden Çıkar',
                                    {
                                      confirmButtonText: 'Evet, Çıkar',
                                      cancelButtonText: 'İptal',
                                      icon: 'warning',
                                    },
                                  );
                                  if (!confirmed) return;
                                  showLoading('Güncelleniyor...');
                                  const currentIds =
                                    selectedBookForRegions.regionIds ?? [];
                                  const nextIds = currentIds.filter(
                                    (id) => id !== regionId,
                                  );
                                  await firestoreHelpers.update<Book>(
                                    'books',
                                    selectedBookForRegions.id,
                                    { regionIds: nextIds },
                                  );
                                  setSelectedBookForRegions((prev) =>
                                    prev
                                      ? { ...prev, regionIds: nextIds }
                                      : null,
                                  );
                                  hideLoading();
                                } catch (err) {
                                  console.error(err);
                                  hideLoading();
                                  await showError(
                                    'İşlem sırasında bir hata oluştu.',
                                  );
                                }
                              }}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Bölgeden çıkar"
                            >
                              <HiX className="w-4 h-4" />
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div className="shrink-0">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Bölge ekle
                </p>
                <button
                  ref={regionsAddButtonRef}
                  type="button"
                  onClick={() => {
                    const next = !isRegionsAddDropdownOpen;
                    if (next && regionsAddButtonRef.current) {
                      const rect =
                        regionsAddButtonRef.current.getBoundingClientRect();
                      setDropdownPosition({
                        top: rect.bottom + 4,
                        left: rect.left,
                        width: rect.width,
                      });
                    } else if (!next) {
                      setDropdownPosition(null);
                    }
                    setIsRegionsAddDropdownOpen(next);
                  }}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-left flex items-center justify-between gap-2 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex flex-wrap gap-1 min-h-[1.25rem]">
                    {regionsToAddIds.length === 0 ? (
                      <span className="text-gray-400">Bölge seçin...</span>
                    ) : (
                      regionsToAddIds
                        .map((id) => regions?.find((r) => r.id === id))
                        .filter(Boolean)
                        .map((r) => (
                          <span
                            key={r!.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-xs border border-primary-200"
                          >
                            {r!.name}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRegionsToAddIds((prev) =>
                                  prev.filter((id) => id !== r!.id),
                                );
                              }}
                              className="text-primary-500 hover:text-primary-700"
                            >
                              ×
                            </button>
                          </span>
                        ))
                    )}
                  </div>
                  <span className="text-gray-400 shrink-0">▼</span>
                </button>
                {isRegionsAddDropdownOpen &&
                  dropdownPosition &&
                  selectedBookForRegions &&
                  createPortal(
                    <div
                      ref={regionsAddDropdownRef}
                      className="fixed z-[9999] border border-gray-200 rounded-xl bg-white shadow-xl flex flex-col max-h-64 overflow-hidden"
                      style={{
                        top: dropdownPosition.top,
                        left: dropdownPosition.left,
                        width: dropdownPosition.width,
                      }}
                    >
                      {availableRegionsForBookModal.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-gray-500">
                          Eklenebilecek bölge kalmadı.
                        </p>
                      ) : (
                        <>
                          {availableRegionsForBookModal.length >= 2 && (
                            <div className="px-3 py-2 border-b border-gray-100 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  if (regionsModalAddAllSelected) {
                                    setRegionsToAddIds([]);
                                  } else {
                                    setRegionsToAddIds([...regionsModalAddAllIds]);
                                  }
                                }}
                                className="text-xs font-semibold text-primary-600 hover:text-primary-800"
                              >
                                {regionsModalAddAllSelected
                                  ? 'Seçimi kaldır'
                                  : 'Tümünü seç'}
                              </button>
                            </div>
                          )}
                          <ul className="py-1 overflow-y-auto min-h-0 max-h-52">
                            {availableRegionsForBookModal.map((r) => {
                              const checked = regionsToAddIds.includes(r.id);
                              return (
                                <li
                                  key={r.id}
                                  className="px-4 py-2 flex items-center gap-2 hover:bg-gray-50 cursor-pointer"
                                  onClick={() => {
                                    setRegionsToAddIds((prev) =>
                                      checked
                                        ? prev.filter((id) => id !== r.id)
                                        : [...prev, r.id],
                                    );
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      setRegionsToAddIds((prev) =>
                                        checked
                                          ? prev.filter((id) => id !== r.id)
                                          : [...prev, r.id],
                                      );
                                    }}
                                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <span className="text-sm text-gray-900">
                                    {r.name}
                                  </span>
                                  {!r.isActive && (
                                    <span className="text-[10px] text-amber-600 shrink-0">
                                      (pasif)
                                    </span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </>
                      )}
                    </div>,
                    document.body,
                  )}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 space-y-2 shrink-0">
              <button
                type="button"
                disabled={regionsToAddIds.length === 0}
                onClick={async () => {
                  if (
                    regionsToAddIds.length === 0 ||
                    !selectedBookForRegions
                  )
                    return;
                  try {
                    showLoading('Bölgeler ekleniyor...');
                    const currentIds =
                      selectedBookForRegions.regionIds ?? [];
                    const toAdd = regionsToAddIds.filter(
                      (id) =>
                        !currentIds.includes(id) &&
                        (!isRegionSupervisor || id === myRegionId),
                    );
                    const nextIds = [...currentIds, ...toAdd];
                    await firestoreHelpers.update<Book>(
                      'books',
                      selectedBookForRegions.id,
                      { regionIds: nextIds },
                    );
                    setSelectedBookForRegions((prev) =>
                      prev ? { ...prev, regionIds: nextIds } : null,
                    );
                    setRegionsToAddIds([]);
                    setIsRegionsAddDropdownOpen(false);
                    setDropdownPosition(null);
                    hideLoading();
                    await showSuccess(
                      `${toAdd.length} bölge kitaba eklendi.`,
                    );
                  } catch (err) {
                    console.error(err);
                    hideLoading();
                    await showError('İşlem sırasında bir hata oluştu.');
                  }
                }}
                className="w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Tanımla{regionsToAddIds.length > 0 && ` (${regionsToAddIds.length})`}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowRegionsModal(false);
                  setSelectedBookForRegions(null);
                  setRegionsToAddIds([]);
                  setIsRegionsAddDropdownOpen(false);
                  setDropdownPosition(null);
                }}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
