import { db as prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function PUT(req: Request, context: any) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await context.params;

  try {
    const body = await req.json();
    const { timingData, lyrics, chords, state, startTime } = body;

    const updated = await prisma.song.update({
      where: { id },
      data: {
        timingData: timingData || undefined,
        lyrics: lyrics || undefined,
        // Studio akordy posílalo, server je zahazoval — práce v záložce
        // Akordy se po reloadu nikdy nenašla.
        chords: chords !== undefined ? chords : undefined,
        state: state || undefined,
        startTime: startTime !== undefined ? startTime : undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating song:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function GET(req: Request, context: any) {
  const { id } = await context.params;
  const song = await prisma.song.findUnique({
    where: { id },
  });
  if (!song) return new NextResponse("Not Found", { status: 404 });
  return NextResponse.json(song);
}
