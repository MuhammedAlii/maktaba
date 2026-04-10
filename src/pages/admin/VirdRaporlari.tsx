import { useMemo, useRef, useState } from 'react';
import { Timestamp, where } from 'firebase/firestore';
import { useCollection } from '../../hooks/useFirestore';
import { useAuth } from '../../contexts/AuthContext';
import { HiChartBar, HiDownload, HiChevronLeft, HiChevronRight } from 'react-icons/hi';
import Swal from 'sweetalert2';
import { toPng } from 'html-to-image';
import { parseDateKey, toDateKey } from '../../utils/dateKey';

type VirdType = 'quran' | 'book' | 'zikr';
type ReportType = 'weekly' | 'monthly' | 'yearly';

interface User {
  id: string;
  name: string;
  lastname?: string;
  email?: string;
  role: string;
  regionIds?: string[];
  userLectureIds?: string[];
  isActive?: boolean;
}

interface Vird {
  id: string;
  type: VirdType;
  name: string;
  totalTarget: number;
  isActive?: boolean;
}

interface UserVirdEntry {
  id: string;
  userId: string;
  virdId: string;
  dateKey: string;
  amount: number;
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
}

interface UserLectureAttendance {
  id: string;
  userId: string;
  scheduleId: string;
  date: Timestamp;
  attended: boolean;
}

const addDays = (d: Date, days: number) => {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
};

const startOfMonth = (d: Date) => {
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

const startOfYear = (d: Date) => {
  return new Date(d.getFullYear(), 0, 1);
};

const endOfMonth = (d: Date) => {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
};

const endOfYear = (d: Date) => {
  return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
};

const clampToToday = (d: Date, today: Date) => {
  return d > today ? new Date(today) : d;
};

const addMonths = (d: Date, months: number) => {
  const next = new Date(d);
  next.setMonth(next.getMonth() + months);
  return next;
};

const addYears = (d: Date, years: number) => {
  const next = new Date(d);
  next.setFullYear(next.getFullYear() + years);
  return next;
};

type Bucket = { label: string; startKey: string; endKey: string };

const buildBuckets = (rt: ReportType, fromKey: string, toKey: string): Bucket[] => {
  // Weekly: tek değer (etiket göstermeyeceğiz, 1.Haf..4.Haf görünmeyecek)
  if (rt === 'weekly') {
    return [{ label: '', startKey: fromKey, endKey: toKey }];
  }

  // Monthly: ayı 4 parçaya böl (1.Haf..4.Haf)
  if (rt === 'monthly') {
    const fromDate = parseDateKey(fromKey);
    const year = fromDate.getFullYear();
    const month = fromDate.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();

    const mk = (day: number) => toDateKey(new Date(year, month, day));
    const ranges: Array<{ label: string; fromDay: number; toDay: number }> = [
      { label: '1.Haf', fromDay: 1, toDay: 7 },
      { label: '2.Haf', fromDay: 8, toDay: 14 },
      { label: '3.Haf', fromDay: 15, toDay: 21 },
      { label: '4.Haf', fromDay: 22, toDay: lastDay },
    ];

    return ranges.map((r) => ({
      label: r.label,
      startKey: mk(r.fromDay),
      endKey: mk(Math.min(r.toDay, lastDay)),
    }));
  }

  // Yearly: 12 ay (1.Ay..12.Ay)
  const year = parseDateKey(fromKey).getFullYear();
  const fromDate = parseDateKey(fromKey);
  const toDate = parseDateKey(toKey);
  const buckets: Bucket[] = [];

  for (let month = 0; month < 12; month++) {
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);

    const effectiveStart = monthStart < fromDate ? fromDate : monthStart;
    const effectiveEnd = monthEnd > toDate ? toDate : monthEnd;

    if (effectiveStart > effectiveEnd) {
      // Bu ayın aralığı rapor aralığının dışında kaldıysa 0 dönecek şekilde aynı gün bandı veriyoruz.
      const k = toDateKey(effectiveEnd);
      buckets.push({ label: `${month + 1}.Ay`, startKey: k, endKey: k });
      continue;
    }

    buckets.push({
      label: `${month + 1}.Ay`,
      startKey: toDateKey(effectiveStart),
      endKey: toDateKey(effectiveEnd),
    });
  }

  return buckets;
};

