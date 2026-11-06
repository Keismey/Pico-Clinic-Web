// Tutoriel : Gribouille montre chaque nouveau geste une seule fois (GDD 03-patients).
// Une « leçon » = une bulle de Gribouille + une main fantôme qui fait le geste en boucle.
// Elle commence quand start() devient vrai et se termine quand done() devient vrai.
// Les leçons vues sont rangées dans save.story (identifiants seulement).
import { t } from './i18n.js';
import { C, font, roundRect, wrapLines, fitText } from './ui.js';
import { drawGribouille } from './portraits.js';
import { save, persist } from './save.js';

const TAU = Math.PI * 2;
const CPS = 42; // lettres par seconde, comme au comptoir

export function seen(id) {
  return Array.isArray(save.story) && save.story.includes(id);
}

export function markSeen(id) {
  if (!Array.isArray(save.story)) save.story = [];
  if (!save.story.includes(id)) { save.story.push(id); persist(); }
}

// ---------- Démonstrations : suites d'images clés {t, x, y, d} (d = doigt appuyé) ----------

function kf(list) {
  const out = [];
  let tt = 0;
  for (const [dt, x, y, d] of list) { tt += dt; out.push({ t: tt, x, y, d }); }
  return { keys: out, dur: tt };
}

function guided(dm) {
  dm.guide = true;
  return dm;
}

export const demo = {
  // toucher un point
  tap(x, y) {
    return kf([[0, x + 70, y + 110, 0], [0.45, x, y, 0], [0.15, x, y, 1], [0.35, x, y, 1], [0.15, x, y, 0], [0.3, x, y, 0]]);
  },
  // tourner en rond autour d'un point
  circle(cx, cy, r, turns = 2) {
    const l = [[0, cx + r + 70, cy + 110, 0], [0.45, cx + r, cy, 0], [0.15, cx + r, cy, 1]];
    const n = Math.round(20 * turns);
    for (let i = 1; i <= n; i++) {
      const a = (i / n) * turns * TAU;
      l.push([1.1 / 20, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1]);
    }
    l.push([0.15, cx + r, cy, 0], [0.3, cx + r, cy, 0]);
    return kf(l);
  },
  // appuyer, glisser de a à b, lâcher
  drag(ax, ay, bx, by, hold = 0.25, dur = 1.0) {
    return guided(kf([[0, ax + 70, ay + 110, 0], [0.45, ax, ay, 0], [0.15, ax, ay, 1], [hold, ax, ay, 1],
      [dur, bx, by, 1], [0.25, bx, by, 1], [0.15, bx, by, 0], [0.3, bx, by, 0]]));
  },
  // appuyer, attendre (hold), puis suivre un chemin de points
  path(pts, hold = 0.2, speed = 220, guide = true) {
    const [x0, y0] = pts[0];
    const l = [[0, x0 + 70, y0 + 110, 0], [0.45, x0, y0, 0], [0.15, x0, y0, 1], [hold, x0, y0, 1]];
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      l.push([d / speed, pts[i][0], pts[i][1], 1]);
    }
    const [xn, yn] = pts[pts.length - 1];
    l.push([0.2, xn, yn, 1], [0.15, xn, yn, 0], [0.3, xn, yn, 0]);
    return guide ? guided(kf(l)) : kf(l);
  },
  // frotter en zigzag sur une zone
  sweep(cx, cy, w, h) {
    const pts = [];
    for (let i = 0; i <= 6; i++) pts.push([cx + (i % 2 ? w / 2 : -w / 2), cy - h / 2 + (i / 6) * h]);
    return this.path(pts, 0.1, 700, false);
  },
};

// Position de la main à l'instant tt (la démonstration tourne en boucle).
function sample(dm, tt) {
  const k = dm.keys;
  const time = tt % dm.dur;
  for (let i = 1; i < k.length; i++) {
    if (k[i].t >= time) {
      const a = k[i - 1], b = k[i];
      const f = (time - a.t) / Math.max(1e-6, b.t - a.t);
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, d: b.d && a.d ? 1 : 0, time, dur: dm.dur };
    }
  }
  const l = k[k.length - 1];
  return { x: l.x, y: l.y, d: l.d, time, dur: dm.dur };
}

