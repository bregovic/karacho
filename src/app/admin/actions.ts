'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';

export async function createSong(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Nejste přihlášeni');
  }

  const title = formData.get('title') as string;
  const artist = formData.get('artist') as string;
  const lyrics = formData.get('lyrics') as string;

  if (!title) return;

  await db.song.create({
    data: {
      title,
      artist: artist || null,
      lyrics: lyrics || null,
    },
  });

  revalidatePath('/admin');
}

export async function updateSongAudio(songId: string, audioUrl: string) {
  await db.song.update({ where: { id: songId }, data: { audioUrl } });
  revalidatePath('/admin');
}

export async function updateSongJson(songId: string, jsonUrl: string) {
  await db.song.update({ where: { id: songId }, data: { jsonUrl } });
  revalidatePath('/admin');
  revalidatePath('/designer');
}

export async function updateSongVideo(songId: string, videoUrl: string) {
  await db.song.update({ where: { id: songId }, data: { videoUrl } });
  revalidatePath('/admin');
  revalidatePath('/renderer');
}

export async function deleteSong(songId: string) {
  await db.song.delete({ where: { id: songId } });
  revalidatePath('/admin');
}
