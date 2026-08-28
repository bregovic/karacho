/**
 * Párování nahrávaných souborů na písně, které už v katalogu jsou.
 *
 * Název souboru se nikdy netrefí do databáze přesně: „01_Hana Zagorová -
 * Černý páv (official video).mp3" má sednout na přání zapsané ručně jako
 * „Hana Zagorová" / „Černý páv". Porovnává se proto otisk názvu — bez
 * pořadového čísla, bez youtubového plevele, bez značek instrumentálky,
 * bez diakritiky a bez všeho, co není písmeno nebo číslice.
 *
 * Diakritika se shazuje přes NFD stejně jako ve vyhledávání (`hledani.ts`),
 * ne zahozením znaků. Dřívější `replace(/[^a-z0-9]/gi, '')` udělalo ze
 * „Zagorová" otisk „zagorov", zatímco ze souboru „Zagorova" vyšlo
 * „zagorova" — česká jména se nespárovala nikdy.
 */

import { bezDiakritiky } from './hledani';

/** Pořadové číslo na začátku názvu: `1_`, `01.`, `07 - ` */
const PORADI = /^[0-9]+[._\s-]+/;

/** Plevel v závorkách: `(Official Video)`, `[HD]`, `(karaoke)` */
const PLEVEL_V_ZAVORCE =
  /[([]\s*[^\])]*(official|video|lyrics?|audio|hd|4k|hq|remaster(ed)?|live|feat\.|ft\.|karaoke|instrumental|instr|playback|backing\s*track|vhs|retro|píseň|pieseň|wmv|mp4|avi|mpg|mpeg)[^\])]*\s*[)\]]/gi;

/** Plevel na konci názvu za pomlčkou nebo svislítkem */
const PLEVEL_NA_KONCI =
  /[-–—|]\s*(official|video|lyrics?|audio|hd|4k|hq|remaster(ed)?|live|karaoke|instrumental|instr|playback|backing\s*track|wmv|mp4|avi|mpg|mpeg)\s*$/gi;

/** Značky druhé stopy kdekoli v názvu — jinak by se instrumentálka nespárovala s originálem */
const ZNACKY_STOPY = /instrumental(ka|ky|)|instr\b|karaoke|playback|backing\s*track/gi;

/**
 * Hostující interpret na konci názvu: „Polety ft. Sebastian".
 *
 * Do přání to host napíše jako interpreta („ATMO Music & Sebastian" /
 * „Polety"), na YouTube to visí v názvu písně. Bez odstranění se tyhle dvě
 * podoby nepotkaly a import založil druhý záznam vedle přání.
 */
const HOSTUJICI = /\s*[([]?\s*(feat\.?|ft\.?|featuring|with)\s+[^)\]]*[)\]]?\s*$/i;

/** Přípona souboru */
const PRIPONA = /\.[a-z0-9]{2,4}$/i;

/**
 * Otisk jednoho názvu (interpret nebo píseň) pro porovnávání.
 * Vrací jen malá písmena bez diakritiky a číslice.
 */
export function otiskNazvu(text: string | null | undefined): string {
  if (!text) return '';
  let s = text.replace(PRIPONA, '');
  s = s.replace(PORADI, '');
  s = s.replace(PLEVEL_V_ZAVORCE, '');
  s = s.replace(PLEVEL_NA_KONCI, '');
  s = s.replace(ZNACKY_STOPY, '');
  s = s.replace(HOSTUJICI, '');
  return bezDiakritiky(s).replace(/[^a-z0-9]/g, '');
}

/** Interpret, kterého import nepoznal z názvu souboru. */
const NEZNAMY = otiskNazvu('Neznámý');

/** Nemá smysl porovnávat — interpreta neznáme z jedné nebo druhé strany. */
export function interpretNeznamy(otisk: string): boolean {
  return !otisk || otisk === NEZNAMY;
}

/**
 * Jak jistá je shoda interpretů. Nižší číslo = jistější.
 *
 * `null` znamená „tohle nejsou tíž lidé". Neznámý interpret shodu nevylučuje
 * (import ho z názvu souboru často nevyčte), ale je to nejslabší úroveň —
 * volající se podle ní rozhoduje, jestli si troufne přepsat existující záznam.
 */
export function shodaInterpretu(a: string, b: string): 0 | 1 | 2 | null {
  if (a && a === b) return 0;
  if (interpretNeznamy(a) || interpretNeznamy(b)) return 2;
  if (a.includes(b) || b.includes(a)) return 1;
  return null;
}

export interface KandidatParovani {
  title: string | null;
  artist: string | null;
  importName?: string | null;
}

/**
 * Sedí kandidát z databáze na nahrávaný soubor?
 *
 * Vrací sílu shody (0 = nejjistější) nebo `null`. Název písně musí sedět
 * vždy přesně, na interpretovi se dá slevit.
 */
export function silaShody(
  kandidat: KandidatParovani,
  title: string,
  artist: string,
  rawFilename?: string | null,
): 0 | 1 | 2 | null {
  // Původní název souboru je nejjistější vodítko: originál i instrumentálka
  // se stahují ze stejného zdroje, takže se jejich názvy liší jen značkou
  // stopy — a tu otisk zahazuje.
  if (rawFilename && kandidat.importName && otiskNazvu(kandidat.importName) === otiskNazvu(rawFilename)) {
    return 0;
  }

  const otiskTitulu = otiskNazvu(title);
  if (!otiskTitulu || otiskNazvu(kandidat.title) !== otiskTitulu) return null;

  return shodaInterpretu(otiskNazvu(kandidat.artist), otiskNazvu(artist));
}
