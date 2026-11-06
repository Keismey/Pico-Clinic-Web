// Comptoir : le client apporte son patient (accueil) ou vient le chercher réparé (merci).
// Bulles de dialogue qui s'écrivent lettre à lettre ; toucher l'écran avance.
import { W } from '../canvas.js';
import { t } from '../i18n.js';
import { Buttons, C, drawCreamBackground, fitText, font, roundRect, wrapLines } from '../ui.js';
import { withDrone, drawFrame, drawCover, setLook } from '../drone.js';
import { drawPerson, drawGribouille } from '../portraits.js';
import { game, getOrder, buildPatient, patientCount } from '../state.js';
import { meetClient } from '../progress.js';
import { vibrate } from '../feedback.js';
import { sfx } from '../audio.js';
import { go } from '../scenes.js';
import { leftText } from './orders.js';
import { drawOwnedDecos } from '../deco.js';

const TAU = Math.PI * 2;
const PERSON = { x: 360, y: 650, s: 1.12 };
const PATIENT = { x: 800, y: 880, s: 0.3 };
const GRIB = { x: 118, y: 938, s: 0.52 };
const COUNTER_Y = 1000;
const BOX = { x: 50, y: 1190, w: W - 100, h: 340 };
const TEXT = { x: 100, y: 1262, w: W - 200, size: 48, lineH: 62 };
const CPS = 42; // lettres par seconde

let order, mode, lines, idx, shown, time, lineTime, buttons, wrapped, rep;

// Orateurs qui ne sont pas des clients (V3c) : Mamie, le mot caché dans le cœur de Pantoufle, la carte postale d'Ohm.
const EXTRA_SPEAKERS = { mamie: '#b5547a', note: '#a8822a', postcard: '#a8822a' };

function speakerName(who) {
  if (who === 'gribouille') return t('name.gribouille');
  if (who === 'passage') return t('name.passage');
  if (EXTRA_SPEAKERS[who]) return t('name.' + who);
  return t('client.' + who);
}

function speakerColor(who) {
  if (EXTRA_SPEAKERS[who]) return EXTRA_SPEAKERS[who];
  const c = game.data.clients.list[who];
  return c ? c.color : C.copper;
}

// Bulles de la commande : « clé » (le client parle) ou « orateur:clé » (gribouille, mamie, note, postcard).
function buildLines(o, m) {
  const keys = (m === 'intro' ? o.intro : o.thanks) || [];
  const out = keys.map((k) => {
    const i = k.indexOf(':');
    return i > 0 ? { who: k.slice(0, i), key: k.slice(i + 1) } : { who: o.client, key: k };
  });
  if (m === 'intro' && o.exam) out.push({ who: 'gribouille', key: 'counter.exam_line', vars: { r: o.exam } });
  return out;
}

function current() {
  return lines[idx];
}

function fullText() {
  const l = current();
  return l ? t(l.key, l.vars) : '';
}

function atEnd() {
  return idx >= lines.length - 1 && shown >= fullText().length;
}

function finish() {
  if (mode === 'intro') go('operation', { order: order.id });
  else go('done');
}

function advance() {
  const len = fullText().length;
  if (shown < len) { shown = len; return; }
  if (idx < lines.length - 1) {
    idx++;
    shown = 0;
    lineTime = 0;
    wrapped = null;
    vibrate(8);
    sfx('page');
    return;
  }
  finish();
}

