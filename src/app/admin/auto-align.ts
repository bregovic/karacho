'use server';

import { OpenAI } from 'openai';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'missing-key',
});

// Pomocná funkce pro normalizaci textu pro porovnávání
function normalize(str: string) {
  return str.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export async function autoAlignSong(songId: string) {
  try {
    console.log("AI-Align: Starting robust alignment for", songId);
    
    const song = await db.song.findUnique({ where: { id: songId } });
    if (!song || !song.audioUrl || !song.lyrics) {
      throw new Error("Chybí audio nebo text písně.");
    }

    // 1. Stáhneme audio
    const audioRes = await fetch(song.audioUrl);
    const audioBlob = await audioRes.blob();
    const file = new File([audioBlob], "audio.mp3", { type: "audio/mpeg" });

    // 2. Whisper - Word Level Timestamps
    console.log("AI-Align: Fetching word-level timestamps from Whisper...");
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["word"],
    });

    const vJson = transcription as any;
    const whisperWords = vJson.words; // { word: string, start: number, end: number }

    if (!whisperWords || whisperWords.length === 0) {
      throw new Error("Whisper nevrátil žádná slova.");
    }

    // 3. Robustní Alignment Algoritmus
    // Rozdělíme text na slova a řádky
    const lines = song.lyrics.split('\n').filter(l => l.trim().length > 0);
    const blocks: any[] = [];
    
    let currentWhisperIdx = 0;
    const LOOK_AHEAD = 15; // Kolik slov dopředu se dívat, když hledáme shodu

    for (let li = 0; li < lines.length; li++) {
      const lineText = lines[li];
      const lineWords = lineText.split(/\s+/).filter(w => w.length > 0);
      const bWords: any[] = [];
      const lw: string[] = [];

      for (let wi = 0; wi < lineWords.length; wi++) {
        const targetWord = normalize(lineWords[wi]);
        
        // Zkusíme najít nejlepší shodu v okolí currentWhisperIdx
        let bestMatchIdx = -1;
        let minDistance = 999;

        for (let j = 0; j < LOOK_AHEAD; j++) {
          const checkIdx = currentWhisperIdx + j;
          if (checkIdx >= whisperWords.length) break;

          const whisperWord = normalize(whisperWords[checkIdx].word);
          
          // Pokud je to přesná shoda
          if (whisperWord === targetWord) {
            bestMatchIdx = checkIdx;
            break; 
          }
          
          // Pokud je to aspoň částečná shoda (začátek slova nebo podobné)
          if (whisperWord.startsWith(targetWord) || targetWord.startsWith(whisperWord)) {
             bestMatchIdx = checkIdx;
             break;
          }
        }

        if (bestMatchIdx !== -1) {
          const found = whisperWords[bestMatchIdx];
          bWords.push({ t: found.start, i: wi });
          lw.push(lineWords[wi]);
          // Posuneme se v přepisu dál
          currentWhisperIdx = bestMatchIdx + 1;
        } else {
          // Pokud jsme nenašli shodu, odhadneme čas podle předchozího slova + malý offset
          const lastTime = bWords.length > 0 ? bWords[bWords.length - 1].t + 0.3 : (blocks[blocks.length-1]?.be || 0) + 0.5;
          bWords.push({ t: lastTime, i: wi });
          lw.push(lineWords[wi]);
          // currentWhisperIdx neměníme, zkusíme příští slovo napasovat
        }
      }

      if (bWords.length > 0) {
        blocks.push({
          li,
          v: 3,
          bs: bWords[0].t,
          be: bWords[bWords.length - 1].t + 1.5,
          lw: lw,
          w: bWords
        });
      }
    }

    const timingData = { blocks, dur: vJson.duration || 0, countdowns: [] };

    // 4. Uložíme
    await db.song.update({
      where: { id: songId },
      data: { timingData }
    });

    revalidatePath('/designer');
    return { success: true, timingData };

  } catch (err: any) {
    console.error("AI-Align Error:", err);
    return { success: false, error: err.message };
  }
}
