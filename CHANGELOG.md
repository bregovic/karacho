# Changelog — Karacho

## 2026-08-10 — bezpečnost, úklid a přehrávač
- **Admin uzavřen**: přibylo `middleware.ts` (+ `auth.config.ts` bez Prismy kvůli Edge runtime).
  `/admin/*` a `/designer` jen pro ADMIN, `/profile` pro přihlášené, zbytek veřejný.
  Doplněno `ensureAdmin()` do 6 akcí (mj. `bulkUpdateState`, `fetchLyricsAction`,
  `researchSongDataAction` — ty volaly OpenAI na náš účet bez jakékoli kontroly).
  **Odstraněno heslo `Admin123`** natvrdo v kódu ve veřejném repu.
- **Relace se uklízejí**: bez aktivity déle než 24 h se mažou i s frontou; úklid běží líně
  při připojení, cron netřeba. Jednorázově smazáno 180 mrtvých relací (ze 181).
- **Přehled využití** v `/admin/tech`: přehrání, zpěvy (7/30 dní), živé relace, písně,
  uživatelé, nejhranější písně. Pozor: `Song.playCount` počítá i nepřihlášené hosty,
  `SingingHistory` jen známé zpěváky — rozdíl = zpěvy bez přihlášení.
- **Oprava: vytvoření druhého hlasu** zapisovalo `state: 'UNPUBLISHED' as any`, což není
  hodnota enumu → akce **vždy selhala**. Nyní `SongState.NEW`, casty odstraněny.
- **Přehrávač na mobilu**: tlačítko Zavřít se nevešlo (lišta přetékala a `overflow:hidden`
  ji ořízl) a odchod nevypínal fullscreen, takže se z písně nedalo dostat. Opraveno
  včetně landscape, kde text přepínače přetékal přes Zavřít.
- **Odstraněno generování videa** — `/renderer`, `updateSongVideo`, `Song.videoUrl`
  a `videoSize`. Funkce byla hotová, ale nepoužitá (0 z 577 písní).
- **Vyčištěna historie gitu** od MP3: `.git` z 3 649 MB na 14 MB. Původní historie zůstává
  na GitHubu jako větev `zaloha-pred-cistenim`.
- **Přepínání stop**: druhá stopa se přednačítá a čas se nastavuje až po `loadedmetadata`.
  Pokus o dvě souběžně hrající stopy **skončil revertem** — korekce rozejití běžela v každém
  snímku a sama se krmila, výsledkem bylo sekavé přehrávání. Další pokus vést přes Web Audio API.
- Smazána duplicitní služba `karacho` na Railway (padala v cyklu kvůli chybějící `DATABASE_URL`
  a při každém pushi se marně buildila). Provoz obsluhuje `impartial-sparkle`.
