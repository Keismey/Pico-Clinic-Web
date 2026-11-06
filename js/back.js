// Bouton retour du téléphone (ou du navigateur, ou Échap) : on remonte d'un écran.
// L'historique est géré par commun/ks-back.js (même fichier dans tous les jeux du hub).
// Pendant une réparation, un bouton pause à l'écran ouvre la même question (seule sortie sur iPhone
// quand le jeu est installé : il n'y a ni bouton ni geste retour).
// Questions : pendant une réparation « Quitter la réparation ? » (avec un bouton Options : les réglages
// s'ouvrent par-dessus la réparation, qui reste en pause) ; sur la liste des commandes, l'écran de fin
// et l'écran titre « Quitter Pico-Clinic ? ».
// La réparation se met aussi en pause toute seule quand le jeu passe en arrière-plan (autoPause).
import { W, H } from './canvas.js';
import { t, getLang } from './i18n.js';
import { Buttons, C, ACCESS, STYLES, drawText, roundRect } from './ui.js';
import { go, scene, sceneName } from './scenes.js';
import { drawGribouille } from './portraits.js';
import { game } from './state.js';
import options from './scenes/options.js';

// Écran → écran précédent (les écrans absents d'ici gèrent eux-mêmes le retour, avec back()).
const PARENT = { shop: 'orders', notebook: 'orders', rank: 'orders', done: 'orders', bench: 'title', free: 'orders', daily: 'orders' };
const REPAIR = ['operation', 'reactivation'];

// Quitter une réparation : atelier d'essai (gestes ou commandes), Atelier libre ou liste des commandes.
function leave() {
  const o = game.repair && game.repair.patient.order;
  if (o && o.daily) go('daily', { test: !!o.test });
  else if (o && o.test) go(o.free ? 'free' : 'bench', o.free ? { test: true } : { page: o.clone ? 'orders' : 'gestures' });
  else go(o && o.daily ? 'daily' : o && o.free ? 'free' : 'orders');
}

// Les trois questions : clé des textes et action du bouton « oui ».
const ASKS = {
  repair: { key: 'back.', yes: leave },
  hub: { key: 'back.hub.', yes: () => window.KSBack.toHub() },
};

let ask = null; // question ouverte
let opts = false; // Options ouvertes par-dessus la pause d'une réparation
let time = 0;

function openAsk(kind) {
  time = 0;
  const a = ASKS[kind];
  const b = new Buttons();
  b.add({ x: 130, y: 1090, w: 380, h: 150, size: 50, style: 'secondary', label: () => t(a.key + 'leave'), onTap: () => { ask = null; a.yes(); } });
  b.add({ x: 570, y: 1090, w: 380, h: 150, size: 50, label: () => t(a.key + 'stay'), onTap: () => { ask = null; } });
  const tall = kind === 'repair';
  if (tall) b.add({ x: 130, y: 1270, w: 820, h: 130, size: 46, style: 'secondary', label: () => t('title.options'), onTap: () => openOptions(true) });
  ask = { key: a.key, buttons: b, tall };
}

// Options pendant la pause : « Retour » ramène à la question de la pause.
// Fenêtre Options, par-dessus l'écran en cours (liste des commandes, écran de fin, pause d'une réparation).
export function openOptions(repair = false) {
  opts = true;
  options.init({ from: sceneName(), repair, close: () => { opts = false; time = 1; } });
}

// Le jeu passe en arrière-plan pendant une réparation : la pause s'ouvre (le chrono est arrêté).
export function autoPause() {
  if (!ask && REPAIR.includes(sceneName())) openAsk('repair');
}

function onBack() {
  if (window.KS && window.KS.closeDialog()) return;   // fenêtre « Sauvegarde » (commun/ks-studio.js)
  if (opts) { options.back(); return; }               // Options de la pause : retour à la pause
  if (ask) { ask = null; return; }                    // retour pendant la question = rester
  const name = sceneName();
  if (REPAIR.includes(name)) { openAsk('repair'); return; }
  const sc = scene();
  if (sc.back && sc.back()) return;
  if (name === 'title') { openAsk('hub'); return; }
  if (name === 'orders' && game.replay) { go('lobby'); return; }
  if (name === 'orders' || name === 'lobby') { openAsk('hub'); return; }
  if (PARENT[name]) go(PARENT[name]);
}

