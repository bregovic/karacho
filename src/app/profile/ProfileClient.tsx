'use client';

import { useState } from 'react';
import { updateProfile, changePassword } from '@/app/actions/user-actions';

export default function ProfileClient({ user, stats }: { user: any, stats: any }) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleProfileSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUpdating(true);
    const formData = new FormData(e.currentTarget);
    const res = await updateProfile(formData);
    setIsUpdating(false);
    if (res.success) setMsg({ type: 'success', text: 'Profil byl úspěšně aktualizován' });
    else setMsg({ type: 'error', text: 'Něco se nepovedlo' });
  };

  const handlePasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const res = await changePassword(formData);
    if (res.success) {
      setMsg({ type: 'success', text: 'Heslo bylo změněno' });
      e.currentTarget.reset();
    } else {
      setMsg({ type: 'error', text: res.error || 'Chyba při změně hesla' });
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '3rem' }}>
        <div style={{ 
          width: '120px', height: '120px', borderRadius: '50%', 
          background: `url(${user.image || '/logo.png'})`, backgroundSize: 'cover',
          border: '3px solid var(--color-gold)', boxShadow: '0 0 30px rgba(255,215,0,0.3)'
        }} />
        <div>
          <h1 style={{ fontSize: '3rem', fontWeight: 900, margin: 0, color: 'var(--color-gold)', letterSpacing: '-0.05em' }}>
            {user.nickname || user.name || 'Zpěvák'}
          </h1>
          <p style={{ opacity: 0.6, fontSize: '1.2rem' }}>{user.email}</p>
        </div>
      </div>

      {msg && (
        <div style={{ 
          padding: '1rem 2rem', borderRadius: '15px', marginBottom: '2rem',
          background: msg.type === 'success' ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)',
          border: `1px solid ${msg.type === 'success' ? '#4caf50' : '#f44336'}`,
          color: msg.type === 'success' ? '#81c784' : '#e57373',
          fontWeight: 600
        }}>
          {msg.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>
        
        {/* EDITACE PROFILU */}
        <div className="glass-panel" style={{ padding: '2.5rem', borderRadius: '30px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>👤</span> Nastavení profilu
          </h2>
          <form onSubmit={handleProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', opacity: 0.5, fontWeight: 900 }}>PŘEZDÍVKA</label>
              <input name="nickname" defaultValue={user.nickname || ''} placeholder="Tvoje karaoke jméno" style={inputStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', opacity: 0.5, fontWeight: 900 }}>EMAIL ADRESA</label>
              <input name="email" defaultValue={user.email || ''} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', opacity: 0.5, fontWeight: 900 }}>URL PROFILOVÉ FOTKY</label>
              <input name="image" defaultValue={user.image || ''} placeholder="https://..." style={inputStyle} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '10px 0' }}>
              <input type="checkbox" name="sendEmails" defaultChecked={user.sendEmails} style={{ width: '20px', height: '20px' }} />
              <span style={{ fontSize: '14px', fontWeight: 600 }}>Odesílat informační emaily</span>
            </label>
            <button type="submit" disabled={isUpdating} className="btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
              {isUpdating ? 'UKLÁDÁM...' : 'ULOŽIT ZMĚNY'}
            </button>
          </form>
        </div>

        {/* ZMĚNA HESLA */}
        <div className="glass-panel" style={{ padding: '2.5rem', borderRadius: '30px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>🔒</span> Změna hesla
          </h2>
          <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', opacity: 0.5, fontWeight: 900 }}>PŮVODNÍ HESLO</label>
              <input type="password" name="oldPassword" required style={inputStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', opacity: 0.5, fontWeight: 900 }}>NOVÉ HESLO</label>
              <input type="password" name="newPassword" required style={inputStyle} />
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}>
              ZMĚNIT HESLO
            </button>
          </form>
        </div>

      </div>

      {/* STATISTIKY */}
      <div style={{ marginTop: '3rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>
        <div style={statBoxStyle}>
          <span style={{ fontSize: '12px', fontWeight: 900, opacity: 0.5 }}>CELKEM ZAZPÍVÁNO</span>
          <span style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--color-gold)' }}>{stats?.totalSings || 0}</span>
        </div>
        <div style={statBoxStyle}>
          <span style={{ fontSize: '12px', fontWeight: 900, opacity: 0.5 }}>UNIKÁTNÍCH HITŮ</span>
          <span style={{ fontSize: '3rem', fontWeight: 900, color: '#00b4d8' }}>{stats?.uniqueSongsCount || 0}</span>
        </div>
      </div>

      {/* HISTORIE */}
      <div style={{ marginTop: '4rem' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '2rem' }}>Historie tvých vystoupení 🎤</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {user.singingHistory?.length === 0 ? (
            <p style={{ opacity: 0.5 }}>Zatím jsi nic nezazpíval. Šup k mikrofonu!</p>
          ) : (
            user.singingHistory.map((item: any) => (
              <div key={item.id} style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                padding: '1.5rem 2rem', background: 'rgba(255,255,255,0.02)', 
                borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' 
              }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{item.song.title}</div>
                  <div style={{ opacity: 0.5, fontSize: '0.9rem' }}>{item.song.artist}</div>
                </div>
                <div style={{ opacity: 0.4, fontSize: '0.8rem', fontWeight: 700 }}>
                  {new Date(item.createdAt).toLocaleDateString('cs')} | {new Date(item.createdAt).toLocaleTimeString('cs', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <style jsx>{`
        .input-focus:focus { border-color: var(--color-gold) !important; background: rgba(255,255,255,0.1) !important; }
      `}</style>
    </div>
  );
}

const inputStyle = {
  padding: '14px 18px',
  borderRadius: '14px',
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'white',
  outline: 'none',
  fontSize: '15px',
  transition: 'all 0.2s'
};

const statBoxStyle = {
  padding: '2.5rem',
  background: 'rgba(255,255,255,0.03)',
  borderRadius: '30px',
  border: '1px solid rgba(255,255,255,0.08)',
  display: 'flex',
  flexDirection: 'column' as any,
  alignItems: 'center',
  textAlign: 'center' as any,
  gap: '10px'
};
