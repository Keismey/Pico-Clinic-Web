// Mécanisme à clé — vue rapprochée (chat à clé).
// Poser le doigt sur la clé et tourner en rond sans lâcher : le ressort spirale se serre et la jauge
// en arc monte (le son monte avec). Tourner dans l'autre sens la fait redescendre.
// S'arrêter dans la zone verte, puis toucher Tester. Le rouge force le ressort (-soin).
// Précision = proximité du centre du vert, moins un quart par essai raté.
import { C, roundRect, fitText } from '../ui.js';
import { demo } from '../tutorial.js';
import { t } from '../i18n.js';
import { tone, toneStop } from '../feedback.js';

const TAU = Math.PI * 2;
const CX = 540, CY = 780, DRUM = 215, GR = 300;
const A0 = Math.PI * 0.75, SW = Math.PI * 1.5;     // jauge en arc, de 7 h 30 à 4 h 30
const BTN = { x: 360, y: 1124, w: 360, h: 96 };
const GOLD = '#d9a441', GOLD_DARK = '#8f6a1e';

export function createKey(params, fx, { rank = 3 } = {}) {
  const r = Math.max(1, Math.min(5, rank));
  const w = params.green_by_rank[r - 1];
  const g0 = r >= 4 ? 0.35 + Math.random() * 0.4 : params.green_start;
  const RED = params.red;
  let ten = 0, rot = null, fails = 0, phase = 'wind', run = 0, done = false;
  let shake = 0, inRed = false, lastStep = 0, keyA = 0;

  const zoneOf = (v) => (v >= RED ? 'red' : v >= g0 && v <= g0 + w ? 'green' : v > g0 + w ? 'high' : 'low');
  const inBtn = (x, y) => x > BTN.x && x < BTN.x + BTN.w && y > BTN.y && y < BTN.y + BTN.h;

  function test() {
    const z = zoneOf(ten);
    if (z === 'green') {
      phase = 'run';
      fx.vibrate([10, 20, 40]);
      fx.ok('sec.key.ok');
      fx.score(Math.max(0, 1 - 0.25 * fails - (Math.abs(ten - (g0 + w / 2)) / w) * 0.3));
      return;
    }
    fails++;
    fx.vibrate([30, 40, 30]);
    fx.bad(z === 'low' ? 'sec.key.weak' : 'sec.key.tight');
  }

  return {
    get done() { return done; },

    down(x, y) {
      if (phase !== 'wind') return;
      if (ten > 0 && inBtn(x, y)) { test(); return; }
      const d = Math.hypot(x - CX, y - CY);
      if (d > 40 && d < 430) { rot = { last: Math.atan2(y - CY, x - CX) }; fx.vibrate(8); }
    },

    move(x, y) {
      if (!rot) return;
      const a = Math.atan2(y - CY, x - CX);
      let da = a - rot.last;
      if (da > Math.PI) da -= TAU; else if (da < -Math.PI) da += TAU;
      rot.last = a;
      if (Math.hypot(x - CX, y - CY) < 30) return;
      const before = ten;
      // plus c'est tendu, plus c'est dur à remonter ; redescendre reste facile
      ten = Math.max(0, Math.min(1, ten + (da / (params.turns * TAU)) * (da > 0 ? 1 - 0.35 * ten : 1)));
      keyA += (ten - before) * params.turns * TAU;
      if (ten > 0) tone(220 + ten * 760); else toneStop();
      const step = Math.floor(ten * 32);
      if (step !== lastStep) { fx.vibrate(4 + Math.round(ten * 14)); lastStep = step; }
      if (ten >= RED && !inRed) {
        inRed = true;
        shake = 0.5;
        fx.care(params.red_cost);
        fx.bad('sec.key.red');
        fx.vibrate([40, 30, 40]);
      }
      if (ten < RED - 0.03) inRed = false;
    },

    up() { rot = null; toneStop(); },

    update(dt) {
      if (shake > 0) shake = Math.max(0, shake - dt);
      if (phase === 'run') {
        run += dt;
        const was = ten;
        ten = Math.max(0, ten - dt * 0.6);
        keyA += (ten - was) * params.turns * TAU;
        if (run > 1.4) done = true;
      }
    },

    hint() {
      if (phase === 'run') return 'sec.key.run';
      if (ten === 0) return 'sec.key';
      const z = zoneOf(ten);
      if (z === 'green') return 'sec.key.green';
      if (z === 'low') return 'sec.key.low';
      return 'sec.key.high';
    },

    sub(tr) {
      return tr('sec.key.tension', { p: Math.round(ten * 100) });
    },

    demo() {
      if (phase !== 'wind') return null;
      if (zoneOf(ten) === 'green') return demo.tap(BTN.x + BTN.w / 2, BTN.y + BTN.h / 2);
      if (ten > g0 + w) {
        const l = [];
        for (let i = 0; i <= 10; i++) { const a = -0.4 - i * 0.12; l.push([CX + Math.cos(a) * 255, CY + Math.sin(a) * 255]); }
        return demo.path(l, 0.2, 260, false);
      }
      return demo.circle(CX, CY, 255, 1.25);
    },

    draw(ctx, time) {
      const sx = shake > 0 ? Math.sin(shake * 80) * 10 : 0;
      ctx.save();
      ctx.translate(sx, 0);
      // platine
      ctx.fillStyle = '#efe2cc';
      ctx.beginPath(); ctx.arc(CX, CY, GR + 56, 0, TAU); ctx.fill();
      // jauge en arc : à vide, zone verte, zone rouge, puis la tension actuelle
      const arc = (v0, v1, color, lw = 34) => {
        ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'butt';
        ctx.beginPath(); ctx.arc(CX, CY, GR, A0 + SW * v0, A0 + SW * v1); ctx.stroke();
      };
      arc(0, 1, '#d8c8ae');
      arc(g0, g0 + w, '#9fdcb3');
      arc(RED, 1, '#f2a3a3');
      const z = zoneOf(ten);
      if (ten > 0) arc(0, ten, z === 'green' ? C.green : z === 'low' ? C.orange : C.red, 22);
      const na = A0 + SW * ten;
      ctx.fillStyle = C.ink;
      ctx.beginPath(); ctx.arc(CX + Math.cos(na) * GR, CY + Math.sin(na) * GR, 20, 0, TAU); ctx.fill();
      // barillet et ressort spirale qui se serre
      ctx.fillStyle = '#c9a24a';
      ctx.beginPath(); ctx.arc(CX, CY, DRUM, 0, TAU); ctx.fill();
      ctx.lineWidth = 10; ctx.strokeStyle = GOLD_DARK; ctx.stroke();
      ctx.fillStyle = '#3b3227';
      ctx.beginPath(); ctx.arc(CX, CY, DRUM - 18, 0, TAU); ctx.fill();
      const turns = 3 + ten * 4, rOut = DRUM - 30 - ten * 70, rIn = 34;
      const a0 = -keyA * 0.35;
      ctx.strokeStyle = '#cfd6dd'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i <= 260; i++) {
        const f = i / 260, a = a0 + f * turns * TAU, rr = rIn + (rOut - rIn) * f;
        const px = CX + Math.cos(a) * rr, py = CY + Math.sin(a) * rr;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.lineTo(CX + Math.cos(a0 + turns * TAU) * (DRUM - 20), CY + Math.sin(a0 + turns * TAU) * (DRUM - 20));
      ctx.stroke();
      // clé papillon : elle suit le doigt
      ctx.save();
      ctx.translate(CX, CY);
      ctx.rotate(keyA);
      ctx.fillStyle = GOLD; ctx.strokeStyle = GOLD_DARK; ctx.lineWidth = 8;
      for (const sd of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.bezierCurveTo(sd * 60, -120, sd * 190, -90, sd * 170, 0);
        ctx.bezierCurveTo(sd * 190, 90, sd * 60, 120, 0, 0);
        ctx.fillStyle = GOLD; ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e8c87a';
        ctx.beginPath(); ctx.ellipse(sd * 112, 0, 34, 22, 0, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = GOLD;
      ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.restore();
      ctx.restore();
      // flèche « tourne dans ce sens » tant que rien n'a bougé
      if (phase === 'wind' && ten === 0 && !rot) {
        const p = 0.5 + 0.5 * Math.sin(time * 5);
        ctx.strokeStyle = `rgba(255, 138, 61, ${0.6 + 0.4 * p})`; ctx.lineWidth = 14; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(CX, CY, 255, -Math.PI * 0.9, -Math.PI * 0.15); ctx.stroke();
        const a = -Math.PI * 0.15, x = CX + Math.cos(a) * 255, y = CY + Math.sin(a) * 255;
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath(); ctx.moveTo(x + 6, y + 44); ctx.lineTo(x - 34, y - 14); ctx.lineTo(x + 30, y - 20); ctx.closePath(); ctx.fill();
      }
      // bouton Tester
      if (phase === 'wind') {
        const on = ten > 0;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        roundRect(ctx, BTN.x, BTN.y + 8, BTN.w, BTN.h, BTN.h / 2); ctx.fill();
        ctx.fillStyle = on ? (z === 'green' ? C.green : C.turquoiseDark) : '#c9bfae';
        roundRect(ctx, BTN.x, BTN.y, BTN.w, BTN.h, BTN.h / 2); ctx.fill();
        fitText(ctx, t('sec.key.test'), BTN.x + BTN.w / 2, BTN.y + BTN.h / 2 + 2, BTN.w - 40, 44, '#fff', 900);
      }
    },
  };
}
