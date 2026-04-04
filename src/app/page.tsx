import { db } from "@/lib/db";
import { auth } from "@/auth";
import PublicCatalog from "@/components/PublicCatalog";

export const forceDynamic = true;

export default async function Home() {
  const session = await auth();
  const isAdmin = !!session?.user;

  // Veřejnosti ukážeme jen písně, které už mají Video nebo nějakou stopu.
  // Ale adminovi ukážeme všechny i rozpracované.
  const songs = await db.song.findMany({
    where: isAdmin ? undefined : { state: 'ACTIVE' },
    orderBy: { createdAt: 'desc' }
  });

  return <PublicCatalog initialSongs={songs} isAdmin={isAdmin} />;
}
