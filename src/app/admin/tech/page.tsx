'use client';

import { useState, useEffect } from 'react';
import { updateTechnicalConfig, getTechnicalConfig, getAdminAuditLog, getUsageStats, cleanupSessionsAction, najdiOsireleSouboryAction, smazOsireleSouboryAction } from '@/app/actions/admin-extra-actions';

export default function AdminTechPage() {
  const [stats, setStats] = useState<any>(null);
  const [cleaning, setCleaning] = useState(false);
  const [configs, setConfigs] = useState<any[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [category, setCategory] = useState('CLOUD');

  const loadData = async () => {
    const c = await getTechnicalConfig();
    const l = await getAdminAuditLog();
    const st = await getUsageStats();
    setConfigs(c);
    setAuditLog(l);
    setStats(st);
  };

  const [osirele, setOsirele] = useState<{ pocet: number; bajtu: number; ukazka: string[] } | null>(null);
  const [hledamOsirele, setHledamOsirele] = useState(false);
  const [mazuOsirele, setMazuOsirele] = useState(false);

  const handleNajdiOsirele = async () => {
    setHledamOsirele(true);
    try {
      setOsirele(await najdiOsireleSouboryAction());
    } catch (e: any) {
      alert(`Nepodařilo se projít úložiště: ${e.message}`);
    } finally {
      setHledamOsirele(false);
    }
  };

  const handleSmazOsirele = async () => {
    if (!osirele) return;
    if (!confirm(`Opravdu smazat ${osirele.pocet} souborů (${(osirele.bajtu / 1024 / 1024).toFixed(1)} MB)? Z R2 se mažou natrvalo.`)) return;
    setMazuOsirele(true);
    try {
      const r = await smazOsireleSouboryAction();
      alert(`Smazáno ${r.smazano} souborů (${(r.bajtu / 1024 / 1024).toFixed(1)} MB).`);
      setOsirele(null);
    } catch (e: any) {
      alert(`Úklid selhal: ${e.message}`);
    } finally {
      setMazuOsirele(false);
    }
  };

  const handleCleanup = async () => {
    if (!confirm('Smazat všechny relace bez aktivity déle než 24 h?')) return;
    setCleaning(true);
    const res = await cleanupSessionsAction();
    setCleaning(false);
    alert(`Smazáno relací: ${res.smazano}`);
    loadData();
  };

  // Přístup hlídá middleware (jen ADMIN), data se načtou rovnou po otevření.
  useEffect(() => {
    loadData();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey) return;
    await updateTechnicalConfig(newKey, newValue, category);
    setNewKey('');
    setNewValue('');
    loadData();
  };


  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: 'white', padding: '6rem 2rem 2rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '3rem', color: 'var(--color-gold)' }}>⚙️ Technická konfigurace</h1>

        {/* PŘEHLED VYUŽITÍ */}
        {stats && (
          <section style={{ marginBottom: '3rem' }}>
            <h2 style={{ fontSize: '18px', marginBottom: '1.5rem', opacity: 0.8 }}>📊 Přehled využití</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem' }}>
              <Stat label="Přehrání celkem" value={stats.prehraniCelkem} hint="včetně nepřihlášených hostů" />
              <Stat label="Zpěvy se zpěvákem" value={stats.zpevyCelkem} hint={`za 30 dní ${stats.zpevy30} · za 7 dní ${stats.zpevy7}`} />
              <Stat label="Relace živé" value={stats.relaceZive} hint={`za celou dobu ${stats.relaceCelkem}`} />
              <Stat label="Písně" value={stats.pisneCelkem} hint={`publikovaných ${stats.pisneActive} · s časováním ${stats.pisneSCasovanim}`} />
              <Stat label="Uživatelé" value={stats.uzivatele} hint={`z toho adminů ${stats.adminu}`} />
              <Stat label="Admin akcí v logu" value={stats.adminAkci} />
            </div>

            {stats.topPisne?.length > 0 && (
              <div style={{ marginTop: '1.5rem', opacity: 0.85 }}>
                <h3 style={{ fontSize: '14px', marginBottom: '0.75rem', opacity: 0.7 }}>Nejhranější písně</h3>
                <ol style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '14px', lineHeight: 1.8 }}>
                  {stats.topPisne.map((p: any, i: number) => (
                    <li key={i}>{p.artist ? `${p.artist} – ` : ''}{p.title} <span style={{ opacity: 0.6 }}>({p.playCount}×)</span></li>
                  ))}
                </ol>
              </div>
            )}

            <button
              type="button"
              onClick={handleCleanup}
              disabled={cleaning}
              style={{ marginTop: '1.5rem', padding: '10px 18px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'white', cursor: 'pointer', fontSize: '13px' }}
            >
              {cleaning ? 'Uklízím…' : '🧹 Uklidit relace starší 24 h'}
            </button>

            {/* ÚKLID OSIŘELÝCH SOUBORŮ V R2 */}
            <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <h3 style={{ fontSize: '14px', margin: '0 0 0.5rem', fontWeight: 800 }}>Osiřelé soubory v úložišti</h3>
              <p style={{ fontSize: '12px', opacity: 0.55, margin: '0 0 1rem', lineHeight: 1.5 }}>
                Soubory, které se nahrály do R2, ale nepatří žádné písni, stopě ani profilu —
                typicky zbytky po importu, který spadl na duplicitu. Soubory mladší než hodinu
                a data jiných projektů v podsložkách se nepočítají.
              </p>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleNajdiOsirele}
                  disabled={hledamOsirele || mazuOsirele}
                  style={{ padding: '10px 18px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'white', cursor: 'pointer', fontSize: '13px' }}
                >
                  {hledamOsirele ? 'Počítám…' : '🔍 Spočítat'}
                </button>

                {osirele && osirele.pocet > 0 && (
                  <button
                    type="button"
                    onClick={handleSmazOsirele}
                    disabled={mazuOsirele}
                    style={{ padding: '10px 18px', borderRadius: '12px', border: '1px solid #ff4b2b', background: 'rgba(255,75,43,0.08)', color: '#ff8a70', cursor: 'pointer', fontSize: '13px', fontWeight: 800 }}
                  >
                    {mazuOsirele ? 'Mažu…' : `🗑️ Smazat ${osirele.pocet} souborů`}
                  </button>
                )}
              </div>

              {osirele && (
                <div style={{ marginTop: '1rem', fontSize: '12px' }}>
                  {osirele.pocet === 0 ? (
                    <span style={{ color: '#4ade80' }}>✅ Nic k úklidu, úložiště je čisté.</span>
                  ) : (
                    <>
                      <div><strong>{osirele.pocet}</strong> souborů, <strong>{(osirele.bajtu / 1024 / 1024).toFixed(1)} MB</strong></div>
                      <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem', opacity: 0.55, lineHeight: 1.6 }}>
                        {osirele.ukazka.map((k: string) => <li key={k} style={{ wordBreak: 'break-all' }}>{k}</li>)}
                      </ul>
                      {osirele.pocet > osirele.ukazka.length && (
                        <div style={{ opacity: 0.4, marginTop: '4px' }}>… a dalších {osirele.pocet - osirele.ukazka.length}</div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '3rem' }}>
          
          {/* FORMULÁŘ NASTAVENÍ */}
          <section>
            <div className="glass-panel" style={{ padding: '2rem', borderRadius: '25px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <h2 style={{ fontSize: '18px', marginBottom: '2rem' }}>Přidat/Upravit parametr</h2>
              <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
                  <option value="CLOUD">☁️ CLOUD</option>
                  <option value="EXCHANGE">📧 EXCHANGE SERVER</option>
                  <option value="GENERAL">⚙️ OBECNÉ</option>
                </select>
                <input placeholder="Klíč (např. R2_BUCKET)" value={newKey} onChange={e => setNewKey(e.target.value)} style={inputStyle} />
                <textarea placeholder="Hodnota" value={newValue} onChange={e => setNewValue(e.target.value)} style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }} />
                <button type="submit" className="btn-primary" style={{ width: '100%' }}>ULOŽIT KONFIGURACI</button>
              </form>
            </div>

            <div style={{ marginTop: '2rem' }}>
              <h3 style={{ fontSize: '14px', opacity: 0.5, marginBottom: '1rem' }}>STÁVAJÍCÍ NASTAVENÍ</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {configs.map(c => (
                  <div key={c.id} onClick={() => { setNewKey(c.key); setNewValue(c.value); setCategory(c.category); }} style={{ padding: '12px 15px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', fontSize: '13px', cursor: 'pointer' }}>
                    <span style={{ color: 'var(--color-gold)', fontWeight: 800 }}>{c.key}</span>
                    <span style={{ marginLeft: '10px', opacity: 0.4 }}>[{c.category}]</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* AUDIT LOG */}
          <section>
            <div className="glass-panel" style={{ padding: '2rem', borderRadius: '25px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ fontSize: '18px', marginBottom: '2rem' }}>📋 Evidence provedených akcí (Audit Log)</h2>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {auditLog.length === 0 ? <p style={{ opacity: 0.3 }}>Žádné záznamy</p> : auditLog.map(log => (
                  <div key={log.id} style={{ padding: '15px', background: 'rgba(255,255,255,0.02)', borderRadius: '15px', borderLeft: '3px solid var(--color-gold)', fontSize: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ fontWeight: 800 }}>{log.action}</span>
                      <span style={{ opacity: 0.4, fontSize: '12px' }}>{new Date(log.createdAt).toLocaleString('cs')}</span>
                    </div>
                    <div style={{ opacity: 0.7 }}>{log.description}</div>
                    <div style={{ fontSize: '11px', opacity: 0.3, marginTop: '5px' }}>Admin: {log.admin.nickname || log.admin.email}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

const inputStyle: any = {
  padding: '12px 15px',
  borderRadius: '12px',
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'white',
  outline: 'none',
  fontSize: '14px',
  fontFamily: 'inherit'
};

/** Dlaždice jednoho čísla v přehledu využití. */
function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '18px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>{label}</div>
      <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--color-gold)', lineHeight: 1.2 }}>
        {value.toLocaleString('cs-CZ')}
      </div>
      {hint && <div style={{ fontSize: '12px', opacity: 0.55, marginTop: '0.25rem' }}>{hint}</div>}
    </div>
  );
}
