'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function createSong(formData: FormData) {
  const title = formData.get('title') as string;
  const author = formData.get('author') as string;
  const lyrics = formData.get('lyrics') as string;
  const maxBlockChars = parseInt(formData.get('maxBlockChars') as string) || 40;

  if (!title) return;

  await db.song.create({
    data: {
      title,
      author,
      lyrics,
      maxBlockChars,
    }
  });

  revalidatePath('/admin');
}
