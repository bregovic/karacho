'use server';

import { db } from '@/lib/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';

export async function getUserProfileData() {
  const session = await auth();
  if (!session?.user?.email) return null;

  return await db.user.findUnique({
    where: { email: session.user.email },
    include: {
      singingHistory: {
        include: { song: true },
        orderBy: { createdAt: 'desc' },
        take: 50
      }
    }
  });
}

export async function updateProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Nejste přihlášeni');

  const nickname = formData.get('nickname') as string;
  const email = formData.get('email') as string;
  const image = formData.get('image') as string;
  const sendEmails = formData.get('sendEmails') === 'on';

  await db.user.update({
    where: { id: session.user.id },
    data: {
      nickname: nickname || null,
      email: email || undefined,
      image: image || null,
      sendEmails
    }
  });

  revalidatePath('/profile');
  return { success: true };
}

export async function changePassword(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Nejste přihlášeni');

  const oldPassword = formData.get('oldPassword') as string;
  const newPassword = formData.get('newPassword') as string;

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || !user.password) throw new Error('Uživatel nemá heslo');

  const isValid = await bcrypt.compare(oldPassword, user.password);
  if (!isValid) return { error: 'Původní heslo je nesprávné' };

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await db.user.update({
    where: { id: session.user.id },
    data: { password: hashedPassword }
  });

  return { success: true };
}

export async function recordSinging(songId: string) {
  const session = await auth();
  if (!session?.user?.id) return;

  await db.singingHistory.create({
    data: {
      userId: session.user.id,
      songId
    }
  });
}

export async function getSingingStats() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const totalSings = await db.singingHistory.count({
    where: { userId: session.user.id }
  });

  const uniqueSongs = await db.singingHistory.groupBy({
    by: ['songId'],
    where: { userId: session.user.id },
    _count: true
  });

  return {
    totalSings,
    uniqueSongsCount: uniqueSongs.length
  };
}
