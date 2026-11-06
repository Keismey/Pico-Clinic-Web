// Fin de jeu — une fois les 60 commandes réparées, « Jouer » mène ici au lieu de la liste des commandes :
// trois gros boutons (Défi du jour, Atelier libre, Rejouer les niveaux) et la rangée habituelle
// Boutique · Carnet · Options. Un robot « générique » au hasard attend sur le comptoir. « Rejouer » ouvre la liste (game.replay) ; son « Retour » ramène ici.
import { W } from '../canvas.js';
import { t } from '../i18n.js';
import { Buttons, C, STYLES, ACCESS, fitText, roundRect, font } from '../ui.js';
import { game } from '../state.js';
import { save, totalStars } from '../save.js';
import { orderState, orderStars } from '../progress.js';
import { triesLeft, DAILY_TRIES } from '../daily.js';
import { go } from '../scenes.js';
import { openOptions } from '../back.js';
import { leftText, miniStar, shopOpen, notebookOpen, openMode } from './orders.js';
import { seen } from '../tutorial.js';
import { drawWorkshop, drawCounter } from './counter.js';
import { drawGribouille } from '../portraits.js';
import { withDrone, drawFrame, drawCover, setLook } from '../drone.js';

const DEPTH = 12;
const GRIB = { x: 330, y: 870, s: 0.95 };
let bottom, big, time, robot;

// Robot posé sur le comptoir, tiré au hasard à chaque visite parmi les patients qui reviennent souvent
// (jamais un prototype ni un patient spécial).
const GENERIC = ['mini_drone', 'balcony_drone', 'delivery_drone', 'racing_drone', 'dragonfly', 'beetle', 'firefly', 'bee', 'mantis', 'plush_robot', 'music_bear'];
const ROBOT = { x: 800, y: 880, s: 0.3 };

function drawRobot(ctx) {
  if (!robot) return;
  setLook(robot);
  const hover = 24 + Math.sin(time * 2) * 12;
  withDrone(ctx, ROBOT.x, ROBOT.y - hover, ROBOT.s, () => {
    drawFrame(ctx, { rotorAngle: time * 30, rotorSpeed: 30, lights: [0, 1, 2, 3].map((k) => (Math.floor(time * 3) + k) % 2 === 0) });
    drawCover(ctx);
  });
}

// Les 60 commandes sont réparées (la liste laisse alors place à cet écran).
export function allDone() {
  const list = game.data.orders;
  return list.length > 0 && list.every((o) => orderState(o) === 'done');
}

// Étoiles qu'il reste à gagner sur l'ensemble des commandes.
export function missingStars() {
  return game.data.orders.reduce((n, o) => n + 3 - orderStars(o), 0);
}

function dailySub() {
  const n = triesLeft();
  if (n <= 0) return t('daily.tomorrow');
  return n === 1 ? t('lobby.daily_1') : t('lobby.daily_n', { n });
}

function replaySub() {
  const m = missingStars();
  if (m <= 0) return { text: t('lobby.all_stars'), star: false };
  return { text: m === 1 ? t('lobby.missing_1') : t('lobby.missing', { n: m }), star: true };
}

