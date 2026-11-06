// V4b — Défi quotidien (rang 3) : un patient imposé, tiré à partir de la date du jour.
// Même date = même patient pour tout le monde, sans serveur. 2 essais par jour (le meilleur compte),
// gains doublés (payés une fois par jour) et un badge ; historique des 7 derniers jours dans le Carnet.
import { save, persist } from './save.js';
import { makeFree, FREE } from './free.js';
import { C } from './ui.js';
import { countDailyWin } from './achievements.js';

export const DAILY_RANK = 3;    // rang qui ouvre le défi
export const DAILY_TRIES = 2;   // 1 essai, puis 1 de plus
const KEEP_DAYS = 14;           // jours gardés dans la sauvegarde

// Date du jour sur le téléphone : « 2026-10-25 ».
export function dateKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Les n derniers jours, aujourd'hui en premier.
export function lastDays(n = 7) {
  const out = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    out.push(dateKey(d));
    d.setDate(d.getDate() - 1);
  }
  return out;
}

// Hasard fixe à partir d'un texte (mulberry32 sur un hachage du texte).
function seeded(text) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dailyOpen() {
  return save.rank >= DAILY_RANK;
}

// Fiche du jour dans la sauvegarde (créée si besoin).
export function dayEntry(key = dateKey(), create = false) {
  if (!save.daily) save.daily = {};
  if (!save.daily[key] && create) save.daily[key] = { tries: 0, stars: [false, false, false], best: 0, time: null, paid: false };
  return save.daily[key] || null;
}

export function triesLeft(key = dateKey()) {
  const e = dayEntry(key);
  return DAILY_TRIES - (e ? e.tries : 0);
}

// Badge du jour : 0 = aucun, 1 bronze, 2 argent, 3 or (= étoiles du meilleur essai réparé).
export function badgeOf(key) {
  const e = dayEntry(key);
  return e && e.stars[0] ? e.best : 0;
}

export function badgeCount() {
  return Object.keys(save.daily || {}).filter((k) => badgeOf(k) > 0).length;
}

// Commande du défi (game.free) : difficulté rang 2 à 4 selon la date, gains doublés.
export function makeDaily(key = dateKey()) {
  const rng = seeded('pico-daily-' + key);
  const rank = [2, 3, 3, 4][Math.floor(rng() * 4)];
  const o = makeFree(rank, false, rng);
  o.daily = key;
  o.reward = Math.round(FREE.base[rank - 1] * 2);
  return o;
}

// Un essai commence : il compte même si on quitte la réparation.
export function startDaily() {
  const key = dateKey();
  if (triesLeft(key) <= 0) return null;
  const e = dayEntry(key, true);
  e.tries++;
  prune();
  persist();
  return makeDaily(key);
}

// Résultat d'un essai : meilleur score gardé, payé une seule fois par jour.
export function recordDaily(rep, r) {
  const key = rep.patient.order.daily;
  const e = dayEntry(key, true);
  const n = r.stars.filter(Boolean).length;
  const before = badgeOf(key);
  const firstPay = !e.paid && r.stars[0];
  const paid = (firstPay ? r.base + r.tip : 0) - r.parts;
  const better = r.stars[0] && (!e.stars[0] || n > e.best || (n === e.best && (e.time === null || r.elapsed < e.time)));
  if (better || (!e.stars[0] && n > e.best)) {
    e.stars = r.stars.slice();
    e.best = n;
    e.time = Math.round(r.elapsed);
  }
  if (firstPay) { e.paid = true; countDailyWin(key); }
  save.credits = Math.max(0, save.credits + paid);
  persist();
  const badge = badgeOf(key);
  return { firstPay, paid, record: false, rankUp: 0, part: null, badge: badge > before ? badge : 0 };
}

// On ne garde que les derniers jours.
function prune() {
  const keys = Object.keys(save.daily || {}).sort();
  while (keys.length > KEEP_DAYS) delete save.daily[keys.shift()];
}

// Badge en forme de médaille : 1 bronze, 2 argent, 3 or, 0 emplacement vide.
const METAL = [null, ['#c98a4b', '#8a5526'], ['#cfd6dd', '#7e8a96'], ['#f2c14e', '#a87a12']];
export function drawBadge(ctx, x, y, r, tier, time = 0) {
  ctx.save();
  if (!tier) {
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = 'rgba(122, 99, 80, 0.45)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    return;
  }
  const [fill, dark] = METAL[tier];
  // rubans
  ctx.fillStyle = C.turquoiseDark;
  ctx.beginPath(); ctx.moveTo(x - r * 0.55, y); ctx.lineTo(x - r * 0.75, y + r * 1.45); ctx.lineTo(x - r * 0.35, y + r * 1.2); ctx.lineTo(x - r * 0.1, y + r * 1.5); ctx.lineTo(x, y); ctx.fill();
  ctx.fillStyle = C.orange;
  ctx.beginPath(); ctx.moveTo(x + r * 0.55, y); ctx.lineTo(x + r * 0.75, y + r * 1.45); ctx.lineTo(x + r * 0.35, y + r * 1.2); ctx.lineTo(x + r * 0.1, y + r * 1.5); ctx.lineTo(x, y); ctx.fill();
  // médaille
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.arc(x, y + r * 0.08, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = Math.max(2, r * 0.08);
  ctx.beginPath(); ctx.arc(x, y, r * 0.72, 0, Math.PI * 2); ctx.stroke();
  // petit drone gravé
  ctx.strokeStyle = dark;
  ctx.lineWidth = Math.max(2, r * 0.09);
  ctx.lineCap = 'round';
  const s = r * 0.32;
  ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s); ctx.stroke();
  for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * 0.15, 0, Math.PI * 2); ctx.stroke();
  }
  // reflet qui passe
  const k = (time * 0.5) % 1;
  ctx.globalAlpha = 0.35 * Math.sin(k * Math.PI);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.4, r * 0.22, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
