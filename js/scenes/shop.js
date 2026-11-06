// Boutique d'outils : 5 outils, 3 ou 4 niveaux chacun, chaque niveau demande un rang minimum.
import { W } from '../canvas.js';
import { t } from '../i18n.js';
import { Buttons, C, drawCreamBackground, drawToast, roundRect, fitText } from '../ui.js';
import { decoList, decoState, buyDeco, hasDeco, drawDeco, ICON_SCALE } from '../deco.js';
import { save } from '../save.js';
import { game, toolLevel } from '../state.js';
import { TOOL_KEYS, currentTool, nextTool, buyState, buyTool } from '../progress.js';
import { vibrate } from '../feedback.js';
import { sfx } from '../audio.js';
import * as fx from '../particles.js';
import { go } from '../scenes.js';
import { leftText } from './orders.js';
import { seen, markSeen, drawGribBox } from '../tutorial.js';

// Première visite : Gribouille présente la boutique (tutoriel, après la commande 1).
const TUTO = ['tuto.shop_here', 'tuto.shop_here2'];

const TAU = Math.PI * 2;
// 5 outils : cartes un peu plus serrées (la dévisseuse en premier)
const CARD = { x: 40, y: 360, w: W - 80, h: 220, step: 238 };
// V3b : onglet des décorations (2 colonnes × 6 lignes, dont 4 de prestige au rang 5)
const TABS = { x: 40, y: 250, w: W - 80, h: 86 };
const DCARD = { x: 40, y: 350, w: (W - 100) / 2, h: 186, stepX: (W - 100) / 2 + 20, stepY: 200 };
const DICON = { x: 92, y: 112, r: 62, s: 0.72 };

let buttons, toast, time, tuto, page = 'tools';

function showToast(key, vars, color = C.inkSoft) {
  toast = { key, vars, color, t: 2, max: 2 };
}

