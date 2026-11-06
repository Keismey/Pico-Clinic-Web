// Sons et musiques (Web Audio).
// Si un fichier existe dans audio/ (listé dans audio/sons.json), on le joue.
// Sinon, le son est fabriqué en code, comme les dessins du jeu.
// Noms des fichiers attendus : voir audio/LISEZMOI.md.
import { save } from './save.js';

let ac = null, master, musicBus, sfxBus, noiseBuf = null;
const files = {};      // nom -> AudioBuffer décodé
// Musiques : gardées compressées (4 Mo), une seule décodée à la fois (une musique décodée pèse 40 à 60 Mo).
const raw = {};        // nom -> fichier MP3 (ArrayBuffer)
const decoding = {};   // nom -> décodage en cours
let manifestLoaded = false;
const loopPoints = {}; // nom -> [début, fin] de la boucle en secondes (sons.json « loops »)

// ---------- Mise en route (au premier toucher : les navigateurs l'exigent) ----------

function ctx() {
  if (ac) return ac;
  const A = window.AudioContext || window.webkitAudioContext;
  if (!A) return null;
  try {
    ac = new A();
    master = ac.createGain();
    master.gain.value = 0.9;
    master.connect(ac.destination);
    musicBus = ac.createGain();
    musicBus.gain.value = musicLevel();
    musicBus.connect(master);
    sfxBus = ac.createGain();
    sfxBus.gain.value = sfxLevel();
    sfxBus.connect(master);
    // bruit blanc partagé (aspirateur, soudure, cliquetis)
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    document.addEventListener('visibilitychange', () => {
      try { if (document.hidden) ac.suspend(); else ac.resume(); } catch (e) { /* rien */ }
    });
  } catch (e) {
    ac = null;
  }
  return ac;
}

// V4b : volumes réglés dans l'écran Options (musique 60 % et sons 80 % par défaut,
// ce qui donne les mêmes niveaux qu'avant les réglages).
const MUSIC_MAX = 0.92;
function musicLevel() { return save.settings.music ? MUSIC_MAX * (save.settings.musicVol ?? 0.6) : 0; }
function sfxLevel() { return save.settings.sound ? (save.settings.sfxVol ?? 0.8) : 0; }
const FILE_MUSIC_GAIN = 0.6;

export function unlock() {
  const a = ctx();
  if (!a) return;
  // « suspended », ou « interrupted » sur iPhone après un appel ou une alarme
  if (a.state !== 'running') { try { a.resume(); } catch (e) { /* rien */ } }
  // iPhone : un son muet joué pendant le toucher débloque l'audio
  if (!unlock.done) {
    unlock.done = true;
    try {
      const s = a.createBufferSource();
      s.buffer = a.createBuffer(1, 1, 22050);
      s.connect(a.destination);
      s.start(0);
    } catch (e) { /* rien */ }
    loadFiles();
    if (wantedMusic) startMusic(wantedMusic);
  }
}

// Charge les fichiers listés dans audio/sons.json (s'il existe).
async function loadFiles() {
  if (manifestLoaded) return;
  manifestLoaded = true;
  let list = [];
  try {
    const r = await fetch('audio/sons.json', { cache: 'no-cache' });
    if (r.ok) {
      const j = await r.json();
      list = j.files || [];
      Object.assign(loopPoints, j.loops || {});
    }
  } catch (e) { return; }
  await Promise.all(list.map(async (name) => {
    try {
      const r = await fetch('audio/' + name + '.mp3');
      if (!r.ok) return;
      const buf = await r.arrayBuffer();
      if (isMusic(name)) raw[name] = buf;
      else files[name] = await decode(buf);
    } catch (e) { /* le son en code prend le relais */ }
  }));
  // la musique en fichier est arrivée : elle remplace la version en code
  if (wantedMusic && raw['music_' + wantedMusic]) prepareMusic(wantedMusic);
}

const isMusic = (name) => name.startsWith('music_');

function decode(buf) {
  return new Promise((ok, ko) => ac.decodeAudioData(buf, ok, ko));
}

