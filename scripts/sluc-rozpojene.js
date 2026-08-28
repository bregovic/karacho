/**
 * Sloučení písní, které se rozpojily starým hromadným importem.
 *
 * Dokud `createSong` uměl jen zakládat nové písně, sedla instrumentálka
 * k záznamu, který v katalogu už byl (páruje se podle názvu), a originál
 * si založil vlastní. V databázi tak leží dvojice, kde jedna půlka má
 * originál a druhá instrumentálku.
 *
 * Skript je ve výchozím stavu **jen náhled** — nic nemění a jen vypíše,
 * co by udělal. Sloučí až s parametrem `--proved`:
 *
 *   node --env-file=.env scripts/sluc-rozpojene.js            # náhled
 *   node --env-file=.env scripts/sluc-rozpojene.js --proved   # sloučí
 *
 * Vítězí záznam s originálem (na ten je navázané časování i historie
 * zpěvů). Z druhého se doplní jen to, co vítězi chybí, a pak se smaže.
 * Soubory v R2 se nemažou — instrumentálka se jen přepíše na vítěze,
 * takže žádný klíč neosiří.
 */

const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

const ZNAMENKA = /[̀-ͯ]/g;
const otisk = (s) =>
  (s || '').normalize('NFD').replace(ZNAMENKA, '').toLowerCase().replace(/[^a-z0-9]/g, '');

const PROVED = process.argv.includes('--proved');

/** Co se z poraženého doplní vítězi, pokud mu to chybí. */
const DOPLNITELNE = [
  'audioUrl', 'audioHash', 'audioSize',
  'instrumentalUrl', 'instrumentalHash',
  'lyrics', 'chords', 'genre', 'year', 'backgroundUrl', 'jsonUrl',
  'importName', 'requestedByEmail',
];

async function main() {
  const vse = await db.song.findMany();

  const skupiny = new Map();
  for (const s of vse) {
    const klic = `${otisk(s.artist)}|${otisk(s.title)}`;
    if (!skupiny.has(klic)) skupiny.set(klic, []);
    skupiny.get(klic).push(s);
  }

  const dvojice = [...skupiny.values()].filter((v) => v.length > 1);
  if (dvojice.length === 0) {
    console.log('Žádné rozpojené dvojice — katalog je v pořádku.');
    return;
  }

  console.log(`${PROVED ? '🔧 SLUČUJI' : '👀 NÁHLED (nic se nemění)'} — dvojic: ${dvojice.length}\n`);

  for (const skupina of dvojice) {
    // Vítěz: kdo má originál; při shodě ten, co má víc vyplněného.
    const serazene = [...skupina].sort((a, b) => {
      if (!!b.audioUrl !== !!a.audioUrl) return b.audioUrl ? 1 : -1;
      return vyplnenost(b) - vyplnenost(a);
    });
    const [vitez, ...porazeni] = serazene;

    const zmeny = {};
    for (const porazeny of porazeni) {
      for (const pole of DOPLNITELNE) {
        if (vitez[pole] == null && zmeny[pole] == null && porazeny[pole] != null) {
          zmeny[pole] = porazeny[pole];
        }
      }
    }

    console.log(`• ${vitez.artist} – ${vitez.title}`);
    console.log(`    zůstává: ${vitez.id} [${vitez.state}] audio=${!!vitez.audioUrl} instr=${!!vitez.instrumentalUrl}`);
    for (const p of porazeni) {
      console.log(`    ruší se: ${p.id} [${p.state}] audio=${!!p.audioUrl} instr=${!!p.instrumentalUrl}`);
    }
    const popisZmen = Object.keys(zmeny);
    console.log(`    doplní se: ${popisZmen.length ? popisZmen.join(', ') : '(nic)'}`);

    if (!PROVED) { console.log(); continue; }

    if (popisZmen.length) {
      await db.song.update({ where: { id: vitez.id }, data: zmeny });
    }
    for (const p of porazeni) {
      // Fronta a historie zpěvů se převedou na vítěze, ať se nesmažou
      // kaskádou spolu se zrušeným záznamem.
      await db.karaokeSessionQueue.updateMany({ where: { songId: p.id }, data: { songId: vitez.id } });
      await db.singingHistory.updateMany({ where: { songId: p.id }, data: { songId: vitez.id } });
      await db.songReport.updateMany({ where: { songId: p.id }, data: { songId: vitez.id } });
      await db.favorite.deleteMany({ where: { songId: p.id } });
      await db.karaokeSession.updateMany({ where: { currentSongId: p.id }, data: { currentSongId: null } });
      await db.song.delete({ where: { id: p.id } });
    }
    console.log('    ✅ sloučeno\n');
  }

  if (!PROVED) {
    console.log('Nic se nezměnilo. Spusť znovu s `--proved`, pokud to tak má být.');
  }
}

function vyplnenost(s) {
  return DOPLNITELNE.reduce((n, pole) => n + (s[pole] != null ? 1 : 0), 0);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => db.$disconnect());
