// Batterie gonflée — vue rapprochée.
// 1) Sortir la vieille batterie du logement le long du rail, lentement (jauge de risque au-delà
//    de speed_max) et sans toucher les bords rouges (-soin).
// 2) La poser sur le support à droite (case du haut).
// 3) Prendre la neuve sur le support (case du bas), l'amener à l'entrée du rail et la pousser
//    jusqu'au fond : mêmes règles de vitesse et de bords.
import { C, roundRect, easeInOut } from '../ui.js';
import { demo } from '../tutorial.js';

const RAIL_Y = 650;
const X0 = 260;            // centre de la batterie au fond du logement
const RAIL_END = 640;      // centre de la batterie quand elle sort du rail
const BW = 220;
const H2 = 110;            // demi-hauteur réelle de la batterie (bosses comprises)
const OLD_BAY = { x: 875, y: 545 };
const NEW_BAY = { x: 875, y: 765 };
const BAY_SCALE = 0.8;
const FREE = { x0: RAIL_END, x1: 905, y0: 440, y1: 870 };

// Batterie dessinée : gonflée (vieille) ou neuve. Même encombrement (2 × H2 de haut).
export function drawBatteryPiece(ctx, x, y, { old = true, scale = 1, shadow = 0 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (shadow) { ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'; ctx.shadowBlur = 20 * shadow; ctx.shadowOffsetY = 12 * shadow; }
  const w = BW;
  ctx.beginPath();
  if (old) {
    // corps bombé : bosses de 22 px en haut et en bas
    const h = (H2 - 22) * 2;
    ctx.moveTo(-w / 2 + 26, -h / 2);
    ctx.quadraticCurveTo(0, -h / 2 - 44, w / 2 - 26, -h / 2);
    ctx.quadraticCurveTo(w / 2 + 8, -h / 2, w / 2, -h / 2 + 26);
    ctx.quadraticCurveTo(w / 2 + 26, 0, w / 2, h / 2 - 26);
    ctx.quadraticCurveTo(w / 2 + 8, h / 2, w / 2 - 26, h / 2);
    ctx.quadraticCurveTo(0, h / 2 + 44, -w / 2 + 26, h / 2);
    ctx.quadraticCurveTo(-w / 2 - 8, h / 2, -w / 2, h / 2 - 26);
    ctx.quadraticCurveTo(-w / 2 - 26, 0, -w / 2, -h / 2 + 26);
    ctx.quadraticCurveTo(-w / 2 - 8, -h / 2, -w / 2 + 26, -h / 2);
  } else {
    roundRect(ctx, -w / 2, -H2, w, H2 * 2, 24);
  }
  ctx.fillStyle = old ? '#e8b84a' : '#f2c14e';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 8;
  ctx.strokeStyle = old ? '#a8781f' : '#c7962c';
  ctx.stroke();
  ctx.fillStyle = '#8a6418';
  ctx.fillRect(-w / 2 - 16, -24, 16, 48);
  ctx.fillStyle = old ? C.red : C.green;
  roundRect(ctx, -w / 2 + 36, -18, w - 72, 36, 12); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '900 34px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(old ? '!' : '+', 0, 2);
  ctx.restore();
}

export function createBattery(params, fx) {
  const gap = params.edge_tol;
  // phase : out (vieille dans le rail) → drop (vieille à poser) → take (neuve sur le support)
  //         → insert (neuve dans le rail) → done
  const s = { phase: 'out', x: X0, y: RAIL_Y, risk: 0, back: null };
  const neu = { x: NEW_BAY.x, y: NEW_BAY.y };
  let drag = null;   // { offX, offY, fx, fy, v }
  let edgeT = 0;
  let edgeOn = false;

  const inRail = () => s.phase === 'out' || s.phase === 'insert';
  const piece = () => (s.phase === 'take' || s.phase === 'insert' || s.phase === 'done' ? neu : s);
  // posée sur le support : un peu plus petite
  const onBay = (o) => (o === s ? !['out', 'drop'].includes(s.phase) : o.x === NEW_BAY.x && o.y === NEW_BAY.y);
  const scaleOf = (o, held) => (held ? 1 : onBay(o) ? BAY_SCALE : 1);

  function hit(o, x, y, k = 1) {
    return Math.abs(x - o.x) < (BW / 2) * k + params.grab_pad && Math.abs(y - o.y) < H2 * k + params.grab_pad;
  }

  function pushBack(toX) {
    drag = null;
    s.risk = 0;
    s.back = { t: 0, o: piece(), fromX: piece().x, fromY: piece().y, toX };
  }

  // Dans le rail : vitesse et bords rouges. Retourne false si la pièce a été repoussée.
  function railRules(o, dt, backTo) {
    if (drag.v > params.speed_max) s.risk += dt * params.risk_rise;
    else s.risk = Math.max(0, s.risk - dt * params.risk_fall);
    if (s.risk >= 1) {
      fx.care(params.risk_cost);
      fx.bad(s.phase === 'out' ? 'sec.battery.hot' : 'sec.battery.force', { n: params.risk_cost });
      fx.vibrate([60, 30, 60]);
      fx.spawn(o.x, RAIL_Y - 60, { count: 6, color: '#6b6f75', speed: 80, life: 1.1, size: 22, gravity: -120, kind: 'smoke', dir: -Math.PI / 2, spread: 1.2 });
      pushBack(backTo);
      return false;
    }
    const dy = o.y - RAIL_Y;
    const touching = Math.abs(dy) > gap;
    edgeT -= dt;
    if (touching && (!edgeOn || edgeT <= 0)) {
      edgeT = params.edge_cooldown;
      fx.care(params.edge_cost);
      fx.bad('sec.battery.edge', { n: params.edge_cost });
      fx.vibrate([25, 25, 25]);
      fx.spawn(o.x, RAIL_Y + Math.sign(dy) * (H2 + gap), { count: 10, color: '#fff3a6', speed: 300, life: 0.35, size: 6 });
    }
    edgeOn = touching;
    return true;
  }

  return {
    get done() { return s.phase === 'done'; },

    down(x, y) {
      if (s.back || s.phase === 'done') return false;
      const o = piece();
      if (!hit(o, x, y, scaleOf(o))) return false;
      drag = { offX: o.x - x, offY: o.y - y, fx: x, fy: y, v: 0 };
      fx.vibrate(8);
      return true;
    },

    move(x, y) {
      if (drag) { drag.fx = x; drag.fy = y; }
    },

    up() {
      if (!drag) return;
      drag = null;
      edgeOn = false;
      if (s.phase === 'drop' && Math.hypot(s.x - OLD_BAY.x, s.y - OLD_BAY.y) < 120) {
        s.x = OLD_BAY.x; s.y = OLD_BAY.y;
        s.phase = 'take';
        fx.vibrate([10, 20, 30]);
        fx.ok('sec.battery.dropped');
      }
    },

    update(dt) {
      if (s.back) {
        const b = s.back;
        b.t = Math.min(1, b.t + dt / 0.45);
        const e = easeInOut(b.t);
        b.o.x = b.fromX + (b.toX - b.fromX) * e;
        b.o.y = b.fromY + (RAIL_Y - b.fromY) * e;
        if (b.t >= 1) s.back = null;
      }
      if (!drag || dt <= 0) {
        s.risk = Math.max(0, s.risk - dt * params.risk_fall);
        return;
      }
      const o = piece();
      const tx = drag.fx + drag.offX, ty = drag.fy + drag.offY;
      let nx, ny;
      if (inRail()) {
        nx = Math.max(X0, Math.min(RAIL_END + 60, tx));
        ny = RAIL_Y + Math.max(-params.max_dev, Math.min(params.max_dev, ty - RAIL_Y));
      } else {
        nx = Math.max(FREE.x0, Math.min(FREE.x1, tx));
        ny = Math.max(FREE.y0, Math.min(FREE.y1, ty));
      }
      const v = Math.hypot(nx - o.x, ny - o.y) / dt;
      drag.v += (v - drag.v) * Math.min(1, dt * 10);
      o.x = nx; o.y = ny;

      if (s.phase === 'out') {
        if (!railRules(o, dt, X0)) return;
        if (o.x >= RAIL_END + 20) {
          s.phase = 'drop';
          s.risk = 0;
          fx.vibrate([15, 30, 15]);
          fx.ok('sec.battery.out');
        }
      } else if (s.phase === 'take') {
        // à l'entrée du rail : la neuve s'engage (il faut arriver bien entre les bords)
        if (o.x <= RAIL_END + 30 && Math.abs(o.y - RAIL_Y) < H2 + gap + 50) {
          s.phase = 'insert';
          edgeOn = false;
          o.x = RAIL_END;
          o.y = RAIL_Y + Math.max(-params.max_dev, Math.min(params.max_dev, o.y - RAIL_Y));
          drag.v = 0;
          fx.vibrate(10);
        }
      } else if (s.phase === 'insert') {
        if (o.x > RAIL_END + 50) { s.phase = 'take'; s.risk = 0; return; } // ressortie
        if (!railRules(o, dt, RAIL_END)) return;
        if (o.x <= X0 + 8) {
          o.x = X0; o.y = RAIL_Y;
          drag = null;
          s.phase = 'done';
          fx.vibrate([10, 20, 35]);
          fx.spawn(X0, RAIL_Y, { count: 22, color: C.turquoise, speed: 420, size: 8 });
          fx.ok('sec.battery.in');
        }
      }
    },

    hint() {
      if (s.risk > 0.25 && inRail()) return 'sec.battery.slow';
      return {
        out: 'sec.battery.out_hint', drop: 'sec.battery.drop', take: 'sec.battery.take',
        insert: 'sec.battery.insert', done: 'sec.battery.insert',
      }[s.phase];
    },

    tutoKey() {
      return s.phase === 'out' ? 'tuto.sec.battery2' : s.phase === 'drop' ? 'tuto.sec.battery3' : 'tuto.sec.battery4';
    },

    demo() {
      if (s.phase === 'out') return demo.drag(X0, RAIL_Y, RAIL_END + 40, RAIL_Y, 0.25, 2.2);
      if (s.phase === 'drop') return demo.drag(s.x, s.y, OLD_BAY.x, OLD_BAY.y, 0.25, 0.9);
      if (s.phase === 'take') return demo.path([[NEW_BAY.x, NEW_BAY.y], [RAIL_END + 60, RAIL_Y], [X0, RAIL_Y]], 0.25, 170);
      if (s.phase === 'insert') return demo.drag(neu.x, RAIL_Y, X0, RAIL_Y, 0.25, 2.0);
      return null;
    },

    draw(ctx, time) {
      const top = RAIL_Y - H2 - gap;
      const bot = RAIL_Y + H2 + gap;
      // carte, logement et rail
      ctx.fillStyle = '#2f8a5b';
      roundRect(ctx, 100, top - 46, 660, bot - top + 92, 30); ctx.fill();
      ctx.fillStyle = '#1f3d2e';
      roundRect(ctx, X0 - BW / 2 - 24, top, BW + 48, bot - top, 22); ctx.fill();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.fillRect(X0 + BW / 2 + 24, top + 16, RAIL_END + BW / 2 - X0 - BW / 2 - 24, bot - top - 32);
      ctx.fillStyle = '#d64545';
      roundRect(ctx, 110, top - 18, 640, 16, 8); ctx.fill();
      roundRect(ctx, 110, bot + 2, 640, 16, 8); ctx.fill();

      // support à droite : case du haut (usée, rouge), case du bas (neuve, verte)
      ctx.fillStyle = '#d9c3a3';
      roundRect(ctx, 775, 425, 200, 465, 28); ctx.fill();
      const pulse = 0.5 + 0.5 * Math.sin(time * 6);
      for (const [bay, col, on] of [[OLD_BAY, '214, 69, 69', s.phase === 'drop'], [NEW_BAY, '60, 191, 106', s.phase === 'take']]) {
        ctx.save();
        ctx.setLineDash([12, 10]);
        ctx.strokeStyle = `rgba(${col}, ${on ? 0.45 + 0.5 * pulse : 0.55})`;
        ctx.lineWidth = on ? 8 : 5;
        roundRect(ctx, bay.x - (BW / 2) * BAY_SCALE - 10, bay.y - H2 * BAY_SCALE - 10, BW * BAY_SCALE + 20, H2 * 2 * BAY_SCALE + 20, 18); ctx.stroke();
        ctx.restore();
      }

      // flèches dans le rail : vers la droite pour sortir, vers la gauche pour rentrer
      if (!drag && (s.phase === 'out' || s.phase === 'insert')) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 12;
        const dir = s.phase === 'out' ? 1 : -1;
        for (let i = 0; i < 3; i++) {
          const o = (time * 0.8 + i / 3) % 1;
          const ax = s.phase === 'out' ? 420 + o * 260 : 680 - o * 260;
          const ay = bot + 24;
          ctx.strokeStyle = `rgba(255, 255, 255, ${Math.sin(o * Math.PI) * 0.8})`;
          ctx.beginPath(); ctx.moveTo(ax - dir * 16, ay - 14); ctx.lineTo(ax + dir * 8, ay); ctx.lineTo(ax - dir * 16, ay + 14); ctx.stroke();
        }
        ctx.restore();
      }

      // batteries
      const heldOld = drag && piece() === s;
      const heldNew = drag && piece() === neu;
      const shakeK = s.risk > 0.5 ? (Math.random() - 0.5) * 10 * s.risk : 0;
      drawBatteryPiece(ctx, s.x + (heldOld ? shakeK : 0), s.y, { old: true, scale: scaleOf(s, heldOld), shadow: s.phase === 'drop' && heldOld ? 1 : 0 });
      drawBatteryPiece(ctx, neu.x + (heldNew ? shakeK : 0), neu.y, { old: false, scale: scaleOf(neu, heldNew), shadow: s.phase === 'take' && heldNew ? 1 : 0 });

      // jauge de chaleur au-dessus de la batterie (se remplit quand on va trop vite), avec un bord net
      if (inRail() && (drag || s.risk > 0)) {
        const o = piece();
        const w = 260, h = 30, x = Math.max(110, Math.min(640, o.x) - w / 2), y = top - 46 - h;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        roundRect(ctx, x, y, w, h, h / 2); ctx.fill();
        if (s.risk > 0) {
          ctx.fillStyle = s.risk > 0.6 ? C.red : C.orange;
          roundRect(ctx, x, y, Math.max(h, w * Math.min(1, s.risk)), h, h / 2); ctx.fill();
        }
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 5;
        roundRect(ctx, x, y, w, h, h / 2); ctx.stroke();
      }
    },
  };
}
