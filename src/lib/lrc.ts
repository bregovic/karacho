/**
 * Převod synchronizovaného textu (LRC) na naše časování.
 *
 * LRC drží jen začátky řádků. Konec se odvodí z dalšího záznamu, ale omezí
 * se na dobu, za kterou se text dá reálně vyzpívat — jinak by se poslední
 * řádek před sólem táhl přes celý instrumentální předěl. Prázdné řádky
 * s časem jsou v LRC právě takové předěly a slouží jako přirozená hranice.
 *
 * Časy jednotlivých slov v LRC nejsou. Rozprostírají se v řádku rovnoměrně:
 * řádek jako celek sedí, rychlá slabika bude trochu mimo a doladí se ve
 * Studiu klávesou W.
 */

/** Kolik znaků textu se vyzpívá za vteřinu při běžném tempu. */
const ZNAKU_ZA_SEKUNDU = 9.1;
/**
 * Do téhle mezery se bere, že se celou dobu zpívá — jen pomalu nebo taženě.
 * Delší už znamená instrumentální předěl a řádek se osekne na odhad.
 *
 * Bez tohohle rozlišení se u refrénů výplň zastavila v půlce. „Take on me
 * (take on me)" má 23 znaků, odhad tedy 2,5 s — jenže v písni se ta věta
 * táhne 5,6 s a zbylé tři vteřiny řádek jen stál. Naopak „In a day or two"
 * před sólem má mezeru 45,9 s a tam se osekat musí, jinak by se výplň
 * plazila přes celý mezihru.
 */
const STROP_SOUVISLEHO_ZPEVU = 10;
/** Pauza, po které má smysl ukázat odpočet, ať zpěvák pozná nástup. */
const MEZERA_PRO_ODPOCET = 5;
/** Míň bloků než tohle znamená vadný nebo prázdný soubor. */
export const MIN_BLOKU = 5;

export type LrcZaznam = { cas: number; text: string };

export function parsujLrc(lrc: string): LrcZaznam[] {
  const zaznamy: LrcZaznam[] = [];
  for (const radek of (lrc || '').split('\n')) {
    // [mm:ss.xx] text — metadatové značky ([ar:], [ti:]) sem nespadnou,
    // protože po dvojtečce nemají číslice.
    const m = radek.match(/^\[(\d+):(\d+)(?:[.:](\d+))?\](.*)$/);
    if (!m) continue;
    const setiny = m[3] ? Number(`0.${m[3]}`) : 0;
    zaznamy.push({ cas: Number(m[1]) * 60 + Number(m[2]) + setiny, text: m[4].trim() });
  }
  return zaznamy.sort((a, b) => a.cas - b.cas);
}

export type PrevedeneCasovani = {
  blocks: { li: number; lw: string[]; bs: number; be: number; v: number; w: { t: number; i: number; v: number }[] }[];
  dur: number;
  countdowns: number[];
  lyrics: string;
};

export function lrcNaCasovani(lrc: string, delka: number): PrevedeneCasovani {
  const zaznamy = parsujLrc(lrc);
  const blocks: PrevedeneCasovani['blocks'] = [];
  const countdowns: number[] = [];
  const radky: string[] = [];
  let li = 0;

  for (let i = 0; i < zaznamy.length; i++) {
    const z = zaznamy[i];
    if (!z.text) continue;

    const dalsi = zaznamy[i + 1]?.cas ?? delka;
    const mezera = dalsi - z.cas;
    const odhad = Math.max(1.2, z.text.length / ZNAKU_ZA_SEKUNDU);
    // Do deseti vteřin věříme, že se pořád zpívá; nad to už je to předěl.
    const zpev = mezera <= STROP_SOUVISLEHO_ZPEVU ? mezera : odhad;

    const slova = z.text.split(/\s+/).filter(Boolean);
    if (!slova.length) continue;

    // Čas se dělí podle délky slov, ne rovným dílem. „Take on me (take on
    // me)" má slova od dvou do pěti znaků a rovnoměrné dělení nechávalo
    // krátká slova svítit stejně dlouho jako dlouhá.
    const znakuCelkem = slova.reduce((a, s) => a + s.length, 0);
    const zacatky: number[] = [];
    let uplynulo = 0;
    for (const slovo of slova) {
      zacatky.push(z.cas + uplynulo);
      uplynulo += (slovo.length / znakuCelkem) * zpev;
    }

    const predchozi = blocks[blocks.length - 1];
    if ((predchozi ? z.cas - predchozi.be : z.cas) >= MEZERA_PRO_ODPOCET) {
      countdowns.push(Number(z.cas.toFixed(2)));
    }

    blocks.push({
      li,
      lw: slova,
      bs: Number(z.cas.toFixed(2)),
      be: Number((z.cas + zpev).toFixed(2)),
      v: 3,
      w: slova.map((_, idx) => ({ t: Number(zacatky[idx].toFixed(2)), i: idx, v: 3 })),
    });
    radky.push(z.text);
    li++;
  }

  return { blocks, dur: delka, countdowns, lyrics: radky.join('\n') };
}
