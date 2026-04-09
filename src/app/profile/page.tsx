import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getUserProfileData, getSingingStats } from '@/app/actions/user-actions';
import ProfileClient from './ProfileClient';

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/api/auth/signin');
  }

  const userData = await getUserProfileData();
  const stats = await getSingingStats();

  if (!userData) {
    return <div>Uživatel nenalezen</div>;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: 'white', paddingTop: '80px' }}>
      <ProfileClient 
        user={JSON.parse(JSON.stringify(userData))} 
        stats={stats} 
      />
    </div>
  );
}
