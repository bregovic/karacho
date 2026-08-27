import { lrcNaCasovani, MIN_BLOKU, type PrevedeneCasovani } from '@/lib/lrc';

/**
 * Dohledání hotového časování v otevřené databázi LRCLIB.
 *
 * Používá to import i research, aby se u písně nemuselo klíčovat od nuly.
 * Rozhoduje délka: LRCLIB vrací ke známým písním klidně dvacet verzí a
 * mezi nimi jsou živáky i remixy, jejichž časy by na naši nahrávku seděly
 * úplně mimo. Bere se proto ta, která délkou odpovídá NAŠEMU souboru, a
 * když se ani nejbližší netrefí do tolerance, nevrací se nic — špatné
 * časování je horší než žádné, protože si ho nikdo nevšimne.
 */

/** O kolik vteřin se smí délka lišit, aby šlo o tutéž nahrávku. */
export const TOLERANCE_DELKY = 5;
/** O kolik smí poslední zpívaný řádek přetéct za konec nahrávky. */
const PRETECENI_KONCE = 3;
/** Kolik z nahrávky musí být pokryto zpěvem, aby text nebyl jen útržek. */
const MIN_POKRYTI = 0.25;

/** Proč se nalezené časování nedá použít. */
export type DuvodOdmitnuti =
  | 'delka'        // celková stopáž se rozchází
  | 'presah'       // text končí až za koncem nahrávky
  | 'utrzek'       // zpěv pokrývá jen zlomek stopy
  | 'malo-bloku';  // vadný nebo prázdný soubor

/**
 * Má nalezené časování šanci sedět na naši nahrávku?
 *
 * Shoda celkové stopáže sama nestačí. Chytá se proto ještě, jestli se
 * poslední zpívaný řádek do nahrávky vůbec vejde a jestli zpěv pokrývá
 * rozumnou část stopy — útržkovité LRC (jen refrén, jen první sloka) má
 * délku správně, ale k ničemu není.
 */
export function posudCasovani(
  prevedene: PrevedeneCasovani,
  cilovaDelka: number,
  rozdilDelek: number,
  tolerance = TOLERANCE_DELKY,
): DuvodOdmitnuti | null {
  if (rozdilDelek > tolerance) return 'delka';
  if (prevedene.blocks.length < MIN_BLOKU) return 'malo-bloku';

  const konec = prevedene.blocks[prevedene.blocks.length - 1].be;
  if (konec > cilovaDelka + PRETECENI_KONCE) return 'presah';

  const zpivano = prevedene.blocks.reduce((a, b) => a + (b.be - b.bs), 0);
  if (zpivano < cilovaDelka * MIN_POKRYTI) return 'utrzek';

  return null;
}

export type NalezeneCasovani = PrevedeneCasovani & {
  lrcDelka: number;
  rozdil: number;
  zdrojNazev: string;
};

export async function najdiCasovani(
  artist: string,
  title: string,
  cilovaDelka: number,
  tolerance = TOLERANCE_DELKY,
): Promise<NalezeneCasovani | null> {
  if (!artist || !title || !cilovaDelka) return null;

  let kandidati: any[] = [];
  try {
    const res = await fetch(
      `https://lrclib.net/api/search?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`,
      { headers: { 'User-Agent': 'Karacho/1.0' }, signal: AbortSignal.timeout(12000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    kandidati = (Array.isArray(data) ? data : []).filter((x: any) => x.syncedLyrics && x.duration);
  } catch {
    return null;
  }
  if (!kandidati.length) return null;

  // Od nejbližší délky. Vadné soubory (míň než pár bloků) se přeskakují —
  // stává se, že první verze je prázdná a použitelná je až třetí.
  const serazeni = [...kandidati].sort(
    (a, b) => Math.abs(a.duration - cilovaDelka) - Math.abs(b.duration - cilovaDelka),
  );

  for (const lrc of serazeni) {
    const rozdil = Math.abs(lrc.duration - cilovaDelka);
    if (rozdil > tolerance) break; // dál už jsou jen vzdálenější

    const prevedene = lrcNaCasovani(lrc.syncedLyrics, lrc.duration);
    const problem = posudCasovani(prevedene, cilovaDelka, rozdil, tolerance);
    if (problem) continue;

    return {
      ...prevedene,
      lrcDelka: lrc.duration,
      rozdil,
      zdrojNazev: `${lrc.artistName} – ${lrc.trackName}`,
    };
  }
  return null;
}

/** Délka nahrávky odhadnutá z velikosti MP3 (komprimuje se na 128 kb/s). */
export function delkaZVelikosti(audioSize?: number | null): number {
  return audioSize ? (audioSize * 8) / 128_000 : 0;
}
