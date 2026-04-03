import { db as prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const body = await req.json();
    const { timingData, lyrics } = body;

    const updated = await prisma.song.update({
      where: { id: params.id },
      data: {
        timingData: timingData || undefined,
        lyrics: lyrics || undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating song:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const song = await prisma.song.findUnique({
    where: { id: params.id },
  });
  if (!song) return new NextResponse("Not Found", { status: 404 });
  return NextResponse.json(song);
}
