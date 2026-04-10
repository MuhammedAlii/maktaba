import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, useMapEvents } from 'react-leaflet';
import { GeoPoint, Timestamp } from 'firebase/firestore';
import { useCollection, firestoreHelpers } from '../../hooks/useFirestore';
import {
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
  HiX,
  HiRefresh,
  HiGlobeAlt,
} from 'react-icons/hi';

interface Region {
  id: string;
  name: string;
  description: string;
  lectures: string[];
  mapLocation?: GeoPoint;
  isActive: boolean;
  createAt?: Timestamp;
  address?: string;
}

interface Lesson {
  id: string;
  name: string;
  description?: string;
  isActive?: boolean;
}

function LocationClickHandler({
  onSelect,
}: {
  onSelect: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e: { latlng: { lat: number; lng: number } }) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function Regions() {
  const { data: regions, loading, error } = useCollection<Region>('regions');
  const { data: lessons } = useCollection<Lesson>('lessons');
  const navigate = useNavigate();

  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    lectures: [] as string[],
    address: '',
    latitude: '',
    longitude: '',
  });

  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    lectures: [] as string[],
    address: '',
    latitude: '',
    longitude: '',
    isActive: true,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMapPickerForAdd, setShowMapPickerForAdd] = useState(false);
  const [showMapPickerForEdit, setShowMapPickerForEdit] = useState(false);
  const [pendingEditLocation, setPendingEditLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pendingAddLocation, setPendingAddLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (error) {
      showError(error.message, 'Veri Yükleme Hatası');
    }
  }, [error]);

  const parseGeoPoint = (lat: string, lng: string): GeoPoint | undefined => {
    const latNum = Number(lat.replace(',', '.'));
    const lngNum = Number(lng.replace(',', '.'));
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) return undefined;
    return new GeoPoint(latNum, lngNum);
  };

  const handleAddRegion = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    showLoading('Bölge ekleniyor...');

    try {
      const lectures = formData.lectures;
      const mapLocation = parseGeoPoint(formData.latitude, formData.longitude);

      const payload: Omit<Region, 'id'> = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        lectures,
        address: formData.address.trim() || '',
        isActive: true,
        createAt: Timestamp.now(),
      };

      if (mapLocation) {
        payload.mapLocation = mapLocation;
      }

      await firestoreHelpers.add<Region>('regions', payload);

      setShowModal(false);
      setFormData({
        name: '',
        description: '',
        lectures: [],
        address: '',
        latitude: '',
        longitude: '',
      });
      hideLoading();
      // await showSuccess('Bölge başarıyla eklendi!');
    } catch (err) {
      console.error('Bölge eklenirken hata:', err);
      hideLoading();
      await showError('Bölge eklenirken bir hata oluştu!');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditRegion = (region: Region) => {
    setEditingRegion(region);
    setEditFormData({
      name: region.name || '',
      description: region.description || '',
      lectures: region.lectures || [],
      address: region.address || '',
      latitude:
        region.mapLocation?.latitude !== undefined
          ? String(region.mapLocation.latitude)
          : '',
      longitude:
        region.mapLocation?.longitude !== undefined
          ? String(region.mapLocation.longitude)
          : '',
      isActive: region.isActive ?? true,
    });
    setShowEditModal(true);
  };

  const handleUpdateRegion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRegion) return;

    setIsSubmitting(true);
    showLoading('Bölge güncelleniyor...');

    try {
      const lectures = editFormData.lectures;
      const mapLocation = parseGeoPoint(
        editFormData.latitude,
        editFormData.longitude,
      );

      const updates: Partial<Region> = {
        name: editFormData.name.trim(),
        description: editFormData.description.trim(),
        lectures,
        address: editFormData.address.trim() || '',
        isActive: editFormData.isActive,
      };

      if (mapLocation) {
        updates.mapLocation = mapLocation;
      } else {
        updates.mapLocation = undefined;
      }

      await firestoreHelpers.update<Region>(
        'regions',
        editingRegion.id,
        updates,
      );

      setShowEditModal(false);
      setEditingRegion(null);
      setEditFormData({
        name: '',
        description: '',
        lectures: [],
        address: '',
        latitude: '',
        longitude: '',
        isActive: true,
      });
      hideLoading();
      // await showSuccess('Bölge başarıyla güncellendi!');
    } catch (err) {
      console.error('Bölge güncellenirken hata:', err);
      hideLoading();
      await showError('Bölge güncellenirken bir hata oluştu!');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRegion = async (id: string) => {
    const confirmed = await showConfirm(
      'Bu bölgeyi pasif yapmak istediğinizden emin misiniz?',
      'Bölgeyi Pasif Yap',
      {
        confirmButtonText: 'Evet, Pasif Yap',
        cancelButtonText: 'İptal',
        icon: 'warning',
      },
    );

    if (!confirmed) return;

    showLoading('Bölge pasif yapılıyor...');

    try {
      await firestoreHelpers.update<Region>('regions', id, {
        isActive: false,
      });
      hideLoading();
      // await showSuccess('Bölge başarıyla pasif yapıldı!');
    } catch (err) {
      console.error('Bölge pasif yapılırken hata:', err);
      hideLoading();
      await showError('Bölge pasif yapılırken bir hata oluştu!');
    }
  };

  const handleActivateRegion = async (id: string) => {
    const confirmed = await showConfirm(
      'Bu bölgeyi tekrar aktifleştirmek istediğinizden emin misiniz?',
      'Bölgeyi Aktifleştir',
      {
        confirmButtonText: 'Evet, Aktifleştir',
        cancelButtonText: 'İptal',
        icon: 'warning',
      },
    );

    if (!confirmed) return;

    showLoading('Bölge aktifleştiriliyor...');

    try {
      await firestoreHelpers.update<Region>('regions', id, {
        isActive: true,
      });
      hideLoading();
      // await showSuccess('Bölge tekrar aktifleştirildi!');
    } catch (err) {
      console.error('Bölge aktifleştirilirken hata:', err);
      hideLoading();
      await showError('Bölge aktifleştirilirken bir hata oluştu!');
    }
  };

  const filteredRegions = regions.filter((region) => {
    const term = searchTerm.toLowerCase();
    return (
      region.name?.toLowerCase().includes(term) ||
      region.description?.toLowerCase().includes(term) ||
      (region.lectures || [])
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  });

  const formatLectures = (lectures: string[]) =>
    lectures && lectures.length > 0 ? lectures.join(', ') : 'Tanımlı ders yok';

  const formatLocation = (mapLocation?: GeoPoint) => {
    if (!mapLocation) return 'Konum yok';
    return `${mapLocation.latitude.toFixed(4)}, ${mapLocation.longitude.toFixed(
      4,
    )}`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bölgeler</h1>
          <p className="text-gray-500 mt-1">
            {loading
              ? 'Yükleniyor...'
              : searchTerm
              ? `${filteredRegions.length} / ${regions.length} bölge`
              : `${regions.length} bölge`}
          </p>
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
            onClick={() => setShowModal(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all shadow-medium flex items-center gap-2"
          >
            <HiPlus className="w-5 h-5" />
            <span>Yeni Bölge</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-800">Hata: {error.message}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-soft p-4">
        <div className="relative">
          <HiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Bölge ara..."
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
        ) : filteredRegions.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-600 font-medium mb-1">
              {searchTerm ? 'Bölge bulunamadı' : 'Henüz bölge yok'}
            </p>
            <p className="text-sm text-gray-500">
              {searchTerm
                ? 'Arama terimini değiştirmeyi deneyin'
                : 'Yeni bölge ekleyerek başlayın'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Ad
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Açıklama
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Dersler
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Konum
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Durum
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRegions.map((region) => (
                  <tr key={region.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        {region.name || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap max-w-xs">
                      <div className="text-sm text-gray-600 line-clamp-2">
                        {region.description || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap max-w-xs">
                      <div className="text-sm text-gray-600 line-clamp-2">
                        {formatLectures(region.lectures || [])}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {formatLocation(region.mapLocation)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 inline-flex text-xs font-semibold rounded-full border ${
                          region.isActive
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}
                      >
                        {region.isActive ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/regions/${region.id}`)}
                          disabled={!region.isActive}
                          className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                            region.isActive
                              ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
                              : 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
                          }`}
                        >
                          Detay
                        </button>
                        <button
                          onClick={() => handleEditRegion(region)}
                          disabled={!region.isActive}
                          className={`p-2 rounded-lg transition-colors ${
                            region.isActive
                              ? 'text-primary-600 hover:bg-primary-50'
                              : 'text-gray-300 bg-gray-50 cursor-not-allowed'
                          }`}
                        >
                          <HiPencil className="w-5 h-5" />
                        </button>
                        {region.isActive ? (
                          <button
                            onClick={() => handleDeleteRegion(region.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <HiTrash className="w-5 h-5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivateRegion(region.id)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          >
                            <HiRefresh className="w-5 h-5" />
                          </button>
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

      {showEditModal && editingRegion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in" style={{ marginTop: '0px' }}>
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-large animate-scale-in">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Bölge Düzenle</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingRegion(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={isSubmitting}
              >
                <HiX className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={handleUpdateRegion}
              className="p-6 space-y-5 max-h-[80vh] overflow-y-auto"
            >
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Ad *
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, name: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="Bölge adı"
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
                    setEditFormData({
                      ...editFormData,
                      description: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
                  placeholder="Bölge açıklaması"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Dersler
                </label>
                <div className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-white">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {editFormData.lectures.length === 0 ? (
                      <span className="text-xs text-gray-400">
                        Henüz ders seçilmedi
                      </span>
                    ) : (
                      editFormData.lectures.map((lecture) => (
                        <button
                          key={lecture}
                          type="button"
                          onClick={() =>
                            setEditFormData((prev) => ({
                              ...prev,
                              lectures: prev.lectures.filter((l) => l !== lecture),
                            }))
                          }
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary-50 text-primary-700 text-xs border border-primary-200 hover:bg-primary-100 transition-colors"
                          disabled={isSubmitting}
                        >
                          <span>{lecture}</span>
                          <HiX className="w-3 h-3" />
                        </button>
                      ))
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {lessons
                      .filter((lesson) => lesson.isActive !== false)
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((lesson) => {
                        const checked = editFormData.lectures.includes(lesson.name);
                        return (
                          <label
                            key={lesson.id}
                            className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                              disabled={isSubmitting}
                              checked={checked}
                              onChange={() => {
                                setEditFormData((prev) => {
                                  const exists = prev.lectures.includes(lesson.name);
                                  const lectures = exists
                                    ? prev.lectures.filter((l) => l !== lesson.name)
                                    : [...prev.lectures, lesson.name];
                                  return { ...prev, lectures };
                                });
                              }}
                            />
                            <span>
                              <span className="font-semibold">{lesson.name}</span>
                              {lesson.description && (
                                <span className="text-gray-500">
                                  {' '}
                                  ({lesson.description})
                                </span>
                              )}
                            </span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Adres
                </label>
                <textarea
                  value={editFormData.address}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, address: e.target.value })
                  }
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
                  placeholder="Bölgenin adresi veya konum açıklaması"
                  disabled={isSubmitting}
                />
              </div>
              <div className="grid grid-cols-[5fr_5fr_2fr] gap-4 items-end">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Enlem
                  </label>
                  <input
                    type="text"
                    value={editFormData.latitude}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        latitude: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    placeholder="örn: 41.015137"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Boylam
                  </label>
                  <input
                    type="text"
                    value={editFormData.longitude}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        longitude: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    placeholder="örn: 28.979530"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="flex flex-col items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setShowMapPickerForEdit(true)}
                    className="flex items-center justify-center w-10 h-10 rounded-full border border-primary-300 text-primary-700 hover:bg-primary-50 transition-colors"
                    disabled={isSubmitting}
                  >
                    <HiGlobeAlt className="w-5 h-5" />
                  </button>
                  <span className="mt-1 text-[10px] text-gray-600 text-center">
                    Haritadan Seç
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Durum
                </label>
                <select
                  value={editFormData.isActive ? 'active' : 'passive'}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      isActive: e.target.value === 'active',
                    })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  disabled={isSubmitting}
                >
                  <option value="active">Aktif</option>
                  <option value="passive">Pasif</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingRegion(null);
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

      {showModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in"
          style={{ marginTop: '0px' }}
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-large animate-scale-in">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Yeni Bölge</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={isSubmitting}
              >
                <HiX className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={handleAddRegion}
              className="p-6 space-y-5 max-h-[80vh] overflow-y-auto"
            >
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Ad *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="Bölge adı"
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
                  placeholder="Bölge açıklaması"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Dersler
                </label>
                <div className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-white">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {formData.lectures.length === 0 ? (
                      <span className="text-xs text-gray-400">
                        Henüz ders seçilmedi
                      </span>
                    ) : (
                      formData.lectures.map((lecture) => (
                        <button
                          key={lecture}
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              lectures: prev.lectures.filter((l) => l !== lecture),
                            }))
                          }
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary-50 text-primary-700 text-xs border border-primary-200 hover:bg-primary-100 transition-colors"
                          disabled={isSubmitting}
                        >
                          <span>{lecture}</span>
                          <HiX className="w-3 h-3" />
                        </button>
                      ))
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {lessons
                      .filter((lesson) => lesson.isActive !== false)
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((lesson) => {
                        const checked = formData.lectures.includes(lesson.name);
                        return (
                          <label
                            key={lesson.id}
                            className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                              disabled={isSubmitting}
                              checked={checked}
                              onChange={() => {
                                setFormData((prev) => {
                                  const exists = prev.lectures.includes(lesson.name);
                                  const lectures = exists
                                    ? prev.lectures.filter((l) => l !== lesson.name)
                                    : [...prev.lectures, lesson.name];
                                  return { ...prev, lectures };
                                });
                              }}
                            />
                            <span>
                              <span className="font-semibold">{lesson.name}</span>
                              {lesson.description && (
                                <span className="text-gray-500">
                                  {' '}
                                  ({lesson.description})
                                </span>
                              )}
                            </span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Adres
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
                  placeholder="Bölgenin adresi veya konum açıklaması"
                  disabled={isSubmitting}
                />
              </div>
              <div className="grid grid-cols-[5fr_5fr_2fr] gap-4 items-end">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Enlem
                  </label>
                  <input
                    type="text"
                    value={formData.latitude}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        latitude: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    placeholder="örn: 41.015137"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Boylam
                  </label>
                  <input
                    type="text"
                    value={formData.longitude}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        longitude: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    placeholder="örn: 28.979530"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="flex flex-col items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setShowMapPickerForAdd(true)}
                    className="flex items-center justify-center w-10 h-10 rounded-full border border-primary-300 text-primary-700 hover:bg-primary-50 transition-colors"
                    disabled={isSubmitting}
                  >
                    <HiGlobeAlt className="w-5 h-5" />
                  </button>
                  <span className="mt-1 text-[10px] text-gray-600 text-center">
                    Haritadan Seç
                  </span>
                </div>
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

      {showMapPickerForEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-large p-4 space-y-3">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-gray-900 text-sm">
                Konum Seç (Düzenleme)
              </h3>
              <button
                type="button"
                onClick={() => setShowMapPickerForEdit(false)}
                className="p-1 rounded-full hover:bg-gray-100"
              >
                <HiX className="w-4 h-4" />
              </button>
            </div>
            <MapContainer
              {...({
                center: [
                  editFormData.latitude ? Number(editFormData.latitude) || 39 : 39,
                  editFormData.longitude ? Number(editFormData.longitude) || 35 : 35,
                ] as [number, number],
                zoom: 5,
                className: 'h-80 w-full rounded-xl overflow-hidden',
              } as React.ComponentProps<typeof MapContainer>)}
            >
              <TileLayer
                {...({
                  attribution: '&copy; OpenStreetMap contributors',
                  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                } as React.ComponentProps<typeof TileLayer>)}
              />
              <LocationClickHandler
                onSelect={(lat, lng) => {
                  setPendingEditLocation({ lat, lng });
                }}
              />
            </MapContainer>
            <div className="flex items-center justify-between mt-3">
              <div className="text-xs text-gray-600">
                {pendingEditLocation ? (
                  <span>
                    Seçilen konum:{' '}
                    <span className="font-semibold">
                      {pendingEditLocation.lat.toFixed(5)},{' '}
                      {pendingEditLocation.lng.toFixed(5)}
                    </span>
                  </span>
                ) : (
                  <span>Haritaya tıklayarak bir konum seçin.</span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowMapPickerForEdit(false)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  disabled={!pendingEditLocation}
                  onClick={() => {
                    if (!pendingEditLocation) return;
                    setEditFormData((prev) => ({
                      ...prev,
                      latitude: String(pendingEditLocation.lat),
                      longitude: String(pendingEditLocation.lng),
                    }));
                    setShowMapPickerForEdit(false);
                    setPendingEditLocation(null);
                  }}
                  className="px-3 py-1.5 text-xs rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Bu Konumu Onayla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMapPickerForAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-large p-4 space-y-3">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-gray-900 text-sm">
                Konum Seç (Yeni Bölge)
              </h3>
              <button
                type="button"
                onClick={() => setShowMapPickerForAdd(false)}
                className="p-1 rounded-full hover:bg-gray-100"
              >
                <HiX className="w-4 h-4" />
              </button>
            </div>
            <MapContainer
              {...({
                center: [
                  formData.latitude ? Number(formData.latitude) || 39 : 39,
                  formData.longitude ? Number(formData.longitude) || 35 : 35,
                ] as [number, number],
                zoom: 5,
                className: 'h-80 w-full rounded-xl overflow-hidden',
              } as React.ComponentProps<typeof MapContainer>)}
            >
              <TileLayer
                {...({
                  attribution: '&copy; OpenStreetMap contributors',
                  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                } as React.ComponentProps<typeof TileLayer>)}
              />
              <LocationClickHandler
                onSelect={(lat, lng) => {
                  setPendingAddLocation({ lat, lng });
                }}
              />
            </MapContainer>
            <div className="flex items-center justify-between mt-3">
              <div className="text-xs text-gray-600">
                {pendingAddLocation ? (
                  <span>
                    Seçilen konum:{' '}
                    <span className="font-semibold">
                      {pendingAddLocation.lat.toFixed(5)},{' '}
                      {pendingAddLocation.lng.toFixed(5)}
                    </span>
                  </span>
                ) : (
                  <span>Haritaya tıklayarak bir konum seçin.</span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowMapPickerForAdd(false)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  disabled={!pendingAddLocation}
                  onClick={() => {
                    if (!pendingAddLocation) return;
                    setFormData((prev) => ({
                      ...prev,
                      latitude: String(pendingAddLocation.lat),
                      longitude: String(pendingAddLocation.lng),
                    }));
                    setShowMapPickerForAdd(false);
                    setPendingAddLocation(null);
                  }}
                  className="px-3 py-1.5 text-xs rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Bu Konumu Onayla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

