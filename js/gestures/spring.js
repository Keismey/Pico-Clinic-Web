// Ressort détendu — vue rapprochée.
// Tourner le doigt en rond autour du ressort : 3 tours à vitesse régulière, un clic à chaque tour.
// Trop vite : une jauge de risque monte ; pleine, le ressort saute (un tour perdu, -soin).
// Précision = part du temps passé à la bonne vitesse.
import { C, roundRect, fitText } from '../ui.js';
import { demo } from '../tutorial.js';
import { t } from '../i18n.js';

const TAU = Math.PI * 2;
const CX = 540, CY = 760, GUIDE = 230;

export function createSpring(params, fx) {
  const need = params.turns * TAU;
  let turned = 0;
  let rot = null;      // { last }
  let speed = 0;       // tours par seconde (lissé)
  let prev = 0;
  let risk = 0;
  let good = 0, total = 0;
  let lastTurn = 0;
  let jump = 0;
  let done = false;

  const progress = () => Math.min(1, Math.abs(turned) / need);

  return {
    get done() { return done; },

    down(x, y) {
      if (done) return false;
      const d = Math.hypot(x - CX, y - CY);
      if (d < 40 || d > 470) return false;
      rot = { last: Math.atan2(y - CY, x - CX) };
      fx.vibrate(8);
      return true;
    },

    move(x, y) {
      if (!rot) return;
      const d = Math.hypot(x - CX, y - CY);
      const a = Math.atan2(y - CY, x - CX);
      if (d < 40) { rot.last = a; return; }
      let da = a - rot.last;
      if (da > Math.PI) da -= TAU; else if (da < -Math.PI) da += TAU;
      rot.last = a;
      turned += da;
    },

    up() {
      rot = null;
    },

    update(dt) {
      jump = Math.max(0, jump - dt * 2);
      if (done || dt <= 0) return;
      const sp = Math.abs(turned - prev) / dt / TAU;
      prev = turned;
      speed += (sp - speed) * Math.min(1, dt * 8);
      if (!rot) { speed *= Math.max(0, 1 - dt * 6); risk = Math.max(0, risk - dt * params.risk_fall); return; }
      if (speed > 0.1) {
        total += dt;
        if (speed >= params.speed_min && speed <= params.speed_max) good += dt;
      }
      if (speed > params.speed_max) risk += dt * params.risk_rise;
      else risk = Math.max(0, risk - dt * params.risk_fall);
      if (risk >= 1) {
        // le ressort saute : on perd un tour
        risk = 0;
        rot = null;
        jump = 1;
        turned = Math.sign(turned) * Math.max(0, Math.abs(turned) - TAU);
        prev = turned;
        lastTurn = Math.floor(Math.abs(turned) / TAU);
        fx.care(params.risk_cost);
        fx.bad('sec.spring.jump');
        fx.vibrate([50, 30, 50]);
        fx.spawn(CX, CY, { count: 14, color: '#c9ced4', speed: 420, size: 7 });
        return;
      }
      const tn = Math.floor(Math.abs(turned) / TAU);
      if (tn > lastTurn) {
        lastTurn = tn;
        fx.vibrate(20);
        fx.spawn(CX + GUIDE, CY, { count: 8, color: '#ffd36b', speed: 260, size: 6 });
      } else if (tn < lastTurn) lastTurn = tn;
      if (progress() >= 1) {
        done = true;
        rot = null;
        fx.score(total > 0 ? Math.max(0.5, good / total) : 1);
        fx.vibrate([10, 20, 50]);
        fx.spawn(CX, CY, { count: 22, color: C.turquoise, speed: 420, size: 8 });
        fx.ok('sec.spring.ok');
      }
    },

    hint() {
      return risk > 0.3 ? 'sec.spring.slow' : 'sec.spring';
    },

    sub(tr) {
      return tr('sec.spring.turns', { n: Math.min(params.turns, Math.floor(Math.abs(turned) / TAU)), total: params.turns });
    },

    demo() {
      return done ? null : demo.circle(CX, CY, GUIDE, 1.25);
    },

    draw(ctx, time) {
      const p = progress();
      // cercle à suivre
      ctx.save();
      ctx.setLineDash([16, 14]);
      ctx.lineDashOffset = -time * 40;
      ctx.strokeStyle = rot ? 'rgba(37, 160, 141, 0.85)' : 'rgba(58, 42, 30, 0.3)';
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(CX, CY, GUIDE, 0, TAU); ctx.stroke();
      ctx.restore();
      // avancement : arc turquoise
      ctx.strokeStyle = C.turquoise;
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      if (p > 0) { ctx.beginPath(); ctx.arc(CX, CY, GUIDE + 34, -Math.PI / 2, -Math.PI / 2 + p * TAU); ctx.stroke(); }
      // le ressort (spirale vue de dessus) : lâche et irrégulier, puis serré et régulier
      const wob = jump * Math.sin(time * 40) * 20;
      const outer = 190 - p * 50 + wob;
      const inner = 40;
      const coils = 5;
      ctx.save();
      ctx.translate(CX, CY);
      ctx.rotate(turned);
      ctx.strokeStyle = '#6f7780';
      ctx.lineWidth = 18;
      ctx.beginPath();
      for (let k = 0; k <= 240; k++) {
        const f = k / 240;
        const a = f * coils * TAU;
        const loose = (1 - p) * Math.sin(f * 17) * 18;
        const r = inner + (outer - inner) * f + loose;
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.strokeStyle = p >= 1 ? '#e8eef4' : '#b9c2cc';
      ctx.lineWidth = 9;
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#5b5f66';
      ctx.beginPath(); ctx.arc(CX, CY, 26, 0, TAU); ctx.fill();
      // vitesse : lent / bien / trop vite
      const x = 200, y = 1110, w = 680, h = 34;
      const maxV = params.speed_max * 1.6;
      const zx = (v) => x + w * Math.min(1, v / maxV);
      ctx.fillStyle = '#e9b38a';
      roundRect(ctx, x, y, w, h, h / 2); ctx.fill();
      ctx.fillStyle = '#9fe0b4';
      ctx.fillRect(zx(params.speed_min), y, zx(params.speed_max) - zx(params.speed_min), h);
      ctx.fillStyle = risk > 0.5 ? '#f0a0a0' : '#f3c9a8';
      ctx.fillRect(zx(params.speed_max), y, x + w - h / 2 - zx(params.speed_max), h);
      const nx = zx(speed);
      ctx.fillStyle = C.ink;
      ctx.beginPath(); ctx.moveTo(nx, y - 6); ctx.lineTo(nx - 14, y - 26); ctx.lineTo(nx + 14, y - 26); ctx.closePath(); ctx.fill();
      ctx.fillRect(nx - 3, y - 6, 6, h + 12);
      if (risk > 0) {
        ctx.fillStyle = C.red;
        roundRect(ctx, x + w * 0.33, y - 60, w * 0.34 * Math.min(1, risk), 18, 9); ctx.fill();
      }
      fitText(ctx, t('op.speed.slow'), x + 60, y + h + 34, 200, 30, C.inkSoft, 700);
      fitText(ctx, t('op.speed.fast'), x + w - 60, y + h + 34, 200, 30, C.inkSoft, 700);
    },
  };
}
