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
    console.log("AI-Align: Starting Pro Aligner v6.0 for", songId);
    
    const song = await db.song.findUnique({ where: { id: songId } });
    if (!song || !song.audioUrl || !song.lyrics) {
      throw new Error("Chybí audio nebo text písně.");
    }

    const audioRes = await fetch(song.audioUrl);
    const audioBlob = await audioRes.blob();
    const file = new File([audioBlob], "audio.mp3", { type: "audio/mpeg" });

    console.log("AI-Align: Transcribing...");
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "gpt-4o-transcribe",
      response_format: "verbose_json",
      timestamp_granularities: ["word"],
      prompt: `Karaoke timing for ${song.artist} - ${song.title}. Lyrics: ${song.lyrics.slice(0, 500)}`,
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

    /**
     * Zarovnání dvou posloupností slov (Needleman-Wunsch).
     *
     * Dřív se kotvy hledaly slovo po slovu v okně: jakmile přepis jedno slovo
     * spletl nebo vynechal, řetěz se rozpadl a zbytek písně ujel. Tohle hledá
     * nejlepší zarovnání jako celek, takže překlepy i vynechávky přeskočí
     * a pořadí zůstane zachované.
     */
    const zarovnej = (text: string[], slysene: string[]) => {
      const SHODA = 2, NESHODA = -1, MEZERA = -1;
      const n = text.length, m = slysene.length;
      const mat: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
      for (let i = 1; i <= n; i++) mat[i][0] = i * MEZERA;
      for (let j = 1; j <= m; j++) mat[0][j] = j * MEZERA;

      const podobna = (a: string, b: string) => {
        if (!a || !b) return false;
        if (a === b) return true;
        // Zpěv i přepis komolí koncovky, proto stačí shodný začátek.
        if (Math.min(a.length, b.length) >= 4 && a.slice(0, 4) === b.slice(0, 4)) return true;
        return a.includes(b) || b.includes(a);
      };

      for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
          const skore = podobna(text[i - 1], slysene[j - 1]) ? SHODA : NESHODA;
          mat[i][j] = Math.max(mat[i - 1][j - 1] + skore, mat[i - 1][j] + MEZERA, mat[i][j - 1] + MEZERA);
        }
      }

      const parovani = new Array<number | null>(n).fill(null);
      let i = n, j = m;
      while (i > 0 && j > 0) {
        const skore = podobna(text[i - 1], slysene[j - 1]) ? SHODA : NESHODA;
        if (mat[i][j] === mat[i - 1][j - 1] + skore) {
          if (skore === SHODA) parovani[i - 1] = j - 1;
          i--; j--;
        } else if (mat[i][j] === mat[i - 1][j] + MEZERA) { i--; } else { j--; }
      }
      return parovani;
    };

    // Celý text i celý přepis srovnáme najednou, ne po řádcích.
    const vsechnaSlova: { radek: number; text: string }[] = [];
    sourceLines.forEach((radek, ri) => {
      radek.split(/\s+/).filter(w => w.length > 0).forEach((w) => {
        vsechnaSlova.push({ radek: ri, text: normalize(w) });
      });
    });

    const slysena = whisperWords.map((w: any) => normalize(w.word));
    const parovani = zarovnej(vsechnaSlova.map(w => w.text), slysena);

    const kotvy = parovani
      .map((par, idx) => (par === null ? null : { idx, cas: whisperWords[par].start as number }))
      .filter(Boolean) as { idx: number; cas: number }[];

    console.log(`AI-Align: napárováno ${kotvy.length} z ${vsechnaSlova.length} slov`);
    if (kotvy.length < 3) throw new Error("Text a nahrávka si neodpovídají - zarovnání by bylo náhodné.");

    const rozsahIdx = kotvy[kotvy.length - 1].idx - kotvy[0].idx;
    const rozsahCas = kotvy[kotvy.length - 1].cas - kotvy[0].cas;
    const tempo = rozsahIdx > 0 ? Math.min(0.6, Math.max(0.15, rozsahCas / rozsahIdx)) : 0.35;

    // Čas pro každé slovo: mezi kotvami se interpoluje, na okrajích dopočítá.
    const casy = new Array<number>(vsechnaSlova.length).fill(0);
    for (let k = 0; k < vsechnaSlova.length; k++) {
      const vlevo = [...kotvy].reverse().find(a => a.idx <= k);
      const vpravo = kotvy.find(a => a.idx >= k);

      if (vlevo && vpravo && vlevo.idx !== vpravo.idx) {
        casy[k] = vlevo.cas + (vpravo.cas - vlevo.cas) * ((k - vlevo.idx) / (vpravo.idx - vlevo.idx));
      } else if (vlevo && vpravo) {
        casy[k] = vlevo.cas;
      } else if (vlevo) {
        casy[k] = vlevo.cas + (k - vlevo.idx) * tempo;
      } else if (vpravo) {
        casy[k] = Math.max(0, vpravo.cas - (vpravo.idx - k) * tempo);
      }
      // Časy musí růst, jinak by slovo svítilo pozpátku.
      if (k > 0 && casy[k] <= casy[k - 1]) casy[k] = casy[k - 1] + 0.12;
      casy[k] = Math.min(casy[k], maxDuration - 0.1);
    }

    const blocks: any[] = [];
    let ukazatel = 0;
    for (let li = 0; li < sourceLines.length; li++) {
      const lineWords = sourceLines[li].split(/\s+/).filter(w => w.length > 0);
      if (lineWords.length === 0) continue;

      const bWords = lineWords.map((_, wi) => ({ t: casy[ukazatel + wi], i: wi, v: 3 }));
      ukazatel += lineWords.length;

      blocks.push({
        li: blocks.length,
        v: 3,
        bs: Math.max(0, bWords[0].t - 1.2),
        be: Math.min(bWords[bWords.length - 1].t + 1.2, maxDuration),
        lw: lineWords,
        w: bWords,
      });
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
