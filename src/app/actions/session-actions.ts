'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

// Funkce pro náhodný 4-místný kód (např. K4CH)
function generateCode() {
  let res = '';
  for (let i = 0; i < 5; i++) res += Math.floor(Math.random() * 10).toString();
  return res;
}

// 📺 Vytvoří nebo se připojí k relaci
export async function joinOrCreateSession(code?: string) {
  if (code) {
    const s = await db.karaokeSession.findUnique({
      where: { joinCode: code.toUpperCase() },
      include: { queue: true, currentSong: true }
    });
    if (s && s.isActive) return s;
  }

  // Vytvoříme novou
  let newCode = generateCode();
  // Pojistka proti duplicitě (teoretická)
  while (await db.karaokeSession.findUnique({ where: { joinCode: newCode } })) {
    newCode = generateCode();
  }

  const session = await db.karaokeSession.create({
    data: {
      joinCode: newCode,
      status: 'STOPPED'
    },
    include: { queue: true, currentSong: true }
  });

  return session;
}

// 📱 Synchronizační příkaz (TV se tímhle doptává, Mobil tím posílá změny)
export async function getSessionStatus(code: string) {
  return await db.karaokeSession.findUnique({
    where: { joinCode: code.toUpperCase() },
    include: { 
      queue: { 
        include: { song: true },
        orderBy: { order: 'asc' } 
      }, 
      currentSong: true 
    }
  });
}

// 🎮 Dálkový ovladač: Zastavit / Pustit / Další
export async function updateSessionState(code: string, data: any) {
  const session = await db.karaokeSession.update({
    where: { joinCode: code.toUpperCase() },
    data: {
       status: data.status,
       currentSongId: data.currentSongId,
       currentTime: data.currentTime,
       updatedAt: new Date()
    }
  });
  revalidatePath('/'); // Refresh cache
  return session;
}

// ➕ Přidání do fronty relace přes mobil
export async function addToSessionQueue(code: string, songId: string) {
  const s = await db.karaokeSession.findUnique({ where: { joinCode: code } });
  if (!s) return;

  // Pokud nic nehraje (první song), nastavíme ho jako aktuální v režimu pauzy
  if (!s.currentSongId) {
    await db.karaokeSession.update({
      where: { id: s.id },
      data: { 
        currentSongId: songId,
        status: 'PAUSED'
      }
    });
  } else {
    // Jinak klasicky do fronty
    const last = await db.karaokeSessionQueue.findFirst({
      where: { sessionId: s.id },
      orderBy: { order: 'desc' }
    });
    const nextOrder = (last?.order || 0) + 1;
    await db.karaokeSessionQueue.create({
      data: { sessionId: s.id, songId, order: nextOrder }
    });
  }
  revalidatePath('/');
}

// ❌ Smazání songu z fronty relace
export async function removeFromSessionQueue(code: string, queueItemId: string) {
  await db.karaokeSessionQueue.delete({
    where: { id: queueItemId }
  });
  revalidatePath('/');
}

// ⏭️ Další z fronty relace
export async function advanceSessionQueue(code: string) {
  const s = await db.karaokeSession.findUnique({ 
    where: { joinCode: code.toUpperCase() }, 
    include: { queue: { orderBy: { order: 'asc' } } } 
  });
  if (!s || s.queue.length === 0) {
    // Pokud fronta skončí, zastavíme
    return await db.karaokeSession.update({ where: { id: s?.id }, data: { status: 'STOPPED', currentSongId: null } });
  }

  const next = s.queue[0];
  
  // Odstraníme z fronty a nastavíme jako aktuální
  await db.karaokeSessionQueue.delete({ where: { id: next.id } });
  
  return await db.karaokeSession.update({
    where: { id: s.id },
    data: {
      currentSongId: next.songId,
      status: 'PLAYING',
      updatedAt: new Date()
    }
  });
}
