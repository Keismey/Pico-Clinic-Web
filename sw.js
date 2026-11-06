// Pico-Clinic hors ligne.
// En ligne : on prend toujours la version la plus récente sur le site (et on la garde en cache).
// Hors ligne (ou réseau trop lent) : on sert la copie en cache.
// Les listes FILES et MUSIC sont refaites par « node tools/maj-cache.mjs » (à lancer après chaque modification).
// FILES : préchargé à l'installation. Ni les musiques (gardées à leur première écoute), ni les grandes icônes
// (le navigateur les demande lui-même à l'installation), ni og.jpg (aperçu de lien, inutile hors ligne).
// MUSIC : musique → empreinte ; une musique modifiée change d'empreinte, l'ancienne copie est retirée.
const VERSION = 'pico-clinic-dd57e81e';
const FILES = [
  'audio/sons.json',
  'commun/ks-back.js',
  'commun/ks-studio.js',
  'couverture.webp',
  'data/clients.json',
  'data/decorations.json',
  'data/gestures.json',
  'data/orders.json',
  'data/patients.json',
  'data/ranks.json',
  'data/rare_parts.json',
  'data/story.json',
  'data/tools.json',
  'icons/apple-touch-icon.png',
  'icons/favicon.png',
  'icons/icon-192.png',
  'img/keismey-studio.webp',
  'img/titre.webp',
  'index.html',
  'js/achievements.js',
  'js/audio.js',
  'js/back.js',
  'js/canvas.js',
  'js/closeup.js',
  'js/daily.js',
  'js/deco.js',
  'js/drone.js',
  'js/feedback.js',
  'js/free.js',
  'js/gestures/batteries.js',
  'js/gestures/battery.js',
  'js/gestures/capacitor.js',
  'js/gestures/chip.js',
  'js/gestures/clips.js',
  'js/gestures/connector.js',
  'js/gestures/gear.js',
  'js/gestures/heart.js',
  'js/gestures/key.js',
  'js/gestures/magnifier.js',
  'js/gestures/oxide.js',
  'js/gestures/pins.js',
  'js/gestures/seam.js',
  'js/gestures/sensor.js',
  'js/gestures/solder.js',
  'js/gestures/spring.js',
  'js/gestures/train.js',
  'js/gestures/unscrew.js',
  'js/gestures/vacuum.js',
  'js/i18n.js',
  'js/main.js',
  'js/particles.js',
  'js/portraits.js',
  'js/progress.js',
  'js/save.js',
  'js/scenes/bench.js',
  'js/scenes/counter.js',
  'js/scenes/daily.js',
  'js/scenes/done.js',
  'js/scenes/free.js',
  'js/scenes/lobby.js',
  'js/scenes/notebook.js',
  'js/scenes/notes.js',
  'js/scenes/operation.js',
  'js/scenes/options.js',
  'js/scenes/orders.js',
  'js/scenes/rank.js',
  'js/scenes/reactivation.js',
  'js/scenes/shop.js',
  'js/scenes/story.js',
  'js/scenes/title.js',
  'js/scenes.js',
  'js/score.js',
  'js/settings.js',
  'js/share.js',
  'js/state.js',
  'js/textes-appli.js',
  'js/tutorial.js',
  'js/ui.js',
  'lang/en.json',
  'lang/fr.json',
  'manifest-en.webmanifest',
  'manifest.webmanifest',
];
const MUSIC = {
  'audio/music_op.mp3': 'f4b3ff25',
  'audio/music_workshop.mp3': '16c9a477',
};
const MUSIC_CACHE = 'pico-clinic-music';
const TIMEOUT = 4000;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => Promise.all(
      FILES.map((f) => c.add(new Request(f, { cache: 'reload' })).catch(() => {}))
    )).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('pico-clinic-') && k !== VERSION && k !== MUSIC_CACHE).map((k) => caches.delete(k))))
      .then(() => caches.open(MUSIC_CACHE))
      .then((c) => c.keys().then((reqs) => Promise.all(reqs
        .filter((r) => { const u = new URL(r.url); return MUSIC[u.pathname.slice(BASE.length)] !== u.searchParams.get('v'); })
        .map((r) => c.delete(r)))))
      .then(() => self.clients.claim())
  );
});

const BASE = new URL('./', self.location).pathname;

// Une musique : la copie gardée si elle est à jour, sinon un seul téléchargement, gardé pour la prochaine fois.
function music(req, path) {
  const key = path + '?v=' + MUSIC[path];
  return caches.open(MUSIC_CACHE).then((c) => c.match(key).then((hit) => hit || fetch(req.url, { cache: 'no-cache' }).then((res) => {
    if (res.ok) return c.put(key, res.clone()).catch(() => {}).then(() => res);
    return res;
  })));
}

function fromCache(req) {
  return caches.open(VERSION).then((c) => c.match(req, { ignoreSearch: true })
    .then((r) => r || (req.mode === 'navigate' ? c.match('index.html') : undefined)));
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.registration.scope)) return;
  const path = new URL(req.url).pathname.slice(BASE.length);
  if (MUSIC[path]) { e.respondWith(music(req, path)); return; }
  e.respondWith(new Promise((resolve) => {
    let done = false;
    const fallback = () => fromCache(req).then((r) => {
      if (!done && r) { done = true; resolve(r); }
      return r;
    });
    // réseau trop lent : on répond avec le cache, le réseau met quand même le cache à jour
    const timer = setTimeout(fallback, TIMEOUT);
    fetch(req).then((res) => {
      clearTimeout(timer);
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        // la page n'est gardée qu'une fois, sous « index.html » (et pas aussi sous « ./ »)
        const key = new URL(req.mode === 'navigate' ? 'index.html' : req.url, self.registration.scope);
        key.search = '';
        caches.open(VERSION).then((c) => c.put(key.href, copy));
      }
      if (!done) { done = true; resolve(res); }
    }).catch(() => {
      clearTimeout(timer);
      fallback().then((r) => {
        if (!done) { done = true; resolve(r || new Response('', { status: 504, statusText: 'hors ligne' })); }
      });
    });
  }));
});
