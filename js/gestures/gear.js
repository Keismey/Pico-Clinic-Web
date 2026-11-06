// Engrenage coincé — vue rapprochée.
// 1) Glisser le débris hors de la zone (cercle en pointillés). 2) Glisser l'engrenage sur son axe.
// 3) Le tourner (un quart de tour) : le repère blanc doit viser le triangle à tolerance° près.
// Après attempts_hint essais ratés, la bonne zone s'affiche en vert.
import { C, easeInOut } from '../ui.js';
import { demo } from '../tutorial.js';

const TAU = Math.PI * 2;
const A = { x: 380, y: 740, r: 150, n: 14 };        // grand engrenage fixe
const BR = 100, BN = 10;                            // engrenage à remettre
const AX = { x: A.x + A.r + BR - 18, y: A.y };      // son axe
const ZONE = { x: 500, y: 740 };
const LOOSE = { x: 820, y: 960 };
const TARGET = -Math.PI / 2;                        // le triangle est en haut

function angDist(a, b) {
  let d = (a - b) % TAU;
  if (d < -Math.PI) d += TAU;
  if (d > Math.PI) d -= TAU;
  return Math.abs(d);
}

export function drawGear(ctx, x, y, r, n, angle, { color = '#d9a441', dark = '#8f6a1e', alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  const tooth = Math.max(8, r * 0.16);
  const w = TAU / n;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a0 = angle + i * w;
    const pts = [[a0 - w * 0.27, r], [a0 - w * 0.15, r + tooth], [a0 + w * 0.15, r + tooth], [a0 + w * 0.27, r]];
    for (const [a, rr] of pts) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = Math.max(3, r * 0.05);
  ctx.strokeStyle = dark;
  ctx.stroke();
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, TAU); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, TAU); ctx.fill();
  ctx.fillStyle = '#5b5f66';
  ctx.beginPath(); ctx.arc(x, y, r * 0.16, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawDebris(ctx, x, y, s = 1) {
  // écrou rouillé tombé entre les dents : hexagone avec trou, coulures de rouille et petite limaille
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.rotate(0.35);
  const hex = (r) => { ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = (k * Math.PI) / 3; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); };
  ctx.lineJoin = 'round';
  hex(40);
  const gr = ctx.createLinearGradient(-40, -40, 40, 40);
  gr.addColorStop(0, '#d2884a'); gr.addColorStop(0.5, '#a8582a'); gr.addColorStop(1, '#7a3a1a');
  ctx.fillStyle = gr; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = '#5a2a12'; ctx.stroke();
  // reflet sur deux faces
  ctx.fillStyle = 'rgba(255, 220, 170, 0.35)';
  ctx.beginPath(); ctx.moveTo(-34, -6); ctx.lineTo(-17, -34); ctx.lineTo(17, -34); ctx.lineTo(0, -6); ctx.closePath(); ctx.fill();
  // trou central
  hex(0.01);
  ctx.fillStyle = '#5b5f66'; ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU); ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = '#3a3d42'; ctx.stroke();
  ctx.fillStyle = '#2b2f33'; ctx.beginPath(); ctx.arc(2, 3, 9, 0, TAU); ctx.fill();
  // limaille
  ctx.fillStyle = '#7a3a1a';
  for (const [dx, dy, r] of [[52, 18, 5], [-50, 24, 4], [46, -30, 3.5]]) { ctx.beginPath(); ctx.arc(dx, dy, r, 0, TAU); ctx.fill(); }
  ctx.restore();
}

