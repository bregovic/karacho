'use server';

import { db } from '@/lib/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';

type Druh = 'TEXT' | 'PISEN';

/** Stav, do kterého píseň spadne podle toho, co je na ní špatně. */
const STAV_PODLE_DRUHU = { TEXT: 'BAD_LYRICS', PISEN: 'BAD_SONG' } as const;

/**
 * Hlášení chyby u písně.
 *
 * Rozhodující je druh chyby — píseň se podle něj rovnou označí a zmizí
 * z katalogu (veřejný výpis bere jen ACTIVE). Popis je nepovinný: kdo
 * u mikrofonu zjistí, že text nesedí, ťukne na druh a jde zpívat dál;
 * vypisovat, co přesně je špatně, se stejně skoro nikdo neobtěžoval.
 *
 * Hlášení se ukládá i tak — kvůli historii je vidět, že píseň zlobí
 * opakovaně, a správce ho vyřídí tlačítkem „Opraveno" u písně.
 */
export async function nahlasChybu(songId: string, druh: Druh, popis?: string) {
  const text = (popis || '').trim();

  const session = await auth();

  const pisen = await db.song.findUnique({ where: { id: songId }, select: { id: true } });
  if (!pisen) return { ok: false as const, error: 'Píseň neexistuje.' };

  await db.songReport.create({
    data: {
      songId,
      userId: session?.user?.id ?? null,
      druh,
      popis: text.slice(0, 1000),
    },
  });

  await db.song.update({ where: { id: songId }, data: { state: STAV_PODLE_DRUHU[druh] } });

  revalidatePath('/admin');
  revalidatePath('/');
  return { ok: true as const, oznaceno: true };
}

/** Nevyřízená hlášení pro administraci, nejnovější první. */
export async function nactiHlaseni(iVyresena = false) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') return [];

  return db.songReport.findMany({
    where: iVyresena ? {} : { vyreseno: false },
    include: { song: { select: { id: true, title: true, artist: true, state: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

/**
 * Vyřízení hlášení správcem.
 *
 * `stahnout` = píseň zmizí z katalogu (stav podle druhu chyby),
 * `ponechat` = hlášení se jen odškrtne a píseň hraje dál.
 */
export async function vyresHlaseni(reportId: string, akce: 'stahnout' | 'ponechat') {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') return { ok: false as const, error: 'Jen pro správce.' };

  const hlaseni = await db.songReport.findUnique({ where: { id: reportId } });
  if (!hlaseni) return { ok: false as const, error: 'Hlášení nenalezeno.' };

  if (akce === 'stahnout') {
    await db.song.update({
      where: { id: hlaseni.songId },
      data: { state: STAV_PODLE_DRUHU[hlaseni.druh as Druh] },
    });
  }

  await db.songReport.update({ where: { id: reportId }, data: { vyreseno: true } });

  revalidatePath('/admin');
  revalidatePath('/');
  return { ok: true as const };
}

/**
 * Píseň je opravená: odškrtnou se všechna její otevřená hlášení a vrátí se
 * mezi publikované. Hlášení samotná v tabulce zůstávají kvůli historii.
 */
export async function vratMeziPublikovane(songId: string) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') return { ok: false as const, error: 'Jen pro správce.' };

  await db.songReport.updateMany({ where: { songId, vyreseno: false }, data: { vyreseno: true } });
  await db.song.update({ where: { id: songId }, data: { state: 'ACTIVE' } });

  revalidatePath('/admin');
  revalidatePath('/');
  return { ok: true as const };
}
