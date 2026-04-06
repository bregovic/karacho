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
  const audioUrl = formData.get('audioUrl') as string;
  const tagsString = formData.get('tags') as string;
  
  if (!title) return;

  const tags = tagsString ? tagsString.split(',').map(t => t.trim()).filter(Boolean) : [];

  const song = await db.song.create({
    data: {
      title,
      artist: artist || null,
      genre: genre || null,
      tags,
      lyrics: lyrics || null,
      audioUrl: audioUrl || null,
    },
  });

  revalidatePath('/admin');
  return song;
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

export async function updateSongVideo(songId: string, videoUrl: string, videoSize?: number) {
  await db.song.update({ 
    where: { id: songId }, 
    data: { videoUrl, videoSize: videoSize || undefined } 
  });
  revalidatePath('/admin');
  revalidatePath('/renderer');
}

export async function removeSongResource(songId: string, type: 'audio' | 'instrumental' | 'background' | 'json' | 'video') {
  const data: any = {};
  if (type === 'audio') data.audioUrl = null;
  if (type === 'instrumental') data.instrumentalUrl = null;
  if (type === 'background') data.backgroundUrl = null;
  if (type === 'json') data.jsonUrl = null;
  if (type === 'video') {
    data.videoUrl = null;
    data.videoSize = null;
  }

  await db.song.update({ where: { id: songId }, data });
  revalidatePath('/admin');
  revalidatePath('/renderer');
  revalidatePath('/designer');
}

export async function incrementPlayCount(songId: string) {
  try {
    await db.song.update({
      where: { id: songId },
      data: { playCount: { increment: 1 } }
    });
    revalidatePath('/');
  } catch (err) {
    console.error('Failed to increment play count:', err);
  }
}

export async function updateSongAnimation(songId: string, animationStyle: string) {
  await db.song.update({ where: { id: songId }, data: { animationStyle } });
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

export async function bulkRemoveBackground(backgroundUrl: string) {
  const session = await auth();
  if (!session?.user) throw new Error('Nejste přihlášeni');

  await db.song.updateMany({
    where: { backgroundUrl },
    data: { backgroundUrl: null }
  });
  revalidatePath('/admin');
}

export async function fetchLyricsAction(songId: string) {
  const song = await db.song.findUnique({ where: { id: songId } });
  if (!song || !song.artist || !song.title) return { error: 'Chybí interpret nebo název' };

  try {
    const res = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(song.artist)}/${encodeURIComponent(song.title)}`);
    const data = await res.json();
    if (data.lyrics) {
      await db.song.update({ where: { id: songId }, data: { lyrics: data.lyrics } });
      revalidatePath('/admin');
      return { success: true, lyrics: data.lyrics };
    }
    return { error: 'Text nenalezen' };
  } catch (err) {
    return { error: 'Chyba API' };
  }
}

export async function bulkFetchLyrics(songIds: string[]) {
  const results = { count: 0, failed: 0 };
  for (const id of songIds) {
    const res = await fetchLyricsAction(id);
    if (res.success) results.count++;
    else results.failed++;
  }
  revalidatePath('/admin');
  return results;
}

export async function bulkUpdateState(songIds: string[], newState: string) {
  await db.song.updateMany({
    where: { id: { in: songIds } },
    data: { state: newState as any }
  });
  revalidatePath('/admin');
}

export async function deleteSong(songId: string) {
  await db.song.delete({ where: { id: songId } });
  revalidatePath('/admin');
}
