import { db } from '@/lib/db';
import DesignerClient from './DesignerClient';

export default async function DesignerPage(props: { searchParams: Promise<{ songId?: string }> }) {
  const params = await props.searchParams;
  let song = null;
  
  if (params.songId) {
    song = await db.song.findUnique({ where: { id: params.songId } });
  }

  if (!song) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: '#fff' }}>
        <h2>Nebyla vybrána žádná píseň.</h2>
        <p>Běžte prosím do Administrace a klikněte na Otevřít v Designeru.</p>
      </div>
    );
  }

  return <DesignerClient song={song} />;
}
