/* TT Skate Park: the sounds, all synthesised through Kit.sound (so the one mute switch covers them).
   The wheels' roll and the grind are short noise bursts the game asks for many times a second. */
(function () {
  'use strict';
  const S = () => Kit.sound;
  const tone = (o) => S().tone(o), hiss = (o) => S().hiss(o);
  const sfx = {
    roll(speed) { hiss({ filter: 'lowpass', f: 260 + speed * 50, q: 0.7, dur: 0.11, vol: Math.min(0.09, 0.012 + speed * 0.008) }); },
    grind() { hiss({ f: 2600 + Math.random() * 900, q: 3, dur: 0.08, vol: 0.06 }); hiss({ f: 5200, q: 2, dur: 0.05, vol: 0.025 }); },
    pop() { tone({ type: 'triangle', f: 210, to: 90, dur: 0.07, vol: 0.32 }); hiss({ f: 1800, q: 1.2, dur: 0.04, vol: 0.18 }); },
    land(big) { S().land(); if (big) tone({ type: 'sine', f: 90, to: 45, dur: 0.18, vol: 0.35 }); },
    flip() { S().swish(); },
    grab() { tone({ type: 'square', f: 520, to: 700, dur: 0.06, vol: 0.05, lp: 2400 }); },
    trick(n) { tone({ type: 'triangle', f: 660 * Math.pow(1.122, Math.min(8, n)), dur: 0.1, vol: 0.12 }); },
    grindStart() { hiss({ f: 3200, to: 2400, q: 2, dur: 0.2, vol: 0.12 }); tone({ type: 'square', f: 880, to: 660, dur: 0.08, vol: 0.04, lp: 3000 }); },
    combo(n) { S().coin(Math.min(12, n)); if (n >= 3) [0, 0.08, 0.16].forEach((at, i) => tone({ type: 'triangle', f: [784, 988, 1175][i], at, dur: 0.14, vol: 0.12 })); },
    bail() { S().stumble(); tone({ type: 'sawtooth', f: 300, to: 120, dur: 0.3, vol: 0.08, lp: 900 }); },
    bonk() { S().bump(); },
    star() { [0, 0.06].forEach((at, i) => tone({ type: 'sine', f: [1320, 1760][i], at, dur: 0.12, vol: 0.14 })); },
    lineDone() { [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.08, dur: 0.2, vol: 0.14 })); },
    beep(go) { tone({ type: 'square', f: go ? 988 : 660, dur: go ? 0.35 : 0.14, vol: 0.09, lp: 3200 }); },
    tick() { tone({ type: 'square', f: 1400, dur: 0.03, vol: 0.05, lp: 4000 }); },
    horn() { S().horn(0.7); },
    fanfare() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone({ type: 'square', f, at: i * 0.13, dur: i === 5 ? 0.5 : 0.14, vol: 0.07, lp: 3000 })); },
    poof() { hiss({ f: 900, to: 300, q: 0.8, dur: 0.3, vol: 0.18 }); },
    swish() { S().swish(); },
    treat() { tone({ type: 'sine', f: 880, to: 1320, dur: 0.15, vol: 0.14 }); },
    highFive() { hiss({ f: 2400, q: 1.5, dur: 0.06, vol: 0.3 }); tone({ type: 'triangle', f: 990, dur: 0.12, vol: 0.12, at: 0.03 }); },
    click() { S().click(); },
  };
  window.SK.sfx = sfx;
})();
