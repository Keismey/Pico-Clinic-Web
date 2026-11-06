// Carnet de Maître Ohm : les clients rencontrés, les 12 pièces rares, les 5 rangs, les défis et les succès.
import { W } from '../canvas.js';
import { t } from '../i18n.js';
import { Buttons, C, drawCreamBackground, drawText, fitText, roundRect, wrapLines, font } from '../ui.js';
import { drawPerson, drawRarePart } from '../portraits.js';
import { game } from '../state.js';
import { save, totalStars } from '../save.js';
import { clientMet, clientDone, lastOrderOf, hasPart, rankInfo, orderByNumber } from '../progress.js';
import { vibrate } from '../feedback.js';
import { sfx } from '../audio.js';
import { go } from '../scenes.js';
import { leftText, miniStar } from './orders.js';
import { lastDays, dayEntry, badgeOf, badgeCount, drawBadge, dailyOpen, dateKey } from '../daily.js';
import { dayLabel } from './daily.js';
import { ACHIEVEMENTS, REWARD, earned, checkAchievements } from '../achievements.js';

const TAU = Math.PI * 2;
const TOP = 300;
const CARD = { w: 470, h: 370, gx: 30, gy: 22 };
const CELL = { w: 300, h: 262, gx: 20, gy: 8 };
const RANK_ROW = 222;

let tab = 'clients';
let buttons, time, detail, pressed;

// Zones à toucher de l'onglet affiché : [{ x, y, w, h, id }]
function zones() {
  if (tab === 'clients') {
    return game.data.clients.order.map((id, i) => ({
      id,
      x: 50 + (i % 2) * (CARD.w + CARD.gx),
      y: TOP + 20 + Math.floor(i / 2) * (CARD.h + CARD.gy),
      w: CARD.w, h: CARD.h,
    }));
  }
  if (tab === 'parts') {
    return game.data.rareParts.map((p, i) => ({
      id: p.id,
      x: 60 + (i % 3) * (CELL.w + CELL.gx),
      y: TOP + 100 + Math.floor(i / 3) * (CELL.h + CELL.gy),
      w: CELL.w, h: CELL.h,
    }));
  }
  return [];
}

function zoneAt(x, y) {
  return zones().find((z) => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) || null;
}

function card(ctx, z, pressedNow) {
  ctx.fillStyle = '#d9c3a3';
  roundRect(ctx, z.x, z.y + 8, z.w, z.h, 30); ctx.fill();
  ctx.fillStyle = pressedNow ? '#f3e2c8' : C.paper;
  roundRect(ctx, z.x, z.y, z.w, z.h, 30); ctx.fill();
}

function drawClients(ctx) {
  for (const z of zones()) {
    const met = clientMet(z.id);
    const info = game.data.clients.list[z.id];
    card(ctx, z, pressed && pressed.id === z.id);
    // portrait coupé dans un cadre
    ctx.save();
    roundRect(ctx, z.x + 20, z.y + 20, z.w - 40, 230, 22);
    ctx.fillStyle = met ? 'rgba(63, 208, 187, 0.12)' : 'rgba(122, 99, 80, 0.08)';
    ctx.fill();
    ctx.clip();
    drawPerson(ctx, z.id, z.x + z.w / 2, z.y + 150, 0.62, { time: met ? time : 0, mood: met ? 'happy' : 'neutral', unknown: !met });
    ctx.restore();
    fitText(ctx, met ? t('client.' + z.id) : t('nb.unknown'), z.x + z.w / 2, z.y + 285, z.w - 40, 40, met ? C.ink : C.inkSoft, 900);
    fitText(ctx, t('nb.client_orders', { n: clientDone(z.id), t: info.arc }), z.x + z.w / 2, z.y + 333, z.w - 40, 30, met ? info.color : C.inkSoft, 800);
  }
}

