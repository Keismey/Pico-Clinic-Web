// Passage de rang : grande médaille, nom du rang, ce qui est débloqué, mot de Gribouille.
import { W } from '../canvas.js';
import { t } from '../i18n.js';
import { Buttons, C, drawCreamBackground, drawText, fitText, roundRect } from '../ui.js';
import { drawGribouille } from '../portraits.js';
import { rankInfo } from '../progress.js';
import { vibrate } from '../feedback.js';
import { sfx } from '../audio.js';
import * as fx from '../particles.js';
import { go } from '../scenes.js';
import { miniStar } from './orders.js';
import { rankStories, playStories } from './story.js';
import { save } from '../save.js';

const TAU = Math.PI * 2;
let r, time, buttons, burst;

export default {
  init(params = {}) {
    r = params.rank || 2;
    time = 0;
    burst = false;
    buttons = new Buttons();
    buttons.add({ x: 190, y: 1680, w: 700, h: 170, size: 64, label: () => t('done.continue'), onTap: () => {
      // nouveau chapitre : Gribouille raconte la suite (une seule fois)
      // puis il présente les modes que ce rang ouvre (Défi du jour, Atelier libre)
      playStories(rankStories(save.rank), { scene: 'orders' });
    } });
  },

  update(dt) {
    time += dt;
    if (!burst && time > 0.5) {
      burst = true;
      vibrate([30, 40, 60]);
      sfx('fanfare');
      fx.spawn(W / 2, 560, { count: 50, color: '#ffd36b', speed: 760, life: 1.1, size: 10, gravity: 500 });
      fx.spawn(W / 2, 560, { count: 30, color: C.turquoise, speed: 620, life: 1, size: 9, gravity: 500 });
    }
  },

  draw(ctx) {
    drawCreamBackground(ctx);
    // rayons qui tournent derrière la médaille
    ctx.save();
    ctx.translate(W / 2, 560);
    ctx.rotate(time * 0.3);
    ctx.fillStyle = 'rgba(255, 201, 60, 0.18)';
    for (let i = 0; i < 12; i++) {
      ctx.rotate(TAU / 12);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-60, -520); ctx.lineTo(60, -520); ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    drawText(ctx, t('rankup.title'), W / 2, 210, 900, 100, { color: C.turquoise, weight: 900, stroke: C.copperDark });
    const pop = Math.min(1, time * 2.5);
    const s = pop < 1 ? 0.4 + 0.75 * pop - 0.15 * Math.sin(pop * Math.PI) : 1 + 0.03 * Math.sin(time * 3);
    ctx.save();
    ctx.translate(W / 2, 560);
    ctx.scale(s, s);
    ctx.fillStyle = C.copperDark;
    ctx.beginPath(); ctx.arc(0, 10, 200, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffc93c';
    ctx.beginPath(); ctx.arc(0, 0, 200, 0, TAU); ctx.fill();
    ctx.fillStyle = C.turquoise;
    ctx.beginPath(); ctx.arc(0, 0, 160, 0, TAU); ctx.fill();
    fitText(ctx, String(r), 0, 10, 200, 200, '#fff', 900);
    for (let i = 0; i < r; i++) miniStar(ctx, (i - (r - 1) / 2) * 62, 150, 26, true);
    ctx.restore();

    fitText(ctx, t('rankup.rank', { r }), W / 2, 830, 900, 48, C.copperDark, 900);
    fitText(ctx, t('rank.' + r), W / 2, 905, 940, 72, C.ink, 900);
    drawText(ctx, t('rankup.unlocks', { list: t('rank.' + r + '.unlocks') }), W / 2, 1030, 900, 40, { color: C.inkSoft, weight: 700, lineH: 52 });
    const next = rankInfo(r + 1);
    if (next) fitText(ctx, t('rankup.next_rank', { n: next.stars }), W / 2, 1150, 900, 36, C.orangeDark, 800);

    // Gribouille félicite
    drawGribouille(ctx, 150, 1430, 0.7, { time, talk: time > 0.8 && time < 3.5 });
    ctx.fillStyle = C.paper;
    roundRect(ctx, 280, 1290, 750, 250, 40); ctx.fill();
    ctx.strokeStyle = '#6b7684'; ctx.lineWidth = 5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(282, 1400); ctx.lineTo(240, 1430); ctx.lineTo(282, 1450); ctx.closePath();
    ctx.fillStyle = C.paper; ctx.fill();
    drawText(ctx, t('rankup.gribouille'), 655, 1415, 680, 40, { color: C.ink, weight: 700, lineH: 52 });
    buttons.draw(ctx);
  },

  pointer(type, x, y) {
    buttons.pointer(type, x, y);
  },
};
