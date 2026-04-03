import { NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2, BUCKET_NAME } from '@/lib/r2';
import { auth } from '@/auth';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { filename, contentType } = await request.json();
    if (!filename || !contentType) {
      return NextResponse.json({ error: 'Missing filename or contentType' }, { status: 400 });
    }

    // Bezpečnost: Vytvoření unikátního jména souboru (např. '167890123-nazev.mp3')
    const key = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    // Generujeme tzn. "Presigned URL" - exkluzivní platnou nahrávací linku pro prohlížeč na 15 min
    const presignedUrl = await getSignedUrl(r2, command, { expiresIn: 900 });

    return NextResponse.json({ 
      uploadUrl: presignedUrl, 
      finalUrl: `${process.env.R2_PUBLIC_URL}/${key}`,
      key 
    });

  } catch (error) {
    console.error('S3 Upload Error:', error);
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
  }
}
