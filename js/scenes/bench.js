// Atelier d'essai (lien « ?essai ») : essayer chaque geste secondaire, n'importe laquelle des 60 commandes
// ou l'Atelier libre, sans toucher à la partie. Rien n'est payé ni enregistré.
import { W } from '../canvas.js';
import { t } from '../i18n.js';
import { Buttons, C, drawCreamBackground, drawText, fitText } from '../ui.js';
import { game } from '../state.js';
import { go } from '../scenes.js';

let buttons, page;

// Copie d'essai d'une commande (pièces rares et commandes précédentes non exigées).
function testCopy(o) {
  const id = 't_' + o.id;
  let c = game.data.tests.find((x) => x.id === id);
  if (!c) { c = { ...o, id, test: true, clone: true }; game.data.tests.push(c); }
  return c;
}

export default {
  init(params = {}) {
    page = params.page || 'gestures';
    this.build();
  },

  build() {
    buttons = new Buttons();
    if (page === 'gestures') {
      const list = (game.data.tests || []).filter((o) => o.gesture);
      // 12 gestes : 3 colonnes × 4 lignes
      list.forEach((o, i) => {
        const col = i % 3, row = Math.floor(i / 3);
        buttons.add({
          x: 60 + col * 325, y: 380 + row * 228, w: 310, h: 200, size: 40, style: 'secondary', wrap: true,
          label: () => t('sec.title.' + o.gesture),
          onTap: () => go('operation', { order: o.id }),
        });
      });
      buttons.add({ x: 70, y: 1340, w: 460, h: 190, size: 44, label: () => t('bench.orders'), onTap: () => { page = 'orders'; this.build(); } });
      buttons.add({ x: 550, y: 1340, w: 460, h: 190, size: 44, label: () => t('bench.free'), onTap: () => go('free', { test: true }) });
      // V4b : défi du jour d'essai (les essais ne comptent pas, rien n'est payé)
      buttons.add({ x: 70, y: 1555, w: 940, h: 120, size: 44, label: () => t('daily.title'), onTap: () => go('daily', { test: true }) });
      buttons.add({ x: 240, y: 1700, w: 600, h: 150, size: 54, style: 'secondary', label: () => t('bench.menu'), onTap: () => go('title') });
    } else {
      // les 60 commandes : 6 colonnes × 10 lignes
      game.data.orders.forEach((o, i) => {
        const col = i % 6, row = Math.floor(i / 6);
        buttons.add({
          x: 60 + col * 162, y: 330 + row * 128, w: 150, h: 116, size: 46,
          style: o.exam ? 'primary' : 'secondary',
          label: () => String(o.n),
          onTap: () => go('operation', { order: testCopy(o).id }),
        });
      });
      buttons.add({ x: 240, y: 1700, w: 600, h: 150, size: 54, style: 'secondary', label: () => t('bench.back_gestures'), onTap: () => { page = 'gestures'; this.build(); } });
    }
  },

  update() {},

  draw(ctx) {
    drawCreamBackground(ctx);
    fitText(ctx, t('bench.title'), W / 2, 150, 900, 80, C.copperDark, 900);
    drawText(ctx, t(page === 'gestures' ? 'bench.sub' : 'bench.sub_orders'), W / 2, page === 'gestures' ? 290 : 250, 900, 36, { color: C.inkSoft, weight: 700 });
    buttons.draw(ctx);
  },

  back() {
    if (page === 'orders') { page = 'gestures'; this.build(); return true; }
    return false;
  },

  pointer(type, x, y) {
    buttons.pointer(type, x, y);
  },
};
