'use client';

import { useState } from 'react';
import { nahlasChybu } from '@/app/actions/report-actions';

/**
 * Dialog pro nahlášení chyby u písně.
 *
 * Používá ho Studio (kde si špatného textu všimne správce při klíčování)
 * i veřejný katalog (kde na to přijde zpěvák uprostřed večera). Píseň se
 * podle nahlášeného druhu rovnou stáhne z katalogu — rozhoduje o tom
 * server, ne tenhle komponent.
 *
 * Popis je nepovinný. Jediné, co se opravdu musí vybrat, je druh chyby;
 * kvůli povinnému okénku na text hlášení buď nevzniklo, nebo v něm bylo
 * „nic".
 */
export default function HlaseniChyby({
  songId,
  nazev,
  vychoziDruh = 'TEXT',
  onClose,
  onHotovo,
}: {
  songId: string;
  nazev?: string;
  vychoziDruh?: 'TEXT' | 'PISEN';
  onClose: () => void;
  onHotovo?: (zprava: string) => void;
}) {
  const [druh, setDruh] = useState<'TEXT' | 'PISEN'>(vychoziDruh);
  const [popis, setPopis] = useState('');
  const [odesila, setOdesila] = useState(false);
  const [chyba, setChyba] = useState('');

  const odeslat = async () => {
    setOdesila(true);
    setChyba('');
    try {
      const r = await nahlasChybu(songId, druh, popis);
      if (!r.ok) {
        setChyba(r.error);
        return;
      }
      onHotovo?.('⚠️ Nahlášeno — píseň je označená a stažená z katalogu.');
      onClose();
    } catch {
      setChyba('Hlášení se nepodařilo odeslat.');
    } finally {
      setOdesila(false);
    }
  };

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClose(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 20000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div onClick={e => e.stopPropagation()} className="glass-panel" style={{ padding: '2rem', borderRadius: '24px', width: 'min(520px, 100%)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 900 }}>⚠️ Nahlásit chybu</h3>
          {nazev && <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.6 }}>{nazev}</p>}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => setDruh('TEXT')}
            className="btn-secondary"
            style={{ flex: 1, padding: '14px', fontSize: '13px', fontWeight: 800, border: druh === 'TEXT' ? '2px solid var(--color-gold)' : '1px solid rgba(255,255,255,0.12)', color: druh === 'TEXT' ? 'var(--color-gold)' : '#fff' }}
          >
            ✍️ Špatný text
          </button>
          <button
            onClick={() => setDruh('PISEN')}
            className="btn-secondary"
            style={{ flex: 1, padding: '14px', fontSize: '13px', fontWeight: 800, border: druh === 'PISEN' ? '2px solid #ff4b2b' : '1px solid rgba(255,255,255,0.12)', color: druh === 'PISEN' ? '#ff4b2b' : '#fff' }}
          >
            ⛔ Špatná píseň
          </button>
        </div>

        <p style={{ margin: 0, fontSize: '12px', opacity: 0.6, lineHeight: 1.5 }}>
          {druh === 'TEXT'
            ? 'Text nesedí na nahrávku — překlepy, jiná sloka, přehozené řádky. Nahrávka i časování se dají použít dál.'
            : 'Vadná je sama nahrávka — jiná verze, useknuté audio, nedá se to zpívat.'}
        </p>

        <textarea
          value={popis}
          onChange={e => setPopis(e.target.value)}
          placeholder={'Nepovinně: co přesně je špatně (např. „druhá sloka je z jiné písně“)'}
          rows={3}
          maxLength={1000}
          style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', fontSize: '14px', resize: 'vertical', fontFamily: 'inherit' }}
        />

        {chyba && <div style={{ color: '#f87171', fontSize: '12px' }}>{chyba}</div>}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button className="btn-secondary" style={{ padding: '10px 20px', fontSize: '13px' }} onClick={onClose}>Zrušit</button>
          <button
            className="btn-primary"
            style={{ padding: '10px 24px', fontSize: '13px', fontWeight: 900, background: '#ff4b2b', border: 'none', color: '#fff', opacity: odesila ? 0.5 : 1 }}
            onClick={odeslat}
            disabled={odesila}
          >
            {odesila ? 'Odesílám…' : 'Nahlásit'}
          </button>
        </div>
      </div>
    </div>
  );
}
