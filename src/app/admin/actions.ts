'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { logAdminAction } from '@/app/actions/admin-extra-actions';

async function ensureAdmin() {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    throw new Error('Nemáte oprávnění k této akci.');
  }
  return session;
}

export async function checkDuplicateSong(title: string, artist: string) {
  if (!title) return null;
  const existing = await db.song.findFirst({
    where: {
      title: { equals: title.trim(), mode: 'insensitive' },
      artist: artist ? { equals: artist.trim(), mode: 'insensitive' } : null
    },
    select: { id: true, title: true, artist: true, state: true }
  });
  return existing;
}

export async function createSong(formData: FormData) {
  const session = await ensureAdmin();

  const title = (formData.get('title') as string || '').trim();
  const artist = (formData.get('artist') as string || '').trim();
  
  if (!title) return { error: 'Chybí název písně' };

  // OCHRANA PROTI DUPLICITÁM
  const duplicate = await checkDuplicateSong(title, artist);
  if (duplicate) {
    throw new Error(`Tato píseň už v katalogu je: ${duplicate.title} (${duplicate.artist})`);
  }

  const lyrics = formData.get('lyrics') as string;
  const genre = formData.get('genre') as string;
  const audioUrl = formData.get('audioUrl') as string;
  const tagsString = formData.get('tags') as string;
  
  const tags = tagsString ? tagsString.split(',').map(t => t.trim()).filter(Boolean) : [];

  const song = await db.song.create({
    data: {
      title,
      artist: artist || null,
      genre: genre || null,
      tags,
      lyrics: lyrics || null,
      audioUrl: audioUrl || null,
      animationStyle: 'karaoke-classic',
      createdById: session.user.id
    },
  });

  await logAdminAction('CREATE_SONG', `Vytvořena píseň: ${title} (${artist})`, 'Song', song.id);

  revalidatePath('/admin');
  return song;
}

export async function manuallyCleanLyricsAction(songId: string, currentLyrics: string, customBlacklist: string[] = []) {
  await ensureAdmin();
  const cleaned = cleanLyrics(currentLyrics, customBlacklist);
  if (cleaned) {
    await db.song.update({ where: { id: songId }, data: { lyrics: cleaned } });
    revalidatePath('/admin');
    return { success: true, lyrics: cleaned };
  }
  return { error: 'Nepodařilo se vyčistit text' };
}

export async function updateSongAudio(songId: string, audioUrl: string, audioHash?: string) {
  await ensureAdmin();
  await db.song.update({ 
    where: { id: songId }, 
    data: { audioUrl, audioHash: audioHash || undefined } 
  });
  revalidatePath('/admin');
}

export async function updateSongInstrumental(songId: string, instrumentalUrl: string) {
  await ensureAdmin();
  await db.song.update({ where: { id: songId }, data: { instrumentalUrl } });
  revalidatePath('/admin');
}

export async function updateSongJson(songId: string, jsonUrl: string) {
  await ensureAdmin();
  await db.song.update({ where: { id: songId }, data: { jsonUrl } });
  revalidatePath('/admin');
  revalidatePath('/designer');
}

export async function updateSongVideo(songId: string, videoUrl: string, videoSize?: number) {
  await ensureAdmin();
  await db.song.update({ 
    where: { id: songId }, 
    data: { videoUrl, videoSize: videoSize || undefined } 
  });
  revalidatePath('/admin');
  revalidatePath('/renderer');
}

