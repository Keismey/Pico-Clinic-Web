// Portraits provisoires en formes simples (remplacés plus tard par les images Gemini) :
// les clients, Gribouille la souris mécanique, et les 12 pièces rares.
import { roundRect } from './ui.js';

const TAU = Math.PI * 2;
const INK = '#3a2a1e';

// Couleurs de chaque client. size = taille relative (Léa est plus petite).
const PEOPLE = {
  lea: { skin: '#f6d2b4', hair: '#6b4226', shirt: '#ffd166', shirt2: '#f2a541', size: 0.86 },
  volute: { skin: '#f3d5bf', hair: '#d8cfe3', shirt: '#9b6cc4', shirt2: '#7a4fa3', size: 1 },
  turbo: { skin: '#e8b48f', hair: '#3a2a1e', shirt: '#e0453a', shirt2: '#1f2937', size: 1 },
  ampere: { skin: '#f1cfb1', hair: '#f7f7f2', shirt: '#fbfbf7', shirt2: '#d6d9d2', size: 1 },
  brindille: { skin: '#d9a27f', hair: '#7a4b2a', shirt: '#3a8f5a', shirt2: '#2a6b43', size: 1.02 },
  mamie: { skin: '#f1cfb1', hair: '#d9dce3', shirt: '#e08aa8', shirt2: '#b5547a', size: 0.98 },
  quartz: { skin: '#b97a57', hair: '#1f1a17', shirt: '#fbfbf7', shirt2: '#3fd0bb', size: 1 },
};

// Clients de passage : quelques variantes choisies par la commande.
const PASSERS = [
  { skin: '#f1c7a5', hair: '#c9772e', shirt: '#5fb8e8', shirt2: '#2f6f9a' },
  { skin: '#8d5a3b', hair: '#231a14', shirt: '#ff8a3d', shirt2: '#c4622a' },
  { skin: '#e9c2a0', hair: '#e8c46a', shirt: '#7cc68a', shirt2: '#4d9a5d' },
  { skin: '#c68e67', hair: '#4b3428', shirt: '#e86f9a', shirt2: '#b84a73' },
  { skin: '#f3d7c0', hair: '#8b8f96', shirt: '#9fa8f0', shirt2: '#6b74c4' },
];

function seedOf(s) {
  let h = 0;
  for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

function circle(ctx, x, y, r, c) {
  ctx.fillStyle = c;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}

function ellipse(ctx, x, y, rx, ry, c, rot = 0) {
  ctx.fillStyle = c;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill();
}

// Frange : le dessus de la tête, avec un bord en zigzag doux sur le front.
function bangs(ctx, color, depth = 38, r = 104) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, -6, r, Math.PI, TAU);
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const x = r - (2 * r * i) / n;
    ctx.quadraticCurveTo(x + r / n, -6 - depth * 0.3, x, -6 - (i % 2 ? depth : depth * 0.55));
  }
  ctx.closePath();
  ctx.fill();
}

// Casquette ou casque : dôme sur le haut de la tête.
function dome(ctx, color, y = -14, r = 108) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, y, r, Math.PI, TAU);
  ctx.closePath();
  ctx.fill();
}

function eyes(ctx, mood, blink) {
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    const x = s * 38;
    if (mood === 'happy') {
      ctx.beginPath(); ctx.arc(x, 12, 14, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    } else if (blink) {
      ctx.beginPath(); ctx.moveTo(x - 12, 6); ctx.lineTo(x + 12, 6); ctx.stroke();
    } else {
      circle(ctx, x, 4, 12, INK);
      circle(ctx, x + 4, 0, 4, '#fff');
    }
  }
}

function brows(ctx, mood, color = INK, w = 7) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    if (mood === 'sad') { ctx.moveTo(s * 20, -22); ctx.lineTo(s * 54, -14); }
    else if (mood === 'stern') { ctx.moveTo(s * 20, -16); ctx.lineTo(s * 56, -22); }
    else { ctx.moveTo(s * 22, -22); ctx.quadraticCurveTo(s * 38, -30, s * 54, -22); }
    ctx.stroke();
  }
}

