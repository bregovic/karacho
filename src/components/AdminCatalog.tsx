'use client';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AudioUploader from '@/components/AudioUploader';
import BulkUploader from '@/components/BulkUploader';
import SongEditModal from '@/components/SongEditModal';
import { createSong, deleteSong, updateSong, removeSongResource, bulkRemoveBackground, bulkUpdateState, fetchLyricsAction, bulkFetchMissingLyrics, checkDuplicateSong, researchSongDataAction, bulkUpdateMetadata, getAdminStats, manageGenreAction, manageTagAction, getTaxonomyAction } from '@/app/admin/actions';
import { autoAlignSong } from '@/app/admin/auto-align';
import { vratMeziPublikovane, vyresHlaseni } from '@/app/actions/report-actions';
import { obsahuje } from '@/lib/hledani';
import { useUlozenyStav } from '@/lib/ulozenyStav';
import { delkaPisne, formatDelka, delkaProRazeni } from '@/lib/delka';
import { useTranslation } from '@/lib/translations';

import AdminTeam from '@/components/AdminTeam';

export default function AdminCatalog({ 
  initialSongs,
  adminEmails = []
}: { 
  initialSongs: any[],
  adminEmails?: any[]
}) {
  const t = useTranslation('cs');
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'SONGS' | 'TEAM' | 'TECH'>('SONGS');
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useUlozenyStav('karacho-admin-stav', 'UNPUBLISHED');
  const [razeni, setRazeni] = useUlozenyStav<'VYCHOZI' | 'NEJKRATSI' | 'NEJDELSI'>('karacho-admin-razeni', 'VYCHOZI');
  // ... rest of state
  const [genreFilter, setGenreFilter] = useUlozenyStav('karacho-admin-zanr', 'ALL');
  const [tagFilter, setTagFilter] = useUlozenyStav('karacho-admin-stitek', 'ALL');
  const [search, setSearch] = useState('');
  const [editingSong, setEditingSong] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [displayCount, setDisplayCount] = useState(60);
  const [showTools, setShowTools] = useState(false);
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);
  const [bulkGenre, setBulkGenre] = useState('');
  const [bulkTags, setBulkTags] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [taxonomy, setTaxonomy] = useState<{genres: string[], tags: string[]}>({genres: [], tags: []});
  const [showTaxonomyManager, setShowTaxonomyManager] = useState(false);

  const fetchTaxonomy = async () => {
    const data = await getTaxonomyAction();
    if (data) setTaxonomy(data);
  };

  useEffect(() => {
     fetchTaxonomy();
  }, []);

  useEffect(() => {
    setDisplayCount(60);
  }, [search, genreFilter, tagFilter, statusFilter, razeni]);

  // Pomůcka pro určení stavu workflow
  const getWorkflowStep = (s: any) => {
    // Nahlášená chyba přebíjí všechno ostatní — dokud se neopraví, je jedno,
    // že píseň má komplet audio i časování.
    if (s.state === 'BAD_LYRICS') return 'BAD_LYRICS';
    if (s.state === 'BAD_SONG') return 'BAD_SONG';

    const hasLyrics = !!s.lyrics && s.lyrics.trim().length > 0;
    const hasAudio = !!s.audioUrl;
    const hasInstr = !!s.instrumentalUrl;
    const hasTiming = !!s.jsonUrl || !!s.timingData;
    const isActive = s.state === 'ACTIVE';

    if (!hasLyrics) return 'MISSING_LYRICS';
    if (!hasAudio) return 'MISSING_AUDIO';
    if (!hasInstr) return 'MISSING_INSTR';
    if (!hasTiming) return 'MISSING_TIMING';
    if (!isActive) return 'REVIEW';
    return 'ACTIVE';
  };

  /** Kolik písní čeká na opravu — číslo rovnou v nabídce filtru. */
  const pocetVeStavu = (stav: string) => initialSongs.filter(s => s.state === stav).length;

  const allGenres = Array.from(new Set(initialSongs.map(s => s.genre).filter(Boolean)));
  const allTags = Array.from(new Set(initialSongs.flatMap(s => s.tags || []).filter(Boolean)));
  const systemBackgrounds = [
    '/backgrounds/disco.png',
    '/backgrounds/rock.png',
    '/backgrounds/retro_80s.png',
    '/backgrounds/jazz.png',
    '/backgrounds/pop.png',
    '/backgrounds/country.png',
    '/backgrounds/hiphop.png',
    '/backgrounds/jungle.png',
    '/backgrounds/rocknroll.png',
    '/backgrounds/opera.png',
    '/backgrounds/hightech.png',
    '/backgrounds/matrix.png',
    '/backgrounds/tekkno.png',
    '/backgrounds/funk.png'
  ];

  const allBackgrounds = Array.from(new Set([
    ...systemBackgrounds,
    ...initialSongs.map(s => s.backgroundUrl).filter(Boolean)
  ]));

  /**
   * Řazení podle délky. Smysl to má hlavně ve dvojici s filtrem na stav:
   * vyfiltruju si „chybí časování" a zpracovávám od nejkratších, ať to
   * viditelně ubývá.
   */
  const serad = (seznam: any[]) => {
    if (razeni === 'VYCHOZI') return seznam;
    const smer = razeni === 'NEJKRATSI' ? 1 : -1;
    return [...seznam].sort((a, b) => {
      const da = delkaProRazeni(a);
      const db = delkaProRazeni(b);
      // Neznámá délka jde na konec bez ohledu na směr řazení.
      if (da === db) return 0;
      if (!Number.isFinite(da)) return 1;
      if (!Number.isFinite(db)) return -1;
      return (da - db) * smer;
    });
  };

  const filteredSongs = serad(initialSongs.filter(song => {
    const step = getWorkflowStep(song);
    
    if (statusFilter === 'UNPUBLISHED' && step === 'ACTIVE') return false;
    else if (statusFilter !== 'ALL' && statusFilter !== 'UNPUBLISHED' && step !== statusFilter) return false;
    if (genreFilter !== 'ALL' && song.genre !== genreFilter) return false;
    if (tagFilter !== 'ALL' && !(song.tags || []).includes(tagFilter)) return false;

    if (search &&
        !obsahuje(song.title, search) &&
        !obsahuje(song.artist, search) &&
        !(song.tags || []).some((t: string) => obsahuje(t, search))
    ) return false;

    return true;
  }));

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const isAllSelected = filteredSongs.length > 0 && filteredSongs.every(s => selectedIds.includes(s.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(prev => prev.filter(id => !filteredSongs.some(s => s.id === id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...filteredSongs.map(s => s.id)])));
    }
  };

  const exportSelectedMp3s = async () => {
    const songsToExport = initialSongs.filter(s => selectedIds.includes(s.id) && s.audioUrl);
    if (songsToExport.length === 0) {
      alert('Žádná z vybraných písní nemá audio.');
      return;
    }
    if (!confirm(`Opravdu stáhnout ${songsToExport.length} MP3 postupně?`)) return;

    for (const song of songsToExport) {
       setDownloadingUrl(`Stahuji: ${song.title}...`);
       try {
         const res = await fetch(song.audioUrl);
         const blob = await res.blob();
         const url = window.URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.href = url;
         const safeArtist = song.artist ? song.artist.replace(/[/\\?%*:|"<>]/g, '') : "Neznamy";
         const safeTitle = song.title.replace(/[/\\?%*:|"<>]/g, '');
         a.download = `${safeArtist} - ${safeTitle}.mp3`;
         document.body.appendChild(a);
         a.click();
         document.body.removeChild(a);
         window.URL.revokeObjectURL(url);
       } catch(err) {
         console.error("Chyba při stahování:", song.title, err);
       }
       await new Promise(r => setTimeout(r, 700));
    }
    setDownloadingUrl('Export dokončen!');
    setTimeout(() => setDownloadingUrl(null), 3000);
  };

  const enhanceSelectedSongs = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Opravdu zkusit dohledat chybějící texty a žánry pro ${selectedIds.length} vybraných písní přes naše api roboty? Může to chvíli trvat.`)) return;

    let success = 0;
    for (const id of selectedIds) {
       const s = initialSongs.find(x => x.id === id);
       setDownloadingUrl(`Hledám text pro: ${s?.title || 'Neznámý'}...`);
       try {
         const res = await researchSongDataAction(id);
         if (res && res.success) success++;
       } catch (err) {}
    }
    setDownloadingUrl(`Hotovo! Dohledána chybějící data a texty pro ${success} z ${selectedIds.length} písní.`);
    setTimeout(() => setDownloadingUrl(null), 4000);
  };

  const handleBulkUpdateMetadata = async () => {
   if (selectedIds.length === 0) return;
   const genre = bulkGenre.trim() || undefined;
   const tags = bulkTags.trim() ? bulkTags.split(',').map(t => t.trim()).filter(Boolean) : undefined;
   
   if (!genre && !tags) return;
   if (!confirm(`Opravdu chcete upravit žánr/tagy (Žánr: ${genre||'neměnit'}, Štítky: ${tags?tags.join(', '):'neměnit'}) pro ${selectedIds.length} písní?`)) return;

   await bulkUpdateMetadata(selectedIds, genre, tags);
   setBulkGenre('');
   setBulkTags('');
  };

  const fetchStats = async () => {
    setLoadingStats(true);
    const res = await getAdminStats();
    setStats(res);
    setLoadingStats(false);
  };

  const clearSelection = () => setSelectedIds([]);
  const selectAllFiltered = () => setSelectedIds(Array.from(new Set([...selectedIds, ...filteredSongs.map(s => s.id)])));

  const visibleSongs = filteredSongs.slice(0, displayCount);

  return (
    <div style={{ padding: 'clamp(0.75rem, 3vw, 2.5rem)', maxWidth: '1400px', margin: '0 auto', boxSizing: 'border-box', overflowX: 'hidden', width: '100%' }}>
          {/* NAVIGATION TABS */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setActiveTab('SONGS')}
          style={{ 
            padding: '12px 14px', 
            borderRadius: '14px', 
            border: 'none', 
            background: activeTab === 'SONGS' ? 'var(--color-teal)' : 'rgba(255,255,255,0.05)', 
            color: activeTab === 'SONGS' ? 'black' : 'white',
            fontWeight: 800,
            cursor: 'pointer',
            flex: '1 1 140px',
            fontSize: '12px',
            whiteSpace: 'nowrap'
          }}
        >
          🎵 KATALOG
        </button>
        <button 
          onClick={() => setActiveTab('TEAM')}
          style={{ 
            padding: '12px 14px', 
            borderRadius: '14px', 
            border: 'none', 
            background: activeTab === 'TEAM' ? 'var(--color-teal)' : 'rgba(255,255,255,0.05)', 
            color: activeTab === 'TEAM' ? 'black' : 'white',
            fontWeight: 800,
            cursor: 'pointer',
            flex: '1 1 140px',
            fontSize: '12px',
            whiteSpace: 'nowrap'
          }}
        >
          👥 TÝM
        </button>
        <Link href="/admin/tech" style={{ textDecoration: 'none', flex: '1 1 140px' }}>
          <button 
            style={{ 
              width: '100%',
              padding: '12px 14px', 
              borderRadius: '14px', 
              border: '1px solid rgba(255,215,0,0.2)', 
              background: 'rgba(255,215,0,0.1)', 
              color: 'var(--color-gold)',
              fontWeight: 800,
              cursor: 'pointer',
              fontSize: '12px',
              whiteSpace: 'nowrap'
            }}
          >
            ⚙️ TECH
          </button>
        </Link>
      </div>

      {activeTab === 'TEAM' ? (
        <AdminTeam adminEmails={adminEmails} />
      ) : (
        <>
          {/* KOMPAKTNÍ FILTRAČNÍ PULT */}
          <div className="admin-filters" style={{ 
            display: 'flex', gap: '0.75rem', marginBottom: '2rem', 
            background: 'rgba(255,255,255,0.03)', padding: '0.8rem', 
            borderRadius: '24px', flexWrap: 'wrap', alignItems: 'center', 
            border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}>
            <input 
              type="text" 
              placeholder={t('search_placeholder')}
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ padding: '12px 18px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.4)', color: '#fff', flex: '2 1 280px', fontSize: '14px', outline: 'none' }}
            />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ flex: '1 1 150px', padding: '12px', borderRadius: '14px', background: '#111', color: '#fff', fontSize: '12px', fontWeight: 700, border: '1px solid rgba(255,255,255,0.1)' }}>
                <option value="ALL">🔍 VŠECHNY STAVY</option>
                <option value="UNPUBLISHED">🛠️ NEPUBLIKOVANÉ</option>
                <option value="MISSING_LYRICS">✍️ TEXT</option>
                <option value="MISSING_AUDIO">🎵 AUDIO</option>
                <option value="MISSING_INSTR">🎻 INSTR.</option>
                <option value="MISSING_TIMING">⏱️ STUDIO</option>
                <option value="REVIEW">🚦 KONTROLA</option>
                <option value="ACTIVE">🟢 LIVE</option>
                <option value="BAD_LYRICS">✍️⚠️ ŠPATNÝ TEXT ({pocetVeStavu('BAD_LYRICS')})</option>
                <option value="BAD_SONG">⛔ ŠPATNÁ PÍSEŇ ({pocetVeStavu('BAD_SONG')})</option>
            </select>

            {/* Řazení podle délky — dává smysl hlavně ve dvojici s filtrem
                na stav: vyfiltrovat „chybí časování" a jít od nejkratších. */}
            <select
              value={razeni}
              onChange={e => setRazeni(e.target.value as typeof razeni)}
              title="Podle délky písně. U nenačasovaných se odhaduje z velikosti MP3."
              style={{ flex: '1 1 150px', padding: '12px', borderRadius: '14px', background: '#111', color: razeni === 'VYCHOZI' ? '#fff' : 'var(--color-gold)', fontSize: '12px', fontWeight: 700, border: `1px solid ${razeni === 'VYCHOZI' ? 'rgba(255,255,255,0.1)' : 'rgba(255,215,0,0.4)'}` }}
            >
                <option value="VYCHOZI">🕒 OD NEJNOVĚJŠÍCH</option>
                <option value="NEJKRATSI">⏱️ OD NEJKRATŠÍ</option>
                <option value="NEJDELSI">⏱️ OD NEJDELŠÍ</option>
            </select>
            <div style={{ display: 'flex', position: 'relative' }}>
                <button 
                  onClick={() => setShowTools(!showTools)}
                  className="btn-secondary"
                  style={{ padding: '12px 18px', borderRadius: '14px', background: 'rgba(255,255,255,0.05)', fontSize: '12px', fontWeight: 800, border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  ⚙️ NÁSTROJE {showTools ? '▲' : '▼'}
                </button>
            </div>
          </div>

          {/* Rozbalovací panel nástrojů */}
          <div style={{ display: showTools ? 'flex' : 'none', gap: '10px', background: 'rgba(0,0,0,0.3)', padding: '1.25rem', borderRadius: '24px', marginBottom: '2rem', flexWrap: 'wrap', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Link href="/admin/exchange" style={{ textDecoration: 'none' }}>
                <button className="btn-secondary" style={{ padding: '12px 20px', borderRadius: '14px', fontSize: '12px', fontWeight: 800, border: '1px solid #00ffa0', background: 'rgba(0,255,160,0.05)', color: '#00ffa0' }}>
                  📦 EXPORT/IMPORT KATALOGU
                </button>
              </Link>
              <Link href="/admin/audit" style={{ textDecoration: 'none' }}>
                <button className="btn-secondary" style={{ padding: '12px 20px', borderRadius: '14px', fontSize: '12px', fontWeight: 800, border: '1px solid #ffcc00', background: 'rgba(255,204,0,0.05)', color: '#ffcc00' }}>
                  🔍 AUDIT DAT
                </button>
              </Link>
              <button onClick={toggleSelectAll} className="btn-secondary" style={{ padding: '12px 20px', borderRadius: '14px', fontSize: '12px', fontWeight: 800 }}>
                  {isAllSelected ? "🔲 ODZNAČIT VŠE ZOBRAZENÉ" : "☑️ OZNAČIT VŠE ZOBRAZENÉ"}
              </button>
              <button onClick={exportSelectedMp3s} disabled={selectedIds.length === 0} className="btn-secondary" style={{ padding: '12px 20px', borderRadius: '14px', fontSize: '12px', fontWeight: 800, opacity: selectedIds.length ? 1 : 0.4, border: '1px solid rgba(255,255,255,0.1)' }}>
                  📥 EXPORT MP3 ({selectedIds.length})
              </button>
              <button onClick={enhanceSelectedSongs} disabled={selectedIds.length === 0} className="btn-secondary" style={{ padding: '12px 20px', borderRadius: '14px', fontSize: '12px', fontWeight: 800, opacity: selectedIds.length ? 1 : 0.4, border: '1px solid rgba(255,255,255,0.1)', color: 'var(--color-gold)' }}>
                  🤖 DOHLEDAT TEXTY ({selectedIds.length})
              </button>
              
              <div style={{ width: '1px', background: 'rgba(255,255,255,0.08)', margin: '0 8px' }} />
              
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                 <input value={bulkGenre} onChange={e=>setBulkGenre(e.target.value)} placeholder="Hromadný žánr..." list="genre-list" style={{ padding: '10px 14px', borderRadius: '12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '12px', width: '140px' }} />
                 <input value={bulkTags} onChange={e=>setBulkTags(e.target.value)} placeholder="Štítky (cz, pop)..." style={{ padding: '10px 14px', borderRadius: '12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '12px', width: '140px' }} />
                 <button onClick={handleBulkUpdateMetadata} disabled={selectedIds.length === 0 || (!bulkGenre && !bulkTags)} className="btn-primary" style={{ padding: '10px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: 800, opacity: (selectedIds.length > 0 && (bulkGenre || bulkTags)) ? 1 : 0.4 }}>
                    💾 ZAPSAT ({selectedIds.length})
                 </button>
              </div>

              <div style={{ width: '1px', background: 'rgba(255,255,255,0.08)', margin: '0 8px' }} />
              
              <BulkUploader initialSongs={initialSongs} />
              <button 
                className={showForm ? "btn-secondary" : "btn-primary"} 
                onClick={() => setShowForm(!showForm)}
                style={{ padding: '12px 24px', fontWeight: 900, borderRadius: '14px', fontSize: '12px' }}
              >
                {showForm ? 'ZAVŘÍT FORMULÁŘ' : `➕ PŘIDAT HUDBU`}
              </button>

              <div style={{ width: '1px', background: 'rgba(255,255,255,0.08)', margin: '0 8px' }} />

              <button onClick={fetchStats} disabled={loadingStats} className="btn-secondary" style={{ padding: '12px 20px', borderRadius: '14px', fontSize: '12px', fontWeight: 800, border: '1px solid var(--color-gold)', color: 'var(--color-gold)' }}>
                  📊 {loadingStats ? 'POČÍTÁM...' : 'STATISTIKY'}
              </button>

              <Link href="/admin/audit" style={{ textDecoration: 'none' }}>
                <button className="btn-secondary" style={{ padding: '12px 20px', borderRadius: '14px', fontSize: '12px', fontWeight: 800, border: '1px solid #a855f7', color: '#a855f7', background: 'rgba(168,85,247,0.08)' }}>
                  🔍 AUDIT DAT
                </button>
              </Link>

              <div style={{ width: '1px', background: 'rgba(255,255,255,0.08)', margin: '0 8px' }} />

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '6px 14px', borderRadius: '16px' }}>
                 <label style={{ fontSize: '10px', fontWeight: 800, color: '#888' }}>SPRÁVA ČÍSELNÍKŮ:</label>
                 <button onClick={() => setShowTaxonomyManager(true)} className="btn-secondary" style={{ fontSize: '10px', padding: '6px 12px', color: 'var(--color-gold)', border: '1px solid var(--color-gold)' }}>
                    🗃️ OTEVŘÍT SPRÁVCE
                 </button>
              </div>
          </div>

          {/* STATISTIKY DASHBOARD */}
          {stats && (
            <div className="glass-panel" style={{ padding: '2rem', borderRadius: '25px', background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.2)', marginBottom: '2rem', animation: 'fadeIn 0.4s ease-out' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ margin: 0, color: 'var(--color-gold)', fontWeight: 900 }}>📊 Panel Statistik</h3>
                  <button onClick={() => setStats(null)} style={{ background: 'none', border: 'none', color: '#ff4b2b', cursor: 'pointer', fontWeight: 800 }}>ZAVŘÍT ✕</button>
               </div>
               
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                     <label style={{ fontSize: '11px', opacity: 0.5, textTransform: 'uppercase', fontWeight: 800 }}>Kapacita Cloudu</label>
                     <div style={{ fontSize: '24px', fontWeight: 900, color: '#white', marginTop: '5px' }}>{stats.storage.human}</div>
                     <div style={{ fontSize: '12px', opacity: 0.4 }}>{stats.storage.files} souborů v R2</div>
                  </div>
                  
                  {stats.states.map((s: any) => (
                    <div key={s.state} style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                       <label style={{ fontSize: '11px', opacity: 0.5, textTransform: 'uppercase', fontWeight: 800 }}>Stav: {s.state}</label>
                       <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--color-teal)', marginTop: '5px' }}>{s.count}</div>
                       <div style={{ fontSize: '11px', opacity: 0.4 }}>písní</div>
                    </div>
                  ))}
               </div>
            </div>
          )}

          {downloadingUrl && (
            <div style={{ padding: '1rem', background: 'var(--color-teal)', color: 'black', borderRadius: '14px', marginBottom: '1rem', fontWeight: 800, textAlign: 'center' }}>
               {downloadingUrl}
            </div>
          )}
 
      {/* FORMULÁŘ PRO NOVOU PÍSEŇ */}
      {showForm && (
        <div className="glass-panel" style={{ marginBottom: '2.5rem', padding: '2.5rem', borderRadius: '32px', border: '1px solid var(--color-teal)', animation: 'slideDown 0.3s ease-out' }}>
          <h2 style={{ color: 'var(--color-gold)', marginBottom: '1.5rem', fontSize: '24px' }}>🎵 Přidat novou skladbu</h2>
          <form onSubmit={async (e) => { 
            e.preventDefault();
            const fd = new FormData(e.target as HTMLFormElement);
            const title = fd.get('title') as string;
            const artist = fd.get('artist') as string;
            
            const dup = await checkDuplicateSong(title, artist);
            if (dup) {
              if (!confirm(`⚠️ Píseň "${dup.title}" od "${dup.artist || '?'}" už v katalogu existuje (ID: ${dup.id}, Stav: ${dup.state}). Chcete ji i přesto vytvořit znovu?`)) {
                return;
              }
            }
            
            await createSong(fd); 
            setShowForm(false); 
          }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-teal)', textTransform: 'uppercase' }}>Název skladby *</label>
              <input name="title" required placeholder="Např. Zvonky štěstí" style={{ padding: '14px', borderRadius: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-teal)', textTransform: 'uppercase' }}>Interpret</label>
              <input name="artist" placeholder="Např. Karel Gott" style={{ padding: '14px', borderRadius: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-teal)', textTransform: 'uppercase' }}>Žánr</label>
              <input name="genre" list="genre-list" placeholder="Např. Pop, Rock..." style={{ padding: '14px', borderRadius: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
              <datalist id="genre-list">
                {allGenres.map(g => <option key={g as string} value={g as string} />)}
              </datalist>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-teal)', textTransform: 'uppercase' }}>Štítky (oddělené čárkou)</label>
              <input name="tags" placeholder="cz, 80s, duo..." style={{ padding: '14px', borderRadius: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-teal)', textTransform: 'uppercase' }}>Text písně (Základní lyrics)</label>
              <textarea name="lyrics" rows={6} placeholder="Zkopírujte sem text písně..." style={{ padding: '14px', borderRadius: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button type="submit" className="btn-primary" style={{ padding: '16px 40px', background: 'var(--color-teal)', borderRadius: '16px', fontWeight: 900 }}>💾 ULOŽIT PÍSEŇ</button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)} style={{ padding: '16px 40px', borderRadius: '16px', fontWeight: 900 }}>ZRUŠIT</button>
            </div>
          </form>
          <style jsx>{`
            @keyframes slideDown {
              from { opacity: 0; transform: translateY(-20px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}

      {/* SEZNAM PÍSNÍ */}
      {filteredSongs.length === 0 ? (
         <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '5rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '30px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎵</div>
            <p>Žádné písně neodpovídají zvoleným filtrům.</p>
         </div>
      ) : (
         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 380px), 1fr))', gap: '2rem', marginBottom: '3rem' }}>
          {visibleSongs.map((song) => {
            const hasAudio = !!song.audioUrl;
            const hasJson = !!song.jsonUrl || !!song.timingData;
            const canPlay = hasJson;

            return (
              <div key={song.id} className="glass-panel song-card-admin" style={{ padding: 'min(1.5rem, 4vw)', display: 'flex', flexDirection: 'column', gap: '1.2rem', borderRadius: '28px', transition: 'all 0.3s', boxSizing: 'border-box', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, overflow: 'hidden', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(song.id)} 
                        onChange={() => toggleSelect(song.id)}
                        style={{ width: '22px', height: '22px', cursor: 'pointer', accentColor: 'var(--color-teal)' }} 
                      />
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                          <input 
                            defaultValue={song.artist || ''} 
                            onBlur={(e) => updateSong(song.id, { artist: e.target.value })}
                            placeholder="Interpret / Autor"
                            style={{ background: 'none', border: 'none', color: 'var(--color-gold)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', width: '100%', outline: 'none', padding: 0 }} 
                          />
                          <input 
                            defaultValue={song.title} 
                            onBlur={(e) => updateSong(song.id, { title: e.target.value })}
                            placeholder="Název písně"
                            style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', fontWeight: 900, width: '100%', outline: 'none', margin: '4px 0', padding: 0 }} 
                          />
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px', alignItems: 'center' }}>
                             {song.genre && <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '10px', fontWeight: 700, marginRight: '8px' }}>{song.genre}</span>}
                             
                             <span style={{ fontSize: '14px', filter: !!song.audioUrl ? 'none' : 'grayscale(1) opacity(0.2)', transition: 'all 0.3s' }} title={!!song.audioUrl ? "MP3 Nahráno" : "Chybí MP3"}>🎵</span>
                             <span style={{ fontSize: '14px', filter: !!song.instrumentalUrl ? 'none' : 'grayscale(1) opacity(0.2)', transition: 'all 0.3s' }} title={!!song.instrumentalUrl ? "Instrumental Nahrán" : "Chybí Instrumental"}>🎻</span>
                             <span style={{ fontSize: '14px', filter: (!!song.lyrics && song.lyrics.trim().length > 0) ? 'none' : 'grayscale(1) opacity(0.2)', transition: 'all 0.3s' }} title={(!!song.lyrics && song.lyrics.trim().length > 0) ? "Text je připraven" : "Chybí Text"}>✍️</span>
                             <span style={{ fontSize: '14px', filter: (!!song.jsonUrl || !!song.timingData) ? 'none' : 'grayscale(1) opacity(0.2)', transition: 'all 0.3s' }} title={(!!song.jsonUrl || !!song.timingData) ? "Časování Dokončeno" : "Chybí Časování JSON"}>⏱️</span>

                             {(() => {
                               const d = delkaPisne(song);
                               if (!d) return null;
                               return (
                                 <span
                                   title={d.presna
                                     ? 'Přesná délka z načasování'
                                     : 'Odhad z velikosti MP3 (128 kb/s) — přesnou délku známe až po načasování'}
                                   style={{ fontSize: '11px', fontWeight: 700, opacity: d.presna ? 0.75 : 0.45, fontVariantNumeric: 'tabular-nums' }}
                                 >
                                   {formatDelka(d)}
                                 </span>
                               );
                             })()}

                             {song.state === 'ACTIVE' && <span style={{ fontSize: '10px', background: 'rgba(0,177,64,0.15)', color: '#4ade80', padding: '4px 10px', borderRadius: '10px', fontWeight: 900, marginLeft: 'auto' }}>LIVE ✅</span>}
                             {song.state === 'BAD_LYRICS' && <span style={{ fontSize: '10px', background: 'rgba(255,204,0,0.15)', color: '#ffcc00', padding: '4px 10px', borderRadius: '10px', fontWeight: 900, marginLeft: 'auto' }}>ŠPATNÝ TEXT ✍️⚠️</span>}
                             {song.state === 'BAD_SONG' && <span style={{ fontSize: '10px', background: 'rgba(255,75,43,0.15)', color: '#ff8a70', padding: '4px 10px', borderRadius: '10px', fontWeight: 900, marginLeft: 'auto' }}>ŠPATNÁ PÍSEŇ ⛔</span>}
                          </div>
                      </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={async () => { if(confirm('Načíst text z API?')) await fetchLyricsAction(song.id); }} style={{ background: 'rgba(0,177,64,0.1)', border: 'none', color: '#00B140', width: '38px', height: '38px', borderRadius: '12px', cursor: 'pointer' }} title="Načíst text">✍️</button>
                      <button onClick={() => setEditingSong(song)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', width: '38px', height: '38px', borderRadius: '12px', cursor: 'pointer' }} title="Upravit detail">⚙️</button>
                      <button onClick={() => { if(confirm('Smazat?')) deleteSong(song.id); }} style={{ background: 'rgba(255,75,43,0.1)', border: 'none', color: '#ff4b2b', width: '38px', height: '38px', borderRadius: '12px', cursor: 'pointer' }}>🗑️</button>
                  </div>
                </div>

                {/* NAHLÁŠENÉ CHYBY */}
                {(song.reports?.length > 0 || song.state === 'BAD_LYRICS' || song.state === 'BAD_SONG') && (
                  <div style={{ background: 'rgba(255,75,43,0.07)', border: '1px solid rgba(255,75,43,0.25)', borderRadius: '16px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {(song.reports || []).map((r: any) => (
                      <div key={r.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '12px' }}>
                        <span title={r.druh === 'PISEN' ? 'Špatná píseň' : 'Špatný text'}>{r.druh === 'PISEN' ? '⛔' : '✍️'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ wordBreak: 'break-word' }}>{r.popis}</div>
                          <div style={{ opacity: 0.45, fontSize: '10px', marginTop: '2px' }}>
                            {new Date(r.createdAt).toLocaleString('cs-CZ')}
                          </div>
                        </div>
                        <button
                          onClick={async () => { await vyresHlaseni(r.id, 'ponechat'); router.refresh(); }}
                          title="Jen odškrtnout hlášení, stav písně nechat být"
                          style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)', borderRadius: '8px', padding: '2px 8px', fontSize: '11px', cursor: 'pointer' }}
                        >✓</button>
                      </div>
                    ))}
                    {(song.state === 'BAD_LYRICS' || song.state === 'BAD_SONG') && (
                      <button
                        onClick={async () => {
                          if (!confirm('Píseň je opravená? Vrátí se mezi publikované a hlášení se odškrtnou.')) return;
                          await vratMeziPublikovane(song.id);
                          router.refresh();
                        }}
                        className="btn-secondary"
                        style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 800, border: '1px solid #4ade80', color: '#4ade80', background: 'rgba(74,222,128,0.06)', borderRadius: '12px' }}
                      >
                        ✅ Opraveno — vrátit do katalogu
                      </button>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto' }}>
                    <Link href={`/designer?songId=${song.id}`} style={{ flex: 1 }}>
                      <button className="btn-primary" style={{ width: '100%', padding: '12px', background: 'var(--color-teal)', fontWeight: 900, borderRadius: '14px', fontSize: '13px' }} disabled={!hasAudio}>🛠️ STUDIO</button>
                    </Link>
                    <Link href={`/player/${song.id}`} style={{ flex: 1 }}>
                      <button className="btn-primary" style={{ width: '100%', padding: '12px', background: 'linear-gradient(45deg, #FFD700, #FFA500)', color: '#000', fontWeight: 900, borderRadius: '14px', fontSize: '13px' }} disabled={!hasJson}>▶ PŘEHRÁT</button>
                    </Link>
                </div>
              </div>
            );
          })}
         </div>
      )}

      {filteredSongs.length > 0 && displayCount < filteredSongs.length && (
         <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <button 
              className="btn-secondary" 
              onClick={() => setDisplayCount(prev => prev + 60)} 
              style={{ padding: '15px 40px', borderRadius: '50px', fontSize: '14px', fontWeight: 800, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer' }}
            >
              🔽 NAČÍST DALŠÍCH ({filteredSongs.length - displayCount})
            </button>
         </div>
      )}

      {/* STICKY BULK ACTIONS BAR */}
      {selectedIds.length > 0 && (
        <div style={{
          position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(15px)',
          padding: '1rem 2rem', borderRadius: '24px', border: '2px solid var(--color-teal)',
          display: 'flex', alignItems: 'center', gap: '2rem', zIndex: 1000,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)', animation: 'slideIn 0.3s ease-out'
        }}>
           <div style={{ color: 'white', fontWeight: 800 }}>
             Vybráno: <span style={{ color: 'var(--color-teal)' }}>{selectedIds.length}</span> písní
           </div>
           <div style={{ display: 'flex', gap: '10px' }}>
             <button onClick={async () => { if(confirm('Zveřejnit vybrané písně?')) { await bulkUpdateState(selectedIds, 'ACTIVE'); clearSelection(); } }} className="btn-primary" style={{ padding: '10px 20px', background: 'var(--color-teal)', borderRadius: '14px' }}>🚀 PUBLIKOVAT VYBRANÉ</button>
             <button onClick={clearSelection} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '0 10px' }}>Zrušit</button>
           </div>
        </div>
      )}
      {/* MODÁL PRO SPRÁVU TAXONOMIE */}
      {showTaxonomyManager && (
         <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="glass-panel" style={{ width: 'min(90vw, 600px)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: '2.5rem', borderRadius: '32px', position: 'relative' }}>
                <button onClick={() => { setShowTaxonomyManager(false); fetchTaxonomy(); }} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: '#888', fontSize: '24px', cursor: 'pointer' }}>✕</button>
                <h2 style={{ margin: '0 0 1.5rem', fontSize: '24px', fontWeight: 900 }}>🗃️ Správce číselníků</h2>
                
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    
                    {/* ŽÁNRY */}
                    <div>
                       <h3 style={{ fontSize: '12px', fontWeight: 900, color: 'var(--color-gold)', letterSpacing: '0.1em', marginBottom: '1rem' }}>🎸 EXISTUJÍCÍ ŽÁNRY</h3>
                       <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {taxonomy.genres.map(g => (
                             <div key={g} style={{ background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '14px', fontWeight: 600 }}>{g}</span>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                   <button onClick={async () => {
                                      const n = prompt(`Přejmenovat žánr "${g}" na:`, g);
                                      if (n && n !== g) { await manageGenreAction(g, n); fetchTaxonomy(); }
                                   }} style={{ background: 'none', border: 'none', fontSize: '12px', cursor: 'pointer' }}>✏️</button>
                                   <button onClick={async () => {
                                      if (confirm(`Opravdu SMAZAT žánr "${g}" u všech skladeb?`)) { await manageGenreAction(g, null); fetchTaxonomy(); }
                                   }} style={{ background: 'none', border: 'none', fontSize: '12px', cursor: 'pointer' }}>🗑️</button>
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>

                    {/* TAGY */}
                    <div>
                       <h3 style={{ fontSize: '12px', fontWeight: 900, color: 'var(--color-teal)', letterSpacing: '0.1em', marginBottom: '1rem' }}>🏷️ POUŽÍVANÉ ŠTÍTKY</h3>
                       <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {taxonomy.tags.map(t => (
                             <div key={t} style={{ background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '14px', fontWeight: 600 }}>{t}</span>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                   <button onClick={async () => {
                                      const n = prompt(`Přejmenovat štítek "${t}" na:`, t);
                                      if (n && n !== t) { await manageTagAction(t, n); fetchTaxonomy(); }
                                   }} style={{ background: 'none', border: 'none', fontSize: '12px', cursor: 'pointer' }}>✏️</button>
                                   <button onClick={async () => {
                                      if (confirm(`Opravdu ODSTRANIT štítek "${t}" ze všech skladeb?`)) { await manageTagAction(t, null); fetchTaxonomy(); }
                                   }} style={{ background: 'none', border: 'none', fontSize: '12px', cursor: 'pointer' }}>🗑️</button>
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>

                </div>

                <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                   <p style={{ fontSize: '11px', color: '#666' }}>Změny se projeví v celém katalogu okamžitě. Přejmenováním duplicitního názvu na jiný existující dojde k jejich sloučení.</p>
                </div>
            </div>
         </div>
      )}

      {/* EXISTUJÍCÍ SONG MODÁLY */}
      {editingSong && (
        <SongEditModal 
          song={editingSong} 
          onClose={() => setEditingSong(null)} 
          allGenres={allGenres as string[]} 
          allBackgrounds={allBackgrounds as string[]}
          allSongs={initialSongs}
          onRemoveBackground={bulkRemoveBackground}
          onRefresh={() => router.refresh()} 
        />
      )}
        </>
      )}
    </div>
  );
}
