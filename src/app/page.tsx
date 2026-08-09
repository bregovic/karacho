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
      timingData: true,
      chords: true,
    },
    orderBy: { createdAt: 'desc' }
  });

  // Fisher-Yates shuffle directly on the server (forceDynamic is true)
  for (let i = songs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [songs[i], songs[j]] = [songs[j], songs[i]];
  }

  return <PublicCatalog initialSongs={songs} isAdmin={isAdmin} />;
}
