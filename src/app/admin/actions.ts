'use server';

import { db } from '@/lib/db';
import { SongState, Prisma } from '@prisma/client';
import { najdiCasovani, delkaZVelikosti } from '@/lib/lrclib';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { logAdminAction } from '@/app/actions/admin-extra-actions';
import { r2, BUCKET_NAME, PUBLIC_URL } from '@/lib/r2';
import { ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';

async function deleteFileFromR2(fileUrl: string | null) {
  if (!fileUrl || !fileUrl.includes(PUBLIC_URL)) return;
  
  try {
    const key = fileUrl.replace(PUBLIC_URL, '').replace(/^\//, '');
    if (!key) return;

    await r2.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    }));
    console.log(`🗑️ Smazáno z R2: ${key}`);
  } catch (err) {
    console.error(`❌ Chyba při mazání z R2 (${fileUrl}):`, err);
  }
}

/**
 * Úklid po nepovedeném nahrání.
 *
 * Upload do R2 a zápis do databáze jsou dva samostatné kroky — soubor se
 * uloží a teprve pak může `createSong` spadnout na duplicitní název nebo se
 * u instrumentálky nenajde shoda. Bez tohohle úklidu soubor v R2 zůstal
 * a nepatřil už nikomu; takhle jich tam v srpnu 2026 leželo 153 (597 MB).
 * Klient to volá ve své větvi s chybou.
 */
export async function smazNahranySoubor(fileUrl: string) {
  await ensureAdmin();
  await deleteFileFromR2(fileUrl);
}

/**
 * Zkusí k písni dohledat hotové časování a uložit ho.
 *
 * Nikdy nepřepisuje časování, které už existuje — ruční práce ze Studia je
 * vždycky cennější než odhad z LRC. Do dat se ukládá značka `zdroj: 'lrc'`,
 * aby bylo v administraci vidět, že to ještě nikdo neověřil; jakmile píseň
 * projde Studiem, značka zmizí sama, protože Studio bloky přestaví.
 */
async function zkusDoplnitCasovani(songId: string): Promise<boolean> {
  const song = await db.song.findUnique({
    where: { id: songId },
    select: { artist: true, title: true, audioSize: true, timingData: true },
  });
  // Existující časování se nikdy nepřepisuje — ruční práce ze Studia je
  // cennější než odhad z LRC.
  if (!song?.artist || !song.title || song.timingData) return false;

  const cil = delkaZVelikosti(song.audioSize);
  if (!cil) return false;

  try {
    const nalezene = await najdiCasovani(song.artist, song.title, cil);
    if (!nalezene) return false;

    await db.song.update({
      where: { id: songId },
      data: {
        timingData: {
          blocks: nalezene.blocks,
          dur: nalezene.dur,
          countdowns: nalezene.countdowns,
          zdroj: 'lrc',
        },
        // Text jde s časováním v jednom balíku: slova v blocích musí
        // odpovídat řádkům textu, jinak se Studio rozejde samo se sebou.
        // Píseň zatím časování neměla, takže se o klíčovanou práci nepřijde.
        lyrics: nalezene.lyrics,
        // Že časy sedí na TUHLE nahrávku pozná až člověk, který si to pustí.
        // Do té doby píseň čeká ve stavu na ověření a do katalogu nejde.
        state: SongState.TIMING_CHECK,
      },
    });
    console.log(`Časování z LRC: ${song.artist} – ${song.title} (${nalezene.blocks.length} bloků, rozdíl ${nalezene.rozdil.toFixed(1)}s)`);
    return true;
  } catch (e) {
    console.error('Dohledání časování selhalo:', e);
    return false;
  }
}

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
  const importName = formData.get('importName') as string || null;
  
  // AUTOMATICKÉ ČIŠTĚNÍ PŘI IMPORTU
  let title = cleanTitle(titleRaw);
  let artist = cleanTitle(artistRaw);

  // Pokud je v názvu pomlčka a interpret je prázdný, zkusíme to rozdělit
  if (title.includes(' - ') && !artist) {
    const parts = title.split(' - ');
    artist = parts[0].trim();
    title = parts.slice(1).join(' - ').trim();
  }
  
  if (!title) return { error: 'Chybí název písně' };

  // OCHRANA PROTI DUPLICITÁM (pokud neznáme importName, jinak povolíme, AI může čistit názvy)
  if (!importName) {
    const duplicate = await checkDuplicateSong(title, artist);
    if (duplicate) {
      throw new Error(`Tato píseň už v katalogu je: ${duplicate.title} (${duplicate.artist})`);
    }
  }

  const lyricsRaw = formData.get('lyrics') as string || '';
  const cleanedLyrics = cleanLyrics(lyricsRaw);
  
  const genre = formData.get('genre') as string;
  const audioUrl = formData.get('audioUrl') as string;
  // Otisk nahraného souboru. Hromadný import ho dřív zahazoval, takže
  // bulkem založené písně neměly `audioHash` a stejná MP3 se dala nahrát
  // znovu — stačilo soubor přejmenovat a neplatila ani kontrola názvu.
  const audioHash = (formData.get('audioHash') as string) || null;
  // Velikost výsledné MP3 — v administraci se podle ní dá řadit od nejkratší.
  const audioSizeRaw = formData.get('audioSize') as string | null;
  const audioSize = audioSizeRaw ? Number(audioSizeRaw) : null;
  const tagsString = formData.get('tags') as string;
  
  const tags = tagsString ? tagsString.split(',').map(t => t.trim()).filter(Boolean) : [];

  const songData = {
    title,
    artist: artist || null,
    genre: genre || null,
    tags,
    lyrics: cleanedLyrics || null,
    audioUrl: audioUrl || null,
    audioHash: audioHash,
    audioSize: Number.isFinite(audioSize as number) ? audioSize : null,
    importName: importName, // Schováme si původní název souboru
    animationStyle: 'karaoke-classic',
    createdById: session.user.id
  };

  const newSong = await db.song.create({
    data: songData
  });

  /**
   * Stažení textu se čeká, i když to import zdrží.
   *
   * Dřív se to pouštělo bez `await` „aby byl upload rychlý". Jenže odpojený
   * příslib odejde spolu s odpovědí: buď ho běh nedokončí, nebo mu uvnitř
   * selže `ensureAdmin()`, protože kontext požadavku už není. Chybu spolkl
   * `.catch()` a navenek to vypadalo, že se text prostě nenašel — proto ze
   * sta importovaných písní vyšel text u jedné.
   *
   * Časový strop je tu proto, aby jedna nedostupná služba nezablokovala
   * celý hromadný import.
   */
  let textNalezen = false;
  if (!newSong.lyrics) {
    try {
      const vysledek: any = await Promise.race([
        fetchLyricsAction(newSong.id),
        new Promise((r) => setTimeout(() => r({ error: 'časový limit' }), 20000)),
      ]);
      textNalezen = !!vysledek?.success;
    } catch (e) {
      console.error('Stažení textu selhalo:', e);
    }
  }

  // Když k písni existuje hotové časování odpovídající délkou naší nahrávce,
  // není důvod ji klíčovat od nuly. Rozhoduje `audioSize`, takže to funguje
  // jen u importu, který velikost posílá.
  const casovaniNalezeno = await zkusDoplnitCasovani(newSong.id);

  await logAdminAction('CREATE_SONG', `Vytvořena píseň: ${title} (${artist})`, 'Song', newSong.id);

  revalidatePath('/admin');
  return { ...newSong, textNalezen, casovaniNalezeno };
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

