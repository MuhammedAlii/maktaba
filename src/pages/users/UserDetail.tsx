import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Timestamp, where } from 'firebase/firestore';
import { useCollection, useDocument, firestoreHelpers } from '../../hooks/useFirestore';
import {
  showError,
  showSuccess,
  showConfirm,
  showLoading,
  hideLoading,
} from '../../services/notificationService';
import { useAuth } from '../../contexts/AuthContext';
import {
  HiChartBar,
  HiBookOpen,
  HiBell,
  HiExclamation,
  HiPlus,
  HiX,
  HiArrowUp,
  HiCheck,
  HiTrash,
  HiOfficeBuilding,
  HiPencil,
  HiAcademicCap,
} from 'react-icons/hi';

interface Region {
  id: string;
  name: string;
  isActive?: boolean;
}

interface User {
  id: string;
  name: string;
  lastname?: string;
  username: string;
  email: string;
  role: string;
  regionIds?: string[];
  userLectureIds?: string[];
  isUserApproved?: boolean;
}

interface UserLectureAttendance {
  id: string;
  userId: string;
  regionId?: string;
  scheduleId: string;
  date: Timestamp;
  attended: boolean;
}

interface UserReadingProgress {
  id: string;
  userId: string;
  bookId: string;
  completedPages: number;
  totalPages: number;
}

interface Book {
  id: string;
  title: string;
  author: string;
  pageCount?: number;
  regionIds?: string[];
}

interface RegionLectureSchedule {
  id: string;
  regionId: string;
  lectureName: string;
  teacherId: string;
  participantUserIds?: string[];
  daysOfWeek: number[];
  startDate: Timestamp;
  endDate: Timestamp;
  startTimeMinutes: number;
  endTimeMinutes: number;
  createdAt?: Timestamp;
}

interface TeacherQualification {
  id: string;
  userId: string;
  fieldOfKnowledge: string;
  placeOfStudy: string;
  description: string;
  /** @deprecated Migrate to placeOfStudy + description */
  placeOfStudyAndDescription?: string;
}

const toLocalDateKey = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const SCHEDULE_DAY_SHORT: Record<number, string> = {
  1: 'Pzt',
  2: 'Sal',
  3: 'Çar',
  4: 'Per',
  5: 'Cum',
  6: 'Cmt',
  7: 'Paz',
};

function formatScheduleTimeMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export default function UserDetail() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const { isAdmin, user: authUser } = useAuth();
  const isRegionSupervisor = authUser?.role === 'regionSupervisor';
  const myRegionId = isRegionSupervisor ? authUser?.regionIds?.[0] : null;

  const {
    data: user,
    loading: userLoading,
    error: userError,
  } = useDocument<User>('users', userId || '');

  useEffect(() => {
    if (!isRegionSupervisor) return;
    if (userLoading) return;
    if (!user || !myRegionId) return;

    const userRegionIds = user.regionIds ?? [];
    if (!userRegionIds.includes(myRegionId)) {
      // Bölge dışındaki kullanıcıyı gösterme
      void showError('Bu kullanıcı başka bir bölgeye ait.', 'Erişim');
      navigate('/users', { replace: true });
    }
  }, [isRegionSupervisor, userLoading, user, myRegionId, navigate]);

  const { data: attendance } = useCollection<UserLectureAttendance>(
    'userLectureAttendance',
    userId ? [where('userId', '==', userId)] : [],
  );

  const { data: readingProgress } = useCollection<UserReadingProgress>(
    'userReadingProgress',
    userId ? [where('userId', '==', userId)] : [],
  );

  const { data: books } = useCollection<Book>('books');
  const { data: allUsers } = useCollection<User>('users');
  const { data: schedules } = useCollection<RegionLectureSchedule>(
    'regionLectureSchedules',
  );
  const { data: allRegions } = useCollection<Region>('regions');
  const { data: teacherQualifications } = useCollection<TeacherQualification>(
    'teacherQualifications',
    userId ? [where('userId', '==', userId)] : [],
  );
  const regions = useMemo(
    () => (allRegions ?? []).filter((r) => r.isActive !== false),
    [allRegions],
  );

  /** Hoca profili: bu kullanıcının teacherId olduğu ders planları */
  const taughtSchedules = useMemo(() => {
    if (!user || user.role !== 'teacher' || !userId) return [];
    let list = (schedules ?? []).filter((s) => s.teacherId === userId);
    if (isRegionSupervisor && myRegionId) {
      list = list.filter((s) => s.regionId === myRegionId);
    }
    const regionName = (rid: string) =>
      regions.find((r) => r.id === rid)?.name ?? rid;
    return list.slice().sort((a, b) => {
      const regCmp = regionName(a.regionId).localeCompare(regionName(b.regionId), 'tr');
      if (regCmp !== 0) return regCmp;
      return (a.lectureName ?? '').localeCompare(b.lectureName ?? '', 'tr');
    });
  }, [user, userId, schedules, isRegionSupervisor, myRegionId, regions]);

  const [showAddLectureModal, setShowAddLectureModal] = useState(false);
  const [showAddQualificationModal, setShowAddQualificationModal] = useState(false);
  const [showEditQualificationModal, setShowEditQualificationModal] = useState(false);
  const [editingQualification, setEditingQualification] = useState<TeacherQualification | null>(null);
  const [qualificationFieldOfKnowledge, setQualificationFieldOfKnowledge] = useState('');
  const [qualificationPlaceOfStudy, setQualificationPlaceOfStudy] = useState('');
  const [qualificationDescription, setQualificationDescription] = useState('');
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<string[]>([]);
  const [showAssignBooksModal, setShowAssignBooksModal] = useState(false);
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [showAddRegionModal, setShowAddRegionModal] = useState(false);
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [advancingProgress, setAdvancingProgress] =
    useState<UserReadingProgress | null>(null);
  const [advancePages, setAdvancePages] = useState('');

  const availableSchedules = useMemo(() => {
    if (!user || !schedules) return [];
    const userRegionIds = user.regionIds ?? [];
    const userLectureIds = user.userLectureIds ?? [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return schedules.filter((s) => {
      if (!userRegionIds.includes(s.regionId)) return false;
      if (userLectureIds.includes(s.id)) return false;
      const raw = s.endDate;
      const endDate =
        raw && typeof (raw as Timestamp).toDate === 'function'
          ? (raw as Timestamp).toDate()
          : new Date(0);
      return endDate >= today;
    });
  }, [user, schedules]);

  const availableBooksForUser = useMemo(() => {
    if (!user || !books) return [];
    const userRegionIds = user.regionIds ?? [];
    const assignedBookIds = readingProgress.map((rp) => rp.bookId);
    return books.filter((b) => {
      if (assignedBookIds.includes(b.id)) return false;
      const bookRegions = b.regionIds ?? [];
      return bookRegions.some((rid) => userRegionIds.includes(rid));
    });
  }, [user, books, readingProgress]);

  if (userError) {
    showError(userError.message, 'Kullanıcı Yükleme Hatası');
  }

  const today = useMemo(() => new Date(), []);

  const {
    globalHeatmap,
    monthRanges,
    totalPlanned,
    totalAttended,
    overallPercent,
    perScheduleHeatmaps,
  } = useMemo(() => {
    if (!user || !user.userLectureIds || user.userLectureIds.length === 0) {
      return {
        globalHeatmap: [] as {
          date: Date;
          key: string;
          percent: number;
          planned: number;
          attended: number;
        }[],
        monthRanges: [] as { month: string; startCol: number; endCol: number }[],
        totalPlanned: 0,
        totalAttended: 0,
        overallPercent: 0,
        perScheduleHeatmaps: [] as {
          schedule: RegionLectureSchedule;
          cells: {
            date: Date;
            key: string;
            percent: number;
            planned: number;
            attended: number;
          }[];
          monthRanges: { month: string; startCol: number; endCol: number }[];
          totalPlanned: number;
          totalAttended: number;
          overallPercent: number;
        }[],
      };
    }

    const userScheduleIds = user.userLectureIds;
    const userSchedules = schedules.filter((s) => userScheduleIds.includes(s.id));

    const attendanceByKey: Record<string, UserLectureAttendance> = {};
    attendance.forEach((rec) => {
      const d = rec.date.toDate();
      const key = toLocalDateKey(d);
      if (!rec.scheduleId) return;
      attendanceByKey[`${rec.scheduleId}_${key}`] = rec;
    });

    if (userSchedules.length === 0) {
      return {
        globalHeatmap: [] as { date: Date; key: string; percent: number; planned: number; attended: number }[],
        monthRanges: [] as { month: string; startCol: number; endCol: number }[],
        totalPlanned: 0,
        totalAttended: 0,
        overallPercent: 0,
        perScheduleHeatmaps: [] as {
          schedule: RegionLectureSchedule;
          cells: { date: Date; key: string; percent: number; planned: number; attended: number }[];
          monthRanges: { month: string; startCol: number; endCol: number }[];
          totalPlanned: number;
          totalAttended: number;
          overallPercent: number;
        }[],
      };
    }

    const monthNames = [
      'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
      'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara',
    ];

    let minStart = new Date(userSchedules[0].startDate.toDate());
    let maxEnd = new Date(userSchedules[0].endDate.toDate());
    userSchedules.forEach((s) => {
      const start = s.startDate.toDate();
      const end = s.endDate.toDate();
      if (start < minStart) minStart = new Date(start);
      if (end > maxEnd) maxEnd = new Date(end);
    });
    minStart.setHours(0, 0, 0, 0);
    maxEnd.setHours(0, 0, 0, 0);

    const allDates: Date[] = [];
    const d = new Date(minStart);
    while (d <= maxEnd) {
      allDates.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }

    const globalByDate: Record<string, { date: Date; planned: number; attended: number }> = {};
    let globalTotalPlanned = 0;
    let globalTotalAttended = 0;

    allDates.forEach((date) => {
      const key = toLocalDateKey(date);
      globalByDate[key] = { date: new Date(date), planned: 0, attended: 0 };

      userSchedules.forEach((schedule) => {
        const start = new Date(schedule.startDate.toDate());
        const end = new Date(schedule.endDate.toDate());
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        if (date < start || date > end) return;

        const jsDay = date.getDay();
        const dayVal = jsDay === 0 ? 7 : jsDay;
        const matchesDay =
          schedule.daysOfWeek.includes(dayVal) ||
          (dayVal === 7 && schedule.daysOfWeek.includes(0));
        if (!matchesDay) return;

        globalByDate[key].planned += 1;
        const rec = attendanceByKey[`${schedule.id}_${key}`];
        if (rec?.attended) globalByDate[key].attended += 1;
      });

      globalTotalPlanned += globalByDate[key].planned;
      globalTotalAttended += globalByDate[key].attended;
    });

    const perSchedule: {
      schedule: RegionLectureSchedule;
      cells: { date: Date; key: string; percent: number; planned: number; attended: number }[];
      monthRanges: { month: string; startCol: number; endCol: number }[];
      totalPlanned: number;
      totalAttended: number;
      overallPercent: number;
    }[] = [];

    userSchedules.forEach((schedule) => {
      const start = new Date(schedule.startDate.toDate());
      const end = new Date(schedule.endDate.toDate());
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);

      const scheduleDates: Date[] = [];
      const sd = new Date(start);
      while (sd <= end) {
        scheduleDates.push(new Date(sd));
        sd.setDate(sd.getDate() + 1);
      }

      const cells: {
        date: Date;
        key: string;
        percent: number;
        planned: number;
        attended: number;
      }[] = [];

      let schedulePlanned = 0;
      let scheduleAttended = 0;

      scheduleDates.forEach((date) => {
        const key = toLocalDateKey(date);
        const jsDay = date.getDay();
        const dayVal = jsDay === 0 ? 7 : jsDay;
        const isPlanned =
          schedule.daysOfWeek.includes(dayVal) ||
          (dayVal === 7 && schedule.daysOfWeek.includes(0));

        let planned = 0;
        let attendedCount = 0;
        if (isPlanned) {
          planned = 1;
          const rec = attendanceByKey[`${schedule.id}_${key}`];
          if (rec?.attended) attendedCount = 1;
        }

        const percent = planned > 0 ? attendedCount / planned : 0;
        cells.push({ date: new Date(date), key, percent, planned, attended: attendedCount });
        schedulePlanned += planned;
        scheduleAttended += attendedCount;
      });

      const scheduleOverallPercent =
        schedulePlanned > 0
          ? Math.round((scheduleAttended / schedulePlanned) * 100)
          : 0;

      const scheduleNumCols = Math.ceil(cells.length / 7);
      const scheduleMonthRanges: { month: string; startCol: number; endCol: number }[] = [];
      let sRangeStart = 0;
      let sRangeMonth = '';

      for (let col = 0; col < scheduleNumCols; col++) {
        const cellIdx = col * 7;
        if (cellIdx >= cells.length) break;
        const d = cells[cellIdx].date;
        const m = monthNames[d.getMonth()];

        if (m !== sRangeMonth) {
          if (sRangeMonth) {
            scheduleMonthRanges.push({
              month: sRangeMonth,
              startCol: sRangeStart,
              endCol: col - 1,
            });
          }
          sRangeStart = col;
          sRangeMonth = m;
        }
      }
      if (sRangeMonth) {
        scheduleMonthRanges.push({
          month: sRangeMonth,
          startCol: sRangeStart,
          endCol: scheduleNumCols - 1,
        });
      }

      perSchedule.push({
        schedule,
        cells,
        monthRanges: scheduleMonthRanges,
        totalPlanned: schedulePlanned,
        totalAttended: scheduleAttended,
        overallPercent: scheduleOverallPercent,
      });
    });

    const globalHeatmapList = Object.values(globalByDate)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(({ date, planned, attended }) => ({
        date,
        key: toLocalDateKey(date),
        planned,
        attended,
        percent: planned > 0 ? attended / planned : 0,
      }));

    const globalOverallPercent =
      globalTotalPlanned > 0
        ? Math.round((globalTotalAttended / globalTotalPlanned) * 100)
        : 0;

    const numCols = Math.ceil(globalHeatmapList.length / 7);
    const monthRanges: { month: string; startCol: number; endCol: number }[] = [];
    let rangeStart = 0;
    let rangeMonth = '';

    for (let col = 0; col < numCols; col++) {
      const cellIdx = col * 7;
      if (cellIdx >= globalHeatmapList.length) break;
      const d = globalHeatmapList[cellIdx].date;
      const m = monthNames[d.getMonth()];

      if (m !== rangeMonth) {
        if (rangeMonth) {
          monthRanges.push({ month: rangeMonth, startCol: rangeStart, endCol: col - 1 });
        }
        rangeStart = col;
        rangeMonth = m;
      }
    }
    if (rangeMonth) {
      monthRanges.push({ month: rangeMonth, startCol: rangeStart, endCol: numCols - 1 });
    }

    return {
      globalHeatmap: globalHeatmapList,
      monthRanges,
      totalPlanned: globalTotalPlanned,
      totalAttended: globalTotalAttended,
      overallPercent: globalOverallPercent,
      perScheduleHeatmaps: perSchedule,
    };
  }, [attendance, schedules, user]);

  const getHeatColor = (planned: number, attended: number) => {
    if (planned === 0) return 'bg-gray-100';
    if (planned > 0 && attended === 0) return 'bg-emerald-100';
    // planned > 0 && attended > 0
    return 'bg-emerald-600';
  };

  const readingWithBooks = readingProgress.map((rp) => ({
    ...rp,
    book: books.find((b) => b.id === rp.bookId) || null,
  }));

  const handleMarkAttendance = async (
    schedule: RegionLectureSchedule,
    date: Date,
  ) => {
    if (!isAdmin || !user) return;

    const todayMidnight = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    if (date > todayMidnight) {
      return;
    }

    const dateKey = toLocalDateKey(date);

    const start = schedule.startDate.toDate();
    const end = schedule.endDate.toDate();
    const jsDay = date.getDay();
    const dayVal = jsDay === 0 ? 7 : jsDay;
    const isInRange = date >= start && date <= end;
    const isPlanned = isInRange && schedule.daysOfWeek.includes(dayVal);

    if (!isPlanned) {
      await showError(
        'Bu tarih için planlanmış bir ders bulunmuyor.',
        'Katılım İşareti',
      );
      return;
    }

    const existing = attendance.find((rec) => {
      if (!rec.scheduleId) return false;
      const recDateKey = toLocalDateKey(rec.date.toDate());
      return (
        rec.scheduleId === schedule.id &&
        rec.userId === user.id &&
        recDateKey === dateKey
      );
    });

    if (existing?.attended) {
      const confirmed = await showConfirm(
        `${dateKey} tarihli "${schedule.lectureName}" dersi için kullanıcıyı gelemedi olarak işaretlemek istediğinize emin misiniz? Katılım bilgisi silinecektir.`,
        'Katılımı Kaldır',
        {
          confirmButtonText: 'Evet, Kaldır',
          cancelButtonText: 'İptal',
          icon: 'warning',
        },
      );
      if (!confirmed) return;

      try {
        showLoading('Katılım bilgisi kaldırılıyor...');
        await firestoreHelpers.delete('userLectureAttendance', existing.id);
        hideLoading();
        // await showSuccess('Katılım bilgisi kaldırıldı.');
      } catch (error) {
        console.error(error);
        hideLoading();
        await showError('Katılım kaldırılırken bir hata oluştu.');
      }
      return;
    }

    const confirmed = await showConfirm(
      `${dateKey} tarihli "${schedule.lectureName}" dersi için bu kullanıcıyı katılmış olarak işaretlemek istediğinizden emin misiniz?`,
      'Katılımı İşaretle',
      {
        confirmButtonText: 'Evet, İşaretle',
        cancelButtonText: 'İptal',
        icon: 'warning',
      },
    );

    if (!confirmed) return;

    try {
      showLoading('Katılım işaretleniyor...');

      if (existing) {
        await firestoreHelpers.update<UserLectureAttendance>(
          'userLectureAttendance',
          existing.id,
          { attended: true },
        );
      } else {
        await firestoreHelpers.add<UserLectureAttendance>('userLectureAttendance', {
          userId: user.id,
          scheduleId: schedule.id,
          regionId: schedule.regionId,
          date: Timestamp.fromDate(new Date(`${dateKey}T00:00:00`)),
          attended: true,
        } as UserLectureAttendance);
      }

      hideLoading();
      // await showSuccess('Katılım kaydedildi.');
    } catch (error) {
      console.error(error);
      hideLoading();
      await showError('Katılım işaretlenirken bir hata oluştu.');
    }
  };

  const handleAddSelectedLectures = async () => {
    if (!user || selectedScheduleIds.length === 0) return;

    const toAdd = availableSchedules.filter((s) =>
      selectedScheduleIds.includes(s.id),
    );
    const names = toAdd.map((s) => s.lectureName);
    const namesStr =
      names.length <= 3 ? names.join(', ') : `${names.slice(0, 2).join(', ')} ve ${names.length - 2} daha`;
    const confirmed = await showConfirm(
      `${selectedScheduleIds.length} derse (${namesStr}) bu kullanıcıyı eklemek istediğinizden emin misiniz?`,
      'Derslere Ekle',
      {
        confirmButtonText: 'Evet, Ekle',
        cancelButtonText: 'İptal',
        icon: 'question',
        confirmButtonColor: '#16a34a',
      },
    );
    if (!confirmed) return;

    try {
      showLoading('Derslere ekleniyor...');

      let currentUserLectures = user.userLectureIds ?? [];

      for (const schedule of toAdd) {
        const currentParticipants = schedule.participantUserIds ?? [];
        await Promise.all([
          firestoreHelpers.update<User>('users', user.id, {
            userLectureIds: [...currentUserLectures, schedule.id],
          }),
          firestoreHelpers.update<RegionLectureSchedule>(
            'regionLectureSchedules',
            schedule.id,
            { participantUserIds: [...currentParticipants, user.id] },
          ),
        ]);
        currentUserLectures = [...currentUserLectures, schedule.id];
      }

      hideLoading();
      await showSuccess(
        selectedScheduleIds.length === 1 ? 'Kullanıcı derse eklendi.' : 'Kullanıcı derslere eklendi.',
      );
      setSelectedScheduleIds([]);
      setShowAddLectureModal(false);
    } catch (error) {
      console.error(error);
      hideLoading();
      await showError('Derslere eklenirken bir hata oluştu.');
    }
  };

  const toggleScheduleSelection = (scheduleId: string) => {
    setSelectedScheduleIds((prev) =>
      prev.includes(scheduleId)
        ? prev.filter((id) => id !== scheduleId)
        : [...prev, scheduleId],
    );
  };

  const handleRemoveFromLecture = async (
    schedule: RegionLectureSchedule,
  ) => {
    if (!user) return;

    const confirmed = await showConfirm(
      `"${schedule.lectureName}" dersinden bu kullanıcıyı çıkarmak istediğinizden emin misiniz?`,
      'Dersten Çıkar',
      {
        confirmButtonText: 'Evet, Çıkar',
        cancelButtonText: 'İptal',
        icon: 'warning',
      },
    );
    if (!confirmed) return;

    try {
      showLoading('Dersten çıkarılıyor...');

      const currentUserLectures = user.userLectureIds ?? [];
      const currentParticipants = schedule.participantUserIds ?? [];

      await Promise.all([
        firestoreHelpers.update<User>('users', user.id, {
          userLectureIds: currentUserLectures.filter((id) => id !== schedule.id),
        }),
        firestoreHelpers.update<RegionLectureSchedule>(
          'regionLectureSchedules',
          schedule.id,
          {
            participantUserIds: currentParticipants.filter(
              (id) => id !== user.id,
            ),
          },
        ),
      ]);

      hideLoading();
      // await showSuccess('Kullanıcı dersten çıkarıldı.');
    } catch (error) {
      console.error(error);
      hideLoading();
      await showError('Dersten çıkarılırken bir hata oluştu.');
    }
  };

  const handleAssignBooks = async () => {
    if (!user || selectedBookIds.length === 0) return;

    const confirmed = await showConfirm(
      `${selectedBookIds.length} kitap kullanıcıya tanımlanacak. Devam etmek istiyor musunuz?`,
      'Kitap Tanımla',
      {
        confirmButtonText: 'Evet, Tanımla',
        cancelButtonText: 'İptal',
        icon: 'question',
        confirmButtonColor: '#16a34a',
      },
    );
    if (!confirmed) return;

    try {
      showLoading('Kitaplar tanımlanıyor...');

      for (const bookId of selectedBookIds) {
        const book = books?.find((b) => b.id === bookId);
        const totalPages = book?.pageCount ?? 0;
        await firestoreHelpers.add<UserReadingProgress>(
          'userReadingProgress',
          {
            userId: user.id,
            bookId,
            completedPages: 0,
            totalPages,
          } as UserReadingProgress,
        );
      }

      hideLoading();
      // await showSuccess('Kitaplar tanımlandı.');
      setSelectedBookIds([]);
      setShowAssignBooksModal(false);
    } catch (error) {
      console.error(error);
      hideLoading();
      await showError('Kitaplar tanımlanırken bir hata oluştu.');
    }
  };

  const handleAdvanceReading = async () => {
    if (!advancingProgress || advancePages.trim() === '') return;

    const newCompleted = parseInt(advancePages, 10);
    if (isNaN(newCompleted) || newCompleted < 0) {
      await showError('Geçerli bir sayı girin (0 veya üzeri).', 'Hata');
      return;
    }

    const total = advancingProgress.totalPages || 0;
    if (total > 0 && newCompleted > total) {
      await showError(
        `Kitabın sayfa sayısından (${total}) fazla girilemez.`,
        'Hata',
      );
      return;
    }

    try {
      showLoading('İlerleme kaydediliyor...');
      await firestoreHelpers.update<UserReadingProgress>(
        'userReadingProgress',
        advancingProgress.id,
        { completedPages: newCompleted },
      );
      hideLoading();
      const current = advancingProgress.completedPages || 0;
      const diff = newCompleted - current;
      let msg = 'Değişiklik yok.';
      if (diff > 0) {
        msg =
          total > 0 && newCompleted >= total
            ? 'Kitap okuma tamamlandı!'
            : `${diff} sayfa eklendi.`;
      } else if (diff < 0) {
        msg = 'İlerleme güncellendi.';
      }
      await showSuccess(msg);
      setShowAdvanceModal(false);
      setAdvancingProgress(null);
      setAdvancePages('');
    } catch (error) {
      console.error(error);
      hideLoading();
      await showError('İlerleme kaydedilirken bir hata oluştu.');
    }
  };

  const handleCompleteBook = async (rp: UserReadingProgress) => {
    const total = rp.totalPages || 0;
    if (total <= 0) {
      await showError('Kitabın sayfa sayısı tanımlı değil.', 'Hata');
      return;
    }

    const book = books?.find((b) => b.id === rp.bookId);
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
      // await showSuccess('Kitap tamamlandı olarak işaretlendi.');
    } catch (error) {
      console.error(error);
      hideLoading();
      await showError('İşlem sırasında bir hata oluştu.');
    }
  };

  const handleRemoveBook = async (rp: UserReadingProgress) => {
    if (!user) return;

    const book = books?.find((b) => b.id === rp.bookId);
    const confirmed = await showConfirm(
      `"${book?.title || 'Bu kitap'}" kullanıcının okuma listesinden kaldırılacak. Devam etmek istiyor musunuz?`,
      'Kitabı Kaldır',
      {
        confirmButtonText: 'Evet, Kaldır',
        cancelButtonText: 'İptal',
        icon: 'warning',
      },
    );
    if (!confirmed) return;

    try {
      showLoading('Kitap kaldırılıyor...');
      await firestoreHelpers.delete('userReadingProgress', rp.id);
      hideLoading();
      // await showSuccess('Kitap kaldırıldı.');
    } catch (error) {
      console.error(error);
      hideLoading();
      await showError('Kitap kaldırılırken bir hata oluştu.');
    }
  };

  const handleAddRegion = async () => {
    if (!user || !selectedRegionId) return;

    const currentIds = user.regionIds ?? [];
    const nextIds =
      user.role === 'teacher'
        ? currentIds.includes(selectedRegionId)
          ? currentIds
          : [...currentIds, selectedRegionId]
        : [selectedRegionId];

    try {
      showLoading('Bölge ekleniyor...');
      await firestoreHelpers.update<User>('users', user.id, {
        regionIds: nextIds,
      });
      hideLoading();
      // await showSuccess('Kullanıcı bölgeye eklendi.');
      setShowAddRegionModal(false);
      setSelectedRegionId('');
    } catch (error) {
      console.error(error);
      hideLoading();
      await showError('Bölge eklenirken bir hata oluştu.');
    }
  };

  const handleRemoveFromRegion = async (regionId: string) => {
    if (!user) return;

    const confirmed = await showConfirm(
      `Kullanıcıyı "${regions?.find((r) => r.id === regionId)?.name ?? 'bu bölgeden'}" bölgesinden çıkarmak istediğinizden emin misiniz?`,
      'Bölgeden Çıkar',
      {
        confirmButtonText: 'Evet, Çıkar',
        cancelButtonText: 'İptal',
        icon: 'warning',
      },
    );
    if (!confirmed) return;

    try {
      showLoading('Bölgeden çıkarılıyor...');
      const currentIds = user.regionIds ?? [];
      const nextIds = currentIds.filter((id) => id !== regionId);
      await firestoreHelpers.update<User>('users', user.id, {
        regionIds: nextIds,
      });
      hideLoading();
      // await showSuccess('Kullanıcı bölgeden çıkarıldı.');
    } catch (error) {
      console.error(error);
      hideLoading();
      await showError('Bölgeden çıkarılırken bir hata oluştu.');
    }
  };

  const openAddQualificationModal = () => {
    setQualificationFieldOfKnowledge('');
    setQualificationPlaceOfStudy('');
    setQualificationDescription('');
    setShowAddQualificationModal(true);
  };

  const openEditQualificationModal = (q: TeacherQualification) => {
    setEditingQualification(q);
    setQualificationFieldOfKnowledge(q.fieldOfKnowledge || '');
    setQualificationPlaceOfStudy(q.placeOfStudy || '');
    setQualificationDescription(q.description || q.placeOfStudyAndDescription || '');
    setShowEditQualificationModal(true);
  };

  const closeQualificationModals = () => {
    setShowAddQualificationModal(false);
    setShowEditQualificationModal(false);
    setEditingQualification(null);
    setQualificationFieldOfKnowledge('');
    setQualificationPlaceOfStudy('');
    setQualificationDescription('');
  };

  const handleAddQualification = async () => {
    if (!userId) return;
    const field = qualificationFieldOfKnowledge.trim();
    const place = qualificationPlaceOfStudy.trim();
    const desc = qualificationDescription.trim();
    if (!field && !place && !desc) {
      await showError('En az bir alan doldurulmalıdır.');
      return;
    }
    try {
      showLoading('Kaydediliyor...');
      await firestoreHelpers.add<TeacherQualification>('teacherQualifications', {
        userId,
        fieldOfKnowledge: field,
        placeOfStudy: place,
        description: desc,
      });
      hideLoading();
      // await showSuccess('Hoca kimliği kaydı eklendi.');
      closeQualificationModals();
    } catch (error) {
      console.error(error);
      hideLoading();
      await showError('Kayıt eklenirken bir hata oluştu.');
    }
  };

  const handleUpdateQualification = async () => {
    if (!editingQualification) return;
    const field = qualificationFieldOfKnowledge.trim();
    const place = qualificationPlaceOfStudy.trim();
    const desc = qualificationDescription.trim();
    if (!field && !place && !desc) {
      await showError('En az bir alan doldurulmalıdır.');
      return;
    }
    try {
      showLoading('Güncelleniyor...');
      await firestoreHelpers.update<TeacherQualification>('teacherQualifications', editingQualification.id, {
        fieldOfKnowledge: field,
        placeOfStudy: place,
        description: desc,
      });
      hideLoading();
      // await showSuccess('Hoca kimliği kaydı güncellendi.');
      closeQualificationModals();
    } catch (error) {
      console.error(error);
      hideLoading();
      await showError('Kayıt güncellenirken bir hata oluştu.');
    }
  };

  const handleDeleteQualification = async (q: TeacherQualification) => {
    const confirmed = await showConfirm(
      'Bu hoca kimliği kaydını silmek istediğinizden emin misiniz?',
      'Kaydı Sil',
      { confirmButtonText: 'Evet, Sil', cancelButtonText: 'İptal', icon: 'warning' },
    );
    if (!confirmed) return;
    try {
      showLoading('Siliniyor...');
      await firestoreHelpers.delete('teacherQualifications', q.id);
      hideLoading();
      // await showSuccess('Hoca kimliği kaydı silindi.');
    } catch (error) {
      console.error(error);
      hideLoading();
      await showError('Kayıt silinirken bir hata oluştu.');
    }
  };

  const canManageLectures =
    isAdmin || (!!authUser && !!userId && authUser.id === userId);
  const canManageReading = canManageLectures;
  const canManageRegion = canManageLectures;
  const canJoinLectures =
    canManageLectures &&
    (user?.role !== 'user' || user?.isUserApproved === true);
  const needsApproval =
    !!user &&
    user.role === 'user' &&
    user.isUserApproved === false &&
    !!authUser &&
    authUser.id === user.id;

  const handleDeleteUser = async () => {
    if (!user) return;

    if (authUser?.id === user.id) {
      await showError(
        'Kendi hesabınızı silemezsiniz.',
        'İşlem Engellendi',
      );
      return;
    }

    const confirmed = await showConfirm(
      'Bu kullanıcıyı ve tüm ilgili verilerini (dersler, kitaplar, katılım kayıtları) kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
      'Kullanıcıyı Sil',
      {
        confirmButtonText: 'Evet, Sil',
        cancelButtonText: 'İptal',
        icon: 'warning',
      },
    );
    if (!confirmed) return;

    try {
      showLoading('Kullanıcı siliniyor...');

      const uid = user.id;

      const progressRecords = await firestoreHelpers.getAll<{ id: string }>(
        'userReadingProgress',
        [where('userId', '==', uid)],
      );
      await Promise.all(
        progressRecords.map((rec) =>
          firestoreHelpers.delete('userReadingProgress', rec.id),
        ),
      );

      const attendanceRecords = await firestoreHelpers.getAll<{ id: string }>(
        'userLectureAttendance',
        [where('userId', '==', uid)],
      );
      await Promise.all(
        attendanceRecords.map((rec) =>
          firestoreHelpers.delete('userLectureAttendance', rec.id),
        ),
      );

      const qualificationRecords = await firestoreHelpers.getAll<{ id: string }>(
        'teacherQualifications',
        [where('userId', '==', uid)],
      );
      await Promise.all(
        qualificationRecords.map((rec) =>
          firestoreHelpers.delete('teacherQualifications', rec.id),
        ),
      );

      const userScheduleIds = user.userLectureIds ?? [];
      for (const scheduleId of userScheduleIds) {
        const schedule = schedules?.find((s) => s.id === scheduleId);
        if (schedule?.participantUserIds?.includes(uid)) {
          const next = schedule.participantUserIds.filter((id) => id !== uid);
          await firestoreHelpers.update<RegionLectureSchedule>(
            'regionLectureSchedules',
            scheduleId,
            { participantUserIds: next },
          );
        }
      }

      await firestoreHelpers.delete('users', uid);

      hideLoading();
      // await showSuccess('Kullanıcı ve tüm ilgili veriler silindi.');
      navigate('/users');
    } catch (error) {
      console.error(error);
      hideLoading();
      await showError('Kullanıcı silinirken bir hata oluştu.');
    }
  };

  if (userLoading || !user) {
    return (
      <div className="min-h-[200px] flex items-center justify-center">
        <p className="text-gray-500 text-sm">Kullanıcı yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in min-w-0 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 min-w-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-xl font-semibold flex-shrink-0">
            {user.name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate">
              {user.name} {user.lastname}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 truncate">
              {user.email} • @{user.username}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/users')}
          className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors flex-shrink-0 self-start sm:self-center"
        >
          ← Kullanıcılara Dön
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-soft p-4 sm:p-6 lg:p-8 min-w-0 overflow-hidden">
        <div className="space-y-8 min-w-0">
          {needsApproval && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
              <HiExclamation className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-900">
                  Hesabınız henüz onaylanmadı
                </p>
                <p className="text-sm text-amber-800 mt-1">
                  Ders halkalarına katılabilmeniz ve kitap tanımlayabilmeniz için
                  yönetici onayı gerekmektedir. Lütfen onay bekleyin.
                </p>
              </div>
            </div>
          )}

          {/* Bölge */}
          <section className="border-b border-gray-200 pb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                <HiOfficeBuilding className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                  Bölge
                </h2>
                <p className="text-xs sm:text-sm text-gray-500">
                  Kullanıcının bağlı olduğu bölge(ler)
                </p>
              </div>
              {canManageRegion &&
                (user.regionIds?.length ?? 0) > 0 &&
                (regions?.filter((r) => !(user.regionIds ?? []).includes(r.id)).length ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAddRegionModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-amber-600 text-amber-600 hover:bg-amber-50 transition-colors"
                  >
                    <HiPlus className="w-4 h-4" />
                    Bölge ekle
                  </button>
                )}
            </div>

            {(user.regionIds?.length ?? 0) > 0 ? (
              <div className="flex flex-wrap gap-2">
                {(user.regionIds ?? []).map((regionId) => {
                  const region = regions?.find((r) => r.id === regionId);
                  return (
                    <div
                      key={regionId}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200"
                    >
                      <span className="text-sm font-medium text-gray-900">
                        {region?.name ?? `Bölge (${regionId})`}
                      </span>
                      {canManageRegion && (
                        <button
                          type="button"
                          onClick={() => handleRemoveFromRegion(regionId)}
                          className="p-1 text-amber-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Bölgeden çıkar"
                        >
                          <HiX className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-gray-500">
                  Bu kullanıcıya tanımlı bölge bulunmuyor.
                </p>
                {canManageRegion && (regions?.length ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAddRegionModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-amber-600 text-white hover:bg-amber-700 shadow-md transition-all"
                  >
                    <HiPlus className="w-5 h-5" />
                    Bölge ekle
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Ders Katılımı (öğrenci) / Verdiği dersler (hoca) */}
          <section className="border-b border-gray-200 pb-8 min-w-0 overflow-hidden">
            {user.role === 'teacher' ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <HiAcademicCap className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                      Verdiği Dersler
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-500">
                      Bu hocanın sorumlu olduğu ders planları: bölge, haftalık günler, saat ve
                      dönem.
                      {isRegionSupervisor && myRegionId
                        ? ' Yalnızca yönettiğiniz bölgeye ait planlar listelenir.'
                        : ''}
                    </p>
                  </div>
                </div>
                {taughtSchedules.length === 0 ? (
                  <p className="text-sm text-gray-500 mt-2">
                    Bu hoca için kayıtlı ders planı bulunmuyor.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-200 mt-2">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Ders
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Bölge
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Günler
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Saat
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Tarih aralığı
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Katılımcı
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {taughtSchedules.map((s) => {
                          const regionName =
                            regions.find((r) => r.id === s.regionId)?.name ?? s.regionId;
                          const daysStr = [...(s.daysOfWeek ?? [])]
                            .sort((a, b) => a - b)
                            .map((d) => SCHEDULE_DAY_SHORT[d] ?? d)
                            .join(', ');
                          const start =
                            s.startDate?.toDate?.()?.toLocaleDateString('tr-TR') ?? '—';
                          const end =
                            s.endDate?.toDate?.()?.toLocaleDateString('tr-TR') ?? '—';
                          const n = (s.participantUserIds ?? []).length;
                          return (
                            <tr key={s.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-900">
                                {s.lectureName}
                              </td>
                              <td className="px-4 py-3 text-gray-700">{regionName}</td>
                              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                                {daysStr || '—'}
                              </td>
                              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                                {formatScheduleTimeMinutes(s.startTimeMinutes)} –{' '}
                                {formatScheduleTimeMinutes(s.endTimeMinutes)}
                              </td>
                              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                                {start} – {end}
                              </td>
                              <td className="px-4 py-3 text-right text-gray-700">{n}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                <HiChartBar className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                  Ders Halkası Katılımı
                </h2>
                <p className="text-xs sm:text-sm text-gray-500">
                  Planlanan derslerin hangi günlerinde ne kadar katılım
                  sağladığını gösterir.
                </p>
              </div>
            </div>

            {!(user.userLectureIds && user.userLectureIds.length > 0) ? (
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <p className="text-sm text-gray-500">
                  Henüz bir ders halkasına katılmadınız.
                </p>
                {canJoinLectures && (user.regionIds?.length ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAddLectureModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-md hover:shadow-lg transition-all hover:scale-[1.02]"
                  >
                    <HiPlus className="w-5 h-5" />
                    Yeni ders ekle
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="mb-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3 min-w-0">
                  <div className="text-xs sm:text-sm text-gray-600 flex flex-wrap gap-x-2 gap-y-1">
                    <span>Planlanan: {totalPlanned}</span>
                    <span className="hidden sm:inline">•</span>
                    <span>Katıldığı: {totalAttended}</span>
                    <span className="hidden sm:inline">•</span>
                    <span>
                      Katılım:{' '}
                      <span className="font-semibold">
                        %{isNaN(overallPercent) ? 0 : overallPercent}
                      </span>
                    </span>
                  </div>
                  {canJoinLectures && (user.regionIds?.length ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAddLectureModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-primary-600 text-primary-600 hover:bg-primary-50 transition-colors flex-shrink-0"
                    >
                      <HiPlus className="w-4 h-4" />
                      Yeni ders ekle
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto overflow-y-visible flex flex-col min-w-0 -mx-1 px-1 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                  {/* Ay etiketleri - timeline kolonlarıyla hizalı */}
                  <div className="inline-flex min-w-max">
                    <div className="w-6 sm:w-8 mr-2 shrink-0" aria-hidden>
                    </div>
                    <div
                      className="relative h-4 text-[10px] text-gray-400 shrink-0"
                      style={{
                        width: (() => {
                          const cols = Math.max(1, Math.ceil(globalHeatmap.length / 7));
                          return `calc(${cols} * 0.75rem + ${cols - 1} * 0.25rem)`;
                        })(),
                      }}
                    >
                      {monthRanges.map(({ month, startCol, endCol }) => {
                        const colWidth = 0.75; // rem
                        const gap = 0.25; // rem
                        const left = startCol * (colWidth + gap);
                        const spanCols = endCol - startCol + 1;
                        const width = spanCols * colWidth + (spanCols - 1) * gap;
                        const minShowWidth = 1.5;
                        if (width < minShowWidth) return null;
                        return (
                          <span
                            key={`${month}-${startCol}`}
                            className="absolute left-0 top-0 leading-none truncate block overflow-hidden text-[9px]"
                            style={{
                              left: `${left}rem`,
                              width: `${width}rem`,
                            }}
                          >
                            {month}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="inline-flex min-w-max">
                    {/* Y ekseni - gün etiketleri */}
                    <div className="flex flex-col justify-between mr-2 sm:mr-3 text-[10px] text-gray-400 py-0.5 mt-1 shrink-0">
                      <span>Pzt</span>
                      <span>Sal</span>
                      <span>Çar</span>
                      <span>Per</span>
                      <span>Cum</span>
                      <span>Cts</span>
                      <span>Paz</span>
                    </div>

                    <div className="shrink-0 overflow-visible">
                      <div className="inline-grid grid-rows-7 grid-flow-col gap-1">
                        {globalHeatmap.map((cell, idx) => {
                          const day = cell.date.getDay(); // 0 Pazar
                          const row = (day + 6) % 7; // 0 Pazartesi
                          return (
                            <div
                              key={cell.key + idx}
                              className={`w-3 h-3 rounded flex-shrink-0 ${getHeatColor(
                                cell.planned,
                                cell.attended,
                              )}`}
                              style={{ gridRowStart: row + 1 }}
                              title={`${cell.key}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {perScheduleHeatmaps.length > 0 && (
                  <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 min-w-0">
                    {perScheduleHeatmaps.map((item) => (
                      <div
                        key={item.schedule.id}
                        className="relative p-3 sm:p-4 rounded-xl border border-gray-200 bg-gray-50 min-w-0 overflow-hidden"
                      >
                        {canManageLectures && (
                          <button
                            type="button"
                            onClick={() => handleRemoveFromLecture(item.schedule)}
                            className="absolute top-3 right-3 p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Dersten çıkar"
                          >
                            <HiX className="w-4 h-4" />
                          </button>
                        )}
                        <div
                          className={`flex flex-col gap-2 mb-3 min-w-0 ${
                            canManageLectures ? 'pr-8' : ''
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate" title={item.schedule.lectureName}>
                              {item.schedule.lectureName}
                              {(() => {
                                const teacher = allUsers?.find(
                                  (u) => u.id === item.schedule.teacherId,
                                );
                                const teacherName = teacher
                                  ? `${teacher.name}${teacher.lastname ? ` ${teacher.lastname}` : ''}`
                                  : null;
                                return teacherName ? (
                                  <span className="font-normal text-gray-600"> ({teacherName})</span>
                                ) : null;
                              })()}
                            </p>
                            <p className="text-xs text-gray-500 flex flex-wrap gap-x-2 gap-y-0.5">
                              <span>Planlanan: {item.totalPlanned}</span>
                              <span>Katıldığı: {item.totalAttended}</span>
                              <span>
                                Katılım: <span className="font-semibold">%{isNaN(item.overallPercent) ? 0 : item.overallPercent}</span>
                              </span>
                            </p>
                          </div>
                        </div>
                        <div className="overflow-x-auto flex flex-col min-w-0 -mx-1 px-1 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                          {/* Ay etiketleri */}
                          <div className="inline-flex mb-1 min-w-max">
                            <div
                              className="w-6 sm:w-8 mr-2 shrink-0 invisible pointer-events-none"
                              aria-hidden
                            >
                            </div>
                            <div
                              className="relative h-4 text-[10px] text-gray-400 shrink-0"
                              style={{
                                width: (() => {
                                  const cols = Math.max(1, Math.ceil(item.cells.length / 7));
                                  return `calc(${cols} * 0.75rem + ${cols - 1} * 0.25rem)`;
                                })(),
                              }}
                            >
                              {item.monthRanges.map(({ month, startCol, endCol }) => {
                                const colWidth = 0.75;
                                const gap = 0.25;
                                const left = startCol * (colWidth + gap);
                                const spanCols = endCol - startCol + 1;
                                const width = spanCols * colWidth + (spanCols - 1) * gap;
                                const minShowWidth = 1.5;
                                if (width < minShowWidth) return null;
                                return (
                                  <span
                                    key={`${item.schedule.id}-${month}-${startCol}`}
                                    className="absolute left-0 top-0 leading-none truncate block overflow-hidden text-[9px] text-center"
                                    style={{
                                      left: `${left}rem`,
                                      width: `${width}rem`,
                                    }}
                                  >
                                    {month}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                          {/* Gün etiketleri + heatmap */}
                          <div className="inline-flex min-w-max mb-3">
                            <div className="flex flex-col justify-between mr-2 sm:mr-3 text-[10px] text-gray-400 py-0.5 mt-1 shrink-0">
                              <span>Pzt</span>
                              <span>Sal</span>
                              <span>Çar</span>
                              <span>Per</span>
                              <span>Cum</span>
                              <span>Cts</span>
                              <span>Paz</span>
                            </div>
                            <div className="shrink-0">
                              <div
                                className="inline-grid grid-rows-7 gap-1"
                                style={{
                                  gridTemplateColumns: `repeat(${Math.ceil(item.cells.length / 7)}, minmax(0.75rem, 0.75rem))`,
                                }}
                              >
                            {item.cells.map((cell, idx) => {
                              const day = cell.date.getDay();
                              const row = (day + 6) % 7;
                              const col = Math.floor(idx / 7);
                              const isClickable =
                                isAdmin &&
                                cell.planned > 0 &&
                                cell.date <= new Date();
                              return (
                                <div
                                  key={cell.key + idx}
                                  className={`w-3 h-3 min-w-0 min-h-0 rounded ${getHeatColor(
                                    cell.planned,
                                    cell.attended,
                                  )} ${
                                    isClickable
                                      ? 'cursor-pointer hover:ring-2 hover:ring-primary-500/60'
                                      : ''
                                  }`}
                                  style={{
                                    gridRow: row + 1,
                                    gridColumn: col + 1,
                                  }}
                                  title={`${cell.key}`}
                                  onClick={() =>
                                    isClickable &&
                                    handleMarkAttendance(item.schedule, cell.date)
                                  }
                                />
                              );
                            })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
              </>
            )}
          </section>

          {/* Hoca Kimliği - Sadece teacher için */}
          {user.role === 'teacher' && (
            <section className="border-b border-gray-200 pb-8 min-w-0 overflow-hidden">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
                    <HiAcademicCap className="w-5 h-5 text-teal-600" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                      Hoca Kimliği
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-500">
                      İlim alanı ve tahsil yeri bilgileri
                    </p>
                  </div>
                </div>
                {canManageLectures && (teacherQualifications?.length ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={openAddQualificationModal}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-teal-600 text-white hover:bg-teal-700 shadow-md transition-all flex-shrink-0"
                  >
                    <HiPlus className="w-5 h-5" />
                    Ekle
                  </button>
                )}
              </div>

              {(teacherQualifications?.length ?? 0) === 0 ? (
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <p className="text-sm text-gray-500">
                    Henüz bir kayıt yapmadınız.
                  </p>
                  {canManageLectures && (
                    <button
                      type="button"
                      onClick={openAddQualificationModal}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-teal-600 text-white hover:bg-teal-700 shadow-md transition-all"
                    >
                      <HiPlus className="w-5 h-5" />
                      İlk kaydı ekle
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                          İlim Alanı
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                          Tahsil Yeri
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                          Açıklama
                        </th>
                        {canManageLectures && (
                          <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider w-24">
                            İşlemler
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {teacherQualifications?.map((q) => (
                        <tr key={q.id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-pre-wrap">
                            {q.fieldOfKnowledge || '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 whitespace-pre-wrap">
                            {q.placeOfStudy || '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 whitespace-pre-wrap">
                            {q.description || q.placeOfStudyAndDescription || '—'}
                          </td>
                          {canManageLectures && (
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEditQualificationModal(q)}
                                  className="p-2 text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
                                  title="Düzenle"
                                >
                                  <HiPencil className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteQualification(q)}
                                  className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Sil"
                                >
                                  <HiTrash className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* Okuma İlerlemesi */}
          <section className="border-b border-gray-200 pb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <HiBookOpen className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                  Okuma İlerlemesi
                </h2>
                <p className="text-xs sm:text-sm text-gray-500">
                  Kullanıcıya tanımlı kitaplar ve okuma durumu.
                </p>
              </div>
            </div>

            {readingWithBooks.length === 0 ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-gray-500">
                  Bu kullanıcı için tanımlı kitap bulunmuyor.
                </p>
                {canJoinLectures && (user.regionIds?.length ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAssignBooksModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg transition-all"
                  >
                    <HiPlus className="w-5 h-5" />
                    Kitap tanımla
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {readingWithBooks.map((item) => {
                  const total =
                    item.totalPages || item.book?.pageCount || 0;
                  const completed = item.completedPages || 0;
                  const percent =
                    total > 0
                      ? Math.min(100, Math.round((completed / total) * 100))
                      : 0;
                  const isCompleted = total > 0 && completed >= total;

                  return (
                    <div
                      key={item.id}
                      className="relative p-4 rounded-xl border border-gray-200 bg-gradient-to-br from-white to-blue-50/30"
                    >
                      {canManageReading && (
                        <button
                          type="button"
                          onClick={() => handleRemoveBook(item)}
                          className="absolute top-3 right-3 p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Kitabı kaldır"
                        >
                          <HiX className="w-4 h-4" />
                        </button>
                      )}
                      <div
                        className={`flex flex-col gap-3 ${
                          canManageReading ? 'pr-8' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {item.book?.title || 'Bilinmeyen Kitap'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {item.book?.author}
                            </p>
                          </div>
                          {isCompleted ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-medium">
                              <HiCheck className="w-4 h-4" />
                              Tamamlandı
                            </span>
                          ) : (
                            <span className="text-sm font-semibold text-blue-600">
                              %{percent}
                            </span>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="w-full h-3 rounded-full bg-gray-200 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isCompleted
                                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                                  : 'bg-gradient-to-r from-blue-500 to-blue-600'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-500">
                            {completed} / {total} sayfa
                          </p>
                        </div>
                        {canManageReading && (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setAdvancingProgress(item);
                                setAdvancePages(String(item.completedPages || 0));
                                setShowAdvanceModal(true);
                              }}
                              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                            >
                              <HiArrowUp className="w-4 h-4" />
                              {isCompleted ? 'Sayfayı güncelle' : 'Okumayı ilerlet'}
                            </button>
                            {!isCompleted && total > 0 && (
                              <button
                                type="button"
                                onClick={() => handleCompleteBook(item)}
                                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                              >
                                <HiCheck className="w-4 h-4" />
                                Kitabı tamamla
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {canManageReading &&
                  (user.regionIds?.length ?? 0) > 0 &&
                  availableBooksForUser.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAssignBooksModal(true)}
                      className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <HiPlus className="w-5 h-5" />
                      Yeni kitap ekle
                    </button>
                  )}
              </div>
            )}
          </section>

          {/* Bildirimler */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                <HiBell className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                  Bildirimler
                </h2>
                <p className="text-xs sm:text-sm text-gray-500">
                  Bu kullanıcıya gönderilen bildirimler ve etkinlik geçmişi
                  için ayrılmış alan.
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Bildirim geçmişi ve kullanıcı aktiviteleri daha sonra burada
              gösterilecek.
            </p>
          </section>

          {isAdmin && (
            <section className="pt-8 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={handleDeleteUser}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                <HiTrash className="w-5 h-5" />
                Kişiyi sil
              </button>
            </section>
          )}
        </div>
      </div>

      {/* Yeni ders ekle modal */}
      {showAddLectureModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => {
            setShowAddLectureModal(false);
            setSelectedScheduleIds([]);
          }}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-large overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Yeni ders ekle
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Katılabileceği derslerden bir veya birden fazlasını seçin
              </p>
            </div>
            <div className="max-h-72 overflow-y-auto p-4">
              {availableSchedules.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">
                  {!user?.regionIds?.length
                    ? 'Bu kullanıcının bölgesi tanımlı değil.'
                    : 'Katılabileceği aktif ders bulunamadı veya zaten tüm derslere katılıyor.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {availableSchedules.map((schedule) => (
                    <label
                      key={schedule.id}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
                        selectedScheduleIds.includes(schedule.id)
                          ? 'border-primary-400 bg-primary-50/50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedScheduleIds.includes(schedule.id)}
                        onChange={() => toggleScheduleSelection(schedule.id)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="flex-1 font-medium text-gray-900">
                        {schedule.lectureName}
                      </span>
                      <span className="text-xs text-gray-500 shrink-0">
                        {regions?.find((r) => r.id === schedule.regionId)?.name ??
                          schedule.regionId}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 space-y-2">
              {availableSchedules.length > 0 && (
                <button
                  type="button"
                  onClick={handleAddSelectedLectures}
                  disabled={selectedScheduleIds.length === 0}
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Ekle {selectedScheduleIds.length > 0 && `(${selectedScheduleIds.length})`}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowAddLectureModal(false);
                  setSelectedScheduleIds([]);
                }}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kitap tanımla modal */}
      {showAssignBooksModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => {
            setShowAssignBooksModal(false);
            setSelectedBookIds([]);
          }}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-large overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Kitap tanımla
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Bölgedeki kitaplardan okunacak kitapları seçin
              </p>
            </div>
            <div className="max-h-72 overflow-y-auto p-4">
              {availableBooksForUser.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">
                  {!user?.regionIds?.length
                    ? 'Bu kullanıcının bölgesi tanımlı değil.'
                    : 'Tanımlanabilecek kitap bulunamadı veya tüm kitaplar zaten tanımlı.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {availableBooksForUser.map((book) => (
                    <label
                      key={book.id}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
                        selectedBookIds.includes(book.id)
                          ? 'border-blue-400 bg-blue-50/50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedBookIds.includes(book.id)}
                        onChange={() =>
                          setSelectedBookIds((prev) =>
                            prev.includes(book.id)
                              ? prev.filter((id) => id !== book.id)
                              : [...prev, book.id],
                          )
                        }
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-gray-900 block truncate">
                          {book.title}
                        </span>
                        <span className="text-xs text-gray-500">
                          {book.author}
                          {book.pageCount ? ` • ${book.pageCount} sayfa` : ''}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 space-y-2">
              {availableBooksForUser.length > 0 && (
                <button
                  type="button"
                  onClick={handleAssignBooks}
                  disabled={selectedBookIds.length === 0}
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Tanımla{selectedBookIds.length > 0 && ` (${selectedBookIds.length})`}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowAssignBooksModal(false);
                  setSelectedBookIds([]);
                }}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Okumayı ilerlet modal */}
      {showAdvanceModal && advancingProgress && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => {
            setShowAdvanceModal(false);
            setAdvancingProgress(null);
            setAdvancePages('');
          }}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm shadow-large overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Okumayı ilerlet
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {books?.find((b) => b.id === advancingProgress.bookId)?.title ||
                  'Kitap'}
              </p>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600">
                Toplam: {advancingProgress.totalPages} sayfa
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tamamlanan sayfa sayısı
                </label>
                <input
                  type="number"
                  min="0"
                  max={Math.max(0, advancingProgress.totalPages || 0)}
                  value={advancePages}
                  onChange={(e) => setAdvancePages(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {(advancingProgress.totalPages || 0) > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    0 – {advancingProgress.totalPages} arasında girebilirsiniz
                  </p>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex gap-2">
              <button
                type="button"
                onClick={handleAdvanceReading}
                disabled={!advancePages.trim()}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Ekle
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAdvanceModal(false);
                  setAdvancingProgress(null);
                  setAdvancePages('');
                }}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bölge ekle modal */}
      {showAddRegionModal && user && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => {
            setShowAddRegionModal(false);
            setSelectedRegionId('');
          }}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-large overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Bölge ekle
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Kullanıcıyı eklemek istediğiniz bölgeyi seçin
              </p>
            </div>
            <div className="max-h-72 overflow-y-auto p-4">
              {(regions ?? []).filter(
                (r) => !(user.regionIds ?? []).includes(r.id),
              ).length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">
                  Eklenebilecek bölge kalmadı.
                </p>
              ) : (
                <div className="space-y-2">
                  {(regions ?? [])
                    .filter((r) => !(user.regionIds ?? []).includes(r.id))
                    .map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() =>
                          setSelectedRegionId((prev) =>
                            prev === r.id ? '' : r.id,
                          )
                        }
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                          selectedRegionId === r.id
                            ? 'border-amber-400 bg-amber-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            selectedRegionId === r.id
                              ? 'border-amber-600 bg-amber-600'
                              : 'border-gray-300'
                          }`}
                        >
                          {selectedRegionId === r.id && (
                            <HiCheck className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <span className="font-medium text-gray-900">
                          {r.name}
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 space-y-2">
              {(regions ?? []).filter(
                (r) => !(user.regionIds ?? []).includes(r.id),
              ).length > 0 && (
                <button
                  type="button"
                  onClick={handleAddRegion}
                  disabled={!selectedRegionId}
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Ekle
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowAddRegionModal(false);
                  setSelectedRegionId('');
                }}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hoca Kimliği - Ekle modal */}
      {showAddQualificationModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={closeQualificationModals}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-large overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Hoca Kimliği Ekle
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                İlim alanı ve tahsil yeri bilgilerini girin
              </p>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  İlim Alanı
                </label>
                <input
                  type="text"
                  value={qualificationFieldOfKnowledge}
                  onChange={(e) => setQualificationFieldOfKnowledge(e.target.value)}
                  placeholder="Örn: Tefsir, Hadis, Fıkıh"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Tahsil Yeri
                </label>
                <input
                  type="text"
                  value={qualificationPlaceOfStudy}
                  onChange={(e) => setQualificationPlaceOfStudy(e.target.value)}
                  placeholder="Eğitim kurumu adı"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Açıklama
                </label>
                <textarea
                  value={qualificationDescription}
                  onChange={(e) => setQualificationDescription(e.target.value)}
                  placeholder="Detaylı açıklama"
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex gap-2">
              <button
                type="button"
                onClick={handleAddQualification}
                disabled={!qualificationFieldOfKnowledge.trim() && !qualificationPlaceOfStudy.trim() && !qualificationDescription.trim()}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Kaydet
              </button>
              <button
                type="button"
                onClick={closeQualificationModals}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hoca Kimliği - Düzenle modal */}
      {showEditQualificationModal && editingQualification && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={closeQualificationModals}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-large overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Hoca Kimliği Düzenle
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Kaydı güncelleyin
              </p>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  İlim Alanı
                </label>
                <input
                  type="text"
                  value={qualificationFieldOfKnowledge}
                  onChange={(e) => setQualificationFieldOfKnowledge(e.target.value)}
                  placeholder="Örn: Tefsir, Hadis, Fıkıh"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Tahsil Yeri
                </label>
                <input
                  type="text"
                  value={qualificationPlaceOfStudy}
                  onChange={(e) => setQualificationPlaceOfStudy(e.target.value)}
                  placeholder="Eğitim kurumu adı"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Açıklama
                </label>
                <textarea
                  value={qualificationDescription}
                  onChange={(e) => setQualificationDescription(e.target.value)}
                  placeholder="Detaylı açıklama"
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex gap-2">
              <button
                type="button"
                onClick={handleUpdateQualification}
                disabled={!qualificationFieldOfKnowledge.trim() && !qualificationPlaceOfStudy.trim() && !qualificationDescription.trim()}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Güncelle
              </button>
              <button
                type="button"
                onClick={closeQualificationModals}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

