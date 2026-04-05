import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2, BUCKET_NAME, PUBLIC_URL } from "@/lib/r2";
import { auth } from '@/auth';

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

    let buffer = Buffer.from(await file.arrayBuffer());
    let filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    let contentType = file.type || 'audio/mpeg';

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
       const ffmpeg = (await import('fluent-ffmpeg')).default;
       const ffmpegPath = (await import('ffmpeg-static')).default;
       const fs = await import('fs');
       const path = await import('path');
       const os = await import('os');
       
       if (ffmpegPath) {
          ffmpeg.setFfmpegPath(ffmpegPath);
          const tempInput = path.join(os.tmpdir(), `in-${filename}`);
          const tempOutput = path.join(os.tmpdir(), `out-${filename}`);
          
          fs.writeFileSync(tempInput, buffer);
          
          await new Promise((resolve, reject) => {
             ffmpeg(tempInput)
                .audioBitrate(128)
                .toFormat('mp3')
                .on('end', resolve)
                .on('error', reject)
                .save(tempOutput);
          });
          
          buffer = fs.readFileSync(tempOutput);
          
          // Cleanup
          try { fs.unlinkSync(tempInput); fs.unlinkSync(tempOutput); } catch(e) {}
          
          if (!filename.toLowerCase().endsWith('.mp3')) filename += '.mp3';
          contentType = 'audio/mpeg';
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
      key: filename
    });

  } catch (error: any) {
    console.error("--- Server Proxy Upload Error ---", error);
    return NextResponse.json({ 
      error: error.message || "Selhalo nahrávání na server",
      details: error.stack 
    }, { status: 500 });
  }
}
