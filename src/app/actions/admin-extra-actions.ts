'use server';

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { cleanupStaleSessions } from '@/app/actions/session-actions';

export async function logAdminAction(action: string, description?: string, targetType?: string, targetId?: string) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') return;

  await db.adminAction.create({
    data: {
      adminId: session.user.id,
      action,
      description,
      targetType,
      targetId
    }
  });
}

export async function getAdminAuditLog() {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('Nemáte oprávnění');

  return await db.adminAction.findMany({
    include: { admin: true },
    orderBy: { createdAt: 'desc' },
    take: 100
  });
}

export async function updateTechnicalConfig(key: string, value: string, category: string = 'GENERAL') {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('Nemáte oprávnění');

  await db.technicalConfig.upsert({
    where: { key },
    update: { value, category },
    create: { key, value, category }
  });

  revalidatePath('/admin/tech');
  return { success: true };
}

export async function getTechnicalConfig(category?: string) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('Nemáte oprávnění');

  return await db.technicalConfig.findMany({
    where: category ? { category } : undefined,
    orderBy: { key: 'asc' }
  });
}

// checkAdminPassword() odstraněna – heslo bylo natvrdo v kódu ve veřejném repu,
// takže nic nechránilo. Přístup do /admin/tech hlídá middleware podle role ADMIN.

/**
 * Přehled využití pro sekci Technická konfigurace.
 *
 * Pozor na dvojí měření přehrání – obě čísla jsou správná, ale neznamenají totéž:
 *  - `prehraniCelkem` je součet `Song.playCount`, počítá se **i hostům** bez přihlášení,
 *  - `zpevyCelkem` je `SingingHistory`, tedy jen přehrání s **známým zpěvákem**.
 * Rozdíl mezi nimi = kolik se toho odzpívalo bez přihlášení.
 */
export async function getUsageStats() {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('Nemáte oprávnění');

  const ted = Date.now();
  const pred = (dni: number) => new Date(ted - dni * 24 * 3600 * 1000);
  const zivaHranice = new Date(ted - 24 * 3600 * 1000);

  const [
    pisneCelkem, pisneActive, pisneSCasovanim,
    uzivatele, adminu,
    relaceCelkem, relaceZive,
    zpevyCelkem, zpevy7, zpevy30,
    soucet, topPisne, adminAkci,
  ] = await Promise.all([
    db.song.count(),
    db.song.count({ where: { state: 'ACTIVE' } }),
    // Json sloupec: prázdno se filtruje přes Prisma.DbNull, ne přes null.
    db.song.count({ where: { timingData: { not: Prisma.DbNull } } }),
    db.user.count(),
    db.user.count({ where: { role: 'ADMIN' } }),
    db.karaokeSession.count(),
    db.karaokeSession.count({ where: { updatedAt: { gte: zivaHranice } } }),
    db.singingHistory.count(),
    db.singingHistory.count({ where: { createdAt: { gte: pred(7) } } }),
    db.singingHistory.count({ where: { createdAt: { gte: pred(30) } } }),
    db.song.aggregate({ _sum: { playCount: true } }),
    db.song.findMany({
      where: { playCount: { gt: 0 } },
      orderBy: { playCount: 'desc' },
      take: 5,
      select: { title: true, artist: true, playCount: true },
    }),
    db.adminAction.count(),
  ]);

  return {
    pisneCelkem, pisneActive, pisneSCasovanim,
    uzivatele, adminu,
    relaceCelkem, relaceZive,
    zpevyCelkem, zpevy7, zpevy30,
    prehraniCelkem: soucet._sum.playCount ?? 0,
    topPisne,
    adminAkci,
  };
}

/** Ruční úklid relací starších 24 h (jinak běží sám při připojování). */
export async function cleanupSessionsAction() {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('Nemáte oprávnění');
  const smazano = await cleanupStaleSessions();
  return { smazano };
}
