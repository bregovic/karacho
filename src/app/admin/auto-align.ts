'use server';

import { OpenAI } from 'openai';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'missing-key',
});

export async function autoAlignSong(songId: string) {
  try {
    console.log("AI-Align: Starting for songId", songId);
    
    // 1. Získáme písničku a její audio
    const song = await db.song.findUnique({ where: { id: songId } });
    if (!song || !song.audioUrl || !song.lyrics) {
      throw new Error("Chybí audio nebo text písně.");
    }

    // 2. Stáhneme audio buffer
    const audioRes = await fetch(song.audioUrl);
    const audioBlob = await audioRes.blob();
    const file = new File([audioBlob], "audio.mp3", { type: "audio/mpeg" });

    // 3. Pošleme do Whisperu pro "word-level" časování
    console.log("AI-Align: Sending to Whisper API...");
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["word"],
    });

    const vJson = transcription as any;
    if (!vJson.words || vJson.words.length === 0) {
      throw new Error("Whisper nevrátil žádná slova. Je audio v pořádku?");
    }

    // 4. Převod na náš formát bloků (Group by lines from original lyrics)
    const lines = song.lyrics.split('\n').map((l: string) => l.trim()).filter(Boolean);
    const whisperWords = vJson.words; // { word, start, end }
    
    let wIdx = 0;
    const blocks: any[] = [];

    for (let li = 0; li < lines.length; li++) {
        const lineText = lines[li];
        const lineWords = lineText.split(/\s+/);
        
        const bWords: any[] = [];
        const lw: string[] = [];

        for (let wi = 0; wi < lineWords.length; wi++) {
            // Najdeme nejbližší slovo ve Whisperu
            if (wIdx < whisperWords.length) {
                const ww = whisperWords[wIdx];
                bWords.push({ t: ww.start, i: wi });
                lw.push(lineWords[wi]);
                wIdx++;
            }
        }

        if (bWords.length > 0) {
            blocks.push({
                bs: bWords[0].t,
                be: whisperWords[wIdx - 1]?.end || bWords[0].t + 2,
                lw: lw,
                w: bWords
            });
        }
    }

    const timingData = { blocks };

    // 5. Uložíme do DB
    await db.song.update({
      where: { id: songId },
      data: { timingData }
    });

    console.log("AI-Align: Success!");
    revalidatePath('/admin');
    revalidatePath('/designer');
    revalidatePath(`/designer/${songId}`);
    return { success: true, timingData };

  } catch (e: any) {
    console.error("AI-Align Error:", e);
    return { success: false, error: e.message };
  }
}
