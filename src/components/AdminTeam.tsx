'use client';
import { useState } from 'react';
import { addAdminEmail, removeAdminEmail } from '@/app/admin/actions';

interface AdminTeamProps {
  adminEmails: any[];
}

export default function AdminTeam({ adminEmails }: AdminTeamProps) {
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;
    setLoading(true);
    try {
      await addAdminEmail(newEmail);
      setNewEmail('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '2.5rem', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.1)' }}>
      <h2 style={{ color: 'var(--color-gold)', marginBottom: '1.5rem', fontSize: '24px', fontWeight: 900 }}>👥 SPRÁVA TÝMU</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '14px' }}>
        Zde můžete přidat emaily osob, které mají mít po registraci automaticky administrátorská práva.
      </p>

      <form onSubmit={handleAdd} style={{ display: 'flex', gap: '1rem', marginBottom: '3rem' }}>
        <input 
          type="email" 
          placeholder="email@seznam.cz" 
          value={newEmail} 
          onChange={e => setNewEmail(e.target.value)}
          required
          style={{ 
            flex: 1, 
            padding: '14px 20px', 
            borderRadius: '16px', 
            background: 'rgba(0,0,0,0.3)', 
            border: '1px solid rgba(255,255,255,0.1)', 
            color: 'white',
            fontSize: '15px'
          }}
        />
        <button 
          type="submit" 
          className="btn-primary" 
          disabled={loading}
          style={{ padding: '14px 30px', background: 'var(--color-teal)', fontWeight: 900, borderRadius: '16px' }}
        >
          {loading ? 'PŘIDÁVÁM...' : '➕ PŘIDAT ADMINA'}
        </button>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-teal)', textTransform: 'uppercase', marginBottom: '8px' }}>Povolení administrátoři</label>
        {adminEmails.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', color: '#666' }}>
            Seznam je zatím prázdný.
          </div>
        ) : (
          adminEmails.map((item) => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontWeight: 600, color: '#ccc' }}>{item.email}</span>
              <button 
                onClick={async () => { if(confirm('Opravdu odebrat?')) await removeAdminEmail(item.id); }}
                style={{ background: 'none', border: 'none', color: '#ff4b2b', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}
              >
                ODEBRAT
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
