import { db } from '@/lib/db';

/**
 * Relace bez aktivity déle než 24 h je mrtvá – TV ani mobil se k ní už
 * nevrátí. Maže se i s frontou (kaskáda ve schématu).
 *
 * Úklid běží líně při každém zakládání/připojení relace, takže není potřeba
 * cron. Bez něj se relace jen hromadily: každé otevření přehrávače bez kódu
 * zakládá novou (nasbíralo se jich 181, všechny „aktivní").
 *
 * Proč to bydlí tady a ne mezi akcemi: dokud to byla exportovaná funkce
 * v souboru s `'use server'`, byl to plnohodnotný server action — tedy
 * veřejný endpoint, kterým mohl kdokoli bez přihlášení smazat všechny
 * relace starší 24 h. Jako obyčejný modul se volá jen zevnitř serveru.
 */
const TTL_HODIN = 24;

export async function uklidStareRelace() {
  const hranice = new Date(Date.now() - TTL_HODIN * 3600 * 1000);
  const { count } = await db.karaokeSession.deleteMany({
    where: { updatedAt: { lt: hranice } },
  });
  return count;
}
