/* TT Skate Park: trick points and combos. No Three.js, so node can check it.
   A combo is every trick from the moment you leave the ground (or hit a rail) until you've been rolling for a
   moment without starting another one. Its score is the sum of its tricks times the multiplier, which is how many
   tricks are in it (a plain ollie adds points but not to the multiplier). The same trick again in one combo is worth
   half as much each time, so mixing tricks up pays. A bail loses the combo. */
(function (root) {
  'use strict';
  const SK = (root.SK = root.SK || {});

  // name: [points, points per second held (grabs, grinds, air time), the most seconds that count]
  const TRICKS = {
    OLLIE: [50, 0, 0],
    AIR: [100, 100, 3],
    'VERT AIR': [150, 150, 3],
    KICKFLIP: [300, 0, 0],
    HEELFLIP: [300, 0, 0],
    'POP SHOVE-IT': [250, 0, 0],
    '360 FLIP': [500, 0, 0],
    INDY: [200, 300, 2],
    MELON: [200, 300, 2],
    NOSEGRAB: [250, 300, 2],
    TAILGRAB: [250, 300, 2],
    '50-50': [150, 200, 4],
    BOARDSLIDE: [200, 250, 4],
    '180': [150, 0, 0],
    '360': [400, 0, 0],
    '540': [800, 0, 0],
    '720': [1200, 0, 0],
    '900': [2000, 0, 0],
  };
  const NO_MULT = { OLLIE: true };
  const r10 = (v) => Math.round(v / 10) * 10;

  function points(name, secs) {
    const t = TRICKS[name];
    if (!t) return 0;
    return r10(t[0] + t[1] * Math.min(secs || 0, t[2]));
  }

  function newCombo() { return { tricks: [], sum: 0, mult: 0, counts: {} }; }

  // add a trick to a combo; returns the points it's worth here
  function add(c, name, secs) {
    const k = c.counts[name] || 0;
    c.counts[name] = k + 1;
    const pts = Math.max(10, r10(points(name, secs) * Math.pow(0.5, k)));
    c.tricks.push({ name, pts });
    c.sum += pts;
    if (!NO_MULT[name] && !(SK.sab && SK.sab.mult)) c.mult++; // SK.sab: the check's sabotage switches
    return pts;
  }
  const mult = (c) => Math.max(1, c.mult);
  const value = (c) => c.sum * mult(c);

  SK.score = { TRICKS, points, newCombo, add, mult, value };
})(typeof window !== 'undefined' ? window : globalThis);