export default function VirdRaporlari() {
  const { user: authUser, isRegionSupervisor } = useAuth();

  const [reportType, setReportType] = useState<ReportType>('monthly');

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(23, 59, 59, 999);
    return t;
  }, []);
  const [cursorDate, setCursorDate] = useState<Date>(() => new Date());
  const printRef = useRef<HTMLDivElement | null>(null);

  const { startKey, endKey, label } = useMemo(() => {
    const endDate =
      reportType === 'weekly'
        ? clampToToday(cursorDate, today)
        : reportType === 'monthly'
          ? endOfMonth(cursorDate)
          : endOfYear(cursorDate);

    const startDate =
      reportType === 'weekly'
        ? addDays(new Date(endDate), -6)
        : reportType === 'monthly'
          ? startOfMonth(endDate)
          : startOfYear(endDate);

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);

    return {
      startKey: toDateKey(start),
      endKey: toDateKey(end),
      label:
        reportType === 'weekly'
          ? `${toDateKey(start)} - ${toDateKey(end)}`
          : reportType === 'monthly'
            ? `Ay: ${end.toLocaleDateString('tr-TR', { month: 'long' })} (${end.getFullYear()})`
            : `Yıl: ${end.getFullYear()}`,
    };
  }, [reportType, cursorDate, today]);

  const activeVirdsConstraints = useMemo(() => [where('isActive', '==', true)], []);

  const { data: activeVirdDocs, loading: virdsLoading } = useCollection<Vird>('virds', activeVirdsConstraints);

  const dataEndKey = useMemo(() => {
    // Haftalıkta endKey zaten bugün/bugün öncesi.
    if (reportType === 'weekly') return endKey;
    return endKey > toDateKey(today) ? toDateKey(today) : endKey;
  }, [reportType, endKey, today]);

  const userVirdEntriesConstraints = useMemo(
    () => [
      where('dateKey', '>=', startKey),
      where('dateKey', '<=', dataEndKey),
    ],
    [startKey, dataEndKey],
  );

  const attendanceConstraints = useMemo(
    () => [
      where('date', '>=', Timestamp.fromDate(parseDateKey(startKey))),
      where('date', '<=', Timestamp.fromDate(parseDateKey(dataEndKey))),
    ],
    [startKey, dataEndKey],
  );

  const { data: entries, loading: entriesLoading } = useCollection<UserVirdEntry>(
    'userVirdEntries',
    userVirdEntriesConstraints,
  );

  const { data: schedules } = useCollection<RegionLectureSchedule>('regionLectureSchedules');

  const { data: attendance, loading: attendanceLoading } = useCollection<UserLectureAttendance>(
    'userLectureAttendance',
    attendanceConstraints,
  );

  const reportRangeLoading = entriesLoading || attendanceLoading;

  const { data: users } = useCollection<User>('users');

  const scopedUsers = useMemo(() => {
    const list = (users ?? []).filter(
      (u) => u.role !== 'admin' && u.isActive !== false,
    );
    if (!isRegionSupervisor || !authUser?.regionIds?.[0]) return list;
    const myRegionId = authUser.regionIds[0];
    return list.filter((u) => (u.regionIds ?? []).includes(myRegionId));
  }, [users, isRegionSupervisor, authUser]);

  const schedulesScoped = useMemo(() => {
    const list = schedules ?? [];
    if (!isRegionSupervisor || !authUser?.regionIds?.[0]) return list;
    const rid = authUser.regionIds[0];
    return list.filter((s) => s.regionId === rid);
  }, [schedules, isRegionSupervisor, authUser]);

  const activeVirds = useMemo(() => activeVirdDocs ?? [], [activeVirdDocs]);
  const activeVirdIds = useMemo(() => new Set(activeVirds.map((v) => v.id)), [activeVirds]);

  const scopedUserIds = useMemo(() => new Set(scopedUsers.map((u) => u.id)), [scopedUsers]);

  const filteredEntries = useMemo(() => {
    return (entries ?? []).filter(
      (e) => activeVirdIds.has(e.virdId) && scopedUserIds.has(e.userId),
    );
  }, [entries, activeVirdIds, scopedUserIds]);

  // user + vird -> toplam (rapor dönemi içi)
  const sumByUserVird = useMemo(() => {
    const m = new Map<string, number>();
    filteredEntries.forEach((e) => {
      const key = `${e.userId}__${e.virdId}`;
      m.set(key, (m.get(key) ?? 0) + (Number(e.amount) || 0));
    });
    return m;
  }, [filteredEntries]);

  const entriesByUserVird = useMemo(() => {
    const m = new Map<string, UserVirdEntry[]>();
    filteredEntries.forEach((e) => {
      const key = `${e.userId}__${e.virdId}`;
      const next = m.get(key) ?? [];
      next.push(e);
      m.set(key, next);
    });
    m.forEach((arr) => arr.sort((a, b) => a.dateKey.localeCompare(b.dateKey)));
    return m;
  }, [filteredEntries]);

  const buckets = useMemo(() => buildBuckets(reportType, startKey, endKey), [reportType, startKey, endKey]);

  const completionByUser = useMemo(() => {
    return scopedUsers.map((u) => {
      const name = `${u.name} ${u.lastname ?? ''}`.trim();
      const email = u.email ?? '-';
      return { user: u, name, email };
    });
  }, [scopedUsers]);

  const showBucketLabels = reportType === 'monthly' || reportType === 'yearly';
  const showTopLine = reportType === 'monthly' || reportType === 'yearly';

  const canGoNext = useMemo(() => {
    if (reportType === 'weekly') {
      return addDays(new Date(cursorDate), 7) <= today;
    }
    if (reportType === 'monthly') {
      // Sonraki aya geçiş için, sonrakı ayın başlangıcı bugünü aşmamalı.
      return startOfMonth(addMonths(cursorDate, 1)) <= today;
    }
    // Sonraki yıla geçiş için, sonrakı yılın başlangıcı bugünü aşmamalı.
    return startOfYear(addYears(cursorDate, 1)) <= today;
  }, [reportType, cursorDate, today]);

  const handlePrev = () => {
    if (reportType === 'weekly') {
      setCursorDate((d) => addDays(d, -7));
      return;
    }
    if (reportType === 'monthly') {
      setCursorDate((d) => addMonths(d, -1));
      return;
    }
    setCursorDate((d) => addYears(d, -1));
  };

  const handleNext = () => {
    if (!canGoNext) return;
    if (reportType === 'weekly') {
      setCursorDate((d) => clampToToday(addDays(d, 7), today));
      return;
    }
    if (reportType === 'monthly') {
      setCursorDate((d) => clampToToday(addMonths(d, 1), today));
      return;
    }
    setCursorDate((d) => clampToToday(addYears(d, 1), today));
  };

  const scheduleMap = useMemo(() => {
    const m = new Map<string, RegionLectureSchedule>();
    schedulesScoped.forEach((s) => m.set(s.id, s));
    return m;
  }, [schedulesScoped]);

  const attendanceCountByUserScheduleBucket = useMemo(() => {
    // key: userId__scheduleId__bucketIndex -> attendedCount
    const m = new Map<string, number>();
    (attendance ?? []).forEach((rec) => {
      if (!scopedUserIds.has(rec.userId)) return;
      if (!rec.attended) return;
      const dt = rec.date?.toDate?.();
      if (!dt) return;
      const dateKey = toDateKey(dt);
      for (let i = 0; i < buckets.length; i++) {
        const b = buckets[i];
        if (dateKey >= b.startKey && dateKey <= b.endKey) {
          const key = `${rec.userId}__${rec.scheduleId}__${i}`;
          m.set(key, (m.get(key) ?? 0) + 1);
          break;
        }
      }
    });
    return m;
  }, [attendance, buckets, scopedUserIds]);

  const plannedCountForScheduleInBucket = (schedule: RegionLectureSchedule, b: Bucket) => {
    const start = schedule.startDate?.toDate?.() ?? new Date(0);
    const end = schedule.endDate?.toDate?.() ?? new Date(0);
    const from = parseDateKey(b.startKey);
    const to = parseDateKey(b.endKey);
    const effectiveStart = start > from ? start : from;
    const effectiveEnd = end < to ? end : to;
    if (effectiveStart > effectiveEnd) return 0;

    const days = new Set<number>(schedule.daysOfWeek ?? []);
    let planned = 0;
    const cur = new Date(effectiveStart);
    cur.setHours(0, 0, 0, 0);
    const endD = new Date(effectiveEnd);
    endD.setHours(0, 0, 0, 0);
    while (cur <= endD) {
      const dow = cur.getDay() === 0 ? 7 : cur.getDay();
      if (days.has(dow)) planned += 1;
      cur.setDate(cur.getDate() + 1);
    }
    return planned;
  };

  const exportCsv = () => {
    const safe = (val: unknown) => String(val ?? '').replaceAll(';', ',');

    // İsim + Dersler + vird kolonları (yüzde yok)
    const header: string[] = ['sep=;', 'İsim', 'Dersler'];
    activeVirds.forEach((v) => {
      header.push(`${v.name} (miktar)`);
    });

    const lines: string[] = [header.join(';')];

    completionByUser.forEach((r) => {
      const row: string[] = ['', safe(r.name)];

      // Dersler hücresi
      const userLectureIds = r.user.userLectureIds ?? [];
      const lessonLines: string[] = [];
      if (userLectureIds.length === 0) {
        lessonLines.push('-');
      } else {
        if (reportType === 'weekly') {
          const b = buckets[0];
          userLectureIds.forEach((sid) => {
            const s = scheduleMap.get(sid);
            if (!s) return;
            const planned = plannedCountForScheduleInBucket(s, b);
            if (planned === 0) return;
            const attendedCnt = attendanceCountByUserScheduleBucket.get(`${r.user.id}__${sid}__0`) ?? 0;
            lessonLines.push(`${s.lectureName}: ${attendedCnt}/${planned}`);
          });
        } else {
          buckets.forEach((b, idx) => {
            const bucketLessonParts: string[] = [];
            userLectureIds.forEach((sid) => {
              const s = scheduleMap.get(sid);
              if (!s) return;
              const planned = plannedCountForScheduleInBucket(s, b);
              if (planned === 0) return;
              const attendedCnt = attendanceCountByUserScheduleBucket.get(`${r.user.id}__${sid}__${idx}`) ?? 0;
              bucketLessonParts.push(`${s.lectureName} ${attendedCnt}/${planned}`);
            });
            if (bucketLessonParts.length > 0) {
              lessonLines.push(`${b.label}: ${bucketLessonParts.join(', ')}`);
            }
          });
        }
      }

      if (lessonLines.length === 0) {
        lessonLines.push('-');
      }

      row.push(safe(lessonLines.join(' | ')));

      activeVirds.forEach((v) => {
        const key = `${r.user.id}__${v.id}`;
        const entryList = entriesByUserVird.get(key) ?? [];
        const totalSum = sumByUserVird.get(key) ?? 0;

        if (reportType === 'weekly') {
          // Weekly/Daily: sadece tek değer (etiket yok)
          row.push(safe(totalSum));
        } else {
          const bucketsText = buckets
            .map((b) => {
              const bucketSum = entryList.reduce((acc, e) => {
                if (e.dateKey >= b.startKey && e.dateKey <= b.endKey) {
                  return acc + (Number(e.amount) || 0);
                }
                return acc;
              }, 0);
              return `${b.label} = ${bucketSum}`;
            })
            .join(' | ');

          row.push(safe(`${bucketsText} | Top: ${totalSum}`));
        }
      });

      lines.push(row.join(';'));
    });

    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vird-rapor-${reportType}-${startKey}-to-${endKey}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const buildA4PngDataUrl = async () => {
    const node = printRef.current;
    if (!node) return null;

    Swal.fire({
      title: 'Rapor hazırlanıyor...',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      // Use scroll size to include full table width/height.
      const contentW = Math.max(1, node.scrollWidth);
      const contentH = Math.max(1, node.scrollHeight);

      // A4 canvas (px). 1240x1754 ~= 150 DPI. We'll boost via pixelRatio.
      const A4_P = { w: 1240, h: 1754 };
      const A4_L = { w: 1754, h: 1240 };
      const MARGIN = 56; // px (a bit larger for print)

      const fitScale = (page: { w: number; h: number }) => {
        return Math.min((page.w - MARGIN * 2) / contentW, (page.h - MARGIN * 2) / contentH);
      };

      const scaleP = fitScale(A4_P);
      const scaleL = fitScale(A4_L);
      const page = scaleL > scaleP ? A4_L : A4_P;
      // Allow upscaling if content is smaller than A4 (important for readability).
      const scale = Math.max(0.01, scaleL > scaleP ? scaleL : scaleP);

      // Center content on the page while keeping a minimum margin.
      const freeW = page.w - contentW * scale;
      const freeH = page.h - contentH * scale;
      const tx = Math.max(MARGIN, freeW / 2);
      const ty = Math.max(MARGIN, freeH / 2);

      const dataUrl = await toPng(node, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 3,
        width: page.w,
        height: page.h,
        style: {
          overflow: 'visible',
          transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          transformOrigin: 'top left',
        },
      });

      const orient = page.w > page.h ? 'A4-landscape' : 'A4-portrait';
      Swal.close();
      return { dataUrl, orient };
    } catch {
      Swal.close();
      await Swal.fire({
        icon: 'error',
        title: 'İndirilemedi',
        text: 'Rapor görseli oluşturulurken bir hata oluştu.',
      });
      return null;
    }
  };

  const exportPng = async () => {
    const result = await buildA4PngDataUrl();
    if (!result) return;
    const { dataUrl, orient } = result;

    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `vird-rapor-${reportType}-${startKey}-to-${endKey}-${orient}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const printReport = async () => {
    const result = await buildA4PngDataUrl();
    if (!result) return;

    // More reliable than window.open (avoids blank popup issues).
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.setAttribute('aria-hidden', 'true');

    const title = `Vird Raporu (${label})`;
    iframe.srcdoc = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      @page { size: A4; margin: 0; }
      html, body { margin: 0; padding: 0; background: #fff; }
      img { width: 100%; height: auto; display: block; }
    </style>
  </head>
  <body>
    <img id="img" src="${result.dataUrl}" alt="Vird Raporu" />
    <script>
      const img = document.getElementById('img');
      img.onload = () => {
        try {
          window.focus();
          window.print();
        } finally {
          setTimeout(() => {
            try { window.frameElement && window.frameElement.remove(); } catch {}
          }, 500);
        }
      };
    </script>
  </body>
</html>`;

    document.body.appendChild(iframe);
  };

  const handleExportClick = async () => {
    const result = await Swal.fire({
      title: 'Raporu indir',
      html: `
        <div style="text-align:left">
          <p class="text-center" style="margin:0 0 20px 0;color:#4b5563;font-size:14px">
            İndirme formatını seçin
          </p>
          <div style="display:flex;gap:10px;flex-direction:column">
            <button type="button" class="swal2-confirm swal2-styled" id="export-csv" style="width:100%;background:#2563eb">
              Excel indir (CSV)
            </button>
            <button type="button" class="swal2-confirm swal2-styled" id="export-png" style="width:100%;background:#059669">
              PNG indir (görsel)
            </button>
            <button type="button" class="swal2-confirm swal2-styled" id="export-print" style="width:100%;background:#e98b0e">
              Yazdır
            </button>
          </div>
        </div>
      `,
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: 'Vazgeç',
      didOpen: () => {
        const csvBtn = document.getElementById('export-csv');
        const pngBtn = document.getElementById('export-png');
        const printBtn = document.getElementById('export-print');
        csvBtn?.addEventListener('click', () => {
          Swal.close();
          exportCsv();
        });
        pngBtn?.addEventListener('click', () => {
          Swal.close();
          void exportPng();
        });
        printBtn?.addEventListener('click', () => {
          Swal.close();
          void printReport();
        });
      },
    });

    return result;
  };

  return (
    <div className="space-y-6 animate-fade-in min-w-0 overflow-hidden">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
          <HiChartBar className="w-7 h-7 text-emerald-600" />
          Vird Raporları
        </h1>
        <p className="text-gray-600 mt-1">
          Döneme göre aktif virdlerde kullanıcıların tamamlama oranları.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-soft border border-gray-100 p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="min-w-0">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Rapor türü
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="w-full sm:w-64 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            >
              <option value="weekly">Haftalık</option>
              <option value="monthly">Aylık</option>
              <option value="yearly">Yıllık</option>
            </select>
          </div>

          <div className="grid grid-cols-[40px_1fr_40px] items-center gap-4 text-sm text-gray-500">
            <button
              type="button"
              onClick={handlePrev}
              disabled={reportRangeLoading}
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Önceki dönem"
              aria-label="Önceki dönem"
            >
              <HiChevronLeft className="w-5 h-5" />
            </button>

            <div className="text-center min-w-0 px-2">
              <div className="font-medium text-gray-700 truncate">{label}</div>
              <div className="mt-1 truncate">
                {activeVirds && activeVirds.length > 0 ? `${activeVirds.length} vird` : 'Virdler yükleniyor...'}
              </div>
            </div>

            <button
              type="button"
              onClick={handleNext}
              disabled={!canGoNext || reportRangeLoading}
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Sonraki dönem"
              aria-label="Sonraki dönem"
            >
              <HiChevronRight className="w-5 h-5" />        
            </button>
          </div>

          <button
            type="button"
            onClick={() => void handleExportClick()}
            disabled={virdsLoading || reportRangeLoading || activeVirds.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl text-sm font-medium hover:from-primary-700 hover:to-primary-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <HiDownload className="w-5 h-5" />
            Raporu indir
          </button>
        </div>

        {/* Printable area (PNG/Print) */}
        <div ref={printRef} className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-gray-900">
              {reportType === 'weekly' ? 'Haftalık' : reportType === 'monthly' ? 'Aylık' : 'Yıllık'}
              <span className="text-gray-500 font-medium"> | </span>
              <span className="text-gray-700 font-medium">{startKey} - {endKey}</span>
            </div>
          </div>

          <div className="relative overflow-x-auto rounded-xl border border-gray-100 min-h-[160px]">
            {reportRangeLoading && (
              <div
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl bg-white/75 backdrop-blur-[1px]"
                aria-live="polite"
                aria-busy="true"
              >
                <div
                  className="h-9 w-9 rounded-full border-2 border-primary-200 border-t-primary-600 animate-spin"
                  role="status"
                />
                <span className="text-xs font-medium text-gray-500">Yükleniyor...</span>
              </div>
            )}
            <table className={`w-full ${reportRangeLoading ? 'opacity-40 pointer-events-none' : ''} transition-opacity duration-150`}>
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  İsim
                </th>
                {activeVirds.map((v) => (
                  <th
                    key={v.id}
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap"
                    title={v.name}
                  >
                    {v.name}
                  </th>
                ))}
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Dersler (Katılım)
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {completionByUser.length === 0 ? (
                <tr>
                  <td colSpan={2 + activeVirds.length} className="px-6 py-10 text-center text-gray-500">
                    Henüz rapor verisi yok.
                  </td>
                </tr>
              ) : (
                completionByUser.map((r) => (
                  <tr key={r.user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {r.name}
                    </td>
                    {activeVirds.flatMap((v) => {
                      const key = `${r.user.id}__${v.id}`;
                      const entryList = entriesByUserVird.get(key) ?? [];
                      const totalSum = sumByUserVird.get(key) ?? 0;

                      return [
                        <td key={`${v.id}__amount__cell`} className="px-6 py-4 whitespace-nowrap align-top">
                          <div className="text-xs text-gray-700 space-y-1">
                            {buckets.map((b) => {
                              const bucketSum = entryList.reduce((acc, e) => {
                                if (e.dateKey >= b.startKey && e.dateKey <= b.endKey) {
                                  return acc + (Number(e.amount) || 0);
                                }
                                return acc;
                              }, 0);

                              return (
                                <div
                                  key={`${v.id}__${b.label}__line`}
                                  className="flex items-center justify-between gap-3"
                                >
                                  {showBucketLabels && (
                                    <span className="text-gray-500 font-medium">{b.label}</span>
                                  )}
                                  <span className="font-semibold text-gray-900">
                                    {bucketSum}
                                  </span>
                                </div>
                              );
                            })}

                            {showTopLine && (
                              <div className="pt-2 border-t border-gray-200 flex items-center justify-between gap-3">
                                <span className="text-[11px] text-gray-500 font-medium">Toplam</span>
                                <span className="font-semibold text-gray-900">{totalSum}</span>
                              </div>
                            )}
                          </div>
                        </td>,
                      ];
                    })}
                    <td className="px-6 py-4 whitespace-nowrap align-top">
                      <div className="text-xs text-gray-700 space-y-1">
                        {(() => {
                          const userLectureIds = r.user.userLectureIds ?? [];
                          if (userLectureIds.length === 0) {
                            return <span className="text-gray-400">-</span>;
                          }

                          const yes = <span className="text-emerald-700 font-semibold">(✓)</span>;
                          const no = <span className="text-red-700 font-semibold">(✗)</span>;

                          if (reportType === 'weekly') {
                            const b = buckets[0];
                            const items: string[] = [];
                            userLectureIds.forEach((sid) => {
                              const s = scheduleMap.get(sid);
                              if (!s) return;
                              const planned = plannedCountForScheduleInBucket(s, b);
                              if (planned === 0) return;
                              const attendedCnt =
                                attendanceCountByUserScheduleBucket.get(`${r.user.id}__${sid}__0`) ?? 0;
                              items.push(`${s.lectureName}__${attendedCnt > 0 ? 'yes' : 'no'}`);
                            });
                            if (items.length === 0) return <span className="text-gray-400">-</span>;
                            return items.map((t) => {
                              const [name, flag] = t.split('__');
                              return (
                                <div key={t} className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900">{name}</span>
                                  {flag === 'yes' ? yes : no}
                                </div>
                              );
                            });
                          }

                          return buckets.map((b, idx) => {
                            const lines: Array<{ name: string; ok: boolean }> = [];
                            userLectureIds.forEach((sid) => {
                              const s = scheduleMap.get(sid);
                              if (!s) return;
                              const planned = plannedCountForScheduleInBucket(s, b);
                              if (planned === 0) return;
                              const attendedCnt =
                                attendanceCountByUserScheduleBucket.get(`${r.user.id}__${sid}__${idx}`) ?? 0;
                              lines.push({ name: s.lectureName, ok: attendedCnt > 0 });
                            });

                            return (
                              <div
                                key={b.label}
                                className={reportType === 'monthly' ? 'flex items-start gap-3 py-0.5' : 'space-y-1'}
                              >
                                {showBucketLabels && (
                                  <div className={reportType === 'monthly' ? 'w-14 text-gray-500 font-medium pt-1' : 'text-gray-500 font-medium'}>
                                    {b.label}
                                  </div>
                                )}

                                {reportType === 'monthly' ? (
                                  <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                                    {lines.length === 0 ? (
                                      <span className="text-gray-400">-</span>
                                    ) : (
                                      lines.map((ln) => (
                                        <span
                                          key={`${b.label}__${ln.name}`}
                                          className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border border-gray-200 bg-gray-50"
                                        >
                                          <span className="font-medium text-gray-900">{ln.name}</span>
                                          {ln.ok ? yes : no}
                                        </span>
                                      ))
                                    )}
                                  </div>
                                ) : (
                                  lines.map((ln) => (
                                    <div key={`${b.label}__${ln.name}`} className="flex items-center gap-2">
                                      <span className="font-medium text-gray-900">{ln.name}</span>
                                      {ln.ok ? yes : no}
                                    </div>
                                  ))
                                )}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

