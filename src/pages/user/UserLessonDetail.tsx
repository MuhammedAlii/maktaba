import { useMemo, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { useCollection, firestoreHelpers } from '../../hooks/useFirestore';
import { useAuth } from '../../contexts/AuthContext';
import { Timestamp, where } from 'firebase/firestore';
import {
  HiArrowLeft,
  HiAcademicCap,
  HiClock,
  HiCalendar,
  HiCheck,
  HiX,
} from 'react-icons/hi';
import {
  showError,
  showLoading,
  hideLoading,
  showConfirm,
} from '../../services/notificationService';

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

interface UserLectureAttendance {
  id: string;
  userId: string;
  scheduleId: string;
  date: Timestamp;
  attended: boolean;
}

interface User {
  id: string;
  name: string;
  lastname?: string;
}

const DAY_NAMES = ['', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

const toLocalDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export default function UserLessonDetail() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const { user } = useAuth();

  const { data: schedules } = useCollection<RegionLectureSchedule>('regionLectureSchedules');
  const { data: attendance } = useCollection<UserLectureAttendance>(
    'userLectureAttendance',
    user ? [where('userId', '==', user.id)] : []
  );
  const { data: allUsers } = useCollection<User>('users');
  const [cancelingAttendance, setCancelingAttendance] = useState(false);

  const schedule = useMemo(
    () => schedules?.find((s) => s.id === scheduleId) ?? null,
    [schedules, scheduleId]
  );

  const isMyLesson = useMemo(() => {
    if (!user || !schedule) return false;
    return (user.userLectureIds ?? []).includes(schedule.id);
  }, [user, schedule]);

  const { cells, totalPlanned, totalAttended, overallPercent, isTodayLessonDay, todayAttended, todayAttendanceRecord } = useMemo(() => {
    if (!schedule || !user) {
      return {
        cells: [] as { date: Date; key: string; percent: number; planned: number; attended: number }[],
        totalPlanned: 0,
        totalAttended: 0,
        overallPercent: 0,
        isTodayLessonDay: false,
        todayAttended: false,
        todayAttendanceRecord: null as UserLectureAttendance | null,
      };
    }

    const attendanceByKey: Record<string, UserLectureAttendance> = {};
    attendance
      .filter((rec) => rec.scheduleId === schedule.id)
      .forEach((rec) => {
        const d = rec.date.toDate();
        attendanceByKey[`${rec.scheduleId}_${toLocalDateKey(d)}`] = rec;
      });

    const start = new Date(schedule.startDate.toDate());
    const end = new Date(schedule.endDate.toDate());
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const allDates: Date[] = [];
    const d = new Date(start);
    while (d <= end) {
      allDates.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }

    const cells: { date: Date; key: string; percent: number; planned: number; attended: number }[] = [];
    let totalPlanned = 0;
    let totalAttended = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let isTodayLessonDay = false;
    let todayAttended = false;
    let todayAttendanceRecord: UserLectureAttendance | null = null;
    const todayKey = toLocalDateKey(today);

    allDates.forEach((date) => {
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
        totalPlanned += 1;
        const rec = attendanceByKey[`${schedule.id}_${key}`];
        if (rec?.attended) {
          attendedCount = 1;
          totalAttended += 1;
        }
        if (key === todayKey) {
          isTodayLessonDay = true;
          todayAttended = attendedCount > 0;
          if (rec) todayAttendanceRecord = rec;
        }
      }

      const percent = planned > 0 ? attendedCount / planned : 0;
      cells.push({ date: new Date(date), key, percent, planned, attended: attendedCount });
    });

    const overallPercent = totalPlanned > 0 ? Math.round((totalAttended / totalPlanned) * 100) : 0;

    return { cells, totalPlanned, totalAttended, overallPercent, isTodayLessonDay, todayAttended, todayAttendanceRecord };
  }, [schedule, user, attendance]);

  const getHeatColor = (planned: number, attended: number) => {
    if (planned === 0) return 'bg-gray-100';
    if (planned > 0 && attended === 0) return 'bg-emerald-100';
    return 'bg-emerald-600';
  };

  const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const numCols = Math.max(1, Math.ceil(cells.length / 7));
  const monthRanges = useMemo(() => {
    const ranges: { month: string; startCol: number; endCol: number }[] = [];
    let rangeStart = 0;
    let rangeMonth = '';
    for (let col = 0; col < numCols; col++) {
      const cellIdx = col * 7;
      if (cellIdx >= cells.length) break;
      const m = monthNames[cells[cellIdx].date.getMonth()];
      if (m !== rangeMonth) {
        if (rangeMonth) ranges.push({ month: rangeMonth, startCol: rangeStart, endCol: col - 1 });
        rangeStart = col;
        rangeMonth = m;
      }
    }
    if (rangeMonth) ranges.push({ month: rangeMonth, startCol: rangeStart, endCol: numCols - 1 });
    return ranges;
  }, [cells, numCols]);

  const handleMarkTodayAttended = async () => {
    if (!user || !schedule || !isTodayLessonDay || todayAttended) return;

    const dateKey = toLocalDateKey(new Date());

    const existing = attendance?.find((rec) => {
      if (rec.scheduleId !== schedule.id || rec.userId !== user.id) return false;
      return toLocalDateKey(rec.date.toDate()) === dateKey;
    });

    try {
      showLoading('Kaydediliyor...');

      if (existing) {
        await firestoreHelpers.update<UserLectureAttendance>(
          'userLectureAttendance',
          existing.id,
          { attended: true }
        );
      } else {
        await firestoreHelpers.add('userLectureAttendance', {
          userId: user.id,
          scheduleId: schedule.id,
          regionId: schedule.regionId,
          date: Timestamp.fromDate(new Date(`${dateKey}T00:00:00`)),
          attended: true,
        });
      }

      hideLoading();
      // await showSuccess('Katılım kaydedildi.');
    } catch (error) {
      hideLoading();
      await showError('Kayıt sırasında bir hata oluştu.');
    }
  };

  const handleCancelTodayAttended = async () => {
    if (!todayAttendanceRecord) return;

    const ok = await showConfirm(
      'Bugünkü katılım kaydını iptal etmek istediğinize emin misiniz?',
      'Katılımı İptal Et',
      {
        confirmButtonText: 'Evet, İptal Et',
        cancelButtonText: 'Hayır',
        icon: 'warning',
        confirmButtonColor: '#dc2626',
      },
    );
    if (!ok) return;

    setCancelingAttendance(true);
    try {
      showLoading('İptal ediliyor...');
      await firestoreHelpers.delete('userLectureAttendance', todayAttendanceRecord.id);
      hideLoading();
      // await showSuccess('Katılım kaydı iptal edildi.');
    } catch (error) {
      hideLoading();
      await showError('İptal sırasında bir hata oluştu.');
    } finally {
      setCancelingAttendance(false);
    }
  };

  if (!user) return null;
  if (scheduleId && !schedule) {
    return (
      <div className="text-center py-8 text-gray-500">
        Ders bulunamadı. <Link to="/my-lessons" className="text-emerald-600 hover:underline">Geri dön</Link>
      </div>
    );
  }
  if (schedule && !isMyLesson) {
    return <Navigate to="/my-lessons" replace />;
  }
  if (!schedule) return null;

  const teacher = allUsers?.find((u) => u.id === schedule.teacherId);
  const teacherName = teacher ? [teacher.name, teacher.lastname].filter(Boolean).join(' ') : 'Hoca';
  const daysStr = schedule.daysOfWeek
    .sort((a, b) => a - b)
    .map((d) => DAY_NAMES[d])
    .join(', ');

  return (
    <div className="space-y-6">
      <Link
        to="/my-lessons"
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-emerald-600"
      >
        <HiArrowLeft className="w-4 h-4" />
        Derslerime dön
      </Link>

      <div className="rounded-xl bg-white shadow-soft border border-gray-100 p-4 sm:p-6">
        <h1 className="text-xl font-bold text-gray-900">{schedule.lectureName}</h1>
        <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
          <HiAcademicCap className="w-4 h-4" />
          {teacherName}
        </p>
        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
          <HiClock className="w-4 h-4" />
          {daysStr} · {formatTime(schedule.startTimeMinutes)} - {formatTime(schedule.endTimeMinutes)}
        </p>
        {schedule.startDate?.toDate && schedule.endDate?.toDate && (
          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
            <HiCalendar className="w-3 h-3" />
            {schedule.startDate.toDate().toLocaleDateString('tr-TR')} -{' '}
            {schedule.endDate.toDate().toLocaleDateString('tr-TR')}
          </p>
        )}
      </div>

      {/* Katılım timeline */}
      <div className="rounded-xl bg-white shadow-soft border border-gray-100 p-4 sm:p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-2">Katılım Durumu</h2>
        <p className="text-sm text-gray-500 mb-4">
          Planlanan: {totalPlanned} · Katıldığı: {totalAttended} · Katılım: %{overallPercent}
        </p>

        {cells.length > 0 ? (
          <div className="overflow-x-auto min-w-0 -mx-1 px-1">
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
              <div className="flex flex-col shrink-0">
                <div
                  className="relative h-4 text-[10px] text-gray-400 mb-1"
                  style={{
                    width: `calc(${numCols} * 0.75rem + ${Math.max(0, numCols - 1)} * 0.25rem)`,
                  }}
                >
                  {monthRanges.map(({ month, startCol, endCol }) => {
                    const colWidth = 0.75;
                    const gap = 0.25;
                    const left = startCol * (colWidth + gap);
                    const spanCols = endCol - startCol + 1;
                    const width = spanCols * colWidth + (spanCols - 1) * gap;
                    if (width < 1.5) return null;
                    return (
                      <span
                        key={`${month}-${startCol}`}
                        className="absolute top-0 leading-none text-[9px] block overflow-hidden truncate"
                        style={{ left: `${left}rem`, width: `${width}rem` }}
                      >
                        {month}
                      </span>
                    );
                  })}
                </div>
                <div
                  className="inline-grid grid-rows-7 gap-1"
                  style={{
                    gridTemplateColumns: `repeat(${numCols}, minmax(0.75rem, 0.75rem))`,
                  }}
                >
                  {cells.map((cell, idx) => {
                    const day = cell.date.getDay();
                    const row = (day + 6) % 7;
                    const col = Math.floor(idx / 7);
                    return (
                      <div
                        key={cell.key + idx}
                        className={`w-3 h-3 min-w-0 min-h-0 rounded ${getHeatColor(
                          cell.planned,
                          cell.attended
                        )}`}
                        style={{ gridRow: row + 1, gridColumn: col + 1 }}
                        title={cell.key}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Henüz katılım verisi yok.</p>
        )}
      </div>

      {/* Bugün katıldım / İptal et - sayfa altı */}
      {isTodayLessonDay && (
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-center gap-3 pt-2">
          {todayAttended ? (
            <>
              <div className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-emerald-100 text-emerald-700 font-medium">
                <HiCheck className="w-5 h-5" />
                Bugün katıldınız
              </div>
              <button
                type="button"
                onClick={handleCancelTodayAttended}
                disabled={cancelingAttendance}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <HiX className="w-5 h-5" />
                {cancelingAttendance ? 'İptal ediliyor...' : 'İptal et'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleMarkTodayAttended}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
            >
              <HiCheck className="w-5 h-5" />
              Bugün katıldım
            </button>
          )}
        </div>
      )}
    </div>
  );
}