export async function findSongForInstrumentalAction(title: string, artist: string, rawFilename?: string) {
  await ensureAdmin();
  
  // 1. NEJJISTĚJŠÍ CESTA: Hledáme podle přesného původního názvu importu
  if (rawFilename) {
    const exact = await db.song.findFirst({
      where: { importName: rawFilename },
      select: { id: true, title: true, artist: true }
    });
    if (exact) return exact;
  }

  // 2. CESTA ZNALCŮ: Super-Normalizace (pokud se netrefíme přesně)
  const songs = await db.song.findMany({
    select: { id: true, title: true, artist: true, importName: true }
  });

  const normTitle = normalizeForMatching(title);
  const normArtist = normalizeForMatching(artist);

  const match = songs.find(s => {
    // Pokud má píseň importName, zkusíme normalizovat i ten (jako fallback)
    if (s.importName && rawFilename) {
       if (normalizeForMatching(s.importName) === normalizeForMatching(rawFilename)) return true;
    }

    const dbTitle = normalizeForMatching(s.title || '');
    const dbArtist = normalizeForMatching(s.artist || '');

    if (dbTitle !== normTitle) return false;

    return (
      dbArtist === normArtist || 
      !dbArtist || !normArtist || 
      dbArtist === 'neznamy' || normArtist === 'neznamy' ||
      dbArtist.includes(normArtist) || normArtist.includes(dbArtist)
    );
  });

  return match;
}

function normalizeForMatching(str: string) {
  if (!str) return '';
  let s = str.toLowerCase();
  // 1. Odstranění prefixů (1_, 01., atd.)
  s = s.replace(/^[0-9]+[\._\s-]/, '');
  // 2. Odstranění YouTube junk a instrumentálních značek
  s = s.replace(/[\(\[]\s*[^\]\)]*(official|video|lyrics?|audio|hd|4k|hq|remastered|live|feat\.|ft\.|karaoke|instrumental|vhs|retro|píseň|pieseň|wmv|mp4|avi|mpg|mpeg)[^\]\)]*\s*[\)\]]/gi, '');
  s = s.replace(/[-–—|]\s*(official|video|lyrics?|audio|hd|4k|hq|remastered|live|karaoke|instrumental|wmv|mp4|avi|mpg|mpeg)$/gi, '');
  s = s.replace(/instrumental|instr|karaoke/gi, '');
  // 3. SUPER-NORMALIZACE: Odstranění všeho kromě písmen a čísel
  return s.replace(/[^a-z0-9]/gi, '');
}

