import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanup() {
  console.log("🚀 Zahajuji čištění duplicitních písní...");

  // 1. Najít všechny duplicity (stejný interpret + název)
  const songs = await prisma.song.findMany({
    select: {
      id: true,
      title: true,
      artist: true,
      timingData: true,
      createdAt: true
    }
  });

  const seen = new Map<string, any[]>();

  songs.forEach(s => {
    const key = `${(s.artist || '').trim().toLowerCase()}|${(s.title || '').trim().toLowerCase()}`;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key)!.push(s);
  });

  let deletedCount = 0;

  for (const [key, group] of seen.entries()) {
    if (group.length > 1) {
      console.log(`\n🔍 Nalezena duplicita: ${key} (${group.length}x)`);
      
      // Seřadíme: Nejdřív ty, co mají timingData, pak podle data vytvoření (novější první)
      group.sort((a, b) => {
        const aHasTiming = !!a.timingData ? 1 : 0;
        const bHasTiming = !!b.timingData ? 1 : 0;
        if (aHasTiming !== bHasTiming) return bHasTiming - aHasTiming;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      const [keep, ...toDelete] = group;
      console.log(`✅ Ponechávám: ${keep.id} (${keep.createdAt}) ${!!keep.timingData ? '[Obsahuje časování]' : ''}`);

      for (const d of toDelete) {
        console.log(`❌ Mažu: ${d.id} (${d.createdAt})`);
        await prisma.song.delete({ where: { id: d.id } });
        deletedCount++;
      }
    }
  }

  console.log(`\n✨ Hotovo! Smazáno ${deletedCount} duplicit.`);
}

cleanup()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
