import { useState, useMemo } from 'react';
import { useCollection, firestoreHelpers } from '../../hooks/useFirestore';
import { useAuth } from '../../contexts/AuthContext';
import { Timestamp } from 'firebase/firestore';
import { HiUserAdd, HiX, HiCheck, HiUserCircle } from 'react-icons/hi';
import {
  approveLessonJoinRequest,
  rejectLessonJoinRequest,
  type LessonJoinRequest,
} from '../../services/lessonJoinRequestService';
import {
  showError,
  showConfirm,
  showLoading,
  hideLoading,
} from '../../services/notificationService';

interface User {
  id: string;
  name: string;
  lastname?: string;
  email?: string;
  role: string;
  regionIds?: string[];
  isUserApproved?: boolean;
}

interface Region {
  id: string;
  name: string;
}

interface RegionLectureSchedule {
  id: string;
  regionId: string;
  lectureName: string;
}

function formatDate(ts: Timestamp): string {
  return ts?.toDate?.()?.toLocaleDateString('tr-TR') ?? '-';
}

type TabType = 'user-approval' | 'lesson-join';

export default function Onaylamalar() {
  const { user: authUser, isAdmin, isRegionSupervisor } = useAuth();
  const supervisedRegionSet = useMemo(
    () => new Set(authUser?.regionIds ?? []),
    [authUser?.regionIds],
  );
  const isScopedSupervisor = isRegionSupervisor && !isAdmin;

  const [activeTab, setActiveTab] = useState<TabType>('user-approval');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [regionFilter, setRegionFilter] = useState<string>('');

  const { data: users } = useCollection<User>('users');
  const { data: requests, loading: requestsLoading } =
    useCollection<LessonJoinRequest>('lessonJoinRequests');
  const { data: regions } = useCollection<Region>('regions');
  const { data: schedules } = useCollection<RegionLectureSchedule>('regionLectureSchedules');

  const pendingUserApprovals = useMemo(() => {
    if (!users) return [];
    let list = users.filter(
      (u) =>
        u.role === 'user' &&
        u.isUserApproved !== true &&
        (u.regionIds ?? []).length > 0,
    );
    if (isScopedSupervisor) {
      list = list.filter((u) =>
        (u.regionIds ?? []).some((rid) => supervisedRegionSet.has(rid)),
      );
    }
    return list;
  }, [users, isScopedSupervisor, supervisedRegionSet]);

  const userMap = useMemo(() => {
    const m = new Map<string, User>();
    users?.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  const regionMap = useMemo(() => {
    const m = new Map<string, Region>();
    regions?.forEach((r) => m.set(r.id, r));
    return m;
  }, [regions]);

  const scheduleMap = useMemo(() => {
    const m = new Map<string, RegionLectureSchedule>();
    schedules?.forEach((s) => m.set(s.id, s));
    return m;
  }, [schedules]);

  const visibleJoinRequests = useMemo(() => {
    if (!requests) return [];
    let list = [...requests].sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() ?? 0;
      const tb = b.createdAt?.toMillis?.() ?? 0;
      return tb - ta;
    });
    if (isScopedSupervisor) {
      list = list.filter((r) => supervisedRegionSet.has(r.regionId));
    } else if (regionFilter) {
      list = list.filter((r) => r.regionId === regionFilter);
    }
    return list;
  }, [requests, regionFilter, isScopedSupervisor, supervisedRegionSet]);

  const handleApproveUser = async (userId: string) => {
    const user = userMap.get(userId);
    const userName = user ? [user.name, user.lastname].filter(Boolean).join(' ') : 'Kullanıcı';

    if (isScopedSupervisor && user) {
      const inScope = (user.regionIds ?? []).some((rid) => supervisedRegionSet.has(rid));
      if (!inScope) {
        await showError('Bu kullanıcıyı onaylama yetkiniz yok.');
        return;
      }
    }

    const ok = await showConfirm(
      `${userName} kullanıcısını onaylamak istiyor musunuz? Onaylanan kullanıcı bölge derslerine katılım talep edebilir.`,
      'Kullanıcı Onayı',
      { confirmButtonText: 'Onayla', cancelButtonText: 'İptal' }
    );
    if (!ok) return;

    setProcessingId(userId);
    showLoading('Kullanıcı onaylanıyor...');
    try {
      await firestoreHelpers.update('users', userId, { isUserApproved: true });
      hideLoading();
      // await showSuccess('Kullanıcı onaylandı.');
    } catch (err) {
      hideLoading();
      await showError(err instanceof Error ? err.message : 'Onay işlemi sırasında hata oluştu.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectUser = async (userId: string) => {
    const user = userMap.get(userId);
    const userName = user ? [user.name, user.lastname].filter(Boolean).join(' ') : 'Kullanıcı';

    if (isScopedSupervisor && user) {
      const inScope = (user.regionIds ?? []).some((rid) => supervisedRegionSet.has(rid));
      if (!inScope) {
        await showError('Bu kullanıcıyı reddetme yetkiniz yok.');
        return;
      }
    }

    const ok = await showConfirm(
      `${userName} kullanıcısının bölgeye katılım isteğini reddetmek istiyor musunuz? Kullanıcı bölgeden çıkarılacaktır.`,
      'Bölge Onayını Reddet',
      {
        confirmButtonText: 'Reddet',
        cancelButtonText: 'İptal',
        icon: 'warning',
        confirmButtonColor: '#dc2626',
      }
    );
    if (!ok) return;

    setProcessingId(userId);
    showLoading('Reddediliyor...');
    try {
      await firestoreHelpers.update('users', userId, { regionIds: [] });
      hideLoading();
      // await showSuccess('Bölge onay isteği reddedildi.');
    } catch (err) {
      hideLoading();
      await showError(err instanceof Error ? err.message : 'Reddetme işlemi sırasında hata oluştu.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveLesson = async (req: LessonJoinRequest) => {
    if (isScopedSupervisor && !supervisedRegionSet.has(req.regionId)) {
      await showError('Bu ders talebini onaylama yetkiniz yok.');
      return;
    }

    const schedule = scheduleMap.get(req.scheduleId);
    const user = userMap.get(req.userId);
    const userName = user ? [user.name, user.lastname].filter(Boolean).join(' ') : 'Kullanıcı';
    const lectureName = schedule?.lectureName ?? 'Ders';

    const ok = await showConfirm(
      `${userName} kullanıcısının "${lectureName}" dersine katılım isteğini onaylamak istiyor musunuz?`,
      'Derse Kabul',
      { confirmButtonText: 'Onayla', cancelButtonText: 'İptal' }
    );
    if (!ok) return;

    setProcessingId(req.id);
    showLoading('Onaylanıyor...');
    try {
      await approveLessonJoinRequest(req);
      hideLoading();
      // await showSuccess('Katılım isteği onaylandı. Kullanıcı derse eklendi.');
    } catch (err) {
      hideLoading();
      await showError(err instanceof Error ? err.message : 'Onaylama sırasında bir hata oluştu.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectLesson = async (req: LessonJoinRequest) => {
    if (isScopedSupervisor && !supervisedRegionSet.has(req.regionId)) {
      await showError('Bu ders talebini reddetme yetkiniz yok.');
      return;
    }

    const schedule = scheduleMap.get(req.scheduleId);
    const user = userMap.get(req.userId);
    const userName = user ? [user.name, user.lastname].filter(Boolean).join(' ') : 'Kullanıcı';
    const lectureName = schedule?.lectureName ?? 'Ders';

    const ok = await showConfirm(
      `${userName} kullanıcısının "${lectureName}" dersine katılım isteğini reddetmek istiyor musunuz?`,
      'İsteği Reddet',
      {
        confirmButtonText: 'Reddet',
        cancelButtonText: 'İptal',
        icon: 'warning',
        confirmButtonColor: '#dc2626',
      }
    );
    if (!ok) return;

    setProcessingId(req.id);
    showLoading('Reddediliyor...');
    try {
      await rejectLessonJoinRequest(req.id);
      hideLoading();
      // await showSuccess('Katılım isteği reddedildi.');
    } catch (err) {
      hideLoading();
      await showError(err instanceof Error ? err.message : 'Reddetme sırasında bir hata oluştu.');
    } finally {
      setProcessingId(null);
    }
  };

  const tabs: { id: TabType; label: string; count?: number }[] = [
    { id: 'user-approval', label: 'Kullanıcı Onayı', count: pendingUserApprovals.length },
    { id: 'lesson-join', label: 'Derse Kabul', count: visibleJoinRequests.length },
  ];

  return (
    <div className="space-y-6 animate-fade-in min-w-0 overflow-hidden">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Onaylamalar</h1>
        <p className="text-gray-600 mt-1">
          {isScopedSupervisor
            ? 'Yalnızca yönettiğiniz bölgeye ait kayıt ve ders katılım taleplerini görüntüleyip işleyebilirsiniz.'
            : 'Bölgeye katılım ve derse kabul taleplerini yönetin.'}
        </p>
      </div>

      {isScopedSupervisor && supervisedRegionSet.size === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Hesabınıza atanmış bir bölge yok. Onay işlemleri için yöneticiden bölge atanmasını isteyin.
        </div>
      )}

      <div className="bg-white rounded-xl shadow-soft">
        <div className="border-b border-gray-200 px-4 pt-4 pb-4">
          <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1 text-sm font-medium w-full sm:w-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-3 py-2 rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-primary-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                      activeTab === tab.id ? 'bg-primary-100 text-primary-700' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {activeTab === 'user-approval' && (
            <div className="space-y-4">
          {pendingUserApprovals.length === 0 ? (
            <div className="p-12 text-center">
              <HiUserCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">Onay bekleyen kullanıcı bulunmuyor</p>
              <p className="text-sm text-gray-500 mt-1">
                Bölgeye katılım için kayıt olan kullanıcılar burada listelenecektir.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Kullanıcı
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Bölge
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pendingUserApprovals.map((u) => {
                    const regionNames = (u.regionIds ?? [])
                      .map((id) => regionMap.get(id)?.name ?? id)
                      .join(', ');
                    const isProcessing = processingId === u.id;

                    return (
                      <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {[u.name, u.lastname].filter(Boolean).join(' ')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{u.email ?? '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {regionNames || 'Bölge atanmadı'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleApproveUser(u.id)}
                              disabled={isProcessing}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              <HiCheck className="w-4 h-4" />
                              Onayla
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectUser(u.id)}
                              disabled={isProcessing}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              <HiX className="w-4 h-4" />
                              Reddet
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
            </div>
          )}

          {activeTab === 'lesson-join' && (
            <div className="space-y-4">
              {!isScopedSupervisor && regions && regions.length > 0 && (
                <div className="flex justify-end">
                  <select
                    value={regionFilter}
                    onChange={(e) => setRegionFilter(e.target.value)}
                    className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700 bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">Tüm bölgeler</option>
                    {regions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {requestsLoading ? (
                <div className="flex justify-center py-16">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                </div>
              ) : visibleJoinRequests.length === 0 ? (
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-12 text-center">
                  <HiUserAdd className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium">Bekleyen ders katılım isteği bulunmuyor</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Kullanıcılar bölgelerindeki derslere katılım isteği gönderdikçe burada listelenecektir.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Kullanıcı
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Ders
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Bölge
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Tarih
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        İşlemler
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {visibleJoinRequests.map((req) => {
                      const user = userMap.get(req.userId);
                      const schedule = scheduleMap.get(req.scheduleId);
                      const region = regionMap.get(req.regionId);
                      const userName = user ? [user.name, user.lastname].filter(Boolean).join(' ') : '-';
                      const lectureName = schedule?.lectureName ?? '-';
                      const regionName = region?.name ?? '-';
                      const isProcessing = processingId === req.id;

                      return (
                        <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{userName}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{lectureName}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{regionName}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{formatDate(req.createdAt)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleApproveLesson(req)}
                                disabled={isProcessing}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                <HiCheck className="w-4 h-4" />
                                Onayla
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectLesson(req)}
                                disabled={isProcessing}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                <HiX className="w-4 h-4" />
                                Reddet
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
