'use server';

import { OpenAI } from 'openai';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'missing-key',
});

function normalize(str: string) {
  return str.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export async function autoAlignSong(songId: string) {
  try {
    console.log("AI-Align: Starting Rhythmic Alignment for", songId);
    
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

    if (!whisperWords || whisperWords.length === 0) {
      throw new Error("Whisper nevrátil žádná slova.");
    }

    const sourceLines = song.lyrics.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);
    
    const blocks: any[] = [];
    let whisperPointer = 0;

    for (let li = 0; li < sourceLines.length; li++) {
      const lineText = sourceLines[li];
      const lineWords = lineText.split(/\s+/).filter(w => w.length > 0);
      
      // 1. Najdeme KOTVY (slova, která AI v řádku bezpečně poznala)
      const foundAnchors: { wordIdx: number, time: number }[] = [];
      let lastCheckedIdx = whisperPointer;

      for (let wi = 0; wi < lineWords.length; wi++) {
        const target = normalize(lineWords[wi]);
        // Koukáme se v přepisu v rozumném okně (cca 40 slov od posledního bodu)
        for (let j = 0; j < 40; j++) {
          const checkIdx = lastCheckedIdx + j;
          if (checkIdx >= whisperWords.length) break;
          const wWord = normalize(whisperWords[checkIdx].word);
          
          if (wWord === target || wWord.includes(target) || target.includes(wWord)) {
            foundAnchors.push({ wordIdx: wi, time: whisperWords[checkIdx].start });
            lastCheckedIdx = checkIdx + 1;
            break;
          }
        }
      }

      // 2. RYTMICKÉ DOPRESEKÁNÍ (Interpolace)
      const bWords: any[] = [];
      
      if (foundAnchors.length > 0) {
        // Máme aspoň jednu kotvu - rozpočítáme zbytek kolem nich
        for (let wi = 0; wi < lineWords.length; wi++) {
          // Najdeme nejbližší kotvy (levou a pravou)
          const leftAnchor = [...foundAnchors].reverse().find(a => a.wordIdx <= wi);
          const rightAnchor = foundAnchors.find(a => a.wordIdx >= wi);

          let time = 0;
          if (leftAnchor && rightAnchor && leftAnchor.wordIdx !== rightAnchor.wordIdx) {
            // Jsme mezi dvěma kotvami - lineární rozdělení
            const ratio = (wi - leftAnchor.wordIdx) / (rightAnchor.wordIdx - leftAnchor.wordIdx);
            time = leftAnchor.time + (rightAnchor.time - leftAnchor.time) * ratio;
          } else if (leftAnchor) {
            // Máme jen levou kotvu - odhadneme čas podle ní (+0.4s na slovo)
            time = leftAnchor.time + (wi - leftAnchor.wordIdx) * 0.4;
          } else if (rightAnchor) {
            // Máme jen pravou kotvu - odhadneme čas před ní (-0.4s na slovo)
            time = rightAnchor.time - (rightAnchor.wordIdx - wi) * 0.4;
          }
          
          bWords.push({ t: time, i: wi, v: 3 });
        }
        whisperPointer = lastCheckedIdx;
      } else {
        // Nenašli jsme žádnou kotvu - odhadneme celý řádek za ten předchozí
        const lastBlockEnd = blocks.length > 0 ? blocks[blocks.length - 1].be : 0;
        const startTime = lastBlockEnd + 1.0;
        for (let wi = 0; wi < lineWords.length; wi++) {
          bWords.push({ t: startTime + (wi * 0.4), i: wi, v: 3 });
        }
      }

      if (bWords.length > 0) {
        blocks.push({
          li: blocks.length,
          v: 3,
          bs: Math.max(0, bWords[0].t - 1.5),
          be: bWords[bWords.length - 1].t + 1.5,
          lw: lineWords,
          w: bWords
        });
      }
    }

    const timingData = { blocks, dur: vJson.duration || 0, countdowns: [] };

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
