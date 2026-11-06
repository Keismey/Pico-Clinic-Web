// V3a — Vue rapprochée des gestes secondaires.
// Sur la carte, chaque pièce en panne (batterie, engrenage, capteur, broches, ressort, piles,
// circuit oxydé) a une petite icône qui clignote. La toucher ouvre un grand panneau où l'on fait
// le geste ; réussi, le panneau se referme tout seul et la panne disparaît. La croix referme sans
// rien perdre (on peut revenir plus tard).
import { W, H } from './canvas.js';
import { t } from './i18n.js';
import { C, roundRect, fitText, easeInOut } from './ui.js';
import { SEC, isHidden } from './drone.js';
import { demo } from './tutorial.js';
import { toneStop } from './feedback.js';
import { cleanliness } from './score.js';
import { createBattery, drawBatteryPiece } from './gestures/battery.js';
import { createHeart } from './gestures/heart.js';
import { createGear, drawGear } from './gestures/gear.js';
import { createSensor } from './gestures/sensor.js';
import { createPins } from './gestures/pins.js';
import { createSpring } from './gestures/spring.js';
import { createBatteries, drawPile } from './gestures/batteries.js';
import { createOxide } from './gestures/oxide.js';
import { createSeam } from './gestures/seam.js';
import { createKey } from './gestures/key.js';
import { createTrain } from './gestures/train.js';
import { sfx } from './audio.js';

const TAU = Math.PI * 2;
export const PANEL = { x: 60, y: 300, w: 960, h: 960, cx: 540, cy: 780 };
const CLOSE = { x: 966, y: 354, r: 44 };
// Fenêtre resserrée autour du contenu de chaque geste [haut, bas], recentrée à l'écran
const RECT = { sensor: [300, 1215], pins: [520, 1190], spring: [400, 1235], batteries: [336, 1160], battery: [330, 960], gear: [440, 1140], seam: [400, 1160], key: [320, 1250] };
const rectOf = (type) => RECT[type] || [PANEL.y, PANEL.y + PANEL.h];
const shiftOf = (type) => { const [a, b] = rectOf(type); return PANEL.cy - (a + b) / 2; };

const MAKE = {
  battery: (g, fx) => createBattery(g.battery, fx),
  heart: (g, fx) => createHeart(g.heart, fx),
  gear: (g, fx) => createGear(g.gear, fx),
  sensor: (g, fx) => createSensor(g.sensor, fx),
  pins: (g, fx, p) => createPins(g.pins, fx, { count: p.pins }),
  spring: (g, fx) => createSpring(g.spring, fx),
  batteries: (g, fx) => createBatteries(g.batteries, fx),
  oxide: (g, fx) => createOxide(g.oxide, fx, { cost: g.scoring.capacitor_cost }),
  seam: (g, fx, p) => createSeam(g.seam, fx, { rank: p.rank, look: p.look }),
  key: (g, fx, p) => createKey(g.key, fx, { rank: p.rank }),
  train: (g, fx) => createTrain(g.train, fx),
};

// ---------- Icônes sur la carte ----------

function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.5, y + s * 0.1, x - s * 1.1, y - s * 1.1, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 1.1, y - s * 1.1, x + s * 1.5, y + s * 0.1, x, y + s * 0.9);
  ctx.closePath();
}

