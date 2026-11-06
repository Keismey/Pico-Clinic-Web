// Liste des commandes : une ligne par réparation, débloquées l'une après l'autre,
// rangées par chapitre (un chapitre = un rang). Boutique et Carnet apparaissent avec l'histoire.
import { W } from '../canvas.js';
import { dailyOpen, triesLeft, DAILY_TRIES } from '../daily.js';
import { t } from '../i18n.js';
import { Buttons, C, drawCreamBackground, drawToast, drawText, fitText, roundRect, font } from '../ui.js';
import { game } from '../state.js';
import { save, totalStars } from '../save.js';
import { orderState, orderStars, examStars, orderByNumber, missingParts } from '../progress.js';
import { seen } from '../tutorial.js';
import { drawGribouille, drawRarePart } from '../portraits.js';
import { vibrate } from '../feedback.js';
import { sfx } from '../audio.js';
import { go } from '../scenes.js';
import { openOptions } from '../back.js';
import { allDone } from './lobby.js';

const TAU = Math.PI * 2;
const ROW = { x: 50, w: W - 100, top: 350, bottom: 1545 };
const TABS = { x: 50, y: 232, w: W - 100, h: 86 };

let buttons, toast, pressed, time, grib, chapter;

// Chapitres ouverts : le 1 toujours, les suivants une fois le rang atteint.
function chapters() {
  const all = [...new Set(game.data.orders.map((o) => o.rank))].sort((a, b) => a - b);
  return all.filter((c) => c === 1 || save.rank >= c);
}

function rows() {
  return game.data.orders.filter((o) => o.rank === chapter);
}

function layout() {
  const n = Math.max(1, rows().length);
  const step = Math.min(122, (ROW.bottom - ROW.top) / n);
  return { step, h: step - 10, f: Math.min(1, step / 122) };
}

function paidN(n) {
  const o = orderByNumber(n);
  return !!(o && save.orders[o.id] && save.orders[o.id].paid);
}

// La boutique s'ouvre après la commande 1, le carnet est trouvé après la commande 3.
export function shopOpen() {
  return paidN(1);
}
export function notebookOpen() {
  return paidN(3) || seen('notebook');
}

// Texte aligné à gauche, rétréci s'il est trop long.
export function leftText(ctx, text, x, y, maxW, size, color, weight = 800) {
  let s = size;
  ctx.font = font(s, weight);
  while (ctx.measureText(text).width > maxW && s > 18) { s -= 2; ctx.font = font(s, weight); }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

export function miniStar(ctx, x, y, r, on) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = on ? '#ffc93c' : 'rgba(58, 42, 30, 0.13)';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = on ? '#c4862a' : 'rgba(58, 42, 30, 0.22)';
  ctx.stroke();
}

function drawLock(ctx, x, y) {
  ctx.strokeStyle = C.inkSoft;
  ctx.lineWidth = 9;
  ctx.beginPath(); ctx.arc(x, y - 12, 20, Math.PI, 0); ctx.stroke();
  ctx.fillStyle = C.inkSoft;
  roundRect(ctx, x - 30, y - 12, 60, 46, 8); ctx.fill();
}

function rowAt(x, y) {
  const L = layout();
  const i = Math.floor((y - ROW.top) / L.step);
  if (x < ROW.x || x > ROW.x + ROW.w || i < 0 || i >= rows().length) return -1;
  return i; // toute la hauteur de la ligne, espace compris
}

function tabAt(x, y) {
  const list = chapters();
  // zone de toucher plus haute que l'onglet dessiné (44 px à l'écran au moins)
  if (y < TABS.y - 30 || y > TABS.y + TABS.h + 25 || x < TABS.x || x > TABS.x + TABS.w) return -1;
  return list[Math.floor((x - TABS.x) / (TABS.w / list.length))] || -1;
}

// Gribouille explique qu'il manque des étoiles pour l'examen.
function drawGribPanel(ctx) {
  const k = Math.min(1, grib.t * 4);
  ctx.save();
  ctx.globalAlpha = k;
  ctx.fillStyle = 'rgba(58, 42, 30, 0.45)';
  ctx.fillRect(0, 0, W, 1920);
  ctx.fillStyle = '#d9c3a3';
  roundRect(ctx, 60, 712, W - 120, 560, 44); ctx.fill();
  ctx.fillStyle = C.paper;
  roundRect(ctx, 60, 700, W - 120, 560, 44); ctx.fill();
  drawGribouille(ctx, 200, 960, 0.75, { time: grib.t, talk: grib.t < 3 });
  drawText(ctx, grib.text(), 640, 950, 560, 40, { color: C.ink, weight: 700, lineH: 52 });
  fitText(ctx, t('orders.tap_close'), W / 2, 1205, 800, 30, C.inkSoft, 700);
  ctx.restore();
}

