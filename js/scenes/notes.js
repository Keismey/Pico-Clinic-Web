// Notes de mise à jour : ouvertes depuis les Options, ou une fois après une mise à jour (écran titre).
import { W, H } from '../canvas.js';
import { t, getLang } from '../i18n.js';
import { Buttons, C, drawCreamBackground, font, wrapLines } from '../ui.js';
import { go } from '../scenes.js';
import { NOTES, notesSeen } from '../settings.js';
import { drawGribouille } from '../portraits.js';
import { leftText } from './orders.js';

let buttons, from, time;

export default {
  init(params = {}) {
    from = params.from || 'orders';
    time = 0;
    notesSeen();
    buttons = new Buttons();
    buttons.add({ x: 240, y: 1700, w: 600, h: 160, size: 60, label: () => t('opt.back'), onTap: () => go(from) });
  },

  update(dt) { time += dt; },

  draw(ctx) {
    drawCreamBackground(ctx);
    leftText(ctx, t('notes.title'), 60, 110, 760, 72, C.copperDark, 900);
    drawGribouille(ctx, 960, 110, 0.3, { time });
    const en = getLang() === 'en';
    let y = 240;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (const n of NOTES) {
      if (y > 1600) break;
      leftText(ctx, t('notes.version', { v: n.v, d: n.d[en ? 1 : 0] }), 70, y, W - 140, 44, C.turquoiseDark, 900);
      y += 70;
      ctx.font = font(36, 700);
      for (const line of en ? n.en : n.fr) {
        const parts = wrapLines(ctx, line, W - 210);
        ctx.fillStyle = C.copper;
        ctx.fillText('•', 80, y);
        ctx.fillStyle = C.ink;
        for (const p of parts) { ctx.fillText(p, 120, y); y += 48; }
        y += 14;
      }
      y += 40;
    }
    buttons.draw(ctx);
  },

  back() { go(from); return true; },

  pointer(type, x, y) { buttons.pointer(type, x, y); },
};
