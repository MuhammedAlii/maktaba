import { useEffect, useRef } from 'react';
import { useCollection } from '../../hooks/useFirestore';
import { useAuth } from '../../contexts/AuthContext';
import Swal from 'sweetalert2';
import { Timestamp } from 'firebase/firestore';
import lessonNotifyImage from '../../assets/lesson-notify.png';

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

export default function TodayLessonNotification() {
  const { user } = useAuth();
  const hasShown = useRef(false);
  const { data: allSchedules } = useCollection<RegionLectureSchedule>('regionLectureSchedules');

  useEffect(() => {
    if (!user || hasShown.current || !allSchedules) return;

    const isApproved = user.role !== 'user' || user.isUserApproved === true;
    if (!isApproved) return;

    const userLectureIds = user.userLectureIds ?? [];
    if (userLectureIds.length === 0) return;

    const today = new Date();
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay();

    const todaysLessons = allSchedules.filter((s) => {
      if (!userLectureIds.includes(s.id)) return false;
      if (!s.daysOfWeek?.includes(dayOfWeek)) return false;
      const start = s.startDate?.toDate?.() ?? new Date(0);
      const end = s.endDate?.toDate?.() ?? new Date(0);
      return start <= todayEnd && end >= todayStart;
    });

    if (todaysLessons.length === 0) return;

    const storageKey = `maktaba_today_lesson_${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (sessionStorage.getItem(storageKey)) return;

    hasShown.current = true;
    sessionStorage.setItem(storageKey, '1');

    const lectureName = todaysLessons[0].lectureName;
    const userName = user.name || 'Kullanıcı';
    const lessonText = todaysLessons.length === 1
      ? `Bugün için bir ${lectureName} programımız var.`
      : `Bugün için ${todaysLessons.length} ders programımız var.`;

    Swal.fire({
      showClass: { popup: 'animate-fade-in' },
      customClass: {
        popup: 'rounded-2xl overflow-hidden max-w-[320px] p-0',
        htmlContainer: 'p-0 m-0 overflow-visible',
        actions: 'p-0 m-0 w-full block',
        confirmButton: 'm-0 rounded-none w-full py-3.5 text-base font-semibold flex items-center justify-center gap-2',
      },
      title: false,
      html: `
        <div class="bg-white rounded-2xl overflow-hidden">
          <img src="${lessonNotifyImage}" alt="Ders bildirimi" class="w-full h-auto object-cover rounded-t-2xl mt-[20px]" style="max-height: 200px; object-fit: cover;" />
          <div class="px-4 pt-4 pb-2 text-center">
            <p class="text-gray-900 font-bold text-xl">
              Bugün <span class="text-emerald-600">${lectureName}</span> Dersi Var!
            </p>
          </div>
          <div class="px-4 pb-4 text-center">
            <p class="text-gray-600 text-sm leading-relaxed">
              <span class="font-medium text-gray-800">${userName}</span>, hatırlatmak istedik!
            </p>
            <p class="text-gray-600 text-sm mt-1">${lessonText}</p>
          </div>
        </div>
      `,
      showConfirmButton: true,
      confirmButtonText: '🔔 Tamam',
      confirmButtonColor: '#059669',
      width: 320,
    });
  }, [user, allSchedules]);

  return null;
}
