import { db as prisma } from "@/lib/db";
import PlayerClient from "./PlayerClient";
import { notFound } from "next/navigation";

export default async function PlayerPage({ params }: { params: Promise<{ songId: string }> }) {
  const { songId } = await params;
  const song = await prisma.song.findUnique({
    where: { id: songId }
  });

  if (!song) return notFound();

  return <PlayerClient song={song} />;
}