export async function updateSongAudio(songId: string, audioUrl: string, audioHash?: string, audioSize?: number) {
  await ensureAdmin();

  const oldSong = await db.song.findUnique({ where: { id: songId }, select: { audioUrl: true, state: true } });
  if (oldSong?.audioUrl && oldSong.audioUrl !== audioUrl) {
    await deleteFileFromR2(oldSong.audioUrl);
  }

  await db.song.update({
    where: { id: songId },
    data: {
      audioUrl,
      audioHash: audioHash || undefined,
      audioSize: audioSize ?? undefined,
      // Píseň zalistovaná nasucho čekala právě na tenhle soubor — jakmile
      // dorazí, nemá důvod zůstávat stranou a vrací se do běžného postupu.
      state: oldSong?.state === 'WAITING_AUDIO' ? SongState.NEW : undefined,
    }
  });
  revalidatePath('/admin');
}

export async function updateSongInstrumental(songId: string, instrumentalUrl: string, instrumentalHash?: string) {
  await ensureAdmin();

  const oldSong = await db.song.findUnique({ where: { id: songId }, select: { instrumentalUrl: true } });
  if (oldSong?.instrumentalUrl && oldSong.instrumentalUrl !== instrumentalUrl) {
    await deleteFileFromR2(oldSong.instrumentalUrl);
  }

  // Bez otisku se stejná instrumentálka dala nahrát znovu a znovu — kontrola
  // duplicit se má o co opřít až od téhle chvíle.
  await db.song.update({
    where: { id: songId },
    data: { instrumentalUrl, instrumentalHash: instrumentalHash || undefined },
  });
  revalidatePath('/admin');
}

export async function updateSongJson(songId: string, jsonUrl: string) {
  await ensureAdmin();

  const oldSong = await db.song.findUnique({ where: { id: songId }, select: { jsonUrl: true } });
  if (oldSong?.jsonUrl && oldSong.jsonUrl !== jsonUrl) {
    await deleteFileFromR2(oldSong.jsonUrl);
  }

  await db.song.update({ where: { id: songId }, data: { jsonUrl } });
  revalidatePath('/admin');
  revalidatePath('/designer');
}


// 'video' zmizelo se zrušeným rendererem — typ tu zůstal viset, ale žádná
// větev ho neobsluhovala, takže volání s ním jen tiše nic neudělalo.
export async function removeSongResource(songId: string, type: 'audio' | 'instrumental' | 'background' | 'json') {
  await ensureAdmin();
  
  const song = await db.song.findUnique({ where: { id: songId } });
  if (!song) return;

  const data: any = {};
  if (type === 'audio') {
    await deleteFileFromR2(song.audioUrl);
    data.audioUrl = null;
  }
  if (type === 'instrumental') {
    await deleteFileFromR2(song.instrumentalUrl);
    data.instrumentalUrl = null;
  }
  if (type === 'background') {
    await deleteFileFromR2(song.backgroundUrl);
    data.backgroundUrl = null;
  }
  if (type === 'json') {
    await deleteFileFromR2(song.jsonUrl);
    data.jsonUrl = null;
  }

  await db.song.update({ where: { id: songId }, data });
  revalidatePath('/admin');
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
        state: SongState.REQUESTED,
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
  await ensureAdmin();
  await db.song.update({ where: { id: songId }, data: { animationStyle } });
  revalidatePath('/admin');
}

export async function updateSongBackground(songId: string, backgroundUrl: string) {
  await ensureAdmin();
  await db.song.update({ where: { id: songId }, data: { backgroundUrl } });
  revalidatePath('/admin');
}

export async function updateSong(songId: string, data: any) {
  // Dřív tu stačilo být přihlášený. Registrace je přitom samoobslužná,
  // takže kdokoli si mohl založit účet a přepsat libovolné písni název,
  // text, odkazy na soubory i stav (tedy ji třeba stáhnout z katalogu).
  await ensureAdmin();

  // FILTRACE POLÍ (Prisma nesmí dostat systémová pole nebo pole co neexistují v modelu)
  const allowedFields = [
    'title', 'artist', 'genre', 'tags', 'lyrics', 'chords', 
    'audioUrl', 'instrumentalUrl', 'backgroundUrl', 'jsonUrl', 
    'animationStyle', 'state', 'timingData', 'startTime'
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
}

export async function bulkRemoveBackground(backgroundUrl: string) {
  // Hromadná změna přes celý katalog — na to nestačí být přihlášený.
  await ensureAdmin();

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


/** Jeden nalezený text i s tím, odkud je a jak dobře vypadá. */
type Kandidat = { zdroj: string; text: string; skore: number };

/**
 * Stažení stránky s ohledem na kódování. Supermusic jede ve windows-1250;
 * když se to přečte jako UTF-8, místo háčků přijdou otazníky a text pak
 * vypadá jako nenalezený, i když nalezený byl.
 */
async function stahni(url: string, kodovani = 'utf-8'): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (Karacho lyrics fetcher)' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return new TextDecoder(kodovani).decode(buf);
  } catch {
    return null;
  }
}

/**
 * Jak moc to vypadá jako text písně. Rozhoduje mezi zdroji — první nalezený
 * bývá často útržek, cizojazyčná verze nebo akordový zápis.
 */
