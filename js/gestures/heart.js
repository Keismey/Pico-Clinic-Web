// Cœur-batterie d'une peluche (faible, fragile) — vue rapprochée. Un geste à lui :
// 1) ouvrir la fermeture éclair du ventre en suivant les pointillés ;
// 2) recharger le cœur en le touchant au rythme de ses battements (le cercle qui se resserre
//    doit arriver sur le cœur) : beats bons battements. Taper trop vite = il est fragile (-soin) ;
// 3) refermer la fermeture éclair.
// Précision = part des touches en rythme.
import { C, roundRect, fitText } from '../ui.js';
import { demo } from '../tutorial.js';
import { t } from '../i18n.js';

const TAU = Math.PI * 2;
const HX = 540, HY = 830, HR = 105;
// fermeture éclair : de gauche à droite, légèrement courbée
const ZIP = [];
for (let i = 0; i <= 40; i++) {
  const f = i / 40;
  ZIP.push({ x: 230 + f * 620, y: 520 - Math.sin(f * Math.PI) * 40 });
}
const ZIP_LEN = ZIP.reduce((s, p, i) => (i ? s + Math.hypot(p.x - ZIP[i - 1].x, p.y - ZIP[i - 1].y) : 0), 0);

function zipAt(f) {
  const k = Math.max(0, Math.min(1, f)) * (ZIP.length - 1);
  const i = Math.min(ZIP.length - 2, Math.floor(k));
  const g = k - i;
  return { x: ZIP[i].x + (ZIP[i + 1].x - ZIP[i].x) * g, y: ZIP[i].y + (ZIP[i + 1].y - ZIP[i].y) * g };
}

// Avancement 0..1 du point le plus proche de (x, y) sur la fermeture, et sa distance.
function zipProject(x, y) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < ZIP.length; i++) {
    const d = Math.hypot(x - ZIP[i].x, y - ZIP[i].y);
    if (d < bd) { bd = d; best = i / (ZIP.length - 1); }
  }
  return { f: best, d: bd };
}

function hash(a, b) {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.5, y + s * 0.1, x - s * 1.1, y - s * 1.1, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 1.1, y - s * 1.1, x + s * 1.5, y + s * 0.1, x, y + s * 0.9);
  ctx.closePath();
}