// cancelFinger : relâche le doigt en cours avant de changer d'écran.
export function initBack(cancelFinger) {
  window.KSBack.init({
    back: () => { cancelFinger(); onBack(); },
    lang: () => getLang(),
    // version web hébergée sur Cloudflare (hors keismey.github.io) : « Aller au hub » mène au vrai hub
    hubUrl: () => (/(^|\.)github\.io$/.test(location.hostname) ? '' : 'https://keismey.github.io/'),
    title: () => sceneName() === 'title' && !ask && !scene().showsLogo(),
  });
}

// Pendant la question, le jeu est en pause.
export function asking() {
  return !!ask || opts;
}

export function tickAsk(dt) {
  if (opts) { options.update(dt); return; }
  time += dt;
}

export function askPointer(type, x, y) {
  if (opts) { options.pointer(type, x, y); return; }
  ask.buttons.pointer(type, x, y);
}

export function drawAsk(ctx) {
  if (opts) { options.draw(ctx); return; }
  const k = Math.min(1, time * 5);
  const ph = ask.tall ? 800 : 640;
  ctx.save();
  ctx.globalAlpha = k;
  ctx.fillStyle = 'rgba(58, 42, 30, 0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#d9c3a3';
  roundRect(ctx, 60, 642, W - 120, ph, 44); ctx.fill();
  ctx.fillStyle = C.paper;
  roundRect(ctx, 60, 630, W - 120, ph, 44); ctx.fill();
  drawGribouille(ctx, W / 2, 760, 0.6, { time });
  drawText(ctx, t(ask.key + 'title'), W / 2, 900, W - 220, 56, { color: C.copperDark, weight: 900 });
  drawText(ctx, t(ask.key + 'text'), W / 2, 1000, W - 240, 38, { color: C.inkSoft, weight: 700, lineH: 48 });
  ask.buttons.draw(ctx);
  ctx.restore();
}

// Bouton pause des réparations : en haut, du côté de la boîte de pièces (l'autre coin a la coupelle des vis).
const PAUSE_R = 62;
let pauseHeld = false;

function pausePos() {
  return { x: ACCESS.lefty ? 84 : W - 84, y: 84 };
}

export function showsPause() {
  return !ask && REPAIR.includes(sceneName());
}

// true si le doigt est pour le bouton pause (il le garde jusqu'au relâchement).
export function pausePointer(type, x, y) {
  const p = pausePos();
  const on = Math.hypot(x - p.x, y - p.y) < PAUSE_R + 14;
  if (type === 'down') {
    pauseHeld = false;
    if (!showsPause() || !on) return false;
    pauseHeld = true;
    return true;
  }
  if (!pauseHeld) return false;
  if (type === 'up' || type === 'cancel') {
    pauseHeld = false;
    if (type === 'up' && on && showsPause()) openAsk('repair');
  }
  return true;
}

export function drawPause(ctx) {
  if (!showsPause()) return;
  const p = pausePos();
  const st = STYLES.secondary;
  const push = pauseHeld ? 6 : 0;
  ctx.save();
  ctx.fillStyle = st.shadow;
  ctx.beginPath(); ctx.arc(p.x, p.y + 8, PAUSE_R, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = st.fill;
  ctx.beginPath(); ctx.arc(p.x, p.y + push, PAUSE_R, 0, Math.PI * 2); ctx.fill();
  if (ACCESS.contrast) { ctx.strokeStyle = C.ink; ctx.lineWidth = 5; ctx.stroke(); }
  ctx.fillStyle = C.ink;
  roundRect(ctx, p.x - 22, p.y + push - 26, 15, 52, 5); ctx.fill();
  roundRect(ctx, p.x + 7, p.y + push - 26, 15, 52, 5); ctx.fill();
  ctx.restore();
}