function ohodnotText(text: string, ocekavanyJazykCesky: boolean): number {
  const radky = text.split('\n').map(r => r.trim()).filter(Boolean);
  if (radky.length < 4) return 0;

  let skore = Math.min(radky.length, 60);

  // Krátké řádky jsou typické pro zpěv; dlouhé odstavce bývají článek o písni.
  const prumer = radky.reduce((a, r) => a + r.length, 0) / radky.length;
  if (prumer > 90) skore -= 30;
  if (prumer >= 15 && prumer <= 60) skore += 15;

  // Opakování (refrén) je dobrý příznak.
  const unikatni = new Set(radky.map(r => r.toLowerCase())).size;
  if (unikatni < radky.length * 0.85) skore += 10;

  // Akordový zápis nechceme jako text.
  const akordove = radky.filter(r => /^[\s|]*([A-H][#b]?(mi|m|maj|dim|sus)?\d?[\s|]*)+$/.test(r)).length;
  if (akordove > radky.length * 0.2) skore -= 40;

  // Zbytky webu.
  if (/cookie|přihlásit|reklama|copyright|všechna práva/i.test(text)) skore -= 20;

  // U českých písní čekáme diakritiku.
  if (ocekavanyJazykCesky) {
    const diakritika = (text.match(/[ěščřžýáíéúůňťďó]/gi) || []).length;
    skore += diakritika > text.length * 0.02 ? 20 : -25;
  }

  return skore;
}


/** Z HTML udělá holý text: odstraní značky, převede entity a zlomy řádků. */
function naText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n').map(r => r.trim()).join('\n')
    .trim();
}

/** Genius — pokrývá zahraniční i český rap, který na Supermusicu není. */
async function zGenius(artist: string, title: string): Promise<string | null> {
  const hledani = await stahni(
    `https://genius.com/api/search/multi?q=${encodeURIComponent(`${artist} ${title}`)}`,
  );
  if (!hledani) return null;

  let odkaz: string | null = null;
  try {
    const data = JSON.parse(hledani);
    for (const sekce of data?.response?.sections ?? []) {
      for (const zaznam of sekce.hits ?? []) {
        if (zaznam.type === 'song' && zaznam.result?.url) { odkaz = zaznam.result.url; break; }
      }
      if (odkaz) break;
    }
  } catch { return null; }
  if (!odkaz) return null;

  const stranka = await stahni(odkaz);
  if (!stranka) return null;

  // Text je v blocích označených data-lyrics-container.
  const bloky = stranka.match(/<div[^>]+data-lyrics-container[^>]*>([\s\S]*?)<\/div>/g);
  if (!bloky || bloky.length === 0) return null;
  return naText(bloky.join('\n'));
}

/**
 * Písničky-akordy.cz — adresa se skládá přímo z interpreta a názvu, žádné
 * vyhledávání se neobchází. Právě proto tenhle zdroj funguje i na český
 * repertoár, na kterém ostatní selhávají: vyhledávání Supermusicu se po
 * přestavbě webu dotahuje JavaScriptem a Karaoketexty vracejí 503.
 * Dřív byl schovaný jen v `researchSongDataAction`, takže tlačítko na
 * stažení textu ho nikdy nezavolalo.
 */
function naSlug(s: string): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function zPisnickyAkordy(artist: string, title: string): Promise<string | null> {
  // Adresa se skládá z názvu, takže smetí z názvu souboru („(Video)",
  // „(oficiální videoklip") ji rozbije. Zkoušíme proto i uklizenou variantu
  // a prohozené pořadí — u části importovaných písní skončil interpret
  // v názvu a naopak.
  const bezZavorek = title.replace(/\s*[([][^)\]]*[)\]]?\s*$/, '').trim();
  const varianty: [string, string][] = [[artist, title]];
  if (bezZavorek && bezZavorek !== title) varianty.push([artist, bezZavorek]);
  varianty.push([title, artist]);

  for (const [a, t] of varianty) {
    if (!a || !t) continue;
    const stranka = await stahni(`https://pisnicky-akordy.cz/${naSlug(a)}/${naSlug(t)}`);
    const blok = stranka?.match(/<pre[^>]*>([\s\S]*?)<\/pre>/);
    if (blok) {
      const text = naText(blok[1]);
      if (text.trim().length > 40) return text;
    }
  }
  return null;
}

/** Karaoketexty.cz — český repertoár včetně toho, co jinde chybí. */
async function zKaraoketexty(artist: string, title: string): Promise<string | null> {
  const hledani = await stahni(
    `https://www.karaoketexty.cz/vyhledavani?text=${encodeURIComponent(`${artist} ${title}`)}`,
  );
  const cesta = hledani?.match(/href="(\/texty-pisni\/[^"]+)"/)?.[1];
  if (!cesta) return null;

  const stranka = await stahni(`https://www.karaoketexty.cz${cesta}`);
  if (!stranka) return null;

  const blok = stranka.match(/<div[^>]+id="song-text"[^>]*>([\s\S]*?)<\/div>/i)
    ?? stranka.match(/<div[^>]+class="[^"]*song-text[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (!blok) return null;
  return naText(blok[1]);
}

