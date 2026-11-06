// Réactivation : tirer la manette vers le bas. Validée à 70 % de la course.
// S'il reste une panne, le drone tousse, la zone fautive clignote et on rouvre.
import { W } from '../canvas.js';
import { t } from '../i18n.js';
import { C, drawCreamBackground, drawPanel, drawText, drawToast, roundRect, clamp, easeInOut } from '../ui.js';
import { D, withDrone, drawFrame, drawCover, faultSpot } from '../drone.js';
import { game } from '../state.js';
import { vibrate } from '../feedback.js';
import { sfx } from '../audio.js';
import * as fx from '../particles.js';
import { go } from '../scenes.js';
import { save } from '../save.js';
import { createCoach, demo, drawGribBox } from '../tutorial.js';

const TAU = Math.PI * 2;
const TRACK_TOP = 1300;
const KNOB_R = 72;
const DX = W / 2;
const DY = 640;
const DS = 0.75;

let rep, params, lever, grab, state, st, rotorAngle, rotorSpeed, lift, smokeT, burst, coach;

// position écran d'un point du drone
function toScreen(x, y) {
  return { x: DX + (x - D.cx) * DS, y: DY + (y - D.cy) * DS };
}

function knobY() {
  return TRACK_TOP + lever * params.travel;
}

function trigger() {
  grab = null;
  st = 0;
  if (rep.faults.size > 0) {
    state = 'cough';
    vibrate([80, 60, 80, 60, 80]);
    sfx('lever');
    sfx('cough');
  } else {
    state = 'success';
    vibrate([20, 30, 30, 30, 40, 30, 90]);
    sfx('lever');
    sfx('rotor_start');
  }
}

