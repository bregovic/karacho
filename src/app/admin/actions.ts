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
      animationStyle: 'karaoke-classic'
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

  const artist = song.artist;
  const title = song.title;

  try {
    // 1. STAV: Lyrist API (Moderní, čistý UTF8)
    const res1 = await fetch(`https://lyrist.vercel.app/api/${encodeURIComponent(title)}/${encodeURIComponent(artist)}`);
    if (res1.ok) {
      const data = await res1.json();
      if (data.lyrics) {
        await db.song.update({ where: { id: songId }, data: { lyrics: data.lyrics.trim() } });
        revalidatePath('/admin');
        return { success: true, lyrics: data.lyrics, source: 'Lyrist' };
      }
    }

    // 2. STAV: Vagalume (Obrovská CZ/SK databáze, spolehlivá diakritika)
    const res2 = await fetch(`https://api.vagalume.com.br/search.php?art=${encodeURIComponent(artist)}&mus=${encodeURIComponent(title)}&apikey=666a658e7948d9d20233d31c36006c9a`);
    if (res2.ok) {
      const data = await res2.json();
      if (data.mus && data.mus[0] && data.mus[0].text) {
        const lyrics = data.mus[0].text.trim();
        await db.song.update({ where: { id: songId }, data: { lyrics } });
        revalidatePath('/admin');
        return { success: true, lyrics, source: 'Vagalume' };
      }
    }

    // 3. STAV: Lyrics.ovh (Fallback)
    const res3 = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
    if (res3.ok) {
      const data = await res3.json();
      if (data.lyrics) {
        await db.song.update({ where: { id: songId }, data: { lyrics: data.lyrics.trim() } });
        revalidatePath('/admin');
        return { success: true, lyrics: data.lyrics, source: 'Lyrics.ovh' };
      }
    }

    return { error: 'Text nenalezen na žádném zdroji' };
  } catch (err) {
    console.error('Lyrics Fetch Error:', err);
    return { error: 'Chyba API' };
  }
}

export async function importLyricsFromUrl(songId: string, url: string) {
  if (!url.includes('karaoketexty.cz')) return { error: 'Podporováno pouze karaoketexty.cz' };
  
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
      }
    });
    
    if (!res.ok) return { error: 'Stránka je nedostupná (blokováno)' };
    
    const html = await res.text();
    // Pokusíme se vyndat text mezi <div class="text"> a souvisejícími tagy
    const match = html.match(/<p class="text">([\s\S]*?)<\/p>/) || html.match(/<div id="text">([\s\S]*?)<\/div>/);
    
    if (!match) return { error: 'Nepodařilo se v kódu stránky najít text písně' };
    
    let lyrics = match[1]
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>?/gm, '') // Smazání HTML tagů
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .trim();

    // Pokud tam jsou uvozovky/bordel na začátku (někdy to bývá v pre nebo p)
    if (lyrics.length > 0) {
      await db.song.update({ where: { id: songId }, data: { lyrics } });
      revalidatePath('/admin');
      return { success: true, lyrics };
    }
    
    return { error: 'Nalezený text je prázdný' };
  } catch (err) {
    return { error: 'Chyba stahování' };
  }
}

export async function bulkFetchMissingLyrics() {
  const session = await auth();
  if (!session?.user) throw new Error('Nejste přihlášeni');

  const songsWithoutLyrics = await db.song.findMany({
    where: { 
      OR: [
        { lyrics: null },
        { lyrics: '' }
      ],
      artist: { not: null },
      title: { not: '' }
    }
  });

  const results = { count: 0, failed: 0 };
  for (const s of songsWithoutLyrics) {
    const res = await fetchLyricsAction(s.id);
    if (res.success) results.count++;
    else results.failed++;
  }
  revalidatePath('/admin');
  return results;
}

export async function researchSongDataAction(songId: string) {
  const song = await db.song.findUnique({ where: { id: songId } });
  if (!song || !song.artist || !song.title) return { error: 'Chybí interpret nebo název' };

  const artist = song.artist;
  const title = song.title;
  const results: any = {};

  try {
    // 1. VAGALUME RESEARCH (Lyrics + Genre + Album)
    const vRes = await fetch(`https://api.vagalume.com.br/search.php?art=${encodeURIComponent(artist)}&mus=${encodeURIComponent(title)}&apikey=666a658e7948d9d20233d31c36006c9a`);
    if (vRes.ok) {
      const vData = await vRes.json();
      if (vData.mus && vData.mus[0]) {
        const track = vData.mus[0];
        if (track.text && (!song.lyrics || song.lyrics.length < 50)) {
           // Kontrola diakritiky - pokud obsahuje ? uprostřed slov, ignorovat
           if (!track.text.includes('?')) {
              results.lyrics = track.text.trim();
           }
        }
        // Žánr z Vagalume (pokud existuje)
        if (vData.art && vData.art.genre && vData.art.genre[0]) {
           results.genre = vData.art.genre[0].name;
        }
      }
    }

    // 2. LAST.FM RESEARCH (Tags + Year + Album)
    const lfApiKey = '4d75f2b8f847ff7638d2ef1c13d33f3b';
    const lfRes = await fetch(`https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${lfApiKey}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(title)}&format=json`);
    if (lfRes.ok) {
      const lfData = await lfRes.json();
      if (lfData.track) {
        // Tagy
        if (lfData.track.toptags && lfData.track.toptags.tag) {
          const tags = lfData.track.toptags.tag
            .slice(0, 5)
            .map((t: any) => t.name.toLowerCase())
            .filter((t: string) => !['seen live', 'favorites'].includes(t));
          results.tags = Array.from(new Set([...(song.tags || []), ...tags]));
        }
        // Album/Year info (Last.fm rok přímo nevrací snadno, ale můžeme zkusit album)
      }
    }

    // 3. KARAOKE TEXTY RESEARCH (Search + Scrape fallback - best for CZ/SK songs)
    if (!results.lyrics) {
      console.info(`[Research] Looking at karaoketexty.cz search for: ${artist} - ${title}`);
      const searchUrl = `https://www.karaoketexty.cz/search?q=${encodeURIComponent(artist + ' ' + title)}`;
      const sRes = await fetch(searchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36' }
      });
      
      if (sRes.ok) {
        const sHtml = await sRes.text();
        const firstMatch = sHtml.match(/<a href="([^"]*?)" class="song-link">/);
        if (firstMatch && firstMatch[1]) {
           const fullUrl = firstMatch[1].startsWith('http') ? firstMatch[1] : `https://www.karaoketexty.cz${firstMatch[1]}`;
           const lRes = await importLyricsFromUrl(songId, fullUrl);
           if (lRes.success) {
             results.lyrics = lRes.lyrics;
           }
        }
      }
    }

    if (Object.keys(results).length > 0) {
      await db.song.update({ where: { id: songId }, data: results });
      revalidatePath('/admin');
      return { success: true, updated: results };
    }

    return { error: 'Nepodařilo se najít žádná nová metadata.' };
  } catch (err) {
    console.error('Research Error:', err);
    return { error: 'Chyba při researchu dat.' };
  }
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

export async function addAdminEmail(email: string) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('Nemáte oprávnění');

  await db.adminEmail.upsert({
    where: { email },
    update: {},
    create: { email }
  });
  revalidatePath('/admin');
}

export async function removeAdminEmail(id: string) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('Nemáte oprávnění');

  await db.adminEmail.delete({ where: { id } });
  revalidatePath('/admin');
}
