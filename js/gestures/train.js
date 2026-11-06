// Train d'engrenages — vue rapprochée (tortue horloge).
// Cinq engrenages de même pas (le nombre de dents suit la taille) attendent sur le plateau.
// Les cercles en pointillés, de la taille de chaque engrenage, forment une chaîne tirée au hasard
// où chaque cercle touche le suivant : posés, les engrenages s'emboîtent dent dans creux.
// Glisser chacun dans le cercle de sa taille, puis toucher Démarrer : tout le train tourne.
// Précision = 1 - 0,1 par mauvais cercle.
import { C, roundRect, fitText } from '../ui.js';
import { demo } from '../tutorial.js';
import { t } from '../i18n.js';

const TAU = Math.PI * 2;
const T = 18;                         // hauteur des dents
const BOX = { x0: 96, x1: 984, y0: 410, y1: 1068 };
const TRAY_Y = 1166, TRAY_S = 0.52;
const BTN = { x: 360, y: 1112, w: 360, h: 100 };
const LIFT = 100;
const GOLD = '#d9a441', GOLD_DARK = '#8f6a1e';

// Une chaîne de cercles qui se touchent, dans la boîte. On en tire plusieurs et on garde
// celle qui s'étale le mieux en largeur ET en hauteur, recentrée : elle remplit la fenêtre (pas de grand vide).
function makeChain(teeth, pitch) {
  const rho = (n) => (n * pitch) / TAU;
  let best = null;
  for (let tries = 0; tries < 400; tries++) {
    const order = teeth.slice().sort(() => Math.random() - 0.5);
    const out = [];
    let ok = true;
    for (let i = 0; i < order.length && ok; i++) {
      const n = order[i], p = rho(n), m = p + T / 2 + 10;
      let placed = false;
      for (let k = 0; k < 60 && !placed; k++) {
        let x, y, theta = 0;
        if (i === 0) {
          x = BOX.x0 + m + Math.random() * (BOX.x1 - BOX.x0 - 2 * m);
          y = BOX.y0 + m + Math.random() * (BOX.y1 - BOX.y0 - 2 * m);
        } else {
          const q = out[i - 1];
          theta = Math.random() * TAU;
          x = q.x + Math.cos(theta) * (q.p + p);
          y = q.y + Math.sin(theta) * (q.p + p);
        }
        if (x < BOX.x0 + m || x > BOX.x1 - m || y < BOX.y0 + m || y > BOX.y1 - m) continue;
        // seuls les voisins de chaîne se touchent : les autres restent bien à l'écart
        if (out.slice(0, Math.max(0, i - 1)).some((q) => Math.hypot(x - q.x, y - q.y) < q.p + p + T + 24)) continue;
        out.push({ x, y, n, p, theta, gear: null });
        placed = true;
      }
      if (!placed) ok = false;
    }
    if (!ok) continue;
    const x0 = Math.min(...out.map((s) => s.x - s.p)), x1 = Math.max(...out.map((s) => s.x + s.p));
    const y0 = Math.min(...out.map((s) => s.y - s.p)), y1 = Math.max(...out.map((s) => s.y + s.p));
    const fill = Math.min((x1 - x0) / (BOX.x1 - BOX.x0), (y1 - y0) / (BOX.y1 - BOX.y0));
    if (!best || fill > best.fill) best = { out, fill, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    if (tries > 120 && best) break;
  }
  const dx = (BOX.x0 + BOX.x1) / 2 - best.cx, dy = (BOX.y0 + BOX.y1) / 2 - best.cy;
  for (const s of best.out) { s.x += dx; s.y += dy; }
  // phase de chaque engrenage : ses dents tombent dans les creux du voisin
  best.out.forEach((s, i) => {
    if (i === 0) { s.phase = Math.random() * TAU; return; }
    const q = best.out[i - 1], wq = TAU / q.n, w = TAU / s.n;
    const f = ((((s.theta - q.phase) / wq) % 1) + 1) % 1;
    s.phase = s.theta + Math.PI - (0.5 - f) * w;
  });
  return best.out;
}

// Engrenage de même pas : rayon primitif p, n dents.
function drawTrainGear(ctx, x, y, p, n, angle, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const r0 = p - T / 2, r1 = p + T / 2, w = TAU / n;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a0 = angle + i * w;
    for (const [a, q] of [[a0 - w * 0.3, r0], [a0 - w * 0.16, r1], [a0 + w * 0.16, r1], [a0 + w * 0.3, r0]]) ctx.lineTo(Math.cos(a) * q, Math.sin(a) * q);
  }
  ctx.closePath();
  ctx.fillStyle = GOLD; ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = GOLD_DARK; ctx.stroke();
  ctx.fillStyle = GOLD_DARK; ctx.beginPath(); ctx.arc(0, 0, r0 * 0.55, 0, TAU); ctx.fill();
  ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(0, 0, r0 * 0.45, 0, TAU); ctx.fill();
  ctx.fillStyle = '#5b5f66'; ctx.beginPath(); ctx.arc(0, 0, Math.max(6, r0 * 0.15), 0, TAU); ctx.fill();
  ctx.restore();
}