// Décode la musique demandée et libère l'autre. Pendant le décodage, la musique attend (pas de version en code).
function prepareMusic(name) {
  const key = 'music_' + name;
  if (files[key] || decoding[key] || !raw[key]) return;
  decoding[key] = true;
  for (const k of Object.keys(files)) if (isMusic(k)) delete files[k];
  decode(raw[key].slice(0)).then((buf) => {
    // l'écran a changé de musique pendant le décodage : on ne garde pas celle-ci
    if (wantedMusic !== name) return;
    for (const k of Object.keys(files)) if (isMusic(k)) delete files[k];
    files[key] = buf;
  }, () => {
    delete raw[key]; // fichier illisible : la version en code prend le relais
  }).then(() => {
    delete decoding[key];
    if (wantedMusic === name && !(playing && playing.src && playing.name === name)) { stopMusic(); startMusic(name); }
  });
}

function playFile(name, vol = 1, rate = 1, bus = sfxBus) {
  const s = ac.createBufferSource();
  s.buffer = files[name];
  s.playbackRate.value = rate;
  const g = ac.createGain();
  g.gain.value = vol;
  s.connect(g); g.connect(bus);
  s.start();
  return s;
}

// ---------- Petites briques de synthèse ----------

function tone(t, freq, dur, { type = 'sine', vol = 0.3, attack = 0.004, to = null, bus = sfxBus, filter = null } = {}) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let last = g;
  o.connect(g);
  if (filter) {
    const f = ac.createBiquadFilter();
    f.type = filter.type || 'lowpass';
    f.frequency.value = filter.freq;
    g.connect(f);
    last = f;
  }
  last.connect(bus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(t, dur, { vol = 0.3, type = 'bandpass', freq = 2000, q = 1, to = null, attack = 0.003, bus = sfxBus } = {}) {
  const s = ac.createBufferSource();
  s.buffer = noiseBuf;
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  f.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(bus);
  s.start(t, Math.random() * 1.5);
  s.stop(t + dur + 0.05);
}

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// ---------- Effets sonores fabriqués en code ----------

const SYNTH = {
  click: (t) => tone(t, 880, 0.05, { type: 'triangle', vol: 0.12 }),
  // vis qui tourne : petit cliquet métallique (plus grave si rouillée)
  screw_turn: (t, o) => {
    noise(t, 0.03, { vol: 0.22, freq: o.rusty ? 1800 : 4200, q: 6 });
    tone(t, o.rusty ? 900 : 1700 + Math.random() * 200, 0.03, { type: 'square', vol: 0.03 });
  },
  screw_out: (t) => {
    tone(t, 700, 0.12, { type: 'triangle', vol: 0.18, to: 1500 });
    noise(t + 0.1, 0.05, { vol: 0.2, freq: 5000, q: 4 });
  },
  // visseuse turbo : petit « bzzz » qui monte
  turbo: (t) => { tone(t, 220, 0.28, { type: 'sawtooth', vol: 0.05, to: 660, filter: { freq: 1800 } }); noise(t, 0.25, { vol: 0.06, freq: 2500, to: 5000, q: 3 }); },
  screw_tray: (t) => tone(t, 2400 + Math.random() * 300, 0.12, { type: 'sine', vol: 0.08 }),
  slip: (t) => { noise(t, 0.12, { vol: 0.25, freq: 3000, to: 900, q: 3 }); tone(t, 300, 0.12, { type: 'square', vol: 0.04, to: 180 }); },
  plate: (t) => { tone(t, 150, 0.2, { vol: 0.35, to: 70 }); noise(t, 0.08, { vol: 0.18, type: 'lowpass', freq: 900 }); },
  grab: (t) => { noise(t, 0.025, { vol: 0.18, freq: 3500, q: 5 }); noise(t + 0.045, 0.025, { vol: 0.14, freq: 4200, q: 5 }); },
  connect: (t) => { noise(t, 0.03, { vol: 0.3, freq: 2500, q: 4 }); tone(t, 1200, 0.08, { type: 'triangle', vol: 0.12 }); tone(t + 0.06, 1800, 0.12, { vol: 0.08 }); },
  // puce qui s'enclenche : clac + petit tintement
  chip: (t) => {
    noise(t, 0.035, { vol: 0.32, freq: 2800, q: 3 });
    tone(t + 0.03, 2637, 0.35, { type: 'sine', vol: 0.09 });
    tone(t + 0.03, 3951, 0.25, { type: 'sine', vol: 0.04 });
  },
  chip_out: (t) => { noise(t, 0.05, { vol: 0.25, freq: 1800, q: 2 }); tone(t, 500, 0.1, { type: 'triangle', vol: 0.08, to: 300 }); },
  snap_hint: (t) => tone(t, 1500, 0.04, { type: 'sine', vol: 0.06 }),
  miss: (t) => tone(t, 320, 0.12, { type: 'triangle', vol: 0.1, to: 240 }),
  error: (t) => { tone(t, 220, 0.13, { type: 'square', vol: 0.06, filter: { freq: 1200 } }); tone(t + 0.14, 165, 0.18, { type: 'square', vol: 0.06, filter: { freq: 1200 } }); },
  // court-circuit : claquement électrique
  short: (t) => {
    for (let i = 0; i < 6; i++) noise(t + i * 0.035 + Math.random() * 0.02, 0.04, { vol: 0.45, freq: 2500 + Math.random() * 3000, q: 1 });
    tone(t, 60, 0.35, { type: 'sawtooth', vol: 0.15, filter: { freq: 600 } });
  },
  // soudure froide / brûlée : pschit sourd
  cold: (t) => { noise(t, 0.35, { vol: 0.25, type: 'lowpass', freq: 1500, to: 300 }); tone(t, 200, 0.2, { vol: 0.1, to: 110 }); },
  weld_done: (t) => { tone(t, 1319, 0.2, { type: 'triangle', vol: 0.1 }); tone(t + 0.08, 1976, 0.3, { type: 'triangle', vol: 0.09 }); },
  rust: (t) => noise(t, 0.08, { vol: 0.12, freq: 1200, to: 3200, q: 2 }),
  fragile: (t) => { noise(t, 0.15, { vol: 0.35, freq: 3000, q: 1 }); tone(t, 90, 0.25, { type: 'square', vol: 0.08, filter: { freq: 500 } }); },
  // loupe : panne trouvée / rien ici
  found: (t) => { tone(t, 988, 0.12, { type: 'triangle', vol: 0.12 }); tone(t + 0.1, 740, 0.22, { type: 'triangle', vol: 0.12 }); },
  diag_done: (t) => [784, 988, 1175].forEach((f, i) => tone(t + i * 0.08, f, 0.25, { type: 'triangle', vol: 0.09 })),
  zoom: (t) => noise(t, 0.18, { vol: 0.08, freq: 800, to: 3000, q: 2 }),
  // geste secondaire réussi / raté
  ok: (t) => { tone(t, 1047, 0.15, { type: 'triangle', vol: 0.1 }); tone(t + 0.09, 1568, 0.25, { type: 'triangle', vol: 0.1 }); },
  bad: (t) => tone(t, 260, 0.2, { type: 'square', vol: 0.06, to: 180, filter: { freq: 1000 } }),
  tick: (t) => noise(t, 0.02, { vol: 0.12, freq: 3800, q: 5 }),
  spring: (t) => {
    const o = ac.createOscillator(), g = ac.createGain(), l = ac.createOscillator(), lg = ac.createGain();
    o.type = 'sine'; o.frequency.value = 330; l.frequency.value = 18; lg.gain.value = 60;
    l.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g); g.connect(sfxBus); o.start(t); l.start(t); o.stop(t + 0.55); l.stop(t + 0.55);
  },
  thump: (t) => tone(t, 110, 0.18, { vol: 0.35, to: 55 }),
  // réactivation
  lever: (t) => { noise(t, 0.04, { vol: 0.3, freq: 1500, q: 2 }); tone(t + 0.02, 180, 0.15, { type: 'square', vol: 0.06, filter: { freq: 800 } }); },
  cough: (t) => {
    for (let i = 0; i < 4; i++) {
      const s = t + i * 0.28 + Math.random() * 0.06;
      tone(s, 70, 0.2, { type: 'sawtooth', vol: 0.18, to: 45, filter: { freq: 500 } });
      noise(s, 0.18, { vol: 0.15, type: 'lowpass', freq: 700 });
    }
  },
  rotor_start: (t) => {
    const o = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o.type = 'sawtooth'; o2.type = 'sawtooth';
    o.frequency.setValueAtTime(40, t); o.frequency.exponentialRampToValueAtTime(260, t + 1.8);
    o2.frequency.setValueAtTime(41, t); o2.frequency.exponentialRampToValueAtTime(264, t + 1.8);
    f.type = 'lowpass'; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2200, t + 1.8);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.4);
    g.gain.setValueAtTime(0.12, t + 2.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(sfxBus);
    o.start(t); o2.start(t); o.stop(t + 3.5); o2.stop(t + 3.5);
  },
  lights: (t) => { tone(t, 1568, 0.3, { vol: 0.07 }); tone(t + 0.12, 2093, 0.4, { vol: 0.07 }); },
  // jingle de réussite : notes cristallines qui montent puis accord lumineux
  jingle: (t) => {
    [72, 76, 79, 84, 88].forEach((n, i) => {
      tone(t + i * 0.11, midi(n), 0.6, { type: 'triangle', vol: 0.11 });
      tone(t + i * 0.11, midi(n + 12), 0.4, { type: 'sine', vol: 0.04 });
    });
    [72, 76, 79, 83].forEach((n) => tone(t + 0.62, midi(n), 1.8, { type: 'triangle', vol: 0.07, attack: 0.02 }));
    tone(t + 0.62, midi(48), 1.5, { vol: 0.12 });
  },
  // argent, étoiles, boutique
  coin: (t) => { tone(t, 1976, 0.08, { type: 'square', vol: 0.05, filter: { freq: 5000 } }); tone(t + 0.07, 2637, 0.3, { type: 'square', vol: 0.05, filter: { freq: 5000 } }); },
  coin_tick: (t) => tone(t, 2200 + Math.random() * 400, 0.05, { type: 'triangle', vol: 0.05 }),
  star: (t, o) => {
    const base = [76, 79, 84][o.i || 0];
    tone(t, midi(base), 0.4, { type: 'triangle', vol: 0.12 });
    tone(t + 0.06, midi(base + 7), 0.5, { type: 'sine', vol: 0.07 });
    noise(t, 0.2, { vol: 0.05, type: 'highpass', freq: 6000 });
  },
  buy: (t) => {
    SYNTH.coin(t);
    [67, 71, 74, 79].forEach((n, i) => tone(t + 0.15 + i * 0.05, midi(n), 0.35, { type: 'triangle', vol: 0.07 }));
  },
  fanfare: (t) => {
    [60, 64, 67, 72].forEach((n, i) => tone(t + i * 0.13, midi(n), 0.35, { type: 'square', vol: 0.05, filter: { freq: 2500 } }));
    [60, 64, 67, 72, 76].forEach((n) => tone(t + 0.55, midi(n), 1.4, { type: 'triangle', vol: 0.06, attack: 0.02 }));
  },
  page: (t) => noise(t, 0.12, { vol: 0.08, freq: 1500, to: 4000, q: 1 }),
};

