// Service worker: guarda o app no aparelho para abrir rápido e sem internet.
// Ao publicar uma versão nova, troque o número abaixo.
const VERSAO = 'nemesis-v1';
const ARQUIVOS = ['./', './index.html', './form.html', './config.js', './manifest.json', './css/app.css', './css/form.css',
  './js/app.js', './js/api.js', './js/demo.js', './js/util.js', './js/comum.js', './js/aluna.js', './js/coach.js', './js/form.js',
  './lib/preact-htm.js', './lib/supabase.js', './icons/icon-192.png',
  './lib/fontes/inter-latin-400-normal.woff2', './lib/fontes/inter-latin-500-normal.woff2', './lib/fontes/inter-latin-600-normal.woff2',
  './lib/fontes/inter-latin-700-normal.woff2', './lib/fontes/playfair-display-latin-600-normal.woff2', './lib/fontes/playfair-display-latin-700-normal.woff2',
  './lib/fontes/playfair-display-latin-600-italic.woff2'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
// rede primeiro (versão nova aparece na hora), cache se estiver sem internet
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(VERSAO).then((cache) => cache.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
