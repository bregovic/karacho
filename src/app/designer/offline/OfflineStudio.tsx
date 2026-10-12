'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DesignerClient from '../DesignerClient';
import PlayerClient from '@/app/player/[songId]/PlayerClient';
import { offlineDb, type OfflinePisen, type OfflineVysledek } from '@/lib/offline-db';

/**
 * Studio offline – časování i zpěv bez internetu (v letadle).
 *
 * 1. Online: „Stáhnout k časování" uloží do telefonu text a zvuk všech písní,
 *    které mají text, ale ne časování. Z katalogu jde navíc vybrat libovolné
 *    písně (i načasované, ke zpěvu) a k písním v telefonu doplnit
 *    instrumentály. Zároveň se uloží i tahle stránka, aby šla otevřít bez sítě.
 * 2. Offline: časuje se v normálním studiu, jen ukládá do telefonu. Píseň
 *    s časováním jde rovnou zazpívat v normálním přehrávači.
 * 3. Online: „Nahrát" pošle hotová časování na server. Píseň, kterou mezitím
 *    někdo načasoval jinde, se nepřepíše – zůstane jako konflikt k rozhodnutí.
 */

type StavNahrani = { [id: string]: 'ok' | 'konflikt' | 'chyba' };

type KatalogPisen = {
  id: string;
  title: string;
  artist: string | null;
  audioSize: number | null;
  instrumental: boolean;
  nacasovano: boolean;
  text: boolean;
};

const mb = (b: number) => `${Math.round(b / 1e6)} MB`;

/** Pozadí přehrávače – bez nich by zpěv offline běžel na černé. */
const POZADI = ['pop', 'rock', 'disco', 'retro_80s', 'jazz', 'country', 'hiphop', 'jungle', 'rocknroll', 'opera', 'hightech', 'matrix', 'tekkno', 'funk']
  .map((n) => `/backgrounds/${n}.png`);

/** Pošle service workeru seznam souborů, které stránka použila, k uložení. */
function ulozStrankuProOffline() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then((reg) => {
    const adresy = performance
      .getEntriesByType('resource')
      .map((e) => e.name)
      .filter((u) => u.startsWith(location.origin + '/_next/static/'));
    reg.active?.postMessage({ typ: 'ulozit', adresy: [...adresy, ...POZADI, '/designer/offline'] });
  });
}

/** Píseň ze serveru v podobě pro telefon. */
function zeServeru(s: any): OfflinePisen {
  return {
    id: s.id,
    title: s.title,
    artist: s.artist,
    lyrics: s.lyrics,
    chords: s.chords,
    startTime: s.startTime || 0,
    audioUrl: s.audioUrl,
    audioSize: s.audioSize,
    instrumentalUrl: s.instrumentalUrl || null,
    timingData: s.timingData?.blocks?.length ? s.timingData : undefined,
    stazeno: Date.now(),
  };
}

