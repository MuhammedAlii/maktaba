import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCollection } from '../../hooks/useFirestore';
import { useAuth } from '../../contexts/AuthContext';
import { Timestamp, where } from 'firebase/firestore';
import {
  HiAcademicCap,
  HiArrowLeft,
  HiBookOpen,
  HiCalendar,
  HiClock,
  HiUserAdd,
  HiChevronRight,
} from 'react-icons/hi';
import { createLessonJoinRequest, rejectLessonJoinRequest } from '../../services/lessonJoinRequestService';
import { showError, showLoading, hideLoading, showConfirm } from '../../services/notificationService';

interface LessonJoinRequest {
  id: string;
  userId: string;
  scheduleId: string;
  regionId: string;
  createdAt: Timestamp;
}

interface Region {
  id: string;
  name: string;
  isActive?: boolean;
}

interface RegionLectureSchedule {
  id: string;
  regionId: string;
  lectureName: string;
  teacherId: string;
  daysOfWeek: number[];
  startDate: Timestamp;
  endDate: Timestamp;
  startTimeMinutes: number;
  endTimeMinutes: number;
}

interface User {
  id: string;
  name: string;
  lastname?: string;
  role: string;
  regionIds?: string[];
  userLectureIds?: string[];
}

const DAY_NAMES = ['', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export default function UserLessons() {
  const { user } = useAuth();
  const regionIds = user?.regionIds ?? [];
  const isApproved = user?.role !== 'user' || user?.isUserApproved === true;

  const { data: regions } = useCollection<Region>('regions', [
    where('isActive', '==', true),
  ]);
  const { data: allSchedules } = useCollection<RegionLectureSchedule>('regionLectureSchedules');
  const { data: allUsers } = useCollection<User>('users');
  const { data: joinRequests } = useCollection<LessonJoinRequest>(
    'lessonJoinRequests',
    user ? [where('userId', '==', user.id)] : [where('userId', '==', '')]
  );
  const [requestingScheduleId, setRequestingScheduleId] = useState<string | null>(null);
  const [cancelingRequestId, setCancelingRequestId] = useState<string | null>(null);

  const activeSchedules = useMemo(() => {
    if (!allSchedules || regionIds.length === 0) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return allSchedules.filter((s) => {
      if (!regionIds.includes(s.regionId)) return false;
      const endDate = s.endDate?.toDate?.() ?? new Date(0);
      return endDate >= today;
    });
  }, [allSchedules, regionIds]);

  const scheduleTeacherMap = useMemo(() => {
    const teachers = allUsers?.filter(
      (u) =>
        u.role === 'teacher' &&
        (u.regionIds ?? []).some((rid) => regionIds.includes(rid))
    ) ?? [];
    const m = new Map<string, User>();
    teachers.forEach((t) => m.set(t.id, t));
    return m;
  }, [allUsers, regionIds]);

  const regionMap = useMemo(() => {
    const m = new Map<string, Region>();
    regions?.forEach((r) => m.set(r.id, r));
    return m;
  }, [regions]);

  const pendingRequestScheduleIds = useMemo(
    () => new Set(joinRequests?.map((r) => r.scheduleId) ?? []),
    [joinRequests]
  );

  const requestByScheduleId = useMemo(() => {
    const m = new Map<string, LessonJoinRequest>();
    joinRequests?.forEach((r) => m.set(r.scheduleId, r));
    return m;
  }, [joinRequests]);

  const handleJoinRequest = async (scheduleId: string, regionId: string) => {
    if (!user) return;
    setRequestingScheduleId(scheduleId);
    showLoading('İstek gönderiliyor...');
    try {
      await createLessonJoinRequest(user.id, scheduleId, regionId);
      hideLoading();
      setRequestingScheduleId(null);
      // await showSuccess('Katılım isteğiniz alındı. Yönetici onayından sonra derse eklenirsiniz.');
    } catch (error) {
      hideLoading();
      setRequestingScheduleId(null);
      await showError(error instanceof Error ? error.message : 'İstek gönderilirken bir hata oluştu.');
    }
  };

  const handleCancelJoinRequest = async (scheduleId: string) => {
    const req = requestByScheduleId.get(scheduleId);
    if (!req) return;
    const ok = await showConfirm(
      'Katılım isteğinizi iptal etmek istediğinize emin misiniz?',
      'İsteği İptal Et',
      {
        confirmButtonText: 'Evet, İptal Et',
        cancelButtonText: 'Hayır',
        icon: 'warning',
        confirmButtonColor: '#dc2626',
      },
    );
    if (!ok) return;
    setCancelingRequestId(scheduleId);
    try {
      await rejectLessonJoinRequest(req.id);
      // await showSuccess('Katılım isteği iptal edildi.');
    } catch (err) {
      await showError(err instanceof Error ? err.message : 'İptal işlemi sırasında hata oluştu.');
    } finally {
      setCancelingRequestId(null);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-emerald-600"
        >
          <HiArrowLeft className="w-4 h-4" />
          Ana sayfa
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <HiBookOpen className="w-7 h-7 text-emerald-600" />
          Bölgenizdeki Dersler
        </h1>
        <p className="text-gray-600 mt-1">
          Dahil olduğunuz bölgelerdeki tüm aktif ders planları
        </p>
        {!isApproved && (
          <p className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-xl mt-4 inline-block">
            Katılım için yönetici onayı bekleniyor
          </p>
        )}
      </div>

      {activeSchedules.length === 0 ? (
        <div className="rounded-2xl bg-gray-50 border border-gray-200 p-8 text-center">
          <p className="text-gray-600">Bölgenizde şu an aktif ders planı bulunmuyor.</p>
          <Link to="/" className="inline-block mt-4 text-emerald-600 hover:text-emerald-700 font-medium">
            Ana sayfaya dön
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {activeSchedules.map((s) => {
            const teacher = scheduleTeacherMap.get(s.teacherId);
            const teacherName = teacher
              ? [teacher.name, teacher.lastname].filter(Boolean).join(' ')
              : 'Hoca';
            const region = regionMap.get(s.regionId);
            const daysStr = s.daysOfWeek
              .sort((a, b) => a - b)
              .map((d) => DAY_NAMES[d])
              .join(', ');
            const isInLesson = (user.userLectureIds ?? []).includes(s.id);
            const hasPendingRequest = pendingRequestScheduleIds.has(s.id);
            const canRequestJoin = isApproved && !isInLesson && !hasPendingRequest;

            return (
              <div
                key={s.id}
                className={`rounded-xl sm:rounded-2xl p-5 border transition-all ${
                  isApproved
                    ? 'bg-white shadow-soft border-gray-100'
                    : 'bg-gray-50/80 border-gray-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900">{s.lectureName}</h3>
                    {region && (
                      <p className="text-xs text-emerald-600 font-medium mt-1">{region.name}</p>
                    )}
                    <p className="text-sm text-gray-500 mt-2 flex items-center gap-1.5">
                      <HiAcademicCap className="w-4 h-4" />
                      {teacherName}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                      <HiClock className="w-4 h-4" />
                      {daysStr} · {formatTime(s.startTimeMinutes)} - {formatTime(s.endTimeMinutes)}
                    </p>
                    {s.startDate?.toDate && s.endDate?.toDate && (
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
                        <HiCalendar className="w-3 h-3" />
                        {s.startDate.toDate().toLocaleDateString('tr-TR')} -{' '}
                        {s.endDate.toDate().toLocaleDateString('tr-TR')}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0 w-full sm:w-auto flex pt-3 sm:pt-0 sm:pl-2 mt-2 sm:mt-0">
                    {isInLesson ? (
                      <Link
                        to={`/my-lessons/${s.id}`}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-emerald-600 bg-emerald-50 hover:bg-emerald-100 font-medium text-sm transition-colors"
                      >
                        <HiChevronRight className="w-4 h-4" />
                        Derse git
                      </Link>
                    ) : hasPendingRequest ? (
                      <div className="w-full sm:w-auto flex items-center justify-center gap-2">
                        <span className="px-3 py-2 rounded-lg text-amber-700 bg-amber-50 border border-amber-200 text-sm">
                          Onay bekleniyor
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCancelJoinRequest(s.id)}
                          disabled={cancelingRequestId === s.id}
                          className="px-3 py-2 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {cancelingRequestId === s.id ? 'İptal ediliyor...' : 'Vazgeç'}
                        </button>
                      </div>
                    ) : canRequestJoin ? (
                      <button
                        type="button"
                        onClick={() => handleJoinRequest(s.id, s.regionId)}
                        disabled={requestingScheduleId === s.id}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 font-medium text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <HiUserAdd className="w-4 h-4" />
                        {requestingScheduleId === s.id ? 'Gönderiliyor...' : 'Katılma isteğinde bulun'}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
