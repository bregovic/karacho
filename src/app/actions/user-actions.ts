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
      },
      favorites: {
        include: { song: true },
        orderBy: { createdAt: 'desc' }
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

/**
 * Přidání nebo odebrání písně z oblíbených. Jedna akce pro obojí — srdíčko
 * je přepínač, takže se z rozhraní nikdy neposílá „přidej" na už přidanou.
 */
export async function prepniOblibenou(songId: string) {
  const session = await auth();
  if (!session?.user?.email) return { ok: false as const, error: 'Nejsi přihlášený.' };

  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user) return { ok: false as const, error: 'Účet nenalezen.' };

  const stavajici = await db.favorite.findUnique({
    where: { userId_songId: { userId: user.id, songId } },
  });

  if (stavajici) {
    await db.favorite.delete({ where: { id: stavajici.id } });
  } else {
    await db.favorite.create({ data: { userId: user.id, songId } });
  }

  revalidatePath('/profile');
  revalidatePath('/');
  return { ok: true as const, oblibena: !stavajici };
}

/** Seznam id oblíbených písní přihlášeného uživatele — pro vykreslení srdíček. */
export async function getOblibeneIds() {
  const session = await auth();
  if (!session?.user?.email) return [];

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    include: { favorites: { select: { songId: true } } },
  });
  return user?.favorites.map(f => f.songId) ?? [];
}
