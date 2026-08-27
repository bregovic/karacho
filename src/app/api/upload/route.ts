import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2, BUCKET_NAME, PUBLIC_URL } from "@/lib/r2";
import { auth } from '@/auth';
import { db } from "@/lib/db";
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const jeSpravce = session.user.role === 'ADMIN';

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: "Soubor nebyl nalezen ve formuláři" }, { status: 400 });
    }

    // Práva podle toho, co se nahrává. Dřív stačilo být přihlášený a při
    // samoobslužné registraci si tak kdokoli mohl nasypat do R2 padesátky
    // megabajtů. Obrázek ale musí projít i běžnému uživateli — jinak by si
    // nenastavil profilovou fotku.
    const jeObrazek = (file.type || '').startsWith('image/');
    if (!jeObrazek && !jeSpravce) {
      return NextResponse.json({ error: "Nahrávat hudbu a data smí jen správce." }, { status: 403 });
    }

    const limit = jeObrazek && !jeSpravce ? 8 * 1024 * 1024 : 50 * 1024 * 1024;
    if (file.size > limit) {
      return NextResponse.json({ error: `Soubor překračuje limit ${Math.round(limit / 1024 / 1024)} MB` }, { status: 400 });
    }

    let buffer: any = Buffer.from(await file.arrayBuffer());
    let filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    let contentType = file.type || 'audio/mpeg';
    
    // VÝPOČET HASH (MD5) pro detekci duplicit. Počítá se ze souboru tak,
    // jak přišel — před kompresí na 128k, aby dvakrát nahraný stejný
    // originál dal stejný otisk.
    const hash = crypto.createHash('md5').update(buffer).digest('hex');

    // 🎙️ KONTROLA DUPLICITY MP3
    //
    // Hledá se v obou sloupcích: stejná stopa nahraná jednou jako originál
    // a podruhé jako instrumentálka je pořád tentýž soubor v R2 navíc.
    // Na název se schválně nekoukáme — přejmenovaný soubor je pořád stejná
    // písnička a právě tím dřív kontrola propadala.
    if (contentType.includes('audio')) {
       // Otisk sám o sobě nestačí — musí u něj být i soubor. Osiřelý otisk
       // (po smazání nahrávky) by jinak zablokoval nahrání téže písně a
       // ukázal na záznam, kde žádné audio není.
       const existing = await db.song.findFirst({
          where: {
            OR: [
              { audioHash: hash, audioUrl: { not: null } },
              { instrumentalHash: hash, instrumentalUrl: { not: null } },
            ],
          },
          select: { id: true, title: true, artist: true, audioUrl: true, instrumentalUrl: true, audioHash: true },
       });
       if (existing) {
          const jakoOriginal = existing.audioHash === hash;
          return NextResponse.json({
             error: `Tenhle soubor už v katalogu je — „${existing.title}"${existing.artist ? ` (${existing.artist})` : ''}, jako ${jakoOriginal ? 'originál' : 'instrumentálka'}.`,
             duplicita: true,
             existingSongId: existing.id,
             url: jakoOriginal ? existing.audioUrl : existing.instrumentalUrl,
          }, { status: 409 }); // 409 Conflict
       }
    }

    // 🚀 OPTIMALIZACE OBRÁZKŮ (Backgrounds / Posters)
    if (contentType.startsWith('image/')) {
       const sharp = (await import('sharp')).default;
       buffer = await sharp(buffer)
          .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80, mozjpeg: true })
          .toBuffer();
       contentType = 'image/jpeg';
       if (!filename.toLowerCase().endsWith('.jpg') && !filename.toLowerCase().endsWith('.jpeg')) {
          filename += '.jpg';
       }
    }

    // 🎙️ OPTIMALIZACE AUDIO (MP3 Komprese na 128k)
    else if (contentType === 'audio/mpeg' || contentType === 'audio/mp3') {
       try {
           const ffmpeg = (await import('fluent-ffmpeg')).default;
           const fs = await import('fs');
           const path = await import('path');
           const os = await import('os');
           
           // Určení cesty k ffmpeg (priorita: systémový z Nixpacks, pak installer)
           let ffmpegPath = 'ffmpeg'; 
           try {
              const ffmpegInstaller = await import('@ffmpeg-installer/ffmpeg');
              if (ffmpegInstaller.path) ffmpegPath = ffmpegInstaller.path;
           } catch(e) {}
           
           ffmpeg.setFfmpegPath(ffmpegPath);
           const tempInput = path.join(os.tmpdir(), `in-${filename}`);
           const tempOutput = path.join(os.tmpdir(), `out-${filename}`);
           
           fs.writeFileSync(tempInput, buffer);
           
           await new Promise((resolve, reject) => {
              const timer = setTimeout(() => reject(new Error("Timeout")), 60000); // 60s limit
              ffmpeg(tempInput)
                 .audioBitrate(128)
                 .toFormat('mp3')
                 .on('end', () => { clearTimeout(timer); resolve(true); })
                 .on('error', (err) => { clearTimeout(timer); reject(err); })
                 .save(tempOutput);
           });
           
           buffer = fs.readFileSync(tempOutput);
           contentType = 'audio/mpeg';
           if (!filename.toLowerCase().endsWith('.mp3')) filename += '.mp3';
           
           // Cleanup
           try { fs.unlinkSync(tempInput); fs.unlinkSync(tempOutput); } catch(e) {}
       } catch (err) {
           console.error("⚠️ MP3 Compression failed, uploading raw:", err);
           // Fallback - buffer zůstává nezměněn, pokračujeme v nahrávání originálu
       }
    }

    // Nahrání přímo ze serveru do R2
    await r2.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: filename,
      Body: buffer,
      ContentType: contentType,
    }));

    const finalUrl = `${PUBLIC_URL}/${filename}`;

    return NextResponse.json({
      success: true,
      finalUrl,
      key: filename,
      hash,
      // Velikost až PO kompresi — to je to, co reálně leží v R2 a podle
      // čeho se v administraci řadí „od nejkratší".
      size: buffer.length,
    });

  } catch (error: any) {
    console.error("--- Server Proxy Upload Error ---", error);
    return NextResponse.json({ 
      error: error.message || "Selhalo nahrávání na server",
      details: error.stack 
    }, { status: 500 });
  }
}
