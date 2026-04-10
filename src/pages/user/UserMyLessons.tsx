import { useMemo } from 'react';
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
} from 'react-icons/hi';

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
}

interface Region {
  id: string;
  name: string;
  isActive?: boolean;
}

const DAY_NAMES = ['', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export default function UserMyLessons() {
  const { user } = useAuth();
  const userLectureIds = user?.userLectureIds ?? [];

  const { data: allSchedules } = useCollection<RegionLectureSchedule>('regionLectureSchedules');
  const { data: allUsers } = useCollection<User>('users');
  const { data: regions } = useCollection<Region>('regions', [
    where('isActive', '==', true),
  ]);

  const mySchedules = useMemo(() => {
    if (!allSchedules || userLectureIds.length === 0) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ids = new Set(userLectureIds);
    return allSchedules.filter((s) => {
      if (!ids.has(s.id)) return false;
      const endDate = s.endDate?.toDate?.() ?? new Date(0);
      return endDate >= today;
    });
  }, [allSchedules, userLectureIds]);

  const scheduleTeacherMap = useMemo(() => {
    const m = new Map<string, User>();
    allUsers?.forEach((u) => m.set(u.id, u));
    return m;
  }, [allUsers]);

  const regionMap = useMemo(() => {
    const m = new Map<string, Region>();
    regions?.forEach((r) => m.set(r.id, r));
    return m;
  }, [regions]);

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
          Benim Derslerim
        </h1>
        <p className="text-gray-600 mt-1">
          Katıldığınız dersler ve katılım takibi
        </p>
      </div>

      {mySchedules.length === 0 ? (
        <div className="rounded-2xl bg-gray-50 border border-gray-200 p-8 text-center">
          <p className="text-gray-600">Henüz katıldığınız bir ders bulunmuyor.</p>
          <Link to="/" className="inline-block mt-4 text-emerald-600 hover:text-emerald-700 font-medium">
            Ana sayfaya dön
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {mySchedules.map((s) => {
            const teacher = scheduleTeacherMap.get(s.teacherId);
            const teacherName = teacher
              ? [teacher.name, teacher.lastname].filter(Boolean).join(' ')
              : 'Hoca';
            const region = regionMap.get(s.regionId);
            const daysStr = s.daysOfWeek
              .sort((a, b) => a - b)
              .map((d) => DAY_NAMES[d])
              .join(', ');

            return (
              <Link
                key={s.id}
                to={`/my-lessons/${s.id}`}
                className="block rounded-xl sm:rounded-2xl p-5 border transition-all bg-white shadow-soft border-gray-100 hover:shadow-medium hover:border-emerald-200"
              >
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
                <p className="text-sm text-emerald-600 font-medium mt-3">
                  Katılım durumunu görüntüle →
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