export default {
  init() {
    rep = game.repair;
    params = game.data.gestures.lever;
    rep.attempts++;
    lever = 0;
    grab = null;
    state = 'idle';
    st = 0;
    rotorAngle = 0;
    rotorSpeed = 0;
    lift = 0;
    smokeT = 0;
    burst = false;
    // tutoriel : Gribouille montre la manette la première fois
    const firstTime = !(save.orders[rep.patient.id] && save.orders[rep.patient.id].paid);
    coach = createCoach([{
      id: 'lever', key: 'tuto.lever', start: () => true, done: () => state !== 'idle',
      demo: () => demo.drag(DX, TRACK_TOP, DX, TRACK_TOP + params.travel * 0.85, 0.15, 0.7),
    }], { enabled: firstTime, remember: !rep.patient.order.test });
  },

  update(dt) {
    st += dt;
    coach.update(dt);
    if (state === 'idle') {
      if (!grab) lever += (0 - lever) * Math.min(1, dt * 10);
    } else {
      lever += (1 - lever) * Math.min(1, dt * 12);
    }

    if (state === 'cough') {
      rotorSpeed = st < 1.3 ? 10 * Math.abs(Math.sin(st * 9)) : Math.max(0, rotorSpeed - dt * 20);
      smokeT -= dt;
      if (smokeT <= 0 && st < 1.8) {
        smokeT = 0.12;
        const p = toScreen(D.cx + (Math.random() - 0.5) * 300, D.cy - 100);
        fx.spawn(p.x, p.y, { count: 2, color: '#8b8f96', speed: 120, life: 1.2, size: 26, gravity: -140, kind: 'smoke', dir: -Math.PI / 2, spread: 1.2 });
      }
      if (st > 3.6) go('operation', { resume: true, flash: true });
    }

    if (state === 'success') {
      rotorSpeed = Math.min(48, rotorSpeed + dt * 32);
      if (st > 1) lift = Math.min(1, lift + dt * 0.9);
      if (st > 1 && !burst) {
        burst = true;
        sfx('lights');
        sfx('jingle');
        fx.spawn(DX, DY, { count: 40, color: C.turquoise, speed: 700, life: 0.9, size: 10, gravity: 500 });
        fx.spawn(DX, DY, { count: 30, color: C.orange, speed: 600, life: 0.9, size: 9, gravity: 500 });
      }
      if (st > 3.8) {
        const p = rep.patient;
        // commande à plusieurs patients : on enchaîne sur le suivant
        if (p.part < p.parts - 1) {
          (game.multi = game.multi || []).push(rep);
          go('operation', { order: p.id, part: p.part + 1 });
          return;
        }
        if (rep.patient.order.test || rep.patient.order.free) go('done');
        else go('counter', { order: rep.patient.id, mode: 'thanks' });
      }
    }
    rotorAngle += rotorSpeed * dt;
  },

  draw(ctx) {
    drawCreamBackground(ctx);

    const shake = state === 'cough' && st < 1.4 ? Math.sin(st * 70) * 14 : 0;
    const k = easeInOut(lift);
    const lights = state === 'success' ? [0, 1, 2, 3].map((i) => (Math.floor(st * 6) + i) % 2 === 0) : null;

    withDrone(ctx, DX + shake, DY - k * 140, DS * (1 + k * 0.22), () => {
      drawFrame(ctx, { rotorAngle, rotorSpeed, lights });
      drawCover(ctx, { screws: rep.screws, clips: rep.clips });
      if (state === 'cough' && st > 1.3) {
        const a = 0.5 + 0.5 * Math.sin(st * 12);
        ctx.strokeStyle = `rgba(214, 69, 69, ${0.4 + a * 0.6})`;
        ctx.lineWidth = 16;
        const spot = faultSpot(rep.faults.values().next().value);
        ctx.beginPath(); ctx.arc(spot.x, spot.y, spot.r + a * 15, 0, TAU); ctx.stroke();
      }
    });

    // textes
    const said = coach.text();
    if (state === 'idle' && said) {
      drawGribBox(ctx, { x: 60, y: 1010, w: W - 120, h: 170 }, said, coach.shown, coach.time, {});
    } else if (state === 'idle') {
      drawPanel(ctx, 110, 1055, W - 220, 115);
      drawText(ctx, t('reac.hint'), W / 2, 1112, W - 280, 50);
    } else if (state === 'cough') {
      if (st < 1.4) drawToast(ctx, t('reac.cough'), W / 2, 1110, Math.max(0.01, 1 - st / 1.4), C.inkSoft);
      else drawText(ctx, t('reac.fault_left'), W / 2, 1110, W - 200, 56, { color: C.red, weight: 800, stroke: '#fff' });
    } else if (st > 0.9) {
      drawToast(ctx, t('reac.success'), W / 2, 1110, Math.max(0.01, 1 - (st - 0.9) / 3), C.turquoiseDark);
    }

    this.drawLever(ctx);
    coach.draw(ctx);
  },

  drawLever(ctx) {
    const top = TRACK_TOP;
    const bottom = top + params.travel;
    // boîtier
    ctx.fillStyle = C.copperDark;
    roundRect(ctx, DX - 150, top - 90, 300, params.travel + 190, 50);
    ctx.fill();
    ctx.fillStyle = C.copper;
    roundRect(ctx, DX - 150, top - 100, 300, params.travel + 190, 50);
    ctx.fill();
    // voyant
    const lamp = state === 'success' ? C.green : state === 'cough' ? C.red : '#6b4a2a';
    ctx.fillStyle = lamp;
    ctx.beginPath(); ctx.arc(DX + 100, top - 50, 18, 0, TAU); ctx.fill();
    // rainure et repère des 70 %
    ctx.fillStyle = '#3a2516';
    roundRect(ctx, DX - 22, top - 20, 44, params.travel + 40, 22);
    ctx.fill();
    const mark = top + params.travel * params.validate;
    ctx.strokeStyle = 'rgba(255, 247, 236, 0.7)';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(DX - 70, mark); ctx.lineTo(DX - 36, mark); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(DX + 36, mark); ctx.lineTo(DX + 70, mark); ctx.stroke();
    // flèches d'invitation
    if (state === 'idle' && !grab) {
      const o = (st * 1.5) % 1;
      ctx.strokeStyle = `rgba(255, 247, 236, ${1 - o})`;
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      for (let i = 0; i < 2; i++) {
        const y = top + 120 + o * 120 + i * 50;
        if (y > bottom) continue;
        ctx.beginPath(); ctx.moveTo(DX + 75, y - 20); ctx.lineTo(DX + 100, y); ctx.lineTo(DX + 125, y - 20); ctx.stroke();
      }
    }
    // poignée
    const y = knobY();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.arc(DX + 6, y + 10, KNOB_R, 0, TAU); ctx.fill();
    ctx.fillStyle = state === 'success' ? C.turquoise : C.orange;
    ctx.beginPath(); ctx.arc(DX, y, KNOB_R, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.arc(DX - 20, y - 22, 22, 0, TAU); ctx.fill();
  },

  pointer(type, x, y) {
    coach.touch(type);
    if (state !== 'idle') return;
    if (type === 'down') {
      if (Math.hypot(x - DX, y - knobY()) < KNOB_R + 60) {
        grab = { y, start: lever };
        vibrate(8);
        sfx('grab');
      }
    } else if (type === 'move' && grab) {
      lever = clamp(grab.start + (y - grab.y) / params.travel, 0, 1);
      if (lever >= params.validate) trigger();
    } else if (type === 'up' || type === 'cancel') {
      grab = null;
    }
  },
};
