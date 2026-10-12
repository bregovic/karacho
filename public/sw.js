/*
 * Service worker offline studia (/designer/offline).
 *
 * Schválně úzký: obsluhuje jen stránku offline studia a statické soubory
 * Nextu (`/_next/static/`, mají v názvu otisk obsahu, takže se nemění).
 * Zbytek webu jde normálně na síť – nechceme, aby karaoke někomu servíroval
 * zastaralé stránky z mezipaměti.
 *
 * Do mezipaměti se nic neukládá samo: stránka po načtení pošle seznam
 * souborů, které opravdu použila (zprávou `ulozit`). Při první návštěvě totiž
 * worker ještě stránku neřídí a skripty by mu utekly.
 */
const CACHE = 'karacho-offline-v1';
const STRANKA = '/designer/offline';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('message', (e) => {
  if (e.data?.typ !== 'ulozit') return;
  const adresy = (e.data.adresy || []).filter((u) => typeof u === 'string');
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(
        adresy.map((u) =>
          fetch(u, { credentials: 'same-origin' })
            .then((r) => (r.ok ? c.put(u, r) : null))
            .catch(() => null),
        ),
      ),
    ),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Stránka studia: online čerstvá ze sítě, offline z mezipaměti.
  if (req.mode === 'navigate' && url.pathname === STRANKA) {
    e.respondWith(
      fetch(req)
        .then((r) => {
          if (r.ok) { const kopie = r.clone(); caches.open(CACHE).then((c) => c.put(STRANKA, kopie)); }
          return r;
        })
        .catch(() => caches.match(STRANKA).then((r) => r || Response.error())),
    );
    return;
  }

  // Statika Nextu: z mezipaměti, když tam je, jinak ze sítě.
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(caches.match(req).then((r) => r || fetch(req)));
  }
});
