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
    console.log("AI-Align: Starting Turbo alignment for", songId);
    
    const song = await db.song.findUnique({ where: { id: songId } });
    if (!song || !song.audioUrl || !song.lyrics) {
      throw new Error("Chybí audio nebo text písně.");
    }

    // 1. Stáhneme audio
    const audioRes = await fetch(song.audioUrl);
    const audioBlob = await audioRes.blob();
    const file = new File([audioBlob], "audio.mp3", { type: "audio/mpeg" });

    // 2. Whisper s nápovědou (Prompting extrémně pomáhá s přesností začátků)
    console.log("AI-Align: Fetching word-level timestamps with prompt...");
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["word"],
      prompt: song.lyrics.slice(0, 1000), // Prvních 1000 znaků jako nápověda pro AI
    });

    const vJson = transcription as any;
    const whisperWords = vJson.words; 

    if (!whisperWords || whisperWords.length === 0) {
      throw new Error("Whisper nevrátil žádná slova.");
    }

    // 3. Rozstříháme text na bloky (řádky)
    const sourceLines = song.lyrics.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);
    
    const blocks: any[] = [];
    let whisperPointer = 0;

    // Funkce pro nalezení nejlepší shody řádku v přepisu od určitého místa
    const findBestLineMatch = (words: string[], startIdx: number) => {
      if (words.length === 0) return null;
      const target = words.map(normalize).join('');
      
      let bestIdx = -1;
      let bestScore = 0;
      
      // Prohledáme okolí (max 30 slov dopředu)
      for (let i = startIdx; i < Math.min(startIdx + 30, whisperWords.length); i++) {
        let currentText = "";
        let score = 0;
        for (let j = 0; j < words.length; j++) {
           if (i + j >= whisperWords.length) break;
           const wWord = normalize(whisperWords[i+j].word);
           if (wWord === normalize(words[j])) score++;
        }
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
        if (bestScore === words.length) break; // Perfektní shoda
      }
      
      if (bestScore >= Math.ceil(words.length * 0.4)) { // Aspoň 40% shoda slov
        return bestIdx;
      }
      return null;
    };

    // 4. CHYTRÉ PÁROVÁNÍ (Strukturální detekce)
    for (let li = 0; li < sourceLines.length; li++) {
      const lineText = sourceLines[li];
      const lineWords = lineText.split(/\s+/).filter(w => w.length > 0);
      
      const matchIdx = findBestLineMatch(lineWords, whisperPointer);

      if (matchIdx !== null) {
        const bWords: any[] = [];
        const lw: string[] = [];
        
        for (let wi = 0; wi < lineWords.length; wi++) {
           const wIdx = matchIdx + wi;
           if (wIdx < whisperWords.length) {
             const found = whisperWords[wIdx];
             bWords.push({ t: found.start, i: wi, v: 3 });
             lw.push(lineWords[wi]);
           }
        }
        
        if (bWords.length > 0) {
          blocks.push({
            li: blocks.length, // Použijeme inkrementální ID pro případné opakování
            v: 3,
            bs: Math.max(0, bWords[0].t - 1.5), // Preroll 1.5s (aby se řádek objevil dřív)
            be: bWords[bWords.length - 1].t + 1.5,
            lw,
            w: bWords
          });
          whisperPointer = matchIdx + lineWords.length;
        }
      } else {
        // Pokud řádek nenajdeme, zkusíme se posunout kousek dál v čase
        // (Mohlo by to být instrumental nebo přeslechnutá pasáž)
        console.log(`AI-Align: Line "${lineText}" not found in audio, skipping or estimating...`);
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