// Gros bouton à deux lignes, même relief que les boutons du jeu.
function drawBig(ctx, b, pressed) {
  const st = STYLES[b.style];
  const push = pressed ? DEPTH - 3 : 0;
  const pulse = b.pulse && b.pulse() ? 1 + 0.03 * Math.sin(time * 6) : 1;
  const face = b.h - DEPTH;
  ctx.save();
  ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
  ctx.scale(pulse, pulse);
  ctx.translate(-b.w / 2, -b.h / 2);
  ctx.fillStyle = st.shadow;
  roundRect(ctx, 0, DEPTH, b.w, face, 36); ctx.fill();
  ctx.fillStyle = st.fill;
  roundRect(ctx, 0, push, b.w, face, 36); ctx.fill();
  if (ACCESS.contrast) { ctx.strokeStyle = C.ink; ctx.lineWidth = 5; ctx.stroke(); }
  const cy = push + face / 2;
  fitText(ctx, b.label(), b.w / 2, cy - 24, b.w - 60, 54, st.text, 900);
  const sub = b.sub();
  const subColor = b.style === 'secondary' ? (sub.star ? C.orangeDark : C.turquoiseDark) : st.text;
  if (sub.star) {
    // petite étoile devant « x étoiles manquantes »
    ctx.font = font(30, 800);
    const w = Math.min(ctx.measureText(sub.text).width, b.w - 140);
    const sx = b.w / 2 - (w + 48) / 2;
    ctx.save();
    miniStar(ctx, sx + 18, cy + 30, 18, true);
    ctx.restore();
    leftText(ctx, sub.text, sx + 48, cy + 32, b.w - 140, 30, subColor, 800);
  } else {
    fitText(ctx, sub.text, b.w / 2, cy + 32, b.w - 60, 30, subColor, 800);
  }
  ctx.restore();
}

export default {
  init() {
    time = 0;
    game.replay = false;
    const m = game.data.patients[GENERIC[Math.floor(Math.random() * GENERIC.length)]];
    robot = m ? { family: m.family, ...m.look } : null;
    big = new Buttons();
    big.add({
      x: 50, y: 1050, w: 980, h: 150, style: 'on',
      label: () => t('orders.daily'), sub: () => ({ text: dailySub() }),
      pulse: () => triesLeft() >= DAILY_TRIES,
      onTap: () => openMode('daily'),
    });
    big.add({
      x: 50, y: 1220, w: 980, h: 150, style: 'primary',
      label: () => t('orders.free'), sub: () => ({ text: t('lobby.free_sub') }),
      onTap: () => openMode('free'),
    });
    big.add({
      x: 50, y: 1390, w: 980, h: 150, style: 'secondary',
      label: () => t('lobby.replay'), sub: replaySub,
      onTap: () => { game.replay = true; go('orders'); },
    });
    bottom = new Buttons();
    bottom.add({ x: 50, y: 1570, w: 310, h: 160, size: 52, label: () => t('orders.shop'), visible: shopOpen(), onTap: () => go('shop') });
    bottom.add({
      x: 385, y: 1570, w: 310, h: 160, size: 52, label: () => t('orders.notebook'), visible: notebookOpen(),
      onTap: () => (seen('notebook') ? go('notebook') : go('story', { id: 'notebook', then: { scene: 'notebook' } })),
    });
    bottom.add({ x: 720, y: 1570, w: 310, h: 160, size: 52, style: 'secondary', label: () => t('title.options'), onTap: () => openOptions() });
  },

  update(dt) {
    time += dt;
  },

  draw(ctx) {
    // l'atelier en fond (sans client) : on y voit les décorations achetées, et Gribouille sur le comptoir
    drawWorkshop(ctx);
    drawCounter(ctx);
    drawRobot(ctx);
    drawGribouille(ctx, GRIB.x, GRIB.y, GRIB.s, { time, talk: false });
    leftText(ctx, t('lobby.done'), 60, 85, W - 120, 64, C.copperDark, 900);
    // sur deux lignes à gauche : la guirlande de polaroïds et le robot (décos de prestige) occupent le haut à droite
    leftText(ctx, t('lobby.status_rank', { r: save.rank, name: t('rank.' + save.rank) }), 60, 160, 470, 36, C.inkSoft, 800);
    leftText(ctx, t('lobby.status_credits', { n: save.credits, s: totalStars() }), 60, 204, 470, 36, C.inkSoft, 800);
    for (const b of big.list) drawBig(ctx, b, b === big.pressed);
    bottom.draw(ctx);
  },

  pointer(type, x, y) {
    if (big.pointer(type, x, y)) return;
    bottom.pointer(type, x, y);
  },
};