// Fond : le mur de l'atelier, l'enseigne, le panneau à outils et l'étagère.
export function drawWorkshop(ctx, sign) {
  drawCreamBackground(ctx);
  const g = ctx.createLinearGradient(0, 200, 0, COUNTER_Y);
  g.addColorStop(0, 'rgba(232, 205, 166, 0.0)');
  g.addColorStop(1, 'rgba(214, 180, 136, 0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 200, W, COUNTER_Y - 200);

  // enseigne
  ctx.strokeStyle = '#8f5426';
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(130, 210); ctx.lineTo(160, 262); ctx.moveTo(450, 210); ctx.lineTo(420, 262); ctx.stroke();
  ctx.fillStyle = '#8f5426';
  roundRect(ctx, 70, 258, 440, 104, 22); ctx.fill();
  ctx.fillStyle = '#c47a3c';
  roundRect(ctx, 80, 250, 420, 100, 20); ctx.fill();
  fitText(ctx, sign || t('counter.sign'), 290, 302, 380, 52, '#fff7ec', 900);

  // panneau à outils
  ctx.fillStyle = '#d2ac80';
  roundRect(ctx, 600, 230, 420, 380, 24); ctx.fill();
  ctx.fillStyle = 'rgba(90, 61, 34, 0.25)';
  for (let y = 262; y < 600; y += 44) for (let x = 632; x < 1000; x += 44) {
    ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill();
  }
  // tournevis, pince et fer accrochés
  ctx.save();
  ctx.translate(690, 330); ctx.rotate(0.15);
  ctx.fillStyle = '#ff8a3d'; roundRect(ctx, -22, -60, 44, 100, 18); ctx.fill();
  ctx.fillStyle = '#9aa3ad'; ctx.fillRect(-6, 40, 12, 150);
  ctx.restore();
  ctx.save();
  ctx.translate(820, 360);
  ctx.strokeStyle = '#3fd0bb'; ctx.lineWidth = 22; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-40, -70); ctx.lineTo(-6, 60); ctx.moveTo(40, -70); ctx.lineTo(6, 60); ctx.stroke();
  ctx.strokeStyle = '#6b7684'; ctx.lineWidth = 12;
  ctx.beginPath(); ctx.moveTo(-6, 60); ctx.lineTo(-4, 150); ctx.moveTo(6, 60); ctx.lineTo(4, 150); ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.translate(950, 340); ctx.rotate(-0.12);
  ctx.fillStyle = '#3a2a1e'; roundRect(ctx, -18, -70, 36, 120, 14); ctx.fill();
  ctx.fillStyle = '#c47a3c'; ctx.fillRect(-7, 50, 14, 110);
  ctx.restore();

  // étagère avec bocaux de vis
  ctx.fillStyle = '#8f5426';
  ctx.fillRect(560, 690, 480, 20);
  for (const [x, c, h] of [[610, '#5fb8e8', 90], [700, '#ffd166', 70], [780, '#e0453a', 100], [880, '#7cc68a', 80], [970, '#d9a8ef', 66]]) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    roundRect(ctx, x - 34, 690 - h, 68, h, 12); ctx.fill();
    ctx.fillStyle = c;
    roundRect(ctx, x - 26, 690 - h * 0.6, 52, h * 0.6 - 6, 8); ctx.fill();
    ctx.fillStyle = '#8f5426';
    ctx.fillRect(x - 30, 690 - h - 10, 60, 14);
  }
  // V3b : décorations achetées à la boutique
  drawOwnedDecos(ctx, 'wall', performance.now() / 1000);
}

export function drawCounter(ctx) {
  ctx.fillStyle = '#b9783f';
  ctx.fillRect(0, COUNTER_Y + 30, W, 150);
  ctx.strokeStyle = 'rgba(90, 50, 20, 0.25)';
  ctx.lineWidth = 4;
  for (let x = 120; x < W; x += 180) {
    ctx.beginPath(); ctx.moveTo(x, COUNTER_Y + 40); ctx.lineTo(x, COUNTER_Y + 180); ctx.stroke();
  }
  ctx.fillStyle = '#d9a066';
  roundRect(ctx, -20, COUNTER_Y - 10, W + 40, 48, 14); ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.fillRect(0, COUNTER_Y - 4, W, 8);
  drawOwnedDecos(ctx, 'counter', performance.now() / 1000);
}

// Patients sur le comptoir (V3b : jusqu'à 3 pour les commandes de plusieurs patients).
const ROWS = { 1: [[800, 0.3]], 2: [[680, 0.24], [900, 0.24]], 3: [[620, 0.2], [800, 0.2], [980, 0.2]] };
function drawPatient(ctx) {
  const done = mode === 'thanks';
  const n = patientCount(order);
  // avec un second personnage, le patient se pose entre les deux
  const rows = order.companion && n === 1 ? [[540, 0.3]] : ROWS[n] || ROWS[1];
  rows.forEach(([x, s], i) => {
    setLook(buildPatient(order.id, i).look);
    const hover = done ? 30 + Math.sin(time * 3 + i) * 14 : 0;
    withDrone(ctx, x, PATIENT.y - hover, s, () => {
      drawFrame(ctx, {
        rotorAngle: done ? time * 40 : 0.3,
        rotorSpeed: done ? 40 : 0,
        lights: done ? [0, 1, 2, 3].map((k) => (Math.floor(time * 4) + k) % 2 === 0) : [false, false, false, false],
      });
      drawCover(ctx, { screws: done && rep && n === 1 ? rep.screws : null });
    });
  });
}

// Maître Ohm n'est plus là : sa lettre est posée sur le comptoir.
export function drawLetter(ctx, x, y, k = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.08);
  ctx.scale(k, k);
  ctx.fillStyle = 'rgba(90, 50, 20, 0.2)';
  roundRect(ctx, -150, -90, 310, 200, 18); ctx.fill();
  ctx.fillStyle = '#f7ecd6';
  roundRect(ctx, -160, -100, 310, 200, 18); ctx.fill();
  ctx.strokeStyle = '#c9b291'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(-160, -95); ctx.lineTo(-5, 20); ctx.lineTo(150, -95); ctx.stroke();
  ctx.fillStyle = '#b8322a';
  ctx.beginPath(); ctx.arc(-5, 20, 34, 0, TAU); ctx.fill();
  ctx.fillStyle = '#e8d6b0';
  ctx.font = '900 34px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Ω', -5, 22);
  ctx.restore();
}

