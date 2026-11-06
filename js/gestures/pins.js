// Broches tordues — vue rapprochée.
// Pousser le bout de chaque broche tordue d'un petit trait de doigt : lâchée à tolerance° près de la
// verticale, elle se redresse (clic). Sinon elle garde son nouvel angle. De 1 à 4 broches.
import { C, roundRect } from '../ui.js';
import { demo } from '../tutorial.js';

const BASE_Y = 1060, L = 300, N = 6, X0 = 250, DX = 116;
const MAX_A = 1.0;

export function createPins(params, fx, { count } = {}) {
  const tol = (params.tolerance * Math.PI) / 180;
  const n = Math.max(1, Math.min(4, count || params.count));
  const pins = Array.from({ length: N }, (_, i) => ({ i, x: X0 + i * DX, a: 0, bent: false, ok: true, glow: 0 }));
  const order = pins.map((p) => p.i).sort(() => Math.random() - 0.5).slice(0, n);
  for (const i of order) {
    const p = pins[i];
    p.bent = true;
    p.ok = false;
    p.a = (Math.random() < 0.5 ? -1 : 1) * ((16 + Math.random() * 14) * Math.PI) / 180;
  }
  let drag = null;   // la broche tenue
  let done = false;

  const tip = (p, a = p.a) => ({ x: p.x + Math.sin(a) * L, y: BASE_Y - Math.cos(a) * L });

  function segDist(p, x, y) {
    const t = tip(p);
    const vx = t.x - p.x, vy = t.y - BASE_Y;
    const k = Math.max(0.35, Math.min(1, ((x - p.x) * vx + (y - BASE_Y) * vy) / (vx * vx + vy * vy)));
    return Math.hypot(x - (p.x + vx * k), y - (BASE_Y + vy * k));
  }

  return {
    get done() { return done; },
    get info() { return pins; },  // pour les tests automatiques

    down(x, y) {
      let best = null, bd = params.grab;
      for (const p of pins) {
        if (p.ok) continue;
        const d = segDist(p, x, y);
        if (d < bd) { bd = d; best = p; }
      }
      if (!best) return false;
      drag = best;
      fx.vibrate(8);
      return true;
    },

    move(x, y) {
      if (!drag || y > BASE_Y - 60) return;
      drag.a = Math.max(-MAX_A, Math.min(MAX_A, Math.atan2(x - drag.x, BASE_Y - y)));
    },

    up() {
      if (!drag) return;
      const p = drag;
      drag = null;
      if (Math.abs(p.a) <= tol) {
        fx.score(1 - 0.5 * Math.abs(p.a) / tol);
        p.a = 0;
        p.ok = true;
        p.glow = 1;
        fx.vibrate([10, 25]);
        const t = tip(p);
        fx.spawn(t.x, t.y, { count: 12, color: '#ffd36b', speed: 300, size: 6 });
        if (pins.every((q) => q.ok)) {
          done = true;
          fx.ok('sec.pins.done');
        } else fx.ok('sec.pins.ok');
      } else fx.info('sec.pins.miss');
    },

    update(dt) {
      for (const p of pins) p.glow = Math.max(0, p.glow - dt * 1.5);
    },

    hint() {
      return drag ? 'sec.pins.drag' : 'sec.pins';
    },

    sub(t) {
      return t('sec.pins.left', { n: pins.filter((p) => !p.ok).length });
    },

    demo() {
      const p = pins.find((q) => !q.ok);
      if (!p) return null;
      const a = tip(p), b = tip(p, 0);
      return demo.drag(a.x, a.y, b.x, b.y, 0.25, 0.7);
    },

    draw(ctx, time) {
      // prise du dessus : les trous où les broches doivent arriver
      ctx.fillStyle = '#2b2f36';
      roundRect(ctx, 180, BASE_Y - L - 120, 720, 100, 18); ctx.fill();
      for (const p of pins) {
        ctx.fillStyle = '#0b0f14';
        roundRect(ctx, p.x - 18, BASE_Y - L - 58, 36, 36, 6); ctx.fill();
      }
      // guide de la broche tenue
      if (drag) {
        const ok = Math.abs(drag.a) <= tol;
        ctx.fillStyle = ok ? 'rgba(60, 191, 106, 0.4)' : 'rgba(60, 191, 106, 0.18)';
        ctx.beginPath(); ctx.moveTo(drag.x, BASE_Y);
        ctx.arc(drag.x, BASE_Y, L + 30, -Math.PI / 2 - tol, -Math.PI / 2 + tol); ctx.closePath(); ctx.fill();
        ctx.save();
        ctx.setLineDash([14, 12]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(drag.x, BASE_Y); ctx.lineTo(drag.x, BASE_Y - L - 30); ctx.stroke();
        ctx.restore();
      }
      // broches
      ctx.lineCap = 'round';
      for (const p of pins) {
        const t = tip(p);
        if (p.glow > 0) {
          ctx.strokeStyle = `rgba(95, 224, 139, ${p.glow * 0.7})`;
          ctx.lineWidth = 40;
          ctx.beginPath(); ctx.moveTo(p.x, BASE_Y); ctx.lineTo(t.x, t.y); ctx.stroke();
        }
        ctx.strokeStyle = '#8f6a1e';
        ctx.lineWidth = 22;
        ctx.beginPath(); ctx.moveTo(p.x, BASE_Y); ctx.lineTo(t.x, t.y); ctx.stroke();
        ctx.strokeStyle = p === drag ? '#ffe08a' : '#e3b450';
        ctx.lineWidth = 14;
        ctx.beginPath(); ctx.moveTo(p.x, BASE_Y); ctx.lineTo(t.x, t.y); ctx.stroke();
        if (!p.ok && p !== drag) {
          const g = 0.5 + 0.5 * Math.sin(time * 6 + p.i);
          ctx.strokeStyle = `rgba(255, 138, 61, ${0.35 + 0.5 * g})`;
          ctx.lineWidth = 6;
          ctx.beginPath(); ctx.arc(t.x, t.y, 30 + 6 * g, 0, Math.PI * 2); ctx.stroke();
        }
      }
      // socle en plastique
      ctx.fillStyle = '#1f2937';
      roundRect(ctx, 180, BASE_Y - 10, 720, 80, 16); ctx.fill();
      for (const p of pins) {
        ctx.fillStyle = '#d9a441';
        ctx.fillRect(p.x - 16, BASE_Y - 16, 32, 26);
      }
      ctx.fillStyle = C.inkSoft;
    },
  };
}