function drawParts(ctx) {
  const n = save.rare_parts.length;
  fitText(ctx, t('nb.parts_count', { n }), W / 2, TOP + 30, 900, 44, C.copperDark, 900);
  fitText(ctx, t('nb.parts_hint'), W / 2, TOP + 78, 900, 30, C.inkSoft, 700);
  for (const z of zones()) {
    const own = hasPart(z.id);
    card(ctx, z, pressed && pressed.id === z.id);
    drawRarePart(ctx, z.id, z.x + z.w / 2, z.y + 105, 72, own, time);
    drawText(ctx, own ? t('rare.' + z.id) : t('nb.unknown'), z.x + z.w / 2, z.y + 215, z.w - 30, 28, { color: own ? C.ink : C.inkSoft, weight: 800, lineH: 32 });
  }
}

function drawRanks(ctx) {
  const s = totalStars();
  const next = rankInfo(save.rank + 1);
  fitText(ctx, next ? t('nb.stars_progress', { s, n: next.stars }) : t('nb.stars_max', { s }), W / 2, TOP + 30, 940, 40, C.copperDark, 900);
  // barre d'étoiles vers le prochain examen
  const bx = 90, by = TOP + 70, bw = W - 180;
  ctx.fillStyle = 'rgba(58, 42, 30, 0.12)';
  roundRect(ctx, bx, by, bw, 30, 15); ctx.fill();
  const prev = rankInfo(save.rank).stars;
  const k = next ? Math.max(0, Math.min(1, (s - prev) / (next.stars - prev))) : 1;
  if (k > 0) {
    ctx.fillStyle = '#ffc93c';
    roundRect(ctx, bx, by, Math.max(30, bw * k), 30, 15); ctx.fill();
  }
  for (const r of game.data.ranks) {
    const y = TOP + 130 + (r.rank - 1) * RANK_ROW;
    const cur = r.rank === save.rank;
    const past = r.rank < save.rank;
    ctx.save();
    ctx.globalAlpha = r.rank > save.rank ? 0.6 : 1;
    ctx.fillStyle = '#d9c3a3';
    roundRect(ctx, 50, y + 8, W - 100, RANK_ROW - 22, 30); ctx.fill();
    ctx.fillStyle = cur ? '#e6fbf7' : C.paper;
    roundRect(ctx, 50, y, W - 100, RANK_ROW - 22, 30); ctx.fill();
    if (cur) { ctx.strokeStyle = C.turquoise; ctx.lineWidth = 6; ctx.stroke(); }
    // médaille
    ctx.fillStyle = cur ? C.turquoise : past ? C.copper : '#b9ab98';
    ctx.beginPath(); ctx.arc(130, y + 100, 56, 0, TAU); ctx.fill();
    fitText(ctx, String(r.rank), 130, y + 102, 80, 58, '#fff', 900);
    leftText(ctx, t('rank.' + r.rank), 210, y + 48, 700, 40, C.ink, 900);
    const exam = r.exam ? orderByNumber(r.exam) : null;
    const sub = r.exam
      ? t('nb.rank_need', { n: r.stars, exam: t('rank.' + r.rank + '.exam') })
      : t('nb.rank_start');
    leftText(ctx, (cur ? t('nb.rank_current') + '  ·  ' : '') + sub, 210, y + 98, 760, 28, cur ? C.turquoiseDark : exam ? C.orangeDark : C.inkSoft, 800);
    // déblocages : sur deux lignes si besoin, plutôt que d'être rétrécis jusqu'à devenir illisibles
    ctx.font = font(26, 700);
    const unl = wrapLines(ctx, t('rank.' + r.rank + '.unlocks'), 760).slice(0, 2);
    unl.forEach((line, i) => leftText(ctx, line, 210, y + (unl.length > 1 ? 136 : 146) + i * 32, 760, 26, C.inkSoft, 700));
    if (past || cur) miniStar(ctx, W - 100, y + 48, 22, true);
    ctx.restore();
  }
}

