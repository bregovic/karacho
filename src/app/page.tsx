import { db } from "@/lib/db";
import { auth } from "@/auth";
import PublicCatalog from "@/components/PublicCatalog";

export const forceDynamic = true;

export default async function Home() {
  const session = await auth();
  const isAdmin = !!session?.user;

  // Veřejný katalog (Home) ukazuje vždy jen plně publikované písně
  // bez ohledu na to, jestli jsme přihlášení jako administrátoři.
  const songs = await db.song.findMany({
    where: { state: 'ACTIVE' },
    select: {
      id: true,
      title: true,
      artist: true,
      genre: true,
      tags: true,
      playCount: true,
      createdAt: true,
      videoUrl: true,
      timingData: true,
      chords: true,
    },
    orderBy: { createdAt: 'desc' }
  });

  return <PublicCatalog initialSongs={songs} isAdmin={isAdmin} />;
}