/** Postupně obejde zdroje a vrátí všechny nalezené texty k porovnání. */
async function sesbirejKandidaty(artist: string, title: string): Promise<Kandidat[]> {
  const kandidati: Kandidat[] = [];
  const dotaz = `${artist} ${title}`;
  const ceske = /[ěščřžýáíéúůňťďó]/i.test(dotaz);

  // 1. Supermusic (CZ/SK) — nejdřív najdeme id písně, pak čistý export.
  const hledani = await stahni(
    `https://www.supermusic.cz/najdi.php?fraza=${encodeURIComponent(dotaz)}&hladat=pesnicka`,
    'windows-1250',
  );
  const id = hledani?.match(/idpiesne=(\d+)/)?.[1];
  if (id) {
    const text = await stahni(
      `https://www.supermusic.cz/export.php?idpiesne=${id}&typ=TXT&modulacia=0`,
      'windows-1250',
    );
    if (text && text.trim().length > 40) {
      kandidati.push({ zdroj: 'Supermusic', text: text.trim(), skore: ohodnotText(text, ceske) });
    }
  }

  // 2. Písničky-akordy, Genius a Karaoketexty.
  for (const [nazev, ziskej] of [
    ['Písničky-akordy', zPisnickyAkordy],
    ['Genius', zGenius],
    ['Karaoketexty', zKaraoketexty],
  ] as const) {
    try {
      const text = await ziskej(artist, title);
      if (text && text.trim().length > 40) {
        kandidati.push({ zdroj: nazev, text: text.trim(), skore: ohodnotText(text, ceske) });
      }
    } catch { /* zdroj vynecháme */ }
  }

  // 3. Lyrics.ovh — zahraniční repertoár.
  try {
    const res = await fetch(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
      { signal: AbortSignal.timeout(12000) },
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.lyrics && String(data.lyrics).trim().length > 40) {
        const t = String(data.lyrics).trim();
        kandidati.push({ zdroj: 'Lyrics.ovh', text: t, skore: ohodnotText(t, ceske) });
      }
    }
  } catch { /* zdroj vynecháme */ }

  // 4. Vagalume — původní zdroj, teď až jako poslední.
  try {
    const res = await fetch(
      `https://api.vagalume.com.br/search.php?art=${encodeURIComponent(artist)}&mus=${encodeURIComponent(title)}&apikey=666a658e7948d9d20233d31c36006c9a`,
      { signal: AbortSignal.timeout(12000) },
    );
    if (res.ok) {
      const data = await res.json();
      const t = data?.mus?.[0]?.text?.trim();
      if (t && t.length > 40) kandidati.push({ zdroj: 'Vagalume', text: t, skore: ohodnotText(t, ceske) });
    }
  } catch { /* zdroj vynecháme */ }

  return kandidati;
}

