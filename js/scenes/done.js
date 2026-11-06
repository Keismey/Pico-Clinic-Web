// Fin de réparation : 3 étoiles qui apparaissent une à une, paie, pourboire, crédits.
import { W } from '../canvas.js';
import { t } from '../i18n.js';
import { Buttons, C, drawCreamBackground, drawText, fitText, roundRect } from '../ui.js';
import { canShare, shareButton, drawShareToast } from '../share.js';
import { withDrone, drawFrame, drawCover } from '../drone.js';
import { game } from '../state.js';
import { save, totalStars } from '../save.js';
import { scoreRepair, recordRepair, recordFree } from '../score.js';
import { makeFree } from '../free.js';
import { recordDaily, startDaily, triesLeft, drawBadge } from '../daily.js';
import { vibrate } from '../feedback.js';
import { sfx } from '../audio.js';
import * as fx from '../particles.js';
import { go } from '../scenes.js';
import { orderState, nextOrder, examStars } from '../progress.js';
import { drawRarePart } from '../portraits.js';
import { seen, markSeen, drawGribBox, drawRing } from '../tutorial.js';
import { storyAfter } from './story.js';
import { countRepair, checkAchievements } from '../achievements.js';

// Tutoriel (commande 1) : Gribouille explique les étoiles, les crédits, puis ouvre la boutique.
const TUTO = ['tuto.stars', 'tuto.credits', 'tuto.shop'];
const CPS = 42;

const TAU = Math.PI * 2;
const STAR_Y = 930;
const STAR_X = [W / 2 - 290, W / 2, W / 2 + 290];
const STAR_KEYS = ['done.star.works', 'done.star.clean', 'done.star.precise'];
const STAR_DELAY = 0.55;

let rep, buttons, time, res, pay, shown, creditsShown, needStars, tuto, shareToast;
let won = []; // succès gagnés pendant cette réparation : [{ id, tier, reward }]

