'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * `useState`, který si hodnotu pamatuje mezi návštěvami (localStorage).
 *
 * Používá se na filtry v katalogu a v administraci — člověk si nastaví
 * „chybí časování, od nejkratší", odejde píseň zpracovat a po návratu
 * čekal, že to tam bude pořád.
 *
 * Čte se až v efektu po prvním vykreslení, ne při inicializaci stavu.
 * Server localStorage nemá, takže by se první render lišil od serverového
 * a React by ohlásil neshodu hydratace.
 */
export function useUlozenyStav<T>(klic: string, vychozi: T) {
  const [hodnota, setHodnota] = useState<T>(vychozi);
  const nacteno = useRef(false);

  useEffect(() => {
    try {
      const ulozene = localStorage.getItem(klic);
      if (ulozene !== null) setHodnota(JSON.parse(ulozene) as T);
    } catch {
      // Poškozená hodnota nebo zakázané úložiště (anonymní okno) — zůstane výchozí.
    }
    nacteno.current = true;
  }, [klic]);

  useEffect(() => {
    // Zápis až po načtení, jinak by první render přepsal uloženou hodnotu
    // tou výchozí dřív, než se stihne přečíst.
    if (!nacteno.current) return;
    try {
      localStorage.setItem(klic, JSON.stringify(hodnota));
    } catch {
      // Plné nebo zakázané úložiště nesmí shodit filtrování.
    }
  }, [klic, hodnota]);

  return [hodnota, setHodnota] as const;
}