export default function OfflineStudio() {
  const [online, setOnline] = useState(true);
  const [pisne, setPisne] = useState<OfflinePisen[]>([]);
  const [seZvukem, setSeZvukem] = useState<Set<string>>(new Set());
  const [seInstr, setSeInstr] = useState<Set<string>>(new Set());
  const [vysledky, setVysledky] = useState<Record<string, OfflineVysledek>>({});
  const [zprava, setZprava] = useState('');
  const [stahovani, setStahovani] = useState<{ hotovo: number; celkem: number; nazev: string } | null>(null);
  const [nahravani, setNahravani] = useState(false);
  const [stavNahrani, setStavNahrani] = useState<StavNahrani>({});
  const [misto, setMisto] = useState<{ usage: number; quota: number } | null>(null);
  const [otevrena, setOtevrena] = useState<{ pisen: OfflinePisen; zvukUrl: string; timingData: any; lyrics: string | null; chords: string | null; startTime: number } | null>(null);
  const [zpivana, setZpivana] = useState<{ song: any; adresy: string[] } | null>(null);
  const [filtr, setFiltr] = useState('');
  const [katalog, setKatalog] = useState<KatalogPisen[] | null>(null);
  const [katFiltr, setKatFiltr] = useState<'vse' | 'zpev' | 'casovani'>('zpev');
  const [vybrane, setVybrane] = useState<Set<string>>(new Set());
  const [sInstr, setSInstr] = useState(true);
  const zrusitRef = useRef(false);

  const nacti = useCallback(async () => {
    const [p, z, i, v] = await Promise.all([offlineDb.pisne(), offlineDb.zvukyKlice(), offlineDb.instrumentalyKlice(), offlineDb.vysledky()]);
    p.sort((a, b) => `${a.artist} ${a.title}`.localeCompare(`${b.artist} ${b.title}`, 'cs'));
    setPisne(p);
    setSeZvukem(new Set(z.map(String)));
    setSeInstr(new Set(i.map(String)));
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

  /** Časování k zobrazení: rozpracované v telefonu má přednost před serverovým. */
  const casovani = (p: OfflinePisen) => {
    const v = vysledky[p.id];
    const d = v ? JSON.parse(v.telo) : null;
    return d?.timingData?.blocks?.length ? d.timingData : p.timingData;
  };

  // ---------- STAŽENÍ ----------
  /**
   * Uloží údaje písní a stáhne, co z jejich zvuku v telefonu chybí. Text
   * a údaje se přepisují vždy, zvuk jen tam, kde ještě není – přerušené
   * stahování tak příště naváže.
   */
  const stahniSeznam = async (seznam: OfflinePisen[], sInstrumentalem: boolean) => {
    zrusitRef.current = false;
    try { await navigator.storage?.persist?.(); } catch {}
    ulozStrankuProOffline();

    const [z, i] = await Promise.all([offlineDb.zvukyKlice(), offlineDb.instrumentalyKlice()]);
    const mameZvuk = new Set(z.map(String));
    const mameInstr = new Set(i.map(String));
    for (const p of seznam) {
      const stara = pisne.find((x) => x.id === p.id);
      await offlineDb.ulozPisen({
        ...stara,
        ...p,
        // Časování ze serveru nesmí smazat to, co už v telefonu je.
        timingData: p.timingData ?? stara?.timingData,
        stazeno: stara && mameZvuk.has(p.id) ? stara.stazeno : p.stazeno,
      });
    }

    const prace = seznam.filter((p) =>
      !mameZvuk.has(p.id) || (sInstrumentalem && p.instrumentalUrl && !mameInstr.has(p.id)));
    let chyby = 0;
    for (let n = 0; n < prace.length; n++) {
      if (zrusitRef.current) break;
      const p = prace[n];
      setStahovani({ hotovo: n, celkem: prace.length, nazev: `${p.artist || ''} – ${p.title}` });
      try {
        if (!mameZvuk.has(p.id)) {
          const r = await fetch(p.audioUrl);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          await offlineDb.ulozZvuk(p.id, await r.blob());
        }
        if (sInstrumentalem && p.instrumentalUrl && !mameInstr.has(p.id)) {
          const r = await fetch(p.instrumentalUrl);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          await offlineDb.ulozInstrumental(p.id, await r.blob());
        }
      } catch {
        chyby++;
      }
    }
    setStahovani(null);
    await nacti();
    setZprava(zrusitRef.current
      ? '⏸ Stahování přerušeno. Příště se naváže tam, kde skončilo.'
      : `✅ Staženo. ${chyby ? `${chyby} písní se nepodařilo stáhnout celých – zkus to znovu.` : 'Funguje i bez internetu.'}`);
  };

  /** Celé písně ze serveru po jedné (s textem a časováním), po šesti naráz. */
  const nactiDetaily = async (ids: string[]) => {
    const vysledek: OfflinePisen[] = [];
    for (let n = 0; n < ids.length; n += 6) {
      if (zrusitRef.current) break;
      setStahovani({ hotovo: n, celkem: ids.length, nazev: 'načítám údaje písní…' });
      const davka = await Promise.all(ids.slice(n, n + 6).map(async (id) => {
        try {
          const r = await fetch(`/api/songs/${id}`, { cache: 'no-store' });
          return r.ok ? zeServeru(await r.json()) : null;
        } catch { return null; }
      }));
      vysledek.push(...davka.filter((x): x is OfflinePisen => !!x?.audioUrl));
    }
    return vysledek;
  };

  const stahniKCasovani = async () => {
    setZprava('');
    let seznam: OfflinePisen[];
    try {
      const res = await fetch('/api/offline', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      seznam = (await res.json()).map(zeServeru);
    } catch (e: any) {
      setZprava(`❌ Seznam písní se nepodařilo načíst (${e.message}). Jsi přihlášený jako správce?`);
      return;
    }
    await stahniSeznam(seznam, false);
  };

  const otevriKatalog = async () => {
    setZprava('');
    try {
      const res = await fetch('/api/offline?katalog=1', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setKatalog(await res.json());
      setVybrane(new Set());
      setFiltr('');
    } catch (e: any) {
      setZprava(`❌ Katalog se nepodařilo načíst (${e.message}). Jsi přihlášený jako správce?`);
    }
  };

  const stahniVybrane = async () => {
    const ids = [...vybrane];
    setKatalog(null);
    setZprava('');
    zrusitRef.current = false;
    const seznam = await nactiDetaily(ids);
    if (zrusitRef.current) { setStahovani(null); setZprava('⏸ Stahování přerušeno.'); return; }
    await stahniSeznam(seznam, sInstr);
  };

  /** Instrumentály k písním v telefonu. Starší stažené písně odkaz nemají – dotáhne se. */
  const doplnInstrumentaly = async () => {
    setZprava('');
    zrusitRef.current = false;
    const bezOdkazu = pisne.filter((p) => p.instrumentalUrl === undefined).map((p) => p.id);
    const doplnene = bezOdkazu.length ? await nactiDetaily(bezOdkazu) : [];
    // Odkaz si zapamatovat hned, i u písní, které instrumentál nemají vůbec.
    for (const d of doplnene) {
      const stara = pisne.find((x) => x.id === d.id);
      await offlineDb.ulozPisen({ ...stara, ...d, timingData: d.timingData ?? stara?.timingData, stazeno: stara?.stazeno ?? d.stazeno });
    }
    if (doplnene.length) await nacti();
    const seznam = [
      ...pisne.filter((p) => p.instrumentalUrl !== undefined),
      ...doplnene,
    ].filter((p) => p.instrumentalUrl && !seInstr.has(p.id));
    if (!seznam.length) { setStahovani(null); setZprava('Všechny písně v telefonu už instrumentál mají (nebo ho nemají ani na serveru).'); return; }
    await stahniSeznam(seznam, true);
  };

  // ---------- NAHRÁNÍ ----------
  const nahraj = async (id: string, prepsat = false) => {
    const v = vysledky[id];
    if (!v) return 'chyba' as const;
    const p = pisne.find((x) => x.id === id);
    try {
      if (!prepsat) {
        const r = await fetch(`/api/songs/${id}`, { cache: 'no-store' });
        if (r.ok) {
          const s = await r.json();
          // Konflikt jen když se časování na serveru změnilo od stažení –
          // úprava písně, která už časování měla, se prostě přepíše.
          if (s?.timingData?.blocks?.length && JSON.stringify(s.timingData) !== JSON.stringify(p?.timingData ?? null)) {
            return 'konflikt' as const;
          }
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
      // Píseň v telefonu zůstává – teď už s časováním, takže jde zazpívat.
      // Místo se uvolňuje ručně (🗑 u písně nebo „Uvolnit místo").
      const ulozena = await res.json().catch(() => null);
      if (p) await offlineDb.ulozPisen({ ...p, timingData: ulozena?.timingData ?? d.timingData, lyrics: ulozena?.lyrics ?? p.lyrics });
      await offlineDb.smazVysledek(id);
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

  const smazPisen = async (p: OfflinePisen) => {
    if (vysledky[p.id]) { alert('U této písně je nenahrané časování – nejdřív ho nahraj.'); return; }
    if (!confirm(`Smazat z telefonu „${p.title}"?`)) return;
    await offlineDb.smazZvuk(p.id);
    await offlineDb.smazInstrumental(p.id);
    await offlineDb.smazPisen(p.id);
    await nacti();
  };

  const uvolniMisto = async () => {
    if (!confirm('Smazat z telefonu všechny stažené nahrávky? Rozpracované a nenahrané časování zůstane.')) return;
    for (const p of pisne) {
      if (vysledky[p.id]) continue;
      await offlineDb.smazZvuk(p.id);
      await offlineDb.smazInstrumental(p.id);
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
      timingData: d?.timingData ?? p.timingData ?? null,
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

  // ---------- ZPĚV ----------
  const zpivej = async (p: OfflinePisen) => {
    const [zvuk, instr] = await Promise.all([offlineDb.zvuk(p.id), offlineDb.instrumental(p.id)]);
    const timingData = casovani(p);
    if (!zvuk || !timingData) { setZprava('❌ Píseň nemá v telefonu nahrávku nebo časování.'); return; }
    const adresy = [URL.createObjectURL(zvuk), ...(instr ? [URL.createObjectURL(instr)] : [])];
    setZpivana({
      adresy,
      song: {
        id: p.id,
        title: p.title,
        artist: p.artist,
        audioUrl: adresy[0],
        instrumentalUrl: adresy[1] || null,
        timingData,
        lyrics: p.lyrics,
        chords: p.chords,
        startTime: p.startTime,
        backgroundUrl: null,
      },
    });
  };

  const prestanZpivat = useCallback(() => {
    setZpivana((z) => { z?.adresy.forEach((u) => URL.revokeObjectURL(u)); return null; });
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch {}
  }, []);
  const offlinePrehravani = useMemo(() => ({ zpet: prestanZpivat }), [prestanZpivat]);

  if (zpivana) {
    return <PlayerClient key={zpivana.song.id} song={zpivana.song} offline={offlinePrehravani} />;
  }

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

  const btn = (barva: string) => ({ padding: '12px 18px', borderRadius: 12, border: 'none', background: barva, color: '#000', fontWeight: 800, fontSize: 15, cursor: 'pointer' } as const);
  const malyBtn = { padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' } as const;
  const hledani = (
    <input value={filtr} onChange={(e) => setFiltr(e.target.value)} placeholder="Hledat…"
      style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', marginBottom: 10, fontSize: 15, boxSizing: 'border-box' }} />
  );
  const sedi = (p: { title: string; artist: string | null }) => !filtr || `${p.artist} ${p.title}`.toLowerCase().includes(filtr.toLowerCase());

  // ---------- VÝBĚR Z KATALOGU ----------
  if (katalog) {
    const vTelefonu = new Set(pisne.map((p) => p.id));
    const viditelne = katalog.filter((p) => sedi(p) && (
      katFiltr === 'vse' || (katFiltr === 'zpev' ? p.nacasovano : (p.text && !p.nacasovano))));
    const vybraneP = katalog.filter((p) => vybrane.has(p.id));
    const odhad = vybraneP.reduce((n, p) => n + (p.audioSize || 4e6) * (sInstr && p.instrumental ? 2 : 1), 0);
    const prepni = (id: string) => setVybrane((v) => { const n = new Set(v); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    const chip = (k: typeof katFiltr, popis: string) => (
      <button onClick={() => setKatFiltr(k)} style={{ ...malyBtn, background: katFiltr === k ? '#ffd700' : malyBtn.background, color: katFiltr === k ? '#000' : '#fff' }}>{popis}</button>
    );
    return (
      <div style={{ minHeight: '100vh', background: '#0b0b10', color: '#fff', padding: '16px 16px 140px', fontFamily: 'Inter, sans-serif', maxWidth: 820, margin: '0 auto' }}>
        <button onClick={() => setKatalog(null)} style={{ ...malyBtn, marginBottom: 12 }}>← Zpět</button>
        <h2 style={{ color: '#ffd700', margin: '4px 0 12px' }}>Vybrat písně do telefonu</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {chip('zpev', '🎤 Načasované (ke zpěvu)')}
          {chip('casovani', '✏️ K časování')}
          {chip('vse', 'Vše')}
        </div>
        {hledani}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <button onClick={() => setVybrane((v) => new Set([...v, ...viditelne.map((p) => p.id)]))} style={malyBtn}>Vybrat zobrazené ({viditelne.length})</button>
          {vybrane.size > 0 && <button onClick={() => setVybrane(new Set())} style={malyBtn}>Zrušit výběr</button>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {viditelne.map((p) => (
            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: vybrane.has(p.id) ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.04)', cursor: 'pointer' }}>
              <input type="checkbox" checked={vybrane.has(p.id)} onChange={() => prepni(p.id)} style={{ width: 20, height: 20 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{p.title}</div>
                <div style={{ fontSize: 12, opacity: 0.6 }}>
                  {p.artist || 'Neznámý interpret'}
                  {p.nacasovano ? ' · načasováno' : p.text ? ' · bez časování' : ' · bez textu'}
                  {p.instrumental ? ' · 🎹' : ''}
                  {vTelefonu.has(p.id) ? ' · ✔ v telefonu' : ''}
                </div>
              </div>
              <span style={{ fontSize: 11, opacity: 0.5 }}>{p.audioSize ? mb(p.audioSize) : ''}</span>
            </label>
          ))}
        </div>
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: '12px 16px', background: 'rgba(11,11,16,0.97)', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={sInstr} onChange={(e) => setSInstr(e.target.checked)} /> i instrumentál
          </label>
          <button onClick={stahniVybrane} disabled={!vybrane.size} style={{ ...btn('#ffd700'), opacity: vybrane.size ? 1 : 0.4 }}>
            📥 Stáhnout {vybrane.size} ({mb(odhad)})
          </button>
        </div>
      </div>
    );
  }

  // ---------- SEZNAM ----------
  const kNahrani = Object.values(vysledky).filter((v) => JSON.parse(v.telo)?.timingData?.blocks?.length);
  const stazenych = pisne.filter((p) => seZvukem.has(p.id));
  const velikost = stazenych.reduce((n, p) => n + (p.audioSize || 0), 0);
  const viditelne = pisne.filter(sedi);
  const chybiInstr = pisne.filter((p) => p.instrumentalUrl !== null && !seInstr.has(p.id)).length;

  return (
    <div style={{ minHeight: '100vh', background: '#0b0b10', color: '#fff', padding: '16px', fontFamily: 'Inter, sans-serif', maxWidth: 820, margin: '0 auto' }}>
      <h1 style={{ color: 'var(--color-gold, #ffd700)', fontSize: 26, margin: '8px 0 4px' }}>✈️ Studio offline</h1>
      <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 16 }}>
        {online ? '🟢 Online' : '🔴 Bez internetu'} · v telefonu {stazenych.length} písní ({mb(velikost)}{seInstr.size ? ` + ${seInstr.size} instrumentálů` : ''})
        {misto ? ` · obsazeno ${mb(misto.usage)} z ${mb(misto.quota)}` : ''}
      </div>

      {zprava && <div style={{ background: 'rgba(255,255,255,0.08)', padding: 12, borderRadius: 12, marginBottom: 12 }}>{zprava}</div>}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        {online && !stahovani && <button onClick={stahniKCasovani} style={btn('#ffd700')}>📥 Vše k časování</button>}
        {online && !stahovani && <button onClick={otevriKatalog} style={btn('#ffd700')}>☑️ Vybrat písně</button>}
        {online && !stahovani && chybiInstr > 0 && <button onClick={doplnInstrumentaly} style={btn('#b18cff')}>🎹 Doplnit instrumentály ({chybiInstr})</button>}
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
          V telefonu zatím nic není. Před cestou (online, na Wi-Fi) stáhni písně k časování, nebo si vyber
          písně ke zpěvu. Pak si tuhle stránku přidej na plochu (menu Chromu → Přidat na plochu) a v letadle
          ji otevři odtamtud.
        </p>
      )}

      {pisne.length > 8 && hledani}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {viditelne.map((p) => {
          const v = vysledky[p.id];
          const bloku = v ? (JSON.parse(v.telo)?.timingData?.blocks?.length || 0) : 0;
          const stav = stavNahrani[p.id];
          const maZvuk = seZvukem.has(p.id);
          const lzeZpivat = maZvuk && !!casovani(p);
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.05)' }}>
              <button onClick={() => otevri(p)} disabled={!maZvuk} title="Časovat ve studiu"
                style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', color: maZvuk ? '#fff' : 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0, fontSize: 15 }}>
                <div style={{ fontWeight: 700 }}>{p.title}</div>
                <div style={{ fontSize: 12, opacity: 0.6 }}>
                  {p.artist || 'Neznámý interpret'}
                  {!maZvuk ? ' · nahrávka nestažena' : ''}
                  {seInstr.has(p.id) ? ' · 🎹' : ''}
                </div>
              </button>
              <div style={{ fontSize: 12, textAlign: 'right', minWidth: 80 }}>
                {stav === 'konflikt' ? (
                  <span>
                    ⚠️ načasováno jinde<br />
                    <button onClick={() => vyresKonflikt(p.id, true)} style={{ fontSize: 11, marginTop: 4 }}>Přepsat</button>{' '}
                    <button onClick={() => vyresKonflikt(p.id, false)} style={{ fontSize: 11 }}>Zahodit moje</button>
                  </span>
                ) : stav === 'chyba' ? '❌ nenahráno'
                  : bloku ? <span style={{ color: '#00ffa0' }}>✔ {bloku} řádků{v?.publikovat ? ' · publikovat' : ''}</span>
                  : p.timingData ? <span style={{ opacity: 0.6 }}>načasováno</span>
                  : <span style={{ opacity: 0.5 }}>nečasováno</span>}
              </div>
              {lzeZpivat && <button onClick={() => zpivej(p)} title="Zpívat" style={{ ...malyBtn, background: '#ffd700', color: '#000', border: 'none' }}>🎤</button>}
              {!v && <button onClick={() => smazPisen(p)} title="Smazat z telefonu" style={{ ...malyBtn, padding: '8px 10px' }}>🗑</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
