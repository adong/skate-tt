/* TT Skate Park: the autopilot. It skates the trick lines (SK.park.lines): steer to each spot, keep the speed,
   ollie where the line says, and do the line's trick the next time it's in the air. The CPU friends 🦊 Foxy and
   🐸 Froggy skate with it, the brother rides a line with it when he shows it to you, and the check uses it to
   prove every line works. No Three.js. */
(function (root) {
  'use strict';
  const SK = (root.SK = root.SK || {});
  const P = SK.park, wrap = SK.skater.wrap;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const gr = { gx: 0, gz: 0 };

  // skill: 0 = perfect; Foxy ~0.15, Froggy ~0.6 (wobbly steering, late or forgotten tricks)
  function create(o = {}) {
    return {
      rnd: SK.skater.rng(o.seed || 11), skill: o.skill || 0, line: null, i: 0, pending: null, grab: false, spinGoal: 0,
      flipDir: '', stuckT: 0, done: 0, recent: [], wob: 0, wobT: 0, lines: o.lines || P.lines, loop: !!o.loop, lastJump: -9, rest: o.rest || 0, slowT: 0, boost: o.boost || 0,
    };
  }

  function setLine(b, line, from) {
    b.line = line;
    b.i = from || 0;
    b.pending = null;
    b.grab = false;
    b.spinGoal = 0;
    b.stuckT = 0;
  }

  // the next line for a CPU friend: one of the nearer ones it hasn't skated lately, ahead of it if possible
  function pickLine(b, s) {
    const md = s.sp >= 0 ? s.th : s.th + Math.PI;
    let best = null, bestV = Infinity;
    for (const ln of b.lines) {
      if (b.recent.includes(ln.id)) continue;
      const st = ln.steps[0], dx = st.x - s.x, dz = st.z - s.z, d = Math.hypot(dx, dz);
      const ahead = (dx * Math.cos(md) + dz * Math.sin(md)) / (d || 1);
      const v = d * (1.6 - ahead * 0.6) + b.rnd() * 6;
      if (v < bestV) { bestV = v; best = ln; }
    }
    best = best || b.lines[0];
    b.slowT = b.rest; // cruise over to it slowly first (the CPU friends' pace)
    b.recent.push(best.id);
    if (b.recent.length > Math.min(3, b.lines.length - 1)) b.recent.shift();
    setLine(b, best, 0);
  }

  // in the air or on a rail: steps flown past still count (their jump is too late now, their trick isn't)
  function passSteps(b, s) {
    while (b.line && b.i > 0) {
      const st = b.line.steps[b.i], pv = b.line.steps[b.i - 1];
      const sx = st.x - pv.x, sz = st.z - pv.z, l2 = sx * sx + sz * sz || 1;
      const u = ((s.x - pv.x) * sx + (s.z - pv.z) * sz) / l2;
      if (u < 1 && Math.hypot(st.x - s.x, st.z - s.z) > 1.4) return;
      if (st.air && !b.pending) { b.pending = st.air; b.flipDir = st.dir || ''; }
      b.i++;
      if (b.i >= b.line.steps.length) { b.line = null; b.done++; }
    }
  }

  function think(b, s) {
    const inp = { steer: 0, push: false, brake: false, jump: false, flip: false, grab: false, dir: '' };
    if (s.mode === 'bail') return inp;
    // a wobbly skater's hands are a little off
    b.wobT -= SK.skater.DT;
    if (b.wobT <= 0) { b.wobT = 0.3 + b.rnd() * 0.5; b.wob = (b.rnd() * 2 - 1) * b.skill; }
    if (b.line && s.mode !== 'ground') passSteps(b, s);
    if (s.mode === 'grind') {
      if (!s.L.safe) inp.steer = clamp(-(s.balance * 3.2 + s.balDrift * 0.55) + b.wob * 0.5, -1, 1);
      return inp;
    }
    if (s.mode === 'air') {
      const a = s.air;
      if (b.pending && a.t > 0.06) {
        if (b.skill && b.rnd() < b.skill * 0.35) b.pending = null; // forgot
        else if (b.pending === 'flip') {
          // NORMAL: only with time to finish it before the ground
          const g = 9.8 * s.L.grav, hh = s.y - P.H(s.x, s.z);
          const tLand = (s.vy + Math.sqrt(Math.max(0, s.vy * s.vy + 2 * g * hh))) / g;
          if (s.L.safe || tLand > 0.6) { inp.flip = true; inp.dir = b.flipDir; }
        }
        else if (b.pending === 'grab') b.grab = true;
        else if (b.pending === 'spin') b.spinGoal = Math.PI;
        b.pending = null;
      }
      if (b.grab) inp.grab = true;
      if (b.spinGoal) {
        if (Math.abs(a.spinUser) < b.spinGoal - 0.12) inp.steer = 1;
        else b.spinGoal = 0;
      }
      return inp;
    }
    b.grab = false;
    b.spinGoal = 0;
    if (!b.line) {
      if (!b.loop) return inp;
      pickLine(b, s);
    }
    const st = b.line.steps[b.i];
    const md = s.sp >= -0.2 ? s.th : s.th + Math.PI;
    const dx = st.x - s.x, dz = st.z - s.z, dist = Math.hypot(dx, dz);
    const err = wrap(Math.atan2(dz, dx) - md);
    inp.steer = clamp(err * 2.6 + b.wob, -1, 1);
    // going up a big wall with the spot behind: don't carve, the wall turns him round
    {
      P.H(s.x, s.z, gr);
      const up = (gr.gx * Math.cos(md) + gr.gz * Math.sin(md));
      if (up > 0.45 && Math.abs(err) > 1.6) inp.steer = 0;
    }
    if (b.i >= 1) b.slowT = 0;
    b.slowT -= SK.skater.DT;
    const tv = b.slowT > 0 ? 3.5 : (st.v || b.v || 7) + (b.boost || 0);
    if (st.v) b.v = st.v;
    if (s.sp < tv - 0.3) inp.push = true;
    P.H(s.x, s.z, gr);
    const downhill = (gr.gx * Math.cos(md) + gr.gz * Math.sin(md)) < -0.35;
    if (downhill && !s.L.safe) inp.push = true; // pump down the transitions
    else if (s.sp > tv + 1.6) inp.brake = true;
    // reached: close to it, or past it along the line from the step before (a gate across the line)
    const pv = b.i > 0 ? b.line.steps[b.i - 1] : null;
    let gate = false;
    if (pv) {
      const sx = st.x - pv.x, sz = st.z - pv.z, l2 = sx * sx + sz * sz || 1;
      const u = ((s.x - pv.x) * sx + (s.z - pv.z) * sz) / l2;
      const lat = Math.abs((s.x - pv.x) * sz - (s.z - pv.z) * sx) / Math.sqrt(l2);
      gate = u >= 1 && lat < 5;
    }
    if (dist < (st.jump ? 0.4 : 1.4) || gate) {
      if (st.jump) {
        const late = b.skill ? (b.rnd() < b.skill * 0.3) : false;
        if (!late) { inp.jump = true; b.lastJump = s.t; }
      }
      b.pending = st.air || null;
      b.flipDir = st.dir || '';
      b.i++;
      if (b.i >= b.line.steps.length) { b.line = null; b.done++; }
    } else if (!s.L.autoOllie && s.t - b.lastJump > 0.6) {
      // NORMAL: hop over a bar rail in the way (unless this spot is where we ollie onto one)
      const la = 0.6 + Math.abs(s.sp) * 0.14;
      const r = SK.skater.railInWay(s.x, s.z, s.x + Math.cos(md) * la, s.z + Math.sin(md) * la, 0.3);
      if (r && !st.jump) { inp.jump = true; b.lastJump = s.t; }
    }
    // stuck against something: back off and try again
    if (Math.abs(s.sp) < 0.7) b.stuckT += SK.skater.DT; else b.stuckT = 0;
    if (b.stuckT > 1.2) { inp.steer = 1; inp.push = true; if (b.stuckT > 2.6) { b.stuckT = 0; if (b.line) b.i = Math.min(b.i + 1, b.line.steps.length - 1); } }
    return inp;
  }

  SK.bot = { create, setLine, pickLine, think };
})(typeof window !== 'undefined' ? window : globalThis);