// Joue un effet. o : options (rusty, i…).
export function sfx(name, o = {}) {
  if (!save.settings.sound) return;
  const a = ctx();
  if (!a || a.state !== 'running') return;
  try {
    if (files[name]) playFile(name, o.vol || 1, o.rate || 1);
    else if (SYNTH[name]) SYNTH[name](a.currentTime + 0.005, o);
  } catch (e) { console.warn('son', name, e); }
  if (name === 'jingle') duck(4);
}

// ---------- Sons en boucle : aspirateur, soudure ----------

const loops = {};

function makeLoop(name) {
  const g = ac.createGain();
  g.gain.value = 0;
  g.connect(sfxBus);
  if (files[name]) {
    const s = ac.createBufferSource();
    s.buffer = files[name];
    s.loop = true;
    s.connect(g);
    s.start();
    return { g, nodes: [s], file: true };
  }
  const s = ac.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = ac.createBiquadFilter();
  s.connect(f); f.connect(g);
  const nodes = [s];
  let hum = null;
  if (name === 'vacuum') {
    f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.7;
    hum = ac.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 118;
    const hf = ac.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 400;
    const hg = ac.createGain(); hg.gain.value = 0.25;
    hum.connect(hf); hf.connect(hg); hg.connect(g);
    hum.start(); nodes.push(hum);
  } else {
    // soudure : grésillement qui crépite
    f.type = 'bandpass'; f.frequency.value = 3000; f.Q.value = 1.2;
    const lfo = ac.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 23;
    const lg = ac.createGain(); lg.gain.value = 0.35;
    const amp = ac.createGain(); amp.gain.value = 0.65;
    f.disconnect(); f.connect(amp); amp.connect(g);
    lfo.connect(lg); lg.connect(amp.gain);
    lfo.start(); nodes.push(lfo);
    loops._lfo = lfo;
  }
  s.start();
  return { g, f, hum, nodes };
}

