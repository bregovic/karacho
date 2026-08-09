'use client';

import { useState, useEffect } from 'react';
import { updateTechnicalConfig, getTechnicalConfig, getAdminAuditLog } from '@/app/actions/admin-extra-actions';

export default function AdminTechPage() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [category, setCategory] = useState('CLOUD');

  const loadData = async () => {
    const c = await getTechnicalConfig();
    const l = await getAdminAuditLog();
    setConfigs(c);
    setAuditLog(l);
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
