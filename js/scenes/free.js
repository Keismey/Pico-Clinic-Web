// V3b — Atelier libre : choisir un rang de difficulté (1 au rang atteint), puis un patient au hasard.
import { W } from '../canvas.js';
import { t } from '../i18n.js';
import { Buttons, C, drawCreamBackground, drawText, fitText } from '../ui.js';
import { save } from '../save.js';
import { makeFree } from '../free.js';
import { drawGribouille } from '../portraits.js';
import { go } from '../scenes.js';
import { leftText } from './orders.js';

let buttons, test, time;

export default {
  init(params = {}) {
    test = !!params.test;
    time = 0;
    buttons = new Buttons();
    const max = test ? 5 : Math.max(1, save.rank);
    for (let r = 1; r <= 5; r++) {
      buttons.add({
        x: 90, y: 560 + (r - 1) * 190, w: W - 180, h: 160, size: 46,
        style: r <= max ? 'secondary' : 'secondary',
        label: () => (r <= max ? t('free.rank', { r, name: t('rank.' + r) }) : t('free.locked', { r })),
        onTap: () => { if (r > max) return; makeFree(r, test); go('operation', { order: 'free' }); },
      });
    }
    buttons.add({ x: 240, y: 1590, w: 600, h: 150, size: 54, label: () => t('shop.back'), onTap: () => go(test ? 'bench' : 'orders') });
  },

  update(dt) {
    time += dt;
  },

  draw(ctx) {
    drawCreamBackground(ctx);
    leftText(ctx, t('free.title'), 60, 95, 900, 76, C.copperDark, 900);
    drawGribouille(ctx, 150, 330, 0.55, { time });
    drawText(ctx, t(test ? 'free.sub_test' : 'free.sub'), 610, 330, 780, 38, { color: C.ink, weight: 700, lineH: 50 });
    const max = test ? 5 : save.rank;
    buttons.list.forEach((b, i) => { if (i < 5) b.alpha = i < max ? 1 : 0.45; });
    buttons.draw(ctx);
    fitText(ctx, t('free.credits', { n: save.credits }), W / 2, 1530, 900, 36, C.inkSoft, 800);
  },

  back() {
    go(test ? 'bench' : 'orders');
    return true;
  },

  pointer(type, x, y) {
    buttons.pointer(type, x, y);
  },
};
