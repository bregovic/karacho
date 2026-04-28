'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { logAdminAction } from '@/app/actions/admin-extra-actions';
import { r2, BUCKET_NAME, PUBLIC_URL } from '@/lib/r2';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';

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

  const titleRaw = (formData.get('title') as string || '').trim();
  const artistRaw = (formData.get('artist') as string || '').trim();
  
  // AUTOMATICKÉ ČIŠTĚNÍ PŘI IMPORTU
  let title = cleanTitle(titleRaw);
  let artist = artistRaw;

  // Pokud je v názvu pomlčka a interpret je prázdný, zkusíme to rozdělit
  if (title.includes(' - ') && !artist) {
    const parts = title.split(' - ');
    artist = parts[0].trim();
    title = parts.slice(1).join(' - ').trim();
  }
  
  if (!title) return { error: 'Chybí název písně' };

  // OCHRANA PROTI DUPLICITÁM
  const duplicate = await checkDuplicateSong(title, artist);
  if (duplicate) {
    throw new Error(`Tato píseň už v katalogu je: ${duplicate.title} (${duplicate.artist})`);
  }

  const lyricsRaw = formData.get('lyrics') as string || '';
  const cleanedLyrics = cleanLyrics(lyricsRaw);
  
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
      lyrics: cleanedLyrics || null,
      audioUrl: audioUrl || null,
      animationStyle: 'karaoke-classic',
      createdById: session.user.id
    },
  });

  await logAdminAction('CREATE_SONG', `Vytvořena píseň: ${title} (${artist})`, 'Song', song.id);

  revalidatePath('/admin');
  return song;
}