function mouth(ctx, mood, talk, time) {
  ctx.strokeStyle = '#7a3b2e';
  ctx.fillStyle = '#8a3b2e';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  if (talk) {
    const h = 6 + Math.abs(Math.sin(time * 15)) * 14;
    ellipse(ctx, 0, 52, mood === 'happy' ? 22 : 16, h, '#8a3b2e');
    return;
  }
  ctx.beginPath();
  if (mood === 'happy') {
    ctx.moveTo(-28, 44); ctx.quadraticCurveTo(0, 78, 28, 44); ctx.closePath(); ctx.fill();
  } else if (mood === 'sad') {
    ctx.moveTo(-16, 58); ctx.quadraticCurveTo(0, 46, 16, 58); ctx.stroke();
  } else if (mood === 'stern') {
    ctx.moveTo(-16, 52); ctx.lineTo(16, 52); ctx.stroke();
  } else {
    ctx.moveTo(-18, 48); ctx.quadraticCurveTo(0, 60, 18, 48); ctx.stroke();
  }
}

function torso(ctx, p) {
  ctx.fillStyle = p.shirt;
  roundRect(ctx, -168, 96, 336, 420, 96);
  ctx.fill();
  // cou
  ctx.fillStyle = p.skin;
  roundRect(ctx, -32, 66, 64, 50, 16);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  roundRect(ctx, -32, 92, 64, 24, 10);
  ctx.fill();
}

