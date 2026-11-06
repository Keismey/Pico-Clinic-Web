// Démarrage, boucle de jeu, doigt (un seul à la fois), pause automatique.
import { canvas, ctx, resize, beginFrame, toLogical } from './canvas.js';
import { loadLanguages, detectLang, setLang, LANGS } from './i18n.js';
import { save, persist } from './save.js';
import { loadData } from './state.js';
import { register, go, scene, tickFade, drawFade } from './scenes.js';
import { tickUI } from './ui.js';
import * as fx from './particles.js';
import { unlock, loopStopAll } from './audio.js';
import title from './scenes/title.js';
import operation from './scenes/operation.js';
import reactivation from './scenes/reactivation.js';
import done from './scenes/done.js';
import orders from './scenes/orders.js';
import shop from './scenes/shop.js';
import counter from './scenes/counter.js';
import notebook from './scenes/notebook.js';
import rank from './scenes/rank.js';
import story from './scenes/story.js';
import bench from './scenes/bench.js';
import free from './scenes/free.js';
import options from './scenes/options.js';
import daily from './scenes/daily.js';
import lobby from './scenes/lobby.js';
import notes from './scenes/notes.js';
import { setContrast } from './ui.js';
import { applyHand } from './state.js';
import { initBack, asking, tickAsk, askPointer, drawAsk, pausePointer, drawPause, autoPause } from './back.js';

// La langue se choisit sur l'écran titre, dans les Options ou par le lien « ?lang= ».

let last = 0;
let paused = false;
// téléphone tourné : index.html affiche « Tourne ton téléphone » (même règle) et le jeu attend
const sideways = matchMedia('(orientation: landscape) and (max-height: 600px) and (pointer: coarse)');
let activeId = null;
let owner = null; // 'scene' tant qu'un doigt est posé

function loop(ts) {
  requestAnimationFrame(loop);
  if (paused || sideways.matches) { last = ts; return; }
  const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0;
  last = ts;
  tickUI(dt);
  // « Quitter la réparation ? » : le jeu est en pause derrière la question
  if (asking()) { tickAsk(dt); loopStopAll(); }
  else { scene().update(dt); fx.update(dt); }
  tickFade(dt);
  beginFrame();
  scene().draw(ctx);
  fx.draw(ctx);
  drawPause(ctx);
  drawFade(ctx);
  if (asking()) drawAsk(ctx);
}

function onPointer(type, e) {
  if (type === 'down') {
    if (activeId !== null) return; // un seul doigt
    activeId = e.pointerId;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* rien */ }
  } else if (e.pointerId !== activeId) {
    return;
  }
  e.preventDefault();
  const p = toLogical(e);
  if (type === 'down') { owner = 'scene'; unlock(); }
  if (asking()) askPointer(type, p.x, p.y);
  else if (pausePointer(type, p.x, p.y)) owner = 'pause';
  else scene().pointer(type, p.x, p.y);
  if (type === 'up') unlock();
  if (type === 'up' || type === 'cancel') { activeId = null; owner = null; }
}

async function boot() {
  resize();
  window.addEventListener('resize', resize);
  await Promise.all([loadLanguages(), loadData()]);
  // lien du hub « ?lang=fr » ou « ?lang=en » : choisit la langue et la retient
  const asked = new URLSearchParams(location.search).get('lang');
  if (LANGS.includes(asked) && save.settings.lang !== asked) { save.settings.lang = asked; persist(); }
  setLang(save.settings.lang || detectLang());
  // options d'accessibilité mémorisées
  setContrast(save.settings.contrast);
  applyHand();

  register('title', title);
  register('operation', operation);
  register('reactivation', reactivation);
  register('done', done);
  register('orders', orders);
  register('shop', shop);
  register('counter', counter);
  register('notebook', notebook);
  register('rank', rank);
  register('story', story);
  register('bench', bench);
  register('free', free);
  register('options', options);
  register('daily', daily);
  register('lobby', lobby);
  register('notes', notes);

  canvas.addEventListener('pointerdown', (e) => onPointer('down', e));
  // version web sur téléphone (hors appli et hors appli installée) : plein écran au premier toucher, pour cacher la barre d'adresse
  // (une seule fois : si le joueur en sort avec le bouton retour, on ne l'y remet pas)
  const nativeApp = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const installed = window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
  if (!nativeApp && !installed && window.matchMedia('(pointer: coarse)').matches && document.documentElement.requestFullscreen) {
    canvas.addEventListener('pointerup', () => {
      if (document.fullscreenElement) return;
      try { document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {}); } catch (e) { /* refusé */ }
    }, { once: true });
  }
  canvas.addEventListener('pointermove', (e) => onPointer('move', e));
  canvas.addEventListener('pointerup', (e) => onPointer('up', e));
  canvas.addEventListener('pointercancel', (e) => onPointer('cancel', e));
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // pause quand l'onglet n'est plus visible (le doigt en cours est relâché)
  // (et une réparation en cours ouvre sa pause : en revenant, le joueur reprend quand il veut)
  const toBackground = () => {
    autoPause();
    if (activeId !== null) {
      if (owner === 'scene') scene().pointer('cancel', 0, 0);
      else if (owner === 'pause') pausePointer('cancel', 0, 0);
      activeId = null;
      owner = null;
    }
  };
  // appli Android : l'évènement « pause » de Capacitor arrive aussi quand la WebView reste « visible »
  const app = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (app && app.addListener) app.addListener('pause', toBackground);
  document.addEventListener('visibilitychange', () => {
    paused = document.hidden;
    if (paused) toBackground();
  });

  const loading = document.getElementById('loading');
  if (loading) loading.remove();
  // lien de test « ?essai » : l'atelier d'essai des gestes secondaires
  if (new URLSearchParams(location.search).has('essai')) { document.body.classList.remove('noir'); go('bench'); }
  else go('title', { intro: true }); // logo Keismey Studio, puis « Appuie pour continuer »
  // bouton retour du téléphone : on remonte d'un écran (commun/ks-back.js gère l'historique)
  initBack(() => {
    if (activeId !== null && owner === 'scene') scene().pointer('cancel', 0, 0);
    activeId = null;
    owner = null;
  });
  requestAnimationFrame(loop);
  // V5 : jeu disponible hors ligne (sw.js met tous les fichiers en cache)
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('hors ligne indisponible', e));
  }
}

boot().catch((err) => {
  console.error(err);
  const loading = document.getElementById('loading');
  if (loading) loading.textContent = 'Erreur de chargement / Loading error';
});
