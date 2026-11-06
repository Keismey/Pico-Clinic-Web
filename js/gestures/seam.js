// Couture déchirée — vue rapprochée (peluche). Se joue après les réparations, capot refermé :
// la déchirure est sur le tissu, à l'extérieur.
// Un seul trait en zigzag, sans lever le doigt, d'un trou à l'autre en suivant les pointillés ;
// après le dernier trou, on continue vers le haut pour tirer le fil : la déchirure se referme sous le doigt.
// Trop loin du chemin : le fil glisse et on reprend au dernier trou. Précision = moyenne des passages aux trous.
import { C, roundRect, fitText, easeInOut } from '../ui.js';
import { demo } from '../tutorial.js';
import { t } from '../i18n.js';

const TAU = Math.PI * 2;
const FAB = { x: 86, y: 500, w: 908, h: 650 };
const TY = 940, AMP = 84, X0 = 210, X1 = 870, TOP = 600;
const THREAD = '#3a6fd8';

export function createSeam(params, fx, { rank = 2, look = null } = {}) {
  const N = params.holes_by_rank[Math.max(1, Math.min(5, rank)) - 1];
  const TOL = params.tolerance;
  const body = (look && look.body) || '#f4a6c0';
  const trim = (look && look.trim) || '#c46a8a';
  const holes = [];
  for (let i = 0; i < N; i++) holes.push({ x: X0 + i * (X1 - X0) / (N - 1), y: TY + (i % 2 ? AMP : -AMP), best: Infinity });
  // chemin du fil (segments entre trous) et longueur cumulée
  const seg = [];
  let tot = 0;
  for (let i = 0; i < N - 1; i++) {
    const a = holes[i], b = holes[i + 1], l = Math.hypot(b.x - a.x, b.y - a.y);
    seg.push({ a, b, l, s0: tot });
    tot += l;
  }
  holes.forEach((h, i) => { h.s = i === 0 ? 0 : seg[i - 1].s0 + seg[i - 1].l; });
  const last = holes[N - 1];
  const reach = last.y - TOP;

  let s = 0, passed = 0, drag = false, offing = false, off = 0;
  let phase = 'sew', pull = 0, pullBase = 0, knot = 0, done = false;
  const marks = [];

  const at = (q) => {
    q = Math.max(0, Math.min(tot, q));
    const g = seg.find((z) => q <= z.s0 + z.l) || seg[seg.length - 1];
    const f = (q - g.s0) / g.l;
    return { x: g.a.x + (g.b.x - g.a.x) * f, y: g.a.y + (g.b.y - g.a.y) * f };
  };
  function project(x, y, lo, hi) {
    let best = { d: Infinity, s };
    for (let q = lo; q <= hi; q += 4) { const p = at(q), d = Math.hypot(x - p.x, y - p.y); if (d < best.d) best = { d, s: q }; }
    return best;
  }
  const needle = () => (phase === 'sew' ? at(s) : { x: last.x, y: last.y - pull * reach });

  return {
    get done() { return done; },

    down(x, y) {
      const n = needle();
      if (phase === 'sew' && Math.hypot(x - n.x, y - n.y) < 110) { drag = true; offing = false; off = 0; fx.vibrate(8); }
      else if (phase === 'pull' && Math.hypot(x - n.x, y - n.y) < 140) { drag = true; pullBase = y + pull * reach; }
    },

    move(x, y) {
      if (!drag) return;
      if (phase === 'sew') {
        const p = project(x, y, Math.max(0, s - 40), Math.min(tot, s + 160));
        if (p.d > TOL) { offing = true; return; }
        offing = false;
        off = 0;
        if (p.s > s) s = p.s;
        for (const h of holes) if (Math.abs(h.s - s) < 50) h.best = Math.min(h.best, Math.hypot(x - h.x, y - h.y));
        while (passed < N && s >= holes[passed].s - 6) {
          const h = holes[passed];
          if (passed > 0) {
            marks.push(Math.max(0, Math.min(1, 1 - (h.best === Infinity ? TOL : h.best) / TOL)));
            fx.vibrate(10);
            fx.spawn(h.x, h.y, { count: 5, color: '#ffffff', speed: 200, size: 5 });
          }
          passed++;
        }
        if (passed >= N) { phase = 'pull'; s = tot; pullBase = y; fx.vibrate(25); }
      } else if (phase === 'pull') {
        pull = Math.max(0, Math.min(1, (pullBase - y) / reach));
        if (pull >= 1) {
          phase = 'knot';
          drag = false;
          fx.vibrate([10, 20, 40]);
          fx.spawn(last.x, TY, { count: 16, color: THREAD, speed: 380, size: 7 });
        }
      }
    },

    up() { drag = false; offing = false; },

    update(dt) {
      if (phase === 'sew' && drag && offing) {
        off += dt;
        if (off > params.slip_time) {
          // le fil glisse : on reprend au dernier trou passé
          drag = false;
          offing = false;
          s = holes[Math.max(0, passed - 1)].s;
          fx.care(params.slip_cost);
          fx.bad('sec.seam.slip');
        }
      }
      if (phase === 'pull' && !drag && pull > 0) pull = Math.max(0, pull - dt * params.pull_fall);
      if (phase === 'knot' && !done) {
        knot += dt;
        if (knot > 0.5) {
          done = true;
          fx.score(marks.length ? marks.reduce((a, b) => a + b, 0) / marks.length : 1);
          fx.ok('sec.seam.ok');
        }
      }
    },

    hint() {
      if (phase === 'sew') return s === 0 ? 'sec.seam' : 'sec.seam.go';
      if (phase === 'pull') return 'sec.seam.pull';
      return 'sec.seam.knot';
    },

    sub(tr) {
      if (phase === 'sew') return tr('sec.seam.points', { n: Math.max(0, passed - 1), total: N - 1 });
      return tr('sec.seam.pulled', { p: Math.round(pull * 100) });
    },

    demo() {
      if (done) return null;
      if (phase === 'sew') return demo.path(holes.filter((h) => h.s >= s - 1).map((h) => [h.x, h.y]).concat([[last.x, TOP]]), 0.2, 300);
      if (phase === 'pull') { const n = needle(); return demo.drag(n.x, n.y, last.x, TOP - 20, 0.1, 0.9); }
      return null;
    },

    draw(ctx, time) {
      // tissu de la peluche (couleurs du patient)
      roundRect(ctx, FAB.x, FAB.y, FAB.w, FAB.h, 64);
      ctx.fillStyle = body; ctx.fill();
      ctx.lineWidth = 8; ctx.strokeStyle = trim; ctx.stroke();
      ctx.save();
      roundRect(ctx, FAB.x, FAB.y, FAB.w, FAB.h, 64); ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 16;
      for (let i = 0; i < 22; i++) { ctx.beginPath(); ctx.moveTo(100 + i * 52, FAB.y); ctx.lineTo(40 + i * 52, FAB.y + FAB.h); ctx.stroke(); }
      ctx.restore();

      const close = phase === 'sew' ? 0 : pull;
      const sq = 1 - 0.82 * easeInOut(close);
      const hp = (h) => ({ x: h.x, y: TY + (h.y - TY) * sq });
      // déchirure : bords écartés, rembourrage visible
      const gap = 70 * sq;
      const span = X1 - X0 + 80;
      if (gap > 12) {
        ctx.fillStyle = '#fff6ea';
        ctx.beginPath(); ctx.moveTo(X0 - 40, TY);
        for (let x = X0 - 40; x <= X1 + 40; x += 30) ctx.lineTo(x, TY - gap * 0.5 * Math.sin(Math.PI * (x - X0 + 40) / span) - Math.sin(x * 0.09) * 6);
        for (let x = X1 + 40; x >= X0 - 40; x -= 30) ctx.lineTo(x, TY + gap * 0.5 * Math.sin(Math.PI * (x - X0 + 40) / span) + Math.sin(x * 0.11) * 6);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#a24f70'; ctx.lineWidth = 6; ctx.stroke();
        ctx.fillStyle = 'rgba(230, 214, 196, 0.9)';
        for (let x = X0; x < X1; x += 70) { ctx.beginPath(); ctx.arc(x + 20, TY + Math.sin(x) * 8, 14 * sq, 0, TAU); ctx.fill(); }
      } else {
        ctx.strokeStyle = trim; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(X0 - 40, TY); ctx.lineTo(X1 + 40, TY); ctx.stroke();
      }
      // chemin à suivre (pointillés), comme la soudure
      if (phase === 'sew') {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'; ctx.lineWidth = 40; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.beginPath();
        const p0 = at(s); ctx.moveTo(p0.x, p0.y);
        for (const h of holes) if (h.s > s) ctx.lineTo(h.x, h.y);
        ctx.stroke();
        ctx.setLineDash([14, 14]); ctx.lineDashOffset = -time * 30;
        ctx.strokeStyle = 'rgba(58, 111, 216, 0.75)'; ctx.lineWidth = 6; ctx.stroke();
        ctx.restore();
      }
      // fil déjà cousu
      const n = needle();
      ctx.strokeStyle = THREAD; ctx.lineWidth = 10; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath();
      holes.forEach((h, i) => { if (i < passed) { const p = hp(h); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); } });
      if (phase === 'sew' && passed > 0) ctx.lineTo(n.x, n.y);
      ctx.stroke();
      // trous
      holes.forEach((h, i) => {
        const p = hp(h);
        ctx.beginPath(); ctx.arc(p.x, p.y, close > 0.6 ? 7 : 15, 0, TAU);
        ctx.fillStyle = i < passed ? THREAD : C.paper; ctx.fill();
        ctx.lineWidth = 4; ctx.strokeStyle = '#a24f70'; ctx.stroke();
      });
      if (phase !== 'sew') {
        // tirer : le fil monte jusqu'à une perle, une glissière se remplit, une flèche montre le haut
        const lp = hp(last);
        ctx.strokeStyle = THREAD; ctx.lineWidth = 10;
        ctx.beginPath(); ctx.moveTo(lp.x, lp.y); ctx.lineTo(n.x, n.y); ctx.stroke();
        if (phase === 'pull') {
          const gx = last.x + 80;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
          roundRect(ctx, gx - 16, TOP - 10, 32, reach + 20, 16); ctx.fill();
          ctx.fillStyle = C.green;
          roundRect(ctx, gx - 16, n.y - 10, 32, last.y - n.y + 20, 16); ctx.fill();
          fitText(ctx, t('sec.seam.pull_label'), gx - 20, TOP - 46, 260, 34, C.copperDark, 900);
          const a = 0.5 + 0.5 * Math.sin(time * 6), ay = n.y - 90 - a * 30;
          ctx.fillStyle = `rgba(255, 138, 61, ${0.6 + 0.4 * a})`;
          ctx.beginPath(); ctx.moveTo(n.x, ay - 40); ctx.lineTo(n.x - 36, ay + 10); ctx.lineTo(n.x + 36, ay + 10); ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = THREAD;
        ctx.beginPath(); ctx.arc(n.x, n.y, 26, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.stroke();
        if (phase === 'knot') {
          const k = Math.min(1, knot * 3);
          ctx.fillStyle = THREAD;
          ctx.beginPath(); ctx.arc(lp.x, lp.y, 12 + 14 * k, 0, TAU); ctx.fill();
        }
      } else {
        // aiguille
        ctx.save();
        ctx.translate(n.x, n.y); ctx.rotate(-0.7);
        ctx.strokeStyle = '#9aa3ad'; ctx.lineWidth = 11; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -120); ctx.stroke();
        ctx.lineWidth = 4; ctx.strokeStyle = '#6b7684';
        ctx.beginPath(); ctx.ellipse(0, -104, 5, 13, 0, 0, TAU); ctx.stroke();
        ctx.restore();
        if (!drag && s === 0) {
          const a = 0.5 + 0.5 * Math.sin(time * 6);
          ctx.strokeStyle = `rgba(63, 208, 187, ${0.4 + 0.6 * a})`; ctx.lineWidth = 7;
          ctx.beginPath(); ctx.arc(n.x, n.y, 44 + a * 10, 0, TAU); ctx.stroke();
        }
      }
    },
  };
}