// Détails propres à chaque client, derrière la tête (back) ou devant (front).
const DETAILS = {
  // Mamie de Léa : cheveux gris en chignon, lunettes rondes, gilet rose
  mamie: {
    back(ctx, p) {
      circle(ctx, 0, -112, 44, p.hair);
      circle(ctx, 0, -112, 20, '#bfc3cc');
    },
    body(ctx, p) {
      ctx.fillStyle = p.shirt2;
      ctx.fillRect(-4, 118, 8, 160);
      ctx.fillStyle = '#fff3d6';
      for (const y of [160, 205, 250]) { ctx.beginPath(); ctx.arc(-26, y, 7, 0, TAU); ctx.fill(); }
    },
    front(ctx, p) {
      bangs(ctx, p.hair, 26);
      ctx.strokeStyle = '#7a4b2a'; ctx.lineWidth = 7;
      for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * 40, 4, 30, 0, TAU); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(-10, 2); ctx.lineTo(10, 2); ctx.stroke();
    },
  },
  lea: {
    back(ctx, p) {
      for (const s of [-1, 1]) {
        ellipse(ctx, s * 122, 18, 36, 46, p.hair, s * 0.3);
        circle(ctx, s * 96, -6, 11, '#ff8a3d');
      }
    },
    body(ctx, p) {
      ctx.fillStyle = p.shirt2;
      ctx.beginPath(); ctx.arc(0, 110, 52, 0, Math.PI); ctx.fill();
      // petit cœur brodé
      ctx.fillStyle = '#e86f9a';
      ctx.beginPath(); ctx.moveTo(-60, 230);
      ctx.bezierCurveTo(-60, 200, -96, 200, -96, 226);
      ctx.bezierCurveTo(-96, 248, -60, 262, -60, 272);
      ctx.bezierCurveTo(-60, 262, -24, 248, -24, 226);
      ctx.bezierCurveTo(-24, 200, -60, 200, -60, 230);
      ctx.fill();
    },
    front(ctx, p) { bangs(ctx, p.hair, 40); },
  },
  volute: {
    back() {},
    body(ctx) {
      for (let i = -4; i <= 4; i++) {
        const a = Math.PI / 2 + i * 0.16;
        circle(ctx, Math.cos(a) * 92, 70 + Math.sin(a) * 70, 10, '#fff8ef');
      }
    },
    front(ctx, p, o) {
      for (const [x, y] of [[-62, -58], [0, -74], [62, -58]]) circle(ctx, x, y, 46, p.hair);
      // grand chapeau à papillon
      ellipse(ctx, 0, -98, 178, 36, '#7a4fa3');
      ctx.fillStyle = '#8e5bb5';
      roundRect(ctx, -88, -190, 176, 100, 44); ctx.fill();
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(-88, -124, 176, 20);
      const flap = 0.75 + 0.25 * Math.sin((o.time || 0) * 6);
      ctx.save();
      ctx.translate(96, -170);
      ctx.scale(flap, 1);
      ellipse(ctx, -22, -10, 26, 18, '#ff8a3d', -0.5);
      ellipse(ctx, 22, -10, 26, 18, '#ff8a3d', 0.5);
      ellipse(ctx, -16, 12, 16, 12, '#ffd166', 0.4);
      ellipse(ctx, 16, 12, 16, 12, '#ffd166', -0.4);
      ctx.restore();
      ellipse(ctx, 96, -168, 6, 22, INK);
      circle(ctx, -96, 40, 8, '#fff8ef');
      circle(ctx, 96, 40, 8, '#fff8ef');
    },
  },
  turbo: {
    back() {},
    body(ctx, p) {
      ctx.fillStyle = p.shirt2;
      roundRect(ctx, -168, 96, 80, 200, 40); ctx.fill();
      roundRect(ctx, 88, 96, 80, 200, 40); ctx.fill();
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(-10, 116, 20, 400);
      circle(ctx, 70, 200, 26, '#fff');
      ctx.fillStyle = INK;
      ctx.font = '900 30px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('1', 70, 202);
    },
    front(ctx, p) {
      dome(ctx, '#e0453a', -10, 110);
      ctx.fillStyle = '#fff';
      ctx.fillRect(-12, -118, 24, 108);
      // lunettes de course sur le front
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(-108, -50, 216, 22);
      for (const s of [-1, 1]) {
        circle(ctx, s * 40, -40, 30, '#1f2937');
        circle(ctx, s * 40, -40, 21, '#3fd0bb');
        circle(ctx, s * 33, -47, 6, '#c9fff6');
      }
    },
  },
  ampere: {
    back(ctx, p) {
      for (const [x, y, r] of [[-104, -40, 36], [-118, 6, 34], [-104, 46, 28], [104, -40, 36], [118, 6, 34], [104, 46, 28], [-70, -86, 30], [70, -86, 30]]) {
        circle(ctx, x, y, r, p.hair);
      }
    },
    body(ctx) {
      ctx.fillStyle = '#e6e8e2';
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(s * 34, 100); ctx.lineTo(s * 110, 120); ctx.lineTo(s * 40, 260); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#ff8a3d';
      ctx.beginPath(); ctx.moveTo(0, 118); ctx.lineTo(-40, 98); ctx.lineTo(-40, 138); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, 118); ctx.lineTo(40, 98); ctx.lineTo(40, 138); ctx.closePath(); ctx.fill();
      circle(ctx, 0, 118, 10, '#c4622a');
      ctx.fillStyle = '#5fb8e8';
      ctx.fillRect(84, 170, 10, 46);
    },
    front(ctx, p) {
      ctx.strokeStyle = p.hair;
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      for (const [a, b] of [[-30, -130], [10, -138], [40, -124]]) {
        ctx.beginPath(); ctx.moveTo(a * 0.5, -96); ctx.quadraticCurveTo(a, -120, b * 0.2 + a, b); ctx.stroke();
      }
      ctx.lineWidth = 7;
      ctx.strokeStyle = '#5b4a3a';
      ctx.fillStyle = 'rgba(200, 230, 255, 0.35)';
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.arc(s * 40, 4, 32, 0, TAU); ctx.fill(); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(-8, 2); ctx.lineTo(8, 2); ctx.stroke();
    },
    browColor: '#e9e9e2',
  },
  brindille: {
    back() {},
    body(ctx) {
      ctx.strokeStyle = '#8f5426';
      ctx.lineWidth = 26;
      ctx.beginPath(); ctx.moveTo(-130, 120); ctx.lineTo(120, 420); ctx.stroke();
      ctx.fillStyle = '#ffd166';
      roundRect(ctx, 50, 170, 70, 46, 10); ctx.fill();
    },
    front(ctx) {
      dome(ctx, '#3a8f5a', -14, 108);
      ellipse(ctx, 60, -22, 92, 20, '#2a6b43');
      circle(ctx, 0, -122, 12, '#2a6b43');
      ctx.fillStyle = '#ffd166';
      roundRect(ctx, -26, -88, 52, 36, 8); ctx.fill();
    },
    mustache: '#7a4b2a',
  },
  quartz: {
    back(ctx, p) {
      ellipse(ctx, 0, -22, 112, 100, p.hair);
      circle(ctx, 0, -120, 44, p.hair);
    },
    body(ctx, p) {
      ctx.fillStyle = p.shirt2;
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(s * 30, 100); ctx.lineTo(s * 96, 112); ctx.lineTo(s * 40, 230); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#25a08d';
      ctx.fillRect(-100, 190, 50, 8);
      ctx.fillStyle = INK;
      ctx.fillRect(-90, 160, 8, 40);
    },
    front(ctx, p) {
      ctx.fillStyle = p.hair;
      ctx.beginPath();
      ctx.arc(0, -8, 106, Math.PI, TAU);
      ctx.quadraticCurveTo(60, -70, -20, -50);
      ctx.quadraticCurveTo(-80, -40, -106, -8);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 6;
      for (const s of [-1, 1]) {
        roundRect(ctx, s * 40 - 32, -16, 64, 40, 10); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(-8, 2); ctx.lineTo(8, 2); ctx.stroke();
    },
  },
  passage: {
    back() {},
    body(ctx, p) {
      ctx.fillStyle = p.shirt2;
      ctx.beginPath(); ctx.arc(0, 104, 46, 0, Math.PI); ctx.fill();
    },
    front(ctx, p) { bangs(ctx, p.hair, 30); },
  },
};

