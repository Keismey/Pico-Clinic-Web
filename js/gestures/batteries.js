// Piles faibles — vue rapprochée.
// 1) Glisser deux piles neuves sur leurs bornes (même aimantation que les puces) : la vieille saute.
// 2) Frotter le panneau solaire du doigt jusqu'à clean_min de propreté.
import { C, roundRect } from '../ui.js';
import { demo } from '../tutorial.js';

const PW = 100, PH = 230;
const SLOTS = [{ x: 640, y: 580 }, { x: 790, y: 580 }];
const BOX = [{ x: 230, y: 580 }, { x: 360, y: 580 }];
const PANEL = { x: 180, y: 800, w: 720, h: 300 };

export function drawPile(ctx, x, y, { old = false, scale = 1, shadow = 0 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (shadow) { ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'; ctx.shadowBlur = 18 * shadow; ctx.shadowOffsetY = 10 * shadow; }
  ctx.fillStyle = '#c9ced4';
  roundRect(ctx, -18, -PH / 2 - 14, 36, 20, 6); ctx.fill();
  ctx.fillStyle = old ? '#8a8279' : '#3fd0bb';
  roundRect(ctx, -PW / 2, -PH / 2, PW, PH, 22); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = old ? '#6b645c' : '#25a08d';
  roundRect(ctx, -PW / 2, PH / 2 - 60, PW, 60, 22); ctx.fill();
  // niveau de charge
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  roundRect(ctx, -22, -70, 44, 100, 8); ctx.fill();
  ctx.fillStyle = old ? C.red : C.green;
  const lv = old ? 18 : 88;
  roundRect(ctx, -16, 24 - lv, 32, lv, 6); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '900 40px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('+', 0, -PH / 2 + 26);
  ctx.restore();
}

export function createBatteries(params, fx) {
  const slots = SLOTS.map((s) => ({ ...s, fresh: false }));
  const box = BOX.map((b) => ({ ...b, hx: b.x, hy: b.y, used: false }));
  const cells = [];
  for (let y = PANEL.y + params.cell / 2; y < PANEL.y + PANEL.h; y += params.cell) {
    for (let x = PANEL.x + params.cell / 2; x < PANEL.x + PANEL.w; x += params.cell) {
      const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const a = 0.45 + 0.5 * (v - Math.floor(v));
      cells.push({ x, y, a, a0: a });
    }
  }
  const total = cells.reduce((s, c) => s + c.a0, 0);
  let drag = null;     // { pile, fx, fy, offY } ou { rub: true, last }
  let speed = 0;
  let step = 'piles';
  let fly = [];        // vieilles piles qui sautent

  const cleaned = () => 1 - cells.reduce((s, c) => s + c.a, 0) / total;

  return {
    get done() { return step === 'done'; },

    down(x, y) {
      if (step === 'piles') {
        for (const b of box) {
          if (b.used) continue;
          if (Math.abs(x - b.x) < PW / 2 + params.grab_pad && Math.abs(y - b.y) < PH / 2 + params.grab_pad) {
            drag = { pile: b, fx: x, fy: y, offY: b.y - y };
            fx.vibrate(8);
            return true;
          }
        }
        return false;
      }
      if (step === 'panel' && x > PANEL.x - 40 && x < PANEL.x + PANEL.w + 40 && y > PANEL.y - 40 && y < PANEL.y + PANEL.h + 40) {
        drag = { rub: true, fx: x, fy: y, last: { x, y } };
        return true;
      }
      return false;
    },

    move(x, y) {
      if (drag) { drag.fx = x; drag.fy = y; }
    },

    up() {
      if (!drag) return;
      const d = drag;
      drag = null;
      if (!d.pile) return;
      const b = d.pile;
      let best = null, bd = params.snap_radius;
      for (const s of slots) {
        if (s.fresh) continue;
        const dd = Math.hypot(b.x - s.x, b.y - s.y);
        if (dd <= bd) { bd = dd; best = s; }
      }
      if (best) {
        best.fresh = true;
        b.used = true;
        fx.score(1 - bd / params.snap_radius);
        fly.push({ x: best.x, y: best.y, vx: 380 + Math.random() * 120, vy: -900, rot: 0, t: 0 });
        fx.vibrate([10, 20, 35]);
        fx.spawn(best.x, best.y - PH / 2, { count: 14, color: C.turquoise, speed: 360, size: 7 });
        if (slots.every((s) => s.fresh)) { step = 'panel'; fx.ok('sec.batteries.in'); } else fx.ok('sec.batteries.placed');
      } else {
        b.x = b.hx; b.y = b.hy;
        fx.info('sec.batteries.miss');
      }
    },

    update(dt) {
      for (const f of fly) { f.t += dt; f.vy += 2600 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += dt * 8; }
      fly = fly.filter((f) => f.t < 1.2);
      if (!drag || dt <= 0) return;
      if (drag.pile) {
        drag.offY += (-params.lift_offset - drag.offY) * Math.min(1, dt * 14);
        drag.pile.x = drag.fx;
        drag.pile.y = drag.fy + drag.offY;
        return;
      }
      // frotter le panneau
      const dd = Math.hypot(drag.fx - drag.last.x, drag.fy - drag.last.y);
      speed += (dd / dt - speed) * Math.min(1, dt * 10);
      drag.last = { x: drag.fx, y: drag.fy };
      if (speed < params.min_speed) return;
      const r = params.rub_radius;
      for (const c of cells) {
        if (c.a <= 0) continue;
        const d = Math.hypot(c.x - drag.fx, c.y - drag.fy);
        if (d > r + params.cell / 2) continue;
        c.a = Math.max(0, c.a - dd * params.rate * (d < r * 0.6 ? 1 : 0.5));
        if (c.a < 0.06) c.a = 0;
        if (c.a === 0 && Math.random() < 0.3) fx.spawn(c.x, c.y, { count: 2, color: '#a89a86', speed: 120, life: 0.35, size: 5, gravity: 0 });
      }
      if (cleaned() >= params.clean_min) {
        for (const c of cells) c.a = 0;
        step = 'done';
        drag = null;
        fx.vibrate([10, 20, 40]);
        fx.spawn(PANEL.x + PANEL.w / 2, PANEL.y + PANEL.h / 2, { count: 24, color: '#ffd36b', speed: 460, size: 8 });
        fx.ok('sec.batteries.ok');
      }
    },

    hint() {
      if (step === 'piles') return drag ? 'sec.batteries.drag' : 'sec.batteries';
      return 'sec.batteries.panel';
    },

    sub(t) {
      return step === 'piles' ? null : t('sec.dust', { p: Math.round(cleaned() * 100) });
    },

    offset() { return step === 'piles' ? [0, -params.lift_offset] : [0, 0]; },
    carry(ctx, x, y) { if (step === 'piles') drawPile(ctx, x, y); },
    demo() {
      if (step === 'piles') {
        const b = box.find((q) => !q.used);
        const s = slots.find((q) => !q.fresh);
        if (!b || !s) return null;
        return demo.drag(b.hx, b.hy + params.lift_offset, s.x, s.y + params.lift_offset, 0.25, 1.0);
      }
      if (step === 'panel') return demo.sweep(PANEL.x + PANEL.w / 2, PANEL.y + PANEL.h / 2, PANEL.w * 0.7, PANEL.h * 0.6);
      return null;
    },

    draw(ctx, time) {
      // boîte des piles neuves
      ctx.fillStyle = '#d9c3a3';
      roundRect(ctx, 150, 440, 290, 280, 24); ctx.fill();
      // support à piles avec bornes
      ctx.fillStyle = '#2b2f36';
      roundRect(ctx, 545, 430, 340, 300, 24); ctx.fill();
      for (const s of slots) {
        ctx.fillStyle = '#d9a441';
        ctx.fillRect(s.x - 22, s.y - PH / 2 - 26, 44, 10);
        ctx.strokeStyle = '#c9ced4';
        ctx.lineWidth = 5;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) ctx.lineTo(s.x + (k % 2 ? 14 : -14), s.y + PH / 2 + 4 + k * 4);
        ctx.stroke();
        if (s.fresh) drawPile(ctx, s.x, s.y);
        else {
          drawPile(ctx, s.x, s.y, { old: true });
          if (step === 'piles' && drag && drag.pile) {
            const a = 0.5 + 0.5 * Math.sin(time * 8);
            ctx.strokeStyle = `rgba(63, 208, 187, ${0.4 + 0.5 * a})`;
            ctx.lineWidth = 7;
            roundRect(ctx, s.x - PW / 2 - 12, s.y - PH / 2 - 12, PW + 24, PH + 24, 26); ctx.stroke();
          }
        }
      }
      for (const f of fly) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - f.t / 1.2);
        ctx.translate(f.x, f.y); ctx.rotate(f.rot);
        drawPile(ctx, 0, 0, { old: true, scale: 0.8 });
        ctx.restore();
      }
      // panneau solaire
      ctx.fillStyle = '#9aa3ad';
      roundRect(ctx, PANEL.x - 14, PANEL.y - 14, PANEL.w + 28, PANEL.h + 28, 18); ctx.fill();
      ctx.fillStyle = '#244a8a';
      ctx.fillRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h);
      ctx.strokeStyle = '#6f93d6';
      ctx.lineWidth = 3;
      for (let x = PANEL.x + 90; x < PANEL.x + PANEL.w; x += 90) { ctx.beginPath(); ctx.moveTo(x, PANEL.y); ctx.lineTo(x, PANEL.y + PANEL.h); ctx.stroke(); }
      for (let y = PANEL.y + 75; y < PANEL.y + PANEL.h; y += 75) { ctx.beginPath(); ctx.moveTo(PANEL.x, y); ctx.lineTo(PANEL.x + PANEL.w, y); ctx.stroke(); }
      if (step === 'done') {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.15 + 0.1 * Math.sin(time * 4)})`;
        ctx.fillRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h);
      }
      for (const c of cells) {
        if (c.a <= 0) continue;
        ctx.fillStyle = `rgba(150, 132, 108, ${c.a})`;
        ctx.beginPath(); ctx.arc(c.x, c.y, params.cell * 0.62, 0, Math.PI * 2); ctx.fill();
      }
      if (drag && drag.rub) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(drag.fx, drag.fy, params.rub_radius, 0, Math.PI * 2); ctx.stroke();
      }
      // piles neuves (dans la boîte ou tenues)
      for (const b of box) {
        if (b.used) continue;
        const held = drag && drag.pile === b;
        drawPile(ctx, b.x, b.y, { scale: held ? 1.06 : 1, shadow: held ? 1 : 0 });
      }
    },
  };
}
