import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { Timestamp, where } from 'firebase/firestore';
import { HiTrash, HiPencil, HiCalendar, HiX } from 'react-icons/hi';
import ReactDatePicker, { registerLocale } from 'react-datepicker';
import { tr } from 'date-fns/locale/tr';

registerLocale('tr', tr);
import { useCollection, useDocument, firestoreHelpers } from '../../hooks/useFirestore';
import { useAuth } from '../../contexts/AuthContext';
import {
  showError,
  showLoading,
  hideLoading,
  showSuccess,
  showConfirm,
} from '../../services/notificationService';
interface Region {
  id: string;
  name: string;
  description?: string;
  lectures?: string[];
}

interface Lesson {
  id: string;
  name: string;
  description?: string;
  isActive?: boolean;
}

interface User {
  id: string;
  name: string;
  lastname?: string;
  email: string;
  role: string;
  regionIds?: string[];
  userLectureIds?: string[];
}

interface RegionLectureSchedule {
  id: string;
  regionId: string;
  lectureName: string;
  teacherId: string;
  participantUserIds?: string[];
  daysOfWeek: number[]; // 1 = Pazartesi ... 7 = Pazar
  startDate: Timestamp;
  endDate: Timestamp;
  startTimeMinutes: number; // 0-1440
  endTimeMinutes: number;
  createdAt?: Timestamp;
}

interface Book {
  id: string;
  title: string;
  author: string;
  isbn?: string;
  pageCount?: number;
  regionIds?: string[];
}

type PortalDropdownPosition = { top: number; left: number; width: number };