// Démarre ou règle une boucle. level 0..1 : régime de l'aspirateur, chaleur du fer.
export function loop(name, level = 1) {
  if (!save.settings.sound) return;
  const a = ctx();
  if (!a || a.state !== 'running') return;
  try {
    let L = loops[name];
    if (!L) L = loops[name] = makeLoop(name);
    const now = a.currentTime;
    const vol = name === 'vacuum' ? 0.10 + 0.08 * level : 0.06 + 0.1 * level;
    L.g.gain.setTargetAtTime(vol, now, 0.04);
    if (L.file) { L.nodes[0].playbackRate.setTargetAtTime(0.9 + 0.2 * level, now, 0.05); return; }
    if (name === 'vacuum') {
      L.f.frequency.setTargetAtTime(700 + 900 * level, now, 0.05);
      if (L.hum) L.hum.frequency.setTargetAtTime(105 + 30 * level, now, 0.05);
    } else {
      L.f.frequency.setTargetAtTime(2200 + 3500 * level, now, 0.05);
      if (loops._lfo) loops._lfo.frequency.setTargetAtTime(14 + 30 * Math.random(), now, 0.02);
    }
  } catch (e) { console.warn('boucle', name, e); }
}

export function loopStop(name) {
  const L = loops[name];
  if (!L || !ac) return;
  delete loops[name];
  try {
    L.g.gain.setTargetAtTime(0, ac.currentTime, 0.04);
    const end = ac.currentTime + 0.3;
    for (const n of L.nodes) n.stop(end);
  } catch (e) { /* rien */ }
}

