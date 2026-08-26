/**
 * Porovnávání textu pro vyhledávání v katalogu.
 *
 * Na tabletu za barem nikdo nepřepíná klávesnici kvůli háčkům — „strasti"
 * musí najít „Strašti" a „cerny" i „Černý". Diakritika se proto před
 * porovnáním shodí přes NFD (rozklad na písmeno + znaménko) a znaménka se
 * zahodí. Českému ch/ř/ž se tím nic nestane, jen ztratí háček.
 */
const ZNAMENKA = /[̀-ͯ]/g;

export function bezDiakritiky(text: string | null | undefined): string {
  return (text || '').normalize('NFD').replace(ZNAMENKA, '').toLowerCase();
}

/** Obsahuje `text` hledaný výraz, bez ohledu na háčky, čárky a velikost písmen? */
export function obsahuje(text: string | null | undefined, dotaz: string): boolean {
  return bezDiakritiky(text).includes(bezDiakritiky(dotaz));
}