// Fiche détaillée d'un client ou d'une pièce, par-dessus le carnet.
function drawDetail(ctx) {
  ctx.fillStyle = 'rgba(58, 42, 30, 0.45)';
  ctx.fillRect(0, 0, W, 1920);
  const x = 60, y = 380, w = W - 120, h = 1060;
  ctx.fillStyle = '#d9c3a3';
  roundRect(ctx, x, y + 12, w, h, 44); ctx.fill();
  ctx.fillStyle = C.paper;
  roundRect(ctx, x, y, w, h, 44); ctx.fill();
  if (detail.kind === 'client') {
    const id = detail.id;
    const met = clientMet(id);
    const info = game.data.clients.list[id];
    ctx.save();
    roundRect(ctx, x + 40, y + 40, w - 80, 420, 30);
    ctx.fillStyle = 'rgba(63, 208, 187, 0.12)';
    ctx.fill();
    ctx.clip();
    drawPerson(ctx, id, W / 2, y + 250, 1.05, { time, mood: met ? 'happy' : 'neutral', unknown: !met });
    ctx.restore();
    fitText(ctx, met ? t('client.' + id) : t('nb.unknown'), W / 2, y + 520, w - 80, 58, C.ink, 900);
    fitText(ctx, t('nb.client_orders', { n: clientDone(id), t: info.arc }), W / 2, y + 585, w - 80, 36, info.color, 800);
    drawText(ctx, met ? t('client.' + id + '.bio') : t('nb.not_met'), W / 2, y + 700, w - 120, 38, { color: C.ink, weight: 600, lineH: 50 });
    const last = met ? lastOrderOf(id) : null;
    if (last && last.thanks && last.thanks.length) {
      const q = t(last.thanks[last.thanks.length - 1].replace(/^[a-z]+:/, ''));
      drawText(ctx, t('nb.last_words', { q }), W / 2, y + 890, w - 120, 34, { color: info.color, weight: 700, lineH: 46 });
    }
  } else {
    const p = game.data.rareParts.find((r) => r.id === detail.id);
    const own = hasPart(p.id);
    drawRarePart(ctx, p.id, W / 2, y + 230, 150, own, time);
    fitText(ctx, own ? t('rare.' + p.id) : t('nb.part_missing'), W / 2, y + 480, w - 80, 52, own ? C.ink : C.inkSoft, 900);
    drawText(ctx, t('nb.how.' + p.how, { n: p.order }), W / 2, y + 590, w - 120, 40, { color: C.copperDark, weight: 800 });
    drawText(ctx, p.use ? t('nb.use.proto', { n: p.use }) : t('nb.use.collection'), W / 2, y + 680, w - 120, 36, { color: C.inkSoft, weight: 700 });
  }
  fitText(ctx, t('orders.tap_close'), W / 2, y + h - 60, w - 80, 32, C.inkSoft, 700);
}

// V4b — Défis : les 7 derniers jours, aujourd'hui en haut.
function drawDaily(ctx, time) {
  fitText(ctx, t('nb.daily.count', { n: badgeCount() }), W / 2, TOP + 40, W - 120, 40, C.copperDark, 900);
  const today = dateKey();
  lastDays(7).forEach((k, i) => {
    const y = TOP + 100 + i * 180, h = 160;
    const e = dayEntry(k);
    const b = badgeOf(k);
    card(ctx, { x: 50, y, w: W - 100, h }, false);
    drawBadge(ctx, 140, y + h / 2 - 8, 46, b, time);
    leftText(ctx, (k === today ? t('nb.daily.today') + ' · ' : '') + dayLabel(k), 230, y + 52, 560, 38, C.ink, 800);
    let sub;
    if (!e || !e.tries) sub = t(k === today ? 'nb.daily.open' : 'nb.daily.missed');
    else if (b) sub = t('nb.daily.result', { b: t('daily.badge.' + b), t: fmtTime(e.time) });
    else sub = t('nb.daily.failed');
    leftText(ctx, sub, 230, y + 108, 560, 30, b ? C.turquoiseDark : C.inkSoft, 700);
    if (e && e.tries) for (let s = 0; s < 3; s++) miniStar(ctx, 840 + s * 60, y + h / 2 - 4, 24, s < e.best);
  });
}

