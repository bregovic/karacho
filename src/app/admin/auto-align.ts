'use server';

import { OpenAI } from 'openai';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'missing-key',
});

function normalize(str: string) {
  if (!str) return '';
  return str.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export async function autoAlignSong(songId: string) {
  try {
    console.log("AI-Align: Starting Ultra-Stable Alignment for", songId);
    
    const song = await db.song.findUnique({ where: { id: songId } });
    if (!song || !song.audioUrl || !song.lyrics) {
      throw new Error("Chybí audio nebo text písně.");
    }

    const audioRes = await fetch(song.audioUrl);
    const audioBlob = await audioRes.blob();
    const file = new File([audioBlob], "audio.mp3", { type: "audio/mpeg" });

    console.log("AI-Align: Transcribing with Whisper...");
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["word"],
      prompt: song.lyrics.slice(0, 1000),
    });

    const vJson = transcription as any;
    const whisperWords = vJson.words; 
    const maxDuration = vJson.duration || 0;

    if (!whisperWords || whisperWords.length === 0) {
      throw new Error("Whisper nevrátil žádná slova.");
    }

    const sourceLines = song.lyrics.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);
    
    const blocks: any[] = [];
    let globalWhisperIdx = 0;

    for (let li = 0; li < sourceLines.length; li++) {
      const lineText = sourceLines[li];
      const lineWords = lineText.split(/\s+/).filter(w => w.length > 0);
      
      const foundAnchors: { wordIdx: number, time: number, whisperIdx: number }[] = [];
      let currentLinePointer = globalWhisperIdx;

      for (let wi = 0; wi < lineWords.length; wi++) {
        const target = normalize(lineWords[wi]);
        if (!target) continue;

        // Hledáme kotvu pro KONKRÉTNÍ slovo, ale VŽDY jen dopředu (searchWindow 50 slov)
        for (let j = 0; j < 50; j++) {
          const checkIdx = currentLinePointer + j;
          if (checkIdx >= whisperWords.length) break;
          const wWord = normalize(whisperWords[checkIdx].word);
          
          if (wWord === target || wWord.includes(target) || target.includes(wWord)) {
            const foundTime = Math.min(whisperWords[checkIdx].start, maxDuration);
            foundAnchors.push({ wordIdx: wi, time: foundTime, whisperIdx: checkIdx });
            // KLÍČOVÁ OPRAVA: Po nalezení slova posuneme pointer pro DALŠÍ slovo v tomto řádku!
            currentLinePointer = checkIdx + 1;
            break; 
          }
        }
      }

      const bWords: any[] = [];
      let lastBlockEnd = blocks.length > 0 ? blocks[blocks.length - 1].be : 0;
      
      if (foundAnchors.length > 0) {
        // Máme kotvy - interpolujeme
        for (let wi = 0; wi < lineWords.length; wi++) {
          const leftA = [...foundAnchors].reverse().find(a => a.wordIdx <= wi);
          const rightA = foundAnchors.find(a => a.wordIdx >= wi);

          let time = 0;
          if (leftA && rightA && leftA.wordIdx !== rightA.wordIdx) {
            const ratio = (wi - leftA.wordIdx) / (rightA.wordIdx - leftA.wordIdx);
            time = leftA.time + (rightA.time - leftA.time) * ratio;
          } else if (leftA) {
            time = leftA.time + (wi - leftA.wordIdx) * 0.35;
          } else if (rightA) {
            time = rightA.time - (rightA.wordIdx - wi) * 0.35;
          }
          
          // Zajistíme, že čas nezačne dřív než skončil minulý blok
          time = Math.max(time, lastBlockEnd + 0.1);
          bWords.push({ t: Math.min(time, maxDuration), i: wi, v: 3 });
        }
        // Posuneme globální pointer za poslední nalezené slovo tohoto řádku
        globalWhisperIdx = Math.max(...foundAnchors.map(a => a.whisperIdx)) + 1;
      } else {
        // Fallback pro nenalezený řádek
        const startTime = lastBlockEnd + 0.8;
        for (let wi = 0; wi < lineWords.length; wi++) {
          const time = Math.min(startTime + (wi * 0.4), maxDuration);
          bWords.push({ t: time, i: wi, v: 3 });
        }
      }

      if (bWords.length > 0) {
        blocks.push({
          li: blocks.length,
          v: 3,
          bs: Math.max(0, bWords[0].t - 1.2),
          be: Math.min(bWords[bWords.length - 1].t + 1.2, maxDuration),
          lw: lineWords,
          w: bWords
        });
      }
    }

    const timingData = { blocks, dur: maxDuration, countdowns: [] };

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
