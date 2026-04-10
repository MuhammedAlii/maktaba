import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { firestoreHelpers } from '../hooks/useFirestore';

export interface LessonJoinRequest {
  id: string;
  userId: string;
  scheduleId: string;
  regionId: string;
  createdAt: Timestamp;
}

export async function createLessonJoinRequest(
  userId: string,
  scheduleId: string,
  regionId: string
): Promise<void> {
  const q = query(
    collection(db, 'lessonJoinRequests'),
    where('userId', '==', userId),
    where('scheduleId', '==', scheduleId)
  );
  const snap = await getDocs(q);
  if (!snap.empty) {
    throw new Error('Bu ders için zaten katılım isteğiniz bulunuyor.');
  }

  await firestoreHelpers.add('lessonJoinRequests', {
    userId,
    scheduleId,
    regionId,
    createdAt: Timestamp.now(),
  });
}

interface UserWithLectures {
  userLectureIds?: string[];
}

interface ScheduleWithParticipants {
  participantUserIds?: string[];
}

export async function approveLessonJoinRequest(request: LessonJoinRequest): Promise<void> {
  const user = await firestoreHelpers.get<UserWithLectures>('users', request.userId);
  const schedule = await firestoreHelpers.get<ScheduleWithParticipants>(
    'regionLectureSchedules',
    request.scheduleId
  );

  if (!user || !schedule) {
    throw new Error('Kullanıcı veya ders planı bulunamadı.');
  }

  const currentUserLectures = user.userLectureIds ?? [];
  if (currentUserLectures.includes(request.scheduleId)) {
    await firestoreHelpers.delete('lessonJoinRequests', request.id);
    return;
  }

  const currentParticipants = schedule.participantUserIds ?? [];

  await Promise.all([
    firestoreHelpers.update<UserWithLectures>('users', request.userId, {
      userLectureIds: [...currentUserLectures, request.scheduleId],
    }),
    firestoreHelpers.update<ScheduleWithParticipants>(
      'regionLectureSchedules',
      request.scheduleId,
      {
        participantUserIds: [...currentParticipants, request.userId],
      }
    ),
    firestoreHelpers.delete('lessonJoinRequests', request.id),
  ]);
}

export async function rejectLessonJoinRequest(requestId: string): Promise<void> {
  await firestoreHelpers.delete('lessonJoinRequests', requestId);
}