// Objet lu pendant la bulle, posé sur le comptoir devant le client (mot caché, carte postale).
function drawReadable(ctx, kind) {
  const k = Math.min(1, lineTime / 0.35);
  const e = 1 - Math.pow(1 - k, 3);
  ctx.save();
  ctx.translate(W / 2, COUNTER_Y - 150 + (1 - e) * 60);
  ctx.rotate(kind === 'note' ? -0.05 : 0.04);
  ctx.scale(0.4 + 0.6 * e, 0.4 + 0.6 * e);
  ctx.globalAlpha = e;
  if (kind === 'note') {
    // petit papier plié, avec un cœur
    ctx.fillStyle = 'rgba(90, 50, 20, 0.22)';
    roundRect(ctx, -250, -170, 520, 360, 14); ctx.fill();
    ctx.fillStyle = '#fbf0d2';
    roundRect(ctx, -260, -180, 520, 360, 14); ctx.fill();
    ctx.strokeStyle = '#c9b291'; ctx.lineWidth = 4;
    for (let y = -110; y <= 110; y += 55) { ctx.beginPath(); ctx.moveTo(-210, y); ctx.lineTo(210, y); ctx.stroke(); }
    ctx.fillStyle = '#e0453a';
    ctx.beginPath(); ctx.moveTo(0, 150);
    ctx.bezierCurveTo(-60, 100, -50, 60, 0, 90);
    ctx.bezierCurveTo(50, 60, 60, 100, 0, 150);
    ctx.fill();
  } else {
    // carte postale : timbre et lignes d'adresse
    ctx.fillStyle = 'rgba(90, 50, 20, 0.22)';
    roundRect(ctx, -300, -190, 620, 400, 16); ctx.fill();
    ctx.fillStyle = '#fffaf0';
    roundRect(ctx, -310, -200, 620, 400, 16); ctx.fill();
    ctx.fillStyle = '#7cc0e8';
    ctx.fillRect(-290, -180, 270, 360);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(-110, -90, 46, 0, TAU); ctx.fill();
    ctx.fillStyle = '#7cc68a';
    ctx.beginPath(); ctx.moveTo(-290, 180); ctx.lineTo(-170, 30); ctx.lineTo(-20, 180); ctx.fill();
    ctx.strokeStyle = '#c47a3c'; ctx.lineWidth = 6; ctx.strokeRect(210, -170, 80, 100);
    ctx.strokeStyle = '#c9b291'; ctx.lineWidth = 4;
    for (let y = 0; y <= 120; y += 50) { ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(280, y); ctx.stroke(); }
  }
  ctx.restore();
}

function drawBox(ctx) {
  const l = current();
  if (!l) return;
  // cadre
  ctx.fillStyle = '#d9c3a3';
  roundRect(ctx, BOX.x, BOX.y + 10, BOX.w, BOX.h, 40); ctx.fill();
  ctx.fillStyle = C.paper;
  roundRect(ctx, BOX.x, BOX.y, BOX.w, BOX.h, 40); ctx.fill();
  ctx.strokeStyle = speakerColor(l.who);
  ctx.lineWidth = 6;
  ctx.stroke();
  // étiquette du nom
  const name = speakerName(l.who);
  ctx.font = font(38, 900);
  const nw = Math.min(BOX.w - 80, ctx.measureText(name).width + 70);
  ctx.fillStyle = speakerColor(l.who);
  roundRect(ctx, BOX.x + 40, BOX.y - 40, nw, 76, 38); ctx.fill();
  fitText(ctx, name, BOX.x + 40 + nw / 2, BOX.y - 1, nw - 40, 38, '#fff', 900);
  // texte qui s'écrit
  ctx.font = font(TEXT.size, 700);
  if (!wrapped) wrapped = wrapLines(ctx, fullText(), TEXT.w);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.ink;
  let left = Math.floor(shown);
  wrapped.forEach((line, i) => {
    if (left <= 0) return;
    ctx.fillText(line.slice(0, left), TEXT.x, TEXT.y + i * TEXT.lineH);
    left -= line.length + 1;
  });
  // petite flèche quand la bulle est complète
  if (shown >= fullText().length && Math.sin(time * 6) > -0.3) {
    ctx.fillStyle = C.orange;
    const x = BOX.x + BOX.w - 60, y = BOX.y + BOX.h - 46;
    ctx.beginPath(); ctx.moveTo(x - 18, y - 10); ctx.lineTo(x + 18, y - 10); ctx.lineTo(x, y + 12); ctx.closePath(); ctx.fill();
  }
  // points : une bulle sur n
  if (lines.length > 1) {
    lines.forEach((_, i) => {
      ctx.fillStyle = i === idx ? C.copper : 'rgba(58, 42, 30, 0.2)';
      ctx.beginPath(); ctx.arc(W / 2 + (i - (lines.length - 1) / 2) * 34, 1860, 10, 0, TAU); ctx.fill();
    });
  }
}