export function loopStopAll() {
  for (const k of Object.keys(loops)) if (k[0] !== '_') loopStop(k);
}

// ---------- Son continu du capteur (monte quand on approche du signal) ----------

let pOsc = null, pGain = null;
export function pitch(freq) {
  if (!save.settings.sound) return;
  const a = ctx();
  if (!a || a.state !== 'running') return;
  try {
    if (!pOsc) {
      pOsc = a.createOscillator();
      pGain = a.createGain();
      pOsc.type = 'sine';
      pGain.gain.value = 0;
      pOsc.connect(pGain);
      pGain.connect(sfxBus);
      pOsc.start();
    }
    pOsc.frequency.setTargetAtTime(freq, a.currentTime, 0.03);
    pGain.gain.setTargetAtTime(0.08, a.currentTime, 0.03);
  } catch (e) { /* rien */ }
}

export function pitchStop() {
  try { if (pGain && ac) pGain.gain.setTargetAtTime(0, ac.currentTime, 0.05); } catch (e) { /* rien */ }
}

// ---------- Musiques ----------
// 'workshop' : atelier, lo-fi doux 85 BPM. 'op' : opération, minimaliste 100 BPM.

let wantedMusic = null;   // musique demandée par l'écran
let playing = null;       // { name, src?, timer?, step, next }

function duck(sec) {
  if (!ac || !save.settings.music) return;
  const now = ac.currentTime;
  musicBus.gain.cancelScheduledValues(now);
  musicBus.gain.setTargetAtTime(musicLevel() * 0.2, now, 0.05);
  musicBus.gain.setTargetAtTime(musicLevel(), now + sec, 0.6);
}

export function music(name) {
  wantedMusic = name;
  if (playing && playing.name === name) return;
  stopMusic();
  if (name) startMusic(name);
}

