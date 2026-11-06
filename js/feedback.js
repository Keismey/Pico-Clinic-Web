import { save } from './save.js';
import { pitch, pitchStop } from './audio.js';

// Vibration courte.
// Appli Android : module Capacitor « Haptics » (la WebView d'Android ignore navigator.vibrate).
// Navigateur Android : navigator.vibrate. iPhone (iOS 18 et plus) : pas de vibrate, mais un interrupteur
// caché qu'on bascule donne un petit « tic » du moteur haptique (seulement pendant un toucher).
let iosSwitch = null;
let lastIos = 0;

function iosTap() {
  try {
    if (!iosSwitch) {
      const label = document.createElement('label');
      label.style.cssText = 'position:fixed;left:-100px;top:-100px;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      label.appendChild(input);
      document.body.appendChild(label);
      iosSwitch = label;
    }
    iosSwitch.click();
  } catch (e) { /* rien */ }
}

// Module Haptics de l'appli Android (absent dans le navigateur).
function haptics() {
  const C = window.Capacitor;
  const P = C && C.Plugins;
  return C && C.isNativePlatform && C.isNativePlatform() && P && P.Haptics ? P.Haptics : null;
}

// Motif [vibre, pause, vibre…] joué pas à pas (Haptics ne connaît qu'une durée à la fois).
function nativeVibrate(h, pattern) {
  const steps = Array.isArray(pattern) ? pattern : [pattern];
  let at = 0;
  steps.forEach((ms, i) => {
    if (i % 2 === 0 && ms > 0) setTimeout(() => { h.vibrate({ duration: Math.round(ms) }).catch(() => {}); }, at);
    at += ms;
  });
}

export function vibrate(pattern) {
  if (!save.settings.vibration) return;
  try {
    const h = haptics();
    if (h) { nativeVibrate(h, pattern); return; }
    if (navigator.vibrate) { navigator.vibrate(pattern); return; }
    // iPhone : un seul tic, pas plus de 12 par seconde (les vibrations continues sont ignorées)
    const ms = Array.isArray(pattern) ? pattern.reduce((a, b) => a + b, 0) : pattern;
    const now = performance.now();
    if (ms < 6 || now - lastIos < 80) return;
    lastIos = now;
    iosTap();
  } catch (e) { /* rien */ }
}

// Petit son continu (capteur : il monte quand on approche du signal).
export function tone(freq) { pitch(freq); }
export function toneStop() { pitchStop(); }
