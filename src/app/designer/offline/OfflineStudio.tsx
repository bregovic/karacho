'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DesignerClient from '../DesignerClient';
import { offlineDb, type OfflinePisen, type OfflineVysledek } from '@/lib/offline-db';

/**
 * Studio offline – časování bez internetu (v letadle).
 *
 * 1. Online: „Stáhnout" uloží do telefonu text a zvuk všech písní, které mají
 *    text, ale ne časování. Zároveň se uloží i tahle stránka, aby šla otevřít
 *    bez sítě.
 * 2. Offline: časuje se v normálním studiu, jen ukládá do telefonu.
 * 3. Online: „Nahrát" pošle hotová časování na server. Píseň, kterou mezitím
 *    někdo načasoval jinde, se nepřepíše – zůstane jako konflikt k rozhodnutí.
 */

type StavNahrani = { [id: string]: 'ok' | 'konflikt' | 'chyba' };

const mb = (b: number) => `${Math.round(b / 1e6)} MB`;

/** Pošle service workeru seznam souborů, které stránka použila, k uložení. */
function ulozStrankuProOffline() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then((reg) => {
    const adresy = performance
      .getEntriesByType('resource')
      .map((e) => e.name)
      .filter((u) => u.startsWith(location.origin + '/_next/static/'));
    reg.active?.postMessage({ typ: 'ulozit', adresy: [...adresy, '/designer/offline'] });
  });
}

