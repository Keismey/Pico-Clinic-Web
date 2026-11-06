// V3b — Décorations de l'atelier (cosmétiques, GDD 02-progression) : achetées à la boutique,
// elles apparaissent au comptoir. Chaque objet est dessiné centré en (0, 0) ; PLACE = sa place dans l'atelier.
import { game } from './state.js';
import { save, persist } from './save.js';
import { roundRect } from './ui.js';
import { drawRarePart } from './portraits.js';

const TAU = Math.PI * 2;

export function decoList() {
  return game.data.decorations || [];
}
export function hasDeco(id) {
  return (save.deco || []).includes(id);
}
// 'owned', 'rank', 'money' ou 'ok'
export function decoState(d) {
  if (hasDeco(d.id)) return 'owned';
  if (save.rank < (d.rank || 1)) return 'rank';
  if (save.credits < d.price) return 'money';
  return 'ok';
}
export function buyDeco(d) {
  if (decoState(d) !== 'ok') return false;
  save.credits -= d.price;
  save.deco = [...(save.deco || []), d.id];
  persist();
  return true;
}

// Décorations de prestige (rang 5) : modèles déjà réparés (polaroïds), dans l'ordre des commandes.
function repairedLooks() {
  const seen = new Set(), out = [];
  for (const o of game.data.orders || []) {
    const r = save.orders[o.id];
    if (!r || !r.paid || seen.has(o.model)) continue;
    seen.add(o.model);
    const m = game.data.patients[o.model];
    if (m && m.look) out.push(m.look);
  }
  return out;
}

// Un petit patient tout rond (photo, robot) : corps, deux yeux, une joue.
function tinyFace(ctx, x, y, r, body, accent) {
  ctx.fillStyle = body;
  roundRect(ctx, x - r, y - r * 0.8, r * 2, r * 1.6, r * 0.5); ctx.fill();
  ctx.fillStyle = '#1f2937';
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(x + sx * r * 0.38, y - r * 0.1, r * 0.17, 0, TAU); ctx.fill(); }
  ctx.fillStyle = accent;
  ctx.beginPath(); ctx.arc(x, y + r * 0.42, r * 0.16, 0, TAU); ctx.fill();
}