// Silhouette grise d'un client pas encore rencontré.
function drawSilhouette(ctx) {
  const c = 'rgba(122, 99, 80, 0.28)';
  ctx.fillStyle = c;
  roundRect(ctx, -168, 96, 336, 420, 96); ctx.fill();
  circle(ctx, 0, 0, 110, c);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '900 110px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('?', 0, 8);
}

// Dessine un client, le centre de sa tête en (x, y).
// o = { time, talk, mood ('neutral' | 'happy' | 'sad' | 'stern'), seed (clients de passage), unknown }
export function drawPerson(ctx, id, x, y, s, o = {}) {
  const time = o.time || 0;
  const p = PEOPLE[id] || PASSERS[seedOf(o.seed || id) % PASSERS.length];
  const d = DETAILS[id] || DETAILS.passage;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * (p.size || 1), s * (p.size || 1));
  if (o.unknown) { drawSilhouette(ctx); ctx.restore(); return; }
  // respiration
  const breath = Math.sin(time * 2) * 3;
  ctx.translate(0, breath);
  d.back(ctx, p, o);
  torso(ctx, p);
  d.body(ctx, p, o);
  // tête
  circle(ctx, -100, 12, 22, p.skin);
  circle(ctx, 100, 12, 22, p.skin);
  circle(ctx, 0, 0, 104, p.skin);
  ctx.fillStyle = 'rgba(255, 120, 120, 0.22)';
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * 64, 38, 17, 0, TAU); ctx.fill(); }
  const blink = (time % 3.7) < 0.12;
  const mood = o.mood || 'neutral';
  eyes(ctx, mood, blink);
  brows(ctx, mood, d.browColor || INK, d.browColor ? 11 : 7);
  if (d.mustache) {
    ellipse(ctx, -22, 36, 30, 12, d.mustache, 0.15);
    ellipse(ctx, 22, 36, 30, 12, d.mustache, -0.15);
  }
  mouth(ctx, mood, o.talk, time);
  d.front(ctx, p, o);
  ctx.restore();
}

