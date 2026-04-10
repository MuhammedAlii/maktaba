import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HiUsers,
  HiBookOpen,
  HiFolder,
  HiAcademicCap,
  HiChartBar,
  HiPlus,
  HiArrowRight,
} from 'react-icons/hi';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useCollection } from '../../hooks/useFirestore';
import { useAuth } from '../../contexts/AuthContext';
import { Timestamp } from 'firebase/firestore';

interface User {
  id: string;
  name?: string;
  lastname?: string;
  email?: string;
  role?: string;
  regionIds?: string[];
  isActive?: boolean;
}

interface Region {
  id: string;
  name: string;
  description?: string;
  isActive?: boolean;
}

interface Book {
  id: string;
  title: string;
  author?: string;
  regionIds?: string[];
}

interface RegionLectureSchedule {
  id: string;
  regionId: string;
  lectureName: string;
  teacherId?: string;
  participantUserIds?: string[];
  daysOfWeek?: number[];
  startDate: Timestamp;
  endDate: Timestamp;
}

interface UserLectureAttendance {
  id: string;
  userId: string;
  scheduleId: string;
  date: Timestamp;
  attended?: boolean;
}

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16',
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();

  const { data: users, loading: usersLoading } = useCollection<User>('users');
  const { data: regions, loading: regionsLoading } = useCollection<Region>('regions');
  const { data: books, loading: booksLoading } = useCollection<Book>('books');
  const { data: schedules } = useCollection<RegionLectureSchedule>('regionLectureSchedules');
  const { data: attendance } = useCollection<UserLectureAttendance>('userLectureAttendance');

  const activeUsers = useMemo(
    () => (users ?? []).filter((u) => u.isActive !== false),
    [users]
  );
  const activeRegions = useMemo(
    () => (regions ?? []).filter((r) => r.isActive !== false),
    [regions]
  );

  const usersByRegion = useMemo(() => {
    const map: Record<string, { name: string; count: number; fill: string }> = {};
    activeRegions.forEach((r, i) => {
      map[r.id] = { name: r.name, count: 0, fill: COLORS[i % COLORS.length] };
    });
    activeUsers.forEach((u) => {
      (u.regionIds ?? []).forEach((rid) => {
        if (map[rid]) map[rid].count += 1;
      });
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [activeUsers, activeRegions]);

  const lectureParticipation = useMemo(() => {
    if (!schedules || !attendance) return [];
    const attendedBySchedule: Record<string, number> = {};
    const plannedBySchedule: Record<string, number> = {};
    const scheduleInfo: Record<string, { name: string; regionName: string }> = {};

    schedules.forEach((s) => {
      attendedBySchedule[s.id] = 0;
      const region = activeRegions.find((r) => r.id === s.regionId);
      scheduleInfo[s.id] = {
        name: s.lectureName,
        regionName: region?.name ?? '-',
      };
      const start =
        s.startDate && typeof (s.startDate as Timestamp).toDate === 'function'
          ? (s.startDate as Timestamp).toDate()
          : new Date(0);
      const end =
        s.endDate && typeof (s.endDate as Timestamp).toDate === 'function'
          ? (s.endDate as Timestamp).toDate()
          : new Date(0);
      const days = s.daysOfWeek ?? [1, 2, 3, 4, 5];
      let planned = 0;
      const d = new Date(start);
      while (d <= end) {
        const dow = d.getDay() === 0 ? 7 : d.getDay();
        if (days.includes(dow)) planned += 1;
        d.setDate(d.getDate() + 1);
      }
      plannedBySchedule[s.id] = Math.max(1, planned);
    });

    attendance.forEach((a) => {
      if (a.attended && a.scheduleId && attendedBySchedule[a.scheduleId] !== undefined) {
        attendedBySchedule[a.scheduleId] += 1;
      }
    });

    return Object.entries(scheduleInfo)
      .map(([id, info]) => ({
        name: `${info.name} (${info.regionName})`,
        shortName: info.name,
        regionName: info.regionName,
        planned: plannedBySchedule[id] ?? 0,
        attended: attendedBySchedule[id] ?? 0,
        percent:
          (plannedBySchedule[id] ?? 0) > 0
            ? Math.round(((attendedBySchedule[id] ?? 0) / (plannedBySchedule[id] ?? 1)) * 100)
            : 0,
      }))
      .filter((x) => x.planned > 0)
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 10);
  }, [schedules, attendance, activeRegions]);

  const roleDistribution = useMemo(() => {
    const admin = activeUsers.filter((u) => u.role === 'admin').length;
    const teacher = activeUsers.filter((u) => u.role === 'teacher').length;
    const user = activeUsers.filter((u) => u.role !== 'admin' && u.role !== 'teacher').length;
    return [
      { name: 'Admin', value: admin, fill: COLORS[0] },
      { name: 'Hoca', value: teacher, fill: COLORS[1] },
      { name: 'Kullanıcı', value: user, fill: COLORS[2] },
    ].filter((x) => x.value > 0);
  }, [activeUsers]);

  const loading = usersLoading || regionsLoading || booksLoading;

  return (
    <div className="space-y-6 min-w-0">
      {/* Hoş geldin */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl shadow-lg p-6 sm:p-8 text-white">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">
          Hoş Geldiniz, {authUser?.name ?? 'Kullanıcı'}! 👋
        </h1>
        <p className="text-primary-100 text-sm sm:text-base">
          Maktaba Admin Paneline hoş geldiniz. Sistem genel bakışınız burada.
        </p>
      </div>

      {/* İstatistik Kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          className="bg-white rounded-xl shadow-soft p-5 hover:shadow-medium transition-shadow border border-gray-100"
          onClick={() => navigate('/users')}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="bg-blue-50 text-blue-600 p-3 rounded-xl">
              <HiUsers className="w-6 h-6" />
            </div>
            <HiArrowRight className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-gray-500 text-sm mb-1">Toplam Kullanıcı</p>
          <p className="text-2xl font-bold text-gray-900">
            {loading ? '...' : activeUsers.length}
          </p>
        </div>

        <div
          className="bg-white rounded-xl shadow-soft p-5 hover:shadow-medium transition-shadow border border-gray-100"
          onClick={() => navigate('/regions')}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="bg-amber-50 text-amber-600 p-3 rounded-xl">
              <HiFolder className="w-6 h-6" />
            </div>
            <HiArrowRight className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-gray-500 text-sm mb-1">Toplam Bölge</p>
          <p className="text-2xl font-bold text-gray-900">
            {loading ? '...' : activeRegions.length}
          </p>
        </div>

        <div
          className="bg-white rounded-xl shadow-soft p-5 hover:shadow-medium transition-shadow border border-gray-100"
          onClick={() => navigate('/books')}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl">
              <HiBookOpen className="w-6 h-6" />
            </div>
            <HiArrowRight className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-gray-500 text-sm mb-1">Toplam Kitap</p>
          <p className="text-2xl font-bold text-gray-900">
            {loading ? '...' : (books?.length ?? 0)}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-soft p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-purple-50 text-purple-600 p-3 rounded-xl">
              <HiAcademicCap className="w-6 h-6" />
            </div>
          </div>
          <p className="text-gray-500 text-sm mb-1">Aktif Ders Planı</p>
          <p className="text-2xl font-bold text-gray-900">
            {loading ? '...' : (schedules?.length ?? 0)}
          </p>
        </div>
      </div>

      {/* Grafikler */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bölge bazında kullanıcı dağılımı */}
        <div className="bg-white rounded-xl shadow-soft p-6 border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <HiFolder className="w-5 h-5 text-amber-600" />
            Bölge Bazında Kullanıcı Dağılımı
          </h2>
          {usersByRegion.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-500 text-sm">
              Henüz bölge veya kullanıcı verisi yok.
            </div>
          ) : (
            <div className="h-64 sm:h-72 min-h-[256px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={usersByRegion} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => (v && String(v).length > 15 ? String(v).slice(0, 14) + '…' : v)}
                />
                <Tooltip
                  formatter={(value: number | undefined) => [`${value ?? 0} kullanıcı`, 'Kullanıcı']}
                  labelFormatter={(label) => label}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Rol dağılımı */}
        <div className="bg-white rounded-xl shadow-soft p-6 border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <HiUsers className="w-5 h-5 text-blue-600" />
            Kullanıcı Rol Dağılımı
          </h2>
          {roleDistribution.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-500 text-sm">
              Henüz kullanıcı verisi yok.
            </div>
          ) : (
            <div className="h-64 sm:h-72 min-h-[256px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={roleDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {roleDistribution.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number | undefined) => [`${value ?? 0} kişi`, '']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Ders katılım raporu */}
      <div className="bg-white rounded-xl shadow-soft p-6 border border-gray-100">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <HiChartBar className="w-5 h-5 text-emerald-600" />
          Ders Bazında Katılım Oranı
        </h2>
        {lectureParticipation.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
            Henüz ders planı veya katılım verisi yok.
          </div>
        ) : (
          <div className="h-64 sm:h-80 min-h-[256px] overflow-x-auto">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={lectureParticipation}
                layout="vertical"
                margin={{ left: 10, right: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="shortName"
                  width={120}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => (v && String(v).length > 12 ? String(v).slice(0, 11) + '…' : v)}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]?.payload) return null;
                    const p = payload[0].payload;
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
                        <p className="font-semibold text-gray-900">{p.name}</p>
                        <p className="text-gray-600">Katılım: %{p.percent}</p>
                        <p className="text-gray-500 text-xs">
                          Katıldı: {p.attended} / Planlanan: {p.planned}
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="percent" fill="#10b981" radius={[0, 4, 4, 0]} name="Katılım %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Hızlı işlemler */}
      <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl shadow-lg p-6 text-white">
        <h3 className="text-lg font-bold mb-4">Hızlı İşlemler</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => navigate('/users')}
            className="flex items-center gap-3 px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors text-left"
          >
            <HiPlus className="w-5 h-5 flex-shrink-0" />
            <span>Kullanıcı Ekle</span>
          </button>
          <button
            onClick={() => navigate('/books')}
            className="flex items-center gap-3 px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors text-left"
          >
            <HiPlus className="w-5 h-5 flex-shrink-0" />
            <span>Kitap Ekle</span>
          </button>
          <button
            onClick={() => navigate('/regions')}
            className="flex items-center gap-3 px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors text-left"
          >
            <HiPlus className="w-5 h-5 flex-shrink-0" />
            <span>Bölge Yönet</span>
          </button>
        </div>
      </div>
    </div>
  );
}
