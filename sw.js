/* Guarda o app e todas as falas no aparelho para abrir rápido e funcionar sem internet. */
const CACHE = 'faladeiro-v3';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/store.js', 'js/sound.js', 'js/voice.js', 'js/mic.js', 'js/commands.js', 'js/dog.js', 'js/fx.js', 'js/ui.js', 'js/ball.js', 'js/brain.js', 'js/main.js',
  'icons/face.svg', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/icon-180.png',
  'voice/falas.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(FILES);
    try {
      const cat = await (await fetch('voice/falas.json')).json();
      await c.addAll(Object.keys(cat.lines).map((id) => `voice/${id}.mp3`));
    } catch (err) { /* as falas entram no cache conforme forem usadas */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// Responde do cache (rápido e offline) e atualiza o cache em segundo plano.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (url.origin !== location.origin && !isFont) return;
  // O modelo de voz (32 MB) não passa pelo cache do app: depois de extraído ele fica guardado pelo próprio reconhecedor.
  if (url.pathname.includes('/vosk/')) return;

  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true });
      const net = fetch(req).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
