import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCollection } from '../../hooks/useFirestore';
import { useAuth } from '../../contexts/AuthContext';
import { HiAcademicCap, HiArrowLeft, HiChevronRight } from 'react-icons/hi';

interface User {
  id: string;
  name: string;
  lastname?: string;
  email?: string;
  phone?: string;
  role: string;
  regionIds?: string[];
}

export default function UserTeachers() {
  const { user } = useAuth();
  const regionIds = user?.regionIds ?? [];

  const { data: allUsers } = useCollection<User>('users');

  const regionTeachers = useMemo(() => {
    if (!allUsers || regionIds.length === 0) return [];
    return allUsers.filter(
      (u) =>
        u.role === 'teacher' &&
        (u.regionIds ?? []).some((rid) => regionIds.includes(rid))
    );
  }, [allUsers, regionIds]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <Link
        to="/"
        className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-emerald-600"
      >
        <HiArrowLeft className="w-4 h-4" />
        Ana sayfa
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <HiAcademicCap className="w-7 h-7 text-emerald-600" />
          Bölge Hocaları
        </h1>
        <p className="text-gray-600 mt-1">
          Dahil olduğunuz bölgelerdeki tüm hocalar
        </p>
      </div>

      {regionTeachers.length === 0 ? (
        <div className="rounded-2xl bg-gray-50 border border-gray-200 p-8 text-center">
          <p className="text-gray-600">Bölgenizde hoca bulunmuyor.</p>
          <Link to="/" className="inline-block mt-4 text-emerald-600 hover:text-emerald-700 font-medium">
            Ana sayfaya dön
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {regionTeachers.map((teacher) => {
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
      )}
    </div>
  );
}