export function createTrain(params, fx) {
  const teeth = params.teeth;
  const spots = makeChain(teeth, params.pitch);
  const rho = (n) => (n * params.pitch) / TAU;
  // plateau : rangés au hasard, chacun à sa vraie taille (réduite)
  const trayOrder = teeth.slice().sort(() => Math.random() - 0.5);
  const widths = trayOrder.map((n) => (rho(n) + T) * 2 * TRAY_S);
  const gap = (880 - widths.reduce((u, v) => u + v, 0)) / (teeth.length + 1);
  let cx = 100 + gap;
  const gears = trayOrder.map((n, i) => {
    const home = { x: cx + widths[i] / 2, y: TRAY_Y };
    cx += widths[i] + gap;
    return { n, p: rho(n), home, x: home.x, y: home.y, spot: null, a: Math.random() * TAU };
  });
  let drag = null, errors = 0, phase = 'place', spin = 0, done = false;
  const inBtn = (x, y) => x > BTN.x && x < BTN.x + BTN.w && y > BTN.y && y < BTN.y + BTN.h;

  return {
    get done() { return done; },
    // pour les tests automatiques : cercles et engrenages
    get dbg() { return { spots, gears, BTN }; },

    down(x, y) {
      if (phase === 'ready' && inBtn(x, y)) {
        phase = 'spin';
        spin = 0;
        fx.vibrate([10, 20, 30]);
        fx.ok('sec.train.ok');
        return;
      }
      if (phase !== 'place') return;
      const g = gears.find((q) => !q.spot && Math.hypot(x - q.x, y - q.y) < q.p * TRAY_S + 40);
      if (g) { drag = { g, fx: x, fy: y, lift: 0 }; fx.vibrate(8); }
    },

    move(x, y) { if (drag) { drag.fx = x; drag.fy = y; } },

    up() {
      if (!drag) return;
      const g = drag.g;
      drag = null;
      const sp = spots.filter((q) => !q.gear).sort((a, b) => Math.hypot(g.x - a.x, g.y - a.y) - Math.hypot(g.x - b.x, g.y - b.y))[0];
      if (sp && Math.hypot(g.x - sp.x, g.y - sp.y) < Math.max(params.snap_radius, sp.p * 0.8)) {
        if (sp.n === g.n) {
          sp.gear = g;
          g.spot = sp;
          g.x = sp.x; g.y = sp.y; g.a = sp.phase;
          fx.vibrate(25);
          fx.spawn(sp.x, sp.y, { count: 8, color: '#ffd36b', speed: 260, size: 6 });
          if (gears.every((q) => q.spot)) { phase = 'ready'; fx.score(Math.max(0, 1 - 0.1 * errors)); }
          return;
        }
        errors++;
        fx.vibrate([30, 40, 30]);
        fx.bad(g.n > sp.n ? 'sec.train.big' : 'sec.train.small');
      }
      g.x = g.home.x;
      g.y = g.home.y;
    },

    update(dt) {
      if (drag) {
        drag.lift += (LIFT - drag.lift) * Math.min(1, dt * 14);
        drag.g.x = drag.fx;
        drag.g.y = drag.fy - drag.lift;
      }
      if (phase === 'spin') { spin += dt; if (spin > 2) done = true; }
    },

    hint() {
      if (phase === 'spin') return 'sec.train.spin';
      if (phase === 'ready') return 'sec.train.ready';
      return 'sec.train';
    },

    sub(tr) {
      return tr('sec.train.placed', { n: gears.filter((g) => g.spot).length, total: gears.length });
    },

    // Gribouille : il porte le premier engrenage restant jusqu'à son cercle.
    demo() {
      if (phase === 'ready') return demo.tap(BTN.x + BTN.w / 2, BTN.y + BTN.h / 2);
      const g = gears.find((q) => !q.spot);
      if (!g || phase !== 'place') return null;
      const sp = spots.find((s) => s.n === g.n);
      return demo.drag(g.home.x, g.home.y, sp.x, sp.y + LIFT, 0.15, 1.0);
    },
    offset: () => [0, -LIFT],
    carry(c, x, y) {
      const g = gears.find((q) => !q.spot);
      if (g && phase === 'place') { c.save(); c.globalAlpha *= 0.85; drawTrainGear(c, x, y, g.p, g.n, g.a); c.restore(); }
    },

    draw(ctx) {
      ctx.fillStyle = '#e8dcc6';
      roundRect(ctx, 76, 400, 928, 676, 34); ctx.fill();
      ctx.lineWidth = 5; ctx.strokeStyle = '#b9a58a'; ctx.stroke();
      ctx.fillStyle = '#d9c3a3';
      roundRect(ctx, 76, 1086, 928, 160, 34); ctx.fill();
      for (const sp of spots) {
        if (sp.gear) continue;
        ctx.save();
        ctx.setLineDash([14, 12]);
        ctx.strokeStyle = 'rgba(91, 95, 102, 0.75)'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(sp.x, sp.y, sp.p + T / 2, 0, TAU); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = '#5b5f66';
        ctx.beginPath(); ctx.arc(sp.x, sp.y, 10, 0, TAU); ctx.fill();
      }
      // le train : chaque engrenage tourne en sens inverse de son voisin, au rapport des rayons
      const X = phase === 'spin' ? spin * 260 * Math.min(1, spin * 2) : 0;
      for (const g of gears) {
        if (drag && drag.g === g) continue;
        if (g.spot) { const i = spots.indexOf(g.spot); drawTrainGear(ctx, g.x, g.y, g.p, g.n, g.a + ((i % 2 ? -1 : 1) * X) / g.p); }
        else drawTrainGear(ctx, g.x, g.y, g.p, g.n, g.a, TRAY_S);
      }
      if (drag) {
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.25)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 18;
        drawTrainGear(ctx, drag.g.x, drag.g.y, drag.g.p, drag.g.n, drag.g.a);
        ctx.restore();
      }
      if (phase === 'ready') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        roundRect(ctx, BTN.x, BTN.y + 8, BTN.w, BTN.h, BTN.h / 2); ctx.fill();
        ctx.fillStyle = C.green;
        roundRect(ctx, BTN.x, BTN.y, BTN.w, BTN.h, BTN.h / 2); ctx.fill();
        fitText(ctx, t('sec.train.start'), BTN.x + BTN.w / 2, BTN.y + BTN.h / 2 + 2, BTN.w - 40, 44, '#fff', 900);
      }
    },
  };
}
