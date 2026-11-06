// V4b — Écran du défi quotidien : le patient du jour, la récompense doublée, les essais restants.
import { W } from '../canvas.js';
import { t, getLang } from '../i18n.js';
import { Buttons, C, drawCreamBackground, drawText, fitText, roundRect } from '../ui.js';
import { canShare, shareButton, drawShareToast } from '../share.js';
import { withDrone, drawFrame, drawCover, setLook } from '../drone.js';
import { buildPatient, targetTime } from '../state.js';
import { go } from '../scenes.js';
import { drawGribouille } from '../portraits.js';
import { dateKey, makeDaily, startDaily, triesLeft, dayEntry, badgeOf, drawBadge, DAILY_TRIES } from '../daily.js';
import { leftText, miniStar } from './orders.js';

let buttons, time, key, order, look, test, toast;

// « dimanche 25 octobre » / « Sunday, October 25 »
export function dayLabel(k, opts = { weekday: 'long', day: 'numeric', month: 'long' }) {
  const [y, m, d] = k.split('-').map(Number);
  try { return new Date(y, m - 1, d).toLocaleDateString(getLang() === 'fr' ? 'fr-FR' : 'en-US', opts); } catch (e) { return k; }
}

function fmt(s) {
  s = Math.round(s);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default {
  init(params = {}) {
    test = !!params.test;
    time = 0;
    key = dateKey();
    order = makeDaily(key); // aperçu : l'essai ne compte qu'en touchant « Commencer »
    look = buildPatient('free').look;
    buttons = new Buttons();
    buttons.add({
      x: 190, y: 1500, w: 700, h: 170, size: 64,
      label: () => t(triesLeft(key) >= DAILY_TRIES ? 'daily.start' : 'daily.retry'),
      visible: test || triesLeft(key) > 0,
      pulse: test || triesLeft(key) >= DAILY_TRIES,
      onTap: () => {
        // atelier d'essai : l'essai ne compte pas, rien n'est payé ni enregistré
        if (test) { makeDaily(key).test = true; go('operation', { order: 'free' }); return; }
        if (startDaily()) go('operation', { order: 'free' });
      },
    });
    toast = null;
    if (!test && canShare(key)) {
      // au moins un essai joué : « Partager mon résultat » prend une place dans la rangée du bas (pas la place d'une 3e rangée)
      buttons.add({ x: 50, y: 1700, w: 310, h: 150, size: 42, wrap: true, style: 'secondary', label: () => t('daily.history'), onTap: () => go('notebook', { tab: 'daily' }) });
      buttons.add({ x: 385, y: 1700, w: 310, h: 150, size: 42, wrap: true, style: 'secondary', label: () => t('shop.back'), onTap: () => this.back() });
      buttons.add({
        x: 720, y: 1700, w: 310, h: 150, size: 42, wrap: true, style: 'secondary',
        ...shareButton(key, (tt) => { toast = tt || toast; }),
      });
      return;
    }
    buttons.add({ x: 110, y: 1700, w: 410, h: 150, size: 50, style: 'secondary', label: () => t('daily.history'), visible: !test, onTap: () => go('notebook', { tab: 'daily' }) });
    buttons.add({ x: 560, y: 1700, w: 410, h: 150, size: 50, style: 'secondary', label: () => t('shop.back'), onTap: () => this.back() });
  },

  update(dt) {
    time += dt;
    if (toast) { toast.t -= dt; if (toast.t <= 0) toast = null; }
  },

  draw(ctx) {
    drawCreamBackground(ctx);
    leftText(ctx, t('daily.title'), 60, 95, 900, 76, C.copperDark, 900);
    leftText(ctx, dayLabel(key), 60, 175, 900, 40, C.inkSoft, 800);
    drawGribouille(ctx, 150, 345, 0.55, { time });
    drawText(ctx, t('daily.sub'), 610, 345, 780, 36, { color: C.ink, weight: 700, lineH: 46 });

    // fiche du patient
    ctx.fillStyle = '#d9c3a3';
    roundRect(ctx, 50, 520, W - 100, 760, 40); ctx.fill();
    ctx.fillStyle = C.paper;
    roundRect(ctx, 50, 510, W - 100, 760, 40); ctx.fill();
    setLook(look);
    const bob = Math.sin(time * 2) * 10;
    withDrone(ctx, W / 2, 760 + bob, 0.4, () => {
      drawFrame(ctx, { rotorAngle: time * 8, rotorSpeed: 8 });
      drawCover(ctx);
    });
    fitText(ctx, t('patient.' + order.model), W / 2, 985, W - 200, 50, C.ink, 900);
    const nf = order.faults.length + (order.rust ? 1 : 0);
    const lines = [
      [t('daily.level', { r: order.rank, name: t('rank.' + order.rank) }), C.inkSoft],
      [t('daily.faults', { n: nf, t: fmt(targetTime(order)) }), C.inkSoft],
      [t('daily.reward', { n: order.reward }), C.copperDark],
      [t('daily.tries', { n: triesLeft(key), m: DAILY_TRIES }), triesLeft(key) > 0 ? C.turquoiseDark : C.red],
    ];
    lines.forEach(([l, col], i) => fitText(ctx, l, W / 2, 1060 + i * 52, W - 180, 38, col, 800));

    // résultat du jour
    const e = test ? null : dayEntry(key);
    if (test) {
      fitText(ctx, t('bench.not_saved'), W / 2, 1365, W - 140, 32, C.inkSoft, 700);
    } else if (e && e.tries > 0) {
      const b = badgeOf(key);
      drawBadge(ctx, 200, 1375, 52, b, time);
      for (let k = 0; k < 3; k++) miniStar(ctx, 360 + k * 70, 1360, 28, k < e.best);
      const txt = b ? t('daily.badge.' + b) : t('daily.no_badge');
      leftText(ctx, txt, 590, 1360, 440, 36, b ? C.ink : C.inkSoft, 800);
      if (triesLeft(key) <= 0) fitText(ctx, t('daily.tomorrow'), W / 2, 1560, W - 160, 44, C.copperDark, 900);
    } else {
      fitText(ctx, t('daily.note'), W / 2, 1365, W - 140, 32, C.inkSoft, 700);
    }
    buttons.draw(ctx);
    if (toast) drawShareToast(ctx, toast);
  },

  back() {
    go(test ? 'bench' : 'orders');
    return true;
  },

  pointer(type, x, y) {
    buttons.pointer(type, x, y);
  },
};