// Main fantôme : une main gantée blanche, l'index pointé sur (x, y).
// Dessinée d'un seul contour (doigts repliés, pouce, manchette turquoise), avec une ombre douce.
function handPath(ctx) {
  ctx.beginPath();
  ctx.moveTo(-15, 22);
  ctx.arc(0, 15, 15, Math.PI, 0);                     // bout de l'index
  ctx.lineTo(15, 60);
  ctx.quadraticCurveTo(29, 44, 44, 60);               // majeur replié
  ctx.quadraticCurveTo(58, 52, 68, 70);               // annulaire
  ctx.quadraticCurveTo(84, 66, 86, 88);               // auriculaire
  ctx.quadraticCurveTo(92, 112, 78, 132);             // tranche de la main
  ctx.quadraticCurveTo(46, 146, 12, 134);             // poignet
  ctx.quadraticCurveTo(-16, 120, -34, 92);            // pouce
  ctx.quadraticCurveTo(-44, 74, -28, 70);
  ctx.quadraticCurveTo(-18, 70, -15, 82);
  ctx.closePath();
}

export function drawHand(ctx, x, y, { press = 0, alpha = 1, time = 0 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  // onde sous le doigt quand il appuie
  if (press) {
    for (let i = 0; i < 2; i++) {
      const p = (time * 1.8 + i / 2) % 1;
      ctx.strokeStyle = `rgba(255, 138, 61, ${0.85 * (1 - p)})`;
      ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(x, y, 18 + p * 60, 0, TAU); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255, 138, 61, 0.45)';
    ctx.beginPath(); ctx.arc(x, y, 20, 0, TAU); ctx.fill();
  }
  ctx.translate(x, y);
  ctx.rotate(-0.42);
  // le doigt s'enfonce un peu quand il appuie
  const s = 1.25 * (press ? 0.93 : 1);
  ctx.scale(s, s);
  ctx.translate(0, press ? 4 : -4);
  // manchette
  ctx.fillStyle = '#3fd0bb';
  ctx.strokeStyle = '#25a08d';
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(4, 128); ctx.quadraticCurveTo(44, 142, 84, 126);
  ctx.lineTo(90, 162); ctx.quadraticCurveTo(46, 180, 2, 164);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // main : ombre puis gant blanc
  ctx.save();
  ctx.shadowColor = 'rgba(58, 42, 30, 0.35)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetX = 6;
  ctx.shadowOffsetY = 10;
  handPath(ctx);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
  handPath(ctx);
  ctx.strokeStyle = '#3a2a1e';
  ctx.lineWidth = 5;
  ctx.stroke();
  // plis des doigts et du gant
  ctx.strokeStyle = 'rgba(58, 42, 30, 0.45)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(44, 62); ctx.quadraticCurveTo(44, 76, 40, 86);
  ctx.moveTo(68, 72); ctx.quadraticCurveTo(68, 84, 64, 92);
  ctx.moveTo(15, 64); ctx.quadraticCurveTo(18, 80, 14, 92);
  ctx.moveTo(-6, 4); ctx.quadraticCurveTo(0, 0, 6, 4);
  ctx.stroke();
  // reflet
  ctx.strokeStyle = 'rgba(63, 208, 187, 0.35)';
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(-6, 26); ctx.lineTo(-6, 52); ctx.stroke();
  ctx.restore();
}

// Chemin pointillé que suit le doigt pendant l'appui, avec une flèche au bout.
function drawGuide(ctx, dm, [ox, oy], time) {
  const pts = dm.keys.filter((k) => k.d);
  if (pts.length < 2) return;
  const a = pts[0], z = pts[pts.length - 1];
  if (Math.hypot(z.x - a.x, z.y - a.y) < 30) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([2, 22]);
  ctx.lineDashOffset = -time * 30;
  ctx.beginPath();
  pts.forEach((k, i) => (i ? ctx.lineTo(k.x + ox, k.y + oy) : ctx.moveTo(k.x + ox, k.y + oy)));
  ctx.stroke();
  // flèche
  const y1 = pts[pts.length - 2];
  const ang = Math.atan2(z.y - y1.y, z.x - y1.x);
  ctx.setLineDash([]);
  ctx.translate(z.x + ox, z.y + oy);
  ctx.rotate(ang);
  ctx.beginPath(); ctx.moveTo(-26, -18); ctx.lineTo(0, 0); ctx.lineTo(-26, 18); ctx.stroke();
  ctx.restore();
}

// Cercle qui pulse autour de ce qu'il faut regarder.
export function drawRing(ctx, x, y, r, time, color = '255, 138, 61') {
  const a = 0.5 + 0.5 * Math.sin(time * 6);
  ctx.save();
  ctx.strokeStyle = `rgba(${color}, ${0.45 + 0.55 * a})`;
  ctx.lineWidth = 9;
  ctx.setLineDash([22, 14]);
  ctx.lineDashOffset = -time * 40;
  ctx.beginPath(); ctx.arc(x, y, r + a * 12, 0, TAU); ctx.stroke();
  ctx.restore();
}

// ---------- Bulle de Gribouille ----------

// Panneau avec Gribouille à gauche et son texte qui s'écrit. r = {x, y, w, h}.
// Texte à 44 px logiques (16 px à l'écran sur un téléphone de 390 px) ; s'il ne tient pas, il descend jusqu'à 36 au plus bas.
export function drawGribBox(ctx, r, text, shown, time, { sub = null, more = false, size = 44, reserve = 0 } = {}) {
  const talk = shown < text.length;
  ctx.fillStyle = '#d9c3a3';
  roundRect(ctx, r.x, r.y + 10, r.w, r.h, 40); ctx.fill();
  ctx.fillStyle = C.paper;
  roundRect(ctx, r.x, r.y, r.w, r.h, 40); ctx.fill();
  ctx.strokeStyle = '#6b7684';
  ctx.lineWidth = 5;
  ctx.stroke();
  // étiquette du nom
  const name = t('name.gribouille');
  ctx.font = font(32, 900);
  const nw = ctx.measureText(name).width + 56;
  ctx.fillStyle = '#6b7684';
  roundRect(ctx, r.x + 34, r.y - 30, nw, 60, 30); ctx.fill();
  fitText(ctx, name, r.x + 34 + nw / 2, r.y + 1, nw - 30, 32, '#fff', 900);
  // Gribouille
  const hop = talk ? Math.abs(Math.sin(time * 8)) * 8 : 0;
  const gs = Math.min(0.5, (r.h - 40) / 280);
  drawGribouille(ctx, r.x + 96, r.y + r.h / 2 + 14 - hop, gs, { time, talk });
  // texte
  const tx = r.x + 190, tw = r.w - 230;
  // le texte rétrécit un peu s'il ne tient pas dans la bulle
  let lines, lh;
  for (;;) {
    ctx.font = font(size, 700);
    lines = wrapLines(ctx, text, tw);
    lh = size * 1.22;
    if (size <= 36 || lines.length * lh + (sub ? 50 : 0) <= r.h - reserve - 56) break;
    size -= 2;
  }
  const block = lines.length * lh + (sub ? 50 : 0);
  let y = r.y + (r.h - reserve) / 2 - block / 2 + lh / 2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.ink;
  let left = Math.floor(shown);
  for (const line of lines) {
    if (left > 0) ctx.fillText(line.slice(0, left), tx, y);
    left -= line.length + 1;
    y += lh;
  }
  if (sub) fitText(ctx, sub, tx + tw / 2, y + 6, tw, 36, C.inkSoft, 700);
  // flèche « toucher pour continuer »
  if (more && !talk && Math.sin(time * 6) > -0.3) {
    ctx.fillStyle = C.orange;
    const x = r.x + r.w - 50, yy = r.y + r.h - 40;
    ctx.beginPath(); ctx.moveTo(x - 16, yy - 9); ctx.lineTo(x + 16, yy - 9); ctx.lineTo(x, yy + 11); ctx.closePath(); ctx.fill();
  }
}

// ---------- Suite de leçons pendant un geste ----------
// lessons : [{ id, key: string | () => string, start(), done(), demo?() → démonstration, ring?() → {x, y, r}, praise?,
//   always? (montrée même si la commande est déjà connue), shift?() → dy (décalage vertical de la fenêtre), offset?() → [dx, dy] (où se trouve l'outil par rapport au doigt), carry?(ctx, x, y) (outil fantôme dessiné là) }]
// remember = false (atelier d'essai) : les leçons sont toujours montrées et jamais notées comme vues.
// Rappel : après remindAfter secondes sans toucher l'écran, Gribouille remontre le geste attendu,
// pris dans reminders (toutes les leçons, déjà vues ou non) : la première qui a commencé sans être finie
// et que remindOk() accepte. Le rappel disparaît dès que le joueur touche l'écran.
export function createCoach(lessons, { enabled = true, remember = true, reminders = [], remindAfter = 0, remindOk = () => true } = {}) {
  // always : leçon d'un nouvel outil, montrée même sur une commande déjà réussie
  const list = lessons.filter((l) => (enabled || l.always) && (!remember || !seen(l.id)));
  const mark = (id) => { if (remember) markSeen(id); };
  let i = 0;
  let cur = null;       // leçon affichée
  let praise = null;    // { key, t } : bravo de Gribouille après la leçon
  let shown = 0;
  let lastKey = '';
  let time = 0;
  let idle = 99;        // temps depuis que le doigt s'est levé
  let touching = false;
  let still = 0;        // temps sans aucun toucher (rappel)
  let reminding = false; // la leçon affichée est un rappel

  function text() {
    if (praise) return t(praise.key);
    if (!cur) return '';
    return t(typeof cur.key === 'function' ? cur.key() : cur.key);
  }

  return {
    get active() { return !!(cur || praise); },
    // une vraie leçon (pas un rappel) est affichée : le chrono attend
    get teaching() { return !!((cur && !reminding) || praise); },
    get reminding() { return reminding && !!cur; },
    get lesson() { return cur ? cur.id : null; },
    has(id) { return list.some((l) => l.id === id) && (!remember || !seen(id)); },

    touch(type) {
      still = 0;
      if (type === 'down') {
        touching = true;
        if (reminding) { cur = null; reminding = false; }
      } else if (type === 'up' || type === 'cancel') { touching = false; idle = 0; }
    },

    update(dt) {
      time += dt;
      idle += dt;
      if (!touching) still += dt;
      if (praise) {
        praise.t -= dt;
        if (praise.t <= 0) praise = null;
      }
      // rappel devenu inutile (geste fait, ou plus d'actualité)
      if (cur && reminding && (cur.done() || !cur.start() || !remindOk(cur))) { cur = null; reminding = false; }
      // leçon en cours terminée ?
      if (cur && cur.done()) {
        mark(cur.id);
        if (cur.praise) praise = { key: cur.praise, t: 1.8 };
        cur = null;
        i++;
      }
      // leçon suivante (on saute celles que le joueur a déjà faites tout seul)
      while (!cur && !praise && i < list.length) {
        const l = list[i];
        if (l.done()) { mark(l.id); i++; continue; }
        if (l.start()) { cur = l; idle = 99; }
        break;
      }
      // rien depuis remindAfter secondes : Gribouille remontre le geste attendu
      if (!cur && !praise && remindAfter > 0 && still >= remindAfter) {
        const l = reminders.find((q) => q.start() && !q.done() && remindOk(q));
        if (l) { cur = l; reminding = true; idle = 99; }
      }
      const k = text();
      if (k !== lastKey) { lastKey = k; shown = 0; }
      shown = Math.min(k.length, shown + CPS * dt);
    },

    // Texte de Gribouille (ou null s'il se tait).
    text() {
      return this.active ? text() : null;
    },
    get shown() { return shown; },
    get time() { return time; },

    // Main fantôme et cercle : cachés pendant que le joueur essaie, revenus 1,5 s après.
    draw(ctx) {
      if (!cur) return;
      const sh = cur.shift ? cur.shift() : 0; // fenêtre de vue rapprochée recentrée
      ctx.save();
      ctx.translate(0, sh);
      this.drawIn(ctx);
      ctx.restore();
    },
    drawIn(ctx) {
      const ring = cur.ring && cur.ring();
      if (ring) drawRing(ctx, ring.x, ring.y, ring.r, time);
      const dm = cur.demo && cur.demo();
      if (!dm || touching || idle < 1.5) return;
      const p = sample(dm, time);
      const alpha = Math.min(1, p.time / 0.3, (p.dur - p.time) / 0.3);
      const off = cur.offset ? cur.offset() : [0, 0];
      // chemin à suivre, pièce transportée (fantôme), puis la main
      if (dm.guide) drawGuide(ctx, dm, off, time);
      if (cur.carry && p.d) {
        ctx.save();
        ctx.globalAlpha = 0.7 * alpha;
        cur.carry(ctx, p.x + off[0], p.y + off[1], p);
        ctx.restore();
      }
      drawHand(ctx, p.x, p.y, { press: p.d, alpha, time });
    },
  };
}