export async function manuallyCleanLyricsAction(songId: string, currentContent: string, customBlacklist: string[] = []) {
  try {
    await ensureAdmin();
    
    // PRVNÍ KROK: Převedeme volné akordy na formát se závorkami [G] (pokud tam už nejsou)
    // Tím zajistíme že i ručně vložený text nad sebe se zprocesuje správně
    const chordsWithBrackets = convertAboveTextChordsToBracketed(currentContent);
    
    // DRUHÝ KROK: Vyčistíme všechno (akordy v závorkách, R:, 1. atd.) a získáme čistý text
    const cleanedLyrics = cleanLyrics(chordsWithBrackets, customBlacklist);

    if (cleanedLyrics) {
      const updateData: any = { 
        lyrics: cleanedLyrics,
        chords: chordsWithBrackets 
      };

      await db.song.update({ 
        where: { id: songId }, 
        data: updateData 
      });
      
      revalidatePath('/admin');
      return { 
        success: true, 
        lyrics: cleanedLyrics, 
        chords: chordsWithBrackets 
      };
    }
    return { error: 'Nepodařilo se vygenerovat čistý text.' };
  } catch (err: any) {
    console.error('CRITICAL CLEAN ERROR:', err);
    return { error: 'Chyba serveru při čištění: ' + (err.message || '500') };
  }
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

  // FILTRACE POLÍ (Prisma nesmí dostat systémová pole nebo pole co neexistují v modelu)
  const allowedFields = [
    'title', 'artist', 'genre', 'tags', 'lyrics', 'chords', 
    'audioUrl', 'instrumentalUrl', 'backgroundUrl', 'jsonUrl', 
    'videoUrl', 'videoSize', 'animationStyle', 'state', 'timingData', 'startTime'
  ];
  
  const filteredData: any = {};
  for (const key of allowedFields) {
    if (data[key] !== undefined) {
      filteredData[key] = data[key];
    }
  }

  if (typeof filteredData.tags === 'string') {
    filteredData.tags = filteredData.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
  }

  await db.song.update({ 
    where: { id: songId }, 
    data: filteredData 
  });

  await logAdminAction('UPDATE_SONG', `Upravena píseň ID: ${songId}`, 'Song', songId);
  revalidatePath('/admin');
  revalidatePath('/renderer');
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

export async function bulkUpdateMetadata(ids: string[], genre?: string, tags?: string[]) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') throw new Error('Nejste přihlášeni');

  const data: any = {};
  if (genre !== undefined) data.genre = genre;
  if (tags !== undefined) data.tags = tags;

  if (Object.keys(data).length > 0) {
    await db.song.updateMany({
      where: { id: { in: ids } },
      data
    });
  }
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

/**
 * Převede klasický formát (akordy nad textem) na formát v závorkách [Chord]
 */
function convertAboveTextChordsToBracketed(text: string): string {
  if (!text) return '';
  const lines = text.split('\n');
  const result = [];
  
  for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i];
    const nextLine = lines[i+1] || "";
    
    // Zjistíme, jestli aktuální řádek vypadá jako čistě akordový (podpora pro A-G i české H)
    const words = currentLine.trim().split(/\s+/);
    const isChordLine = words.length > 0 && words.every(w => 
      /^[A-GH](maj|min|dim|aug|sus|mi|m|#|b|7|9|11|13)*(\/[A-GH][#b]*)?$/i.test(w) || /^[\/|,\(\)\+\-]+$/.test(w)
    );

    if (isChordLine && nextLine.trim() && !nextLine.match(/^[A-GH](maj|min|dim|aug|sus|mi|m|#|b|7|9|11|13)*/)) {
      // Máme akordy a pod nimi text - zkusíme je sloučit
      let combined = "";
      let lastPos = 0;
      
      // Projdeme akordy a jejich pozice na řádku
      const chordRegex = /\S+/g;
      let match;
      while ((match = chordRegex.exec(currentLine)) !== null) {
        const chord = match[0];
        const pos = match.index;
        
        // Přidáme text před akordem
        combined += nextLine.substring(lastPos, pos);
        // Přidáme akord v závorkách
        combined += `[${chord}]`;
        lastPos = pos;
      }
      combined += nextLine.substring(lastPos);
      result.push(combined);
      i++; // Přeskočíme další řádek, protože jsme ho už zpracovali
    } else {
      result.push(currentLine);
    }
  }
  return result.join('\n');
}

function cleanLyrics(text: string, customBlacklist: string[] = []): string {
  if (!text) return '';
  
  // 1. Odstraníme vše v hranatých závorkách (akordy)
  let clean = text.replace(/\[[^\]]*\]/g, ''); 
  
  const lines = clean.split('\n');
  const finalLines = [];

  for (let line of lines) {
    let trimmed = line.trim();
    if (!trimmed) {
      finalLines.push('');
      continue;
    }

    // 2. Odstraníme plevelné značky na začátku řádku (R:, 1., Refrény...)
    trimmed = trimmed.replace(/^(Capo|Intro|Outro|Solo|Sólo|Soloing|Predehra|Předehra|Mezihra|Interlude|R:|Ref:|Refren|Refrén|Bridge|Sloka|Vazba|Chorus|Verse|Instrumental|Zpěv|Skladba|\d+[:.)]|\(\d+x\))/gi, '').trim();

    // 3. Detekce akordových řádků (vylepšeno pro Es, As, maj, min a interpunkci)
    const noSpaces = trimmed.replace(/\s/g, '');
    if (!noSpaces) continue;

    // Rozšířený regex o H a specifické koncovky
    const chordMatches = noSpaces.match(/([A-GH]|maj|min|dim|sus|add|mi|m|#|b|7|9|11|13|Es|As|Des|Ges|Bes|[\/|,\(\)\+\-\[\]])/gi) || [];
    const chordCharsCount = chordMatches.join('').length;
    
    // U akordů jako maj/min/Es/As ignorujeme samohlásky v detekci plevele
    const pureChords = trimmed.split(/[\s,.\-\+|]+/).filter(w => 
       w.match(/^[A-GH](maj|min|dim|sus|add|mi|m|#|b|7|9|11|13)*$/i) || 
       w.match(/^(Es|As|Des|Ges|Bes)$/i)
    );

    const ratio = chordCharsCount / noSpaces.length;
    const isMainlyChords = ratio > 0.6;
    const hasManyShortChordWords = pureChords.length >= 2 && (pureChords.length / trimmed.split(/\s+/).length) > 0.7;

    // Pokud řádek tvoří z většiny akordové znaky nebo je to sled krátkých akordů
    if (isMainlyChords || hasManyShortChordWords) {
       continue;
    }

    // 4. Pokud po čištění nezůstalo skoro nic, ignorujeme
    if (trimmed.length < 2 && !trimmed.match(/[A-Za-z0-9]/)) continue;

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

  // 5. Finalizace: Smazat vícenásobné prázdné řádky
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

    const chordsWithBrackets = convertAboveTextChordsToBracketed(textWithChords.replace(/<[^>]*>?/gm, '').trim());
    const finalLyrics = cleanLyrics(chordsWithBrackets);

    if (finalLyrics.length > 0) {
      const updateData: any = { 
        lyrics: finalLyrics,
        chords: chordsWithBrackets
      };

      await db.song.update({ 
        where: { id: songId }, 
        data: updateData 
      });
      revalidatePath('/admin');
      return { success: true, lyrics: finalLyrics, chords: chordsWithBrackets };
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

    // 3. AKORDY & TEXTY (SUPERMUSIC / PISNICKY-AKORDY)
    // Pokud nám chybí akordy NEBO text, zkusíme lokální zdroje
    if (!(song as any).chords || !song.lyrics || song.lyrics.length < 100) {
       // Zkusíme několik variant URL
       const combinations = [
         `https://supermusic.cz/skupina.php?idpisen=${toSlug(title)}&idinterpret=${toSlug(artist)}`,
         `https://pisnicky-akordy.cz/${toSlug(artist)}/${toSlug(title)}`,
         `https://supermusic.sk/skupina.php?idpisen=${toSlug(title)}&idinterpret=${toSlug(artist)}`,
       ];

       for (const url of combinations) {
          const scrapeRes = await importLyricsFromUrl(songId, url);
          if (scrapeRes.success) {
             if (scrapeRes.lyrics) results.lyrics = scrapeRes.lyrics;
             if (scrapeRes.chords) results.chords = scrapeRes.chords;
             break; // Našli jsme, končíme kolečko
          }
       }
    }

    if (results.lyrics) results.lyrics = cleanLyrics(results.lyrics);

    if (Object.keys(results).length > 0) {
      // Sloučení tagů místo přepsání (pokud chceme být opatrní)
      if (results.tags && song.tags) {
         results.tags = Array.from(new Set([...song.tags, ...results.tags]));
      }

      await db.song.update({ where: { id: songId }, data: results });
      revalidatePath('/admin');
      return { success: true, updated: results };
    }

    return { error: 'Nepodařilo se najít žádná nová metadata ani akordy.' };
  } catch (err) {
    console.error('Research Error:', err);
    return { error: 'Chyba při researchu dat.' };
  }
}

export async function getInternetSuggestionsAction(title: string, artist: string) {
  await ensureAdmin();
  const suggestions: { title?: string; artist?: string; genre?: string; tags?: string[]; origin?: string } = {};

  try {
    // 1. VAGALUME (hledáme hlavně správný case, název a žánr)
    const vRes = await fetch(`https://api.vagalume.com.br/search.php?art=${encodeURIComponent(artist)}&mus=${encodeURIComponent(title)}&apikey=666a658e7948d9d20233d31c36006c9a`);
    if (vRes.ok) {
      const vData = await vRes.json();
      if (vData.mus && vData.mus[0]) {
        suggestions.title = vData.mus[0].name;
        if (vData.art) {
          suggestions.artist = vData.art.name;
          if (vData.art.genre && vData.art.genre[0]) {
            suggestions.genre = vData.art.genre[0].name;
          }
        }
      }
    }

    // 2. LAST.FM (hledáme tagy a odhadujeme původ)
    const lfApiKey = '4d75f2b8f847ff7638d2ef1c13d33f3b';
    const lfRes = await fetch(`https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${lfApiKey}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(title)}&format=json`);
    if (lfRes.ok) {
      const lfData = await lfRes.json();
      if (lfData.track && lfData.track.toptags && lfData.track.toptags.tag) {
        const tags = lfData.track.toptags.tag
          .slice(0, 10)
          .map((t: any) => t.name.toLowerCase());
        
        suggestions.tags = tags;

        // Odhad původu z tagů
        if (tags.some((t: string) => t.includes('czech') || t.includes('cesk'))) suggestions.origin = 'CZ';
        else if (tags.some((t: string) => t.includes('slovak'))) suggestions.origin = 'SK';
        else if (tags.some((t: string) => t.includes('polish'))) suggestions.origin = 'PL';
        else if (tags.some((t: string) => t.includes('german'))) suggestions.origin = 'DE';
      }
    }
  } catch (e) {}

  return suggestions;
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

  const normalizedEmail = email.toLowerCase().trim();
  await db.adminEmail.upsert({
    where: { email: normalizedEmail },
    update: {},
    create: { email: normalizedEmail }
  });
  revalidatePath('/admin');
}

export async function createHelperTrackAction(mainSongId: string) {
  await ensureAdmin();

  const mainSong = await db.song.findUnique({ where: { id: mainSongId } });
  if (!mainSong) return { error: 'Píseň nenalezena.' };

  const helperSong = await db.song.create({
    data: {
      title: `${mainSong.title} [HLAS 2]`,
      artist: mainSong.artist,
      genre: mainSong.genre,
      tags: mainSong.tags,
      lyrics: '', 
      audioUrl: mainSong.audioUrl, 
      instrumentalUrl: mainSong.instrumentalUrl,
      animationStyle: mainSong.animationStyle,
      createdById: mainSong.createdById,
      state: 'UNPUBLISHED' as any
    }
  });

  revalidatePath('/admin');
  return { success: true, helperId: helperSong.id };
}

export async function removeAdminEmail(id: string) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('Nemáte oprávnění');

  await db.adminEmail.delete({ where: { id } });
  revalidatePath('/admin');
}

export async function mergeDuetAction(mainSongId: string, sourceSongId: string) {
  await ensureAdmin();

  const mainSong = await db.song.findUnique({ where: { id: mainSongId } });
  const sourceSong = await db.song.findUnique({ where: { id: sourceSongId } });

  if (!mainSong || !sourceSong) return { error: 'Píseň nenalezena.' };
  if (!mainSong.timingData || !sourceSong.timingData) return { error: 'Obě písně musí být načasované (mít JSON).' };

  const mainData = mainSong.timingData as any;
  const sourceData = sourceSong.timingData as any;

  if (!mainData.blocks) mainData.blocks = [];
  if (!sourceData.blocks) sourceData.blocks = [];

  const sourceBlocks = sourceData.blocks.map((b: any) => {
    const newLi = b.li + 1000;
    return {
      ...b,
      li: newLi,
      v: 2,
      w: (b.w || []).map((word: any) => ({ ...word, v: 2 }))
    };
  });

  mainData.blocks = [...mainData.blocks, ...sourceBlocks];
  mainData.blocks.sort((a: any, b: any) => a.bs - b.bs);

  const mainLyrics = mainSong.lyrics || '';
  const sourceLyrics = sourceSong.lyrics || '';
  const newLyrics = mainLyrics + '\n\n-- DRUHÝ HLAS --\n' + sourceLyrics;

  await db.song.update({
    where: { id: mainSongId },
    data: { timingData: mainData, lyrics: newLyrics }
  });

  revalidatePath('/admin');
  revalidatePath('/designer');
  revalidatePath('/renderer');

  return { success: true };
}

export async function getAdminStats() {
  await ensureAdmin();

  // 1. STATISTIKY Z DATABÁZE (stavy)
  const stateCounts = await db.song.groupBy({
    by: ['state'],
    _count: { _all: true }
  });

  // 2. STATISTIKY Z CLOUDU (obsazené místo)
  let totalSizeBytes = 0;
  let objectsCount = 0;
  
  try {
    let isTruncated = true;
    let continuationToken: any = undefined;
    let listCommand: any;

    while (isTruncated) {
      listCommand = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        ContinuationToken: continuationToken
      });
      const response: any = await r2.send(listCommand);
      
      if (response.Contents) {
        for (const obj of response.Contents) {
          totalSizeBytes += obj.Size || 0;
          objectsCount++;
        }
      }
      isTruncated = response.IsTruncated || false;
      continuationToken = response.NextContinuationToken;
    }
  } catch (err) {
    console.error('Failed to list R2 objects:', err);
  }

  return {
    states: stateCounts.map(s => ({ state: s.state, count: s._count._all })),
    storage: {
      bytes: totalSizeBytes,
      human: (totalSizeBytes / (1024 * 1024)).toFixed(2) + ' MB',
      files: objectsCount
    }
  };
}

export async function manageGenreAction(oldName: string, newName: string | null) {
  await ensureAdmin();
  if (!oldName) return;

  if (newName === null) {
    await db.song.updateMany({
      where: { genre: oldName },
      data: { genre: null }
    });
  } else {
    await db.song.updateMany({
      where: { genre: oldName },
      data: { genre: newName.trim() }
    });
  }
  revalidatePath('/admin');
  return { success: true };
}

export async function manageTagAction(oldName: string, newName: string | null) {
  await ensureAdmin();
  if (!oldName) return;

  if (newName === null) {
    // Smazat tag ze všech polí
    await db.$executeRaw`UPDATE "Song" SET tags = array_remove(tags, ${oldName})`;
  } else {
    // Přejmenovat tag ve všech polích a sjednotit
    await db.$executeRaw`UPDATE "Song" SET tags = array_replace(tags, ${oldName}, ${newName.trim()})`;
  }
  revalidatePath('/admin');
  return { success: true };
}

export async function getTaxonomyAction() {
  await ensureAdmin();
  const rawGenres = await db.song.findMany({ select: { genre: true }, distinct: ['genre'] });
  const rawTags = await db.song.findMany({ select: { tags: true } });
  
  const genres = rawGenres.map(r => r.genre).filter((g): g is string => !!g).sort();
  const tagsSet = new Set<string>();
  rawTags.forEach(r => {
    if (r.tags) r.tags.forEach(t => tagsSet.add(t));
  });
  const tags = Array.from(tagsSet).sort();

  return { genres, tags };
}

// ═══════════════════════════════════════════════════
// DATA QUALITY AUDIT
// ═══════════════════════════════════════════════════

interface AuditIssue {
  songId: string;
  title: string;
  artist: string;
  issueType: string;
  description: string;
  suggestedTitle?: string;
  suggestedArtist?: string;
  autoFixable: boolean;
}

const YOUTUBE_JUNK = /\s*[\(\[]\s*[^\]\)]*(Official\s*(Music\s*)?Video|Lyrics?\s*Video|Lyric\s*Video|Audio|HD|4K|HQ|Remastered|Remaster|Live|feat\.\s*|ft\.\s*|Official\s*Audio|Music\s*Video|Video\s*Cl[ií]p|Karaoke|Instrumental|Creative\s*Commission|With\s*Lyrics?|Full\s*Album|Full\s*HD|Visuali[sz]er|VHS|RETRO|píseň\s*pro|pieseň\s*pre|soundtrack)[^\]\)]*\s*[\)\]]/gi;
const YOUTUBE_SUFFIX = /\s*([-–—|]\s*)?(Official\s*(Music\s*)?Video|Lyrics?\s*Video|Lyric\s*Video|Audio|HD|4K|HQ|Remastered|Live|Official\s*Audio|Music\s*Video|Karaoke|Instrumental|With\s*Lyrics?|\.wmv|\.mp4|\.avi|\.mpg|\.mpeg)$/gi;

