'use client';
import { useState } from 'react';
import Link from 'next/link';
import { exportCatalogXmlAction, importCatalogXmlAction } from '@/app/admin/actions';

export default function DataExchangePage() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [exportMode, setExportMode] = useState<'ALL' | 'INCOMPLETE'>('INCOMPLETE');

  const handleExport = async () => {
    setLoading(true);
    try {
      const xml = await exportCatalogXmlAction(exportMode === 'INCOMPLETE');
      
      const blob = new Blob([xml], { type: 'text/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `karacho_katalog_${exportMode.toLowerCase()}_${new Date().toISOString().split('T')[0]}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('Chyba při exportu: ' + e.message);
    }
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatus(null);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target?.result as string;
        try {
          const res = await importCatalogXmlAction(content);
          setStatus({ success: true, message: `Úspěšně aktualizováno ${res.updatedCount} písní.` });
        } catch (err: any) {
          setStatus({ success: false, message: 'Chyba importu: ' + err.message });
        }
        setLoading(false);
      };
      reader.readAsText(file);
    } catch (e: any) {
      setStatus({ success: false, message: 'Chyba čtení souboru: ' + e.message });
      setLoading(false);
    }
  };

  const recommendedPrompt = `Jsi expert na hudební metadata. Tvým úkolem je zkontrolovat a doplnit přiložený XML seznam písní.
POKYNY:
1. OPRAVA: Zkontroluj <Title> a <Artist>. Pokud je v nich překlep, nesmysl (např. YouTube junk), nebo jsou prohozené, OPRAV JE přímo v XML.
2. DOPLNĚNÍ: Zaměř se na prázdná pole <Origin>, <Genre> a <Tags>.
3. KONZISTENCE: Používej pokud možno existující hodnoty z číselníku (Dictionaries).
4. PŮVOD: <Origin> uváděj jako ISO kód země (CZ, SK, EN, US, DE, PL atd.).
5. TAGY: <Tags> uváděj jako čárkou oddělený seznam (např. 80s, rock, happy).
6. VÝSTUP: Vrať mi zpět POUZE upravené XML ve stejné struktuře, nic jiného nepiš.`;

  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: 'white', padding: '6rem 2rem 2rem' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <Link href="/admin" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontSize: '13px' }}>← Zpět do Adminu</Link>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--color-gold)', margin: '0.5rem 0 0' }}>📦 Export / Import Katalogu</h1>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          
          {/* EXPORT SECTION */}
          <div style={{ background: '#111', padding: '2rem', borderRadius: '24px', border: '1px solid #222' }}>
            <h2 style={{ color: 'var(--color-gold)', marginTop: 0 }}>1. Export</h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', marginBottom: '1.5rem' }}>
              Stáhněte si katalog v XML. Můžete si vybrat, jestli chcete všechno, nebo jen ty s chybějícími údaji.
            </p>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem', background: 'rgba(0,0,0,0.3)', padding: '5px', borderRadius: '12px' }}>
              <button 
                onClick={() => setExportMode('INCOMPLETE')}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: exportMode === 'INCOMPLETE' ? 'var(--color-teal)' : 'transparent', color: 'white', fontWeight: 700, cursor: 'pointer' }}
              >
                Jen neúplné
              </button>
              <button 
                onClick={() => setExportMode('ALL')}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: exportMode === 'ALL' ? 'var(--color-teal)' : 'transparent', color: 'white', fontWeight: 700, cursor: 'pointer' }}
              >
                Všechno
              </button>
            </div>

            <button 
              onClick={handleExport}
              disabled={loading}
              style={{
                width: '100%', padding: '16px', borderRadius: '12px', border: 'none',
                background: 'linear-gradient(45deg, #00d2ff, #3a7bd5)',
                color: 'white', fontWeight: 800, cursor: loading ? 'wait' : 'pointer'
              }}
            >
              {loading ? '⏳ Generuji...' : '📥 STÁHNOUT XML'}
            </button>

            <div style={{ marginTop: '2rem' }}>
              <label style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '0.5rem' }}>DOPORUČENÝ PROMPT PRO AI:</label>
              <div style={{ 
                background: '#000', padding: '1rem', borderRadius: '12px', fontSize: '11px', 
                fontFamily: 'monospace', color: '#00ffa0', border: '1px solid #333',
                maxHeight: '130px', overflowY: 'auto'
              }}>
                {recommendedPrompt}
              </div>
              <button 
                onClick={() => { navigator.clipboard.writeText(recommendedPrompt); alert('Prompt zkopírován!'); }}
                style={{ background: 'none', border: 'none', color: '#00d2ff', fontSize: '11px', marginTop: '0.5rem', cursor: 'pointer' }}
              >
                📋 KOPÍROVAT PROMPT
              </button>
            </div>
          </div>

          {/* IMPORT SECTION */}
          <div style={{ background: '#111', padding: '2rem', borderRadius: '24px', border: '1px solid #222' }}>
            <h2 style={{ color: '#00ffa0', marginTop: 0 }}>2. Import</h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>
              Jakmile vám AI vrátí opravené XML, nahrajte ho sem. Systém aktualizuje údaje i opraví názvy/interprety.
            </p>
            
            <div style={{ 
              border: '2px dashed #333', borderRadius: '12px', padding: '2rem', textAlign: 'center',
              position: 'relative'
            }}>
              <input 
                type="file" 
                accept=".xml" 
                onChange={handleFileUpload}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                disabled={loading}
              />
              <div style={{ fontSize: '2rem' }}>📤</div>
              <div style={{ fontWeight: 600, marginTop: '1rem' }}>Vyberte opravené XML</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Nebo ho sem přetáhněte</div>
            </div>

            {status && (
              <div style={{ 
                marginTop: '1.5rem', padding: '1rem', borderRadius: '12px',
                background: status.success ? 'rgba(0,255,160,0.1)' : 'rgba(255,0,0,0.1)',
                border: `1px solid ${status.success ? '#00ffa0' : '#ff4b2b'}`,
                color: status.success ? '#00ffa0' : '#ff4b2b',
                fontSize: '14px'
              }}>
                {status.message}
              </div>
            )}
          </div>

        </div>

        <div style={{ marginTop: '3rem', background: 'rgba(255,215,0,0.05)', padding: '2rem', borderRadius: '24px', border: '1px solid rgba(255,215,0,0.1)' }}>
          <h3 style={{ color: 'var(--color-gold)', margin: '0 0 1rem' }}>💡 Jak na generální úklid?</h3>
          <ol style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, fontSize: '14px' }}>
            <li>Stáhněte si XML (buď vše, nebo jen neúplné kousky).</li>
            <li>Soubor nahrajte do <strong>ChatGPT</strong> nebo <strong>Claude</strong> a vložte mu zkopírovaný prompt.</li>
            <li>AI za vás doplní chybějící žánry, původ, tagy a dokonce opraví i překlepy v názvech.</li>
            <li>Výsledek od AI nahrajte zde zpět a databáze se okamžitě aktualizuje.</li>
          </ol>
        </div>

      </div>
    </div>
  );
}
