const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const songs = await prisma.song.findMany({ select: { title: true, audioUrl: true, instrumentalUrl: true }, orderBy: { updatedAt: 'desc' }, take: 10 });
  console.log('LATEST 10 SONGS:');
  songs.forEach(s => console.log(s.title, '\n  A:', s.audioUrl, '\n  I:', s.instrumentalUrl));
}
run().finally(() => prisma.$disconnect());