function startMusic(name) {
  const a = ctx();
  if (!a || a.state !== 'running' || !save.settings.music) return;
  if (playing && playing.name === name) return;
  const file = files['music_' + name];
  // musique en fichier pas encore décodée : elle démarrera à la fin du décodage
  if (!file && raw['music_' + name]) { prepareMusic(name); return; }
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, a.currentTime);
  g.gain.exponentialRampToValueAtTime(1, a.currentTime + 1.5);
  g.connect(musicBus);
  playing = { name, out: g };
  // les vrais morceaux sont plus forts que la version en code : on les baisse un peu
  if (file) g.gain.cancelScheduledValues(a.currentTime), g.gain.setValueAtTime(0.0001, a.currentTime), g.gain.exponentialRampToValueAtTime(FILE_MUSIC_GAIN, a.currentTime + 1.5);
  if (file) {
    const s = a.createBufferSource();
    s.buffer = file;
    s.loop = true;
    // l'intro se joue une fois, puis on boucle entre les deux points choisis au découpage
    const lp = loopPoints['music_' + name];
    if (lp) { s.loopStart = lp[0]; s.loopEnd = Math.min(lp[1], file.duration); }
    s.connect(g);
    s.start();
    playing.src = s;
    return;
  }
  const P = PIECES[name];
  playing.step = 0;
  playing.next = a.currentTime + 0.1;
  playing.timer = setInterval(() => schedule(P), 30);
  schedule(P);
}

function stopMusic() {
  if (!playing || !ac) { playing = null; return; }
  const p = playing;
  playing = null;
  if (p.timer) clearInterval(p.timer);
  try {
    p.out.gain.cancelScheduledValues(ac.currentTime);
    p.out.gain.setTargetAtTime(0.0001, ac.currentTime, 0.25);
    if (p.src) p.src.stop(ac.currentTime + 1.2);
    setTimeout(() => { try { p.out.disconnect(); } catch (e) { /* rien */ } }, 1500);
  } catch (e) { /* rien */ }
}

function schedule(P) {
  const p = playing;
  if (!p || !p.timer || document.hidden) return;
  const dur = 60 / P.bpm / P.sub;
  while (p.next < ac.currentTime + 0.25) {
    P.play(p.next, p.step, dur, p.out);
    p.step++;
    p.next += dur;
  }
}

// Petites voix d'instruments
function vibes(t, n, out, vol = 0.05, len = 1.6) {
  const f = midi(n);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  const trem = ac.createOscillator(), tg = ac.createGain();
  trem.frequency.value = 5.2; tg.gain.value = vol * 0.35;
  trem.connect(tg); tg.connect(g.gain);
  const o1 = ac.createOscillator(), o2 = ac.createOscillator(), g2 = ac.createGain();
  o1.frequency.value = f; o2.frequency.value = f * 4; g2.gain.value = 0.12;
  o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(out);
  for (const o of [o1, o2, trem]) { o.start(t); o.stop(t + len + 0.05); }
}

function bass(t, n, out, len, vol = 0.16) {
  tone(t, midi(n), len, { type: 'triangle', vol, attack: 0.02, bus: out, filter: { freq: 420 } });
}

function pluck(t, n, out, vol = 0.045) {
  tone(t, midi(n), 0.22, { type: 'triangle', vol, attack: 0.002, bus: out, filter: { freq: 2600 } });
}

function hat(t, out, vol = 0.025) {
  noise(t, 0.03, { vol, type: 'highpass', freq: 7000, bus: out });
}

function kick(t, out, vol = 0.18) {
  tone(t, 95, 0.22, { vol, to: 42, bus: out });
}

function pad(t, notes, out, len, vol = 0.012) {
  for (const n of notes) {
    for (const d of [-6, 6]) {
      const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
      o.type = 'sawtooth'; o.frequency.value = midi(n); o.detune.value = d;
      f.type = 'lowpass'; f.frequency.value = 900;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + len * 0.3);
      g.gain.linearRampToValueAtTime(0.0001, t + len);
      o.connect(f); f.connect(g); g.connect(out);
      o.start(t); o.stop(t + len + 0.05);
    }
  }
}

