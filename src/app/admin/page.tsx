import { db } from '@/lib/db';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import AdminCatalog from '@/components/AdminCatalog';

export const forceDynamic = true;

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/api/auth/signin');
  }

  const songs = await db.song.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return <AdminCatalog initialSongs={songs} />;
}
