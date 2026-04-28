'use client';

import { useState } from 'react';
import Link from 'next/link';
import { auditSongsAction, batchFixSongsAction, getInternetSuggestionsAction } from '@/app/admin/actions';

type AuditIssue = {
  songId: string;
  title: string;
  artist: string;
  issueType: string;
  description: string;
  suggestedTitle?: string;
  suggestedArtist?: string;
  suggestedGenre?: string;
  suggestedTags?: string[];
  suggestedOrigin?: string;
  suggestedLyrics?: string;
  autoFixable: boolean;
};

const ISSUE_LABELS: Record<string, { icon: string; color: string; label: string }> = {
  YOUTUBE_JUNK: { icon: '🎬', color: '#ff4b2b', label: 'YouTube popisky' },
  ALL_CAPS_TITLE: { icon: '🔠', color: '#ff8c00', label: 'CAPS název' },
  ALL_CAPS_ARTIST: { icon: '🔠', color: '#ff8c00', label: 'CAPS interpret' },
  DOUBLE_SPACE_TITLE: { icon: '⬜', color: '#888', label: 'Dvojité mezery' },
  MISSING_ARTIST: { icon: '❓', color: '#ff6b6b', label: 'Chybí interpret' },
  POSSIBLE_SWAP: { icon: '🔄', color: '#a855f7', label: 'Prohozeno?' },
  ARTIST_IN_TITLE: { icon: '➡️', color: '#00d2ff', label: 'Interpret v názvu' },
  LONG_LYRICS_LINES: { icon: '📏', color: '#ffd700', label: 'Dlouhé řádky' },
  MISSING_LYRICS: { icon: '📝', color: '#ff6b6b', label: 'Chybí text' },
  DUPLICATE: { icon: '👯', color: '#ef4444', label: 'Duplicita' },
};

