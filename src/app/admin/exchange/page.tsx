'use client';

import { useState } from 'react';
import Link from 'next/link';
import { exportCatalogXmlAction, importCatalogXmlAction } from '@/app/admin/actions';

export default function DataExchangePage() {
  const [loading, setLoading] = useState(false);
  const [xmlData, setXmlData] = useState<string | null>(null);
  const [status, setStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  const handleExport = async () => {
    setLoading(true);
    try {
      const xml = await exportCatalogXmlAction();
      setXmlData(xml);
      
      // Stažení souboru
      const blob = new Blob([xml], { type: 'text/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `karacho_catalog_${new Date().toISOString().split('T')[0]}.xml`;
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

  const recommendedPrompt = `Jsi expert na hudební metadata. Tvým úkolem je doplnit chybějící údaje v přiloženém XML seznamu písní.
POKYNY:
1. Zaměř se na pole <Origin>, <Genre> a <Tags>.
2. Pokud je pole prázdné nebo obsahuje "null", doplň ho podle tvých znalostí.
3. Používej pokud možno existující hodnoty z číselníku (Dictionaries) pro zachování konzistence.
4. Původ (Origin) uváděj jako ISO kód země (CZ, SK, EN, US, DE, PL atd.).
5. Tagy (Tags) uváděj jako čárkou oddělený seznam (např. 80s, rock, happy).
6. Vrať mi zpět POUZE upravené XML ve stejné struktuře, nic jiného nepiš.`;

  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: 'white', padding: '6rem 2rem 2rem' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <Link href="/admin" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontSize: '13px' }}>← Zpět do Adminu</Link>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--color-gold)', margin: '0.5rem 0 0' }}>📦 Datový servis (AI Exchange)</h1>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          
          {/* EXPORT SECTION */}
          <div style={{ background: '#111', padding: '2rem', borderRadius: '24px', border: '1px solid #222' }}>
            <h2 style={{ color: 'var(--color-gold)', marginTop: 0 }}>1. Export pro AI</h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>
              Stáhněte si celý katalog v XML formátu. Tento soubor pak vložte do ChatGPT nebo Claude spolu s doporučeným promptem.
            </p>
            <button 
              onClick={handleExport}
              disabled={loading}
              style={{
                width: '100%', padding: '16px', borderRadius: '12px', border: 'none',
                background: 'linear-gradient(45deg, #00d2ff, #3a7bd5)',
                color: 'white', fontWeight: 800, cursor: loading ? 'wait' : 'pointer'
              }}
            >
              {loading ? '⏳ Generuji...' : '📥 STÁHNOUT KATALOG (XML)'}
            </button>

            <div style={{ marginTop: '2rem' }}>
              <label style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '0.5rem' }}>DOPORUČENÝ PROMPT:</label>
              <div style={{ 
                background: '#000', padding: '1rem', borderRadius: '12px', fontSize: '12px', 
                fontFamily: 'monospace', color: '#00ffa0', border: '1px solid #333',
                maxHeight: '150px', overflowY: 'auto'
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
            <h2 style={{ color: '#00ffa0', marginTop: 0 }}>2. Import od AI</h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>
              Jakmile vám AI vrátí opravené XML, nahrajte ho sem. Systém aktualizuje chybějící žánry, původ a tagy.
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
          <h3 style={{ color: 'var(--color-gold)', margin: '0 0 1rem' }}>💡 Jak to funguje?</h3>
          <ol style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, fontSize: '14px' }}>
            <li>Stáhnete si XML soubor, který obsahuje váš aktuální katalog a instrukce pro AI.</li>
            <li>Tento soubor nahrajete do <strong>ChatGPT Plus</strong> nebo <strong>Claude.ai</strong> (podporují přílohy).</li>
            <li>Vložíte jim zkopírovaný prompt.</li>
            <li>AI prohledá své znalosti a do prázdných políček v XML doplní správné údaje.</li>
            <li>Výsledek od AI uložíte jako .xml a nahrajete ho zde zpět.</li>
          </ol>
        </div>

      </div>
    </div>
  );
}