function fmt(sec) {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function starPath(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

function drawStar(ctx, x, y, r, on, k) {
  ctx.save();
  ctx.translate(x, y);
  const pop = on ? 1 + 0.35 * Math.max(0, 1 - k * 3) * Math.sin(Math.min(1, k * 3) * Math.PI) : 1;
  ctx.scale(pop, pop);
  starPath(ctx, 0, 0, r);
  ctx.fillStyle = on && k > 0 ? '#ffc93c' : 'rgba(58, 42, 30, 0.12)';
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 10;
  ctx.strokeStyle = on && k > 0 ? '#c4862a' : 'rgba(58, 42, 30, 0.25)';
  ctx.stroke();
  ctx.restore();
}

export default {
  init() {
    rep = game.repair;
    time = 0;
    shown = 0;
    shareToast = null;
    res = scoreRepair(rep);
    const before = save.credits;
    // atelier d'essai : rien n'est payé ni enregistré ; Atelier libre : payé à chaque fois, sans étoiles enregistrées
    const o = rep.patient.order;
    const test = !!o.test;
    const free = !!o.free;
    const daily = !!o.daily;
    pay = test ? { firstPay: false, paid: 0, record: false, rankUp: 0, part: null } : daily ? recordDaily(rep, res) : free ? recordFree(rep, res) : recordRepair(rep, res);
    // succès : compteurs, puis paliers atteints (payés en crédits, annoncés par le bandeau)
    if (!test) countRepair(rep, res);
    won = test ? [] : checkAchievements();
    creditsShown = before;
    // commande suivante si elle est jouable, sinon retour à la liste
    const next = test || free ? null : nextOrder(o);
    const nextOk = next && orderState(next) === 'open';
    needStars = next && orderState(next) === 'stars' ? examStars(next) : 0;
    tuto = o.n === 1 && pay.firstPay && !free && !seen('results') ? { i: 0, shown: 0 } : null;
    // scène d'histoire après cette commande (ex. : le carnet de Maître Ohm après la commande 3)
    const story = pay.firstPay && !free ? storyAfter(o) : null;
    const benchBack = () => go('bench', { page: o.clone ? 'orders' : 'gestures' });
    buttons = new Buttons();
    if (daily && test) {
      buttons.add({ x: 190, y: 1500, w: 700, h: 170, size: 60, label: () => t('daily.title'), onTap: () => go('daily', { test: true }) });
      buttons.add({ x: 240, y: 1700, w: 600, h: 150, style: 'secondary', label: () => t('bench.back'), onTap: () => go('bench') });
      return;
    }
    if (daily) {
      // défi quotidien : un 2e essai s'il en reste, l'historique du Carnet, les commandes
      if (triesLeft(o.daily) > 0) buttons.add({ x: 190, y: 1500, w: 700, h: 170, size: 60, label: () => t('daily.retry'), onTap: () => { if (startDaily()) go('operation', { order: 'free' }); else go('daily'); } });
      else buttons.add({ x: 190, y: 1500, w: 700, h: 170, size: 60, label: () => t('daily.history'), onTap: () => go('notebook', { tab: 'daily' }) });
      // rangée du bas : « Partager mon résultat » prend une place, les deux autres se serrent (pas la place d'une 3e rangée)
      buttons.add({ x: 50, y: 1700, w: 310, h: 150, size: 42, wrap: true, style: 'secondary', label: () => t('daily.title'), onTap: () => go('daily') });
      buttons.add({ x: 385, y: 1700, w: 310, h: 150, size: 42, wrap: true, style: 'secondary', label: () => t('done.orders'), onTap: () => go('orders') });
      if (canShare(o.daily)) {
        buttons.add({
          x: 720, y: 1700, w: 310, h: 150, size: 42, wrap: true, style: 'secondary',
          ...shareButton(o.daily, (tt) => { shareToast = tt || shareToast; }),
        });
      }
      return;
    }
    if (free) {
      // Atelier libre : un autre patient au hasard, du même rang
      buttons.add({ x: 190, y: 1500, w: 700, h: 170, size: 64, label: () => t('free.again'), onTap: () => { makeFree(o.rank, test); go('operation', { order: 'free' }); } });
      buttons.add({ x: 110, y: 1700, w: 410, h: 150, style: 'secondary', label: () => t('free.change'), onTap: () => go('free', { test }) });
      buttons.add({ x: 560, y: 1700, w: 410, h: 150, style: 'secondary', label: () => t(test ? 'bench.back' : 'done.orders'), onTap: () => (test ? go('bench') : go('orders')) });
      return;
    }
    // nouveau rang : on passe d'abord par l'écran du rang
    buttons.add({
      x: 190, y: 1500, w: 700, h: 170, size: 68,
      pulse: !!pay.rankUp,
      label: () => t(test ? 'bench.back' : pay.rankUp ? 'done.continue' : nextOk ? 'done.next' : 'done.orders'),
      onTap: () => {
        if (test) benchBack();
        else if (pay.rankUp) go('rank', { rank: pay.rankUp });
        else if (story) go('story', { id: story, then: nextOk ? { scene: 'counter', params: { order: next.id, mode: 'intro' } } : { scene: 'orders' } });
        else if (nextOk) go('counter', { order: next.id, mode: 'intro' });
        else go('orders');
      },
    });
    buttons.add({ x: 110, y: 1700, w: 410, h: 150, style: 'secondary', label: () => t('done.replay'), onTap: () => go('operation', { order: rep.patient.id }) });
    buttons.add({ x: 560, y: 1700, w: 410, h: 150, style: 'secondary', label: () => t(nextOk ? 'done.orders' : 'done.menu'), onTap: () => go(nextOk ? 'orders' : 'title') });
  },

  update(dt) {
    time += dt;
    if (shareToast) { shareToast.t -= dt; if (shareToast.t <= 0) shareToast = null; }
    for (const b of buttons.list) b.visible = !tuto;
    if (tuto && time > 0.6 + 3 * STAR_DELAY + 0.5) tuto.shown = Math.min(t(TUTO[tuto.i]).length, tuto.shown + CPS * dt);
    // une étoile toutes les 0,55 s, avec vibration et étincelles si elle est gagnée
    while (shown < 3 && time > 0.6 + shown * STAR_DELAY) {
      if (res.stars[shown]) {
        vibrate(25 + shown * 10);
        sfx('star', { i: shown });
        fx.spawn(STAR_X[shown], STAR_Y, { count: 18, color: '#ffd36b', speed: 420, size: 8 });
      }
      shown++;
    }
    // le compteur de crédits monte après les étoiles
    const target = save.credits;
    if (time > 0.6 + 3 * STAR_DELAY && Math.abs(creditsShown - target) > 0.5) {
      const step = Math.max(1, Math.abs(target - creditsShown) * dt * 4);
      const before = Math.floor(creditsShown / 5);
      creditsShown += Math.sign(target - creditsShown) * Math.min(step, Math.abs(target - creditsShown));
      if (Math.floor(creditsShown / 5) !== before) sfx('coin_tick');
      if (Math.abs(creditsShown - target) <= 0.5) sfx('coin');
    } else if (time > 0.6 + 3 * STAR_DELAY) {
      creditsShown = target;
    }
  },

  draw(ctx) {
    drawCreamBackground(ctx);
    drawText(ctx, t('done.title'), W / 2, 190, 900, 110, { color: C.turquoise, weight: 900, stroke: C.copperDark });

    const bob = Math.sin(time * 2.4) * 16;
    withDrone(ctx, W / 2, 540 + bob, 0.46, () => {
      drawFrame(ctx, { rotorAngle: time * 45, rotorSpeed: 48, lights: [0, 1, 2, 3].map((i) => (Math.floor(time * 4) + i) % 2 === 0) });
      drawCover(ctx, { screws: rep.screws });
    });

    for (let i = 0; i < 3; i++) {
      const k = time - (0.6 + i * STAR_DELAY);
      drawStar(ctx, STAR_X[i], STAR_Y, 100, res.stars[i], k);
      fitText(ctx, t(STAR_KEYS[i]), STAR_X[i], STAR_Y + 145, 270, 38, res.stars[i] ? C.ink : C.inkSoft, 800);
    }

    const lines = [
      [t('done.clean', { p: res.clean }), C.ink],
      [t('done.precision', { p: res.prec }), C.ink],
      [rep.patient.target_time ? t('done.time_target', { t: fmt(res.elapsed), c: fmt(rep.patient.target_time) }) : t('done.time_free', { t: fmt(res.elapsed) }), res.onTime ? C.green : C.ink],
    ];
    if (pay.firstPay) {
      lines.push([t('done.pay', { b: res.base }) + (res.tip ? '  ·  ' + t('done.tip', { n: res.tip }) : '  ·  ' + t('done.no_tip')), C.copperDark]);
    } else {
      lines.push([t(rep.patient.order.test ? 'bench.not_saved' : rep.patient.order.daily ? (res.stars[0] ? 'daily.already_paid' : 'daily.not_paid') : 'done.already_paid'), C.inkSoft]);
    }
    if (rep.patient.order.daily && !rep.patient.order.test) {
      lines.push([t('daily.done_note'), C.inkSoft]);
    } else if (rep.patient.order.free && !rep.patient.order.test) {
      lines.push([t('free.note'), C.inkSoft]);
    }
    if (res.parts) lines.push([t('done.parts', { n: res.parts }), C.red]);
    if (won.length) lines.push([t('done.ach_pay', { n: won.reduce((s, w) => s + w.reward, 0) }), C.turquoiseDark]);
    if (needStars) lines.push([t('done.need_stars', { n: needStars, s: totalStars() }), C.orangeDark]);
    const y0 = 1140 - Math.max(0, lines.length - 5) * 30;
    lines.forEach(([l, col], i) => fitText(ctx, l, W / 2, y0 + i * 52, 900, 38, col, 700));
    if (pay.record && time > 2.4) fitText(ctx, t('done.record'), W / 2, 1112, 600, 32, C.orangeDark, 900);
    fitText(ctx, t('done.credits', { n: Math.round(creditsShown) }), W / 2, 1432, 900, 54, C.turquoiseDark, 900);
    // bandeau : pièce rare gagnée, sinon nouveau rang (qui a aussi son propre écran juste après)
    const banner = pay.part
      ? { text: t('done.rare', { name: t('rare.' + pay.part.id) }), color: C.copper, part: pay.part.id }
      : pay.rankUp ? { text: t('done.rank_up', { r: pay.rankUp, name: t('rank.' + pay.rankUp) }), color: C.orange }
      : pay.badge ? { text: t('daily.badge_won.' + pay.badge), color: C.turquoiseDark, badge: pay.badge }
      : won.length ? { text: t('done.ach', { name: t('ach.' + won[0].id), medal: t('ach.medal.' + won[0].tier) }), color: C.turquoiseDark, badge: won[0].tier } : null;
    if (banner) {
      const a = Math.min(1, Math.max(0, time - 2.4) * 3);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = banner.color;
      roundRect(ctx, 90, 300, W - 180, 110, 55);
      ctx.fill();
      const off = banner.part || banner.badge ? 50 : 0;
      fitText(ctx, banner.text, W / 2 + off, 357, W - 260 - off * 2, 46, '#fff', 900);
      if (banner.part) drawRarePart(ctx, banner.part, 160, 355, 52, true, time);
      if (banner.badge) drawBadge(ctx, 160, 340, 42, banner.badge, time);
      ctx.restore();
    }
    buttons.draw(ctx);
    if (shareToast) drawShareToast(ctx, shareToast);
    if (tuto && time > 0.6 + 3 * STAR_DELAY + 0.5) this.drawTuto(ctx);
  },

  drawTuto(ctx) {
    if (tuto.i === 0) for (const x of STAR_X) drawRing(ctx, x, STAR_Y, 125, time);
    if (tuto.i === 1) {
      const a = 0.5 + 0.5 * Math.sin(time * 6);
      ctx.strokeStyle = `rgba(255, 138, 61, ${0.45 + 0.55 * a})`;
      ctx.lineWidth = 9;
      roundRect(ctx, 120 - a * 8, 1380 - a * 6, W - 240 + a * 16, 104 + a * 12, 52); ctx.stroke();
    }
    drawGribBox(ctx, { x: 60, y: 1540, w: W - 120, h: 300 }, t(TUTO[tuto.i]), tuto.shown, time, { more: true });
  },

  pointer(type, x, y) {
    if (tuto) {
      if (type !== 'up' || time < 0.6 + 3 * STAR_DELAY + 0.5) return;
      const len = t(TUTO[tuto.i]).length;
      if (tuto.shown < len) { tuto.shown = len; return; }
      vibrate(8);
      if (tuto.i < TUTO.length - 1) { tuto.i++; tuto.shown = 0; return; }
      markSeen('results');
      go('shop', { first: true });
      return;
    }
    buttons.pointer(type, x, y);
  },
};