// Gribouille, la souris mécanique de Maître Ohm. (x, y) = centre du corps.
export function drawGribouille(ctx, x, y, s, { time = 0, talk = false } = {}) {
  const grey = '#a3acb6', dark = '#6b7684', pink = '#f2a7b5';
  ctx.save();
  ctx.translate(x, y + Math.sin(time * 3) * 4);
  ctx.scale(s, s);
  // queue en ressort
  ctx.strokeStyle = dark;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(60, 70);
  for (let i = 0; i <= 24; i++) {
    const k = i / 24;
    ctx.lineTo(70 + k * 70 + Math.cos(k * 18) * 12, 70 - k * 50 + Math.sin(k * 18) * 12);
  }
  ctx.stroke();
  // clé de remontage qui tourne
  const turn = Math.cos(time * 4);
  ctx.fillStyle = '#c47a3c';
  ctx.save();
  ctx.translate(-82, 30);
  ctx.fillRect(-26, -6, 26, 12);
  ctx.scale(1, Math.max(0.15, Math.abs(turn)));
  ellipse(ctx, -40, -18, 16, 20, '#c47a3c');
  ellipse(ctx, -40, 18, 16, 20, '#c47a3c');
  circle(ctx, -40, -18, 7, '#8f5426');
  circle(ctx, -40, 18, 7, '#8f5426');
  ctx.restore();
  // corps
  ellipse(ctx, 0, 44, 82, 70, grey);
  ellipse(ctx, 0, 54, 50, 44, '#c7ced6');
  for (const [rx, ry] of [[-56, 30], [56, 30], [-40, 90], [40, 90]]) circle(ctx, rx, ry, 5, dark);
  ellipse(ctx, -40, 108, 24, 12, dark);
  ellipse(ctx, 40, 108, 24, 12, dark);
  // tête et oreilles
  for (const sx of [-1, 1]) {
    circle(ctx, sx * 54, -96, 36, grey);
    circle(ctx, sx * 54, -96, 21, pink);
  }
  circle(ctx, 0, -42, 64, grey);
  circle(ctx, -22, -52, 9, INK);
  circle(ctx, 22, -52, 9, INK);
  circle(ctx, -19, -55, 3, '#fff');
  circle(ctx, 25, -55, 3, '#fff');
  circle(ctx, 0, -26, 11, pink);
  ctx.strokeStyle = dark;
  ctx.lineWidth = 3;
  for (const sx of [-1, 1]) {
    for (const dy of [-6, 4]) {
      ctx.beginPath(); ctx.moveTo(sx * 16, -24 + dy * 0.3); ctx.lineTo(sx * 70, -30 + dy * 2); ctx.stroke();
    }
  }
  if (talk) ellipse(ctx, 0, -6, 9, 4 + Math.abs(Math.sin(time * 15)) * 7, '#8a3b2e');
  else {
    ctx.strokeStyle = INK; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, -14, 9, 0.2, Math.PI - 0.2); ctx.stroke();
  }
  ctx.restore();
}

// ---------- Pièces rares ----------

function gear(ctx, x, y, r, teeth, c, hole) {
  ctx.fillStyle = c;
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i * Math.PI) / teeth;
    const rr = i % 2 ? r * 0.78 : r;
    ctx.lineTo(x + Math.cos(a - 0.12) * rr, y + Math.sin(a - 0.12) * rr);
    ctx.lineTo(x + Math.cos(a + 0.12) * rr, y + Math.sin(a + 0.12) * rr);
  }
  ctx.closePath();
  ctx.fill();
  circle(ctx, x, y, r * 0.3, hole);
}

function spiral(ctx, x, y, r, c, turns = 4, w = 6) {
  ctx.strokeStyle = c;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= 120; i++) {
    const k = i / 120;
    const a = k * turns * TAU;
    ctx.lineTo(x + Math.cos(a) * r * k, y + Math.sin(a) * r * k);
  }
  ctx.stroke();
}