function drawIcon(ctx, type, x, y, broken, time) {
  ctx.save();
  const blink = 0.5 + 0.5 * Math.sin(time * 8);
  switch (type) {
    case 'battery':
      if (!broken) break; // la batterie normale est déjà dessinée par la carte
      // même dessin que dans le mini-jeu (batterie bombée, voyant rouge « ! »), en plus petit
      drawBatteryPiece(ctx, x, y, { old: true, scale: 0.64 });
      break;
    case 'heart': {
      // la pochette de tissu cousue sur la carte : fermeture éclair en haut, cœur brodé
      ctx.fillStyle = '#f4c9a2';
      roundRect(ctx, x - 74, y - 70, 148, 140, 30); ctx.fill();
      ctx.fillStyle = '#ef8fa6';
      roundRect(ctx, x - 62, y - 58, 124, 116, 24); ctx.fill();
      ctx.save();
      ctx.setLineDash([7, 6]);
      ctx.strokeStyle = '#fff3f5';
      ctx.lineWidth = 3;
      roundRect(ctx, x - 54, y - 50, 108, 100, 18); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#d7dde3';
      for (let k = 0; k < 9; k++) ctx.fillRect(x - 44 + k * 11, y - 46 + (k % 2 ? 3 : -3), 6, 7);
      ctx.fillStyle = '#8b939d';
      roundRect(ctx, x + 40, y - 44, 12, 24, 4); ctx.fill();
      heartPath(ctx, x, y + 10, 26);
      ctx.fillStyle = broken ? `rgba(214, 69, 69, ${0.45 + 0.55 * blink})` : '#ff5c8a';
      ctx.fill();
      break;
    }
    case 'gear':
      drawGear(ctx, x - 14, y + 4, 30, 9, broken ? 0.2 : time * 2);
      drawGear(ctx, x + 32, y - 18, 18, 7, broken ? 0 : -time * 3.4, { color: '#c9a24a', dark: '#7a5a1a' });
      if (broken) { ctx.fillStyle = '#7d7468'; ctx.beginPath(); ctx.arc(x + 18, y + 6, 11, 0, TAU); ctx.fill(); }
      break;
    case 'sensor':
      ctx.fillStyle = '#1f2937';
      roundRect(ctx, x - 44, y - 26, 88, 52, 10); ctx.fill();
      ctx.fillStyle = '#5fd3ff';
      ctx.beginPath(); ctx.arc(x - 16, y, 14, 0, TAU); ctx.fill();
      ctx.fillStyle = broken ? `rgba(214, 69, 69, ${0.4 + 0.6 * blink})` : C.green;
      ctx.beginPath(); ctx.arc(x + 22, y - 6, 8, 0, TAU); ctx.fill();
      break;
    case 'pins':
      ctx.fillStyle = '#1f2937';
      roundRect(ctx, x - 48, y + 14, 96, 22, 6); ctx.fill();
      ctx.strokeStyle = '#e3b450'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const px = x - 36 + i * 18;
        const a = broken && (i === 1 || i === 3) ? (i === 1 ? -0.5 : 0.45) : 0;
        ctx.beginPath(); ctx.moveTo(px, y + 16); ctx.lineTo(px + Math.sin(a) * 44, y + 16 - Math.cos(a) * 44); ctx.stroke();
      }
      break;
    case 'spring':
      ctx.strokeStyle = '#b9c2cc'; ctx.lineWidth = 7; ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let k = 0; k <= 8; k++) {
        const yy = y - 36 + k * 9 * (broken ? 1 + (k % 3) * 0.25 : 1);
        ctx.lineTo(x + (k % 2 ? 26 : -26), yy);
      }
      ctx.stroke();
      break;
    case 'batteries': {
      // panneau solaire (cadre bleu, cellules, reflet) et deux piles posées dessus : mêmes dessins que le mini-jeu
      ctx.fillStyle = '#1d3b72'; roundRect(ctx, x - 56, y + 2, 112, 50, 7); ctx.fill();
      ctx.fillStyle = broken ? '#7f7c78' : '#2f5fb5'; roundRect(ctx, x - 52, y + 6, 104, 42, 4); ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 1; k < 4; k++) { ctx.moveTo(x - 52 + k * 26, y + 6); ctx.lineTo(x - 52 + k * 26, y + 48); }
      ctx.moveTo(x - 52, y + 27); ctx.lineTo(x + 52, y + 27);
      ctx.stroke();
      if (!broken) { ctx.fillStyle = 'rgba(255, 255, 255, 0.22)'; ctx.beginPath(); ctx.moveTo(x - 52, y + 6); ctx.lineTo(x - 14, y + 6); ctx.lineTo(x - 52, y + 36); ctx.closePath(); ctx.fill(); }
      drawPile(ctx, x - 24, y - 26, { old: broken, scale: 0.25 });
      drawPile(ctx, x + 24, y - 26, { old: broken, scale: 0.25 });
      break;
    }
    case 'oxide': {
      const bands = [['#c0392b', '#e8943a', '#2c3e50'], ['#2c3e50', '#c0392b', '#d9a441'], ['#e8943a', '#e8943a', '#c0392b'], ['#d9a441', '#2c3e50', '#c0392b']];
      [[-30, -16], [10, -24], [-14, 16], [26, 14]].forEach(([dx, dy], n) => {
        const rx = x + dx, ry = y + dy;
        ctx.strokeStyle = '#9aa3ad'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(rx - 24, ry); ctx.lineTo(rx + 24, ry); ctx.stroke();
        ctx.fillStyle = '#e8d6b0'; roundRect(ctx, rx - 15, ry - 8, 30, 16, 6); ctx.fill();
        ctx.strokeStyle = '#8f6a1e'; ctx.lineWidth = 2; ctx.stroke();
        bands[n].forEach((col, k) => { ctx.fillStyle = col; ctx.fillRect(rx - 9 + k * 8, ry - 7, 4, 14); });
      });
      if (broken) {
        ctx.fillStyle = 'rgba(110, 196, 170, 0.85)';
        for (const [dx, dy, r] of [[-8, -4, 22], [22, -2, 16], [-28, 22, 14]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, TAU); ctx.fill(); }
      }
      break;
    }
    case 'key': {
      // barillet et ressort spirale, clé papillon dessus
      ctx.fillStyle = '#c9a24a';
      ctx.beginPath(); ctx.arc(x, y, 58, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#8f6a1e'; ctx.lineWidth = 5; ctx.stroke();
      ctx.fillStyle = '#3b3227';
      ctx.beginPath(); ctx.arc(x, y, 48, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#cfd6dd'; ctx.lineWidth = 4;
      ctx.beginPath();
      const turns = broken ? 2.5 : 6, rOut = broken ? 44 : 30;
      for (let i = 0; i <= 80; i++) {
        const f = i / 80, a = f * turns * TAU, r = 8 + (rOut - 8) * f;
        if (i) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      ctx.stroke();
      ctx.fillStyle = '#d9a441'; ctx.strokeStyle = '#8f6a1e'; ctx.lineWidth = 3;
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + sd * 22, y, 22, 14, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
      if (broken) {
        ctx.fillStyle = `rgba(214, 69, 69, ${0.45 + 0.55 * blink})`;
        ctx.beginPath(); ctx.arc(x + 46, y - 46, 14, 0, TAU); ctx.fill();
      }
      break;
    }
    case 'train': {
      // petit train d'engrenages : cinq cercles qui se touchent, en un seul bloc compact ; en panne, les axes sont vides (cercles en pointillés)
      const R = [14, 17, 12, 13, 9], ANG = [10, 75, 165, 235];
      const pts = [{ x: 0, y: 0, r: R[0] }];
      ANG.forEach((a, k) => {
        const p = pts[k], r = R[k + 1], d = p.r + r, t = (a * Math.PI) / 180;
        pts.push({ x: p.x + d * Math.cos(t), y: p.y + d * Math.sin(t), r });
      });
      const x0 = Math.min(...pts.map((p) => p.x - p.r)) - 7, x1 = Math.max(...pts.map((p) => p.x + p.r)) + 7;
      const y0 = Math.min(...pts.map((p) => p.y - p.r)) - 7, y1 = Math.max(...pts.map((p) => p.y + p.r)) + 7;
      const ox = x - (x0 + x1) / 2, oy = y - (y0 + y1) / 2;
      ctx.fillStyle = '#e8dcc6';
      roundRect(ctx, ox + x0, oy + y0, x1 - x0, y1 - y0, 14); ctx.fill();
      pts.forEach((p, k) => {
        const gx = ox + p.x, gy = oy + p.y;
        if (!broken) { drawGear(ctx, gx, gy, p.r - 2, Math.max(6, Math.round(p.r / 3)), time * 3 * (k % 2 ? 1 : -1)); return; }
        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = 'rgba(91, 95, 102, 0.8)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(gx, gy, p.r - 1, 0, TAU); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = '#5b5f66';
        ctx.beginPath(); ctx.arc(gx, gy, 3.5, 0, TAU); ctx.fill();
      });
      break;
    }
    default:
  }
  ctx.restore();
}

// ---------- Gestionnaire ----------

// hooks : { toast(key, color, vars), vibrate(p), spawn(x, y, opts), fixed(fault) }
export function createCloseup(rep, hooks) {
  // exterior = sur le tissu (couture) : se répare capot refermé, pendant rep.seamPhase
  const items = Object.entries(rep.bay || {}).map(([fault, spot]) => ({ fault, type: SEC[fault], spot, mod: null, exterior: !!spot.exterior }));
  let open = null;   // { item, k, closing, success }

  const fx = {
    ok: (key, vars) => { hooks.toast(key, C.green, vars); sfx(key === 'sec.spring.ok' ? 'spring' : 'ok'); },
    bad: (key, vars) => { hooks.toast(key, C.red, vars); sfx('bad'); },
    info: (key, vars) => { hooks.toast(key, C.inkSoft, vars); sfx('miss'); },
    // petit cliquetis pour les vibrations courtes (prise, cran, battement)
    vibrate: (p) => { hooks.vibrate(p); if (typeof p === 'number') sfx(p >= 30 ? 'thump' : 'tick'); },
    spawn: (x, y, o) => hooks.spawn(x, y + (open ? shiftOf(open.item.type) : 0), o),
    care: (n) => { rep.care = (rep.care || 0) + n; },
    score: (v) => { (rep.scores = rep.scores || []).push(Math.max(0, Math.min(1, v))); },
    // pièce de rechange posée : payée en crédits à la fin (comme les condensateurs)
    part: () => { rep.partsUsed = (rep.partsUsed || 0) + 1; },
  };

  function broken(it) {
    return rep.faults.has(it.fault);
  }

  function openItem(it) {
    if (!it.mod) it.mod = MAKE[it.type](rep.g, fx, rep.patient);
    open = { item: it, k: 0, closing: false, success: 0 };
    hooks.vibrate(12);
    sfx('zoom');
  }

  function close() {
    if (!open) return;
    if (open.item.mod) open.item.mod.up();
    toneStop();
    open.closing = true;
  }

  const ready = () => open && open.k >= 1 && !open.closing && !open.success;

  return {
    get active() { return !!open; },
    get current() { return open && !open.closing ? open.item : null; },

    // Leçons de Gribouille (une par type de panne présent, la première fois seulement).
    lessons() {
      const seenTypes = new Set();
      const out = [];
      // la couture (sur le tissu) se fait en dernier, capot refermé : sa leçon passe après les autres,
      // sinon elle bloquerait les leçons suivantes jusqu'à la fin de la réparation
      for (const it of items.slice().sort((a, b) => a.exterior - b.exterior)) {
        if (seenTypes.has(it.type)) continue;
        seenTypes.add(it.type);
        const mine = () => !!(open && open.item.type === it.type);
        const mod = () => (mine() && open.k >= 1 ? open.item.mod : null);
        out.push({
          id: 'sec_' + it.type,
          key: () => {
            const m = mod();
            if (m && m.tutoKey) return m.tutoKey();
            return mine() ? 'tuto.sec.' + it.type + '2' : 'tuto.sec.' + it.type;
          },
          praise: 'tuto.bravo',
          start: () => (it.exterior ? !!rep.seamPhase : rep.coverAnim >= 1 && rep.phase === 'repair') && (!open || mine()),
          done: () => !items.some((x) => x.type === it.type && broken(x)),
          demo: () => (open ? (mod() && mod().demo ? mod().demo() : null) : demo.tap(it.spot.x, it.spot.y)),
          ring: () => (open ? null : { x: it.spot.x, y: it.spot.y, r: it.spot.r + 20 }),
          offset: () => (mod() && mod().offset ? mod().offset() : [0, 0]),
          shift: () => (mod() ? shiftOf(it.type) : 0),
          carry: (c, x, y, p) => { const m = mod(); if (m && m.carry) m.carry(c, x, y, p); },
        });
      }
      return out;
    },

    // Toucher une pièce en panne sur la carte : le panneau s'ouvre.
    tapAt(x, y) {
      for (const it of items) {
        if (!broken(it) || isHidden(rep, it.fault) || it.exterior !== !!rep.seamPhase) continue;
        if (Math.hypot(x - it.spot.x, y - it.spot.y) <= it.spot.r + 30) { openItem(it); return true; }
      }
      return false;
    },

    down(x, y) {
      if (!ready()) return;
      const dy = shiftOf(open.item.type);
      if (Math.hypot(x - CLOSE.x, y - dy - (rectOf(open.item.type)[0] + 54)) <= CLOSE.r + 20) { close(); return; }
      open.item.mod.down(x, y - dy);
    },
    move(x, y) { if (ready()) open.item.mod.move(x, y - shiftOf(open.item.type)); },
    up() { if (open && open.item.mod) open.item.mod.up(); toneStop(); },

    update(dt) {
      if (!open) return;
      const m = open.item.mod;
      if (open.closing) {
        open.k = Math.max(0, open.k - dt / 0.25);
        if (open.k <= 0) {
          const it = open.item;
          open = null;
          if (it.mod.done && broken(it)) hooks.fixed(it.fault);
        }
        return;
      }
      open.k = Math.min(1, open.k + dt / 0.25);
      m.update(dt);
      if (m.done && !open.success) { open.success = 1.0; m.up(); toneStop(); }
      if (open.success) {
        open.success = Math.max(0, open.success - dt);
        if (open.success <= 0) { open.success = 0; open.closing = true; }
      }
    },

    hint() {
      return open ? open.item.mod.hint() : null;
    },

    // Sous le texte d'aide : l'avancement du geste et la propreté actuelle (les maladresses se voient).
    sub() {
      const m = open && open.item.mod;
      if (!m) return null;
      const parts = [];
      const own = m.sub ? m.sub(t) : null;
      if (own) parts.push(own);
      if (rep.care > 0) parts.push(t('op.clean', { p: cleanliness(rep) }));
      return parts.length ? parts.join('   ·   ') : null;
    },

    // Icônes sur la carte (à dessiner avec l'intérieur du patient).
    // xray = dans la loupe : les pannes encore cachées s'y voient. Les pièces saines des baies libres
    // (rep.fillers, diagnostic) sont dessinées aussi, pour qu'une baie occupée ne trahisse rien.
    drawBoard(ctx, time, xray = false) {
      for (const f of rep.fillers || []) drawIcon(ctx, f.type, f.x, f.y, false, time);
      for (const it of items) {
        if (it.exterior) continue;
        const b = broken(it) && (xray || !isHidden(rep, it.fault));
        drawIcon(ctx, it.type, it.spot.x, it.spot.y, b, time);
        if (b && !open && !xray) {
          const a = 0.5 + 0.5 * Math.sin(time * 5);
          ctx.strokeStyle = `rgba(255, 138, 61, ${0.35 + 0.5 * a})`;
          ctx.lineWidth = 7;
          ctx.beginPath(); ctx.arc(it.spot.x, it.spot.y, it.spot.r - 6 + a * 8, 0, TAU); ctx.stroke();
        }
      }
    },

    // Pannes sur le tissu (capot refermé) : un anneau qui pulse autour de la déchirure.
    drawExterior(ctx, time) {
      if (open || !rep.seamPhase) return;
      for (const it of items) {
        if (!it.exterior || !broken(it)) continue;
        const a = 0.5 + 0.5 * Math.sin(time * 5);
        ctx.strokeStyle = `rgba(255, 138, 61, ${0.35 + 0.5 * a})`;
        ctx.lineWidth = 8;
        ctx.beginPath(); ctx.arc(it.spot.x, it.spot.y, it.spot.r - 6 + a * 10, 0, TAU); ctx.stroke();
      }
    },

    // Le panneau, par-dessus tout le reste.
    drawPanel(ctx, time) {
      if (!open) return;
      const e = easeInOut(open.k);
      const sp = open.item.spot;
      ctx.save();
      ctx.fillStyle = `rgba(30, 22, 16, ${0.55 * e})`;
      ctx.fillRect(0, 0, W, H);
      const s = 0.15 + 0.85 * e;
      ctx.translate(sp.x + (PANEL.cx - sp.x) * e, sp.y + (PANEL.cy - sp.y) * e);
      ctx.scale(s, s);
      ctx.translate(-PANEL.cx, -PANEL.cy);
      const [pt, pb] = rectOf(open.item.type), pH = pb - pt;
      ctx.translate(0, shiftOf(open.item.type));
      ctx.globalAlpha = Math.min(1, e * 2);
      ctx.fillStyle = '#d9c3a3';
      roundRect(ctx, PANEL.x, pt + 12, PANEL.w, pH, 44); ctx.fill();
      ctx.fillStyle = C.paper;
      roundRect(ctx, PANEL.x, pt, PANEL.w, pH, 44); ctx.fill();
      ctx.strokeStyle = C.copper;
      ctx.lineWidth = 6;
      ctx.stroke();
      fitText(ctx, t('sec.title.' + open.item.type), PANEL.cx, pt + 56, PANEL.w - 220, 46, C.copperDark, 900);
      // croix pour refermer
      ctx.fillStyle = '#ead9c0';
      const cy0 = pt + 54;
      ctx.beginPath(); ctx.arc(CLOSE.x, cy0, CLOSE.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(CLOSE.x - 15, cy0 - 15); ctx.lineTo(CLOSE.x + 15, cy0 + 15); ctx.moveTo(CLOSE.x + 15, cy0 - 15); ctx.lineTo(CLOSE.x - 15, cy0 + 15); ctx.stroke();
      ctx.save();
      ctx.beginPath();
      roundRect(ctx, PANEL.x + 6, pt + 96, PANEL.w - 12, pH - 102, 38);
      ctx.clip();
      open.item.mod.draw(ctx, time);
      ctx.restore();
      // réussite : grosse coche verte
      if (open.success) {
        const k = 1 - open.success;
        const pop = 1 + 0.3 * Math.sin(Math.min(1, k * 3) * Math.PI);
        ctx.save();
        ctx.translate(PANEL.cx, PANEL.cy);
        ctx.scale(pop, pop);
        ctx.fillStyle = 'rgba(60, 191, 106, 0.92)';
        ctx.beginPath(); ctx.arc(0, 0, 110, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 24;
        ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(-50, 0); ctx.lineTo(-12, 40); ctx.lineTo(54, -36); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    },
  };
}