export default {
  init(params = {}) {
    order = getOrder(params.order || game.lastOrder);
    mode = params.mode === 'thanks' ? 'thanks' : 'intro';
    rep = mode === 'thanks' ? game.repair : null;
    lines = buildLines(order, mode);
    idx = 0;
    shown = 0;
    time = 0;
    lineTime = 0;
    wrapped = null;
    setLook(buildPatient(order.id).look);
    if (mode === 'intro') meetClient(order.client);
    buttons = new Buttons();
    buttons.add({
      x: 60, y: 1640, w: 300, h: 140, size: 44, style: 'secondary',
      label: () => t('counter.skip'),
      visible: true,
      onTap: () => finish(),
    });
    buttons.add({
      x: 400, y: 1620, w: 620, h: 170, size: 58,
      label: () => (atEnd() ? t(mode === 'intro' ? 'counter.take' : 'counter.results') : t('counter.next')),
      onTap: () => advance(),
    });
    if (!lines.length) finish();
  },

  update(dt) {
    time += dt;
    lineTime += dt;
    // le client arrive au comptoir avant de parler
    if (mode === 'intro' && time < 0.45) return;
    const len = fullText().length;
    if (shown < len) shown = Math.min(len, shown + CPS * dt);
    buttons.list[1].pulse = atEnd();
  },

  draw(ctx) {
    drawWorkshop(ctx);
    const l = current();
    const clientTalks = l && l.who === order.client && shown < fullText().length;
    const gribTalks = l && l.who === 'gribouille' && shown < fullText().length;
    const cinfo = game.data.clients.list[order.client] || {};
    const mood = mode === 'intro' ? cinfo.mood || 'neutral' : cinfo.thanks_mood || 'happy';
    const enter = mode === 'intro' ? Math.min(1, time / 0.45) : 1;
    const px = -260 + (PERSON.x + 260) * (1 - Math.pow(1 - enter, 3));
    // lecture d'un objet (mot caché, carte postale) : le client s'estompe, l'objet passe devant
    const reading = l && (l.who === 'note' || l.who === 'postcard') ? l.who : null;
    const dim = reading ? 0.28 : 1;
    ctx.save();
    ctx.globalAlpha = dim;
    if (order.companion) {
      // deux personnages à l'écran, côte à côte ; celui qui parle s'anime
      const cTalks = l && l.who === order.companion && shown < fullText().length;
      drawPerson(ctx, order.client, px - 110, PERSON.y + 40, PERSON.s * 0.92, { time, talk: clientTalks, mood, seed: order.id });
      drawPerson(ctx, order.companion, 1160 - px, PERSON.y + 10, PERSON.s * 0.92, { time: time + 1, talk: cTalks, mood: 'happy', seed: order.id });
    } else if (!cinfo.letter) {
      drawPerson(ctx, order.client, px, PERSON.y, PERSON.s, { time, talk: clientTalks, mood, seed: order.id });
    }
    ctx.restore();
    drawCounter(ctx);
    if (cinfo.letter) { ctx.save(); ctx.globalAlpha = dim; drawLetter(ctx, 330, 930); ctx.restore(); }
    drawPatient(ctx);
    if (reading) drawReadable(ctx, reading);
    if (lines.some((x) => x.who === 'gribouille')) {
      const hop = gribTalks ? Math.abs(Math.sin(time * 8)) * 10 : 0;
      drawGribouille(ctx, GRIB.x, GRIB.y - hop, GRIB.s, { time, talk: gribTalks });
    }

    // en-tête : numéro de la commande, patient, examen
    const name = order.name ? t(order.name) : t('patient.' + order.model);
    leftText(ctx, t('counter.order', { n: order.n, name }), 60, 90, 680, 46, C.copperDark, 900);
    if (order.exam) {
      ctx.fillStyle = C.orange;
      roundRect(ctx, 56, 132, 420, 64, 32); ctx.fill();
      fitText(ctx, t('counter.exam', { r: order.exam }), 266, 165, 380, 34, '#fff', 900);
    }

    drawBox(ctx);
    buttons.draw(ctx);
  },

  // Bouton retour : avant la réparation on revient aux commandes, après on va voir les étoiles.
  back() {
    if (mode === 'thanks') finish(); else go('orders');
    return true;
  },

  pointer(type, x, y) {
    if (buttons.pointer(type, x, y)) return;
    if (type === 'up' && !(mode === 'intro' && time < 0.45)) advance();
  },
};
