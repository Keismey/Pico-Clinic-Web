// Gestion des scènes : chaque écran a init / update / draw / pointer.
import * as fx from './particles.js';
import { canvas, W, H } from './canvas.js';
import { music, loopStopAll, pitchStop } from './audio.js';

// Musique de chaque écran : opération pendant les gestes, atelier ailleurs.
const MUSIC = { operation: 'op', reactivation: 'op', bench: 'op' };

// Fondu enchaîné : l'image de l'écran qu'on quitte s'efface par-dessus le nouvel écran.
// Utilisé autour de l'écran titre (logo → titre → menu → commandes ou histoire, et retour).
const FADE = 0.4;
const shot = document.createElement('canvas');
let fading = -1; // temps écoulé du fondu, -1 si aucun

export function fadeFrom() {
  if (!canvas.width) return;
  shot.width = canvas.width;
  shot.height = canvas.height;
  shot.getContext('2d').drawImage(canvas, 0, 0);
  fading = 0;
}

export function tickFade(dt) {
  if (fading < 0) return;
  fading += dt;
  if (fading >= FADE) fading = -1;
}

export function drawFade(ctx) {
  if (fading < 0) return;
  const k = fading / FADE;
  ctx.save();
  ctx.globalAlpha = 1 - k * k * (3 - 2 * k); // départ et arrivée en douceur
  ctx.drawImage(shot, 0, 0, W, H);
  ctx.restore();
}

const scenes = {};
let current = null;
let currentName = '';

export function register(name, scene) {
  scenes[name] = scene;
}

export function go(name, params = {}) {
  if (current && (currentName === 'title' || name === 'title')) fadeFrom();
  current = scenes[name];
  currentName = name;
  fx.clear();
  loopStopAll();
  pitchStop();
  music(MUSIC[name] || 'workshop');
  if (current.init) current.init(params);
}

export function scene() {
  return current;
}

export function sceneName() {
  return currentName;
}