// Petite suite pseudo-aléatoire stable (la musique varie sans être n'importe quoi)
function rnd(i) {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

const PIECES = {
  workshop: {
    bpm: 85, sub: 2, // croches ; 8 par mesure
    chords: [[41, [57, 60, 64, 69, 72]], [40, [55, 59, 62, 67, 71]], [38, [57, 60, 62, 65, 69]], [36, [55, 59, 64, 67, 71]]],
    play(t, step, dur, out) {
      const s = step % 8, bar = Math.floor(step / 8), [root, tones] = this.chords[bar % 4];
      if (s === 0) { bass(t, root, out, dur * 5); kick(t, out, 0.12); if (bar % 2 === 0) for (const n of tones.slice(0, 3)) vibes(t, n, out, 0.022, 2.5); }
      if (s === 4) kick(t, out, 0.07);
      if (s === 5) bass(t, root + 7, out, dur * 2.5, 0.1);
      if (s === 6) bass(t, root + 12, out, dur * 2, 0.08);
      // cliquetis d'atelier sur les contretemps
      if (s % 2 === 1) hat(t + dur * 0.08, out, 0.018 + 0.01 * rnd(step));
      if (s === 3 || s === 7) noise(t, 0.04, { vol: 0.03, freq: 1800, q: 6, bus: out });
      // mélodie de vibraphone
      if ([0, 2, 3, 5, 6].includes(s) && rnd(step * 3.1) > 0.35) vibes(t, tones[Math.floor(rnd(step * 7.7) * tones.length)] + 12, out, 0.04);
    },
  },
  op: {
    bpm: 100, sub: 4, // doubles croches ; 16 par mesure
    chords: [[45, [69, 72, 76, 81]], [41, [69, 72, 77, 81]], [48, [67, 72, 76, 79]], [43, [67, 71, 74, 79]]],
    play(t, step, dur, out) {
      const s = step % 16, bar = Math.floor(step / 16), [root, tones] = this.chords[bar % 4];
      // pulsation douce
      if (s % 4 === 0) bass(t, root, out, dur * 3, s === 0 ? 0.15 : 0.09);
      if (s === 0) pad(t, tones.slice(0, 3).map((n) => n - 12), out, dur * 16);
      if (s === 4 || s === 12) hat(t, out, 0.02);
      if (s % 2 === 1) hat(t, out, 0.008);
      // pizzicato en arpège
      const pat = [0, 3, 6, 8, 11, 14];
      if (pat.includes(s)) pluck(t, tones[(pat.indexOf(s) + bar) % tones.length], out, bar % 8 >= 4 ? 0.05 : 0.04);
      if (bar % 8 >= 4 && s === 10) pluck(t, tones[3] + 12, out, 0.025);
    },
  },
};

// Réglages : son et musique
export function setSound(on) {
  save.settings.sound = on;
  if (!on) { loopStopAll(); pitchStop(); }
  if (ac) sfxBus.gain.setTargetAtTime(sfxLevel(), ac.currentTime, 0.05);
}

// Volumes (0 à 1) de l'écran Options. 0 = coupé.
export function setMusicVol(v) {
  save.settings.musicVol = v;
  const on = v > 0;
  if (on !== save.settings.music) { setMusic(on); return; }
  if (ac) musicBus.gain.setTargetAtTime(musicLevel(), ac.currentTime, 0.08);
}

export function setSfxVol(v) {
  save.settings.sfxVol = v;
  setSound(v > 0);
}

export function setMusic(on) {
  save.settings.music = on;
  const a = ctx();
  if (!a) return;
  musicBus.gain.cancelScheduledValues(a.currentTime);
  musicBus.gain.setTargetAtTime(musicLevel(), a.currentTime, 0.1);
  if (on) { const w = wantedMusic; stopMusic(); wantedMusic = w; if (w) startMusic(w); } else { const w = wantedMusic; stopMusic(); wantedMusic = w; }
}

// Pour les tests automatiques
export const debug = { get state() { return ac ? ac.state : 'none'; }, get music() { return playing ? playing.name : null; }, get files() { return Object.keys(files); } };