function cleanTitle(title: string): string {
  let t = title;
  t = t.replace(YOUTUBE_JUNK, '');
  t = t.replace(YOUTUBE_SUFFIX, '');
  // Speciální případ pro nalepené "KARAOKE" na konci bez mezery
  t = t.replace(/KARAOKE$/gi, '');
  // Odstranění zbytků teček na konci (často po příponách)
  t = t.replace(/\.$/, '');
  t = t.replace(/\s{2,}/g, ' ').trim();
  return t;
}

function toTitleCase(str: string): string {
  const smallWords = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'by', 'in', 'of', 'up', 'je', 'se', 'si', 'na', 'do', 'za', 've', 'ke', 'po', 'ze', 'od', 'pro', 'při', 'nad', 'pod', 'o', 'v', 'k', 'z', 's', 'i', 'a']);
  return str.split(' ').map((w, i) => {
    if (i > 0 && smallWords.has(w.toLowerCase())) return w.toLowerCase();
    if (w.length <= 2) return w;
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ');
}

export async function auditSongsAction() {
  await ensureAdmin();
  const songs = await db.song.findMany({
    select: { id: true, title: true, artist: true, lyrics: true, state: true },
  });

  const issues: AuditIssue[] = [];

  for (const s of songs) {
    const title = s.title || '';
    const artist = s.artist || '';

    // 1. YouTube junk in title
    const cleanedTitle = cleanTitle(title);
    if (cleanedTitle !== title) {
      issues.push({
        songId: s.id, title, artist,
        issueType: 'YOUTUBE_JUNK',
        description: `Název obsahuje YouTube popisky`,
        suggestedTitle: cleanedTitle,
        autoFixable: true,
      });
    }

    // 2. ALL CAPS title
    if (title === title.toUpperCase() && title.length > 3) {
      issues.push({
        songId: s.id, title, artist,
        issueType: 'ALL_CAPS_TITLE',
        description: `Název je celý velkými písmeny`,
        suggestedTitle: toTitleCase(title),
        autoFixable: true,
      });
    }

    // 3. ALL CAPS artist
    if (artist && artist === artist.toUpperCase() && artist.length > 3) {
      issues.push({
        songId: s.id, title, artist,
        issueType: 'ALL_CAPS_ARTIST',
        description: `Interpret je celý velkými písmeny`,
        suggestedArtist: toTitleCase(artist),
        autoFixable: true,
      });
    }

    // 4. Double spaces in title
    if (/\s{2,}/.test(title)) {
      issues.push({
        songId: s.id, title, artist,
        issueType: 'DOUBLE_SPACE_TITLE',
        description: `Název obsahuje dvojité mezery`,
        suggestedTitle: title.replace(/\s{2,}/g, ' ').trim(),
        autoFixable: true,
      });
    }

    // 5. Missing artist
    if (!artist || artist === 'Neznámý interpret') {
      issues.push({
        songId: s.id, title, artist: artist || '(prázdný)',
        issueType: 'MISSING_ARTIST',
        description: `Chybí interpret`,
        autoFixable: false,
      });
    }

    // 6. Artist/title might be swapped (title is very short, artist is long)
    if (artist && title.length < artist.length * 0.4 && title.split(' ').length <= 2) {
      issues.push({
        songId: s.id, title, artist,
        issueType: 'POSSIBLE_SWAP',
        description: `Název je kratší než interpret – možná prohozeno?`,
        suggestedTitle: artist,
        suggestedArtist: title,
        autoFixable: true,
      });
    }

    // 7. Title contains " - " (artist - title pattern)
    if (title.includes(' - ') && !artist) {
      const parts = title.split(' - ');
      issues.push({
        songId: s.id, title, artist: artist || '(prázdný)',
        issueType: 'ARTIST_IN_TITLE',
        description: `Název obsahuje " - " – pravděpodobně "Interpret - Název"`,
        suggestedArtist: parts[0].trim(),
        suggestedTitle: parts.slice(1).join(' - ').trim(),
        autoFixable: true,
      });
    }

    // 8. Lyrics too long lines (any line > 60 chars)
    if (s.lyrics) {
      const longLines = s.lyrics.split('\n').filter(l => l.trim().length > 60);
      if (longLines.length > 3) {
        issues.push({
          songId: s.id, title, artist,
          issueType: 'LONG_LYRICS_LINES',
          description: `Text obsahuje ${longLines.length} řádků delších než 60 znaků`,
          autoFixable: false,
        });
      }
    }

    // 9. Missing lyrics entirely
    if (!s.lyrics || s.lyrics.trim().length < 10) {
      issues.push({
        songId: s.id, title, artist,
        issueType: 'MISSING_LYRICS',
        description: `Chybí text písně`,
        autoFixable: false,
      });
    }
  }

  // 10. Duplicate detection (same title+artist OR same CLEANED title+artist)
  const titleArtistMap = new Map<string, typeof songs>();
  const potentialDuplicateMap = new Map<string, string[]>(); // key -> songIds

  for (const s of songs) {
    const rawKey = `${(s.title || '').toLowerCase().trim()}|||${(s.artist || '').toLowerCase().trim()}`;
    if (!titleArtistMap.has(rawKey)) titleArtistMap.set(rawKey, []);
    titleArtistMap.get(rawKey)!.push(s);

    const cleanKey = `${cleanTitle(s.title || '').toLowerCase().trim()}|||${(s.artist || '').toLowerCase().trim()}`;
    if (!potentialDuplicateMap.has(cleanKey)) potentialDuplicateMap.set(cleanKey, []);
    potentialDuplicateMap.get(cleanKey)!.push(s.id);
  }

  // Real duplicates (exact same string)
  for (const [, group] of titleArtistMap) {
    if (group.length > 1) {
      for (const s of group) {
        issues.push({
          songId: s.id, title: s.title, artist: s.artist || '',
          issueType: 'DUPLICATE',
          description: `Identická duplicita (${group.length}x)`,
          autoFixable: false,
        });
      }
    }
  }

  // Potential collisions (would be same after cleaning)
  for (const [cleanKey, ids] of potentialDuplicateMap) {
    if (ids.length > 1) {
      // Check if they aren't already flagged as real duplicates
      const uniqueRawTitles = new Set(songs.filter(s => ids.includes(s.id)).map(s => `${s.title}|||${s.artist}`));
      if (uniqueRawTitles.size > 1) {
        for (const id of ids) {
          const s = songs.find(x => x.id === id)!;
          issues.push({
            songId: s.id, title: s.title, artist: s.artist || '',
            issueType: 'DUPLICATE',
            description: `Potenciální kolize po vyčištění názvu`,
            autoFixable: false,
          });
        }
      }
    }
  }

  return issues;
}

async function findMatchingInstrumental(title: string, artist?: string) {
  try {
    const list = await r2.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: 'instrumentals/', // Předpokládáme složku instrumentals/
    }));

    if (!list.Contents) return null;

    const searchTerm = `${artist || ''} ${title}`.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Hledáme nejlepší shodu v názvu souboru
    const match = list.Contents.find(obj => {
      if (!obj.Key) return false;
      const key = obj.Key.toLowerCase().replace(/[^a-z0-9]/g, '');
      return key.includes(searchTerm) || (artist && key.includes(artist.toLowerCase().replace(/[^a-z0-9]/g, '')) && key.includes(title.toLowerCase().replace(/[^a-z0-9]/g, '')));
    });

    if (match && match.Key) {
      return `${PUBLIC_URL}/${match.Key}`;
    }
  } catch (e) {
    console.error('Error finding matching instrumental:', e);
  }
  return null;
}

