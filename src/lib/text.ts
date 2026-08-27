/**
 * Úpravy textu písně pro Studio.
 *
 * Texty chodí ze scraperů v dost různé kvalitě — chybí mezery za čárkami
 * a řádky občas začínají interpunkcí nebo odsazením. Obojí pak rozhodí
 * zalamování: „ahoj,jak" je pro zalamovač jedno dlouhé slovo a řádek
 * začínající čárkou vypadá při zpívání jako chyba.
 */

/**
 * Interpunkce, kterou nemá řádek začínat.
 *
 * Tečky, vykřičníky, otazníky, výpustka ani pomlčka tu schválně NEJSOU.
 * V textech písní bývají na začátku řádku úmyslně („…a jedeme dál",
 * „..a pro všechnu tu svoloč kolem", pomlčka u dialogu) a odstranit je
 * by znamenalo přepisovat autorský záměr. Řeší se jen to, co je vždycky
 * chyba: odsazení, čárka, středník, dvojtečka a zavírací závorka.
 */
const ZAKAZANY_ZACATEK = /^[\s,;:)\]}]+/;

/**
 * Doplní mezeru za interpunkcí, když za ní rovnou pokračuje slovo.
 *
 * Čárka a středník: číslo za oddělovačem se schválně nechává být —
 * „1,5 piva" je desetinná čárka, ne chybějící mezera.
 *
 * Tečka je opatrnější, protože v textech písní skoro nikdy neznamená konec
 * věty. Z 65 případů „tečka a hned velké písmeno" v katalogu je většina
 * zkratek — M.A.S.H., K.O., Y.M.C.A., a.k.a. — a těm mezera uvnitř
 * nepatří. Mezera se proto vkládá jen když jsou před tečkou aspoň dvě
 * písmena (zkratky mají jedno) a hned za ní velké písmeno. Malé písmeno
 * za tečkou je v katalogu buď výpustka („…a jedeme dál"), nebo překlep
 * („naje.eš"), kde by mezera situaci jen zhoršila.
 *
 * Použit `(\p{L}\p{L})` místo pohledu dozadu schválně: lookbehind umí
 * Safari až od 16.4 a starší tablet by na něm shodil celý modul.
 */
export function doplnMezeryZaInterpunkci(text: string): string {
  let t = text.replace(/([,;])(?=\p{L})/gu, '$1 ');
  t = t.replace(/(\p{L}\p{L})\.(?=\p{Lu})/gu, '$1. ');
  return t;
}

/**
 * Zajistí, že žádný řádek nezačíná mezerou ani interpunkcí.
 *
 * Interpunkce se nezahazuje — přesune se na konec předchozího neprázdného
 * řádku, kam patří. Když žádný předchozí není (je to první řádek textu),
 * odpadne.
 */
export function opravZacatkyRadku(text: string): string {
  const vysledek: string[] = [];

  for (const puvodni of text.split('\n')) {
    let radek = puvodni.trimStart();
    const shoda = radek.match(ZAKAZANY_ZACATEK);

    if (shoda) {
      const interpunkce = shoda[0].replace(/\s+/g, '');
      if (interpunkce) {
        // Ručně, ne `findLastIndex` — Studio jede i na starších tabletech
        // v baru a ta metoda je až od Safari 15.4.
        for (let i = vysledek.length - 1; i >= 0; i--) {
          if (vysledek[i].trim().length > 0) {
            vysledek[i] = vysledek[i].trimEnd() + interpunkce;
            break;
          }
        }
      }
      radek = radek.slice(shoda[0].length).trimStart();
    }

    vysledek.push(radek.trimEnd());
  }

  return vysledek.join('\n');
}