// Succès : une ligne par succès, ses 3 médailles et la progression vers la suivante.
function drawAch(ctx, time) {
  const h = 236, gap = 24;
  ACHIEVEMENTS.forEach((a, i) => {
    const y = TOP + 30 + i * (h + gap);
    const got = earned(a.id);
    const v = a.value();
    card(ctx, { x: 50, y, w: W - 100, h }, false);
    leftText(ctx, t('ach.' + a.id), 90, y + 50, 560, 40, C.ink, 900);
    leftText(ctx, t('ach.' + a.id + '.desc'), 90, y + 98, 560, 28, C.inkSoft, 700);
    for (let k = 0; k < 3; k++) drawBadge(ctx, 740 + k * 100, y + 72, 38, k < got ? k + 1 : 0, time);
    // barre vers le prochain palier
    const next = a.tiers[got];
    const bx = 90, by = y + 140, bw = W - 180;
    ctx.fillStyle = 'rgba(58, 42, 30, 0.12)';
    roundRect(ctx, bx, by, bw, 26, 13); ctx.fill();
    const prev = got ? a.tiers[got - 1] : 0;
    const k = next ? Math.max(0, Math.min(1, (v - prev) / (next - prev))) : 1;
    if (k > 0) { ctx.fillStyle = got >= 3 ? '#ffc93c' : C.turquoise; roundRect(ctx, bx, by, Math.max(26, bw * k), 26, 13); ctx.fill(); }
    const sub = next ? t('ach.next', { v: Math.min(v, next), n: next, c: REWARD[got] }) : t('ach.all');
    leftText(ctx, sub, 90, y + 200, W - 180, 28, next ? C.copperDark : C.turquoiseDark, 800);
  });
}

function fmtTime(s) {
  s = Math.round(s || 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default {
  init(params = {}) {
    if (params.tab) tab = params.tab;
    time = 0;
    detail = null;
    pressed = null;
    buttons = new Buttons();
    // V4b : onglet « Défis » (historique des 7 derniers jours) à partir du rang 3
    const tabs = ['clients', 'parts', 'ranks'];
    if (dailyOpen() || Object.keys(save.daily || {}).length) tabs.push('daily');
    tabs.push('ach');
    // paliers atteints depuis la dernière réparation (ancienne sauvegarde) : payés en arrivant
    checkAchievements();
    if (!tabs.includes(tab)) tab = 'clients';
    const tw = (W - 100 + 20) / tabs.length;
    tabs.forEach((id, i) => buttons.add({
      x: 50 + i * tw, y: 150, w: tw - 20, h: 120, size: tabs.length > 4 ? 30 : tabs.length > 3 ? 34 : 40, wrap: tabs.length > 4, style: 'secondary',
      hit: { x: 50 + i * tw - 10, y: 142, w: tw, h: 136 },
      label: () => t('nb.tab.' + id),
      selected: () => tab === id,
      onTap: () => { tab = id; },
    }));
    buttons.add({ x: 240, y: 1700, w: 600, h: 160, size: 60, label: () => t('nb.back'), onTap: () => go('orders') });
  },

  update(dt) {
    time += dt;
  },

  draw(ctx) {
    drawCreamBackground(ctx);
    // pages lignées du carnet
    ctx.strokeStyle = 'rgba(95, 184, 232, 0.16)';
    ctx.lineWidth = 3;
    for (let y = 320; y < 1680; y += 64) { ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(W - 30, y); ctx.stroke(); }
    leftText(ctx, t('nb.title'), 60, 85, 680, 60, C.copperDark, 900);
    if (tab === 'clients') drawClients(ctx);
    else if (tab === 'parts') drawParts(ctx);
    else if (tab === 'daily') drawDaily(ctx, time);
    else if (tab === 'ach') drawAch(ctx, time);
    else drawRanks(ctx);
    buttons.draw(ctx);
    if (detail) drawDetail(ctx);
  },

  pointer(type, x, y) {
    if (detail) {
      if (type === 'up') detail = null;
      return;
    }
    if (buttons.pointer(type, x, y)) return;
    if (type === 'down') pressed = zoneAt(x, y);
    else if (type === 'up') {
      const z = zoneAt(x, y);
      if (z && pressed && z.id === pressed.id) {
        vibrate(10);
        sfx('page');
        detail = { kind: tab === 'clients' ? 'client' : 'part', id: z.id };
      }
      pressed = null;
    } else if (type === 'cancel') pressed = null;
  },
};
