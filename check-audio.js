const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const songs = await prisma.song.findMany({ select: { id: true, title: true, audioUrl: true, instrumentalUrl: true } });
  console.log(songs.filter(s => s.audioUrl && s.instrumentalUrl).slice(0, 5));
}
run().finally(() => prisma.$disconnect());
