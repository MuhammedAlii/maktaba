import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCollection } from '../../hooks/useFirestore';
import { useAuth } from '../../contexts/AuthContext';
import { Timestamp, where } from 'firebase/firestore';
import {
  HiAcademicCap,
  HiLocationMarker,
  HiCalendar,
  HiMap,
  HiBookOpen,
  HiBell,
  HiExclamation,
  HiClock,
  HiChevronRight,
  HiUserAdd,
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
import type { GeoPoint } from 'firebase/firestore';

interface Region {
  id: string;
  name: string;
  description?: string;
  address?: string;
  mapLocation?: GeoPoint;
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
  email?: string;
  phone?: string;
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

/** Bugün bu planın günlerinden biri mi ve tarih aralığı içinde mi (TodayLessonNotification ile aynı mantık). */
function isScheduleOccurringToday(schedule: RegionLectureSchedule): boolean {
  const today = new Date();
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);
  const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay();
  if (!schedule.daysOfWeek?.includes(dayOfWeek)) return false;
  const start = schedule.startDate?.toDate?.() ?? new Date(0);
  const end = schedule.endDate?.toDate?.() ?? new Date(0);
  return start <= todayEnd && end >= todayStart;
}

export default function UserHome() {
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

  const userRegions = useMemo(
    () => regions?.filter((r) => regionIds.includes(r.id)) ?? [],
    [regions, regionIds]
  );

  const mySchedules = useMemo(() => {
    if (!allSchedules || !user?.userLectureIds?.length) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ids = new Set(user.userLectureIds);
    return allSchedules.filter((s) => {
      if (!ids.has(s.id)) return false;
      const endDate = s.endDate?.toDate?.() ?? new Date(0);
      return endDate >= today;
    });
  }, [allSchedules, user?.userLectureIds]);

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

  const regionTeachers = useMemo(() => {
    if (!allUsers || regionIds.length === 0) return [];
    return allUsers.filter(
      (u) =>
        u.role === 'teacher' &&
        (u.regionIds ?? []).some((rid) => regionIds.includes(rid))
    );
  }, [allUsers, regionIds]);

  const scheduleTeacherMap = useMemo(() => {
    const m = new Map<string, User>();
    regionTeachers.forEach((t) => m.set(t.id, t));
    return m;
  }, [regionTeachers]);

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
    <div className="space-y-8 sm:space-y-12">
      {/* Hero / Karşılama */}
      <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-600 p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative">
          <h1 className="text-2xl sm:text-3xl font-bold mb-1">
            Merhaba, {user.name}
          </h1>
          <p className="text-emerald-100 text-sm sm:text-base">
            {isApproved
              ? 'Ders halkalarına katılım ve kitaplarınız burada.'
              : 'Hesabınız onay bekliyor. Aşağıda bölgenizdeki dersleri ve hocaları inceleyebilirsiniz.'}
          </p>
          {!isApproved && (
            <div className="mt-4 flex items-start gap-3 p-3 rounded-xl bg-white/15 backdrop-blur-sm">
              <HiExclamation className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">
                Derslere katılmak ve günlük vird girişi yapmak için yönetici onayı gerekmektedir.
                Onaylandıktan sonra ders ekleyebilecek, kitaplarınıza ve vird takibine erişebileceksiniz.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Bugünkü Vird Girişi */}
      <section className={!isApproved ? 'opacity-75' : ''}>
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 mb-3 flex-wrap">
          <HiBookOpen className="w-5 h-5 text-emerald-600" />
          Bugünkü Vird Girişi
          {!isApproved && (
            <span className="text-xs font-normal text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
              Giriş için onay bekleniyor
            </span>
          )}
        </h2>
        <div
          className={`rounded-xl sm:rounded-2xl p-4 sm:p-5 border shadow-soft ${
            isApproved ? 'border-gray-100 bg-white' : 'border-gray-200 bg-gray-50/80'
          }`}
        >
          <p className="text-sm text-gray-600">
            {isApproved
              ? 'Aktif virdlerin günlük okuma/tesbih sayısını buradan girebilirsiniz.'
              : 'Hesabınız onaylandıktan sonra günlük vird girişi yapabileceksiniz.'}
          </p>
          <div className="mt-4">
            {isApproved ? (
              <Link
                to="/vird-takip"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 transition-all"
              >
                Vird Girişi Yap
              </Link>
            ) : (
              <span
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-500 bg-gray-200/90 cursor-not-allowed select-none"
                aria-disabled
              >
                Vird Girişi Yap
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Benim Derslerim - kullanıcının katıldığı dersler */}
      {mySchedules.length > 0 && isApproved && (
        <section>
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 mb-4">
            <HiAcademicCap className="w-5 h-5 text-emerald-600" />
            Benim Derslerim
          </h2>
          <div className="space-y-3">
            {mySchedules.slice(0, 3).map((s) => {
              const teacher = scheduleTeacherMap.get(s.teacherId);
              const teacherName = teacher
                ? [teacher.name, teacher.lastname].filter(Boolean).join(' ')
                : 'Hoca';
              const daysStr = s.daysOfWeek
                .sort((a, b) => a - b)
                .map((d) => DAY_NAMES[d])
                .join(', ');
              const isToday = isScheduleOccurringToday(s);

              return (
                <div
                  key={s.id}
                  className="relative rounded-xl sm:rounded-2xl border transition-all bg-white shadow-soft border-gray-100 hover:shadow-medium hover:border-emerald-200"
                >
                  <Link
                    to={`/my-lessons/${s.id}`}
                    className={`block p-4 sm:p-5 text-left ${isToday ? 'pr-11 sm:pr-12' : ''}`}
                  >
                    <h3 className="font-semibold text-gray-900">{s.lectureName}</h3>
                    <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
                      <HiAcademicCap className="w-4 h-4 flex-shrink-0" />
                      {teacherName}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                      <HiClock className="w-4 h-4 flex-shrink-0" />
                      {daysStr} · {formatTime(s.startTimeMinutes)} - {formatTime(s.endTimeMinutes)}
                    </p>
                  </Link>
                  {isToday && (
                    <Link
                      to={`/my-lessons/${s.id}`}
                      title="Bugün bu ders var — katılımı işaretlemek için tıklayın"
                      aria-label="Bugün bu ders var, katılım sayfasına git"
                      className="absolute top-3 right-3 sm:top-4 sm:right-4 rounded-lg p-1 text-amber-600 hover:bg-amber-50/90 transition-colors"
                    >
                      <HiBell className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
          {mySchedules.length > 3 && (
            <Link
              to="/my-lessons"
              className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed border-emerald-200 text-emerald-600 font-medium hover:bg-emerald-50 hover:border-emerald-300 transition-colors"
            >
              Devamını gör
              <HiChevronRight className="w-5 h-5" />
            </Link>
          )}
        </section>
      )}

      {/* Aktif Dersler - en fazla 3, devamı için link */}
      {activeSchedules.length > 0 && (
        <section className={!isApproved ? 'opacity-75' : ''}>
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 mb-4">
            <HiBookOpen className="w-5 h-5 text-emerald-600" />
            Bölgedeki Dersler
            {!isApproved && (
              <span className="text-xs font-normal text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                Katılım için onay bekleniyor
              </span>
            )}
          </h2>
          <div className="space-y-3">
            {activeSchedules.slice(0, 3).map((s) => {
              const teacher = scheduleTeacherMap.get(s.teacherId);
              const teacherName = teacher
                ? [teacher.name, teacher.lastname].filter(Boolean).join(' ')
                : 'Hoca';
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
                  className={`rounded-xl sm:rounded-2xl p-4 sm:p-5 border transition-all ${
                    isApproved
                      ? 'bg-white shadow-soft border-gray-100'
                      : 'bg-gray-50/80 border-gray-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900">{s.lectureName}</h3>
                      <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
                        <HiAcademicCap className="w-4 h-4 flex-shrink-0" />
                        {teacherName}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                        <HiClock className="w-4 h-4 flex-shrink-0" />
                        {daysStr} · {formatTime(s.startTimeMinutes)} - {formatTime(s.endTimeMinutes)}
                      </p>
                      {s.startDate?.toDate && s.endDate?.toDate && (
                        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1.5">
                          <HiCalendar className="w-4 h-4 flex-shrink-0" />
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
                          <span className="w-full text-center px-3 py-2 rounded-lg text-amber-700 bg-amber-50 border border-amber-200 text-sm">
                            Onay bekleniyor
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCancelJoinRequest(s.id)}
                            disabled={cancelingRequestId === s.id}
                            className="w-full px-3 py-2 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
          {activeSchedules.length > 3 && (
            <Link
              to="/region-lessons"
              className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed border-emerald-200 text-emerald-600 font-medium hover:bg-emerald-50 hover:border-emerald-300 transition-colors"
            >
              Devamını gör
              <HiChevronRight className="w-5 h-5" />
            </Link>
          )}
        </section>
      )}

      {/* Hocalar - en fazla 4, devamı için link */}
      {regionTeachers.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 mb-4">
            <HiAcademicCap className="w-5 h-5 text-emerald-600" />
            Bölge Hocaları
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {regionTeachers.slice(0, 4).map((teacher) => {
              const teacherName = [teacher.name, teacher.lastname].filter(Boolean).join(' ');

              return (
                <div
                  key={teacher.id}
                  className="rounded-xl sm:rounded-2xl bg-white p-5 shadow-soft border border-gray-100 flex flex-row items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900">{teacherName}</h3>
                    {teacher.email && (
                      <p className="text-sm text-gray-600 mt-1 truncate">{teacher.email}</p>
                    )}
                  </div>
                  <Link
                    to={`/teachers/${teacher.id}`}
                    className="flex-shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-xl hover:bg-emerald-100 border border-emerald-200 transition-colors"
                  >
                    <HiChevronRight className="w-4 h-4" />
                    Detay
                  </Link>
                </div>
              );
            })}
          </div>
          {regionTeachers.length > 4 && (
            <Link
              to="/teachers"
              className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed border-emerald-200 text-emerald-600 font-medium hover:bg-emerald-50 hover:border-emerald-300 transition-colors"
            >
              Devamını gör
              <HiChevronRight className="w-5 h-5" />
            </Link>
          )}
        </section>
      )}

      {/* Boş durumlar */}
      {userRegions.length === 0 && (
        <section className="rounded-2xl bg-amber-50 border border-amber-200 p-6 text-center">
          <p className="text-amber-800">
            Henüz bir bölgeye atanmadınız. Yöneticinizle iletişime geçin.
          </p>
        </section>
      )}

      {activeSchedules.length === 0 && userRegions.length > 0 && (
        <section className="rounded-2xl bg-gray-50 border border-gray-200 p-6 text-center">
          <p className="text-gray-600">
            Bölgenizde şu an aktif ders planı bulunmuyor.
          </p>
        </section>
      )}

      {/* Hızlı Erişim - Ekstra */}
      {isApproved && (
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Hızlı Erişim</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              to="/my-books"
              className="flex items-center gap-4 p-4 rounded-xl bg-white shadow-soft border border-gray-100 hover:shadow-medium hover:border-emerald-200 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <HiBookOpen className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <span className="block font-medium text-gray-900">Kitaplarım</span>
                <span className="text-sm text-gray-500">Ders kitaplarınız ve okuma ilerlemeniz</span>
              </div>
            </Link>
            <Link
              to="/notifications"
              className="flex items-center gap-4 p-4 rounded-xl bg-white shadow-soft border border-gray-100 hover:shadow-medium hover:border-emerald-200 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                <HiBell className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <span className="block font-medium text-gray-900">Bildirimler</span>
                <span className="text-sm text-gray-500">Bildirimlerinizi ve etkinlik geçmişinizi görüntüleyin</span>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* Bölgeniz - en altta */}
      {userRegions.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 mb-4">
            <HiLocationMarker className="w-5 h-5 text-emerald-600" />
            Bölgeniz
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {userRegions.map((region) => {
              const lat = region.mapLocation?.latitude;
              const lng = region.mapLocation?.longitude;
              const hasCoords = lat != null && lng != null;
              const mapsUrl = hasCoords
                ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
                : region.address
                  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(region.address)}`
                  : null;

              return (
                <div
                  key={region.id}
                  className="rounded-xl sm:rounded-2xl bg-white p-5 shadow-soft border border-gray-100 hover:shadow-medium transition-shadow"
                >
                  <h3 className="font-semibold text-gray-900 mb-1">{region.name}</h3>
                  {region.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {region.description}
                    </p>
                  )}
                  {region.address && (
                    <p className="text-xs text-gray-500 flex items-start gap-1.5 mb-3">
                      <HiMap className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      {region.address}
                    </p>
                  )}
                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors"
                    >
                      <HiMap className="w-4 h-4" />
                      Yol Tarifi Al
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
