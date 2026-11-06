// Circuit oxydé — vue rapprochée.
// Nettoyage fin au pinceau d'une zone dense en petits composants fragiles : le pinceau flotte
// au-dessus du doigt. Chaque contact avec un composant coûte cost points de propreté (et encore
// toutes les repeat s si on reste dessus) ; au break_hits-ième, il se fêle et doit être changé
// (comme les condensateurs) : le glisser dans le bac, puis poser un neuf (payé en crédits).
// Fini à clean_min, sans composant fêlé.
import { C, roundRect } from '../ui.js';
import { demo } from '../tutorial.js';

const TAU = Math.PI * 2;
const COMPS = [];
for (let r = 0; r < 4; r++) {
  for (let c = 0; c < 5; c++) {
    COMPS.push({ x: 260 + c * 140 + (r % 2 ? 40 : 0), y: 520 + r * 165, w: r % 2 ? 30 : 74, h: r % 2 ? 74 : 30 });
  }
}
const BLOBS = [[330, 600, 95], [620, 760, 115], [460, 930, 95], [770, 590, 85], [740, 1010, 85]];
const BANDS = ['#d64545', '#3a2a1e', '#ff8a3d', '#3f7fd6'];
const BIN = { x: 240, y: 1182 };     // bac à composants fêlés
const SPARE = { x: 840, y: 1182 };   // composants neufs

