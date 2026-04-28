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
    console.log("AI-Align: Starting Master Alignment for", songId);
    
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
      
      // 1. Najdeme KOTVY v širším okně
      const foundAnchors: { wordIdx: number, time: number, whisperIdx: number }[] = [];
      let lastBlockEnd = blocks.length > 0 ? blocks[blocks.length - 1].be : 0;
      
      // Hledáme kotvy v transkripci (omezené okno pro zachování chronologie)
      const searchWindow = 60; // Prohledáme 60 slov od konce posledního bloku
      
      for (let wi = 0; wi < lineWords.length; wi++) {
        const target = normalize(lineWords[wi]);
        if (!target) continue;

        for (let j = 0; j < searchWindow; j++) {
          const checkIdx = whisperPointer + j;
          if (checkIdx >= whisperWords.length) break;
          const wWord = normalize(whisperWords[checkIdx].word);
          
          if (wWord === target || wWord.includes(target) || target.includes(wWord)) {
            foundAnchors.push({ 
              wordIdx: wi, 
              time: whisperWords[checkIdx].start,
              whisperIdx: checkIdx
            });
            break; 
          }
        }
      }

      // 2. Interpolace se zohledněním délky slov (vážená)
      const bWords: any[] = [];
      
      if (foundAnchors.length > 0) {
        // Posuneme pointer za poslední nalezenou kotvu v tomto řádku
        const maxWhisperIdx = Math.max(...foundAnchors.map(a => a.whisperIdx));
        whisperPointer = maxWhisperIdx + 1;

        for (let wi = 0; wi < lineWords.length; wi++) {
          const leftAnchor = [...foundAnchors].reverse().find(a => a.wordIdx <= wi);
          const rightAnchor = foundAnchors.find(a => a.wordIdx >= wi);

          let time = 0;
          if (leftAnchor && rightAnchor && leftAnchor.wordIdx !== rightAnchor.wordIdx) {
            // Lineární rozdělení mezi kotvami
            const ratio = (wi - leftAnchor.wordIdx) / (rightAnchor.wordIdx - leftAnchor.wordIdx);
            time = leftAnchor.time + (rightAnchor.time - leftAnchor.time) * ratio;
          } else if (leftAnchor) {
            // Jen levá - odhad
            time = leftAnchor.time + (wi - leftAnchor.wordIdx) * 0.35;
          } else if (rightAnchor) {
            // Jen pravá - odhad
            time = rightAnchor.time - (rightAnchor.wordIdx - wi) * 0.35;
          }
          bWords.push({ t: time, i: wi, v: 3 });
        }
      } else {
        // Fallback: Pokud řádek vůbec nepoznáme, umístíme ho za poslední blok
        const startTime = lastBlockEnd + 0.8;
        for (let wi = 0; wi < lineWords.length; wi++) {
          bWords.push({ t: startTime + (wi * 0.4), i: wi, v: 3 });
        }
      }

      if (bWords.length > 0) {
        blocks.push({
          li: blocks.length,
          v: 3,
          bs: Math.max(0, bWords[0].t - 1.2),
          be: bWords[bWords.length - 1].t + 1.2,
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
