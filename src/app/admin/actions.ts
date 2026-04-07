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

export async function manuallyCleanLyricsAction(songId: string, currentLyrics: string, customBlacklist: string[] = []) {
  const cleaned = cleanLyrics(currentLyrics, customBlacklist);
  if (cleaned) {
    await db.song.update({ where: { id: songId }, data: { lyrics: cleaned } });
    revalidatePath('/admin');
    return { success: true, lyrics: cleaned };
  }
  return { error: 'Nepodařilo se vyčistit text' };
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

export async function requestSong(title: string, artist: string) {
  if (!title || !artist) return { error: 'Název a interpret jsou povinné' };
  
  try {
    const song = await db.song.create({
      data: {
        title: title.trim(),
        artist: artist.trim(),
        state: 'REQUESTED' as any,
      },
    });
    revalidatePath('/admin');
    return { success: true, song };
  } catch (err) {
    console.error('Request song fail:', err);
    return { error: 'Nepodařilo se odeslat žádost' };
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

function toSlug(text: string): string {
  return text
    .normalize('NFD') // Rozloží znaky na základ + diakritické znaménko
    .replace(/[\u0300-\u036f]/g, '') // Odstraní znaménka
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
    // 1. GENIUS (Hledání přes veřejné API / frontend)
    const gSearchUrl = `https://api.genius.com/search?q=${encodeURIComponent(artist + ' ' + title)}&access_token=q_l6qC... (zástupný, v reálu použít env)`;
    // Fallback: zkusíme to slugem na pisnicky-akordy hned, pokud mezinárodní věci selžou

    // 2. STAV: Vagalume (Obrovská CZ/SK databáze, spolehlivá diakritika)
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

    // 3. STAV: Lyrics.ovh (Fallback)
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

    return { error: 'Text nenalezen na žádném zdroji' };
  } catch (err) {
    console.error('Lyrics Fetch Error:', err);
    return { error: 'Chyba API' };
  }
}

function cleanLyrics(text: string, customBlacklist: string[] = []): string {
  if (!text) return '';

  // 1. Předčištění: smazání všeho v hranatých závorkách (nejčastější formát akordů)
  let clean = text.replace(/\[[^\]]*\]/g, ''); 
  
  const lines = clean.split('\n');
  const finalLines = [];

  for (let line of lines) {
    let trimmed = line.trim();
    if (!trimmed) {
      finalLines.push('');
      continue;
    }
    
    // Smazání (4x), (x2) apod.
    trimmed = trimmed.replace(/\(\d+x\)/gi, '').replace(/x\d+/gi, '').trim();
    if (!trimmed) continue;

    // --- THE DEFINITIVE CHORD OBLITERATOR V3 ---
    // 1. Očistíme řádek o mezery pro výpočet husoty
    const noSpaces = trimmed.replace(/\s/g, '');
    if (!noSpaces) continue;

    // 2. Regex pro "akordové" znaky a symboly (velká písmena A-G, malé m, dim, sus, maj, čísla, křížky, béčka, lomenítka)
    // Přidáváme i typické kytarové značky
    const chordMatches = noSpaces.match(/([A-G]|maj|min|dim|sus|add|m|#|b|7|9|11|13|[\/|,\(\)\+\-])/gi) || [];
    const chordCharsCount = chordMatches.join('').length;
    
    // 3. Spočítáme samohlásky (indikátor běžného textu)
    const vowelCount = (noSpaces.match(/[eiouyáéíóúů]/gi) || []).length;
    const ratio = chordCharsCount / noSpaces.length;
    const vowelRatio = vowelCount / noSpaces.length;

    // Pokud řádek tvoří z více než 75% akordové symboly a má minimum samohlásek -> PRYČ s ním
    // Extrémně krátké řádky (1-3 znaky) co jsou jen akordy bereme taky
    if ((ratio > 0.75 && vowelRatio < 0.15) || (noSpaces.length <= 4 && ratio > 0.8)) {
       continue;
    }

    // EXTRA: Kontrola zda se nejedná o výčet slov typu "Ami Dmi G"
    const words = trimmed.split(/\s+/);
    if (words.length >= 1) {
       // regex s podporou pro Ami, Emi, Dmi
       const isAllChords = words.every(w => /^[A-G](maj|min|dim|aug|sus|mi|m|#|b|7|9|11|13)*$/i.test(w) || /^[\/|,\(\)\+\-]+$/.test(w));
       if (isAllChords) continue;
    }

    // Odstranění technických značek na začátku řádku (CZ i EN termíny)
    if (/^(Capo|Intro|Outro|Solo|Sólo|Soloing|Predehra|Předehra|Mezihra|Interlude|R:|Ref:|Refren|Refrén|Bridge|Sloka|Vazba|Chorus|Verse|Instrumental|Zpěv|Skladba|\d+\.)/i.test(trimmed)) {
       // Pokud je to jen technický nadpis řádku (krátký), tak pryč. 
       if (trimmed.length < 25) continue;
    }

    // Odstranění vlastních slov z blacklistu (pokud jsou definována)
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

  return finalLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function importLyricsFromUrl(songId: string, url: string) {
  try {
    const isKA = url.includes('pisnicky-akordy.cz');
    const isKT = url.includes('karaoketexty.cz');
    const isSM = url.includes('supermusic.cz') || url.includes('supermusic.sk');

    if (!isKA && !isKT && !isSM) return { error: 'Nepodporovaný web.' };

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
      }
    });
    
    if (!res.ok) return { error: 'Stránka je nedostupná.' };
    
    const html = await res.text();
    let lyrics = '';

    if (isKA) {
      // Pisnicky-akordy.cz má text v <pre>
      const match = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/);
      if (match) {
        lyrics = match[1]; // Necháme i s tagy pro chords, pak vyčistíme pro lyrics
      }
    } else if (isSM) {
      // SuperMusic.cz / sk 
      const match = html.match(/<div id="songtext"[^>]*>([\s\S]*?)<\/div>/) || html.match(/<div class="song-text"[^>]*>([\s\S]*?)<\/div>/);
      if (match) {
        lyrics = match[1].replace(/<br\s*\/?>/gi, '\n');
      }
    } else {
      // Karaoketexty.cz
      const match = html.match(/<p class="text">([\s\S]*?)<\/p>/) || html.match(/<div id="text">([\s\S]*?)<\/div>/);
      if (match) {
        lyrics = match[1].replace(/<br\s*\/?>/gi, '\n');
      }
    }
    
    if (!lyrics) return { error: 'Text nenalezen.' };

    // Uložíme čistou verzi (bez HTML tagů) jako verzi s akordy (pokud tam byly)
    const textWithChords = lyrics.replace(/<[^>]*>?/gm, '').trim();
    
    // Vyčištění akordů a balastu pro Karaoke
    const finalLyrics = cleanLyrics(textWithChords);

    if (finalLyrics.length > 0) {
      await db.song.update({ 
        where: { id: songId }, 
        data: { 
          lyrics: finalLyrics,
          chords: textWithChords !== finalLyrics ? textWithChords : null
        } 
      });
      revalidatePath('/admin');
      return { success: true, lyrics: finalLyrics, chords: textWithChords };
    }
    
    return { error: 'Výsledný text je prázdný.' };
  } catch (err) {
    return { error: 'Chyba stahování.' };
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

    // 3. SUPERMUSIC & PISNICKY-AKORDY RESEARCH (Perfect for CZ songs)
    const currentLyrics = results.lyrics || song.lyrics || '';
    const needsBetterLyrics = !currentLyrics || currentLyrics.length < 100 || currentLyrics.includes('[') || (currentLyrics.match(/,/g) || []).length > 2;

    if (needsBetterLyrics) {
       // A. Zkusíme nejdřív SuperMusic (často lepší formátování)
       const smUrl = `https://supermusic.cz/skupina.php?action=song&idinterpret=${toSlug(artist)}&idpisen=${toSlug(title)}`;
       const smRes = await importLyricsFromUrl(songId, smUrl);
       
       if (smRes.success) {
          results.lyrics = smRes.lyrics;
          if (smRes.chords) results.chords = smRes.chords;
       } else {
          // B. Pokud SuperMusic selže, zkusíme Pisnicky-Akordy (jako dřív)
          const paUrl = `https://pisnicky-akordy.cz/${toSlug(artist)}/${toSlug(title)}`;
          const paRes = await importLyricsFromUrl(songId, paUrl);
          if (paRes.success) {
             results.lyrics = paRes.lyrics;
             if (paRes.chords) results.chords = paRes.chords;
          }
       }
    }

    // Pozdní čištění a kontrola kvality
    if (results.lyrics) {
       results.lyrics = cleanLyrics(results.lyrics);
       // Pokud je tam pořád moc otazníků, text zahodíme (chyba kódování u zdroje)
       if ((results.lyrics.match(/\?/g) || []).length > 8) {
          delete results.lyrics;
       }
    } else if (song.lyrics) {
       // Pokud jsme nenašli nový text, ale ten stávající je špinavý, aspoň ho vyčistíme
       const cleaned = cleanLyrics(song.lyrics);
       if (cleaned !== song.lyrics) {
          results.lyrics = cleaned;
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
