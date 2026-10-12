import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * Seznam písní ke stažení do offline studia: mají zvuk i text, ale ještě ne
 * časování. Jen pro správce – vrací celé texty.
 *
 * `?katalog=1` vrací naopak všechny písně se zvukem, ale jen v kostce (bez
 * textu a časování) – z toho se vybírá, co stáhnout; celá píseň se pak
 * dotáhne po jedné přes /api/songs/:id.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== 'ADMIN') return new NextResponse("Forbidden", { status: 403 });

  if (new URL(req.url).searchParams.get('katalog')) {
    const vse = await db.song.findMany({
      where: { audioUrl: { not: null } },
      select: { id: true, title: true, artist: true, audioSize: true, instrumentalUrl: true, timingData: true, lyrics: true },
      orderBy: [{ artist: 'asc' }, { title: 'asc' }],
    });
    return NextResponse.json(vse.map((p) => ({
      id: p.id,
      title: p.title,
      artist: p.artist,
      audioSize: p.audioSize,
      instrumental: !!p.instrumentalUrl,
      nacasovano: !!(p.timingData as any)?.blocks?.length,
      text: !!p.lyrics?.trim(),
    })));
  }

  const pisne = await db.song.findMany({
    where: { audioUrl: { not: null }, lyrics: { not: null } },
    select: {
      id: true, title: true, artist: true, lyrics: true, chords: true,
      startTime: true, audioUrl: true, audioSize: true, timingData: true, instrumentalUrl: true,
    },
    orderBy: [{ artist: 'asc' }, { title: 'asc' }],
  });

  const nacasovat = pisne
    .filter((p) => p.lyrics?.trim() && !((p.timingData as any)?.blocks?.length))
    .map(({ timingData: _t, ...p }) => p);

  return NextResponse.json(nacasovat);
}