// Petites icônes d'outils.
function drawIcon(ctx, k, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = 'round';
  if (k === 'driver') {
    // tournevis, ou dévisseuse électrique une fois achetée
    ctx.rotate(-0.7);
    ctx.strokeStyle = '#9aa3ad'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(0, -75); ctx.lineTo(0, -15); ctx.stroke();
    if (toolLevel('driver') > 2) {
      // visseuse turbo (niveau 4) : corps orange et éclair doré
      const turbo = toolLevel('driver') > 3;
      ctx.fillStyle = turbo ? C.orange : C.turquoise; roundRect(ctx, -30, -20, 60, 50, 14); ctx.fill();
      ctx.fillStyle = '#374151'; roundRect(ctx, -16, 24, 32, 50, 10); ctx.fill();
      if (turbo) {
        ctx.fillStyle = '#ffd166';
        ctx.beginPath(); ctx.moveTo(4, -16); ctx.lineTo(-12, 6); ctx.lineTo(0, 6); ctx.lineTo(-6, 26); ctx.lineTo(12, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
      } else { ctx.fillStyle = '#ffd166'; ctx.fillRect(-20, -6, 10, 20); }
    } else {
      // manche jaune strié et bout plat (différent du fer à souder)
      ctx.fillStyle = '#ffd166'; roundRect(ctx, -17, -15, 34, 80, 14); ctx.fill();
      ctx.strokeStyle = '#c4862a'; ctx.lineWidth = 4;
      for (const dx of [-7, 0, 7]) { ctx.beginPath(); ctx.moveTo(dx, -5); ctx.lineTo(dx, 55); ctx.stroke(); }
      ctx.fillStyle = '#9aa3ad'; ctx.fillRect(-9, -84, 18, 10);
      // tournevis à cliquet : petite molette sombre en haut du manche
      if (toolLevel('driver') === 2) { ctx.fillStyle = '#374151'; ctx.beginPath(); ctx.arc(0, -20, 20, 0, TAU); ctx.fill(); ctx.fillStyle = '#aeb6c0'; ctx.beginPath(); ctx.arc(0, -20, 7, 0, TAU); ctx.fill(); }
    }
  } else if (k === 'iron') {
    ctx.rotate(-0.8);
    ctx.strokeStyle = '#9aa3ad'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(0, -70); ctx.lineTo(0, -10); ctx.stroke();
    // soudeuse de maître (niveau 4) : manche doré à bague cuivre
    const master = toolLevel('iron') > 3;
    ctx.strokeStyle = master ? '#e8b53a' : C.orange; ctx.lineWidth = 30;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 60); ctx.stroke();
    if (master) { ctx.strokeStyle = C.copperDark; ctx.lineWidth = 32; ctx.beginPath(); ctx.moveTo(0, 18); ctx.lineTo(0, 26); ctx.stroke(); }
  } else if (k === 'vacuum') {
    ctx.strokeStyle = '#6b7684'; ctx.lineWidth = 16;
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.quadraticCurveTo(50, 10, 40, 60); ctx.stroke();
    ctx.fillStyle = C.turquoise;
    ctx.beginPath(); ctx.arc(-20, -20, 40, 0, TAU); ctx.fill();
    ctx.fillStyle = '#374151';
    ctx.beginPath(); ctx.arc(-20, -20, 18, 0, TAU); ctx.fill();
    // aspirateur cyclone (niveau 4) : tourbillon blanc au centre
    if (toolLevel('vacuum') > 3) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 5;
      ctx.beginPath();
      for (let a = 0; a < 3.4 * Math.PI; a += 0.2) { const r = 3 + a * 3.2; const px = -20 + Math.cos(a) * r, py = -20 + Math.sin(a) * r; a ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.stroke();
    }
  } else if (k === 'lens') {
    ctx.strokeStyle = C.copperDark; ctx.lineWidth = 18;
    ctx.beginPath(); ctx.moveTo(25, 25); ctx.lineTo(62, 62); ctx.stroke();
    ctx.fillStyle = 'rgba(159, 245, 231, 0.6)';
    ctx.beginPath(); ctx.arc(-10, -10, 46, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#6b7684'; ctx.lineWidth = 10; ctx.stroke();
  } else {
    ctx.strokeStyle = '#aeb6c0'; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(-8, -70); ctx.lineTo(-30, 60); ctx.moveTo(8, -70); ctx.lineTo(30, 60); ctx.stroke();
    ctx.fillStyle = '#7b8592';
    ctx.beginPath(); ctx.arc(0, -70, 16, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function tapDeco(d, x, y) {
  const st = decoState(d);
  if (st === 'ok') {
    buyDeco(d);
    vibrate([10, 20, 40]);
    sfx('buy');
    fx.spawn(x + DICON.x, y + DICON.y, { count: 26, color: '#ffd36b', speed: 480, size: 8 });
    showToast('shop.deco_bought', { name: t('deco.' + d.id) }, C.green);
  } else {
    vibrate([15, 25, 15]);
    sfx('error');
    if (st === 'rank') showToast('shop.toast_rank', { r: d.rank });
    else if (st === 'money') showToast('shop.toast_money', { n: d.price - save.credits });
    else showToast('shop.deco_owned');
  }
}

function tap(k, i) {
  const st = buyState(k);
  const n = nextTool(k);
  if (st === 'ok') {
    buyTool(k);
    vibrate([10, 20, 40]);
    sfx('buy');
    const cy = CARD.y + i * CARD.step + CARD.h / 2;
    fx.spawn(CARD.x + 110, cy, { count: 26, color: '#ffd36b', speed: 480, size: 8 });
    showToast('shop.bought', { name: t('tool.' + n.id) }, C.green);
  } else {
    vibrate([15, 25, 15]);
    sfx('error');
    if (st === 'rank') showToast('shop.toast_rank', { r: n.rank });
    else if (st === 'money') showToast('shop.toast_money', { n: n.price - save.credits });
    else showToast('shop.maxed');
  }
}

export default {
  init(params = {}) {
    tuto = seen('shop') ? null : { i: 0, shown: 0 };
    toast = null;
    time = 0;
    if (params.page) page = params.page;
    if (tuto) page = 'tools';
    this.build();
  },

  build() {
    buttons = new Buttons();
    if (page === 'tools') {
      TOOL_KEYS.forEach((k, i) => {
        buttons.add({
          x: CARD.x + CARD.w - 262, y: CARD.y + i * CARD.step + 44, w: 236, h: 130, size: 38,
          style: 'secondary', tool: k,
          label: () => {
            const n = nextTool(k);
            if (!n) return t('shop.max_short');
            return buyState(k) === 'rank' ? t('shop.need_rank', { r: n.rank }) : t('shop.price', { n: n.price });
          },
          onTap: () => tap(k, i),
        });
      });
    } else {
      decoList().forEach((d, i) => {
        const x = DCARD.x + (i % 2) * DCARD.stepX, y = DCARD.y + Math.floor(i / 2) * DCARD.stepY;
        buttons.add({
          x: x + DCARD.w - 196, y: y + 66, w: 178, h: 112, size: 34, style: 'secondary', deco: d,
          hit: { x, y, w: DCARD.w, h: DCARD.h }, // toute la carte se touche
          label: () => {
            const st = decoState(d);
            if (st === 'owned') return t('shop.owned');
            return st === 'rank' ? t('shop.need_rank', { r: d.rank }) : t('shop.price', { n: d.price });
          },
          onTap: () => tapDeco(d, x, y),
        });
      });
    }
    buttons.add({ x: 240, y: 1580, w: 600, h: 160, size: 60, label: () => t('shop.back'), onTap: () => go('orders') });
  },

  update(dt) {
    time += dt;
    if (tuto) tuto.shown = Math.min(t(TUTO[tuto.i]).length, tuto.shown + 42 * dt);
    for (const b of buttons.list) b.visible = !tuto;
    if (toast) { toast.t -= dt; if (toast.t <= 0) toast = null; }
    // bouton orange seulement si l'achat est possible
    for (const b of buttons.list) {
      if (!b.tool && !b.deco) continue;
      const ok = b.tool ? buyState(b.tool) === 'ok' : decoState(b.deco) === 'ok';
      b.style = ok ? 'primary' : 'secondary';
      b.pulse = ok;
    }
  },

  draw(ctx) {
    drawCreamBackground(ctx);
    leftText(ctx, t('shop.title'), 60, 95, 680, 76, C.copperDark, 900);
    leftText(ctx, t('shop.status', { n: save.credits, r: save.rank, name: t('rank.' + save.rank) }), 60, 205, W - 120, 38, C.inkSoft, 800);

    this.drawTabs(ctx);
    if (page === 'tools') this.drawTools(ctx); else this.drawDecos(ctx);

    buttons.draw(ctx);
    // sous la dernière carte (Pince, finie à y 1538) : l'étiquette du nom monte de 30
    if (tuto) drawGribBox(ctx, { x: 60, y: 1590, w: W - 120, h: 290 }, t(TUTO[tuto.i]), tuto.shown, time, { more: true });
    if (toast) drawToast(ctx, t(toast.key, toast.vars), W / 2, 1800, toast.t / toast.max, toast.color);
  },

  drawTabs(ctx) {
    ['tools', 'deco'].forEach((pg, i) => {
      const w = TABS.w / 2, x = TABS.x + i * w, on = pg === page;
      ctx.fillStyle = on ? C.copperDark : 'rgba(196, 122, 60, 0.15)'; // blanc sur cuivre foncé : 6,1:1
      roundRect(ctx, x + 4, TABS.y, w - 8, TABS.h, 30); ctx.fill();
      fitText(ctx, t('shop.tab.' + pg), x + w / 2, TABS.y + TABS.h / 2 + 2, w - 40, 38, on ? '#fff' : C.copperDark, 900);
    });
  },

  drawTools(ctx) {
    TOOL_KEYS.forEach((k, i) => {
      const x = CARD.x, y = CARD.y + i * CARD.step, w = CARD.w, h = CARD.h;
      const lv = toolLevel(k);
      const n = game.data.tools[k].levels.length;
      ctx.fillStyle = '#d9c3a3';
      roundRect(ctx, x, y + 10, w, h - 4, 34); ctx.fill();
      ctx.fillStyle = C.paper;
      roundRect(ctx, x, y, w, h - 8, 34); ctx.fill();
      // icône et niveau
      ctx.fillStyle = 'rgba(63, 208, 187, 0.15)';
      ctx.beginPath(); ctx.arc(x + 110, y + 88, 72, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(x + 110, y + 88); ctx.scale(0.85, 0.85); drawIcon(ctx, k, 0, 0); ctx.restore();
      for (let d = 0; d < n; d++) {
        ctx.fillStyle = d < lv ? C.turquoise : 'rgba(58, 42, 30, 0.15)';
        ctx.beginPath(); ctx.arc(x + 110 + (d - (n - 1) / 2) * 40, y + 184, 12, 0, TAU); ctx.fill();
      }
      // textes
      const tw = w - 520;
      leftText(ctx, t('tool.' + currentTool(k).id), x + 220, y + 42, tw, 42, C.ink, 900);
      leftText(ctx, t('shop.level', { l: lv, n }), x + 220, y + 84, tw, 28, C.inkSoft, 700);
      const nx = nextTool(k);
      if (nx) {
        leftText(ctx, t('shop.next', { name: t('tool.' + nx.id) }), x + 220, y + 130, tw, 30, C.copperDark, 800);
        leftText(ctx, t('tool.' + nx.id + '.desc'), x + 220, y + 170, tw, 26, C.inkSoft, 700);
      } else {
        leftText(ctx, t('shop.max'), x + 220, y + 140, tw, 30, C.green, 800);
      }
    });
  },

  drawDecos(ctx) {
    decoList().forEach((d, i) => {
      const x = DCARD.x + (i % 2) * DCARD.stepX, y = DCARD.y + Math.floor(i / 2) * DCARD.stepY, w = DCARD.w, h = DCARD.h;
      const owned = hasDeco(d.id);
      ctx.fillStyle = '#d9c3a3';
      roundRect(ctx, x, y + 10, w, h - 4, 34); ctx.fill();
      ctx.fillStyle = owned ? '#eaf6ee' : C.paper;
      roundRect(ctx, x, y, w, h - 8, 34); ctx.fill();
      const ix = x + DICON.x, iy = y + DICON.y;
      ctx.fillStyle = 'rgba(196, 122, 60, 0.12)';
      ctx.beginPath(); ctx.arc(ix, iy, DICON.r, 0, TAU); ctx.fill();
      if (d.id === 'neon_sign') {
        // l'enseigne seule, en petit, pour montrer le cadre lumineux autour
        ctx.fillStyle = '#c47a3c';
        roundRect(ctx, ix - 45, iy - 12, 90, 24, 6); ctx.fill();
      }
      // vignette rognée au rond (le fil du drone suspendu ne déborde pas sur le titre)
      ctx.save(); ctx.beginPath(); ctx.arc(ix, iy, DICON.r, 0, TAU); ctx.clip();
      drawDeco(ctx, d.id, ix, iy, (ICON_SCALE[d.id] || 0.7) * DICON.s, time, !owned);
      ctx.restore();
      fitText(ctx, t('deco.' + d.id), x + w / 2, y + 40, w - 40, 34, C.ink, 900);
    });
  },

  pointer(type, x, y) {
    // zone de toucher des onglets plus haute que le dessin (44 px à l'écran au moins)
    if (!tuto && type === 'up' && y >= TABS.y - 35 && y <= TABS.y + TABS.h + 12 && x >= TABS.x && x <= TABS.x + TABS.w) {
      const pg = x < TABS.x + TABS.w / 2 ? 'tools' : 'deco';
      if (pg !== page) { page = pg; vibrate(8); this.build(); }
      return;
    }
    if (tuto) {
      if (type !== 'up') return;
      const len = t(TUTO[tuto.i]).length;
      if (tuto.shown < len) { tuto.shown = len; return; }
      vibrate(8);
      if (tuto.i < TUTO.length - 1) { tuto.i++; tuto.shown = 0; } else { tuto = null; markSeen('shop'); }
      return;
    }
    buttons.pointer(type, x, y);
  },
};
