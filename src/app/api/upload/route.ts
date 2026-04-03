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

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    // Nahrání přímo ze serveru do R2
    await r2.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: filename,
      Body: buffer,
      ContentType: file.type || 'audio/mpeg',
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
