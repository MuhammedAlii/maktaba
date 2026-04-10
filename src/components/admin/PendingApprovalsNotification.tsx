import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCollection } from '../../hooks/useFirestore';
import { useAuth } from '../../contexts/AuthContext';
import Swal from 'sweetalert2';
import confirmationNotifyImg from '../../assets/confirmation-notify.png';

interface User {
  id: string;
  role: string;
  isUserApproved?: boolean;
  regionIds?: string[];
}

interface LessonJoinRequest {
  id: string;
  regionId: string;
}

export default function PendingApprovalsNotification() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const hasShown = useRef(false);

  const { data: users } = useCollection<User>('users');
  const { data: requests } = useCollection<LessonJoinRequest>('lessonJoinRequests');

  const isApprover = user?.role === 'admin' || user?.role === 'regionSupervisor';

  const hasPendingData = (() => {
    if (!users || !requests || !isApprover || !user) return false;
    const pendingUsers = users.filter(
      (u) =>
        u.role === 'user' &&
        u.isUserApproved !== true &&
        (u.regionIds ?? []).length > 0,
    );
    if (user.role === 'admin') {
      return pendingUsers.length > 0 || requests.length > 0;
    }
    const supervised = new Set(user.regionIds ?? []);
    const scopedUsers = pendingUsers.filter((u) =>
      (u.regionIds ?? []).some((rid) => supervised.has(rid)),
    );
    const scopedRequests = requests.filter((r) => supervised.has(r.regionId));
    return scopedUsers.length > 0 || scopedRequests.length > 0;
  })();

  useEffect(() => {
    if (!user || !isApprover || !hasPendingData || hasShown.current) return;

    const storageKey =
      user.role === 'admin'
        ? 'maktaba_admin_pending_approvals_shown'
        : `maktaba_supervisor_pending_approvals_shown_${user.id}`;
    if (sessionStorage.getItem(storageKey)) return;

    hasShown.current = true;
    sessionStorage.setItem(storageKey, '1');

    const handleReviewClick = () => {
      Swal.close();
      navigate('/onaylamalar');
    };

    const titleLine =
      user.role === 'admin'
        ? 'Admin, onaylanmayı bekleyen kullanıcılar var.'
        : 'Bölgenize ait onay bekleyen kayıtlar var.';

    Swal.fire({
      showClass: { popup: 'animate-fade-in' },
      customClass: {
        popup: 'rounded-2xl overflow-hidden max-w-[360px] p-0',
        htmlContainer: 'p-0 m-0 overflow-visible',
        actions: 'p-0 m-0 w-full block',
      },
      title: false,
      showConfirmButton: false,
      html: `
        <div class="bg-white rounded-2xl overflow-hidden">
          <img src="${confirmationNotifyImg}" alt="Onay bekleyen kayıtlar" class="w-full h-auto object-cover rounded-t-2xl mt-[20px]" style="max-height: 200px; object-fit: cover;" />
          <div class="px-5 pt-5 pb-2 text-center">
            <p class="text-gray-900 font-bold text-xl">
              Onay Bekleyen Kayıtlar!
            </p>
          </div>
          <div class="px-5 pb-5 text-center">
            <p class="text-gray-600 text-sm leading-relaxed">
              ${titleLine}
            </p>
          </div>
          <button type="button" class="pending-approvals-review-btn w-full py-3.5 text-base font-semibold flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white transition-colors">
            <span class="w-8 h-8 rounded-full bg-emerald-500/80 flex items-center justify-center">
              <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
              </svg>
            </span>
            Gözden Geçir
          </button>
        </div>
      `,
      width: 360,
      didOpen: () => {
        const btn = document.querySelector('.pending-approvals-review-btn');
        btn?.addEventListener('click', handleReviewClick);
      },
    });
  }, [user, isApprover, hasPendingData, navigate]);

  return null;
}
