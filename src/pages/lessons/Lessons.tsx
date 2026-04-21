import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCollection, firestoreHelpers } from '../../hooks/useFirestore';
import { useAuth } from '../../contexts/AuthContext';
import {
  showSuccess,
  showError,
  showConfirm,
  showLoading,
  hideLoading,
} from '../../services/notificationService';
import {
  HiPlus,
  HiPencil,
  HiTrash,
  HiSearch,
  HiBookOpen,
  HiX,
  HiRefresh,
  HiUsers,
  HiFolder,
} from 'react-icons/hi';

interface Lesson {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
}

interface RegionLectureSchedule {
  id: string;
  regionId: string;
  lectureName: string;
  teacherId: string;
  participantUserIds?: string[];
}

interface User {
  id: string;
  name: string;
  lastname?: string;
  email?: string;
  username?: string;
  regionIds?: string[];
}

interface Region {
  id: string;
  name: string;
  lectures?: string[];
  isActive?: boolean;
}

export default function Lessons() {
  const { data: lessons, loading, error } = useCollection<Lesson>('lessons');
  const { data: regionLectureSchedules } = useCollection<RegionLectureSchedule>(
    'regionLectureSchedules',
  );
  const { data: users } = useCollection<User>('users');
  const { data: regions } = useCollection<Region>('regions');

  const { user: authUser } = useAuth();
  const isRegionSupervisor = authUser?.role === 'regionSupervisor';
  const myRegionId = isRegionSupervisor ? authUser?.regionIds?.[0] : undefined;
  const myRegion = useMemo(
    () => (myRegionId ? regions?.find((r) => r.id === myRegionId) : undefined),
    [regions, myRegionId],
  );
  const mySupervisorRegionIsActive = Boolean(
    myRegionId && myRegion && myRegion.isActive !== false,
  );
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [showLessonParticipantsModal, setShowLessonParticipantsModal] =
    useState(false);
  const [lessonParticipantsForName, setLessonParticipantsForName] = useState<
    string | null
  >(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lessonRegionsModalLesson, setLessonRegionsModalLesson] =
    useState<Lesson | null>(null);
  const [selectedPlanRegionId, setSelectedPlanRegionId] = useState('');

  const activeRegionsCatalog = useMemo(
    () =>
      (regions ?? [])
        .filter((r) => r.isActive !== false)
        .sort((a, b) => a.name.localeCompare(b.name, 'tr')),
    [regions],
  );

  const planTargetRegions = useMemo(() => {
    if (isRegionSupervisor && myRegionId) {
      return activeRegionsCatalog.filter((r) => r.id === myRegionId);
    }
    return activeRegionsCatalog;
  }, [isRegionSupervisor, myRegionId, activeRegionsCatalog]);

  const handleAddLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameTrim = formData.name.trim();
    if (!nameTrim) return;

    if (isRegionSupervisor) {
      if (!myRegionId || !myRegion || myRegion.isActive === false) {
        await showError(
          'Ders ekleyebilmek için atanmış ve aktif bir bölgeniz olmalıdır.',
        );
        return;
      }
      const dup = lessons.some(
        (l) => (l.name || '').trim().toLowerCase() === nameTrim.toLowerCase(),
      );
      if (dup) {
        await showError('Bu ada sahip bir ders zaten kayıtlı.');
        return;
      }
    }

    setIsSubmitting(true);
    showLoading('Ders ekleniyor...');

    try {
      await firestoreHelpers.add<Lesson>('lessons', {
        name: nameTrim,
        description: formData.description.trim(),
        isActive: true,
      } as Omit<Lesson, 'id'>);

      if (isRegionSupervisor && myRegionId && myRegion && myRegion.isActive !== false) {
        const cur = (myRegion.lectures ?? []).filter(Boolean);
        if (!cur.includes(nameTrim)) {
          await firestoreHelpers.update<Region>('regions', myRegionId, {
            lectures: [...cur, nameTrim],
          });
        }
      }

      setShowModal(false);
      setFormData({ name: '', description: '' });
      hideLoading();
      if (isRegionSupervisor) {
        await showSuccess('Ders eklendi ve bölgenizin ders listesine yazıldı.');
      }
    } catch (err) {
      console.error('Ders eklenirken hata:', err);
      hideLoading();
      await showError('Ders eklenirken bir hata oluştu!');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditLesson = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setEditFormData({
      name: lesson.name || '',
      description: lesson.description || '',
    });
    setShowEditModal(true);
  };

  const handleUpdateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLesson) return;

    setIsSubmitting(true);
    showLoading('Ders güncelleniyor...');

    try {
      await firestoreHelpers.update<Lesson>('lessons', editingLesson.id, {
        name: editFormData.name.trim(),
        description: editFormData.description.trim(),
      });

      setShowEditModal(false);
      setEditingLesson(null);
      setEditFormData({ name: '', description: '' });
      hideLoading();
      // await showSuccess('Ders başarıyla güncellendi!');
    } catch (err) {
      console.error('Ders güncellenirken hata:', err);
      hideLoading();
      await showError('Ders güncellenirken bir hata oluştu!');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (lesson: Lesson) => {
    const action = lesson.isActive ? 'pasif yapmak' : 'aktifleştirmek';
    const title = lesson.isActive ? 'Dersi Pasif Yap' : 'Dersi Aktifleştir';
    const confirmText = lesson.isActive ? 'Evet, Pasif Yap' : 'Evet, Aktifleştir';
    const loadingText = lesson.isActive ? 'Ders pasif yapılıyor...' : 'Ders aktifleştiriliyor...';
    const successText = lesson.isActive
      ? 'Ders başarıyla pasif yapıldı!'
      : 'Ders tekrar aktifleştirildi!';

    const confirmed = await showConfirm(
      `Bu dersi ${action} istediğinizden emin misiniz?`,
      title,
      {
        confirmButtonText: confirmText,
        cancelButtonText: 'İptal',
        icon: 'warning',
      },
    );

    if (!confirmed) return;

    showLoading(loadingText);

    try {
      await firestoreHelpers.update<Lesson>('lessons', lesson.id, {
        isActive: !lesson.isActive,
      });
      hideLoading();
      await showSuccess(successText);
    } catch (err) {
      console.error('Ders durumu güncellenirken hata:', err);
      hideLoading();
      await showError('Ders durumu güncellenirken bir hata oluştu!');
    }
  };

  const handleDeleteLesson = async (id: string) => {
    const confirmed = await showConfirm(
      'Bu dersi kalıcı olarak silmek istediğinizden emin misiniz?',
      'Dersi Sil',
      {
        confirmButtonText: 'Evet, Sil',
        cancelButtonText: 'İptal',
        icon: 'warning',
      },
    );

    if (!confirmed) return;

    showLoading('Ders siliniyor...');

    try {
      await firestoreHelpers.delete('lessons', id);
      hideLoading();
      // await showSuccess('Ders kalıcı olarak silindi.');
    } catch (err) {
      console.error('Ders silinirken hata:', err);
      hideLoading();
      await showError('Ders silinirken bir hata oluştu!');
    }
  };

  const lessonNamesInMyRegion = useMemo(() => {
    if (!isRegionSupervisor || !myRegionId) return new Set<string>();
    const names = new Set<string>();
    (regionLectureSchedules ?? [])
      .filter((s) => s.regionId === myRegionId)
      .forEach((s) => {
        if (s.lectureName) names.add(s.lectureName);
      });
    return names;
  }, [isRegionSupervisor, myRegionId, regionLectureSchedules]);

  const lessonNamesInMyRegionLectures = useMemo(() => {
    const s = new Set<string>();
    for (const n of myRegion?.lectures ?? []) {
      if (n) s.add(n);
    }
    return s;
  }, [myRegion]);

  const scopedLessons = useMemo(() => {
    if (!isRegionSupervisor || !myRegionId) return lessons;
    return lessons.filter(
      (lesson) =>
        lessonNamesInMyRegion.has(lesson.name) ||
        lessonNamesInMyRegionLectures.has(lesson.name),
    );
  }, [
    isRegionSupervisor,
    myRegionId,
    lessons,
    lessonNamesInMyRegion,
    lessonNamesInMyRegionLectures,
  ]);

  const filteredLessons = scopedLessons.filter(
    (lesson) =>
      (lesson.name || '')
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (lesson.description || '')
        .toLowerCase()
        .includes(searchTerm.toLowerCase()),
  );

  const lessonParticipants = useMemo(() => {
    if (!isRegionSupervisor || !myRegionId || !lessonParticipantsForName) return [];
    if (!regionLectureSchedules) return [];
    const participantIds = new Set<string>();

    regionLectureSchedules
      .filter(
        (s) =>
          s.regionId === myRegionId && s.lectureName === lessonParticipantsForName,
      )
      .forEach((s) => {
        (s.participantUserIds ?? []).forEach((uid) => participantIds.add(uid));
      });

    const authUserId = authUser?.id;
    if (authUserId) participantIds.delete(authUserId);

    const list = Array.from(participantIds)
      .map((uid) => users?.find((u) => u.id === uid))
      .filter(Boolean) as User[];

    const listScoped =
      myRegionId ? list.filter((u) => (u.regionIds ?? []).includes(myRegionId)) : list;

    listScoped.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    return listScoped;
  }, [isRegionSupervisor, myRegionId, lessonParticipantsForName, regionLectureSchedules, users, authUser]);

  const regionsModalDisplayList = useMemo(() => {
    if (!lessonRegionsModalLesson) return [];
    const fromLectures = activeRegionsCatalog.filter((r) =>
      (r.lectures ?? []).includes(lessonRegionsModalLesson.name),
    );
    if (fromLectures.length > 0) return fromLectures;
    if (
      isRegionSupervisor &&
      myRegionId &&
      (lessonNamesInMyRegion.has(lessonRegionsModalLesson.name) ||
        lessonNamesInMyRegionLectures.has(lessonRegionsModalLesson.name))
    ) {
      const mine = activeRegionsCatalog.find((r) => r.id === myRegionId);
      return mine ? [mine] : [];
    }
    return [];
  }, [
    lessonRegionsModalLesson,
    activeRegionsCatalog,
    isRegionSupervisor,
    myRegionId,
    lessonNamesInMyRegion,
    lessonNamesInMyRegionLectures,
  ]);

  const userMap = useMemo(() => {
    const m = new Map<string, User>();
    (users ?? []).forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  /** Aktif bölgeler: her satırda `Bölge Adı (Hoca)` — plan başına bölgeye göre hoca. */
  const lessonRegionSummaryText = useMemo(() => {
    const map = new Map<string, string>();

    const labelForTeacher = (teacherId: string) => {
      const u = userMap.get(teacherId);
      if (!u) return 'Kullanıcı bulunamadı';
      return [u.name, u.lastname].filter(Boolean).join(' ').trim() || u.email || '—';
    };

    const teacherNamesForRegion = (lessonName: string, regionId: string): string => {
      const matching = (regionLectureSchedules ?? []).filter(
        (s) => s.lectureName === lessonName && s.regionId === regionId,
      );
      const names = new Set<string>();
      for (const s of matching) {
        if (s.teacherId) names.add(labelForTeacher(s.teacherId));
      }
      if (names.size === 0) return '—';
      return Array.from(names)
        .sort((a, b) => a.localeCompare(b, 'tr'))
        .join(', ');
    };

    for (const lesson of scopedLessons) {
      const list = activeRegionsCatalog.filter((r) =>
        (r.lectures ?? []).includes(lesson.name),
      );
      if (list.length > 0) {
        const parts = [...list]
          .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
          .map(
            (r) =>
              `${r.name} (${teacherNamesForRegion(lesson.name, r.id)})`,
          );
        map.set(lesson.id, parts.join(', '));
      } else if (
        isRegionSupervisor &&
        myRegionId &&
        (lessonNamesInMyRegion.has(lesson.name) ||
          lessonNamesInMyRegionLectures.has(lesson.name))
      ) {
        const r = activeRegionsCatalog.find((reg) => reg.id === myRegionId);
        const n = r?.name ?? '';
        const t = teacherNamesForRegion(lesson.name, myRegionId);
        map.set(lesson.id, n ? `${n} (${t})` : '');
      } else {
        map.set(lesson.id, '');
      }
    }
    return map;
  }, [
    scopedLessons,
    activeRegionsCatalog,
    isRegionSupervisor,
    myRegionId,
    lessonNamesInMyRegion,
    lessonNamesInMyRegionLectures,
    regionLectureSchedules,
    userMap,
  ]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-medium">
            <HiBookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dersler</h1>
            <p className="text-gray-500 mt-1">
              {isRegionSupervisor
                ? 'Bölgenizdeki dersleri görüntüleyin; yeni ders yalnızca kendi aktif bölgenize eklenir.'
                : 'Tüm ders başlıklarını ve açıklamalarını yönetin.'}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2 text-gray-700"
          >
            <HiRefresh className="w-5 h-5" />
            <span className="hidden sm:inline">Yenile</span>
          </button>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            disabled={
              isRegionSupervisor &&
              (!myRegionId || !mySupervisorRegionIsActive)
            }
            title={
              isRegionSupervisor && (!myRegionId || !mySupervisorRegionIsActive)
                ? 'Atanmış aktif bir bölgeniz olmalıdır.'
                : undefined
            }
            className="px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all shadow-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-primary-600 disabled:hover:to-primary-700"
          >
            <HiPlus className="w-5 h-5" />
            <span>Yeni Ders</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-800 text-sm">Hata: {error.message}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-soft p-4">
        <div className="relative">
          <HiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Ders ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-soft overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-4" />
            <p className="text-gray-600">Yükleniyor...</p>
          </div>
        ) : filteredLessons.length === 0 ? (
          <div className="p-12 text-center">
            <HiBookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 font-medium mb-1">
              {searchTerm ? 'Ders bulunamadı' : 'Henüz ders yok'}
            </p>
            <p className="text-sm text-gray-500">
              {searchTerm ? 'Arama terimini değiştirmeyi deneyin' : 'Yeni ders ekleyerek başlayın'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Ders Adı
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Açıklama
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Durum
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[10rem] max-w-md">
                    Aktif Bölgeler
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLessons.map((lesson) => (
                  <tr key={lesson.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        {lesson.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap max-w-md">
                      <div className="text-sm text-gray-600 line-clamp-2">
                        {lesson.description || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 inline-flex text-xs font-semibold rounded-full border ${
                          lesson.isActive
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}
                      >
                        {lesson.isActive ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 max-w-md align-top">
                      {lessonRegionSummaryText.get(lesson.id) ? (
                        <p className="text-sm text-gray-700 line-clamp-4 leading-relaxed">
                          {lessonRegionSummaryText.get(lesson.id)}
                        </p>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        {isRegionSupervisor ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setLessonParticipantsForName(lesson.name);
                                setShowLessonParticipantsModal(true);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center gap-2"
                            >
                              <HiUsers className="w-4 h-4" />
                              Katılımcılar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!myRegionId) return;
                                navigate(`/regions/${myRegionId}?tab=lessons`);
                              }}
                              disabled={!myRegionId}
                              className="px-3 py-1.5 rounded-xl bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors flex items-center gap-2 border border-primary-100 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Bölge ders ayarları"
                            >
                              <HiFolder className="w-5 h-5" />
                              Ders detayları
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setLessonRegionsModalLesson(lesson);
                                setSelectedPlanRegionId(planTargetRegions[0]?.id ?? '');
                              }}
                              className="p-2 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors border border-primary-100"
                              title="Bölgeler ve ders planı"
                            >
                              <HiFolder className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleEditLesson(lesson)}
                              className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                              title="Düzenle"
                            >
                              <HiPencil className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleToggleActive(lesson)}
                              className={`p-2 rounded-lg transition-colors ${
                                lesson.isActive
                                  ? 'text-yellow-600 hover:bg-yellow-50'
                                  : 'text-green-600 hover:bg-green-50'
                              }`}
                              title={lesson.isActive ? 'Pasif yap' : 'Aktifleştir'}
                            >
                              {lesson.isActive ? 'Pasif' : 'Aktif'}
                            </button>
                            <button
                              onClick={() => handleDeleteLesson(lesson.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Sil"
                            >
                              <HiTrash className="w-5 h-5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in"
          style={{ marginTop: '0px' }}
        >
          <div className="bg-white rounded-2xl max-w-md w-full shadow-large animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Yeni Ders</h2>
                {isRegionSupervisor && myRegion && (
                  <p className="text-sm text-gray-500 mt-1">
                    Kayıt, yalnızca <span className="font-medium text-gray-700">{myRegion.name}</span>{' '}
                    bölgesinin ders listesine eklenir.
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
                disabled={isSubmitting}
              >
                <HiX className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddLesson} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Ders Adı *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="Örn: Tefsir"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Açıklama
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
                  placeholder="Ders hakkında kısa bir açıklama"
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium text-gray-700"
                  disabled={isSubmitting}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all font-medium shadow-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {!isRegionSupervisor && showEditModal && editingLesson && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in"
          style={{ marginTop: '0px' }}
        >
          <div className="bg-white rounded-2xl max-w-md w-full shadow-large animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-gray-900">Dersi Düzenle</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingLesson(null);
                  setEditFormData({ name: '', description: '' });
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={isSubmitting}
              >
                <HiX className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateLesson} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Ders Adı *
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, name: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="Örn: Tefsir"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Açıklama
                </label>
                <textarea
                  value={editFormData.description}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
                  placeholder="Ders hakkında kısa bir açıklama"
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingLesson(null);
                    setEditFormData({ name: '', description: '' });
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium text-gray-700"
                  disabled={isSubmitting}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all font-medium shadow-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Güncelleniyor...' : 'Güncelle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Region Supervisor - Katılımcılar Modal */}
      {isRegionSupervisor && showLessonParticipantsModal && lessonParticipantsForName && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => {
            setShowLessonParticipantsModal(false);
            setLessonParticipantsForName(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full shadow-large animate-scale-in max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
              <div className="min-w-0">
                <h2 className="text-2xl font-bold text-gray-900 truncate">
                  Katılımcılar
                </h2>
                <p className="text-sm text-gray-500 truncate">
                  {lessonParticipantsForName}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowLessonParticipantsModal(false);
                  setLessonParticipantsForName(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                type="button"
              >
                <HiX className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {lessonParticipants.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                  <p className="text-sm text-gray-600">Bu ders için katılımcı bulunamadı.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {lessonParticipants.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {u.name} {u.lastname ?? ''}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {u.email ?? u.username ?? '-'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setShowLessonParticipantsModal(false);
                            setLessonParticipantsForName(null);
                            navigate(`/users/${u.id}`);
                          }}
                          className="px-3 py-1.5 text-xs rounded-xl border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                        >
                          Detay
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => {
                  setShowLessonParticipantsModal(false);
                  setLessonParticipantsForName(null);
                }}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {lessonRegionsModalLesson && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => setLessonRegionsModalLesson(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full shadow-large animate-scale-in max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
              <div className="min-w-0 flex items-start gap-3">
                <span className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-sm">
                  <HiFolder className="w-5 h-5 text-white" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-gray-900 truncate">Bölgeler</h2>
                  <p className="text-sm text-gray-500 truncate mt-0.5">
                    {lessonRegionsModalLesson.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLessonRegionsModalLesson(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
              >
                <HiX className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Aktif bölgede kayıtlı
                </h3>
                {regionsModalDisplayList.length > 0 ? (
                  <ul className="space-y-2">
                    {regionsModalDisplayList.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setLessonRegionsModalLesson(null);
                            navigate(`/regions/${r.id}?tab=lessons`);
                          }}
                          className="w-full text-left px-3 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-900 transition-colors"
                        >
                          {r.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                    Bu ders henüz hiçbir aktif bölgenin ders listesinde görünmüyor. Aşağıdan bölge
                    seçerek ders planı ekranına gidebilirsiniz.
                  </p>
                )}
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Ders planı oluştur
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  Bölge seçin; Dersler sekmesi açılır ve plan formu bu ders için hazırlanır.
                </p>
                {planTargetRegions.length === 0 ? (
                  <p className="text-sm text-gray-600">Planlanabilir aktif bölge bulunamadı.</p>
                ) : (
                  <div className="space-y-3">
                    <select
                      value={selectedPlanRegionId}
                      onChange={(e) => setSelectedPlanRegionId(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      {planTargetRegions.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!selectedPlanRegionId}
                      onClick={() => {
                        if (!lessonRegionsModalLesson || !selectedPlanRegionId) return;
                        const q = new URLSearchParams();
                        q.set('tab', 'lessons');
                        q.set('planLecture', lessonRegionsModalLesson.name);
                        setLessonRegionsModalLesson(null);
                        navigate(`/regions/${selectedPlanRegionId}?${q.toString()}`);
                      }}
                      className="w-full px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl text-sm font-medium hover:from-primary-700 hover:to-primary-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Ders planına git
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setLessonRegionsModalLesson(null)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

