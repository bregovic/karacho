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
      include: { 
        currentSong: true,
        queue: { 
          include: { song: true }, 
          orderBy: { order: 'asc' } 
        } as any
      }
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
    include: { 
      currentSong: true,
      queue: { include: { song: true }, orderBy: { order: 'asc' } }
    }
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
  const updateData: any = {
    status: data.status,
    currentSongId: data.currentSongId,
    updatedAt: new Date()
  };

  if (data.status === 'PLAYING') {
    updateData.startedAt = new Date();
    updateData.startTimeOffset = data.currentTime || 0;
    updateData.currentTime = data.currentTime || 0;
  } else if (data.status === 'PAUSED') {
    updateData.startedAt = null;
    updateData.currentTime = data.currentTime;
  } else if (data.currentTime !== undefined) {
    updateData.currentTime = data.currentTime;
  }

  const session = await db.karaokeSession.update({
    where: { joinCode: code.toUpperCase() },
    data: updateData
  });
  revalidatePath('/');
  return session;
}

// ➕ Přidání do fronty relace přes mobil
export async function addToSessionQueue(code: string, songId: string) {
  const s = await db.karaokeSession.findUnique({ 
    where: { joinCode: code },
    include: { queue: true }
  });
  if (!s) return null;

  // Pokud nic nehraje (první song), nastavíme ho jako aktuální v režimu pauzy
  if (!s.currentSongId) {
    await db.karaokeSession.update({
      where: { id: s.id },
      data: { 
        currentSongId: songId,
        status: 'PAUSED'
      }
    });
    return { position: 0 }; // Je to aktuálně hrající pisen
  } else {
    // Jinak klasicky do fronty
    const last = s.queue.sort((a,b) => b.order - a.order)[0];
    const nextOrder = (last?.order || 0) + 1;
    await db.karaokeSessionQueue.create({
      data: { sessionId: s.id, songId, order: nextOrder }
    });
    return { position: s.queue.length + 1 }; // +1 protože hraje jeden a zbytek ve frontě (+ tenhle novej)
  }
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
      startedAt: new Date(),
      startTimeOffset: 0,
      currentTime: 0,
      updatedAt: new Date()
    },
    include: { 
      currentSong: true,
      queue: { include: { song: true }, orderBy: { order: 'asc' } }
    }
  });
}