function showToast(key, vars, color = C.inkSoft) {
  toast = { key, vars, color, t: 2.2, max: 2.2 };
}

function open(o) {
  const st = orderState(o);
  if (st === 'locked') { vibrate([15, 25, 15]); sfx('error'); showToast('orders.locked'); return; }
  if (st === 'stars') { vibrate([15, 25, 15]); sfx('error'); grib = { text: () => t('orders.gribouille_stars', { n: examStars(o), s: totalStars() }), t: 0 }; return; }
  // prototype : il manque une pièce rare, Gribouille dit quelle commande refaire en 3 étoiles
  if (st === 'part') {
    vibrate([15, 25, 15]); sfx('error');
    const p = missingParts(o)[0];
    const key = p.how === 'stars3' ? 'orders.gribouille_part' : 'orders.gribouille_gift';
    grib = { text: () => t(key, { part: t('rare.' + p.id), n: p.order }), t: 0 };
    return;
  }
  // le client passe toujours au comptoir (même une commande déjà réussie : on peut relire les dialogues, « Passer » les saute)
  if (o.n === 1 && !seen('ch1')) go('story', { id: 'ch1', then: { scene: 'counter', params: { order: o.id, mode: 'intro' } } });
  else go('counter', { order: o.id, mode: 'intro' });
}

// Défi du jour / Atelier libre : au premier appui, Gribouille présente le mode s'il ne l'a pas encore fait.
export function openMode(s) {
  if (seen(s)) go(s);
  else go('story', { id: s, then: { scene: s } });
}

