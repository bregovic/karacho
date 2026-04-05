const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Karacho: Synchronizace stavu písní...');
  
  // Najdeme všechny písně, které mají audio a nějaké časování
  const songsToActivate = await prisma.song.updateMany({
    where: {
      audioUrl: { not: null },
      OR: [
        { timingData: { not: null } },
        { jsonUrl: { not: null } }
      ],
      state: { not: 'ACTIVE' }
    },
    data: {
      state: 'ACTIVE'
    }
  });

  console.log(`✅ Úspěšně aktivováno ${songsToActivate.count} písní.`);
}

main()
  .catch((e) => {
    console.error('❌ Chyba při synchronizaci:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
