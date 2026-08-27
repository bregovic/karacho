'use server';

import { db } from '@/lib/db';
import { jenSpravce } from '@/lib/opravneni';
import { lrcNaCasovani, MIN_BLOKU } from '@/lib/lrc';
import { revalidatePath } from 'next/cache';

/**
 * Zalistování písně „nasucho" — text, časování a metadata bez nahrávky.
 *
 * Obrací pořadí práce: napřed se naklikne repertoár, zvuk se doplňuje do
 * hotové kostry. Píseň skončí ve stavu WAITING_AUDIO a do katalogu se
 * nedostane, dokud nebude mít audio.
 */

/** Názvy variant, které nechceme — remix ani live obvykle není to, co hledáme. */
const PODEZRELE = /(remix|live|acoustic|instrumental|karaoke|cover|remaster|re-?recorded|radio edit|version|mix|demo|reprise|extended|mono|sped up|slowed|tribute|made popular)/i;

/**
 * Porovnávací klíč. Stylizace `$` a `@` se převádějí na písmena — „Ke$ha"
 * a „Kesha" je tentýž interpret a bez toho se píseň založila podruhé,
 * i když v katalogu dávno byla. Číslice se schválně nepřevádějí: „MIG 21"
 * a „Blink-182" jsou skutečná jména a záměna 1→i by z různých kapel
 * udělala jednu.
 */
const klic = (s?: string | null) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/\$/g, 's').replace(/@/g, 'a')
    .replace(/[^a-z0-9]/g, '');

/** Vydavatelství a projekty vydávající karaoke podklady a předělávky. */
const PODEZRELY_INTERPRET = /(karaoke|ameritz|mix-?masters|tribute|piano dreamers|string quartet|tune robbers|orchestra|violinista|workshop|backing|instrumental|cover band|sunfly|zoom|made famous by)/i;

const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

/**
 * Deezer se nesmí vybírat jen podle délky. Remix i live nahrávka mívá
 * stejnou stopáž jako originál a jednou to takhle přepsalo „Sweet Caroline"
 * na úplně jinou píseň. Název proto musí odpovídat, teprve pak rozhoduje
 * délka a příznaky verze.
 */
