// Écran titre, comme les autres jeux du studio :
// 1. au lancement, le logo Keismey Studio sur fond noir (un toucher le passe) ;
// 2. l'écran « Appuie pour continuer » (image titre.webp si elle existe, sinon le drone dessiné) ;
// 3. un toucher mène directement au jeu : la liste des commandes (ou l'écran de fin après les 60 commandes),
//    le chapitre 1 pour une toute première partie, ou d'abord les notes de mise à jour.
//    Les Options s'ouvrent depuis la liste des commandes, l'écran de fin et la pause des réparations.
import { W, H } from '../canvas.js';
import { t } from '../i18n.js';
import { C, drawCreamBackground, drawText, fitText, roundRect, font } from '../ui.js';
import { withDrone, drawFrame, drawCover } from '../drone.js';
import { go } from '../scenes.js';
import { sfx } from '../audio.js';
import { notesDue } from '../settings.js';
import { save } from '../save.js';
import { seen } from '../tutorial.js';
import { game } from '../state.js';

// Toute première partie : le chapitre 1 commence directement, puis Léa arrive au comptoir.
function play() {
  const first = !seen('ch1') && !(save.orders.o01 && save.orders.o01.paid);
  if (first) go('story', { id: 'ch1', then: { scene: 'counter', params: { order: 'o01', mode: 'intro' } } });
  else { game.replay = false; go('orders'); }
}

// Images : logo du studio (commun aux jeux) et fond vertical de l'écran « Appuie pour continuer ».
// done : chargée ou introuvable (le logo attend les deux images pour ne rien faire apparaître d'un coup).
function loadImage(src) {
  const img = new Image();
  img.ok = false;
  img.done = false;
  img.onload = () => { img.ok = true; img.done = true; };
  img.onerror = () => { img.done = true; };
  img.src = src;
  return img;
}
const STUDIO = loadImage('img/keismey-studio.webp');
const COVER = loadImage('img/titre.webp');

// Logo du studio : apparaît en 1 s, reste jusqu'à 2,3 s, puis s'efface en 0,7 s sur l'écran titre.
const LOGO_IN = 0.15, LOGO_FADE = 1, LOGO_OUT = 2.3, LOGO_GONE = 0.7;
const LOGO_WAIT = 2;  // au plus 2 s d'attente des images (réseau lent)
let logo = null;    // { time, out, wait } tant que le logo est affiché
let time = 0;

// Le logo s'efface (après son temps ou au toucher) ; les bandes autour du jeu repassent au beige en même temps.
function skipLogo() {
  if (!logo || logo.out !== null) return;
  logo.out = logo.time;
  document.body.classList.remove('noir');
}

function start() {
  sfx('click');
  // après une mise à jour, une fois : les notes (seulement pour un joueur qui a déjà joué), puis les commandes
  if (notesDue()) go('notes', { from: 'orders' });
  else play();
}

// « Touche pour commencer » au doigt, « Clique pour commencer » à la souris
const MOUSE = typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;

// halo : contour crème autour du titre, comme sur la couverture du hub (lisible sur le bois)
function drawTitleLogo(ctx, y, halo = false) {
  ctx.save();
  ctx.translate(W / 2, y);
  ctx.rotate(-0.03);
  ctx.font = font(150, 900);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  if (halo) {
    ctx.lineWidth = 60;
    ctx.strokeStyle = C.paper;
    ctx.strokeText(t('game.title'), 0, 0);
  }
  ctx.lineWidth = 34;
  ctx.strokeStyle = C.copperDark;
  ctx.strokeText(t('game.title'), 0, 0);
  ctx.fillStyle = C.turquoise;
  ctx.fillText(t('game.title'), 0, 0);
  ctx.restore();
}

function drawDrone(ctx, y, scale) {
  const bob = Math.sin(time * 2) * 18;
  withDrone(ctx, W / 2, y + bob, scale, () => {
    drawFrame(ctx, { rotorAngle: time * 30, rotorSpeed: 30, lights: [1, 0, 1, 0].map((v, i) => (Math.floor(time * 3) + i) % 2) });
    drawCover(ctx);
  });
}

// Image en plein écran, recadrée pour remplir le canevas sans être déformée.
function drawCoverImage(ctx, img) {
  const k = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const w = img.naturalWidth * k, h = img.naturalHeight * k;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}

function drawPress(ctx) {
  if (COVER.ok) {
    drawCoverImage(ctx, COVER);
  } else {
    drawCreamBackground(ctx);
    drawText(ctx, t('title.subtitle'), W / 2, 420, 860, 52, { color: C.inkSoft, weight: 700 });
    drawDrone(ctx, 960, 0.95);
  }
  drawTitleLogo(ctx, 250, COVER.ok);
  // « Appuie pour continuer » : étiquette toujours nette, le texte respire doucement
  ctx.fillStyle = 'rgba(58, 42, 30, 0.25)';
  roundRect(ctx, 150, 1606, W - 300, 128, 64); ctx.fill();
  ctx.fillStyle = C.paper;
  roundRect(ctx, 150, 1596, W - 300, 128, 64); ctx.fill();
  ctx.save();
  ctx.globalAlpha = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(time * 3.2));
  fitText(ctx, t(MOUSE ? 'title.press_click' : 'title.press'), W / 2, 1660, W - 380, 54, C.copperDark, 900);
  ctx.restore();
}

function drawStudio(ctx) {
  const l = logo;
  const out = l.out === null ? 0 : Math.min(1, (l.time - l.out) / LOGO_GONE);
  ctx.save();
  ctx.globalAlpha = 1 - out;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  if (STUDIO.ok) {
    ctx.globalAlpha = (1 - out) * Math.max(0, Math.min(1, (l.time - LOGO_IN) / LOGO_FADE));
    const w = 640, h = w * STUDIO.naturalHeight / STUDIO.naturalWidth;
    // le logo est sur fond noir : en « lighter », son carré noir ne se voit pas pendant le fondu
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(STUDIO, (W - w) / 2, (H - h) / 2, w, h);
  }
  ctx.restore();
}

export default {
  init(params = {}) {
    time = 0;
    if (params.intro) {
      logo = { time: 0, out: null, wait: 0 };
      document.body.classList.add('noir'); // bandes autour du jeu en noir pendant le logo
    }
  },

  update(dt) {
    time += dt;
    if (logo) {
      // le logo ne démarre qu'une fois son image chargée, et ne part pas avant l'image de l'écran titre
      const ready = STUDIO.done && COVER.done;
      if (logo.time === 0 && !STUDIO.done && logo.wait < LOGO_WAIT) { logo.wait += dt; return; }
      if (logo.out === null && logo.time >= LOGO_OUT && !ready && logo.wait < LOGO_WAIT) { logo.wait += dt; return; }
      logo.time += dt;
      if (logo.out === null && logo.time >= LOGO_OUT) skipLogo();
      if (logo.out !== null && logo.time - logo.out >= LOGO_GONE) logo = null;
    }
  },

  draw(ctx) {
    drawPress(ctx);
    if (logo) drawStudio(ctx);
  },

  // Retour du téléphone : passe le logo ; sinon c'est la question « Aller au hub ? » (back.js).
  back() {
    if (logo) { skipLogo(); return true; }
    return false;
  },

  // Bouton « Hub » de commun/ks-back.js : caché pendant le logo du studio.
  showsLogo() {
    return !!logo;
  },

  pointer(type, x, y) {
    if (logo) { if (type === 'up') skipLogo(); return; }
    if (type === 'up') start();
  },
};
