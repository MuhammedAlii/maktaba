import { useParams, Link } from 'react-router-dom';
import { useCollection, useDocument } from '../../hooks/useFirestore';
import { where } from 'firebase/firestore';
import { HiAcademicCap, HiArrowLeft, HiChat } from 'react-icons/hi';

interface User {
  id: string;
  name: string;
  lastname?: string;
  email?: string;
  phone?: string;
  role: string;
  regionIds?: string[];
}

interface TeacherQualification {
  id: string;
  userId: string;
  fieldOfKnowledge: string;
  placeOfStudy: string;
  description: string;
  placeOfStudyAndDescription?: string;
}

function toPhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) return '90' + digits.slice(1);
  if (!digits.startsWith('90')) return '90' + digits;
  return digits;
}

export default function UserTeacherDetail() {
  const { teacherId } = useParams<{ teacherId: string }>();

  const { data: teacher, loading: teacherLoading } = useDocument<User>('users', teacherId || '');
  const { data: qualifications } = useCollection<TeacherQualification>(
    'teacherQualifications',
    teacherId ? [where('userId', '==', teacherId)] : [],
  );

  if (teacherLoading || !teacher) {
    return (
      <div className="min-h-[200px] flex items-center justify-center">
        <p className="text-gray-500 text-sm">Hoca bilgisi yükleniyor...</p>
      </div>
    );
  }

  const teacherName = [teacher.name, teacher.lastname].filter(Boolean).join(' ') || 'Hoca';
  const phone = teacher.phone?.trim();
  const whatsappUrl = phone
    ? `https://wa.me/${toPhoneForWhatsApp(phone)}?text=${encodeURIComponent(
        `Selamun aleykum ${teacher.name}, Maktaba ders halkası hakkında bilgi almak istiyorum.`
      )}`
    : null;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Link
        to="/teachers"
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-emerald-600"
      >
        <HiArrowLeft className="w-4 h-4" />
        Bölge Hocaları
      </Link>

      <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
        {/* Hoca fotoğrafı alanı - daha sonra eklenecek */}
        <div className="aspect-[3/2] sm:aspect-[2/1] bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-white/80 flex items-center justify-center shadow-inner">
            <span className="text-4xl sm:text-5xl font-bold text-emerald-600">
              {teacher.name?.[0]?.toUpperCase() || '?'}
            </span>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <div className="text-center sm:text-left border-b border-gray-100 pb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{teacherName}</h1>
            {teacher.email && (
              <p className="text-gray-600 mt-1">{teacher.email}</p>
            )}
          </div>

          {/* Hoca Kimliği / İlim Bilgileri */}
          {(qualifications?.length ?? 0) > 0 ? (
            <div className="space-y-6">
              <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900 border-b border-gray-200 pb-3">
                <HiAcademicCap className="w-6 h-6 text-teal-600" />
                Hoca Kimliği
              </h2>

              <div className="space-y-5">
                {qualifications?.map((q) => (
                  <div
                    key={q.id}
                    className="p-5 rounded-xl bg-gray-50 border border-gray-200 space-y-5"
                  >
                    {q.fieldOfKnowledge && (
                      <div>
                        <p className="text-sm font-semibold text-teal-700 uppercase tracking-wide mb-2">
                          İlim Alanı
                        </p>
                        <p className="text-base text-gray-800 leading-relaxed">{q.fieldOfKnowledge}</p>
                      </div>
                    )}
                    {q.placeOfStudy && (
                      <div>
                        <p className="text-sm font-semibold text-teal-700 uppercase tracking-wide mb-2">
                          İlim Aldığı Yer
                        </p>
                        <p className="text-base text-gray-800 leading-relaxed">{q.placeOfStudy}</p>
                      </div>
                    )}
                    {(q.description || q.placeOfStudyAndDescription) && (
                      <div>
                        <p className="text-sm font-semibold text-teal-700 uppercase tracking-wide mb-2">
                          Açıklama
                        </p>
                        <p className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap">
                          {q.description || q.placeOfStudyAndDescription}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center rounded-xl bg-gray-50 border border-gray-100">
              <HiAcademicCap className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">Hoca kimliği bilgisi henüz eklenmemiş.</p>
            </div>
          )}

          {/* İletişime Geç */}
          {whatsappUrl && (
            <div className="pt-4 border-t border-gray-100">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 text-base font-semibold text-white bg-[#25D366] rounded-xl hover:bg-[#20BD5A] transition-colors shadow-sm"
              >
                <HiChat className="w-6 h-6" />
                İletişime Geç
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