function vyberStopu(stopy: any[], hledanyNazev: string, cilovaDelka: number) {
  if (!stopy?.length) return null;
  const cil = klic(hledanyNazev);
  const sedi = stopy.filter((s) => {
    const jadro = klic(String(s.title).replace(/\s*[([].*$/, ''));
    return jadro === cil || jadro.startsWith(cil) || cil.startsWith(jadro);
  });
  if (!sedi.length) return null;
  const skore = (s: any) =>
    (PODEZRELE.test(s.title) ? 100 : 0) + (/[([]/.test(s.title) ? 20 : 0) + Math.abs((s.duration || 0) - cilovaDelka);
  return sedi.reduce((a, b) => (skore(b) < skore(a) ? b : a));
}

export type NahledPisne = {
  zadano: string;
  stav: 'OK' | 'DUPLICITA' | 'BEZ_TEXTU' | 'CHYBA';
  zprava: string;
  artist?: string;
  title?: string;
  delka?: number;
  bloku?: number;
  odpoctu?: number;
  prvniRadek?: string;
  rozdilDelek?: number;
  existujiciId?: string;
};

async function pripravit(artist: string, title: string): Promise<NahledPisne> {
  const zadano = `${artist} – ${title}`;
  if (PODEZRELY_INTERPRET.test(artist)) {
    return { zadano, stav: 'CHYBA', zprava: 'Vypadá to na karaoke podklad nebo předělávku, ne na originál' };
  }
  try {
    const lr = await fetch(
      `https://lrclib.net/api/search?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`,
      { headers: { 'User-Agent': 'Karacho/1.0' }, signal: AbortSignal.timeout(15000) },
    ).then((r) => (r.ok ? r.json() : []));

    const kandidati = (Array.isArray(lr) ? lr : []).filter((x: any) => x.syncedLyrics && x.duration);
    if (!kandidati.length) {
      return { zadano, stav: 'BEZ_TEXTU', zprava: 'Synchronizovaný text nenalezen' };
    }

    // Od nejtypičtější délky — odolné vůči live verzím, které jsou o minuty jinde.
    const med = median(kandidati.map((x: any) => x.duration));
    const serazeni = [...kandidati].sort(
      (a: any, b: any) => Math.abs(a.duration - med) - Math.abs(b.duration - med),
    );

    for (const lrc of serazeni) {
      const data = lrcNaCasovani(lrc.syncedLyrics, lrc.duration);
      // Vadný soubor pozná až tenhle převod — proto se zkouší další verze.
      if (data.blocks.length < MIN_BLOKU) continue;

      const dz = await fetch(
        `https://api.deezer.com/search?q=${encodeURIComponent(`${artist} ${title}`)}&limit=25`,
        { signal: AbortSignal.timeout(15000) },
      ).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const stopa = vyberStopu(dz?.data, title, lrc.duration);

      // Deezer smí název upřesnit, ale NIKDY přepsat interpreta na jiného.
      // Když se neshodne, je to coververze nebo jiná píseň téhož názvu —
      // a časování, které držíme, patří tomu původnímu interpretovi.
      // Bez tohohle pravidla vyšel z „Oasis – Whatever" záznam
      // „Imagine Dragons – Whatever It Takes".
      const sediInterpret = stopa && klic(stopa.artist?.name) === klic(artist);
      const finalniNazev = sediInterpret ? stopa.title : title;
      const finalniInterpret = artist;

      // Porovnání bez ohledu na velikost písmen a diakritiku. Přesná shoda
      // nestačí: „Take On Me" a „Take on Me" jsou tatáž píseň a jednou se
      // kvůli tomu založila podruhé.
      // Porovnává se normalizovaně nad celým katalogem, ne dotazem do
      // databáze: `mode: 'insensitive'` řeší velikost písmen, ale ne dolar
      // v „Ke$ha" ani tečku v „Boney M.". Katalog má stovky písní, takže
      // projít je v paměti nic nestojí.
      const vsechny = await db.song.findMany({ select: { id: true, title: true, artist: true, state: true } });
      const kA = klic(finalniInterpret), kT = klic(finalniNazev);
      const existujici = vsechny.find((x) => klic(x.artist) === kA && klic(x.title) === kT);
      if (existujici) {
        return {
          zadano, stav: 'DUPLICITA', existujiciId: existujici.id,
          zprava: `V katalogu už je: ${existujici.artist} – ${existujici.title} (${existujici.state})`,
          artist: finalniInterpret, title: finalniNazev,
        };
      }

      return {
        zadano, stav: 'OK', zprava: `${data.blocks.length} bloků`,
        artist: finalniInterpret, title: finalniNazev,
        delka: Math.round(lrc.duration),
        bloku: data.blocks.length,
        odpoctu: data.countdowns.length,
        prvniRadek: `${data.blocks[0].bs}s „${data.blocks[0].lw.join(' ')}"`,
        rozdilDelek: stopa ? Math.abs(stopa.duration - lrc.duration) : undefined,
      };
    }

    return { zadano, stav: 'BEZ_TEXTU', zprava: `Žádná z ${kandidati.length} verzí nedala použitelné časování` };
  } catch (e: any) {
    return { zadano, stav: 'CHYBA', zprava: e?.message || 'Nepodařilo se dotázat služeb' };
  }
}

/** Rozebere řádek „Interpret - Název" (i s pomlčkou nebo en-dash). */
function rozdel(radek: string): [string, string] | null {
  const t = radek.trim();
  if (!t) return null;
  const m = t.split(/\s+[-–—]\s+/);
  if (m.length < 2) return null;
  return [m[0].trim(), m.slice(1).join(' - ').trim()];
}

/** Prověří seznam, nic nezakládá. */
export async function proverSeznamAction(seznam: string): Promise<NahledPisne[]> {
  await jenSpravce();

  const radky = seznam.split('\n').map((r) => r.trim()).filter(Boolean).slice(0, 40);
  const vysledky: NahledPisne[] = [];

  for (const radek of radky) {
    const rozdeleno = rozdel(radek);
    if (!rozdeleno) {
      vysledky.push({ zadano: radek, stav: 'CHYBA', zprava: 'Očekává se tvar „Interpret - Název"' });
      continue;
    }
    vysledky.push(await pripravit(rozdeleno[0], rozdeleno[1]));
    // Postupně, ne najednou — veřejné služby nemá smysl zahltit.
    await new Promise((r) => setTimeout(r, 300));
  }
  return vysledky;
}

/** Založí písně, které v náhledu vyšly jako OK. */
export async function zalistujAction(seznam: string): Promise<{ zalozeno: number; preskoceno: number; hlaseni: string[] }> {
  await jenSpravce();

  const radky = seznam.split('\n').map((r) => r.trim()).filter(Boolean).slice(0, 40);
  const hlaseni: string[] = [];
  let zalozeno = 0;
  let preskoceno = 0;

  for (const radek of radky) {
    const rozdeleno = rozdel(radek);
    if (!rozdeleno) { preskoceno++; hlaseni.push(`✗ ${radek}: nečitelný tvar`); continue; }

    // Náhled se dělá znovu na serveru — na to, co poslal prohlížeč, se
    // nespoléháme, mezitím se mohl katalog změnit.
    const n = await pripravit(rozdeleno[0], rozdeleno[1]);
    if (n.stav !== 'OK') { preskoceno++; hlaseni.push(`✗ ${n.zadano}: ${n.zprava}`); continue; }

    const lr = await fetch(
      `https://lrclib.net/api/search?artist_name=${encodeURIComponent(rozdeleno[0])}&track_name=${encodeURIComponent(rozdeleno[1])}`,
      { headers: { 'User-Agent': 'Karacho/1.0' }, signal: AbortSignal.timeout(15000) },
    ).then((r) => (r.ok ? r.json() : []));

    const kandidati = (Array.isArray(lr) ? lr : []).filter((x: any) => x.syncedLyrics && x.duration);
    const med = median(kandidati.map((x: any) => x.duration));
    const serazeni = [...kandidati].sort((a: any, b: any) => Math.abs(a.duration - med) - Math.abs(b.duration - med));

    let ulozeno = false;
    for (const lrc of serazeni) {
      const data = lrcNaCasovani(lrc.syncedLyrics, lrc.duration);
      if (data.blocks.length < MIN_BLOKU) continue;

      await db.song.create({
        data: {
          title: n.title!,
          artist: n.artist!,
          lyrics: data.lyrics,
          timingData: { blocks: data.blocks, dur: data.dur, countdowns: data.countdowns },
          state: 'WAITING_AUDIO',
          animationStyle: 'karaoke-classic',
        },
      });
      zalozeno++;
      hlaseni.push(`✓ ${n.artist} – ${n.title} (${data.blocks.length} bloků)`);
      ulozeno = true;
      break;
    }
    if (!ulozeno) { preskoceno++; hlaseni.push(`✗ ${n.zadano}: časování se nepodařilo sestavit`); }

    await new Promise((r) => setTimeout(r, 300));
  }

  revalidatePath('/admin');
  return { zalozeno, preskoceno, hlaseni };
}

/**
 * Návrhy, co zalistovat — podněty k shánění nahrávek.
 *
 * Bere osvědčené karaoke playlisty (editorské, ne náhodné) a projede je
 * proti katalogu a proti LRCLIB. Vrátí jen to, co ještě nemáme A zároveň
 * k tomu existuje časování — návrh, ke kterému se stejně nedá nic udělat,
 * je jen šum.
 */
const ZDROJE_NAVRHU: Record<string, { popis: string; playlisty?: string[]; zebricek?: boolean }> = {
  KARAOKE: { popis: 'Karaoke klasika', playlisty: ['7280809544', '12153922511'] },
  ZEBRICEK: { popis: 'Nejhranější teď', zebricek: true },
};

export async function navrhniPisneAction(zdroj: string, limit = 25): Promise<{ radky: string[]; prohledano: number; popis: string }> {
  await jenSpravce();

  const nastaveni = ZDROJE_NAVRHU[zdroj] ?? ZDROJE_NAVRHU.KARAOKE;
  const stopy: any[] = [];

  if (nastaveni.zebricek) {
    const d = await fetch('https://api.deezer.com/chart/0/tracks?limit=100', { signal: AbortSignal.timeout(15000) })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null);
    stopy.push(...(d?.data || []));
  }
  for (const id of nastaveni.playlisty || []) {
    const d = await fetch(`https://api.deezer.com/playlist/${id}/tracks?limit=100`, { signal: AbortSignal.timeout(15000) })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null);
    stopy.push(...(d?.data || []));
  }

  // Zamícháme, ať návrhy nejsou pokaždé tytéž od začátku seznamu.
  const poradi = stopy
    .map((s, i) => ({ s, k: (i * 2654435761) % 4294967296 }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.s);

  const radky: string[] = [];
  let prohledano = 0;

  for (const stopa of poradi) {
    if (radky.length >= limit) break;
    const artist = stopa?.artist?.name;
    const title = String(stopa?.title || '').replace(/\s*[([].*$/, '').trim();
    if (!artist || !title) continue;
    prohledano++;

    const uz = await db.song.findFirst({
      where: {
        title: { equals: title, mode: 'insensitive' },
        artist: { equals: artist, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (uz) continue;

    // Bez časování by to byl jen seznam přání, ne podnět k práci.
    const maCasovani = await fetch(
      `https://lrclib.net/api/search?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`,
      { headers: { 'User-Agent': 'Karacho/1.0' }, signal: AbortSignal.timeout(12000) },
    ).then((r) => (r.ok ? r.json() : [])).then(
      (d: any) => Array.isArray(d) && d.some((x: any) => x.syncedLyrics),
    ).catch(() => false);

    if (maCasovani) radky.push(`${artist} - ${title}`);
    await new Promise((r) => setTimeout(r, 250));
  }

  return { radky, prohledano, popis: nastaveni.popis };
}
