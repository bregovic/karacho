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

/** Kolik znaků textu se vyzpívá za vteřinu. Odvozeno z reálných LRC. */
const ZNAKU_ZA_SEKUNDU = 9.1;
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
    const zpev = Math.min(dalsi - z.cas, Math.max(1.2, z.text.length / ZNAKU_ZA_SEKUNDU));
    const slova = z.text.split(/\s+/).filter(Boolean);
    if (!slova.length) continue;
    const naSlovo = zpev / slova.length;

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
      w: slova.map((_, idx) => ({ t: Number((z.cas + idx * naSlovo).toFixed(2)), i: idx, v: 3 })),
    });
    radky.push(z.text);
    li++;
  }

  return { blocks, dur: delka, countdowns, lyrics: radky.join('\n') };
}