export default function AuditPage() {
  const [issues, setIssues] = useState<AuditIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filterType, setFilterType] = useState<string>('ALL');
  const [done, setDone] = useState(false);

  const runAudit = async () => {
    setLoading(true);
    setDone(false);
    setSelected(new Set());
    try {
      const result = await auditSongsAction();
      setIssues(result);
    } catch (e: any) {
      alert('Chyba: ' + e.message);
    }
    setLoading(false);
  };

  const toggleSelect = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectAllFixable = () => {
    const filtered = getFiltered();
    const allFixable = new Set<number>();
    filtered.forEach((issue, filteredIdx) => {
      const realIdx = issues.indexOf(issue);
      if (issue.autoFixable) allFixable.add(realIdx);
    });
    setSelected(allFixable);
  };

  const deselectAll = () => setSelected(new Set());

  const applyFixes = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Opravit ${selected.size} vybraných položek?`)) return;
    setFixing(true);
    try {
      const fixes = Array.from(selected)
        .filter(idx => issues[idx]?.autoFixable)
        .map(idx => {
          const issue = issues[idx];
          return {
            songId: issue.songId,
            title: issue.suggestedTitle,
            artist: issue.suggestedArtist,
            genre: issue.suggestedGenre,
            tags: issue.suggestedTags,
            origin: issue.suggestedOrigin,
            lyrics: issue.suggestedLyrics,
          };
        });
      const res = await batchFixSongsAction(fixes);
      alert(`✅ Opraveno ${res.fixed} písní!${res.errors?.length ? ` (${res.errors.length} chyb)` : ''}`);
      setSelected(new Set());
      setDone(true);
      // Re-run audit after a short delay to let revalidation settle
      setTimeout(async () => {
        try {
          const updated = await auditSongsAction();
          setIssues(updated);
        } catch (_) {}
        setFixing(false);
      }, 1000);
    } catch (e: any) {
      alert('Chyba při opravě: ' + (e.message || 'Neznámá chyba'));
      setFixing(false);
    }
  };

  const getFiltered = () => {
    if (filterType === 'ALL') return issues;
    return issues.filter(i => i.issueType === filterType);
  };

  const issueTypeCounts = issues.reduce((acc, i) => {
    acc[i.issueType] = (acc[i.issueType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const filtered = getFiltered();
  const fixableCount = filtered.filter(i => i.autoFixable).length;

  const validateAgainstInternet = async () => {
    setLoading(true);
    const updatedIssues = [...issues];
    let found = 0;

    for (let i = 0; i < updatedIssues.length; i++) {
      const issue = updatedIssues[i];
      // Hledáme jen pro ty, co nemají suggestion nebo jsou chybějící interpret
      if (!issue.suggestedTitle && !issue.suggestedArtist) {
        try {
          const sug = await getInternetSuggestionsAction(issue.title, issue.artist);
          if ((sug.title && sug.title !== issue.title) || (sug.artist && sug.artist !== issue.artist)) {
            updatedIssues[i] = {
              ...issue,
              suggestedTitle: sug.title,
              suggestedArtist: sug.artist,
              suggestedGenre: sug.genre,
              suggestedTags: sug.tags,
              suggestedOrigin: sug.origin,
              autoFixable: true,
              description: issue.description + ' (Metadata ověřena)'
            };
            found++;
          }
        } catch (e) {}
      }
    }
    
    if (found > 0) {
      setIssues(updatedIssues);
      alert(`🔎 Našel jsem ${found} návrhů z internetu!`);
    } else {
      alert('🔎 Internet nevrátil žádné lepší návrhy pro tyto položky.');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: 'white', padding: '6rem 2rem 2rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <Link href="/admin" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontSize: '13px' }}>← Zpět do Adminu</Link>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--color-gold)', margin: '0.5rem 0 0' }}>🔍 Audit dat katalogu</h1>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              onClick={validateAgainstInternet} 
              disabled={loading || issues.length === 0}
              style={{ 
                padding: '16px 24px', borderRadius: '50px', border: '1px solid #00d2ff',
                background: 'rgba(0,210,255,0.1)',
                color: '#00d2ff', fontWeight: 800, fontSize: '13px', cursor: (loading || issues.length === 0) ? 'wait' : 'pointer'
              }}
            >
              🌐 VALIDOVAT Z INTERNETU
            </button>
            <button 
              onClick={runAudit} 
              disabled={loading}
              style={{ 
                padding: '16px 32px', borderRadius: '50px', border: 'none',
                background: loading ? '#333' : 'linear-gradient(45deg, var(--color-gold), #FFA500)',
                color: '#000', fontWeight: 900, fontSize: '15px', cursor: loading ? 'wait' : 'pointer',
                boxShadow: '0 10px 30px rgba(255,215,0,0.2)'
              }}
            >
              {loading ? '⏳ Analyzuji...' : '🔬 SPUSTIT AUDIT'}
            </button>
          </div>
        </div>

        {issues.length > 0 && (
          <>
            {/* SOUHRN */}
            <div style={{ 
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
              gap: '10px', marginBottom: '2rem' 
            }}>
              <div 
                onClick={() => setFilterType('ALL')}
                style={{ 
                  padding: '14px 16px', borderRadius: '14px', cursor: 'pointer',
                  background: filterType === 'ALL' ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${filterType === 'ALL' ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.06)'}`,
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '28px', fontWeight: 900 }}>{issues.length}</div>
                <div style={{ fontSize: '11px', opacity: 0.5, fontWeight: 700 }}>CELKEM NÁLEZŮ</div>
              </div>
              {Object.entries(issueTypeCounts).sort(([,a],[,b]) => b - a).map(([type, count]) => {
                const info = ISSUE_LABELS[type] || { icon: '⚠️', color: '#fff', label: type };
                return (
                  <div 
                    key={type}
                    onClick={() => setFilterType(type === filterType ? 'ALL' : type)}
                    style={{ 
                      padding: '14px 16px', borderRadius: '14px', cursor: 'pointer',
                      background: filterType === type ? `${info.color}22` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${filterType === type ? info.color + '66' : 'rgba(255,255,255,0.06)'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '20px' }}>{info.icon}</span>
                      <span style={{ fontSize: '22px', fontWeight: 900, color: info.color }}>{count}</span>
                    </div>
                    <div style={{ fontSize: '11px', opacity: 0.5, fontWeight: 700, marginTop: '4px' }}>{info.label}</div>
                  </div>
                );
              })}
            </div>

            {/* AKČNÍ PANEL */}
            {fixableCount > 0 && (
              <div style={{ 
                display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', padding: '14px 20px',
                background: 'rgba(0,255,160,0.05)', borderRadius: '14px', border: '1px solid rgba(0,255,160,0.15)',
                flexWrap: 'wrap'
              }}>
                <button onClick={selectAllFixable} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(0,255,160,0.3)', background: 'rgba(0,255,160,0.1)', color: '#00ffa0', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>
                  ✅ Vybrat vše opravitelné ({fixableCount})
                </button>
                <button onClick={deselectAll} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                  Odznačit vše
                </button>
                {selected.size > 0 && (
                  <button 
                    onClick={applyFixes} 
                    disabled={fixing}
                    style={{ 
                      padding: '10px 24px', borderRadius: '10px', border: 'none',
                      background: 'linear-gradient(45deg, #00ffa0, #00d2ff)', 
                      color: '#000', fontSize: '13px', fontWeight: 900, cursor: 'pointer',
                      marginLeft: 'auto'
                    }}
                  >
                    {fixing ? '⏳ Opravuji...' : `🔧 OPRAVIT VYBRANÉ (${selected.size})`}
                  </button>
                )}
              </div>
            )}

            {/* TABULKA NÁLEZŮ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filtered.map((issue, filteredIdx) => {
                const realIdx = issues.indexOf(issue);
                const info = ISSUE_LABELS[issue.issueType] || { icon: '⚠️', color: '#fff', label: issue.issueType };
                const isSelected = selected.has(realIdx);

                return (
                  <div 
                    key={`${issue.songId}-${issue.issueType}-${filteredIdx}`}
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                      borderRadius: '12px', 
                      background: isSelected ? 'rgba(0,255,160,0.08)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isSelected ? 'rgba(0,255,160,0.3)' : 'rgba(255,255,255,0.04)'}`,
                      transition: 'all 0.15s',
                      cursor: issue.autoFixable ? 'pointer' : 'default',
                    }}
                    onClick={() => issue.autoFixable && toggleSelect(realIdx)}
                  >
                    {/* CHECKBOX */}
                    {issue.autoFixable ? (
                      <div style={{ 
                        width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
                        border: `2px solid ${isSelected ? '#00ffa0' : 'rgba(255,255,255,0.15)'}`,
                        background: isSelected ? '#00ffa0' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '14px', color: '#000', fontWeight: 900
                      }}>
                        {isSelected ? '✓' : ''}
                      </div>
                    ) : (
                      <div style={{ width: '22px', height: '22px', flexShrink: 0, borderRadius: '6px', background: 'rgba(255,255,255,0.03)', border: '2px solid rgba(255,255,255,0.06)' }} />
                    )}

                    {/* TYPE BADGE */}
                    <div style={{ 
                      padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 800,
                      background: info.color + '18', color: info.color, whiteSpace: 'nowrap', flexShrink: 0
                    }}>
                      {info.icon} {info.label}
                    </div>

                    {/* CONTENT */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span>{issue.title}</span>
                        {issue.artist && <span style={{ opacity: 0.4, fontSize: '12px' }}>— {issue.artist}</span>}
                      </div>
                      <div style={{ fontSize: '12px', opacity: 0.5, marginTop: '2px' }}>{issue.description}</div>
                    </div>

                    {/* SUGGESTION */}
                    {(issue.suggestedTitle || issue.suggestedArtist || issue.suggestedGenre || issue.suggestedOrigin) && (
                      <div style={{ 
                        fontSize: '12px', color: '#00ffa0', fontWeight: 600, textAlign: 'right',
                        maxWidth: '300px', flexShrink: 0
                      }}>
                        {issue.suggestedTitle && (
                          <div>→ <strong>{issue.suggestedTitle}</strong></div>
                        )}
                        {issue.suggestedArtist && (
                          <div style={{ opacity: 0.7 }}>→ Interpret: {issue.suggestedArtist}</div>
                        )}
                        {issue.suggestedGenre && (
                          <div style={{ opacity: 0.7, color: '#00d2ff' }}>→ Žánr: {issue.suggestedGenre}</div>
                        )}
                        {issue.suggestedOrigin && (
                          <div style={{ opacity: 0.7, color: '#ff8c00' }}>→ Původ: {issue.suggestedOrigin}</div>
                        )}
                        {issue.suggestedLyrics && (
                          <div style={{ opacity: 0.7, color: '#ff00ff' }}>→ Text bude automaticky zalomen</div>
                        )}
                      </div>
                    )}

                    {/* LINK */}
                    <Link 
                      href={`/designer?songId=${issue.songId}`} 
                      onClick={e => e.stopPropagation()}
                      style={{ 
                        padding: '6px 12px', borderRadius: '8px', 
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.4)', fontSize: '11px', textDecoration: 'none', 
                        flexShrink: 0, fontWeight: 700
                      }}
                    >
                      Upravit
                    </Link>
                  </div>
                );
              })}
            </div>

            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '4rem', opacity: 0.3 }}>
                <p style={{ fontSize: '48px' }}>✅</p>
                <p>Žádné nálezy pro tento filtr</p>
              </div>
            )}
          </>
        )}

        {!loading && issues.length === 0 && (
          <div style={{ textAlign: 'center', padding: '6rem 2rem' }}>
            <p style={{ fontSize: '80px', margin: 0 }}>🔍</p>
            <p style={{ fontSize: '20px', opacity: 0.4, marginTop: '1rem' }}>Klikněte na "Spustit audit" pro kontrolu kvality dat</p>
            <p style={{ fontSize: '14px', opacity: 0.25, marginTop: '0.5rem' }}>
              Kontroluje: YouTube popisky v názvech · CAPS · duplicity · chybějící interprety · dlouhé řádky v textu · a další
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