export function createGear(params, fx) {
  const lift = params.lift_offset;
  const tol = (params.tolerance * Math.PI) / 180;
  const debris = { x: AX.x - 30, y: AX.y - 40 };
  const B = { x: LOOSE.x, y: LOOSE.y, angle: 0.4 };
  const angle0 = TARGET - Math.PI / 2;
  let step = 'debris';          // debris → place → turn → spin → done
  let drag = null;              // { what: 'debris' | 'gear', fx, fy, offY }
  let rot = null;               // { last, moved }
  let back = null;              // retour du repère après un essai raté
  let attempts = 0;
  let spin = 0;
  let aAngle = 0;

  function zoneR() { return params.zone; }

  return {
    get done() { return step === 'done'; },

    down(x, y) {
      // nouvel essai pendant que le repère revient : on repart de la position de départ
      if (back && step === 'turn') { B.angle = angle0; back = null; }
      if (back) return false;
      if (step === 'debris' && Math.hypot(x - debris.x, y - debris.y) < 70 + params.grab_pad) {
        drag = { what: 'debris', fx: x, fy: y, offY: debris.y - y };
      } else if (step === 'place' && Math.hypot(x - B.x, y - B.y) < BR + params.grab_pad) {
        drag = { what: 'gear', fx: x, fy: y, offY: B.y - y };
      } else if (step === 'turn' && Math.hypot(x - AX.x, y - AX.y) < BR * 2.6) {
        rot = { last: Math.atan2(y - AX.y, x - AX.x), moved: 0 };
      } else return false;
      fx.vibrate(8);
      return true;
    },

    move(x, y) {
      if (drag) { drag.fx = x; drag.fy = y; }
      if (rot) {
        const d = Math.hypot(x - AX.x, y - AX.y);
        const a = Math.atan2(y - AX.y, x - AX.x);
        if (d < 30) { rot.last = a; return; }
        let da = a - rot.last;
        if (da > Math.PI) da -= TAU; else if (da < -Math.PI) da += TAU;
        rot.last = a;
        rot.moved += Math.abs(da);
        B.angle += da;
      }
    },

    up() {
      if (drag) {
        const d = drag;
        drag = null;
        if (d.what === 'debris') {
          if (Math.hypot(debris.x - ZONE.x, debris.y - ZONE.y) > zoneR()) {
            step = 'place';
            fx.vibrate([15, 30, 15]);
            fx.spawn(debris.x, debris.y, { count: 10, color: '#9a8f80', speed: 260, size: 7 });
            fx.ok('sec.gear.debris_out');
          } else fx.info('sec.gear.off');
        } else if (Math.hypot(B.x - AX.x, B.y - AX.y) <= params.snap_radius) {
          B.x = AX.x; B.y = AX.y; B.angle = angle0;
          step = 'turn';
          fx.vibrate([10, 20, 30]);
          fx.ok('sec.gear.placed');
        } else fx.info('sec.gear.miss_axis');
      }
      if (rot) {
        const r = rot;
        rot = null;
        if (r.moved < 0.15) return;
        const err = angDist(B.angle, TARGET);
        if (err <= tol) {
          B.angle = TARGET;
          step = 'spin';
          spin = 1.1;
          fx.score(1 - 0.5 * err / tol);
          fx.vibrate([10, 20, 40]);
          fx.spawn(AX.x, AX.y - BR, { count: 18, color: '#ffd36b', speed: 380, size: 7 });
          fx.ok('sec.gear.ok');
        } else {
          attempts++;
          fx.vibrate([20, 30, 20]);
          fx.bad(attempts === params.attempts_hint ? 'sec.gear.help' : 'sec.gear.miss');
          back = { t: 0, from: B.angle };
        }
      }
    },

    update(dt) {
      if (drag) {
        drag.offY += (-lift - drag.offY) * Math.min(1, dt * 14);
        const o = drag.what === 'debris' ? debris : B;
        o.x = Math.max(110, Math.min(970, drag.fx));
        o.y = Math.max(400, Math.min(1220, drag.fy + drag.offY));
      }
      if (back) {
        back.t = Math.min(1, back.t + dt / 0.45);
        B.angle = back.from + (angle0 - back.from) * easeInOut(back.t);
        if (back.t >= 1) back = null;
      }
      if (step === 'spin') {
        spin -= dt;
        aAngle -= dt * 2.2;
        B.angle += dt * 2.2 * (A.n / BN);
        if (spin <= 0) step = 'done';
      }
    },

    hint() {
      if (step === 'debris') return 'sec.gear.debris';
      if (step === 'place') return 'sec.gear.place';
      return attempts >= params.attempts_hint ? 'sec.gear.turn_help' : 'sec.gear.turn';
    },

    offset() { return step === 'turn' ? [0, 0] : [0, -lift]; },
    carry(ctx, x, y) {
      if (step === 'debris') drawDebris(ctx, x, y);
      else if (step === 'place') drawGear(ctx, x, y, BR, BN, 0.4);
    },
    demo() {
      if (step === 'debris') return demo.drag(debris.x, debris.y + lift, 880, 520 + lift, 0.25, 1.0);
      if (step === 'place') return demo.drag(LOOSE.x, LOOSE.y + lift, AX.x, AX.y + lift, 0.25, 1.0);
      if (step === 'turn') return demo.circle(AX.x, AX.y, BR * 1.5, 0.25);
      return null;
    },

    draw(ctx, time) {
      // zone de travail
      if (step === 'debris') {
        ctx.save();
        ctx.setLineDash([18, 14]);
        ctx.lineDashOffset = -time * 30;
        ctx.strokeStyle = 'rgba(214, 69, 69, 0.55)';
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(ZONE.x, ZONE.y, zoneR(), 0, TAU); ctx.stroke();
        ctx.restore();
      }
      drawGear(ctx, A.x, A.y, A.r, A.n, aAngle, { color: '#c9a24a', dark: '#7a5a1a' });
      // axe vide
      if (step === 'debris' || step === 'place') {
        const p = 0.5 + 0.5 * Math.sin(time * 6);
        ctx.fillStyle = '#5b5f66';
        ctx.beginPath(); ctx.arc(AX.x, AX.y, 18, 0, TAU); ctx.fill();
        if (step === 'place') {
          ctx.strokeStyle = `rgba(63, 208, 187, ${0.4 + 0.5 * p})`;
          ctx.lineWidth = 8;
          ctx.beginPath(); ctx.arc(AX.x, AX.y, BR + 10 * p, 0, TAU); ctx.stroke();
        }
      }
      // triangle-repère et, après plusieurs essais, la bonne zone en vert
      if (step === 'turn' || step === 'spin') {
        if (attempts >= params.attempts_hint && step === 'turn') {
          ctx.fillStyle = 'rgba(60, 191, 106, 0.35)';
          ctx.beginPath(); ctx.moveTo(AX.x, AX.y);
          ctx.arc(AX.x, AX.y, BR * 1.35, TARGET - tol, TARGET + tol); ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = C.orange;
        const ty = AX.y - BR - 40;
        ctx.beginPath(); ctx.moveTo(AX.x - 22, ty - 26); ctx.lineTo(AX.x + 22, ty - 26); ctx.lineTo(AX.x, ty + 4); ctx.closePath(); ctx.fill();
      }
      if (step !== 'debris') {
        drawGear(ctx, B.x, B.y, BR, BN, B.angle);
        // repère blanc sur l'engrenage
        if (step === 'turn' || step === 'spin') {
          const nx = B.x + Math.cos(B.angle) * BR * 0.75, ny = B.y + Math.sin(B.angle) * BR * 0.75;
          ctx.fillStyle = '#fff';
          ctx.strokeStyle = C.ink;
          ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(nx, ny, 14, 0, TAU); ctx.fill(); ctx.stroke();
        }
      } else {
        drawGear(ctx, LOOSE.x, LOOSE.y, BR, BN, 0.4, { alpha: 0.95 });
      }
      if (step === 'debris') drawDebris(ctx, debris.x, debris.y, drag ? 1.08 : 1);
      // doigt qui tourne : cercle guide
      if (rot) {
        ctx.strokeStyle = 'rgba(37, 160, 141, 0.6)';
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(AX.x, AX.y, BR * 1.5, 0, TAU); ctx.stroke();
      }
    },
  };
}
