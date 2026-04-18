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

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: "Soubor nebyl nalezen ve formuláři" }, { status: 400 });
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "Soubor překračuje limit 50 MB" }, { status: 400 });
    }

    let buffer: any = Buffer.from(await file.arrayBuffer());
    let filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    let contentType = file.type || 'audio/mpeg';
    
    // VÝPOČET HASH (MD5) pro detekci duplicit
    const hash = crypto.createHash('md5').update(buffer).digest('hex');

    // 🎙️ KONTROLA DUPLICITY MP3 (jen u audia)
    if (contentType.includes('audio')) {
       const existing = await db.song.findFirst({
          where: { 
             OR: [
               { audioHash: hash },
               { audioUrl: { contains: hash } } // Pro jistotu, kdyby tam hash byl v názvu
             ]
          }
       });
       if (existing) {
          return NextResponse.json({ 
             error: "Tato MP3 už byla nahrána! (Duplicita v katalogu)",
             existingSongId: existing.id,
             url: existing.audioUrl 
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
      hash
    });

  } catch (error: any) {
    console.error("--- Server Proxy Upload Error ---", error);
    return NextResponse.json({ 
      error: error.message || "Selhalo nahrávání na server",
      details: error.stack 
    }, { status: 500 });
  }
}
