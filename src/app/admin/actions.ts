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
  const genre = formData.get('genre') as string;
  const tagsString = formData.get('tags') as string;
  
  if (!title) return;

  const tags = tagsString ? tagsString.split(',').map(t => t.trim()).filter(Boolean) : [];

  await db.song.create({
    data: {
      title,
      artist: artist || null,
      genre: genre || null,
      tags,
      lyrics: lyrics || null,
    },
  });

  revalidatePath('/admin');
}

export async function updateSongAudio(songId: string, audioUrl: string) {
  await db.song.update({ where: { id: songId }, data: { audioUrl } });
  revalidatePath('/admin');
}

export async function updateSongInstrumental(songId: string, instrumentalUrl: string) {
  await db.song.update({ where: { id: songId }, data: { instrumentalUrl } });
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

export async function updateSongBackground(songId: string, backgroundUrl: string) {
  await db.song.update({ where: { id: songId }, data: { backgroundUrl } });
  revalidatePath('/admin');
  revalidatePath('/renderer');
}

export async function updateSong(songId: string, data: any) {
  const session = await auth();
  if (!session?.user) throw new Error('Nejste přihlášeni');

  // Pokud jsou v datech tagy jako string, převedeme je na pole
  if (typeof data.tags === 'string') {
    data.tags = data.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
  }

  await db.song.update({ 
    where: { id: songId }, 
    data 
  });
  revalidatePath('/admin');
}

export async function deleteSong(songId: string) {
  await db.song.delete({ where: { id: songId } });
  revalidatePath('/admin');
}