const DRAW = {
  lamp(ctx, time) {
    // lampe d'établi articulée
    ctx.fillStyle = '#3a4150';
    roundRect(ctx, -40, 70, 80, 22, 8); ctx.fill();
    ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 10; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 74); ctx.lineTo(-24, -10); ctx.lineTo(20, -70); ctx.stroke();
    ctx.fillStyle = 'rgba(255, 220, 140, 0.35)';
    ctx.beginPath(); ctx.moveTo(-6, -46); ctx.lineTo(-60, 70); ctx.lineTo(40, 70); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.translate(20, -70); ctx.rotate(0.6);
    ctx.fillStyle = '#e0453a';
    ctx.beginPath(); ctx.moveTo(-34, 30); ctx.lineTo(-14, -14); ctx.lineTo(14, -14); ctx.lineTo(34, 30); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff2b0';
    ctx.beginPath(); ctx.ellipse(0, 30, 30, 9, 0, 0, TAU); ctx.fill();
    ctx.restore();
  },
  plant(ctx, time) {
    const sway = Math.sin(time * 1.2) * 0.05;
    ctx.fillStyle = '#c47a3c';
    ctx.beginPath(); ctx.moveTo(-40, 20); ctx.lineTo(40, 20); ctx.lineTo(30, 90); ctx.lineTo(-30, 90); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8f5426'; ctx.fillRect(-44, 14, 88, 14);
    for (const [a, l, c] of [[-0.6, 90, '#3a9d6a'], [-0.2, 120, '#5fbf7f'], [0.25, 110, '#3a9d6a'], [0.65, 85, '#7cc68a'], [0, 70, '#2f8a5b']]) {
      ctx.save(); ctx.translate(0, 18); ctx.rotate(a + sway);
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.ellipse(0, -l / 2, 18, l / 2, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
  },
  poster(ctx) {
    ctx.fillStyle = '#fff7ec';
    roundRect(ctx, -75, -100, 150, 200, 8); ctx.fill();
    ctx.strokeStyle = '#c9b291'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#5fb8e8';
    roundRect(ctx, -60, -85, 120, 110, 6); ctx.fill();
    // petit drone dessiné sur l'affiche
    ctx.fillStyle = '#3fd0bb'; roundRect(ctx, -22, -44, 44, 34, 8); ctx.fill();
    ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 4;
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 22, -36); ctx.lineTo(sx * 44, -56); ctx.stroke(); ctx.beginPath(); ctx.ellipse(sx * 44, -58, 14, 4, 0, 0, TAU); ctx.stroke(); }
    ctx.fillStyle = '#e0453a'; ctx.fillRect(-50, 40, 100, 12);
    ctx.fillStyle = '#c9b291'; ctx.fillRect(-50, 62, 70, 8); ctx.fillRect(-50, 78, 84, 8);
    ctx.fillStyle = '#8f5426';
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * 62, -88, 5, 0, TAU); ctx.fill(); }
  },
  rug(ctx) {
    // tapis d'établi vert sous les patients
    ctx.fillStyle = '#2f8a5b';
    roundRect(ctx, -230, -16, 460, 32, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3;
    for (let x = -200; x <= 200; x += 40) { ctx.beginPath(); ctx.moveTo(x, -12); ctx.lineTo(x, 12); ctx.stroke(); }
  },
  hanging_drone(ctx, time) {
    const swing = Math.sin(time * 1.4) * 0.08;
    ctx.save(); ctx.rotate(swing);
    ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -110); ctx.lineTo(0, -20); ctx.stroke();
    ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 10; ctx.lineCap = 'round';
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(sx * 42, sy * 26); ctx.stroke(); }
    ctx.fillStyle = '#ffd166'; roundRect(ctx, -26, -18, 52, 36, 10); ctx.fill();
    ctx.fillStyle = '#ff8a3d';
    const a = time * 12;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.beginPath(); ctx.ellipse(sx * 42, sy * 26 - 8, 22 * Math.abs(Math.cos(a + sx)), 5, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
  },
  aquarium(ctx, time) {
    ctx.fillStyle = '#8f5426'; roundRect(ctx, -88, 50, 176, 16, 6); ctx.fill();
    ctx.fillStyle = 'rgba(95, 184, 232, 0.55)'; roundRect(ctx, -82, -60, 164, 112, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#e6d4b6'; ctx.fillRect(-80, 34, 160, 16);
    // poisson mécanique qui fait des allers-retours
    const fx = Math.sin(time * 0.8) * 46, dir = Math.cos(time * 0.8) >= 0 ? 1 : -1;
    ctx.save(); ctx.translate(fx, -8 + Math.sin(time * 2) * 6); ctx.scale(dir, 1);
    ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.ellipse(0, 0, 26, 15, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(-40, -12); ctx.lineTo(-40, 12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#aeb6c0'; ctx.beginPath(); ctx.arc(-6, 0, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.arc(14, -4, 4, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let k = 0; k < 3; k++) { const y = 30 - ((time * 30 + k * 30) % 90); ctx.beginPath(); ctx.arc(50 + k * 6, y, 5 - k, 0, TAU); ctx.fill(); }
  },
  neon_sign(ctx, time) {
    // cadre lumineux autour de l'enseigne : ampoules qui s'allument à tour de rôle
    const on = Math.floor(time * 3);
    ctx.strokeStyle = 'rgba(63, 208, 187, 0.55)'; ctx.lineWidth = 10;
    roundRect(ctx, -230, -62, 460, 124, 28); ctx.stroke();
    for (let k = 0; k < 14; k++) {
      const x = -210 + k * (420 / 13);
      for (const y of [-62, 62]) {
        const lit = (k + (y > 0 ? 1 : 0) + on) % 2 === 0;
        ctx.fillStyle = lit ? '#fff2b0' : '#c9a24a';
        ctx.beginPath(); ctx.arc(x, y, lit ? 9 : 7, 0, TAU); ctx.fill();
      }
    }
  },
  gear_clock(ctx, time) {
    ctx.fillStyle = '#c9a24a';
    ctx.beginPath();
    for (let k = 0; k < 24; k++) { const a = (k / 24) * TAU, r = k % 2 ? 46 : 54; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff7ec'; ctx.beginPath(); ctx.arc(0, 0, 38, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3a2a1e'; ctx.lineCap = 'round';
    const d = new Date();
    const m = (d.getMinutes() + d.getSeconds() / 60) / 60, h = ((d.getHours() % 12) + m) / 12;
    ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(h * TAU) * 20, -Math.cos(h * TAU) * 20); ctx.stroke();
    ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(m * TAU) * 30, -Math.cos(m * TAU) * 30); ctx.stroke();
    ctx.fillStyle = '#8f5426'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill();
    // petit engrenage qui tourne à côté
    ctx.save(); ctx.translate(52, 40); ctx.rotate(time);
    ctx.fillStyle = '#a8822a';
    ctx.beginPath();
    for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU, r = k % 2 ? 16 : 21; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  },
  rare_showcase(ctx, time, shop) {
    // vitrine éclairée : les pièces rares gagnées, 4 × 3 (cases vides tant qu'elles manquent)
    ctx.fillStyle = '#8f5426'; roundRect(ctx, -88, 52, 176, 18, 6); ctx.fill();
    ctx.fillStyle = '#6b3f1c'; roundRect(ctx, -82, -66, 164, 120, 10); ctx.fill();
    ctx.fillStyle = '#fff3d6'; roundRect(ctx, -74, -58, 148, 104, 6); ctx.fill();
    const parts = game.data.rareParts || [];
    parts.slice(0, 12).forEach((p, i) => {
      const x = -54 + (i % 4) * 36, y = -38 + Math.floor(i / 4) * 32;
      const own = shop ? i % 3 !== 2 : (save.rare_parts || []).includes(p.id);
      if (own) drawRarePart(ctx, p.id, x, y, 13, true, time);
      else { ctx.fillStyle = 'rgba(122, 99, 80, 0.18)'; ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fill(); }
    });
    // vitre et reflet qui passe
    ctx.fillStyle = 'rgba(159, 245, 231, 0.18)'; roundRect(ctx, -74, -58, 148, 104, 6); ctx.fill();
    const k = (time * 0.25) % 1.6;
    if (k < 1) {
      ctx.save(); roundRect(ctx, -74, -58, 148, 104, 6); ctx.clip();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      const x = -110 + k * 220;
      ctx.beginPath(); ctx.moveTo(x, -60); ctx.lineTo(x + 22, -60); ctx.lineTo(x - 8, 48); ctx.lineTo(x - 30, 48); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(0, -66, 6, 0, TAU); ctx.fill();
  },
  polaroids(ctx, time, shop) {
    // guirlande de photos des modèles déjà réparés (6 au plus, les plus anciens d'abord)
    const looks = shop
      ? [{ body: '#3fd0bb', accent: '#ff8a3d' }, { body: '#ffd166', accent: '#e0453a' }, { body: '#8bc34a', accent: '#c47a3c' }]
      : repairedLooks().slice(0, 6);
    const n = shop ? 3 : 6, span = shop ? 220 : 300;
    ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-span / 2 - 10, -40); ctx.quadraticCurveTo(0, -10, span / 2 + 10, -40); ctx.stroke();
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0.5 : i / (n - 1);
      const x = -span / 2 + u * span, y = -40 + 30 * (1 - Math.pow(2 * u - 1, 2)) * 0.98;
      const lk = looks[i];
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(time * 1.1 + i * 1.7) * 0.06 + (i % 2 ? 0.08 : -0.08));
      if (!lk) {
        // emplacement libre : juste la pince à linge
        ctx.fillStyle = '#c9a24a'; ctx.fillRect(-4, -6, 8, 14);
        ctx.restore(); continue;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(-23, 2, 50, 60);
      ctx.fillStyle = '#fffdf7'; ctx.fillRect(-26, -2, 52, 62);
      ctx.fillStyle = '#cfe8f3'; ctx.fillRect(-21, 3, 42, 40);
      tinyFace(ctx, 0, 24, 14, lk.body, lk.accent || '#ff8a3d');
      ctx.fillStyle = '#c9a24a'; ctx.fillRect(-4, -8, 8, 14);
      ctx.restore();
    }
  },
  firefly_jar(ctx, time) {
    // petite étagère murale et bocal de lucioles-drones lumineuses
    ctx.fillStyle = '#8f5426'; roundRect(ctx, -52, 58, 104, 14, 5); ctx.fill();
    ctx.fillStyle = '#6b3f1c'; ctx.beginPath(); ctx.moveTo(-34, 72); ctx.lineTo(-34, 92); ctx.lineTo(-18, 72); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(34, 72); ctx.lineTo(34, 92); ctx.lineTo(18, 72); ctx.closePath(); ctx.fill();
    const glow = ctx.createRadialGradient(0, 10, 4, 0, 10, 70);
    glow.addColorStop(0, 'rgba(255, 236, 140, 0.35)'); glow.addColorStop(1, 'rgba(255, 236, 140, 0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 10, 70, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(200, 236, 245, 0.45)'; roundRect(ctx, -38, -48, 76, 106, 22); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#c47a3c'; roundRect(ctx, -32, -62, 64, 18, 6); ctx.fill();
    for (let k = 0; k < 5; k++) {
      const x = Math.sin(time * (0.9 + k * 0.23) + k * 2.1) * 22;
      const y = 6 + Math.cos(time * (0.7 + k * 0.19) + k) * 34;
      const on = 0.55 + 0.45 * Math.sin(time * 3 + k * 1.3);
      ctx.fillStyle = `rgba(255, 236, 140, ${0.35 * on})`; ctx.beginPath(); ctx.arc(x, y, 11, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(255, 214, 90, ${0.6 + 0.4 * on})`; ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      const fl = Math.abs(Math.sin(time * 30 + k));
      for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + sx * 6, y - 4, 5 * fl + 1, 2.5, sx * 0.5, 0, TAU); ctx.fill(); }
    }
  },
  robot(ctx, time) {
    // petit robot assis : toutes les 7 s, il fait coucou et ses yeux clignent
    const c = time % 7, wave = c < 1.6 ? Math.sin((c / 1.6) * Math.PI * 4) : 0, blink = c > 3 && c < 3.15;
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(0, 50, 46, 7, 0, 0, TAU); ctx.fill();
    // jambes qui pendent
    ctx.strokeStyle = '#6b7684'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 14, 40); ctx.lineTo(sx * 16, 62 + Math.sin(time * 2 + sx) * 3); ctx.stroke(); }
    ctx.fillStyle = '#c47a3c'; roundRect(ctx, -30, 4, 60, 44, 12); ctx.fill();
    ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(0, 26, 7, 0, TAU); ctx.fill();
    // bras gauche posé, bras droit qui fait coucou
    ctx.strokeStyle = '#6b7684'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(-30, 14); ctx.lineTo(-40, 40); ctx.stroke();
    const a = -0.4 - (c < 1.6 ? 1.6 : 0) + wave * 0.35;
    ctx.beginPath(); ctx.moveTo(30, 14); ctx.lineTo(30 + Math.cos(a) * 30, 14 + Math.sin(a) * 30 + (c < 1.6 ? 0 : 38)); ctx.stroke();
    ctx.fillStyle = '#9aa3ad'; ctx.beginPath(); ctx.arc(30 + Math.cos(a) * 30, 14 + Math.sin(a) * 30 + (c < 1.6 ? 0 : 38), 7, 0, TAU); ctx.fill();
    // tête et antenne
    ctx.strokeStyle = '#6b7684'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, -36); ctx.lineTo(0, -50); ctx.stroke();
    ctx.fillStyle = c < 1.6 ? '#ff8a3d' : '#3fd0bb'; ctx.beginPath(); ctx.arc(0, -52, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3fd0bb'; roundRect(ctx, -32, -38, 64, 44, 14); ctx.fill();
    ctx.fillStyle = '#1f2937'; roundRect(ctx, -24, -30, 48, 28, 9); ctx.fill();
    ctx.fillStyle = '#9ff5e7';
    for (const sx of [-1, 1]) {
      if (blink) ctx.fillRect(sx * 10 - 6, -17, 12, 3);
      else { ctx.beginPath(); ctx.arc(sx * 10, -16, 5, 0, TAU); ctx.fill(); }
    }
  },
};

// Place dans l'atelier : [x, y, échelle] ; wall = dessiné sur le mur, sinon sur le comptoir.
const PLACE = {
  poster: [120, 520, 1, 'wall'],
  aquarium: [120, 760, 1, 'wall'],
  gear_clock: [555, 455, 0.8, 'wall'],
  hanging_drone: [555, 320, 0.9, 'wall'],
  lamp: [1010, 607, 0.9, 'wall'],
  neon_sign: [290, 304, 1, 'wall'],
  rug: [840, 995, 1, 'counter'],
  plant: [585, 905, 0.9, 'counter'],
  // prestige (rang 5)
  polaroids: [732, 180, 1, 'wall'],
  robot: [975, 168, 1, 'wall'],
  firefly_jar: [534, 600, 0.85, 'wall'],
  rare_showcase: [92, 918, 0.92, 'counter'],
};

// Objet seul (boutique) : centré en (x, y), agrandi de s.
// shop = vignette de la boutique (polaroïds et vitrine d'exemple, avant l'achat).
export function drawDeco(ctx, id, x, y, s = 1, time = 0, shop = false) {
  if (!DRAW[id]) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  DRAW[id](ctx, time, shop);
  ctx.restore();
}

// Toutes les décorations achetées, au mur ('wall') ou sur le comptoir ('counter').
// Ordre de dessin fixe (de l'arrière vers l'avant), quel que soit l'ordre d'achat :
// le drone suspendu passe par-dessus l'enseigne lumineuse.
const LAYER = ['neon_sign', 'poster', 'aquarium', 'gear_clock', 'lamp', 'hanging_drone', 'polaroids', 'robot', 'firefly_jar', 'rug', 'plant', 'rare_showcase'];

export function drawOwnedDecos(ctx, where, time = 0) {
  const owned = save.deco || [];
  for (const id of LAYER.filter((d) => owned.includes(d))) {
    const p = PLACE[id];
    if (p && p[3] === where) drawDeco(ctx, id, p[0], p[1], p[2], time);
  }
}

// Petite vignette pour la boutique (taille à peu près égale pour tous).
export const ICON_SCALE = { lamp: 0.8, plant: 0.8, poster: 0.6, rug: 0.32, hanging_drone: 1.1, aquarium: 0.75, neon_sign: 0.3, gear_clock: 1.1, rare_showcase: 0.8, polaroids: 0.72, firefly_jar: 0.9, robot: 1.05 };