export async function removeSongResource(songId: string, type: 'audio' | 'instrumental' | 'background' | 'json' | 'video') {
  await ensureAdmin();
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

export async function requestSong(title: string, artist: string, email?: string) {
  if (!title || !artist) return { error: 'Název a interpret jsou povinné' };
  
  // OCHRANA PROTI DUPLICITÁM (I pro žádosti)
  const duplicate = await checkDuplicateSong(title, artist);
  if (duplicate) {
    return { 
      error: `Tato píseň už v našem katalogu je! Můžete ji jít rovnou zazpívat.`,
      duplicateSong: duplicate 
    };
  }

  try {
    const song = await db.song.create({
      data: {
        title: title.trim(),
        artist: artist.trim(),
        state: 'REQUESTED' as any,
        requestedByEmail: email || null
      },
    });
    revalidatePath('/admin');
    return { success: true, song };
  } catch (err: any) {
    console.error('Request song fail detailed:', err);
    return { error: 'Chyba při ukládání žádosti: ' + (err?.message || 'Neznámý problém') };
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

  if (typeof data.tags === 'string') {
    data.tags = data.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
  }

  await db.song.update({ 
    where: { id: songId }, 
    data 
  });

  await logAdminAction('UPDATE_SONG', `Upravena píseň ID: ${songId}`, 'Song', songId);
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

function toSlug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/ /g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/-+/g, '-');
}

export async function fetchLyricsAction(songId: string) {
  const song = await db.song.findUnique({ where: { id: songId } });
  if (!song || !song.artist || !song.title) return { error: 'Chybí interpret nebo název' };

  const artist = song.artist;
  const title = song.title;

  try {
    const res2 = await fetch(`https://api.vagalume.com.br/search.php?art=${encodeURIComponent(artist)}&mus=${encodeURIComponent(title)}&apikey=666a658e7948d9d20233d31c36006c9a`);
    if (res2.ok) {
      const data = await res2.json();
      if (data.mus && data.mus[0] && data.mus[0].text) {
        const rawLyrics = data.mus[0].text.trim();
        const lyrics = cleanLyrics(rawLyrics);
        await db.song.update({ where: { id: songId }, data: { 
          lyrics,
          chords: rawLyrics !== lyrics ? rawLyrics : null
        } });
        revalidatePath('/admin');
        return { success: true, lyrics, source: 'Vagalume' };
      }
    }

    const res3 = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
    if (res3.ok) {
      const data = await res3.json();
      if (data.lyrics) {
        const rawLyrics = data.lyrics.trim();
        const lyrics = cleanLyrics(rawLyrics);
        await db.song.update({ where: { id: songId }, data: { 
          lyrics,
          chords: rawLyrics !== lyrics ? rawLyrics : null
        } });
        revalidatePath('/admin');
        return { success: true, lyrics, source: 'Lyrics.ovh' };
      }
    }

    return { error: 'Text nenalezen' };
  } catch (err) {
    return { error: 'Chyba API' };
  }
}

function cleanLyrics(text: string, customBlacklist: string[] = []): string {
  if (!text) return '';
  let clean = text.replace(/\[[^\]]*\]/g, ''); 
  const lines = clean.split('\n');
  const finalLines = [];

  for (let line of lines) {
    let trimmed = line.trim();
    if (!trimmed) {
      finalLines.push('');
      continue;
    }
    trimmed = trimmed.replace(/\(\d+x\)/gi, '').replace(/x\d+/gi, '').trim();
    if (!trimmed) continue;

    const noSpaces = trimmed.replace(/\s/g, '');
    if (!noSpaces) continue;

    const chordMatches = noSpaces.match(/([A-G]|maj|min|dim|sus|add|m|#|b|7|9|11|13|[\/|,\(\)\+\-])/gi) || [];
    const chordCharsCount = chordMatches.join('').length;
    const vowelCount = (noSpaces.match(/[eiouyáéíóúů]/gi) || []).length;
    const ratio = chordCharsCount / noSpaces.length;
    const vowelRatio = vowelCount / noSpaces.length;

    if ((ratio > 0.75 && vowelRatio < 0.15) || (noSpaces.length <= 4 && ratio > 0.8)) {
       continue;
    }

    const words = trimmed.split(/\s+/);
    if (words.length >= 1) {
       const isAllChords = words.every(w => /^[A-G](maj|min|dim|aug|sus|mi|m|#|b|7|9|11|13)*$/i.test(w) || /^[\/|,\(\)\+\-]+$/.test(w));
       if (isAllChords) continue;
    }

    if (/^(Capo|Intro|Outro|Solo|Sólo|Soloing|Predehra|Předehra|Mezihra|Interlude|R:|Ref:|Refren|Refrén|Bridge|Sloka|Vazba|Chorus|Verse|Instrumental|Zpěv|Skladba|\d+\.)/i.test(trimmed)) {
       if (trimmed.length < 25) continue;
    }

    if (customBlacklist.length > 0) {
      customBlacklist.forEach(word => {
        if (!word) return;
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        trimmed = trimmed.replace(regex, '').trim();
      });
      if (!trimmed) continue;
    }
    
    finalLines.push(trimmed);
  }

  return finalLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export async function importLyricsFromUrl(songId: string, url: string) {
  try {
    const isKA = url.includes('pisnicky-akordy.cz');
    const isKT = url.includes('karaoketexty.cz');
    const isSM = url.includes('supermusic.cz') || url.includes('supermusic.sk');

    if (!isKA && !isKT && !isSM) return { error: 'Nepodporovaný web.' };

    let targetUrl = url;
    
    // EXPORT REŽIM PRO SUPERMUSIC (Závorky v textu)
    if (isSM) {
      const idMatch = url.match(/idpiesne=(\d+)/);
      if (idMatch) {
         targetUrl = `https://www.supermusic.cz/export.php?idpiesne=${idMatch[1]}&typ=TXT&modulacia=0`;
      }
    }

    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
      }
    });
    
    if (!res.ok) return { error: 'Stránka je nedostupná.' };
    
    const content = await res.text();
    let textWithChords = '';

    if (isSM && targetUrl.includes('export.php')) {
      // Export.php vrací čistý text, kde jsou akordy už v hranatých závorkách
      textWithChords = content.trim();
    } else if (isKA) {
      const match = content.match(/<pre[^>]*>([\s\S]*?)<\/pre>/);
      if (match) textWithChords = match[1];
    } else if (isSM) {
      const match = content.match(/<div id="songtext"[^>]*>([\s\S]*?)<\/div>/) || 
                    content.match(/<div class="song-text"[^>]*>([\s\S]*?)<\/div>/) ||
                    content.match(/<div class="text"[^>]*>([\s\S]*?)<\/div>/) ||
                    content.match(/<span id="piesen_text"[^>]*>([\s\S]*?)<\/span>/);
      if (match) {
        textWithChords = match[1]
          .replace(/<span[^>]*class="[^"]*(akord|chord|piesen_akord)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, ' [$2] ')
          .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, (m, c) => {
             if (c.trim().length <= 8) return ` [${c.trim()}] `;
             return c;
          })
          .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, (m, c) => {
             if (c.trim().length <= 8) return ` [${c.trim()}] `;
             return c;
          })
          .replace(/<br\s*\/?>/gi, '\n');
      }
    } else {
      const match = content.match(/<p class="text">([\s\S]*?)<\/p>/) || content.match(/<div id="text">([\s\S]*?)<\/div>/);
      if (match) textWithChords = match[1].replace(/<br\s*\/?>/gi, '\n');
    }
    
    if (!textWithChords) return { error: 'Text nenalezen.' };

    const finalWithChords = textWithChords.replace(/<[^>]*>?/gm, '').trim();
    const finalLyrics = cleanLyrics(finalWithChords);

    if (finalLyrics.length > 0) {
      await db.song.update({ 
        where: { id: songId }, 
        data: { 
          lyrics: finalLyrics,
          chords: finalWithChords !== finalLyrics ? finalWithChords : null
        } 
      });
      revalidatePath('/admin');
      return { success: true, lyrics: finalLyrics, chords: finalWithChords };
    }
    
    return { error: 'Výsledný text je prázdný.' };
  } catch (err) {
    return { error: 'Chyba stahování.' };
  }
}

