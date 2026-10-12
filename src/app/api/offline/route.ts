import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * Seznam písní ke stažení do offline studia: mají zvuk i text, ale ještě ne
 * časování. Jen pro správce – vrací celé texty.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== 'ADMIN') return new NextResponse("Forbidden", { status: 403 });

  const pisne = await db.song.findMany({
    where: { audioUrl: { not: null }, lyrics: { not: null } },
    select: {
      id: true, title: true, artist: true, lyrics: true, chords: true,
      startTime: true, audioUrl: true, audioSize: true, timingData: true,
    },
    orderBy: [{ artist: 'asc' }, { title: 'asc' }],
  });

  const nacasovat = pisne
    .filter((p) => p.lyrics?.trim() && !((p.timingData as any)?.blocks?.length))
    .map(({ timingData: _t, ...p }) => p);

  return NextResponse.json(nacasovat);
}