export function createHeart(params, fx) {
  let step = 'open';      // open → beat → close → done
  let zip = 0;            // 0 = fermée, 1 = ouverte
  let zipDrag = false;
  let clock = 0;          // temps du battement
  let charge = 0;
  let good = 0, miss = 0;
  let lastTap = -9;
  let pop = 0;
  let time = 0;

  const period = params.period;
  // temps jusqu'au prochain battement (le cercle arrive sur le cœur à chaque multiple de period)
  const phase = () => (clock % period) / period;

  return {
    get done() { return step === 'done'; },
    get info() { return { step, phase: phase(), charge, zip }; },  // pour les tests automatiques

    down(x, y) {
      if (step === 'open' || step === 'close') {
        const p = zipAt(zip);
        if (Math.hypot(x - p.x, y - p.y) > params.zip_grab) return false;
        zipDrag = true;
        fx.vibrate(8);
        return true;
      }
      if (step !== 'beat' || Math.hypot(x - HX, y - HY) > HR * 1.9) return false;
      // touche : en rythme si le cercle est (presque) sur le cœur
      const ph = phase();
      const off = Math.min(ph, 1 - ph) * period;
      if (time - lastTap < params.spam) {
        fx.care(params.spam_cost);
        fx.bad('sec.heart.soft', { n: params.spam_cost });
        fx.vibrate([40, 30, 40]);
        lastTap = time;
        return true;
      }
      lastTap = time;
      if (off <= params.window) {
        good++;
        charge++;
        pop = 1;
        fx.vibrate(30);
        fx.spawn(HX, HY - HR * 0.4, { count: 10, color: '#ff8fb1', speed: 300, size: 7 });
        if (charge >= params.beats) {
          step = 'close';
          fx.ok('sec.heart.full');
        }
      } else {
        miss++;
        fx.info('sec.heart.miss');
        fx.vibrate(10);
      }
      return true;
    },

    move(x, y) {
      if (!zipDrag) return;
      const p = zipProject(x, y);
      if (p.d > params.zip_tol) { zipDrag = false; fx.info('sec.heart.zip_off'); return; }
      // la tirette ne suit le doigt que dans le bon sens, et pas trop d'un coup
      if (step === 'open' && p.f > zip) zip = Math.min(p.f, zip + 0.15);
      if (step === 'close' && p.f < zip) zip = Math.max(p.f, zip - 0.15);
    },

    up() {
      zipDrag = false;
    },

    update(dt) {
      time += dt;
      pop = Math.max(0, pop - dt * 3);
      if (step === 'open' && zip >= 0.97) {
        zip = 1;
        zipDrag = false;
        step = 'beat';
        clock = period * 0.1;
        fx.vibrate([10, 20, 10]);
        fx.ok('sec.heart.opened');
      }
      if (step === 'beat') clock += dt;
      if (step === 'close' && zip <= 0.03) {
        zip = 0;
        zipDrag = false;
        step = 'done';
        fx.score(good + miss ? Math.max(0.5, good / (good + miss)) : 1);
        fx.vibrate([10, 20, 40]);
        fx.ok('sec.heart.in');
      }
    },

    hint() {
      return { open: 'sec.heart.open', beat: 'sec.heart.beat', close: 'sec.heart.close', done: 'sec.heart.close' }[step];
    },

    tutoKey() {
      return step === 'beat' ? 'tuto.sec.heart3' : step === 'open' ? 'tuto.sec.heart2' : 'tuto.sec.heart4';
    },

    sub(tr) {
      return step === 'beat' ? tr('sec.heart.charge', { n: charge, total: params.beats }) : null;
    },

    demo() {
      if (step === 'open') {
        const pts = [];
        for (let f = zip; f <= 1.0001; f += 0.1) { const p = zipAt(f); pts.push([p.x, p.y]); }
        return demo.path(pts.length > 1 ? pts : [[zipAt(zip).x, zipAt(zip).y], [ZIP[40].x, ZIP[40].y]], 0.2, 300);
      }
      if (step === 'close') {
        const pts = [];
        for (let f = zip; f >= -0.0001; f -= 0.1) { const p = zipAt(f); pts.push([p.x, p.y]); }
        return demo.path(pts.length > 1 ? pts : [[ZIP[40].x, ZIP[40].y], [ZIP[0].x, ZIP[0].y]], 0.2, 300);
      }
      if (step === 'beat') return demo.tap(HX, HY);
      return null;
    },

    draw(ctx) {
      // ventre de la peluche : tissu doux avec des petits poils, couture tout autour
      ctx.fillStyle = '#f4c9a2';
      roundRect(ctx, 100, 410, 880, 830, 150); ctx.fill();
      ctx.save();
      ctx.beginPath(); roundRect(ctx, 100, 410, 880, 830, 150); ctx.clip();
      for (let k = 0; k < 260; k++) {
        const fx0 = 100 + hash(k, 1) * 880, fy0 = 410 + hash(k, 2) * 830;
        ctx.strokeStyle = hash(k, 3) > 0.5 ? 'rgba(255, 238, 220, 0.55)' : 'rgba(196, 140, 100, 0.35)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(fx0, fy0); ctx.quadraticCurveTo(fx0 + 5, fy0 - 7, fx0 + 3, fy0 - 14); ctx.stroke();
      }
      ctx.restore();
      ctx.save();
      ctx.setLineDash([16, 12]);
      ctx.strokeStyle = '#c98c62';
      ctx.lineWidth = 5;
      roundRect(ctx, 122, 432, 836, 786, 132); ctx.stroke();
      ctx.restore();

      // la pochette (feutrine rose cousue sur le ventre)
      const PX = 200, PY = 470, PW = 680, PH = 700;
      ctx.fillStyle = 'rgba(120, 60, 40, 0.18)';
      roundRect(ctx, PX + 6, PY + 12, PW, PH, 70); ctx.fill();
      ctx.fillStyle = '#ef8fa6';
      roundRect(ctx, PX, PY, PW, PH, 70); ctx.fill();
      ctx.save();
      ctx.setLineDash([14, 10]);
      ctx.strokeStyle = '#fff3f5';
      ctx.lineWidth = 5;
      roundRect(ctx, PX + 18, PY + 18, PW - 36, PH - 36, 56); ctx.stroke();
      ctx.restore();
      // petit cœur brodé sur la pochette (fermée)
      if (zip < 0.3) {
        ctx.save();
        ctx.globalAlpha = 1 - zip / 0.3;
        heartPath(ctx, HX, HY + 120, 60);
        ctx.fillStyle = '#ff5c8a'; ctx.fill();
        ctx.strokeStyle = '#fff3f5'; ctx.lineWidth = 6; ctx.setLineDash([10, 8]); ctx.stroke();
        ctx.restore();
      }

      // l'intérieur, découvert de la gauche jusqu'à la tirette
      const tp = zipAt(zip);
      // refermée (étape « done ») : on ne montre plus l'intérieur
      const openR = step === 'beat' ? PX + PW - 30 : tp.x;
      if (openR > PX + 40) {
        ctx.save();
        ctx.beginPath(); ctx.rect(PX, PY, openR - PX, PH); ctx.clip();
        const g = ctx.createRadialGradient(HX, HY, 40, HX, HY, 420);
        g.addColorStop(0, '#8e2f45');
        g.addColorStop(1, '#4a1424');
        ctx.fillStyle = g;
        roundRect(ctx, PX + 30, PY + 40, PW - 60, PH - 70, 50); ctx.fill();
        // bord du tissu replié
        ctx.strokeStyle = '#f7b3c2';
        ctx.lineWidth = 10;
        roundRect(ctx, PX + 30, PY + 40, PW - 60, PH - 70, 50); ctx.stroke();
        this.drawHeartPiece(ctx);
        ctx.restore();
      }

      // fermeture éclair : dents serrées (partie fermée), dents écartées (partie ouverte)
      for (let k = 0; k <= 60; k++) {
        const f = k / 60;
        const p = zipAt(f);
        const open = f < zip;
        const spread = open ? 22 : 0;
        ctx.fillStyle = '#d7dde3';
        const side = k % 2 ? 1 : -1;
        ctx.fillRect(p.x - 5, p.y + side * (6 + spread) - 6, 10, 12);
      }
      // tirette
      ctx.fillStyle = '#aeb6c0';
      roundRect(ctx, tp.x - 18, tp.y - 16, 36, 32, 8); ctx.fill();
      ctx.fillStyle = '#8b939d';
      roundRect(ctx, tp.x - 16, tp.y + 10, 32, 62, 12); ctx.fill();
      ctx.strokeStyle = '#4a525c';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = '#4a525c';
      ctx.beginPath(); ctx.arc(tp.x, tp.y + 52, 8, 0, TAU); ctx.fill();
      if ((step === 'open' || step === 'close') && !zipDrag) {
        const a = 0.5 + 0.5 * Math.sin(time * 6);
        ctx.strokeStyle = `rgba(255, 138, 61, ${0.35 + 0.5 * a})`;
        ctx.lineWidth = 7;
        ctx.beginPath(); ctx.arc(tp.x, tp.y + 26, 62 + 6 * a, 0, TAU); ctx.stroke();
      }
    },

    // Le cœur-batterie dans la pochette : bornes, fils, reflet, pastilles de charge.
    drawHeartPiece(ctx) {
      const lv = charge / params.beats;
      const ph = step === 'beat' ? phase() : 0.5;
      const near = Math.min(ph, 1 - ph);
      const beatPop = step === 'beat' ? Math.max(0, 1 - near * 8) * 0.07 : 0;
      const sc = 1 + beatPop + pop * 0.12;
      const full = step === 'close' || step === 'done';
      // halo qui bat
      const glow = full ? 0.55 : 0.15 + 0.4 * lv;
      const hg = ctx.createRadialGradient(HX, HY, HR * 0.6, HX, HY, HR * 2.2);
      hg.addColorStop(0, `rgba(255, 120, 160, ${glow * (0.6 + beatPop * 5)})`);
      hg.addColorStop(1, 'rgba(255, 120, 160, 0)');
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(HX, HY, HR * 2.2, 0, TAU); ctx.fill();
      // fils vers les bords de la pochette
      ctx.lineCap = 'round';
      ctx.lineWidth = 10;
      ctx.strokeStyle = '#d64545';
      ctx.beginPath(); ctx.moveTo(HX - 46, HY - HR * 0.75); ctx.quadraticCurveTo(HX - 160, HY - 200, HX - 280, HY - 150); ctx.stroke();
      ctx.strokeStyle = '#2b2f33';
      ctx.beginPath(); ctx.moveTo(HX + 46, HY - HR * 0.75); ctx.quadraticCurveTo(HX + 160, HY - 200, HX + 280, HY - 150); ctx.stroke();
      // bornes
      ctx.fillStyle = '#c9ced4';
      ctx.fillRect(HX - 60, HY - HR * 0.85, 28, 22);
      ctx.fillRect(HX + 32, HY - HR * 0.85, 28, 22);
      // le cœur (dégradé + reflet)
      ctx.save();
      ctx.translate(HX, HY);
      ctx.scale(sc, sc);
      const weak = [196, 120, 140], strong = [255, 76, 122];
      const mix = full ? 1 : lv;
      const col = weak.map((w, i) => Math.round(w + (strong[i] - w) * mix));
      const g = ctx.createLinearGradient(0, -HR, 0, HR);
      g.addColorStop(0, `rgb(${Math.min(255, col[0] + 30)}, ${col[1] + 40}, ${col[2] + 40})`);
      g.addColorStop(1, `rgb(${col[0] - 40}, ${Math.max(0, col[1] - 40)}, ${Math.max(0, col[2] - 30)})`);
      heartPath(ctx, 0, 0, HR);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#8a1d3d';
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath(); ctx.ellipse(-48, -44, 26, 15, -0.6, 0, TAU); ctx.fill();
      ctx.restore();
      // cercle qui se resserre : toucher quand il arrive sur le cœur (cible en pointillés)
      if (step === 'beat') {
        ctx.save();
        ctx.setLineDash([12, 10]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(HX, HY - 6, HR * 1.12, 0, TAU); ctx.stroke();
        ctx.restore();
        const r = HR * 1.12 + (1 - ph) * 200;
        const ok = near * period <= params.window;
        ctx.strokeStyle = ok ? 'rgba(95, 224, 139, 0.95)' : 'rgba(255, 220, 230, 0.9)';
        ctx.lineWidth = ok ? 14 : 8;
        ctx.beginPath(); ctx.arc(HX, HY - 6, r, 0, TAU); ctx.stroke();
      }
      // pastilles de charge (petits cœurs)
      for (let k = 0; k < params.beats; k++) {
        const x = HX + (k - (params.beats - 1) / 2) * 62, y = HY + HR + 95;
        heartPath(ctx, x, y, 20);
        ctx.fillStyle = k < charge || full ? '#ff5c8a' : 'rgba(255, 255, 255, 0.18)';
        ctx.fill();
      }
      if (step === 'beat' && good + miss === 0) fitText(ctx, t('sec.heart.listen'), HX, HY + HR + 160, 560, 32, '#ffe4ea', 800);
    },
  };
}
