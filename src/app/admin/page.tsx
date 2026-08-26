import { db } from '@/lib/db';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import AdminCatalog from '@/components/AdminCatalog';
import Link from 'next/link';

export const forceDynamic = true;

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/');
  }

  const songs = await db.song.findMany({
    orderBy: { createdAt: 'desc' },
    // Nevyřízená hlášení jedou s písní — ať je na kartě rovnou vidět,
    // co komu na písni vadilo, a nemusí se to dohledávat jinde.
    include: {
      reports: {
        where: { vyreseno: false },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  const adminEmails = await db.adminEmail.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return <AdminCatalog initialSongs={songs} adminEmails={adminEmails} />;
}
