import { db } from '@/lib/db';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import AdminCatalog from '@/components/AdminCatalog';
import Link from 'next/link';

// Pozor na název: Next zná `dynamic`, ne `forceDynamic`. Dokud tu stálo
// `forceDynamic`, byl to obyčejný export, kterého si nikdo nevšiml.
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/');
  }

  // Hlášení se s písněmi netahají: na kartě se nevypisují (rozhazovala
  // mřížku) a co je s písní špatně, je vidět z jejího stavu. Ušetří to
  // u 800 písní jeden join navíc.
  const songs = await db.song.findMany({
    orderBy: { createdAt: 'desc' },
  });

  const adminEmails = await db.adminEmail.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return <AdminCatalog initialSongs={songs} adminEmails={adminEmails} />;
}
