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
  });

  const adminEmails = await db.adminEmail.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return (
    <>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <Link 
          href="/admin/exchange" 
          style={{ 
            padding: '16px 24px', borderRadius: '50px', border: '1px solid #00ffa0',
            background: 'rgba(0,255,160,0.05)',
            color: '#00ffa0', fontWeight: 800, fontSize: '13px', textDecoration: 'none'
          }}
        >
          📦 DATOVÝ SERVIS (AI)
        </Link>
        <Link 
          href="/admin/audit" 
          style={{ 
            padding: '16px 24px', borderRadius: '50px', border: '1px solid #ffcc00',
            background: 'rgba(255,204,0,0.05)',
            color: '#ffcc00', fontWeight: 800, fontSize: '13px', textDecoration: 'none'
          }}
        >
          🔍 AUDIT DAT
        </Link>
      </div>
      <AdminCatalog initialSongs={songs} adminEmails={adminEmails} />
    </>
  );
}