export default {
  init() {
    // les 60 commandes réparées : « Jouer » mène à l'écran de fin (sauf si on a choisi « Rejouer les niveaux »)
    if (!game.replay && allDone()) { go('lobby'); return; }
    toast = null;
    grib = null;
    pressed = -1;
    time = 0;
    // chapitre affiché : celui de la prochaine commande à faire
    const list = chapters();
    const next = game.data.orders.find((o) => list.includes(o.rank) && orderState(o) !== 'done');
    chapter = next ? next.rank : list[list.length - 1];
    // « Rejouer les niveaux » : on ouvre le premier chapitre où il manque des étoiles
    if (!next && game.replay) {
      const miss = game.data.orders.find((o) => list.includes(o.rank) && orderStars(o) < 3);
      if (miss) chapter = miss.rank;
    }
    buttons = new Buttons();
    buttons.add({ x: 50, y: 1570, w: 310, h: 160, size: 52, label: () => t('orders.shop'), visible: shopOpen(), onTap: () => go('shop') });
    buttons.add({
      x: 385, y: 1570, w: 310, h: 160, size: 52, label: () => t('orders.notebook'), visible: notebookOpen(),
      // première fois : Gribouille montre d'abord le carnet de Maître Ohm
      onTap: () => (seen('notebook') ? go('notebook') : go('story', { id: 'notebook', then: { scene: 'notebook' } })),
    });
    // « Rejouer les niveaux » : ce bouton ramène à l'écran de fin au lieu du menu
    const replay = !!game.replay;
    buttons.add({ x: 720, y: 1570, w: 310, h: 160, size: 52, style: 'secondary', label: () => t(replay ? 'shop.back' : 'title.options'), onTap: () => (replay ? go('lobby') : openOptions()) });
    // V3b : Atelier libre, ouvert au rang 5
    buttons.add({ x: 760, y: 30, w: 280, h: 120, hit: { x: 760, y: 22, w: 280, h: 136 }, size: 40, label: () => t('orders.free'), visible: save.rank >= 5, onTap: () => openMode('free') });
    // V4b : défi quotidien, ouvert au rang 3 (il clignote tant qu'il n'est pas tenté aujourd'hui)
    buttons.add({
      x: save.rank >= 5 ? 460 : 760, y: 30, w: 280, h: 120, size: 40, style: 'on',
      hit: { x: save.rank >= 5 ? 460 : 760, y: 22, w: 280, h: 136 },
      label: () => t('orders.daily'), visible: dailyOpen(), pulse: triesLeft() >= DAILY_TRIES,
      onTap: () => openMode('daily'),
    });
  },

  update(dt) {
    time += dt;
    if (toast) { toast.t -= dt; if (toast.t <= 0) toast = null; }
    if (grib) grib.t += dt;
  },

  draw(ctx) {
    drawCreamBackground(ctx);
    leftText(ctx, t('orders.title'), 60, 85, save.rank >= 5 ? 380 : 680, 76, C.copperDark, 900);
    leftText(ctx, t('orders.status', { r: save.rank, name: t('rank.' + save.rank), n: save.credits, s: totalStars() }), 60, 180, W - 120, 38, C.inkSoft, 800);
    this.drawTabs(ctx);

    const L = layout();
    rows().forEach((o, i) => {
      const st = orderState(o);
      const x = ROW.x, y = ROW.top + i * L.step, h = L.h, cy = y + h / 2, f = L.f;
      const dim = st === 'locked' || st === 'stars' || st === 'part';
      ctx.save();
      ctx.globalAlpha = dim ? 0.55 : 1;
      ctx.fillStyle = '#d9c3a3';
      roundRect(ctx, x, y + 8, ROW.w, h - 4, 30); ctx.fill();
      ctx.fillStyle = i === pressed ? '#f3e2c8' : C.paper;
      roundRect(ctx, x, y, ROW.w, h - 6, 30); ctx.fill();
      // numéro
      ctx.fillStyle = st === 'done' ? C.copper : st === 'open' ? C.turquoise : '#b9ab98';
      ctx.beginPath(); ctx.arc(x + 66, cy - 3, 40 * f, 0, TAU); ctx.fill();
      ctx.font = font(Math.round(40 * f), 900);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText(String(o.n), x + 66, cy - 1);
      // patient et client
      const name = o.name ? t(o.name) : t('patient.' + o.model);
      leftText(ctx, name, x + 130, cy - 22 * f, 560, Math.round(40 * f), C.ink, 800);
      const sub = t('client.' + o.client) + (o.exam ? '  ·  ' + t('orders.exam', { r: o.exam }) : '');
      leftText(ctx, sub, x + 130, cy + 22 * f, 560, Math.round(30 * f), o.exam ? C.orangeDark : C.inkSoft, 700);
      // à droite : étoiles, nouveau, cadenas ou étoiles nécessaires
      const rx = x + ROW.w - 60;
      if (st === 'done') {
        const n = orderStars(o);
        for (let k = 0; k < 3; k++) miniStar(ctx, rx - 180 + k * 70, cy - 3, 28 * f, k < n);
      } else if (st === 'open') {
        const a = 0.75 + 0.25 * Math.sin(time * 5);
        ctx.globalAlpha = a;
        ctx.font = font(34, 900); ctx.textAlign = 'right';
        ctx.fillStyle = C.orange;
        ctx.fillText(t('orders.new'), rx + 20, cy - 3);
      } else if (st === 'part') {
        missingParts(o).slice(0, 2).forEach((p, k) => drawRarePart(ctx, p.id, rx - 10 - k * 90, cy - 3, 34 * f, true, time));
      } else if (st === 'stars') {
        miniStar(ctx, rx - 110, cy - 3, 26, true);
        ctx.font = font(36, 900); ctx.textAlign = 'right'; ctx.fillStyle = C.ink;
        ctx.fillText(`${totalStars()}/${examStars(o)}`, rx + 20, cy - 1);
      } else {
        drawLock(ctx, rx - 10, cy);
      }
      ctx.restore();
    });

    buttons.draw(ctx);
    if (toast) drawToast(ctx, t(toast.key, toast.vars), W / 2, 950, toast.t / toast.max, toast.color);
    if (grib) drawGribPanel(ctx);
  },

  // Onglets des chapitres (un seul tant que le rang 2 n'est pas atteint).
  drawTabs(ctx) {
    const list = chapters();
    const w = TABS.w / list.length;
    list.forEach((c, i) => {
      const x = TABS.x + i * w, on = c === chapter;
      ctx.fillStyle = on ? C.copperDark : 'rgba(196, 122, 60, 0.15)'; // blanc sur cuivre foncé : 6,1:1
      roundRect(ctx, x + 4, TABS.y, w - 8, TABS.h, 30); ctx.fill();
      const label = list.length > 1 ? t('chapter.n', { n: c }) : t('chapter.n', { n: c }) + ' · ' + t('chapter.' + c + '.title');
      fitText(ctx, label, x + w / 2, TABS.y + TABS.h / 2 + 2, w - 40, 34, on ? '#fff' : C.copperDark, 900);
    });
  },

  pointer(type, x, y) {
    if (grib) { if (type === 'up') grib = null; return; }
    if (buttons.pointer(type, x, y)) return;
    if (type === 'up') {
      const c = tabAt(x, y);
      if (c > 0 && c !== chapter) { chapter = c; vibrate(8); pressed = -1; return; }
    }
    if (type === 'down') pressed = rowAt(x, y);
    else if (type === 'up') {
      const i = rowAt(x, y);
      if (i >= 0 && i === pressed) { vibrate(10); open(rows()[i]); }
      pressed = -1;
    } else if (type === 'cancel') pressed = -1;
  },
};
