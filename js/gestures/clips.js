// Élytres à clips (scarabée) : à la place des 4 vis.
// Appuyer sur un clip et garder le doigt jusqu'à ce que l'anneau soit plein, puis pousser vers
// l'extérieur : clac. Pousser trop tôt force le clip (-soin) ; une 2e fois, il casse (clip neuf payé).
// Les 4 clips ouverts, on écarte chaque élytre d'un glissement vers le côté.
// En refermant, les élytres se rabattent et les clips se remettent tout seuls.
// État dans rep.clips (les 4 clips) et rep.doors (les 2 élytres), pour reprendre après un essai raté.
import { D } from '../drone.js';
import { C, easeInOut } from '../ui.js';

const TAU = Math.PI * 2;

export function clipSet() {
  return [[-1, -130], [-1, 130], [1, -130], [1, 130]].map(([dir, dy]) => ({
    dir, x: D.cx + dir * D.half, y: D.cy + dy, state: 'on', bent: false, fill: 0, off: 0,
  }));
}

export function createClips(rep, params, hooks) {
  const clips = rep.clips;
  if (!rep.doors) rep.doors = [{ pull: 0, open: false, k: 0 }, { pull: 0, open: false, k: 0 }];
  const doors = rep.doors;
  for (const d of doors) d.drag = null;
  // reprise après un démarrage raté : tout est resté ouvert
  if (rep.coverOpen) {
    for (const c of clips) { c.state = 'off'; c.off = 1; c.fill = 0; }
    for (const d of doors) { d.open = true; d.k = 1; }
  }
  let hold = null;     // { c, x0, y0, blocked }
  let snapped = false; // clips remis en refermant

  const left = () => clips.filter((c) => c.state === 'on').length;

  function release(c) {
    c.state = 'off';
    hold = null;
    hooks.vibrate(25);
    hooks.sfx('connect');
    hooks.spawn(c.x, c.y, { count: 8, color: '#e8e2d6', speed: 300, size: 6 });
    hooks.toast('op.clip_off', C.green);
    check();
  }

  function force(c) {
    hold.blocked = true;
    c.fill = 0;
    hooks.vibrate([30, 40, 30]);
    hooks.sfx('slip');
    if (c.bent) {
      // 2e fois : le clip casse, il faudra un clip neuf
      c.state = 'off';
      hooks.care(params.break_cost);
      hooks.part();
      hooks.spawn(c.x, c.y, { count: 10, color: '#9aa3ad', speed: 300, size: 6 });
      hooks.toast('op.clip_broken', C.red);
      check();
    } else {
      c.bent = true;
      hooks.care(params.bend_cost);
      hooks.toast('op.clip_bent', C.red);
    }
  }

  function check() {
    if (left() > 0) return;
    rep.coverLoose = true;
    hooks.vibrate([20, 40, 20]);
    hooks.toast('op.clips_off', C.turquoiseDark);
  }

  return {
    get holding() { return !!hold; },
    get left() { return left(); },
    get anyOpen() { return doors.some((d) => d.k > 0.01); },

    down(x, y) {
      if (!rep.coverLoose) {
        const c = clips.find((q) => q.state === 'on' && Math.hypot(x - q.x, y - q.y) < params.grab);
        if (c) { hold = { c, x0: x, y0: y, blocked: false }; hooks.vibrate(8); hooks.sfx('grab'); }
        return;
      }
      if (rep.coverOpen) return;
      if (Math.abs(y - D.cy) < D.half + 40 && Math.abs(x - D.cx) < D.half + 60) {
        const d = x < D.cx ? doors[0] : doors[1];
        if (!d.open) d.drag = { x0: x };
      }
    },

    move(x, y) {
      if (hold && !hold.blocked) {
        const c = hold.c, out = (x - hold.x0) * c.dir;
        // le doigt part ailleurs : on lâche le clip sans rien casser
        if (Math.abs(y - hold.y0) > 110 || out < -70) { hold = null; return; }
        if (c.fill < 1 && out > params.early) force(c);
        else if (c.fill >= 1 && out >= params.push) release(c);
      }
      doors.forEach((d, i) => {
        if (d.drag) d.pull = Math.max(0, Math.min(1, ((x - d.drag.x0) * (i ? 1 : -1)) / params.door_swipe));
      });
    },

    up() {
      hold = null;
      for (const d of doors) {
        if (!d.drag) continue;
        d.drag = null;
        if (d.pull >= 0.8) { d.open = true; hooks.vibrate([10, 20, 10]); hooks.sfx('page'); } else d.pull = 0;
      }
    },

    update(dt, closing) {
      for (const c of clips) {
        if (hold && hold.c === c && !hold.blocked) {
          const was = c.fill;
          c.fill = Math.min(1, c.fill + dt / params.hold);
          if (was < 1 && c.fill >= 1) { hooks.vibrate(15); hooks.sfx('snap_hint'); }
        } else c.fill = Math.max(0, c.fill - dt * 3);
        if (c.state === 'off' && !snapped) c.off = Math.min(1, c.off + dt * 5);
      }
      if (closing) {
        for (const d of doors) d.k = Math.min(d.k, easeInOut(rep.coverAnim));
        // élytres presque fermées : les clips se remettent, clac clac
        if (!snapped && rep.coverAnim < 0.2) {
          snapped = true;
          for (const c of clips) { c.state = 'on'; c.off = 0; c.fill = 0; c.bent = false; }
          hooks.vibrate([20, 60, 20]);
          hooks.sfx('connect');
          setTimeout(() => hooks.sfx('connect'), 120);
        }
        return;
      }
      for (const d of doors) {
        const goal = d.open ? 1 : d.pull;
        d.k += (goal - d.k) * Math.min(1, dt * 12);
      }
      if (!rep.coverOpen && rep.coverLoose && doors.every((d) => d.open && d.k > 0.97)) {
        for (const d of doors) d.k = 1;
        rep.coverOpen = true;
        rep.coverAnim = 1;
        hooks.opened();
      }
    },

    // Ouverture de chaque élytre (0 = fermée, 1 = rabattue sur le côté).
    doorK() {
      return doors.map((d) => easeInOut(Math.max(0, Math.min(1, d.k))));
    },

    hintKey() {
      if (!rep.coverLoose) {
        if (hold && hold.blocked) return 'op.hint.clips_again';
        if (hold) return hold.c.fill < 1 ? 'op.hint.clips_hold' : 'op.hint.clips_push';
        return 'op.hint.clips';
      }
      return 'op.hint.doors';
    },

    // Anneau de maintien autour de chaque clip, puis flèches « écarte » sur les élytres.
    draw(ctx, time) {
      if (!rep.coverLoose) {
        for (const c of clips) {
          if (c.state !== 'on') continue;
          ctx.lineWidth = 12;
          ctx.strokeStyle = 'rgba(255, 247, 236, 0.85)';
          ctx.beginPath(); ctx.arc(c.x, c.y, 66, 0, TAU); ctx.stroke();
          if (c.fill > 0) {
            ctx.strokeStyle = c.fill >= 1 ? C.green : C.orange;
            ctx.beginPath(); ctx.arc(c.x, c.y, 66, -Math.PI / 2, -Math.PI / 2 + TAU * c.fill); ctx.stroke();
          }
          if (c.fill >= 1) {
            const x = c.x + c.dir * 100;
            ctx.fillStyle = C.green;
            ctx.beginPath(); ctx.moveTo(x + c.dir * 36, c.y); ctx.lineTo(x, c.y - 26); ctx.lineTo(x, c.y + 26); ctx.closePath(); ctx.fill();
          }
        }
        return;
      }
      if (rep.coverOpen) return;
      const a = 0.5 + 0.5 * Math.sin(time * 6);
      doors.forEach((d, i) => {
        if (d.open || d.drag) return;
        const side = i ? 1 : -1, x = D.cx + side * 140, y = D.cy + 180;
        ctx.strokeStyle = `rgba(255, 138, 61, ${0.5 + 0.5 * a})`;
        ctx.lineWidth = 14; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - side * 70, y); ctx.lineTo(x + side * 40, y); ctx.stroke();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath(); ctx.moveTo(x + side * 76, y); ctx.lineTo(x + side * 38, y - 30); ctx.lineTo(x + side * 38, y + 30); ctx.closePath(); ctx.fill();
      });
    },
  };
}