export default function RegionDetail() {
  const { regionId } = useParams<{ regionId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isRegionSupervisor, user: authUser, isAdmin } = useAuth();
  const supervisorRegionId = isRegionSupervisor ? authUser?.regionIds?.[0] : undefined;
  const [activeTab, setActiveTab] = useState<'users' | 'books' | 'lessons'>('users');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState<string>('');
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState<boolean>(false);
  const [userDropdownPosition, setUserDropdownPosition] =
    useState<PortalDropdownPosition | null>(null);
  const userDropdownButtonRef = useRef<HTMLButtonElement | null>(null);
  const userDropdownPortalRef = useRef<HTMLDivElement | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleLecture, setScheduleLecture] = useState<string>('');
  const [scheduleTeacherId, setScheduleTeacherId] = useState<string>('');
  const [scheduleDays, setScheduleDays] = useState<number[]>([]);
  const [scheduleStartDate, setScheduleStartDate] = useState<Date | null>(null);
  const [scheduleEndDate, setScheduleEndDate] = useState<Date | null>(null);
  const [scheduleStartTime, setScheduleStartTime] = useState<string>('');
  const [scheduleEndTime, setScheduleEndTime] = useState<string>('');
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<RegionLectureSchedule | null>(
    null
  );
  const [isLectureFixed, setIsLectureFixed] = useState(false);
  const [scheduleParticipantIds, setScheduleParticipantIds] = useState<string[]>([]);
  const [isParticipantDropdownOpen, setIsParticipantDropdownOpen] =
    useState(false);
  const [participantSearch, setParticipantSearch] = useState('');
  const participantDropdownRef = useRef<HTMLDivElement | null>(null);

  const { data: region, loading: regionLoading, error: regionError } = useDocument<Region>(
    'regions',
    regionId || ''
  );

  const { data: allUsers, loading: usersLoading } = useCollection<User>('users');
  const { data: allBooks, loading: booksLoading } = useCollection<Book>('books');
  const { data: lessons } = useCollection<Lesson>('lessons');

  const { data: schedules, loading: schedulesLoading } =
    useCollection<RegionLectureSchedule>('regionLectureSchedules', [
      where('regionId', '==', regionId || ''),
    ]);

  const regionUsers = allUsers.filter((user) =>
    (user.regionIds ?? []).includes(regionId || '')
  );

  /** Ders planı katılımcıları: yalnızca rolü "user" olan bölge üyeleri */
  const regionParticipantUsers = useMemo(
    () =>
      allUsers.filter(
        (user) =>
          (user.regionIds ?? []).includes(regionId || '') && user.role === 'user',
      ),
    [allUsers, regionId],
  );

  const availableUsers = allUsers.filter((user) => {
    const ids = user.regionIds ?? [];
    const inThisRegion = ids.includes(regionId || '');
    if (user.role === 'teacher') {
      // Öğretmenler birden fazla bölgeye eklenebilir, ama aynı bölgeye iki kez eklenmesin
      return !inThisRegion;
    }
    // Normal kullanıcılar yalnızca bölgesi yoksa listede görünsün
    return ids.length === 0;
  });

  const filteredAvailableUsers = availableUsers.filter((user) => {
    const term = userSearch.toLowerCase();
    const fullText = `${user.name} ${user.lastname ?? ''} ${user.email}`.toLowerCase();
    return fullText.includes(term);
  });

  const selectedUsersForDisplay = availableUsers.filter((user) =>
    selectedUserIds.includes(user.id)
  );

  const regionLectureNames = (region?.lectures ?? []).filter(Boolean);

  const activeLessonsForSchedule = (lessons ?? [])
    .filter((lesson) => lesson.isActive !== false)
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'));

  const allTeachers = allUsers.filter((u) => u.role === 'teacher');
  const regionTeachers = allTeachers.filter((u) =>
    (u.regionIds ?? []).includes(regionId || '')
  );

  const filteredParticipants = regionParticipantUsers.filter((user) => {
    const term = participantSearch.toLowerCase();
    const fullText = `${user.name} ${user.lastname ?? ''} ${user.email}`.toLowerCase();
    return fullText.includes(term);
  });

  const selectedParticipantsForDisplay = regionParticipantUsers.filter((user) =>
    scheduleParticipantIds.includes(user.id)
  );

  const regionBooks = allBooks.filter((b) =>
    (b.regionIds ?? []).includes(regionId || '')
  );

  const [bookSearch, setBookSearch] = useState('');
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [isBookDropdownOpen, setIsBookDropdownOpen] = useState(false);
  const [bookDropdownPosition, setBookDropdownPosition] =
    useState<PortalDropdownPosition | null>(null);
  const bookDropdownButtonRef = useRef<HTMLButtonElement | null>(null);
  const bookDropdownPortalRef = useRef<HTMLDivElement | null>(null);

  const availableBooks = allBooks.filter(
    (b) => !(b.regionIds ?? []).includes(regionId || '')
  );

  const filteredAvailableBooks = availableBooks.filter((b) => {
    const term = bookSearch.toLowerCase();
    return (
      b.title.toLowerCase().includes(term) ||
      b.author.toLowerCase().includes(term) ||
      (b.isbn ?? '').toLowerCase().includes(term)
    );
  });

  const dayLabels: { value: number; short: string; full: string }[] = [
    { value: 1, short: 'Pzt', full: 'Pazartesi' },
    { value: 2, short: 'Sal', full: 'Salı' },
    { value: 3, short: 'Çar', full: 'Çarşamba' },
    { value: 4, short: 'Per', full: 'Perşembe' },
    { value: 5, short: 'Cum', full: 'Cuma' },
    { value: 6, short: 'Cmt', full: 'Cumartesi' },
    { value: 7, short: 'Paz', full: 'Pazar' },
  ];

  const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60)
      .toString()
      .padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  useEffect(() => {
    if (regionError) {
      showError(regionError.message, 'Bölge Yükleme Hatası');
    }
  }, [regionError]);

  const updateUserDropdownPosition = () => {
    const btn = userDropdownButtonRef.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setUserDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  };

  useEffect(() => {
    if (isUserDropdownOpen) {
      updateUserDropdownPosition();
      window.addEventListener('scroll', updateUserDropdownPosition, true);
      window.addEventListener('resize', updateUserDropdownPosition);
      return () => {
        window.removeEventListener('scroll', updateUserDropdownPosition, true);
        window.removeEventListener('resize', updateUserDropdownPosition);
      };
    }
    setUserDropdownPosition(null);
  }, [isUserDropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const t = event.target as Node;
      if (
        isUserDropdownOpen &&
        userDropdownButtonRef.current &&
        !userDropdownButtonRef.current.contains(t) &&
        userDropdownPortalRef.current &&
        !userDropdownPortalRef.current.contains(t)
      ) {
        setIsUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isUserDropdownOpen]);

  const updateBookDropdownPosition = () => {
    const btn = bookDropdownButtonRef.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setBookDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  };

  useEffect(() => {
    if (isBookDropdownOpen) {
      updateBookDropdownPosition();
      window.addEventListener('scroll', updateBookDropdownPosition, true);
      window.addEventListener('resize', updateBookDropdownPosition);
      return () => {
        window.removeEventListener('scroll', updateBookDropdownPosition, true);
        window.removeEventListener('resize', updateBookDropdownPosition);
      };
    }
    setBookDropdownPosition(null);
  }, [isBookDropdownOpen]);

  useEffect(() => {
    const handleClickOutsideBooks = (event: MouseEvent) => {
      const t = event.target as Node;
      if (
        isBookDropdownOpen &&
        bookDropdownButtonRef.current &&
        !bookDropdownButtonRef.current.contains(t) &&
        bookDropdownPortalRef.current &&
        !bookDropdownPortalRef.current.contains(t)
      ) {
        setIsBookDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideBooks);
    return () => document.removeEventListener('mousedown', handleClickOutsideBooks);
  }, [isBookDropdownOpen]);

  useEffect(() => {
    function handleClickOutsideParticipants(event: MouseEvent) {
      if (
        participantDropdownRef.current &&
        !participantDropdownRef.current.contains(event.target as Node)
      ) {
        setIsParticipantDropdownOpen(false);
      }
    }

    if (isParticipantDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutsideParticipants);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutsideParticipants);
    };
  }, [isParticipantDropdownOpen]);

  const tabFromQuery = searchParams.get('tab');
  const planLectureFromQuery = searchParams.get('planLecture');

  useEffect(() => {
    if (!regionId || regionLoading || !region) return;
    if (!tabFromQuery && !planLectureFromQuery) return;

    if (tabFromQuery === 'lessons') {
      setActiveTab('lessons');
    }

    if (planLectureFromQuery) {
      const name = decodeURIComponent(planLectureFromQuery).trim();
      if (name) {
        setScheduleLecture(name);
        setEditingSchedule(null);
        setIsLectureFixed(true);
        setScheduleParticipantIds([]);
        const allTeach = allUsers.filter((u) => u.role === 'teacher');
        const regTeach = allTeach.filter((u) =>
          (u.regionIds ?? []).includes(regionId || ''),
        );
        const defaultTeacher = regTeach[0]?.id || allTeach[0]?.id || '';
        setScheduleTeacherId(defaultTeacher);
        setScheduleDays([]);
        setScheduleStartDate(null);
        setScheduleEndDate(null);
        setScheduleStartTime('');
        setScheduleEndTime('');
        setShowScheduleModal(true);
      }
    }

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('planLecture');
        next.delete('tab');
        return next;
      },
      { replace: true },
    );
  }, [
    regionId,
    region,
    regionLoading,
    tabFromQuery,
    planLectureFromQuery,
    allUsers,
    setSearchParams,
  ]);

  const handleAssignUser = async () => {
    if (selectedUserIds.length === 0 || !regionId) return;

    try {
      showLoading('Kullanıcılar bölgeye ekleniyor...');

      const regionKey = regionId;

      await Promise.all(
        selectedUserIds.map((userId) => {
          const user = allUsers.find((u) => u.id === userId);
          const currentIds = user?.regionIds ?? [];
          const alreadyInRegion = currentIds.includes(regionKey || '');

          let nextIds: string[];
          if (user?.role === 'teacher') {
            nextIds = alreadyInRegion
              ? currentIds
              : [...currentIds, regionKey || ''];
          } else {
            // Normal kullanıcı: yalnızca tek bölge
            nextIds = [regionKey || ''];
          }

          return firestoreHelpers.update<User>('users', userId, {
            regionIds: nextIds,
          });
        })
      );

      setSelectedUserIds([]);
      setIsUserDropdownOpen(false);
      hideLoading();
      // await showSuccess('Seçili kullanıcılar başarıyla bölgeye eklendi!');
    } catch (err) {
      console.error(err);
      hideLoading();
      await showError('Kullanıcı eklenirken bir hata oluştu!');
    }
  };

  const handleRemoveFromRegion = async (userId: string) => {
    if (!regionId) return;

    try {
      const confirmed = await showConfirm(
        'Bu kullanıcıyı bu bölgeden çıkarmak istediğinizden emin misiniz?',
        'Kullanıcıyı Bölgeden Çıkar',
        {
          confirmButtonText: 'Evet, Çıkar',
          cancelButtonText: 'İptal',
          icon: 'warning',
        }
      );

      if (!confirmed) return;

      showLoading('Kullanıcı bölgeden çıkarılıyor...');
      const user = allUsers.find((u) => u.id === userId);
      const currentIds = user?.regionIds ?? [];
      const regionKey = regionId;
      const nextIds = currentIds.filter((id) => id !== regionKey);

      await firestoreHelpers.update<User>('users', userId, {
        regionIds: nextIds,
      });
      hideLoading();
      // await showSuccess('Kullanıcı bölgeden çıkarıldı.');
    } catch (err) {
      console.error(err);
      hideLoading();
      await showError('Kullanıcı bölgeden çıkarılırken bir hata oluştu.');
    }
  };

  const canEditRegionLectureList = isAdmin || isRegionSupervisor;

  const handleRemoveLectureDefinitionFromRegion = async (lectureName: string) => {
    if (!regionId || !region) return;
    if (!canEditRegionLectureList) return;

    const confirmed = await showConfirm(
      `"${lectureName}" dersini bu bölgenin tanımlı ders listesinden kaldırmak istiyor musunuz? Bu ders için henüz plan oluşturulmadı; isterseniz sonra yeniden ekleyebilirsiniz.`,
      'Ders tanımını kaldır',
      {
        confirmButtonText: 'Kaldır',
        cancelButtonText: 'İptal',
        icon: 'warning',
        confirmButtonColor: '#dc2626',
      },
    );
    if (!confirmed) return;

    try {
      showLoading('Ders tanımı kaldırılıyor...');
      const cur = (region.lectures ?? []).filter(Boolean);
      const next = cur.filter((n) => n !== lectureName);
      await firestoreHelpers.update<Region>('regions', regionId, {
        lectures: next,
      });
      hideLoading();
    } catch (err) {
      console.error(err);
      hideLoading();
      await showError('Ders tanımı kaldırılırken bir hata oluştu.');
    }
  };

  if (!regionId) {
    return (
      <div className="space-y-4">
        <p className="text-red-600">Geçersiz bölge ID.</p>
      </div>
    );
  }

  const handleDeleteRegion = async () => {
    if (!regionId) return;
    try {
      const confirmed = await showConfirm(
        'Bu bölgeyi tamamen silmek istediğinizden emin misiniz? Kullanıcılar, kitaplar ve ders planları bu bölgeden çıkarılacak. Bu işlem geri alınamaz.',
        'Bölgeyi Sil',
        {
          confirmButtonText: 'Evet, Sil',
          cancelButtonText: 'İptal',
          icon: 'warning',
        }
      );
      if (!confirmed) return;

      showLoading('Bölge siliniyor...');
      const regionKey = regionId;

      // 1. Ders planları: Katılım kayıtlarını sil, kullanıcıları planlardan çıkar, planları sil
      for (const schedule of schedules ?? []) {
        const attendanceRecords = await firestoreHelpers.getAll<{ id: string }>(
          'userLectureAttendance',
          [where('scheduleId', '==', schedule.id)]
        );
        await Promise.all(
          attendanceRecords.map((rec) =>
            firestoreHelpers.delete('userLectureAttendance', rec.id)
          )
        );

        const participantIds = schedule.participantUserIds ?? [];
        for (const uid of participantIds) {
          const user = allUsers.find((u) => u.id === uid);
          if (!user || user.role !== 'user') continue;
          const currentLectures = user.userLectureIds ?? [];
          const nextLectures = currentLectures.filter((id) => id !== schedule.id);
          await firestoreHelpers.update<User>('users', uid, {
            userLectureIds: nextLectures,
          });
        }

        await firestoreHelpers.delete('regionLectureSchedules', schedule.id);
      }

      // 2. Kullanıcıları bölgeden çıkar
      await Promise.all(
        regionUsers.map((user) => {
          const currentIds = user.regionIds ?? [];
          const nextIds = currentIds.filter((id) => id !== regionKey);
          return firestoreHelpers.update<User>('users', user.id, {
            regionIds: nextIds,
          });
        })
      );

      // 3. Kitapları bölgeden çıkar
      await Promise.all(
        regionBooks.map((book) => {
          const currentIds = book.regionIds ?? [];
          const nextIds = currentIds.filter((id) => id !== regionKey);
          return firestoreHelpers.update<Book>('books', book.id, {
            regionIds: nextIds,
          });
        })
      );

      // 4. Bölgeyi sil
      await firestoreHelpers.delete('regions', regionId);
      hideLoading();
      // await showSuccess('Bölge ve tüm ilişkileri silindi.');
      navigate('/regions');
    } catch (err) {
      console.error(err);
      hideLoading();
      await showError('Bölge silinirken bir hata oluştu.');
    }
  };

  if (regionLoading || !region) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          ← Geri
        </button>
        <p className="text-gray-600">Bölge yükleniyor...</p>
      </div>
    );
  }

  if (
    isRegionSupervisor &&
    (!supervisorRegionId || regionId !== supervisorRegionId)
  ) {
    return <Navigate to="/lessons" replace />;
  }

  return (
    <div className="space-y-6 animate-fade-in min-w-0 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">{region.name}</h1>
          {region.description && (
            <p className="text-gray-500 mt-1 max-w-2xl text-sm line-clamp-2">{region.description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => navigate(isAdmin ? '/regions' : '/lessons')}
          className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors flex-shrink-0 self-start sm:self-center"
        >
          ← Geri
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-soft">
        <div className="border-b border-gray-200 px-4 pt-4 pb-4">
          <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1 text-sm font-medium w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`flex-1 px-3 py-2 rounded-lg transition-colors ${
                activeTab === 'users'
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Kullanıcılar
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('lessons')}
              className={`flex-1 px-3 py-2 rounded-lg transition-colors ${
                activeTab === 'lessons'
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Dersler
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('books')}
              className={`flex-1 px-3 py-2 rounded-lg transition-colors ${
                activeTab === 'books'
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Kitaplar
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Bölgeye Kullanıcı Ekle
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      ref={userDropdownButtonRef}
                      onClick={() => {
                        setIsUserDropdownOpen((prev) => {
                          const next = !prev;
                          if (next && userDropdownButtonRef.current) {
                            const rect = userDropdownButtonRef.current.getBoundingClientRect();
                            setUserDropdownPosition({
                              top: rect.bottom + 4,
                              left: rect.left,
                              width: rect.width,
                            });
                          } else if (!next) {
                            setUserDropdownPosition(null);
                          }
                          return next;
                        });
                      }}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-left flex items-center gap-2 hover:bg-gray-50 transition-colors"
                      disabled={usersLoading}
                    >
                      <div className="flex-1 flex flex-wrap items-center gap-1 min-h-[1.75rem]">
                        {selectedUsersForDisplay.length === 0 ? (
                          <span className="text-sm text-gray-400">
                            {usersLoading ? 'Kullanıcılar yükleniyor...' : 'Kullanıcı seçin'}
                          </span>
                        ) : (
                          selectedUsersForDisplay.map((user) => (
                            <span
                              key={user.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-xs border border-primary-200"
                            >
                              <span className="max-w-[120px] truncate">
                                {user.name} {user.lastname}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedUserIds((prev) =>
                                    prev.filter((id) => id !== user.id)
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
                      <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
                        {selectedUserIds.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedUserIds([]);
                            }}
                            className="text-gray-400 hover:text-gray-600 text-xs"
                          >
                            ✕
                          </button>
                        )}
                        <span className="text-gray-400 text-xs">▼</span>
                      </div>
                    </button>

                    {isUserDropdownOpen &&
                      userDropdownPosition &&
                      createPortal(
                        <div
                          ref={userDropdownPortalRef}
                          className="fixed z-[9999] border border-gray-200 rounded-xl bg-white shadow-xl flex flex-col max-h-72 overflow-hidden"
                          style={{
                            top: userDropdownPosition.top,
                            left: userDropdownPosition.left,
                            width: userDropdownPosition.width,
                          }}
                        >
                          <div className="px-3 pt-2 pb-2 border-b border-gray-100 shrink-0">
                            <input
                              type="text"
                              placeholder="Kullanıcı ara..."
                              value={userSearch}
                              onChange={(e) => setUserSearch(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                              disabled={usersLoading}
                            />
                          </div>
                          <div className="max-h-56 overflow-y-auto min-h-0">
                            {usersLoading ? (
                              <p className="px-4 py-3 text-xs text-gray-500">
                                Kullanıcılar yükleniyor...
                              </p>
                            ) : filteredAvailableUsers.length === 0 ? (
                              <p className="px-4 py-3 text-xs text-gray-500">
                                Uygun kullanıcı bulunamadı.
                              </p>
                            ) : (
                              <ul className="py-1">
                                {filteredAvailableUsers.map((user) => {
                                  const checked = selectedUserIds.includes(user.id);
                                  return (
                                    <li
                                      key={user.id}
                                      className="px-3 py-1.5 flex items-center gap-2 hover:bg-gray-50 cursor-pointer"
                                      onClick={() => {
                                        setSelectedUserIds((prev) =>
                                          checked
                                            ? prev.filter((id) => id !== user.id)
                                            : [...prev, user.id]
                                        );
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => {
                                          setSelectedUserIds((prev) =>
                                            checked
                                              ? prev.filter((id) => id !== user.id)
                                              : [...prev, user.id]
                                          );
                                        }}
                                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <div className="flex flex-col">
                                        <span className="text-xs font-medium text-gray-900">
                                          {user.name} {user.lastname}{' '}
                                          {user.role === 'teacher' && (
                                            <span className="text-[11px] text-emerald-600">
                                              (Hoca)
                                            </span>
                                          )}
                                        </span>
                                        <span className="text-[11px] text-gray-500">
                                          {user.email}
                                        </span>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        </div>,
                        document.body,
                      )}
                  </div>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={handleAssignUser}
                    disabled={selectedUserIds.length === 0}
                    className="px-4 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all font-medium shadow-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Seçili Kullanıcıları Ekle
                  </button>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">
                  Bölgedeki Kullanıcılar
                </h2>
                <div className="bg-white rounded-xl">
                  {usersLoading ? (
                    <p className="text-gray-600 text-sm">Kullanıcılar yükleniyor...</p>
                  ) : regionUsers.length === 0 ? (
                    <p className="text-gray-500 text-sm">
                      Bu bölgeye atanmış kullanıcı bulunmuyor.
                    </p>
                  ) : (
                    <ul className="divide-y divide-gray-200 overflow-hidden">
                      {[...regionUsers]
                        .sort((a, b) => {
                          const roleOrder: Record<string, number> = {
                            admin: 0,
                            teacher: 1,
                            user: 2,
                          };
                          const aRank = roleOrder[a.role] ?? 3;
                          const bRank = roleOrder[b.role] ?? 3;
                          if (aRank !== bRank) {
                            return aRank - bRank;
                          }
                          return (a.name || '').localeCompare(b.name || '');
                        })
                        .map((user) => (
                          <li
                            key={user.id}
                            className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-gray-900 truncate">
                                {user.name} {user.lastname}
                              </div>
                              <div className="text-xs text-gray-500 truncate">{user.email}</div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${
                                  user.role === 'admin'
                                    ? 'bg-blue-100 text-blue-700 border-blue-200'
                                    : user.role === 'teacher'
                                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-100 text-amber-700 border-amber-200'
                                }`}
                              >
                                {user.role === 'admin'
                                  ? 'Admin'
                                  : user.role === 'teacher'
                                  ? 'Hoca'
                                  : 'Kullanıcı'}
                              </span>
                              {user.role !== 'admin' && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFromRegion(user.id)}
                                  className="px-2.5 py-1 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors whitespace-nowrap"
                                >
                                  Bölgeden Çıkar
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => navigate(`/users/${user.id}`)}
                                className="px-2.5 py-1 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap"
                              >
                                Detay
                              </button>
                            </div>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'books' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Bölgeye Kitap Ekle
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      ref={bookDropdownButtonRef}
                      onClick={() => {
                        setIsBookDropdownOpen((prev) => {
                          const next = !prev;
                          if (next && bookDropdownButtonRef.current) {
                            const rect = bookDropdownButtonRef.current.getBoundingClientRect();
                            setBookDropdownPosition({
                              top: rect.bottom + 4,
                              left: rect.left,
                              width: rect.width,
                            });
                          } else if (!next) {
                            setBookDropdownPosition(null);
                          }
                          return next;
                        });
                      }}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-left flex items-center gap-2 hover:bg-gray-50 transition-colors"
                      disabled={booksLoading}
                    >
                      <div className="flex-1 flex flex-wrap items-center gap-1 min-h-[1.75rem]">
                        {selectedBookIds.length === 0 ? (
                          <span className="text-sm text-gray-400">
                            {booksLoading ? 'Kitaplar yükleniyor...' : 'Kitap seçin'}
                          </span>
                        ) : (
                          selectedBookIds
                            .map((id) => allBooks.find((b) => b.id === id))
                            .filter(Boolean)
                            .map((book) => (
                              <span
                                key={book!.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-xs border border-primary-200"
                              >
                                <span className="max-w-[140px] truncate">
                                  {book!.title}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedBookIds((prev) =>
                                      prev.filter((bid) => bid !== book!.id)
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
                      <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
                        {selectedBookIds.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBookIds([]);
                            }}
                            className="text-gray-400 hover:text-gray-600 text-xs"
                          >
                            ✕
                          </button>
                        )}
                        <span className="text-gray-400 text-xs">▼</span>
                      </div>
                    </button>

                    {isBookDropdownOpen &&
                      bookDropdownPosition &&
                      createPortal(
                        <div
                          ref={bookDropdownPortalRef}
                          className="fixed z-[9999] border border-gray-200 rounded-xl bg-white shadow-xl flex flex-col max-h-72 overflow-hidden"
                          style={{
                            top: bookDropdownPosition.top,
                            left: bookDropdownPosition.left,
                            width: bookDropdownPosition.width,
                          }}
                        >
                          <div className="px-3 pt-2 pb-2 border-b border-gray-100 shrink-0">
                            <input
                              type="text"
                              placeholder="Kitap, yazar veya ISBN ara..."
                              value={bookSearch}
                              onChange={(e) => setBookSearch(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                              disabled={booksLoading}
                            />
                          </div>
                          <div className="max-h-56 overflow-y-auto min-h-0">
                            {booksLoading ? (
                              <p className="px-4 py-3 text-xs text-gray-500">
                                Kitaplar yükleniyor...
                              </p>
                            ) : filteredAvailableBooks.length === 0 ? (
                              <p className="px-4 py-3 text-xs text-gray-500">
                                Uygun kitap bulunamadı.
                              </p>
                            ) : (
                              <ul className="py-1">
                                {filteredAvailableBooks.map((book) => {
                                  const checked = selectedBookIds.includes(book.id);
                                  return (
                                    <li
                                      key={book.id}
                                      className="px-3 py-1.5 flex items-center gap-2 hover:bg-gray-50 cursor-pointer"
                                      onClick={() => {
                                        setSelectedBookIds((prev) =>
                                          checked
                                            ? prev.filter((id) => id !== book.id)
                                            : [...prev, book.id]
                                        );
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => {
                                          setSelectedBookIds((prev) =>
                                            checked
                                              ? prev.filter((id) => id !== book.id)
                                              : [...prev, book.id]
                                          );
                                        }}
                                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <div className="flex flex-col">
                                        <span className="text-xs font-medium text-gray-900">
                                          {book.title}
                                        </span>
                                        <span className="text-[11px] text-gray-500">
                                          {book.author}
                                        </span>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        </div>,
                        document.body,
                      )}
                  </div>
                </div>
                <div>
                  <button
                    type="button"
                    disabled={selectedBookIds.length === 0}
                    onClick={async () => {
                      if (selectedBookIds.length === 0 || !regionId) return;
                      try {
                        showLoading('Kitaplar bölgeye ekleniyor...');
                        await Promise.all(
                          selectedBookIds.map((bookId) => {
                            const book = allBooks.find((b) => b.id === bookId);
                            const currentIds = book?.regionIds ?? [];
                            if (currentIds.includes(regionId)) {
                              return Promise.resolve();
                            }
                            return firestoreHelpers.update<Book>('books', bookId, {
                              regionIds: [...currentIds, regionId],
                            });
                          })
                        );
                        setSelectedBookIds([]);
                        setIsBookDropdownOpen(false);
                        hideLoading();
                        // await showSuccess('Seçili kitaplar bölgeye eklendi.');
                      } catch (err) {
                        console.error(err);
                        hideLoading();
                        await showError('Kitap eklenirken bir hata oluştu.');
                      }
                    }}
                    className="px-4 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all font-medium shadow-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Seçili Kitapları Ekle
                  </button>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">
                  Bölgedeki Kitaplar
                </h2>
                <div className="bg-white rounded-xl">
                  {booksLoading ? (
                    <p className="text-gray-600 text-sm">Kitaplar yükleniyor...</p>
                  ) : regionBooks.length === 0 ? (
                    <p className="text-gray-500 text-sm">
                      Bu bölgeye atanmış kitap bulunmuyor.
                    </p>
                  ) : (
                    <ul className="divide-y divide-gray-200">
                      {regionBooks.map((book) => (
                        <li
                          key={book.id}
                          className="py-3 flex items-center justify-between gap-4"
                        >
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {book.title}
                            </div>
                            <div className="text-xs text-gray-500">
                              {book.author}
                              {book.isbn ? ` • ISBN: ${book.isbn}` : ''}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!regionId) return;
                              try {
                                const confirmed = await showConfirm(
                                  'Bu kitabı bu bölgeden çıkarmak istediğinizden emin misiniz?',
                                  'Kitabı Bölgeden Çıkar',
                                  {
                                    confirmButtonText: 'Evet, Çıkar',
                                    cancelButtonText: 'İptal',
                                    icon: 'warning',
                                  }
                                );
                                if (!confirmed) return;
                                showLoading('Kitap bölgeden çıkarılıyor...');
                                const currentIds = book.regionIds ?? [];
                                const nextIds = currentIds.filter((id) => id !== regionId);
                                await firestoreHelpers.update<Book>('books', book.id, {
                                  regionIds: nextIds,
                                });
                                hideLoading();
                                // await showSuccess('Kitap bölgeden çıkarıldı.');
                              } catch (err) {
                                console.error(err);
                                hideLoading();
                                await showError('Kitap bölgeden çıkarılırken bir hata oluştu.');
                              }
                            }}
                            className="px-3 py-1 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                          >
                            Bölgeden Çıkar
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'lessons' && (
            <div className="space-y-8">
              <div className="border-t border-dashed border-gray-200 pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Ders Planları</h2>
                  <p className="text-xs text-gray-500">
                    Haftalık tekrar eden ders planları oluşturun. Yeni planda sistemdeki
                    aktif derslerden seçim yapılır.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setScheduleLecture('');
                    setEditingSchedule(null);
                    setIsLectureFixed(false);
                    setScheduleParticipantIds([]);
                    const defaultTeacher =
                      regionTeachers[0]?.id || allTeachers[0]?.id || '';
                    setScheduleTeacherId(defaultTeacher);
                    setScheduleDays([]);
                    setScheduleStartDate(null);
                    setScheduleEndDate(null);
                    setScheduleStartTime('');
                    setScheduleEndTime('');
                    setShowScheduleModal(true);
                  }}
                  disabled={activeLessonsForSchedule.length === 0}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  Ders planla
                </button>
              </div>
              {activeLessonsForSchedule.length === 0 && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                  Sistemde aktif ders tanımı yok. Önce <strong>Dersler</strong> sayfasından ders
                  ekleyip aktif edin.
                </p>
              )}

              {regionLectureNames.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-4 py-10 text-center">
                  <p className="text-sm text-gray-600">
                    Bu bölgede henüz planlanmış ders yok.
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    <strong>Ders planla</strong> ile ders seçip plan oluşturabilirsiniz.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {regionLectureNames.map((lectureName) => {
                    const lectureMeta = (lessons ?? []).find(
                      (l) => l.name === lectureName
                    );
                    const lectureSchedules = schedules.filter(
                      (s) => s.lectureName === lectureName
                    );
                    return (
                      <div
                        key={lectureName}
                        className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="min-w-0 flex-1 pr-1">
                            <h3 className="text-sm font-semibold text-gray-900">
                              {lectureName}
                            </h3>
                            {lectureMeta?.description && (
                              <p className="text-xs text-gray-500">
                                {lectureMeta.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setScheduleLecture(lectureName);
                                setEditingSchedule(null);
                                setIsLectureFixed(true);
                                setScheduleParticipantIds([]);
                                const defaultTeacher =
                                  regionTeachers[0]?.id || allTeachers[0]?.id || '';
                                setScheduleTeacherId(defaultTeacher);
                                setScheduleDays([]);
                                setScheduleStartDate(null);
                                setScheduleEndDate(null);
                                setScheduleStartTime('');
                                setScheduleEndTime('');
                                setShowScheduleModal(true);
                              }}
                              className="px-3 py-1.5 text-[11px] font-medium rounded-lg border border-primary-200 text-primary-700 bg-white hover:bg-primary-50 transition-colors"
                            >
                              Plan Ekle
                            </button>
                            {lectureSchedules.length === 0 &&
                              canEditRegionLectureList && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleRemoveLectureDefinitionFromRegion(
                                      lectureName,
                                    )
                                  }
                                  className="p-1.5 rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50 transition-colors"
                                  title="Planı olmayan ders tanımını bölgeden kaldır"
                                  aria-label="Ders tanımını kaldır"
                                >
                                  <HiX className="w-5 h-5" />
                                </button>
                              )}
                          </div>
                        </div>

                        {schedulesLoading ? (
                          <p className="text-xs text-gray-500">
                            Ders planları yükleniyor...
                          </p>
                        ) : lectureSchedules.length === 0 ? (
                          <p className="text-xs text-gray-400">
                            Bu ders için tanımlı bir plan yok.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {lectureSchedules.map((schedule) => (
                              <div
                                key={schedule.id}
                                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg bg-white border border-gray-200 px-3 py-2"
                              >
                                <div className="flex flex-col gap-1 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="flex flex-wrap gap-1">
                                      {dayLabels
                                        .filter((d) => schedule.daysOfWeek.includes(d.value))
                                        .map((d) => (
                                          <span
                                            key={d.value}
                                            className="px-2 py-0.5 text-[11px] rounded-full bg-primary-50 text-primary-700 border border-primary-100"
                                          >
                                            {d.short}
                                          </span>
                                        ))}
                                    </div>
                                    <span className="text-[11px] text-gray-500">
                                      {formatTime(schedule.startTimeMinutes)} -{' '}
                                      {formatTime(schedule.endTimeMinutes)}
                                    </span>
                                    <span className="text-[11px] text-gray-400">
                                      {schedule.startDate.toDate().toLocaleDateString()} -{' '}
                                      {schedule.endDate.toDate().toLocaleDateString()}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-gray-600">
                                    {(() => {
                                      const teacher = allTeachers.find(
                                        (t) => t.id === schedule.teacherId
                                      );
                                      if (!teacher) return 'Hoca: -';
                                      return `Hoca: ${teacher.name} ${
                                        teacher.lastname ?? ''
                                      }`;
                                    })()}
                                  </div>
                                  <div className="text-[11px] text-gray-500">
                                    {(() => {
                                      const participants = regionParticipantUsers.filter(
                                        (u) =>
                                          (schedule.participantUserIds ?? []).includes(
                                            u.id
                                          ),
                                      );
                                      if (!participants.length)
                                        return 'Katılımcılar: -';
                                      const names = participants
                                        .slice(0, 3)
                                        .map((u) => u.name)
                                        .join(', ');
                                      const extra =
                                        participants.length > 3
                                          ? ` +${participants.length - 3}`
                                          : '';
                                      return `Katılımcılar: ${names}${extra}`;
                                    })()}
                                  </div>
                                </div>
                                <div className="flex flex-row sm:flex-col items-center justify-center gap-2 sm:ml-3">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingSchedule(schedule);
                                      setScheduleLecture(schedule.lectureName);
                                      setIsLectureFixed(true);
                                      setScheduleTeacherId(schedule.teacherId);
                                      setScheduleParticipantIds(
                                        (schedule.participantUserIds ?? []).filter(
                                          (id) =>
                                            allUsers.find((x) => x.id === id)?.role ===
                                            'user',
                                        ),
                                      );
                                      setScheduleDays(schedule.daysOfWeek);
                                      setScheduleStartDate(schedule.startDate.toDate());
                                      setScheduleEndDate(schedule.endDate.toDate());
                                      const toTime = (mins: number) => {
                                        const h = Math.floor(mins / 60)
                                          .toString()
                                          .padStart(2, '0');
                                        const m = (mins % 60).toString().padStart(2, '0');
                                        return `${h}:${m}`;
                                      };
                                      setScheduleStartTime(
                                        toTime(schedule.startTimeMinutes)
                                      );
                                      setScheduleEndTime(toTime(schedule.endTimeMinutes));
                                      setShowScheduleModal(true);
                                    }}
                                    className="p-1.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                                  >
                                    <HiPencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        const confirmed = await showConfirm(
                                          'Bu ders planını silmek istediğinizden emin misiniz?',
                                          'Ders Planını Sil',
                                          {
                                            confirmButtonText: 'Evet, Sil',
                                            cancelButtonText: 'İptal',
                                            icon: 'warning',
                                          }
                                        );
                                        if (!confirmed) return;
                                        showLoading('Ders planı siliniyor...');
                                        await firestoreHelpers.delete(
                                          'regionLectureSchedules',
                                          schedule.id
                                        );
                                        hideLoading();
                                        // await showSuccess('Ders planı silindi.');
                                      } catch (err) {
                                        console.error(err);
                                        hideLoading();
                                        await showError(
                                          'Ders planı silinirken bir hata oluştu.'
                                        );
                                      }
                                    }}
                                    className="p-1.5 rounded-full border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                                  >
                                    <HiTrash className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {isAdmin && (
          <section className="p-4 sm:p-6 pt-8 border-t border-gray-200 flex justify-end">
            <button
              type="button"
              onClick={handleDeleteRegion}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors"
            >
              <HiTrash className="w-5 h-5" />
              Bölgeyi sil
            </button>
          </section>
        )}
      </div>

      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-large p-6 space-y-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingSchedule ? 'Ders Planını Düzenle' : 'Ders Planı Oluştur'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowScheduleModal(false);
                  setEditingSchedule(null);
                  setIsLectureFixed(false);
                  setScheduleParticipantIds([]);
                }}
                className="text-gray-400 hover:text-gray-600"
                disabled={scheduleSubmitting}
              >
                ✕
              </button>
            </div>

            <form
              lang="tr"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!regionId || !scheduleLecture) return;
                if (!scheduleTeacherId) {
                  await showError('Lütfen bir hoca seçin.');
                  return;
                }
                if (!scheduleStartDate || !scheduleEndDate || !scheduleStartTime || !scheduleEndTime) {
                  await showError('Lütfen tarih ve saat alanlarını doldurun.');
                  return;
                }
                if (scheduleDays.length === 0) {
                  await showError('Lütfen en az bir gün seçin.');
                  return;
                }

                try {
                  setScheduleSubmitting(true);
                  showLoading(
                    editingSchedule ? 'Ders planı güncelleniyor...' : 'Ders planı ekleniyor...'
                  );

                  const teacher = allTeachers.find(
                    (t) => t.id === scheduleTeacherId
                  );
                  const currentTeacherRegions = teacher?.regionIds ?? [];
                  const isTeacherOfRegion = currentTeacherRegions.includes(regionId);

                  // Seçilen hoca bu bölgenin hocası değilse, önce bu bölgeye ekle
                  if (!isTeacherOfRegion) {
                    await firestoreHelpers.update<User>( 'users', scheduleTeacherId, {
                      regionIds: [...currentTeacherRegions, regionId],
                    });
                  }

                  const startDate = Timestamp.fromDate(scheduleStartDate);
                  const endDate = Timestamp.fromDate(scheduleEndDate);

                  const [startHour, startMinute] = scheduleStartTime.split(':').map(Number);
                  const [endHour, endMinute] = scheduleEndTime.split(':').map(Number);
                  const startMinutes = startHour * 60 + startMinute;
                  const endMinutes = endHour * 60 + endMinute;

                  const participantUserIdsSanitized = scheduleParticipantIds.filter(
                    (id) => allUsers.find((x) => x.id === id)?.role === 'user',
                  );

                  const payload: Omit<RegionLectureSchedule, 'id'> = {
                    regionId,
                    lectureName: scheduleLecture,
                    teacherId: scheduleTeacherId,
                    participantUserIds: participantUserIdsSanitized,
                    daysOfWeek: scheduleDays.slice().sort((a, b) => a - b),
                    startDate,
                    endDate,
                    startTimeMinutes: startMinutes,
                    endTimeMinutes: endMinutes,
                    createdAt: Timestamp.now(),
                  };

                  let scheduleId = editingSchedule?.id;

                  if (editingSchedule) {
                    await firestoreHelpers.update<RegionLectureSchedule>(
                      'regionLectureSchedules',
                      editingSchedule.id,
                      payload
                    );
                  } else {
                    scheduleId = await firestoreHelpers.add<RegionLectureSchedule>(
                      'regionLectureSchedules',
                      payload
                    );
                  }

                  if (!editingSchedule && scheduleLecture) {
                    const cur = (region?.lectures ?? []).filter(Boolean);
                    if (!cur.includes(scheduleLecture)) {
                      await firestoreHelpers.update<Region>('regions', regionId, {
                        lectures: [...cur, scheduleLecture],
                      });
                    }
                  }

                  if (scheduleId) {
                    const prevIds =
                      editingSchedule?.participantUserIds ?? [];
                    const nextIds = participantUserIdsSanitized;

                    const toAdd = nextIds.filter((id) => !prevIds.includes(id));
                    const toRemove = prevIds.filter((id) => !nextIds.includes(id));

                    await Promise.all([
                      ...toAdd.map((uid) => {
                        const user = allUsers.find((u) => u.id === uid);
                        if (user?.role !== 'user') return Promise.resolve();
                        const current = user?.userLectureIds ?? [];
                        if (current.includes(scheduleId!)) return Promise.resolve();
                        return firestoreHelpers.update<User>('users', uid, {
                          userLectureIds: [...current, scheduleId!],
                        });
                      }),
                      ...toRemove.map((uid) => {
                        const user = allUsers.find((u) => u.id === uid);
                        if (user?.role !== 'user') return Promise.resolve();
                        const current = user?.userLectureIds ?? [];
                        if (!current.includes(scheduleId!)) return Promise.resolve();
                        return firestoreHelpers.update<User>('users', uid, {
                          userLectureIds: current.filter((id) => id !== scheduleId),
                        });
                      }),
                    ]);
                  }

                  setShowScheduleModal(false);
                  setEditingSchedule(null);
                  setIsLectureFixed(false);
                  setScheduleParticipantIds([]);
                  setScheduleTeacherId('');
                  setScheduleDays([]);
                  setScheduleStartDate(null);
                  setScheduleEndDate(null);
                  setScheduleStartTime('');
                  setScheduleEndTime('');
                  hideLoading();
                  await showSuccess(
                    editingSchedule
                      ? 'Ders planı başarıyla güncellendi.'
                      : 'Ders planı başarıyla eklendi.'
                  );
                } catch (err) {
                  console.error(err);
                  hideLoading();
                  await showError('Ders planı eklenirken bir hata oluştu.');
                } finally {
                  setScheduleSubmitting(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Dersler
                </label>
                {isLectureFixed || editingSchedule ? (
                  <div className="px-4 py-2.5 border border-gray-100 rounded-xl text-sm bg-gray-50 text-gray-700">
                    {scheduleLecture || 'Seçilmedi'}
                  </div>
                ) : (
                  <select
                    value={scheduleLecture}
                    onChange={(e) => setScheduleLecture(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    disabled={scheduleSubmitting || activeLessonsForSchedule.length === 0}
                    required
                  >
                    <option value="">Ders seçin</option>
                    {activeLessonsForSchedule.map((lesson) => (
                      <option key={lesson.id} value={lesson.name}>
                        {lesson.name}
                        {lesson.description ? ` — ${lesson.description}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Hoca
                </label>
                <select
                  value={scheduleTeacherId}
                  onChange={(e) => setScheduleTeacherId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-3"
                  disabled={scheduleSubmitting}
                  required
                >
                  <option value="">Hoca seçin</option>
                  {allTeachers.map((t) => {
                    const isRegionTeacher = (t.regionIds ?? []).includes(regionId);
                    return (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.lastname} {isRegionTeacher ? '(Bu bölgenin hocası)' : ''}
                      </option>
                    );
                  })}
                </select>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Katılımcı Kullanıcılar
                </label>
                <div className="relative mb-3" ref={participantDropdownRef}>
                  <button
                    type="button"
                    onClick={() =>
                      setIsParticipantDropdownOpen((prev) => !prev)
                    }
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-left flex items-center gap-2 hover:bg-gray-50 transition-colors"
                    disabled={scheduleSubmitting}
                  >
                    <div className="flex-1 flex flex-wrap items-center gap-1 min-h-[1.75rem]">
                      {scheduleParticipantIds.length === 0 ? (
                        <span className="text-sm text-gray-400">
                          Katılımcı seçilmedi
                        </span>
                      ) : (
                        selectedParticipantsForDisplay.map((u) => (
                          <span
                            key={u.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-[11px] border border-primary-200"
                          >
                            <span className="max-w-[120px] truncate">
                              {u.name} {u.lastname}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setScheduleParticipantIds((prev) =>
                                  prev.filter((id) => id !== u.id)
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
                    <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
                      {scheduleParticipantIds.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setScheduleParticipantIds([]);
                          }}
                          className="text-gray-400 hover:text-gray-600 text-xs"
                        >
                          ✕
                        </button>
                      )}
                      <span className="text-gray-400 text-xs">▼</span>
                    </div>
                  </button>
                  {isParticipantDropdownOpen && (
                    <div className="absolute z-30 mt-1 w-full border border-gray-200 rounded-xl bg-white shadow-lg">
                      <div className="px-3 pt-2 pb-2 border-b border-gray-100">
                        <input
                          type="text"
                          placeholder="Kullanıcı ara..."
                          value={participantSearch}
                          onChange={(e) =>
                            setParticipantSearch(e.target.value)
                          }
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                          disabled={scheduleSubmitting}
                        />
                      </div>
                      <div className="max-h-56 overflow-y-auto">
                        <ul className="py-1">
                          <li
                            className="px-3 py-1.5 flex items-center gap-2 hover:bg-gray-50 cursor-pointer text-xs font-medium text-gray-800"
                            onClick={() => {
                              const allIds = regionParticipantUsers.map((u) => u.id);
                              const allSelected =
                                scheduleParticipantIds.length === allIds.length &&
                                allIds.length > 0 &&
                                allIds.every((id) =>
                                  scheduleParticipantIds.includes(id),
                                );
                              setScheduleParticipantIds(
                                allSelected ? [] : allIds
                              );
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={
                                regionParticipantUsers.length > 0 &&
                                scheduleParticipantIds.length ===
                                  regionParticipantUsers.length &&
                                regionParticipantUsers.every((u) =>
                                  scheduleParticipantIds.includes(u.id),
                                )
                              }
                              readOnly
                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span>Hepsi</span>
                          </li>
                          {filteredParticipants.map((u) => {
                            const checked = scheduleParticipantIds.includes(
                              u.id
                            );
                            return (
                              <li
                                key={u.id}
                                className="px-3 py-1.5 flex items-center gap-2 hover:bg-gray-50 cursor-pointer"
                                onClick={() => {
                                  setScheduleParticipantIds((prev) =>
                                    checked
                                      ? prev.filter((id) => id !== u.id)
                                      : [...prev, u.id]
                                  );
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    setScheduleParticipantIds((prev) =>
                                      checked
                                        ? prev.filter((id) => id !== u.id)
                                        : [...prev, u.id]
                                    );
                                  }}
                                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <div className="flex flex-col">
                                  <span className="text-xs font-medium text-gray-900">
                                    {u.name} {u.lastname}
                                  </span>
                                  <span className="text-[11px] text-gray-500">
                                    {u.email}
                                  </span>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Haftanın Günleri
                </label>
                <div className="grid grid-cols-7 gap-1">
                  {dayLabels.map((d) => {
                    const active = scheduleDays.includes(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() =>
                          setScheduleDays((prev) =>
                            active
                              ? prev.filter((val) => val !== d.value)
                              : [...prev, d.value]
                          )
                        }
                        className={`text-[11px] px-1.5 py-1 rounded-lg border ${
                          active
                            ? 'bg-primary-600 text-white border-primary-600'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                        disabled={scheduleSubmitting}
                      >
                        {d.short}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="text-sm font-semibold text-gray-700">
                      Başlangıç Tarihi
                    </label>
                    <button
                      type="button"
                      disabled={scheduleSubmitting}
                      onClick={() => {
                        const y = new Date().getFullYear();
                        setScheduleStartDate(new Date(y, 0, 1));
                      }}
                      className="text-[11px] font-medium px-2 py-0.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    >
                      Yıl başı
                    </button>
                  </div>
                  <div className="relative w-full">
                    <ReactDatePicker
                      selected={scheduleStartDate}
                      onChange={(date: Date | null) => setScheduleStartDate(date)}
                      locale={tr}
                      dateFormat="dd.MM.yyyy"
                      className="w-full pl-3 pr-10 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      disabled={scheduleSubmitting}
                      required
                      wrapperClassName="!block !w-full"
                    />
                    <HiCalendar className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="text-sm font-semibold text-gray-700">
                      Bitiş Tarihi
                    </label>
                    <button
                      type="button"
                      disabled={scheduleSubmitting}
                      onClick={() => {
                        const y = new Date().getFullYear();
                        setScheduleEndDate(new Date(y, 11, 31));
                      }}
                      className="text-[11px] font-medium px-2 py-0.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    >
                      Yıl sonu
                    </button>
                  </div>
                  <div className="relative w-full">
                    <ReactDatePicker
                      selected={scheduleEndDate}
                      onChange={(date: Date | null) => setScheduleEndDate(date)}
                      locale={tr}
                      dateFormat="dd.MM.yyyy"
                      className="w-full pl-3 pr-10 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      disabled={scheduleSubmitting}
                      required
                      wrapperClassName="!block !w-full"
                    />
                    <HiCalendar className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Başlangıç Saati
                  </label>
                  <input
                    type="time"
                    value={scheduleStartTime}
                    onChange={(e) => setScheduleStartTime(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    disabled={scheduleSubmitting}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Bitiş Saati
                  </label>
                  <input
                    type="time"
                    value={scheduleEndTime}
                    onChange={(e) => setScheduleEndTime(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    disabled={scheduleSubmitting}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  disabled={scheduleSubmitting}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={scheduleSubmitting}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {scheduleSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

