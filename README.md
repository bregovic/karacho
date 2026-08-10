# 🎤 Karacho

Karaoke platforma pro bary. TV hraje jako **master**, mobily se připojují jako **slave**
a zrcadlí text; hosté se přidávají pětimístným kódem nebo QR. Kromě karaoke umí režim
**akordů** (zpěvník) a **Studio** na časování textu.

Provoz: <https://karacho.up.railway.app>

---

## Stack

| Vrstva | Co |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Databáze | PostgreSQL (Railway), Prisma 6 |
| Přihlášení | Auth.js v5, credentials + bcrypt, role `USER` / `ADMIN` |
| Úložiště | Cloudflare R2 (audio, instrumentály, pozadí) |
| Ostatní | OpenAI (dohledávání textů), sharp, ffmpeg |

## Spuštění

```bash
npm install
npm run dev
```

`.env` potřebuje `DATABASE_URL`, `AUTH_SECRET`, klíče k R2 a `OPENAI_API_KEY`.

## Nasazení

Repo je na GitHubu (`bregovic/karacho`) a Railway z něj **deployuje automaticky po pushi**.

```bash
npx tsc --noEmit && npx next build   # ověřit lokálně
git push                              # = nasazení
```

Railway: projekt `splendid-commitment`, **prostředí `Karacho`**, služba `impartial-sparkle`
(pozor, ne „karacho" – ta byla smazána jako duplikát). Schéma se nasazuje přes
`prisma db push`, migrace se v projektu nepoužívají.

## Přístupová práva

`middleware.ts` chrání routy plošně, pravidla jsou v `auth.config.ts`:

- `/admin/*` a `/designer` → jen **ADMIN**
- `/profile` → přihlášený
- zbytek (katalog, přehrávač, `/join`) → **veřejné**, host v baru se nepřihlašuje

Server actions si roli hlídají navíc samy (`ensureAdmin()`), UI schované tlačítko není ochrana.
Veřejné jsou záměrně jen `incrementPlayCount`, `requestSong` a `checkDuplicateSong`.

## Doménové pojmy

- **Časování** je v `Song.timingData` jako `blocks[]`; blok má `bs`/`be` (start/konec),
  `li` (řádek), `v` (**hlas**: 1 = červená, 2 = modrá, 3 = společně) a slova `w[]`.
- **Duet** se pozná automaticky (`isDuet`) podle přítomnosti hlasů 1 a 2.
- **Relace** (`KaraokeSession`) vzniká i pouhým otevřením přehrávače. Po **24 h bez
  aktivity se maže** – úklid běží líně při každém připojení, cron není potřeba.
- **Režim akordů**: zvuk musí být ztlumený, zastavený a **nesmí se ani bufferovat**.

## Na co si dát pozor

- **Soubor s `'use server'` smí exportovat jen async funkce.** Exportovaná konstanta shodí
  celý modul (`has no exports at all`) a projekt na to už dvakrát doplatil.
- **Neobcházet enum přes `as any`.** Zápis `state: 'UNPUBLISHED' as any` databáze vždy
  odmítla a funkce „druhý hlas" kvůli tomu nikdy nefungovala. `UNPUBLISHED` je jen filtr v UI.
- **Přepínání originál/instrumentál** mění `src` jednoho audio elementu → reload + seek.
  Čas se smí nastavit **až po `loadedmetadata`**, jinak ho iOS zahodí. Druhá stopa se
  přednačítá skrytým elementem, aby přepnutí nemuselo stahovat 3–5 MB.
  Pokus o dvě souběžné stopy je popsaný v CHANGELOGu u 10. 8. 2026 – **skončil revertem**.
- **Do repozitáře nepatří audio.** Historie kdysi obsahovala MP3 a `.git` narostl na 3,6 GB;
  vyčištěno 10. 8. 2026. Skutečné soubory patří na R2.

## Dokumentace

- `CONTEXT_PROMPT.md` – architektura a princip fungování
- `KARACHO_MANIFEST.md` – závazná pravidla chování (Studio, akordy, synchronizace, UI)
- `AGENTS.md` – kontext pro práci na projektu
- `CHANGELOG.md` – historie změn