export async function fetchLyricsAction(songId: string) {
  await ensureAdmin();
  const song = await db.song.findUnique({ where: { id: songId } });
  if (!song || !song.artist || !song.title) return { error: 'Chybí interpret nebo název' };

  const artist = song.artist;
  const title = song.title;

  try {
    // Zdroje obejdeme všechny a vybereme nejlepší výsledek, ne první nalezený.
    const kandidati = await sesbirejKandidaty(artist, title);
    console.log('Lyrics:', kandidati.map(k => `${k.zdroj}=${k.skore}`).join(', ') || 'nic nenalezeno');

    const nejlepsi = kandidati.filter(k => k.skore > 10).sort((a, b) => b.skore - a.skore)[0];
    if (!nejlepsi) {
      return { error: kandidati.length
        ? 'Nalezené texty nevypadaly použitelně (asi akordy nebo útržek).'
        : 'Text se nepodařilo najít v žádném zdroji.' };
    }

    const lyrics = cleanLyrics(nejlepsi.text);
    await db.song.update({
      where: { id: songId },
      data: { lyrics, chords: nejlepsi.text !== lyrics ? nejlepsi.text : null },
    });
    revalidatePath('/admin');
    return {
      success: true,
      lyrics,
      source: nejlepsi.zdroj,
      zdroje: kandidati.map(k => `${k.zdroj} (${k.skore})`),
    };
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
  await ensureAdmin();
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

/**
 * Hromadné dohledání časování u písní, které ho nemají.
 *
 * Bere jen ty, u kterých známe délku nahrávky (`audioSize`) — bez ní se
 * nedá poznat, jestli nalezené LRC patří k naší verzi, a špatné časování
 * je horší než žádné. Existující časování se nikdy nepřepisuje.
 *
 * Zpracovává se po dávkách, ať jeden požadavek neběží půl hodiny;
 * `zbyva` říká, kolik písní ještě čeká na další kolo.
 */
export async function bulkDohledejCasovaniAction(davka = 25) {
  await ensureAdmin();

  const kandidati = await db.song.findMany({
    where: { timingData: { equals: Prisma.DbNull }, audioSize: { not: null }, artist: { not: null } },
    select: { id: true, artist: true, title: true },
    take: davka,
  });

  let nalezeno = 0;
  const hlaseni: string[] = [];
  for (const s of kandidati) {
    if (await zkusDoplnitCasovani(s.id)) {
      nalezeno++;
      hlaseni.push(`✓ ${s.artist} – ${s.title}`);
    }
  }

  const zbyva = await db.song.count({
    where: { timingData: { equals: Prisma.DbNull }, audioSize: { not: null }, artist: { not: null } },
  });

  await logAdminAction('BULK_TIMING', `Dohledáno časování: ${nalezeno} z ${kandidati.length}`);
  revalidatePath('/admin');
  return { zpracovano: kandidati.length, nalezeno, zbyva, hlaseni };
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
    // Použijeme chytřejší researchSongDataAction, která prohledává i CZ/SK zdroje
    const res = await researchSongDataAction(s.id);
    if (res.success) results.count++;
    else results.failed++;
  }
  revalidatePath('/admin');
  return results;
}

export async function researchSongDataAction(songId: string, overrideTitle?: string, overrideArtist?: string) {
  await ensureAdmin();
  const song = await db.song.findUnique({ where: { id: songId } });
  if (!song) return { error: 'Píseň nenalezena' };

  const artist = overrideArtist || song.artist;
  const title = overrideTitle || song.title;
  
  if (!artist || !title) return { error: 'Chybí interpret nebo název pro vyhledávání' };

  const results: any = {};

  try {
    // 1. VAGALUME RESEARCH
    const vRes = await fetch(`https://api.vagalume.com.br/search.php?art=${encodeURIComponent(artist)}&mus=${encodeURIComponent(title)}&apikey=666a658e7948d9d20233d31c36006c9a`);
    if (vRes.ok) {
      const vData = await vRes.json();
      if (vData.mus && vData.mus[0]) {
        const track = vData.mus[0];
        if (track.text && (!song.lyrics || song.lyrics.length < 50)) {
           // Ignorujeme jen pokud je text POUZE otazník (někdy vrací "?" místo textu)
           if (track.text.trim() !== '?') {
              results.lyrics = track.text.trim();
           }
        }
        if (vData.art && vData.art.genre && vData.art.genre[0]) {
           results.genre = vData.art.genre[0].name;
        }
      }
    }

    // 1b. LYRICS.OVH BACKUP (pokud Vagalume nenašlo text)
    if (!results.lyrics) {
       try {
         const ovhRes = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
         if (ovhRes.ok) {
           const ovhData = await ovhRes.json();
           if (ovhData.lyrics) {
             results.lyrics = ovhData.lyrics.trim();
           }
         }
       } catch (e) {}
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
       // Nejdřív zkusíme společný bodovaný řetěz zdrojů — stejný, jaký běží
       // pod tlačítkem na stažení textu. Ať se zdroje přidávají na jednom místě.
       const kandidati = await sesbirejKandidaty(artist, title);
       console.log('Research:', kandidati.map(k => `${k.zdroj}=${k.skore}`).join(', ') || 'nic');
       const nejlepsi = kandidati.filter(k => k.skore > 10).sort((a, b) => b.skore - a.skore)[0];
       if (nejlepsi) {
         const cistyText = cleanLyrics(nejlepsi.text);
         await db.song.update({
           where: { id: songId },
           data: { lyrics: cistyText, chords: nejlepsi.text !== cistyText ? nejlepsi.text : null },
         });
         revalidatePath('/admin');
         return { success: true, message: `Text stažen ze zdroje ${nejlepsi.zdroj}.` };
       }

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

    // Když k písni existuje hotové časování sedící délkou na naši nahrávku,
    // je škoda ji klíčovat od nuly. Nepřepisuje se, jen doplňuje.
    if (await zkusDoplnitCasovani(songId)) {
      results.casovaniZLrc = true;
    }

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
  await ensureAdmin();
  await db.song.updateMany({
    where: { id: { in: songIds } },
    data: { state: newState as any }
  });
  revalidatePath('/admin');
}

export async function deleteSong(songId: string) {
  await ensureAdmin();
  
  // Najdeme píseň, abychom znali URL souborů k smazání
  const song = await db.song.findUnique({
    where: { id: songId },
    select: { audioUrl: true, instrumentalUrl: true, backgroundUrl: true, jsonUrl: true }
  });

  if (song) {
    // Smažeme všechny soubory z R2
    if (song.audioUrl) await deleteFileFromR2(song.audioUrl);
    if (song.instrumentalUrl) await deleteFileFromR2(song.instrumentalUrl);
    if (song.backgroundUrl) await deleteFileFromR2(song.backgroundUrl);
    if (song.jsonUrl) await deleteFileFromR2(song.jsonUrl);
  }

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
      // POZOR: 'UNPUBLISHED' NENÍ hodnota enumu SongState – je to jen filtr v UI
      // („nepublikované" = vše kromě ACTIVE). Zápis do DB s ní vždy selhal a
      // vytvoření druhého hlasu tak nikdy neprošlo. `as any` to schovalo před
      // typovou kontrolou, proto typovaná hodnota bez castu.
      state: SongState.NEW
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
  suggestedGenre?: string;
  suggestedTags?: string[];
  suggestedOrigin?: string;
  suggestedLyrics?: string;
  autoFixable: boolean;
}

const YOUTUBE_JUNK = /\s*[\(\[]\s*[^\]\)]*(Official\s*(Music\s*)?Video|Lyrics?\s*Video|Lyric\s*Video|Audio|HD|4K|HQ|Remastered|Remaster|Live|feat\.\s*|ft\.\s*|Official\s*Audio|Music\s*Video|Video\s*Cl[ií]p|Karaoke|Instrumental|Creative\s*Commission|With\s*Lyrics?|Full\s*Album|Full\s*HD|Visuali[sz]er|VHS|RETRO|píseň\s*pro|pieseň\s*pre|soundtrack|Lyrics?|Text\s*písně|Text\s*piesne)[^\]\)]*\s*[\)\]]/gi;
const YOUTUBE_SUFFIX = /\s*([-–—|]\s*)?(Official\s*(Music\s*)?Video|Lyrics?\s*Video|Lyric\s*Video|Audio|HD|4K|HQ|Remastered|Live|Official\s*Audio|Music\s*Video|Karaoke|Instrumental|With\s*Lyrics?|\.wmv|\.mp4|\.avi|\.mpg|\.mpeg|Lyrics?|Text\s*písně)$/gi;

