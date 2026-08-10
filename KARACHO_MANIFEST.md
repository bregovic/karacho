# 🎤 KARACHO MANIFEST v1.0

Tento dokument definuje standardy a funkčnosti projektu Karacho. Slouží jako závazný návod pro vývoj a kontrolní seznam pro testování.

## 🎹 1. Studio (Timing Editor)
- **Fluid Flow Logic**: 
    - Klávesa **[W]** (Word) klíčuje slovo. 
    - Pokud je stisknuta na posledním slově řádku, **MUSÍ** automaticky odskočit na další řádek a zaklíčovat jeho první slovo (zajišťuje plynulost).
- **Line Advance**: 
    - Klávesa **[ENTER]** (📏) slouží **POUZE** k přípravnému posunu na další řádek. Nesmí zaklíčovat slovo.
- **Undo Action**: 
    - Klávesa **[BACKSPACE]** (✕) maže poslední časový údaj. 
    - Na mobilu musí být vždy viditelné samostatné tlačítko **✕**.
- **Touch Precision**: Progress bar v editoru musí mít výšku >= 30px pro snadné ovládání prstem.

## 🎸 2. Zpěvník (Chords Mode)
- **Audio Suppression**: V režimu akordů je zvuk prioritně **vypnut**, zastaven a audio se nebuferuje/nepřednačítá.
- **Visuals**:
    - Text je vycentrován (`text-align: center`).
    - Akordy jsou zobrazeny žlutě nad textem s dostatečným vertikálním odstupem.
- **Autoscroll**: 
    - Mobil: Plovoucí tlačítko vlevo dole.
    - Desktop: Skryto (využívá se scroll myší).

## 🧹 3. Scraper, Import & Čištění
- **Primary Source**: Sekce **Akordy** v adminu je hlavním zdrojem dat.
- **Auto-Bracketing**: Skript automaticky identifikuje akordy nad textem (včetně českého **H**) a převádí je na formát v závorkách `[G]` pro usnadnění transpozice.
- **Standard Cleaning**: Funkce vyčištění textu (žluté tlačítko) vezme obsah z Akordů, odstraní plevel (R:, 1., Intro, Bridge) a akordy, a výsledek nasype do sekce **Text**.

## 🔗 4. Synchronizace & Session
- **High-Precision Sync**: Slave zařízení (TV/Watch mode) se synchronizují každých 500ms s tolerancí driftu max 0.4s.
- **Global Control**: Start/Pauza na jakémkoliv zařízení v relaci se musí okamžitě zrcadlit na všechna ostatní.
- **Smart Audio Management**: 
    - Slave zařízení jsou při vstupu automaticky ztlumena (Anti-Echo).
    - Stav Mute je perzistentní (ukládá se do localStorage prohlížeče).

## 📱 5. Mobilní UI & Design
- **Top Bar Consistency**: Logo vlevo, Hamburger menu vpravo – nikdy se nesmí zalomit na dva řádky.
- **Czech First**: Veškeré UI texty musí být v korektní češtině (např. "ŤUKEJ SEM", nikoliv "RYTMA").
- **Menu UX**: Kliknutím na položku v menu se menu automaticky zavře.

## 🔊 6. Zvuk a přepínání stop
- **Přepnutí originál/instrumentál** vyměňuje `src` jednoho elementu. Čas se smí nastavit
  **až po události `loadedmetadata`** — dřív ho Safari na iOS zahodí a je slyšet škubnutí.
- Druhá stopa se **přednačítá** skrytým elementem, aby přepnutí nestahovalo 3–5 MB.
  V režimu akordů se nepřednačítá nic.
- **Dvě souběžně hrající stopy se neosvědčily** (10. 8. 2026): korekce rozejití běžela
  v každém snímku a sama se krmila → sekavé přehrávání. Vráceno. Další pokus vést přes
  **Web Audio API** (společné hodiny), ne přes dva `<audio>` elementy.

## 🧱 7. Technická pravidla
- Soubor s `'use server'` smí exportovat **jen async funkce** — exportovaná konstanta shodí
  celý modul. Projekt na to doplatil dvakrát.
- **Nepoužívat `as any` u hodnot enumu.** `state: 'UNPUBLISHED' as any` databáze vždy
  odmítla; `UNPUBLISHED` je jen filtr v UI, ne stav písně.
- Do gitu **nepatří audio** — historie kvůli MP3 narostla na 3,6 GB (vyčištěno 10. 8. 2026).

---
*Poslední aktualizace: 10. 8. 2026*
*Status: HLÍDÁNO ANTIGRAVITY* 🏗️🛡️✨🚀🤵🥂🎤|⏚