export async function bulkFetchMissingLyrics() {
  await ensureAdmin();
  const songsWithoutLyrics = await db.song.findMany({
    where: { 
      OR: [{ lyrics: null }, { lyrics: '' }],
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
    // 1. VAGALUME RESEARCH
    const vRes = await fetch(`https://api.vagalume.com.br/search.php?art=${encodeURIComponent(artist)}&mus=${encodeURIComponent(title)}&apikey=666a658e7948d9d20233d31c36006c9a`);
    if (vRes.ok) {
      const vData = await vRes.json();
      if (vData.mus && vData.mus[0]) {
        const track = vData.mus[0];
        if (track.text && (!song.lyrics || song.lyrics.length < 50)) {
           if (!track.text.includes('?')) {
              results.lyrics = track.text.trim();
           }
        }
        if (vData.art && vData.art.genre && vData.art.genre[0]) {
           results.genre = vData.art.genre[0].name;
        }
      }
    }

    // 2. LAST.FM RESEARCH
    const lfApiKey = '4d75f2b8f847ff7638d2ef1c13d33f3b';
    const lfRes = await fetch(`https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${lfApiKey}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(title)}&format=json`);
    if (lfRes.ok) {
      const lfData = await lfRes.json();
      if (lfData.track) {
        if (lfData.track.toptags && lfData.track.toptags.tag) {
          const tags = lfData.track.toptags.tag
            .slice(0, 5)
            .map((t: any) => t.name.toLowerCase())
            .filter((t: string) => !['seen live', 'favorites'].includes(t));
          results.tags = Array.from(new Set([...(song.tags || []), ...tags]));
        }
      }
    }

    // 3. SUPERMUSIC & PISNICKY-AKORDY RESEARCH
    const currentLyrics = results.lyrics || song.lyrics || '';
    const needsBetterLyrics = !currentLyrics || currentLyrics.length < 100 || currentLyrics.includes('[') || (currentLyrics.match(/,/g) || []).length > 2;

    if (needsBetterLyrics) {
       const smUrl = `https://supermusic.cz/skupina.php?action=song&idinterpret=${toSlug(artist)}&idpisen=${toSlug(title)}`;
       const smRes = await importLyricsFromUrl(songId, smUrl);
       if (smRes.success) {
          results.lyrics = smRes.lyrics;
       } else {
          const paUrl = `https://pisnicky-akordy.cz/${toSlug(artist)}/${toSlug(title)}`;
          const paRes = await importLyricsFromUrl(songId, paUrl);
          if (paRes.success) results.lyrics = paRes.lyrics;
       }
    }

    if (results.lyrics) results.lyrics = cleanLyrics(results.lyrics);

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
  await logAdminAction('DELETE_SONG', `Smazána píseň ID: ${songId}`, 'Song', songId);
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
