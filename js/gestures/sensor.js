// Capteur décalibré — vue rapprochée.
// Deux curseurs à régler : le signal se calme et un son monte quand on approche du réglage.
// Chaque curseur a une zone verte (zone = 12 % de la piste) ; les deux dedans pendant hold s = réglé.
import { C, roundRect, fitText } from '../ui.js';
import { demo } from '../tutorial.js';
import { tone, toneStop } from '../feedback.js';

const TAU = Math.PI * 2;
const SCR = { x: 150, y: 420, w: 780, h: 320 };
const TX0 = 220, TX1 = 860;
const TY = [930, 1110];
const KNOB = 50;

export function createSensor(params, fx) {
  const half = params.zone / 2;
  const target = [0.2 + Math.random() * 0.6, 0.2 + Math.random() * 0.6];
  // départ loin du réglage
  const v = target.map((tg) => (tg > 0.5 ? tg - 0.35 - Math.random() * 0.1 : tg + 0.35 + Math.random() * 0.1));
  const inside = [false, false];
  let drag = null;     // { i, offX, fx }
  let hold = 0;
  let done = false;

  const kx = (i) => TX0 + (TX1 - TX0) * v[i];
  const err = (i) => Math.abs(v[i] - target[i]);
  const close = (i) => Math.max(0, 1 - err(i) / 0.5);

  return {
    get done() { return done; },
    get info() { return { v, target }; },  // pour les tests automatiques

    down(x, y) {
      if (done) return false;
      for (let i = 0; i < 2; i++) {
        if (Math.abs(y - TY[i]) < params.knob_grab && x > TX0 - params.knob_grab && x < TX1 + params.knob_grab) {
          // on attrape le bouton (ou on le fait venir sous le doigt si on touche la piste)
          const onKnob = Math.abs(x - kx(i)) < params.knob_grab;
          drag = { i, offX: onKnob ? kx(i) - x : 0, fx: x };
          fx.vibrate(8);
          return true;
        }
      }
      return false;
    },

    move(x) {
      if (drag) drag.fx = x;
    },

    up() {
      drag = null;
      toneStop();
    },

    update(dt) {
      if (done) return;
      if (drag) {
        const i = drag.i;
        v[i] = Math.max(0, Math.min(1, (drag.fx + drag.offX - TX0) / (TX1 - TX0)));
        tone(240 + 720 * close(i) * close(i));
      }
      for (let i = 0; i < 2; i++) {
        const now = err(i) <= half;
        if (now && !inside[i]) fx.vibrate(15);
        inside[i] = now;
      }
      if (inside[0] && inside[1]) {
        hold += dt;
        if (hold >= params.hold) {
          done = true;
          drag = null;
          toneStop();
          fx.score((2 - 0.3 * (err(0) + err(1)) / half) / 2);
          fx.vibrate([10, 20, 40]);
          fx.spawn(SCR.x + SCR.w / 2, SCR.y + SCR.h / 2, { count: 22, color: '#5fe08b', speed: 420, size: 8 });
          fx.ok('sec.sensor.ok');
        }
      } else hold = 0;
    },

    hint() {
      return inside[0] && inside[1] ? 'sec.sensor.hold' : 'sec.sensor';
    },

    demo() {
      if (done) return null;
      const i = inside[0] ? 1 : 0;
      const x = kx(i);
      const to = Math.max(TX0, Math.min(TX1, x + (target[i] > v[i] ? 1 : -1) * 220));
      return demo.drag(x, TY[i], to, TY[i], 0.25, 1.2);
    },

    draw(ctx, time) {
      // écran du signal
      ctx.fillStyle = '#16212b';
      roundRect(ctx, SCR.x, SCR.y, SCR.w, SCR.h, 26); ctx.fill();
      ctx.strokeStyle = '#4b5b69';
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(95, 224, 139, 0.12)';
      ctx.lineWidth = 2;
      for (let gx = SCR.x + 60; gx < SCR.x + SCR.w; gx += 60) { ctx.beginPath(); ctx.moveTo(gx, SCR.y + 14); ctx.lineTo(gx, SCR.y + SCR.h - 14); ctx.stroke(); }
      for (let gy = SCR.y + 40; gy < SCR.y + SCR.h; gy += 40) { ctx.beginPath(); ctx.moveTo(SCR.x + 14, gy); ctx.lineTo(SCR.x + SCR.w - 14, gy); ctx.stroke(); }
      const e = Math.min(1, (err(0) + err(1)) * 1.6);
      const ok = done || (inside[0] && inside[1]);
      const mid = SCR.y + SCR.h / 2;
      ctx.save();
      ctx.beginPath(); ctx.rect(SCR.x + 10, SCR.y + 10, SCR.w - 20, SCR.h - 20); ctx.clip();
      ctx.strokeStyle = ok ? '#5fe08b' : e < 0.35 ? '#ffd36b' : '#ff8a3d';
      ctx.lineWidth = 7;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let x = SCR.x + 14; x <= SCR.x + SCR.w - 14; x += 6) {
        const clean = Math.sin(x * 0.03 - time * 5) * 70;
        const noise = (Math.sin(x * 0.37 + time * 23) * Math.sin(x * 0.11 - time * 7) + Math.sin(x * 0.71 - time * 31) * 0.5) * 110 * e;
        const y = mid + clean * (1 - e * 0.6) + noise;
        if (x === SCR.x + 14) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
      // voyants de réglage, en haut de l'écran (jamais sous le doigt) : plus c'est rempli, plus on est près ;
      // tout vert = ce curseur est bien réglé
      for (let i = 0; i < 2; i++) {
        const ok = inside[i] || done;
        const n = ok ? 8 : Math.round(close(i) * close(i) * 7);
        const x0 = SCR.x + 30 + i * (SCR.w / 2), y0 = SCR.y + 20;
        ctx.fillStyle = 'rgba(11, 15, 20, 0.85)';
        roundRect(ctx, x0 - 10, y0 - 8, SCR.w / 2 - 40, 58, 14); ctx.fill();
        ctx.fillStyle = ok ? '#5fe08b' : '#c9ced4';
        ctx.beginPath(); ctx.arc(x0 + 20, y0 + 21, 20, 0, TAU); ctx.fill();
        fitText(ctx, String(i + 1), x0 + 20, y0 + 22, 30, 28, '#16212b', 900);
        for (let k = 0; k < 8; k++) {
          const on = k < n;
          const col = ok ? '#5fe08b' : k < 3 ? '#ff6b5a' : k < 6 ? '#ffb347' : '#ffe066';
          ctx.fillStyle = on ? col : 'rgba(255, 255, 255, 0.12)';
          const bh = 14 + k * 3.5;
          roundRect(ctx, x0 + 54 + k * 34, y0 + 42 - bh, 26, bh, 5); ctx.fill();
        }
      }
      // barre de maintien
      if (!done && hold > 0) {
        const k = Math.min(1, hold / params.hold);
        ctx.fillStyle = '#5fe08b';
        roundRect(ctx, SCR.x + 30, SCR.y + SCR.h - 34, (SCR.w - 60) * k, 16, 8); ctx.fill();
      }
      // curseurs
      for (let i = 0; i < 2; i++) {
        const y = TY[i];
        ctx.fillStyle = (inside[i] || done) ? C.green : '#c9ced4';
        ctx.beginPath(); ctx.arc(TX0 - 75, y, 26, 0, TAU); ctx.fill();
        fitText(ctx, String(i + 1), TX0 - 75, y + 1, 36, 34, C.ink, 900);
        ctx.fillStyle = 'rgba(58, 42, 30, 0.2)';
        roundRect(ctx, TX0 - 30, y - 18, TX1 - TX0 + 60, 36, 18); ctx.fill();
        if (inside[i] || done) {
          ctx.fillStyle = 'rgba(60, 191, 106, 0.8)';
          const zx = TX0 + (TX1 - TX0) * (target[i] - half);
          roundRect(ctx, zx, y - 18, (TX1 - TX0) * params.zone, 36, 18); ctx.fill();
        }
        ctx.fillStyle = 'rgba(58, 42, 30, 0.35)';
        for (let k = 0; k <= 10; k++) ctx.fillRect(TX0 + ((TX1 - TX0) * k) / 10 - 2, y + 30, 4, k % 5 ? 14 : 24);
        const x = kx(i);
        const glow = 0.5 + 0.5 * Math.sin(time * 6);
        ctx.fillStyle = (inside[i] || done) ? C.green : drag && drag.i === i ? C.turquoise : '#fff';
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(x, y, KNOB * (drag && drag.i === i ? 1.08 : 1), 0, TAU); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(58, 42, 30, 0.5)';
        ctx.lineWidth = 5;
        for (const dx of [-12, 0, 12]) { ctx.beginPath(); ctx.moveTo(x + dx, y - 20); ctx.lineTo(x + dx, y + 20); ctx.stroke(); }
        if (!drag && !inside[i] && !done) {
          ctx.strokeStyle = `rgba(255, 138, 61, ${0.3 + 0.5 * glow})`;
          ctx.lineWidth = 6;
          ctx.beginPath(); ctx.arc(x, y, KNOB + 14, 0, TAU); ctx.stroke();
        }
      }
    },
  };
}