const PARTS = {
  brass_gear(ctx, r) {
    gear(ctx, 0, 0, r, 10, '#d4a646', '#8f6a1e');
    circle(ctx, 0, 0, r * 0.55, '#e6be5e');
    circle(ctx, 0, 0, r * 0.3, '#8f6a1e');
  },
  gold_wire(ctx, r) {
    ctx.fillStyle = '#8f5426';
    roundRect(ctx, -r * 0.7, -r * 0.8, r * 1.4, r * 1.6, 12); ctx.fill();
    ctx.strokeStyle = '#ffcf4a';
    ctx.lineWidth = 5;
    for (let i = 0; i < 7; i++) {
      const yy = -r * 0.6 + i * r * 0.2;
      ctx.beginPath(); ctx.moveTo(-r * 0.6, yy); ctx.lineTo(r * 0.6, yy + 6); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(r * 0.6, r * 0.6); ctx.quadraticCurveTo(r, r, r * 0.9, r * 0.3); ctx.stroke();
  },
  dragonfly_wing(ctx, r) {
    ctx.save();
    ctx.rotate(-0.5);
    ellipse(ctx, 0, 0, r, r * 0.34, 'rgba(191, 233, 255, 0.85)');
    ctx.strokeStyle = '#5fb8e8';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.34, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.stroke();
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath(); ctx.moveTo(i * r * 0.25, 0); ctx.lineTo(i * r * 0.25 + r * 0.12, -r * 0.3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i * r * 0.25, 0); ctx.lineTo(i * r * 0.25 + r * 0.12, r * 0.3); ctx.stroke();
    }
    ctx.restore();
  },
  crystal_lens(ctx, r) {
    circle(ctx, 0, 0, r * 0.85, '#8a6a4a');
    const g = ctx.createRadialGradient(-r * 0.25, -r * 0.25, 4, 0, 0, r * 0.75);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#9fdcf2');
    circle(ctx, 0, 0, r * 0.72, g);
    ellipse(ctx, -r * 0.25, -r * 0.3, r * 0.22, r * 0.1, 'rgba(255,255,255,0.9)', -0.6);
  },
  watch_spring(ctx, r) {
    circle(ctx, 0, 0, r * 0.95, '#efe4d2');
    spiral(ctx, 0, 0, r * 0.85, '#7d8794', 4.5, 6);
  },
  graphite_cell(ctx, r) {
    ctx.fillStyle = '#3a3f46';
    roundRect(ctx, -r * 0.45, -r * 0.8, r * 0.9, r * 1.65, 14); ctx.fill();
    ctx.fillStyle = '#9aa3ad';
    roundRect(ctx, -r * 0.2, -r * 0.98, r * 0.4, r * 0.22, 6); ctx.fill();
    ctx.fillStyle = '#3fd0bb';
    ctx.fillRect(-r * 0.45, -r * 0.1, r * 0.9, r * 0.2);
  },
  silver_fork(ctx, r) {
    ctx.strokeStyle = '#b8c0c8';
    ctx.lineWidth = r * 0.16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, -r * 0.9); ctx.lineTo(-r * 0.3, 0);
    ctx.quadraticCurveTo(-r * 0.3, r * 0.3, 0, r * 0.3);
    ctx.quadraticCurveTo(r * 0.3, r * 0.3, r * 0.3, 0); ctx.lineTo(r * 0.3, -r * 0.9);
    ctx.moveTo(0, r * 0.3); ctx.lineTo(0, r * 0.95);
    ctx.stroke();
  },
  tiny_key(ctx, r) {
    ctx.save();
    ctx.rotate(-0.6);
    ctx.fillStyle = '#e6be5e';
    // anneau en cœur
    ctx.beginPath(); ctx.moveTo(0, -r * 0.35);
    ctx.bezierCurveTo(0, -r * 0.75, -r * 0.6, -r * 0.75, -r * 0.6, -r * 0.4);
    ctx.bezierCurveTo(-r * 0.6, -r * 0.1, 0, r * 0.05, 0, r * 0.2);
    ctx.bezierCurveTo(0, r * 0.05, r * 0.6, -r * 0.1, r * 0.6, -r * 0.4);
    ctx.bezierCurveTo(r * 0.6, -r * 0.75, 0, -r * 0.75, 0, -r * 0.35);
    ctx.fill();
    ctx.fillRect(-r * 0.08, r * 0.1, r * 0.16, r * 0.85);
    ctx.fillRect(0, r * 0.6, r * 0.3, r * 0.12);
    ctx.fillRect(0, r * 0.8, r * 0.22, r * 0.12);
    ctx.restore();
  },
  cut_quartz(ctx, r) {
    const pts = [[0, -r], [r * 0.6, -r * 0.45], [r * 0.6, r * 0.45], [0, r], [-r * 0.6, r * 0.45], [-r * 0.6, -r * 0.45]];
    ctx.fillStyle = '#d9a8ef';
    ctx.beginPath(); pts.forEach(([a, b]) => ctx.lineTo(a, b)); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f1d6fa';
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.6, -r * 0.45); ctx.lineTo(0, 0); ctx.lineTo(-r * 0.6, -r * 0.45); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#b77fd1';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 0.6, r * 0.45); ctx.lineTo(0, r); ctx.closePath(); ctx.fill();
  },
  glass_butterfly(ctx, r, time) {
    const flap = 0.8 + 0.2 * Math.sin(time * 5);
    ctx.save();
    ctx.scale(flap, 1);
    for (const sx of [-1, 1]) {
      ellipse(ctx, sx * r * 0.42, -r * 0.25, r * 0.45, r * 0.38, 'rgba(159, 245, 231, 0.8)', sx * 0.4);
      ellipse(ctx, sx * r * 0.32, r * 0.35, r * 0.28, r * 0.24, 'rgba(191, 233, 255, 0.85)', -sx * 0.4);
    }
    ctx.restore();
    ellipse(ctx, 0, 0, r * 0.08, r * 0.6, '#25a08d');
  },
  golden_chip(ctx, r) {
    ctx.fillStyle = '#c4862a';
    for (let i = -2; i <= 2; i++) {
      ctx.fillRect(i * r * 0.28 - 4, -r * 0.85, 8, r * 1.7);
      ctx.fillRect(-r * 0.85, i * r * 0.28 - 4, r * 1.7, 8);
    }
    ctx.fillStyle = '#ffc93c';
    roundRect(ctx, -r * 0.6, -r * 0.6, r * 1.2, r * 1.2, 10); ctx.fill();
    ctx.fillStyle = '#c4862a';
    ctx.font = `900 ${Math.round(r * 0.7)}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Ω', 0, 4);
  },
  medallion(ctx, r) {
    ctx.strokeStyle = '#d64545';
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(-r * 0.4, -r); ctx.lineTo(0, -r * 0.3); ctx.lineTo(r * 0.4, -r); ctx.stroke();
    circle(ctx, 0, r * 0.15, r * 0.72, '#c4862a');
    circle(ctx, 0, r * 0.15, r * 0.6, '#ffc93c');
    ctx.fillStyle = '#c4862a';
    ctx.font = `900 ${Math.round(r * 0.75)}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Ω', 0, r * 0.2);
  },
};

// Une pièce rare dans un médaillon rond ; si elle n'est pas possédée : un « ? ».
export function drawRarePart(ctx, id, x, y, r, owned, time = 0) {
  ctx.save();
  ctx.translate(x, y);
  if (!owned) {
    ctx.setLineDash([12, 10]);
    ctx.strokeStyle = 'rgba(122, 99, 80, 0.45)';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(122, 99, 80, 0.45)';
    ctx.font = `900 ${Math.round(r * 0.9)}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('?', 0, 4);
  } else {
    const g = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.15);
    g.addColorStop(0, 'rgba(255, 220, 140, 0.55)');
    g.addColorStop(1, 'rgba(255, 220, 140, 0)');
    circle(ctx, 0, 0, r * 1.15, g);
    (PARTS[id] || PARTS.brass_gear)(ctx, r * 0.8, time);
  }
  ctx.restore();
}
