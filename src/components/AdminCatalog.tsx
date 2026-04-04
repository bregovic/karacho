'use client';
import { useState } from 'react';
import Link from 'next/link';
import AudioUploader from '@/components/AudioUploader';
import SongEditModal from '@/components/SongEditModal';
import { createSong, deleteSong, removeSongResource } from '@/app/admin/actions';
import { autoAlignSong } from '@/app/admin/auto-align';
import { useTranslation } from '@/lib/translations';

export default function AdminCatalog({ initialSongs }: { initialSongs: any[] }) {
  const t = useTranslation('cs');
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [genreFilter, setGenreFilter] = useState('ALL');
  const [tagFilter, setTagFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [editingSong, setEditingSong] = useState<any>(null);

  const allGenres = Array.from(new Set(initialSongs.map(s => s.genre).filter(Boolean)));
  const allTags = Array.from(new Set(initialSongs.flatMap(s => s.tags || []).filter(Boolean)));

  const filteredSongs = initialSongs.filter(song => {
    const hasAudio = !!song.audioUrl;
    const hasJson = !!song.jsonUrl;
    const hasVideo = !!song.videoUrl;

    if (statusFilter === 'MISSING_AUDIO' && hasAudio) return false;
    if (statusFilter === 'MISSING_TIMING' && (!hasAudio || hasJson)) return false;
    if (statusFilter === 'MISSING_RENDER' && (!hasJson || hasVideo)) return false;
    if (statusFilter === 'DONE' && !hasVideo) return false;

    if (genreFilter !== 'ALL' && song.genre !== genreFilter) return false;
    if (tagFilter !== 'ALL' && !(song.tags || []).includes(tagFilter)) return false;

    const q = search.toLowerCase();
    if (q && !song.title.toLowerCase().includes(search.toLowerCase()) && !(song.artist || '').toLowerCase().includes(search.toLowerCase())) return false;

    return true;
  });

  return (
    <div style={{ padding: 'clamp(1rem, 4vw, 2.5rem)', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* HLAVIČKA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div>
           <h1 style={{ color: 'var(--color-gold)', margin: 0, marginBottom: '0.4rem', fontSize: 'clamp(1.8rem, 4vw, 2.4rem)' }}>{t('admin_title')}</h1>
           <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{t('admin_subtitle')}</p>
        </div>
        <button 
          className={showForm ? "btn-secondary" : "btn-primary"} 
          onClick={() => setShowForm(!showForm)}
          style={{ padding: '12px 24px', fontWeight: 600 }}
        >
          {showForm ? t('close_panel') : `➕ ${t('add_song')}`}
        </button>
      </div>

      {/* FORMULÁŘ PRO NOVOU PÍSEŇ */}
      {showForm && (
        <div className="glass-panel" style={{ padding: '2.5rem', marginBottom: '2.5rem', border: '1px solid var(--color-teal)' }}>
          <h2 style={{ marginBottom: '1.5rem', color: 'var(--color-teal)' }}>{t('add_song')}</h2>
          <form action={async (data) => { await createSong(data); setShowForm(false); }} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.2rem' }}>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginLeft: '4px' }}>Název skladby</label>
                  <input name="title" placeholder="např. Sladké mámení" required style={{ padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', borderRadius: '10px' }} />
               </div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginLeft: '4px' }}>Interpret</label>
                  <input name="artist" placeholder="např. Helena Vondráčková" style={{ padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', borderRadius: '10px' }} />
               </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.2rem' }}>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginLeft: '4px' }}>Žánr</label>
                  <input name="genre" placeholder="Pop, Rock..." style={{ padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', borderRadius: '10px' }} />
               </div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginLeft: '4px' }}>Štítky (čárkou)</label>
                  <input name="tags" placeholder="Duet, Svatební..." style={{ padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', borderRadius: '10px' }} />
               </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
               <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginLeft: '4px' }}>Text písně k zobrazení/klíčování</label>
               <textarea name="lyrics" placeholder="Sem vložte text písně..." style={{ padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', borderRadius: '10px', minHeight: '150px' }} />
            </div>
            <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-end', padding: '12px 32px' }}>Uložit do Katalogu</button>
          </form>
        </div>
      )}

      {/* FILTRAČNÍ PANEL */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2.5rem', background: 'rgba(255,255,255,0.03)', padding: '1.2rem', borderRadius: '16px', flexWrap: 'wrap', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
        <input 
           type="text" 
           placeholder={t('search_placeholder')}
           value={search} onChange={e => setSearch(e.target.value)}
           style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.4)', color: '#fff', flex: 1, minWidth: '220px' }}
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}>
            <option value="ALL">{t('all_status')}</option>
            <option value="MISSING_AUDIO">1. {t('status_audio')}</option>
            <option value="MISSING_TIMING">2. {t('status_timing')}</option>
            <option value="MISSING_RENDER">3. {t('status_render')}</option>
            <option value="DONE">4. {t('status_done')}</option>
        </select>
        {allGenres.length > 0 && (
          <select value={genreFilter} onChange={e => setGenreFilter(e.target.value)} style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}>
              <option value="ALL">{t('all_genres')}</option>
              {allGenres.map(g => <option key={g as string} value={g as string}>{g as string}</option>)}
          </select>
        )}
        {allTags.length > 0 && (
          <select value={tagFilter} onChange={e => setTagFilter(e.target.value)} style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}>
              <option value="ALL">{t('all_tags')}</option>
              {allTags.map(tag => <option key={tag as string} value={tag as string}>#{tag as string}</option>)}
          </select>
        )}
      </div>

      {/* SEZNAM PÍSNÍ */}
      {filteredSongs.length === 0 ? (
         <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '5rem 1rem', background: 'rgba(0,0,0,0.1)', borderRadius: '20px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎵</div>
            <p>Žádné písně neodpovídají zvoleným filtrům.</p>
         </div>
      ) : (
         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 400px), 1fr))', gap: '1.5rem' }}>
          {filteredSongs.map((song) => {
            const hasAudio = !!song.audioUrl;
            const canPlay = !!song.videoUrl || !!song.timingData || !!song.jsonUrl;
            const hasJson = !!song.jsonUrl || !!song.timingData;

            return (
              <div key={song.id} className="glass-panel song-card-admin" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                      {song.artist && <span style={{ color: 'var(--color-gold)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{song.artist}</span>}
                      <h3 style={{ fontSize: '1.4rem', margin: '4px 0', color: 'white' }}>{song.title}</h3>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                         {song.genre && <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '10px' }}>{song.genre}</span>}
                         {Array.isArray(song.tags) && song.tags.map((t: string) => (
                           <span key={t} style={{ fontSize: '10px', background: 'rgba(0,229,255,0.08)', color: 'var(--color-teal)', padding: '2px 8px', borderRadius: '10px' }}>#{t}</span>
                         ))}
                      </div>
                  </div>
                  <button 
                    onClick={async () => { if(confirm(t('delete_confirm'))) await deleteSong(song.id); }} 
                    style={{ background: 'rgba(255,0,0,0.1)', border: 'none', color: '#ff4444', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                    title={t('delete_btn')}
                  >
                    🗑️
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                   <button onClick={() => setEditingSong(song)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                     ⚙️ {t('edit_btn') || 'Detail / Upravit'}
                   </button>
                </div>

                {/* STATUS BAR */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', background: 'rgba(0,0,0,0.3)', padding: '1.2rem', borderRadius: '12px' }}>
                    
                    {/* BG & JSON Flow */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', color: song.backgroundUrl ? 'var(--color-teal)' : '#666' }}>🖼️ Pozadí (Grafika)</span>
                        {song.backgroundUrl && <span style={{ color: '#4ade80', fontSize: '11px' }}>✓ OK</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                         {song.backgroundUrl && (
                           <button 
                             onClick={async () => { if(confirm("Opravdu smazat pozadí?")) await removeSongResource(song.id, 'background'); }}
                             style={{ background: 'rgba(255,0,0,0.1)', border: 'none', color: '#ff4444', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                             title="Smazat soubor"
                           >🗑️</button>
                         )}
                         <AudioUploader songId={song.id} type="background" />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', color: hasJson ? 'var(--color-teal)' : '#666' }}>2. Časování (Studio)</span>
                        {hasJson && <span style={{ color: '#4ade80', fontSize: '11px' }}>✓ Zklíčováno</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                         {song.jsonUrl && (
                           <button 
                             onClick={async () => { if(confirm("Opravdu smazat soubor časování?")) await removeSongResource(song.id, 'json'); }}
                             style={{ background: 'rgba(255,0,0,0.1)', border: 'none', color: '#ff4444', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                             title="Smazat soubor"
                           >🗑️</button>
                         )}
                         <AudioUploader songId={song.id} type="json" />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <span style={{ fontSize: '13px', color: hasAudio ? 'var(--color-teal)' : '#666' }}>{t('step_audio')} (Originál)</span>
                         <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {song.audioUrl && (
                               <button 
                                 onClick={async () => { if(confirm("Opravdu smazat originální audio?")) await removeSongResource(song.id, 'audio'); }}
                                 style={{ background: 'rgba(255,0,0,0.1)', border: 'none', color: '#ff4444', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                                 title="Smazat soubor"
                               >🗑️</button>
                            )}
                            {hasAudio ? <span style={{ color: '#4ade80', fontSize: '13px' }}>✓ OK</span> : <AudioUploader songId={song.id} />}
                         </div>
                       </div>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                         <span style={{ fontSize: '13px', color: song.instrumentalUrl ? 'var(--color-teal)' : '#666' }}>🎤 Instrumentál (Karaoke)</span>
                         <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {song.instrumentalUrl && (
                               <button 
                                 onClick={async () => { if(confirm("Opravdu smazat instrumentální audio?")) await removeSongResource(song.id, 'instrumental'); }}
                                 style={{ background: 'rgba(255,0,0,0.1)', border: 'none', color: '#ff4444', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                                 title="Smazat soubor"
                               >🗑️</button>
                            )}
                            {song.instrumentalUrl ? <span style={{ color: '#4ade80', fontSize: '13px' }}>✓ OK</span> : <AudioUploader songId={song.id} type="instrumental" />}
                         </div>
                       </div>
                    </div>

                     {/* Studio Flow */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', opacity: hasAudio ? 1 : 0.4 }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <span style={{ fontSize: '13px', color: hasJson ? 'var(--color-teal)' : '#666' }}>{t('step_studio')} (Timing)</span>
                         <div style={{ display: 'flex', gap: '8px' }}>
                            {hasAudio && !hasJson && (
                               <button 
                                 onClick={async () => {
                                   if(confirm("Spustit AI klíčování? (Může to trvat až minutu)")) {
                                      const res = await autoAlignSong(song.id);
                                      if (res.success) alert("🪄 AI kouzlo dokončeno! Zkontrolujte v Designeru.");
                                      else alert("❌ AI se nepodařilo zklíčovat audio: " + res.error);
                                   }
                                 }}
                                 className="btn-secondary" 
                                 style={{ padding: '6px 12px', fontSize: '11px', background: 'rgba(125,86,243,0.15)', color: 'var(--color-gold)', border: '1px solid rgba(255,215,0,0.2)' }}
                               >
                                 🪄 AI Auto-Klíčovat
                               </button>
                            )}
                            {hasJson ? (
                               <span style={{ color: '#4ade80', fontSize: '13px' }}>✓ Zklíčováno</span>
                            ) : (
                               <div style={{ display: 'flex', gap: '8px' }}>
                                  <Link href={`/designer?songId=${song.id}`}>
                                     <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '11px' }} disabled={!hasAudio}>Spustit Studio</button>
                                  </Link>
                                  <AudioUploader songId={song.id} type="json" />
                               </div>
                            )}
                         </div>
                       </div>
                    </div>

                    {/* Render Flow */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: hasJson ? 1 : 0.4 }}>
                      <span style={{ fontSize: '13px', color: song.videoUrl ? 'var(--color-teal)' : '#666' }}>{t('step_render')}</span>
                      {song.videoUrl ? (
                         <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ color: '#4ade80', fontSize: '13px' }}>✓ Publikováno {song.videoSize ? `(${ (song.videoSize / 1024 / 1024).toFixed(1) } MB)` : ''}</span>
                            <a href={song.videoUrl} download={`${song.title}.webm`} target="_blank" style={{ textDecoration: 'none', background: 'rgba(255,255,255,0.08)', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', color: 'var(--color-gold)', border: '1px solid rgba(255,215,0,0.2)' }} title="Stáhnout video do PC">💾 Stáhnout</a>
                         </div>
                      ) : (
                         <Link href={`/renderer?songId=${song.id}`}>
                            <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '11px' }} disabled={!hasJson}>Spustit Render</button>
                         </Link>
                      )}
                    </div>
                </div>

                {/* PLAY BUTTON JEN ADMINI KONTROLA */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {canPlay && (
                    <Link href={`/player/${song.id}`} title="Zpívat" style={{ flex: 1 }}>
                      <button className="btn-primary" style={{ width: '100%', padding: '10px' }}>🎤 Zpívat</button>
                    </Link>
                  )}
                  {hasJson && (
                    <Link href={`/designer?songId=${song.id}`} style={{ flex: canPlay ? 0 : 1 }}>
                       <button className="btn-secondary" style={{ width: '100%', padding: '10px' }} title="Upravit časování">⚙️ Studio</button>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
         </div>
      )}
      {editingSong && <SongEditModal song={editingSong} onClose={() => setEditingSong(null)} />}
    </div>
  );
}
