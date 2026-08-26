'use server';

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { uklidStareRelace } from '@/lib/relace';

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
  const smazano = await uklidStareRelace();
  return { smazano };
}

/**
 * Osiřelé soubory v R2 — nahrálo se, ale nakonec se to k ničemu nepřipojilo.
 *
 * Pojistky, na kterých tahle funkce stojí a které se nesmí zrušit:
 *
 *  1. Bucket `karacho` NENÍ jenom Karacha. Pod prefixem `questea/` v něm
 *     bydlí jiná aplikace. Bereme proto výhradně klíče BEZ lomítka —
 *     Karacho ukládá do kořene. Jinak by úklid smazal cizí fotky.
 *  2. Kontroluje se i `User.image`, ne jenom písně — avatary leží ve
 *     stejném bucketu a při prvním pokusu o úklid málem padly.
 *  3. Soubory mladší než hodinu se nechávají být. Může zrovna běžet import,
 *     kde je soubor nahraný a píseň se ještě nezaložila.
 */
const HODINA = 60 * 60 * 1000;

async function pouziteKlice(): Promise<Set<string>> {
  const klice = new Set<string>();
  const pridej = (url: string | null) => {
    if (!url) return;
    const k = decodeURIComponent(url.split('/').pop()!.split('?')[0]);
    if (k) klice.add(k);
  };

  const songs = await db.song.findMany({
    select: { audioUrl: true, instrumentalUrl: true, backgroundUrl: true, jsonUrl: true },
  });
  songs.forEach((s) => {
    pridej(s.audioUrl);
    pridej(s.instrumentalUrl);
    pridej(s.backgroundUrl);
    pridej(s.jsonUrl);
  });

  (await db.track.findMany({ select: { url: true } })).forEach((t) => pridej(t.url));
  (await db.user.findMany({ select: { image: true } })).forEach((u) => pridej(u.image));

  return klice;
}

async function najdiOsirele() {
  const { r2, BUCKET_NAME } = await import('@/lib/r2');
  const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');

  const pouzite = await pouziteKlice();
  const osirele: { key: string; size: number; kdy: Date }[] = [];
  let token: string | undefined;

  do {
    const r: any = await r2.send(new ListObjectsV2Command({ Bucket: BUCKET_NAME, ContinuationToken: token }));
    for (const o of r.Contents || []) {
      const key: string = o.Key;
      if (!key || key.includes('/')) continue;                   // pojistka 1
      if (pouzite.has(key)) continue;                            // pojistka 2
      if (Date.now() - new Date(o.LastModified).getTime() < HODINA) continue; // pojistka 3
      osirele.push({ key, size: o.Size, kdy: o.LastModified });
    }
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);

  return osirele;
}

/** Přehled, kolik by se uklidilo. Nic nemaže. */
export async function najdiOsireleSouboryAction() {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('Nemáte oprávnění');

  const osirele = await najdiOsirele();
  return {
    pocet: osirele.length,
    bajtu: osirele.reduce((a, o) => a + o.size, 0),
    ukazka: osirele.sort((a, b) => b.size - a.size).slice(0, 20).map((o) => o.key),
  };
}

/** Smaže osiřelé soubory. Seznam se sestavuje znovu, ne z klientu. */
export async function smazOsireleSouboryAction() {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('Nemáte oprávnění');

  const { r2, BUCKET_NAME } = await import('@/lib/r2');
  const { DeleteObjectsCommand } = await import('@aws-sdk/client-s3');

  const osirele = await najdiOsirele();
  if (!osirele.length) return { smazano: 0, bajtu: 0 };

  let smazano = 0;
  for (let i = 0; i < osirele.length; i += 500) {
    const davka = osirele.slice(i, i + 500);
    const r: any = await r2.send(new DeleteObjectsCommand({
      Bucket: BUCKET_NAME,
      Delete: { Objects: davka.map((o) => ({ Key: o.key })) },
    }));
    smazano += (r.Deleted || []).length;
  }

  await logAdminAction('CLEANUP_R2', `Uklizeno osiřelých souborů: ${smazano}`);
  revalidatePath('/admin');
  return { smazano, bajtu: osirele.reduce((a, o) => a + o.size, 0) };
}
