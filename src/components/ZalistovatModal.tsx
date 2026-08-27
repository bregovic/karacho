'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { proverSeznamAction, zalistujAction, type NahledPisne } from '@/app/actions/zalistovani-actions';

const BARVA: Record<NahledPisne['stav'], string> = {
  OK: '#4ade80',
  DUPLICITA: '#ffcc00',
  BEZ_TEXTU: 'rgba(255,255,255,0.4)',
  CHYBA: '#f87171',
};

const IKONA: Record<NahledPisne['stav'], string> = {
  OK: '✓',
  DUPLICITA: '⏭',
  BEZ_TEXTU: '—',
  CHYBA: '✗',
};

export default function ZalistovatModal() {
  const router = useRouter();
  const [otevreno, setOtevreno] = useState(false);
  const [seznam, setSeznam] = useState('');
  const [nahled, setNahled] = useState<NahledPisne[] | null>(null);
  const [pracuje, setPracuje] = useState<'' | 'prover' | 'zalistuj'>('');
  const [vysledek, setVysledek] = useState<string[] | null>(null);

  const pocetRadku = seznam.split('\n').filter((r) => r.trim()).length;
  const pocetOK = nahled?.filter((n) => n.stav === 'OK').length ?? 0;

  const prover = async () => {
    setPracuje('prover');
    setVysledek(null);
    try {
      setNahled(await proverSeznamAction(seznam));
    } catch (e: any) {
      alert(`Prověření selhalo: ${e.message}`);
    } finally {
      setPracuje('');
    }
  };

  const zalistuj = async () => {
    if (!confirm(`Založit ${pocetOK} písní ve stavu „čeká na zvuk"?`)) return;
    setPracuje('zalistuj');
    try {
      const r = await zalistujAction(seznam);
      setVysledek(r.hlaseni);
      setNahled(null);
      router.refresh();
    } catch (e: any) {
      alert(`Zalistování selhalo: ${e.message}`);
    } finally {
      setPracuje('');
    }
  };

  const zavri = () => {
    if (pracuje) return;
    setOtevreno(false);
    setNahled(null);
    setVysledek(null);
  };

  return (
    <>
      <button
        onClick={() => setOtevreno(true)}
        className="btn-secondary"
        style={{ padding: '12px 20px', borderRadius: '14px', fontSize: '12px', fontWeight: 800, border: '1px solid #00d2ff', background: 'rgba(0,210,255,0.05)', color: '#00d2ff' }}
      >
        📻 ZALISTOVAT BEZ ZVUKU
      </button>

      {otevreno && (
        <div onClick={zavri} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(15px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={(e) => e.stopPropagation()} className="glass-panel" style={{ width: '100%', maxWidth: '760px', padding: '2.5rem', maxHeight: '90vh', overflowY: 'auto', border: '1px solid rgba(0,210,255,0.2)' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ color: 'var(--color-gold)', margin: 0, fontSize: '22px', fontWeight: 900 }}>📻 Zalistovat bez zvuku</h2>
                <p style={{ margin: '6px 0 0', fontSize: '13px', opacity: 0.6, lineHeight: 1.5, maxWidth: '560px' }}>
                  Založí písně s textem a časováním, ale bez nahrávky. Do katalogu se nedostanou,
                  dokud nedoplníš MP3 — pak se samy vrátí do běžného postupu.
                </p>
              </div>
              <button onClick={zavri} disabled={!!pracuje} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', flexShrink: 0 }}>✕</button>
            </div>

            <textarea
              value={seznam}
              onChange={(e) => { setSeznam(e.target.value); setNahled(null); setVysledek(null); }}
              disabled={!!pracuje}
              rows={8}
              placeholder={'Jeden řádek = jedna píseň, ve tvaru „Interpret - Název":\n\nToto - Africa\nQueen - Bohemian Rhapsody\nABBA - Dancing Queen'}
              style={{ width: '100%', padding: '14px', borderRadius: '14px', background: 'rgba(0,0,0,0.45)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', fontSize: '14px', fontFamily: 'monospace', resize: 'vertical' }}
            />
            <div style={{ fontSize: '11px', opacity: 0.45, margin: '6px 2px 0' }}>
              {pocetRadku} {pocetRadku === 1 ? 'řádek' : pocetRadku < 5 ? 'řádky' : 'řádků'} · najednou nejvýš 40
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem', flexWrap: 'wrap' }}>
              <button onClick={prover} disabled={!!pracuje || !pocetRadku} className="btn-secondary" style={{ padding: '12px 24px', borderRadius: '14px', fontSize: '13px', fontWeight: 800, opacity: pracuje || !pocetRadku ? 0.5 : 1 }}>
                {pracuje === 'prover' ? 'Prověřuji…' : '🔍 Prověřit'}
              </button>
              {pocetOK > 0 && (
                <button onClick={zalistuj} disabled={!!pracuje} className="btn-primary" style={{ padding: '12px 24px', borderRadius: '14px', fontSize: '13px', fontWeight: 900, background: 'var(--color-teal)', border: 'none' }}>
                  {pracuje === 'zalistuj' ? 'Zakládám…' : `📻 Zalistovat ${pocetOK}`}
                </button>
              )}
            </div>

            {pracuje === 'prover' && (
              <p style={{ fontSize: '12px', opacity: 0.5, marginTop: '1rem' }}>
                Dotazuje se postupně, ať se veřejné služby nezahltí — u čtyřiceti písní to chvíli trvá.
              </p>
            )}

            {nahled && (
              <div style={{ marginTop: '1.5rem', background: 'rgba(0,0,0,0.35)', borderRadius: '16px', padding: '1rem', fontSize: '12px' }}>
                {nahled.map((n, i) => (
                  <div key={i} style={{ padding: '8px 0', borderBottom: i < nahled.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <span style={{ color: BARVA[n.stav], fontWeight: 900, flexShrink: 0, width: '14px' }}>{IKONA[n.stav]}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>
                        {n.stav === 'OK' || n.stav === 'DUPLICITA' ? `${n.artist} – ${n.title}` : n.zadano}
                      </div>
                      <div style={{ opacity: 0.55, marginTop: '2px' }}>
                        {n.stav === 'OK'
                          ? `${n.bloku} bloků · ${n.odpoctu} odpočtů · ${n.delka}s · první nástup ${n.prvniRadek}`
                          : n.zprava}
                      </div>
                      {n.stav === 'OK' && n.rozdilDelek !== undefined && n.rozdilDelek > 5 && (
                        <div style={{ color: '#ffcc00', marginTop: '2px' }}>
                          ⚠️ délka textu se o {Math.round(n.rozdilDelek)}s liší od nalezené nahrávky — ověř časování při prvním přehrání
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {vysledek && (
              <div style={{ marginTop: '1.5rem', background: 'rgba(0,0,0,0.35)', borderRadius: '16px', padding: '1rem', fontSize: '12px', fontFamily: 'monospace', lineHeight: 1.7 }}>
                {vysledek.map((r, i) => (
                  <div key={i} style={{ color: r.startsWith('✓') ? '#4ade80' : '#f87171' }}>{r}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