function cleanTitle(title: string): string {
  let t = title;
  // Odstranění prefixů (1_, 01., atd.)
  t = t.replace(/^[0-9]+[\._\s-]/, '');
  t = t.replace(YOUTUBE_JUNK, '');
  t = t.replace(YOUTUBE_SUFFIX, '');
  // Speciální případ pro nalepené "KARAOKE" na konci bez mezery
  t = t.replace(/KARAOKE$/gi, '');
  // Odstranění zbytků teček na konci (často po příponách)
  t = t.replace(/\.$/, '');
  t = t.replace(/\s{2,}/g, ' ').trim();
  return t;
}

function smartWrapLyrics(text: string, maxChars: number = 45): string {
  if (!text) return '';
  const lines = text.split('\n');
  const result: string[] = [];

  for (let line of lines) {
    line = line.trim();
    if (line.length <= maxChars) {
      result.push(line);
      continue;
    }

    // Inteligentní rozdělení dlouhého řádku
    let currentLine = line;
    while (currentLine.length > maxChars) {
      // Hledáme čárku jako ideální bod rozdělení
      let splitIdx = currentLine.lastIndexOf(', ', maxChars);
      // Pokud není čárka, hledáme mezeru
      if (splitIdx === -1) splitIdx = currentLine.lastIndexOf(' ', maxChars);
      
      if (splitIdx === -1 || splitIdx < maxChars * 0.5) {
        // Pokud jsme nenašli mezeru v rozumném místě, vezmeme první mezeru za limitem
        splitIdx = currentLine.indexOf(' ', maxChars);
      }

      if (splitIdx !== -1) {
        result.push(currentLine.substring(0, splitIdx).trim());
        currentLine = currentLine.substring(splitIdx).trim();
      } else {
        // Nouzovka - rozdělení natvrdo (nemělo by nastat u textů)
        result.push(currentLine);
        break;
      }
    }
    if (currentLine) result.push(currentLine);
  }

  return result.join('\n');
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
    select: { id: true, title: true, artist: true, lyrics: true, state: true, timingData: true },
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
        issueType: 'DOUBLE_SPACES',
        description: `Název obsahuje více mezer za sebou`,
        suggestedTitle: title.replace(/\s{2,}/g, ' ').trim(),
        autoFixable: true,
      });
    }

    // 5. Junk in lyrics (chords or structural labels)
    if (s.lyrics) {
      const hasBrackets = s.lyrics.includes('[') && s.lyrics.includes(']');
      const hasStructuralLabels = /^(Chorus|Verse|Intro|Outro|Refren|Refrén|Sloka|Bridge|Mezihra|Solo|Sólo|Interlude|Ref:|R:)/im.test(s.lyrics);
      
      if (hasBrackets || hasStructuralLabels) {
        issues.push({
          songId: s.id, title, artist,
          issueType: 'LYRICS_JUNK',
          description: `Text obsahuje akordy nebo značky (Chorus, Refrén...)`,
          suggestedLyrics: cleanLyrics(s.lyrics),
          autoFixable: true,
        });
      }
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

    // 7. Dlouhé řádky v textu - JEN POKUD NEMÁ KLÍČOVÁNÍ (JSON)
    if (s.lyrics && !s.timingData) {
      const lines = s.lyrics.split('\n');
      const longLines = lines.filter(l => l.trim().length > 55);
      if (longLines.length > 0) {
        issues.push({
          songId: s.id, title: s.title, artist: s.artist || '',
          issueType: 'LONG_LYRICS_LINES',
          description: `${longLines.length} řádků je příliš dlouhých (nad 55 znaků)`,
          suggestedLyrics: smartWrapLyrics(s.lyrics),
          autoFixable: true,
        });
      }
    }

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
  lyrics?: string;
}[]) {
  await ensureAdmin();
  
  // Merge fixes per songId (a song might have multiple issues)
  const merged = new Map<string, { title?: string; artist?: string; genre?: string; tags?: string[]; origin?: string; lyrics?: string }>();
  for (const fix of fixes) {
    const existing = merged.get(fix.songId) || {};
    if (fix.title !== undefined) existing.title = fix.title;
    if (fix.artist !== undefined) existing.artist = fix.artist;
    if (fix.genre !== undefined) existing.genre = fix.genre;
    if (fix.tags !== undefined) existing.tags = fix.tags;
    if (fix.origin !== undefined) existing.origin = fix.origin;
    if (fix.lyrics !== undefined) existing.lyrics = fix.lyrics;
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

export async function exportCatalogXmlAction(onlyIncomplete: boolean = false) {
  await ensureAdmin();
  
  const where = onlyIncomplete ? {
    OR: [
      { genre: null },
      { origin: null },
      { tags: { equals: [] } }
    ]
  } : {};

  const songs = await db.song.findMany({
    where,
    orderBy: { artist: 'asc' }
  });

  // Získání unikátních žánrů a původů pro číselník
  const allSongs = await db.song.findMany({ select: { genre: true, origin: true, tags: true } });
  const genres = Array.from(new Set(allSongs.map(s => s.genre).filter(Boolean)));
  const origins = Array.from(new Set(allSongs.map(s => s.origin).filter(Boolean)));
  const allTags = Array.from(new Set(allSongs.flatMap(s => s.tags || [])));

  const prompt = `Jsi expert na hudební metadata. Tvým úkolem je zkontrolovat a doplnit přiložený XML seznam písní.
POKYNY:
1. OPRAVA: Zkontroluj <Title> a <Artist>. Pokud je v nich překlep, nesmysl (např. YouTube junk), nebo jsou prohozené, OPRAV JE přímo v XML.
2. DOPLNĚNÍ: Zaměř se na prázdná pole <Origin>, <Genre> a <Tags>.
3. KONZISTENCE: Používej pokud možno existující hodnoty z číselníku (Dictionaries).
4. PŮVOD: <Origin> uváděj jako ISO kód země (CZ, SK, EN, US, DE, PL atd.).
5. TAGY: <Tags> uváděj jako čárkou oddělený seznam (např. 80s, rock, happy).
6. VÝSTUP: Vrať mi zpět POUZE upravené XML ve stejné struktuře, nic jiného nepiš.`;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<KarachoCatalog>\n`;
  xml += `  <Info>\n`;
  xml += `    <RecommendedPrompt><![CDATA[${prompt}]]></RecommendedPrompt>\n`;
  xml += `    <ExportMode>${onlyIncomplete ? 'INCOMPLETE_ONLY' : 'ALL'}</ExportMode>\n`;
  xml += `  </Info>\n`;
  xml += `  <Dictionaries>\n`;
  xml += `    <Genres>${genres.join(', ')}</Genres>\n`;
  xml += `    <Origins>${origins.join(', ')}</Origins>\n`;
  xml += `    <Tags>${allTags.slice(0, 50).join(', ')}</Tags>\n`;
  xml += `  </Dictionaries>\n`;
  xml += `  <Songs>\n`;

  for (const s of songs) {
    xml += `    <Song id="${s.id}">\n`;
    xml += `      <Title><![CDATA[${s.title}]]></Title>\n`;
    xml += `      <Artist><![CDATA[${s.artist || ''}]]></Artist>\n`;
    xml += `      <Origin>${s.origin || ''}</Origin>\n`;
    xml += `      <Genre>${s.genre || ''}</Genre>\n`;
    xml += `      <Tags>${(s.tags || []).join(', ')}</Tags>\n`;
    xml += `    </Song>\n`;
  }

  xml += `  </Songs>\n`;
  xml += `</KarachoCatalog>`;

  return xml;
}

import { XMLParser } from 'fast-xml-parser';

export async function importCatalogXmlAction(xmlContent: string) {
  await ensureAdmin();
  const parser = new XMLParser({ 
    ignoreAttributes: false, 
    attributeNamePrefix: "",
    cdataPropName: "__cdata" // Abychom správně četli CDATA
  });
  const jsonObj = parser.parse(xmlContent);

  if (!jsonObj.KarachoCatalog || !jsonObj.KarachoCatalog.Songs || !jsonObj.KarachoCatalog.Songs.Song) {
    throw new Error('Neplatný formát XML. Chybí struktura KarachoCatalog > Songs > Song.');
  }

  const songs = Array.isArray(jsonObj.KarachoCatalog.Songs.Song) 
    ? jsonObj.KarachoCatalog.Songs.Song 
    : [jsonObj.KarachoCatalog.Songs.Song];

  let updatedCount = 0;

  for (const songData of songs) {
    const id = songData.id;
    const updateData: any = {};

    // Čtení dat (včetně CDATA a různých formátů fast-xml-parseru)
    const getVal = (val: any) => {
      if (val === undefined || val === null) return '';
      if (typeof val === 'object') {
        if (val.__cdata) return String(val.__cdata).trim();
        if (val['#text']) return String(val['#text']).trim();
        if (Object.keys(val).length === 0) return '';
        return ''; 
      }
      return String(val).trim();
    };

    const title = getVal(songData.Title);
    const artist = getVal(songData.Artist);
    const origin = getVal(songData.Origin);
    const genre = getVal(songData.Genre);
    const tags = getVal(songData.Tags);

    if (title) updateData.title = title;
    if (artist) updateData.artist = artist;
    if (origin !== undefined) updateData.origin = origin || null;
    if (genre !== undefined) updateData.genre = genre || null;
    if (tags !== undefined) {
      updateData.tags = tags ? tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
    }

    if (Object.keys(updateData).length > 0) {
      try {
        await db.song.update({
          where: { id },
          data: updateData
        });
        updatedCount++;
      } catch (err) {
        console.error(`Chyba při aktualizaci písně ${id}:`, err);
      }
    }
  }

  revalidatePath('/admin');
  return { success: true, updatedCount };
}