function hash(a, b) {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

export function createOxide(params, fx, { cost = 5 } = {}) {
  const comps = COMPS.filter((c) => c.x < 900).map((c) => ({ ...c, inside: false, t: 0, hits: 0, cracked: false, removed: false, held: false, hurt: 0 }));
  const near = (x, y) => comps.some((c) => Math.abs(x - c.x) < c.w / 2 + 12 && Math.abs(y - c.y) < c.h / 2 + 12);
  const cells = [];
  const cs = params.cell;
  for (const [bx, by, br] of BLOBS) {
    for (let y = by - br; y <= by + br; y += cs) {
      for (let x = bx - br; x <= bx + br; x += cs) {
        const d = Math.hypot(x - bx, y - by);
        if (d > br * (0.7 + 0.3 * hash(x, y)) || near(x, y)) continue;
        if (cells.some((c) => c.x === x && c.y === y)) continue;
        const a = 0.6 + 0.4 * hash(y, x);
        cells.push({ x, y, a, a0: a });
      }
    }
  }
  const total = cells.reduce((s, c) => s + c.a0, 0);
  let drag = null;   // pinceau : { fx, fy, last }
  let part = null;   // composant tenu : { comp, what: 'old' | 'new', x, y, fx, fy, offY }
  let speed = 0;
  let done = false;
  const pos = { x: 0, y: 0 };

  const cleaned = () => 1 - cells.reduce((s, c) => s + c.a, 0) / total;
  const toFix = () => comps.filter((c) => c.cracked);
  const waiting = () => comps.find((c) => c.removed);

  function finish() {
    if (done || cleaned() < params.clean_min || toFix().length) return;
    for (const c of cells) c.a = 0;
    done = true;
    drag = null;
    fx.vibrate([10, 20, 40]);
    fx.spawn(540, 780, { count: 24, color: '#5fe08b', speed: 460, size: 8 });
    fx.ok('sec.oxide.ok');
  }

  function overlaps(x, y, r, c) {
    const nx = Math.max(c.x - c.w / 2, Math.min(x, c.x + c.w / 2));
    const ny = Math.max(c.y - c.h / 2, Math.min(y, c.y + c.h / 2));
    return Math.hypot(x - nx, y - ny) <= r;
  }

  // Démo de Gribouille : un zigzag sur l'oxyde où le pinceau ne touche aucun composant.
  function clear(x, y) {
    return !comps.some((c) => !c.removed && overlaps(x, y, params.radius + 3, c));
  }
  function segClear(a, b) {
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 6));
    for (let i = 0; i <= n; i++) {
      if (!clear(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n)) return false;
    }
    return true;
  }
  let sweepCache = null; // { cell, pts } : recalculé quand sa tache d'oxyde est nettoyée
  function safeSweep() {
    if (sweepCache && sweepCache.cell && sweepCache.cell.a > 0) return sweepCache.pts;
    const dirty = cells.filter((q) => q.a > 0);
    if (sweepCache && !sweepCache.cell && sweepCache.left === dirty.length) return null;
    for (const [w, h] of [[120, 80], [100, 50], [80, 30], [120, 0], [70, 0], [40, 0]]) {
      for (const c of dirty) {
        const pts = [];
        for (let i = 0; i <= 6; i++) pts.push([c.x + (i % 2 ? w / 2 : -w / 2), c.y - h / 2 + (i / 6) * h]);
        if (pts.every((p, i) => i === 0 || segClear(pts[i - 1], p))) {
          sweepCache = { cell: c, pts };
          return pts;
        }
      }
    }
    sweepCache = { cell: null, pts: null, left: dirty.length }; // rien de sûr : pas de démo
    return null;
  }

  return {
    get done() { return done; },

    down(x, y) {
      if (done) return false;
      // composant fêlé (on le touche directement) ou composant neuf dans la boîte
      for (const c of comps) {
        if (!c.cracked || c.removed) continue;
        if (Math.abs(x - c.x) < c.w / 2 + 34 && Math.abs(y - c.y) < c.h / 2 + 34) {
          part = { comp: c, what: 'old', x: c.x, y: c.y, fx: x, fy: y, offY: c.y - y };
          c.held = true;
          fx.vibrate(8);
          return true;
        }
      }
      const w = waiting();
      if (w && Math.hypot(x - SPARE.x, y - SPARE.y) < 90) {
        part = { comp: w, what: 'new', x: SPARE.x, y: SPARE.y, fx: x, fy: y, offY: SPARE.y - y };
        fx.vibrate(8);
        return true;
      }
      drag = { fx: x, fy: y, last: { x, y: y - params.offset_y } };
      pos.x = x; pos.y = y - params.offset_y;
      return true;
    },

    move(x, y) {
      if (drag) { drag.fx = x; drag.fy = y; }
      if (part) { part.fx = x; part.fy = y; }
    },

    up() {
      drag = null;
      if (!part) return;
      const { comp, what, x, y } = part;
      part = null;
      comp.held = false;
      if (what === 'old') {
        if (Math.hypot(x - BIN.x, y - BIN.y) < 120) {
          comp.removed = true;
          fx.vibrate([15, 30, 15]);
          fx.info('sec.oxide.binned');
        } else fx.info('sec.oxide.to_bin');
        return;
      }
      let spot = null, best = 60;
      for (const c of comps) {
        if (!c.removed) continue;
        const d = Math.hypot(x - c.x, y - c.y);
        if (d <= best) { best = d; spot = c; }
      }
      if (spot) {
        spot.removed = false;
        spot.cracked = false;
        spot.hits = 0;
        fx.part();
        fx.vibrate([10, 20, 35]);
        fx.spawn(spot.x, spot.y, { count: 16, color: C.turquoise, speed: 360, size: 7 });
        fx.ok('sec.oxide.new', { n: cost });
        finish();
      } else fx.info('sec.oxide.miss');
    },

    update(dt) {
      for (const c of comps) c.hurt = Math.max(0, c.hurt - dt * 2);
      if (part) {
        part.offY += (-90 - part.offY) * Math.min(1, dt * 14);
        part.x = part.fx;
        part.y = part.fy + part.offY;
      }
      if (!drag || done || dt <= 0) return;
      pos.x = drag.fx;
      pos.y = drag.fy - params.offset_y;
      const dd = Math.hypot(pos.x - drag.last.x, pos.y - drag.last.y);
      speed += (dd / dt - speed) * Math.min(1, dt * 10);
      drag.last = { x: pos.x, y: pos.y };
      const r = params.radius;
      // composants touchés : chaque contact coûte de la propreté, le 3e fêle le composant
      for (const c of comps) {
        if (c.cracked || c.removed || !overlaps(pos.x, pos.y, r * 0.8, c)) { c.inside = false; continue; }
        if (c.inside) { c.t += dt; if (c.t < params.repeat) continue; }
        c.inside = true;
        c.t = 0;
        c.hits++;
        c.hurt = 1;
        fx.care(params.cost);
        fx.vibrate([50, 30, 50]);
        fx.spawn(c.x, c.y, { count: 8, color: '#fff3a6', speed: 260, life: 0.35, size: 5 });
        if (c.hits >= params.break_hits) {
          c.cracked = true;
          fx.bad('sec.oxide.broken', { n: cost });
          fx.spawn(c.x, c.y - 10, { count: 4, color: '#6b6f75', speed: 70, life: 1.0, size: 12, gravity: -120, kind: 'smoke', dir: -Math.PI / 2, spread: 1 });
        } else fx.bad('sec.oxide.hit', { n: params.cost, left: params.break_hits - c.hits });
      }
      if (speed < params.min_speed) return;
      for (const c of cells) {
        if (c.a <= 0) continue;
        const d = Math.hypot(c.x - pos.x, c.y - pos.y);
        if (d > r + cs / 2) continue;
        c.a = Math.max(0, c.a - dd * params.rate * (d < r * 0.6 ? 1 : 0.5));
        if (c.a < 0.06) c.a = 0;
      }
      if (cleaned() >= params.clean_min) {
        for (const c of cells) c.a = 0;
        finish();
      }
    },

    hint() {
      if (part) return part.what === 'old' ? 'sec.oxide.to_bin' : 'sec.oxide.place';
      if (comps.some((c) => c.cracked && !c.removed)) return 'sec.oxide.replace';
      if (waiting()) return 'sec.oxide.place';
      return 'sec.oxide';
    },

    sub(t) {
      return t('sec.oxide.left', { p: Math.round(cleaned() * 100) });
    },

    offset() { return [0, -params.offset_y]; },
    carry(ctx, x, y) { drawBrush(ctx, x, y, params.radius, params.offset_y); },
    tutoKey() { return toFix().length ? 'tuto.sec.oxide3' : 'tuto.sec.oxide2'; },
    demo() {
      if (done) return null;
      const pts = safeSweep();
      if (!pts) return null;
      return demo.path(pts.map(([x, y]) => [x, y + params.offset_y]), 0.1, 700, false);
    },

    draw(ctx, time) {
      // carte
      ctx.fillStyle = '#2f8a5b';
      roundRect(ctx, 150, 420, 780, 690, 30); ctx.fill();
      ctx.strokeStyle = '#d9a441';
      ctx.lineWidth = 7;
      for (const c of comps) {
        ctx.beginPath();
        if (c.w > c.h) { ctx.moveTo(c.x - c.w / 2 - 22, c.y); ctx.lineTo(c.x + c.w / 2 + 22, c.y); } else { ctx.moveTo(c.x, c.y - c.h / 2 - 22); ctx.lineTo(c.x, c.y + c.h / 2 + 22); }
        ctx.stroke();
      }
      // oxydation vert-de-gris
      for (const c of cells) {
        if (c.a <= 0) continue;
        ctx.fillStyle = `rgba(110, 196, 170, ${c.a * 0.9})`;
        ctx.beginPath(); ctx.arc(c.x, c.y, cs * 0.7, 0, TAU); ctx.fill();
      }
      // petits composants fragiles (rouges quand on les touche, gris et fêlés au 3e contact)
      for (const c of comps) {
        if (c.removed) {
          // emplacement vide : pastilles et cadre qui clignote
          const a = 0.5 + 0.5 * Math.sin(time * 6);
          ctx.save();
          ctx.setLineDash([8, 7]);
          ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 + 0.5 * a})`;
          ctx.lineWidth = 4;
          roundRect(ctx, c.x - c.w / 2 - 6, c.y - c.h / 2 - 6, c.w + 12, c.h + 12, 10); ctx.stroke();
          ctx.restore();
          continue;
        }
        if (c.held) continue;
        drawResistor(ctx, c.x, c.y, c.w, c.h, c.cracked, c.hurt);
        if (c.cracked) {
          const a = 0.5 + 0.5 * Math.sin(time * 6);
          ctx.strokeStyle = `rgba(255, 138, 61, ${0.4 + 0.5 * a})`;
          ctx.lineWidth = 5;
          roundRect(ctx, c.x - c.w / 2 - 10, c.y - c.h / 2 - 10, c.w + 20, c.h + 20, 12); ctx.stroke();
        } else if (c.hits > 0) {
          // points rouges : contacts déjà subis
          for (let k = 0; k < c.hits; k++) {
            ctx.fillStyle = C.red;
            ctx.beginPath(); ctx.arc(c.x - 10 + k * 20, c.y - c.h / 2 - 14, 7, 0, TAU); ctx.fill();
          }
        }
        if (c.inside && !c.cracked) {
          const a = 0.5 + 0.5 * Math.sin(time * 14);
          ctx.strokeStyle = `rgba(214, 69, 69, ${0.5 + 0.5 * a})`;
          ctx.lineWidth = 5;
          roundRect(ctx, c.x - c.w / 2 - 8, c.y - c.h / 2 - 8, c.w + 16, c.h + 16, 12); ctx.stroke();
        }
      }
      // bac (fêlés) et boîte de composants neufs
      const anyCracked = comps.some((c) => c.cracked && !c.removed) || (part && part.what === 'old');
      const a = 0.5 + 0.5 * Math.sin(time * 6);
      ctx.fillStyle = '#6b7684';
      roundRect(ctx, BIN.x - 80, BIN.y - 44, 160, 88, 16); ctx.fill();
      ctx.fillStyle = '#4a525c';
      roundRect(ctx, BIN.x - 66, BIN.y - 30, 132, 60, 10); ctx.fill();
      ctx.strokeStyle = '#d64545'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(BIN.x - 16, BIN.y - 14); ctx.lineTo(BIN.x + 16, BIN.y + 14); ctx.moveTo(BIN.x + 16, BIN.y - 14); ctx.lineTo(BIN.x - 16, BIN.y + 14); ctx.stroke();
      if (anyCracked) {
        ctx.strokeStyle = `rgba(255, 138, 61, ${0.4 + 0.5 * a})`; ctx.lineWidth = 6;
        roundRect(ctx, BIN.x - 90, BIN.y - 54, 180, 108, 20); ctx.stroke();
      }
      ctx.fillStyle = '#d9c3a3';
      roundRect(ctx, SPARE.x - 80, SPARE.y - 44, 160, 88, 16); ctx.fill();
      if (waiting() && !(part && part.what === 'new')) {
        ctx.fillStyle = `rgba(63, 208, 187, ${0.25 + 0.3 * a})`;
        ctx.beginPath(); ctx.arc(SPARE.x, SPARE.y, 62, 0, TAU); ctx.fill();
        drawResistor(ctx, SPARE.x, SPARE.y, 74, 30, false, 0);
      }
      // pièce tenue
      if (part) {
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 8;
        const c = part.comp;
        drawResistor(ctx, part.x, part.y, c.w * 1.1, c.h * 1.1, part.what === 'old', 0);
        ctx.restore();
      }
      if (drag) drawBrush(ctx, pos.x, pos.y, params.radius, params.offset_y, true);
    },
  };
}

// Petite résistance (beige à bandes), grise et fêlée si abîmée, rougie quand on vient de la toucher.
function drawResistor(ctx, x, y, w, h, cracked, hurt) {
  ctx.fillStyle = cracked ? '#8d8a84' : hurt > 0 ? `rgb(230, ${Math.round(120 + 80 * (1 - hurt))}, 100)` : '#e8d6b0';
  roundRect(ctx, x - w / 2, y - h / 2, w, h, 10); ctx.fill();
  ctx.strokeStyle = '#8f6a1e';
  ctx.lineWidth = 3;
  ctx.stroke();
  for (let k = 0; k < 3; k++) {
    ctx.fillStyle = BANDS[(k + Math.round(x / 140)) % BANDS.length];
    if (w > h) ctx.fillRect(x - 20 + k * 16, y - h / 2 + 3, 7, h - 6);
    else ctx.fillRect(x - w / 2 + 3, y - 20 + k * 16, w - 6, 7);
  }
  if (cracked) {
    ctx.strokeStyle = '#2b2f33';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x - w / 2 + 4, y - h / 2 + 4); ctx.lineTo(x - 4, y + 3); ctx.lineTo(x + 6, y - 4); ctx.lineTo(x + w / 2 - 4, y + h / 2 - 4);
    ctx.stroke();
  }
}

// Pinceau fin : la pointe en (x, y), le manche descend jusqu'au doigt.
function drawBrush(ctx, x, y, r, off, active = false) {
  ctx.save();
  ctx.strokeStyle = '#8f5426';
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y + r + 26); ctx.lineTo(x, y + off + 20); ctx.stroke();
  ctx.fillStyle = '#c9ced4';
  ctx.fillRect(x - 11, y + r - 4, 22, 34);
  ctx.fillStyle = '#f4e9d8';
  ctx.beginPath(); ctx.moveTo(x - 12, y + r); ctx.quadraticCurveTo(x - 14, y - r * 0.6, x, y - r); ctx.quadraticCurveTo(x + 14, y - r * 0.6, x + 12, y + r); ctx.closePath(); ctx.fill();
  if (active) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = C.ink;
}