export async function batchFixSongsAction(fixes: { 
  songId: string; 
  title?: string; 
  artist?: string;
  genre?: string;
  tags?: string[];
  origin?: string;
}[]) {
  await ensureAdmin();
  
  // Merge fixes per songId (a song might have multiple issues)
  const merged = new Map<string, { title?: string; artist?: string; genre?: string; tags?: string[]; origin?: string }>();
  for (const fix of fixes) {
    const existing = merged.get(fix.songId) || {};
    if (fix.title !== undefined) existing.title = fix.title;
    if (fix.artist !== undefined) existing.artist = fix.artist;
    if (fix.genre !== undefined) existing.genre = fix.genre;
    if (fix.tags !== undefined) existing.tags = fix.tags;
    if (fix.origin !== undefined) existing.origin = fix.origin;
    merged.set(fix.songId, existing);
  }

  let fixed = 0;
  const errors: string[] = [];
  for (const [songId, data] of merged) {
    if (Object.keys(data).length === 0) continue;
    try {
      // Před updatem zkontrolujeme, jestli píseň už nemá instrumentálku
      const current = await db.song.findUnique({ where: { id: songId }, select: { instrumentalUrl: true, title: true, artist: true } });
      
      // Pokud se mění název/interpret a chybí instrumentálka, zkusíme ji najít
      if (current && !current.instrumentalUrl && (data.title || data.artist)) {
        const matchedUrl = await findMatchingInstrumental(data.title || current.title, data.artist || current.artist || '');
        if (matchedUrl) {
          (data as any).instrumentalUrl = matchedUrl;
        }
      }

      await db.song.update({ where: { id: songId }, data });
      fixed++;
    } catch (e: any) {
      errors.push(`${songId}: ${e.message}`);
    }
  }
  
  try {
    await logAdminAction('BATCH_FIX', `Hromadná oprava ${fixed} písní${errors.length ? `, ${errors.length} chyb` : ''}`, 'Song');
  } catch (_) {}
  
  revalidatePath('/admin');
  revalidatePath('/');
  return { fixed, errors };
}