export default function OfflineStudio() {
  const [online, setOnline] = useState(true);
  const [pisne, setPisne] = useState<OfflinePisen[]>([]);
  const [seZvukem, setSeZvukem] = useState<Set<string>>(new Set());
  const [vysledky, setVysledky] = useState<Record<string, OfflineVysledek>>({});
  const [zprava, setZprava] = useState('');
  const [stahovani, setStahovani] = useState<{ hotovo: number; celkem: number; nazev: string } | null>(null);
  const [nahravani, setNahravani] = useState(false);
  const [stavNahrani, setStavNahrani] = useState<StavNahrani>({});
  const [misto, setMisto] = useState<{ usage: number; quota: number } | null>(null);
  const [otevrena, setOtevrena] = useState<{ pisen: OfflinePisen; zvukUrl: string; timingData: any; lyrics: string | null; chords: string | null; startTime: number } | null>(null);
  const [filtr, setFiltr] = useState('');
  const zrusitRef = useRef(false);

  const nacti = useCallback(async () => {
    const [p, z, v] = await Promise.all([offlineDb.pisne(), offlineDb.zvukyKlice(), offlineDb.vysledky()]);
    p.sort((a, b) => `${a.artist} ${a.title}`.localeCompare(`${b.artist} ${b.title}`, 'cs'));
    setPisne(p);
    setSeZvukem(new Set(z.map(String)));
    setVysledky(Object.fromEntries(v.map((x) => [x.id, x])));
    try { const e = await navigator.storage?.estimate?.(); if (e) setMisto({ usage: e.usage || 0, quota: e.quota || 0 }); } catch {}
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(() => ulozStrankuProOffline()).catch(() => {});
    }
    nacti();
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [nacti]);

  // ---------- STAŽENÍ ----------
  const stahni = async () => {
    setZprava('');
    zrusitRef.current = false;
    try { await navigator.storage?.persist?.(); } catch {}
    ulozStrankuProOffline();

    let seznam: OfflinePisen[];
    try {
      const res = await fetch('/api/offline', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      seznam = (await res.json()).map((p: any) => ({ ...p, startTime: p.startTime || 0, stazeno: Date.now() }));
    } catch (e: any) {
      setZprava(`❌ Seznam písní se nepodařilo načíst (${e.message}). Jsi přihlášený jako správce?`);
      return;
    }

    const mame = new Set((await offlineDb.zvukyKlice()).map(String));
    // Text a údaje se aktualizují vždycky; zvuk jen tam, kde ještě není.
    for (const p of seznam) {
      const stara = pisne.find((x) => x.id === p.id);
      await offlineDb.ulozPisen(stara && mame.has(p.id) ? { ...p, stazeno: stara.stazeno } : p);
    }
    const chybi = seznam.filter((p) => !mame.has(p.id));
    let chyby = 0;
    for (let i = 0; i < chybi.length; i++) {
      if (zrusitRef.current) break;
      const p = chybi[i];
      setStahovani({ hotovo: i, celkem: chybi.length, nazev: `${p.artist || ''} – ${p.title}` });
      try {
        const r = await fetch(p.audioUrl);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        await offlineDb.ulozZvuk(p.id, await r.blob());
      } catch {
        chyby++;
      }
    }
    setStahovani(null);
    await nacti();
    setZprava(zrusitRef.current
      ? '⏸ Stahování přerušeno. Příště se naváže tam, kde skončilo.'
      : `✅ Staženo. ${chyby ? `${chyby} nahrávek se nepodařilo stáhnout – zkus to znovu.` : 'Můžeš časovat i bez internetu.'}`);
  };

  // ---------- NAHRÁNÍ ----------
  const nahraj = async (id: string, prepsat = false) => {
    const v = vysledky[id];
    if (!v) return 'chyba' as const;
    try {
      if (!prepsat) {
        const r = await fetch(`/api/songs/${id}`, { cache: 'no-store' });
        if (r.ok) {
          const s = await r.json();
          if (s?.timingData?.blocks?.length) return 'konflikt' as const;
        }
      }
      const d = JSON.parse(v.telo);
      // Popisek zdroje – ať je i po letech vidět, že časování vzniklo offline.
      if (d.timingData) d.timingData.zdroj = `offline studio (telefon), ${new Date(v.kdy).toLocaleString('cs-CZ')}`;
      if (!v.publikovat) delete d.state;
      const res = await fetch(`/api/songs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Nahráno → píseň už časování má, místo v telefonu se uvolní.
      await offlineDb.smazVysledek(id);
      await offlineDb.smazZvuk(id);
      await offlineDb.smazPisen(id);
      return 'ok' as const;
    } catch {
      return 'chyba' as const;
    }
  };

  const nahrajVse = async () => {
    setNahravani(true);
    setZprava('');
    const stav: StavNahrani = {};
    for (const id of Object.keys(vysledky)) {
      if (!vysledky[id] || !JSON.parse(vysledky[id].telo)?.timingData?.blocks?.length) continue;
      stav[id] = await nahraj(id);
      setStavNahrani({ ...stav });
    }
    setNahravani(false);
    const ok = Object.values(stav).filter((x) => x === 'ok').length;
    const konf = Object.values(stav).filter((x) => x === 'konflikt').length;
    const chyb = Object.values(stav).filter((x) => x === 'chyba').length;
    setZprava(`Nahráno ${ok}.${konf ? ` ${konf} písní mezitím načasoval někdo jiný – rozhodni u nich.` : ''}${chyb ? ` ${chyb} se nepovedlo, zkus znovu.` : ''}`);
    await nacti();
  };

  const vyresKonflikt = async (id: string, prepsat: boolean) => {
    if (prepsat) {
      const s = await nahraj(id, true);
      setStavNahrani((x) => ({ ...x, [id]: s }));
    } else {
      await offlineDb.smazVysledek(id);
      setStavNahrani((x) => { const n = { ...x }; delete n[id]; return n; });
    }
    await nacti();
  };

  const uvolniMisto = async () => {
    if (!confirm('Smazat z telefonu všechny stažené nahrávky? Rozpracované a nenahrané časování zůstane.')) return;
    for (const p of pisne) {
      if (vysledky[p.id]) continue;
      await offlineDb.smazZvuk(p.id);
      await offlineDb.smazPisen(p.id);
    }
    await nacti();
  };

  // ---------- STUDIO ----------
  const otevri = async (p: OfflinePisen) => {
    const zvuk = await offlineDb.zvuk(p.id);
    if (!zvuk) { setZprava('❌ Nahrávka této písně v telefonu není – stáhni ji, až budeš online.'); return; }
    const v = await offlineDb.vysledek(p.id);
    const d = v ? JSON.parse(v.telo) : null;
    setOtevrena({
      pisen: p,
      zvukUrl: URL.createObjectURL(zvuk),
      timingData: d?.timingData ?? null,
      lyrics: d?.lyrics ?? p.lyrics,
      chords: d?.chords ?? p.chords,
      startTime: d?.startTime ?? p.startTime,
    });
  };

  const zavri = useCallback(() => {
    setOtevrena((o) => { if (o) URL.revokeObjectURL(o.zvukUrl); return null; });
    // Studio při zavření ještě dopisuje poslední uložení – seznam až po něm.
    setTimeout(nacti, 500);
  }, [nacti]);

  const offlineRezim = useMemo(() => {
    if (!otevrena) return undefined;
    const id = otevrena.pisen.id;
    return {
      uloz: async (telo: string, publikovat: boolean) => {
        const predchozi = await offlineDb.vysledek(id);
        await offlineDb.ulozVysledek({ id, telo, publikovat: publikovat || !!predchozi?.publikovat, kdy: Date.now() });
      },
      zpet: zavri,
    };
  }, [otevrena, zavri]);

  if (otevrena && offlineRezim) {
    const s = {
      id: otevrena.pisen.id,
      title: otevrena.pisen.title,
      artist: otevrena.pisen.artist,
      audioUrl: otevrena.zvukUrl,
      lyrics: otevrena.lyrics,
      chords: otevrena.chords,
      startTime: otevrena.startTime,
      timingData: otevrena.timingData,
    };
    return (
      <div>
        <button
          onClick={zavri}
          style={{ position: 'fixed', bottom: 12, left: 12, zIndex: 1000, padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.8)', color: '#fff', fontWeight: 700 }}
        >
          ← Seznam (offline)
        </button>
        <DesignerClient key={s.id} song={s} offline={offlineRezim} />
      </div>
    );
  }

  // ---------- SEZNAM ----------
  const kNahrani = Object.values(vysledky).filter((v) => JSON.parse(v.telo)?.timingData?.blocks?.length);
  const stazenych = pisne.filter((p) => seZvukem.has(p.id));
  const velikost = stazenych.reduce((n, p) => n + (p.audioSize || 0), 0);
  const viditelne = pisne.filter((p) => !filtr || `${p.artist} ${p.title}`.toLowerCase().includes(filtr.toLowerCase()));

  const btn = (barva: string) => ({ padding: '12px 18px', borderRadius: 12, border: 'none', background: barva, color: '#000', fontWeight: 800, fontSize: 15, cursor: 'pointer' } as const);

  return (
    <div style={{ minHeight: '100vh', background: '#0b0b10', color: '#fff', padding: '16px', fontFamily: 'Inter, sans-serif', maxWidth: 820, margin: '0 auto' }}>
      <h1 style={{ color: 'var(--color-gold, #ffd700)', fontSize: 26, margin: '8px 0 4px' }}>✈️ Studio offline</h1>
      <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 16 }}>
        {online ? '🟢 Online' : '🔴 Bez internetu'} · v telefonu {stazenych.length} písní ({mb(velikost)})
        {misto ? ` · obsazeno ${mb(misto.usage)} z ${mb(misto.quota)}` : ''}
      </div>

      {zprava && <div style={{ background: 'rgba(255,255,255,0.08)', padding: 12, borderRadius: 12, marginBottom: 12 }}>{zprava}</div>}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        {online && !stahovani && <button onClick={stahni} style={btn('#ffd700')}>📥 Stáhnout písně k časování</button>}
        {stahovani && <button onClick={() => { zrusitRef.current = true; }} style={btn('#ff8c00')}>⏸ Přerušit</button>}
        {online && kNahrani.length > 0 && (
          <button onClick={nahrajVse} disabled={nahravani} style={btn('#00ffa0')}>
            {nahravani ? '⏳ Nahrávám…' : `⬆️ Nahrát ${kNahrani.length} načasovaných`}
          </button>
        )}
        {stazenych.length > 0 && !stahovani && <button onClick={uvolniMisto} style={btn('rgba(255,255,255,0.15)')}>🗑 Uvolnit místo</button>}
      </div>

      {stahovani && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, marginBottom: 6 }}>Stahuji {stahovani.hotovo + 1} / {stahovani.celkem}: {stahovani.nazev}</div>
          <div style={{ height: 10, background: 'rgba(255,255,255,0.1)', borderRadius: 5 }}>
            <div style={{ height: 10, width: `${(stahovani.hotovo / stahovani.celkem) * 100}%`, background: '#ffd700', borderRadius: 5 }} />
          </div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>Nech stránku otevřenou a telefon na Wi-Fi.</div>
        </div>
      )}

      {pisne.length === 0 && !stahovani && (
        <p style={{ opacity: 0.7 }}>
          V telefonu zatím nic není. Před cestou (online, na Wi-Fi) stiskni „Stáhnout". Pak si tuhle stránku
          přidej na plochu (menu Chromu → Přidat na plochu) a v letadle ji otevři odtamtud.
        </p>
      )}

      {pisne.length > 8 && (
        <input value={filtr} onChange={(e) => setFiltr(e.target.value)} placeholder="Hledat…"
          style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', marginBottom: 10, fontSize: 15 }} />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {viditelne.map((p) => {
          const v = vysledky[p.id];
          const bloku = v ? (JSON.parse(v.telo)?.timingData?.blocks?.length || 0) : 0;
          const stav = stavNahrani[p.id];
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.05)' }}>
              <button onClick={() => otevri(p)} disabled={!seZvukem.has(p.id)}
                style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', color: seZvukem.has(p.id) ? '#fff' : 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0, fontSize: 15 }}>
                <div style={{ fontWeight: 700 }}>{p.title}</div>
                <div style={{ fontSize: 12, opacity: 0.6 }}>{p.artist || 'Neznámý interpret'}{!seZvukem.has(p.id) ? ' · nahrávka nestažena' : ''}</div>
              </button>
              <div style={{ fontSize: 12, textAlign: 'right', minWidth: 90 }}>
                {stav === 'konflikt' ? (
                  <span>
                    ⚠️ načasováno jinde<br />
                    <button onClick={() => vyresKonflikt(p.id, true)} style={{ fontSize: 11, marginTop: 4 }}>Přepsat</button>{' '}
                    <button onClick={() => vyresKonflikt(p.id, false)} style={{ fontSize: 11 }}>Zahodit moje</button>
                  </span>
                ) : stav === 'chyba' ? '❌ nenahráno'
                  : bloku ? <span style={{ color: '#00ffa0' }}>✔ {bloku} řádků{v?.publikovat ? ' · publikovat' : ''}</span>
                  : <span style={{ opacity: 0.5 }}>nečasováno</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
