import { db as prisma } from "@/lib/db";
import PlayerClient from "./PlayerClient";
import { notFound } from "next/navigation";

export default async function PlayerPage({ params }: { params: { songId: string } }) {
  const song = await prisma.song.findUnique({
    where: { id: params.songId }
  });

  if (!song) return notFound();

  return <PlayerClient song={song} />;
}
