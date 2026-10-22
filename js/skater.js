/* TT Skate Park: the skater, his board and the tricks. No Three.js, so node can run it (tools/check.js).
   Fixed steps of 1/120 s. On the ground the board rolls where it points (wheels don't slide sideways): a heading
   and a speed along it, pulled by gravity on slopes. Off a lip, a crest or an ollie he flies, and lands on whatever
   is under him; flying into the side of a ramp bounces him off it. A launch off a steep transition is "vert": he goes
   straight up and comes back down the same wall, turning round in the air. Near a rail on the way down he locks on
   and grinds.
   EASY (Tommy): he cruises by himself, pops off kickers and ollies onto rails and ledges in his way, rails pull him
   in, every flip finishes, every landing is lined up for him, and nothing ever makes him fall.
   NORMAL (Teddy): push, time your ollies, finish the flip and land straight, and keep your balance on a rail. */
(function (root) {
  'use strict';
  const SK = (root.SK = root.SK || {});
  const P = SK.park, S = SK.score;
  SK.sab = SK.sab || {}; // the check's sabotage switches (tools/check.js --fail); always off in the game
  const DT = 1 / 120, G = 9.8, STEP = 0.3, MAXV = 12.5;
  const TAU = Math.PI * 2;
  const wrap = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  const LEVEL = {
    easy: { safe: true, grav: 0.88, pop: 4.4, cruise: 6.3, maxPush: 8.5, turn: 2.5, spin: 5.6, snapR: 1.1, snapAng: 1.15, snapUp: 1.4,
      window: 2.6, vertMin: 5.4, kickPop: 2.6, autoOllie: true, pump: 1.8, revert: 0.3, climb: 0.55 },
    normal: { safe: false, grav: 1, pop: 4.3, cruise: 0, maxPush: 9, turn: 2.8, spin: 6.2, snapR: 0.55, snapAng: 0.62, snapUp: 0.45,
      window: 1.3, vertMin: 0, kickPop: 0, autoOllie: false, pump: 0, revert: 0.6 },
  };
  const FLIP_DUR = { KICKFLIP: 0.42, HEELFLIP: 0.42, 'POP SHOVE-IT': 0.36, '360 FLIP': 0.58 };
  const flipFor = (dir) => (dir === 'left' ? 'HEELFLIP' : dir === 'down' ? 'POP SHOVE-IT' : dir === 'up' ? '360 FLIP' : 'KICKFLIP');
  const grabFor = (dir) => (dir === 'left' ? 'MELON' : dir === 'up' ? 'NOSEGRAB' : dir === 'down' ? 'TAILGRAB' : 'INDY');

  function rng(seed) {
    let a = seed >>> 0 || 1;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function create(o = {}) {
    const sp = o.spawn || P.spawn;
    const s = {
      id: o.id || 'p1', level: o.level || 'easy', L: LEVEL[o.level || 'easy'], rnd: rng(o.seed || 7),
      x: sp.x, z: sp.z, y: 0, th: sp.heading, sp: 0, vx: 0, vy: 0, vz: 0,
      mode: 'ground', air: null, grind: null, lastRail: null, railCool: 0, balance: 0, balDrift: 0,
      bailT: 0, fakieT: 0, landT: 9, popT: 9, t: 0,
      combo: null, comboT: 0, score: 0, bestCombo: 0, events: [],
      stats: { airs: 0, landed: 0, bails: 0, flips: 0, flipsDone: 0, grabs: 0, grinds: 0, combos: 0, tricks: 0, walls: 0, maxPen: 0, trickNames: {} },
    };
    s.y = P.H(s.x, s.z);
    return s;
  }
  function setLevel(s, level) { s.level = level; s.L = LEVEL[level]; }
  function place(s, x, z, heading, speed) {
    s.x = x; s.z = z; s.y = P.H(x, z); s.th = heading; s.sp = speed || 0;
    s.mode = 'ground'; s.air = null; s.grind = null; s.combo = null; s.vx = s.vy = s.vz = 0;
  }

  const ev = (s, type, o) => { s.events.push(Object.assign({ type, t: s.t }, o)); };

  // ---- combos ----
  function openCombo(s) { if (!s.combo) s.combo = S.newCombo(); s.comboT = 0; }
  const MAX_TRICKS = 12; // a combo this long banks at the next landing (EASY's half-pipe could go on for ever)
  function trick(s, name, secs) {
    openCombo(s);
    const pts = S.add(s.combo, name, secs);
    s.stats.tricks++;
    s.stats.trickNames[name] = (s.stats.trickNames[name] || 0) + 1;
    ev(s, 'trick', { name, pts, mult: S.mult(s.combo) });
  }
  function bank(s) {
    const c = s.combo;
    s.combo = null;
    if (!c || !c.tricks.length) return;
    const pts = S.value(c);
    s.score += pts;
    s.bestCombo = Math.max(s.bestCombo, pts);
    s.stats.combos++;
    ev(s, 'combo', { pts, mult: S.mult(c), tricks: c.tricks.map((t) => t.name), sum: c.sum });
  }
  // finish an open combo now (the end of a run)
  function finish(s) { if (s.mode === 'ground' || s.mode === 'bail') bank(s); }

  function bail(s, why) {
    if (s.combo && s.combo.tricks.length) ev(s, 'lost', { pts: S.value(s.combo) });
    s.combo = null;
    s.stats.bails++;
    ev(s, 'bail', { why });
    s.mode = 'bail';
    s.bailT = 0;
    s.air = null;
    s.grind = null;
    s.y = P.H(s.x, s.z);
    s.sp *= 0.35;
  }

  // ---- the ground ----
  const go = { gx: 0, gz: 0 }, g1 = { gx: 0, gz: 0 }, ga = { gx: 0, gz: 0 };
  const out = (x, z) => x < P.bounds.x0 + 0.35 || x > P.bounds.x1 - 0.35 || z < P.bounds.z0 + 0.35 || z > P.bounds.z1 - 0.35;

  // closest distance between the 2D segments p0-p1 and q0-q1, and where along q (0..1)
  function segDist(px0, pz0, px1, pz1, qx0, qz0, qx1, qz1) {
    const ptSeg = (x, z, ax, az, bx, bz) => {
      const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-9;
      const u = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1);
      return [Math.hypot(x - ax - dx * u, z - az - dz * u), u];
    };
    // proper crossing
    const d1x = px1 - px0, d1z = pz1 - pz0, d2x = qx1 - qx0, d2z = qz1 - qz0;
    const den = d1x * d2z - d1z * d2x;
    if (Math.abs(den) > 1e-9) {
      const ta = ((qx0 - px0) * d2z - (qz0 - pz0) * d2x) / den, tb = ((qx0 - px0) * d1z - (qz0 - pz0) * d1x) / den;
      if (ta >= 0 && ta <= 1 && tb >= 0 && tb <= 1) return [0, tb];
    }
    let best = ptSeg(px0, pz0, qx0, qz0, qx1, qz1);
    const b2 = ptSeg(px1, pz1, qx0, qz0, qx1, qz1);
    if (b2[0] < best[0]) best = b2;
    for (const [x, z, u] of [[qx0, qz0, 0], [qx1, qz1, 1]]) {
      const d = ptSeg(x, z, px0, pz0, px1, pz1)[0];
      if (d < best[0]) best = [d, u];
    }
    return best;
  }
  // a bar rail (not a ledge, that's part of the ground) within `near` of the path, at a height that's in the way
  function railInWay(x0, z0, x1, z1, near) {
    for (const r of P.rails) {
      if (r.kind !== 'rail') continue;
      const [d, u] = segDist(x0, z0, x1, z1, r.a[0], r.a[2], r.b[0], r.b[2]);
      if (d > near) continue;
      const rx = r.a[0] + (r.b[0] - r.a[0]) * u, rz = r.a[2] + (r.b[2] - r.a[2]) * u;
      const clear = P.railY(r, u) - P.H(rx, rz);
      if (clear > 0.15 && clear < 1.3) return r;
    }
    return null;
  }

  function wallBounce(s, x1, z1, yRef) {
    const blocked = (x, z) => out(x, z) || P.H(x, z) - yRef > STEP;
    const bx = blocked(x1, s.z), bz = blocked(s.x, z1);
    let dx = Math.cos(s.th), dz = Math.sin(s.th);
    if (bx && !bz) dx = -dx;
    else if (bz && !bx) dz = -dz;
    else { dx = -dx; dz = -dz; }
    s.th = Math.atan2(dz, dx);
    s.sp *= 0.45;
    s.stats.walls++;
    ev(s, 'bonk');
  }

  function groundStep(s, inp, bailing) {
    const L = s.L;
    const h0 = P.H(s.x, s.z, go);
    if (!bailing) {
      const turn = L.turn * (Math.abs(s.sp) < 3 ? 1 : 1 - Math.min(0.35, (Math.abs(s.sp) - 3) * 0.045));
      s.th = wrap(s.th + inp.steer * turn * DT);
    }
    const dx = Math.cos(s.th), dz = Math.sin(s.th);
    const slope = go.gx * dx + go.gz * dz;
    const cosA = 1 / Math.sqrt(1 + slope * slope), sinA = slope * cosA;
    const sg = Math.sign(s.sp);
    // EASY: big ramps are easier to climb, so he always gets up to the lip
    let a = -G * sinA * (L.climb && sinA * s.sp > 0 && slope > 0.8 ? L.climb : 1);
    if (Math.abs(s.sp) > 0.05) a -= sg * (0.28 + 0.01 * s.sp * s.sp);
    if (bailing) a -= sg * 6;
    else {
      if (inp.push && Math.abs(slope) < 0.6 && s.sp < L.maxPush) a += 4.2;
      if (L.cruise && !inp.brake && Math.abs(slope) < 0.5 && s.sp > -0.3 && s.sp < L.cruise) a += 3.2;
      const pump = L.pump || (inp.push ? 2.2 : 0);
      if (pump && Math.abs(slope) > 0.35 && s.sp * sinA < 0) a += sg * pump; // pumping down a transition
      if (inp.brake && Math.abs(s.sp) > 0.1) a -= sg * 5.5;
    }
    const before = s.sp;
    s.sp = clamp(s.sp + a * DT, -MAXV, MAXV);
    if ((bailing || inp.brake) && Math.abs(slope) < 0.1 && before * s.sp < 0) s.sp = 0; // brakes stop, not reverse
    // rolling backwards on the flat for a moment: turn round to ride forwards (a revert)
    if (!bailing && s.sp < -0.4 && Math.abs(slope) < 0.12) {
      s.fakieT += DT;
      if (s.fakieT > L.revert) { s.th = wrap(s.th + Math.PI); s.sp = -s.sp; s.fakieT = 0; ev(s, 'revert'); }
    } else s.fakieT = 0;

    const stepLen = s.sp * cosA * DT;
    const dist = Math.abs(stepLen);
    const x1 = s.x + dx * stepLen, z1 = s.z + dz * stepLen;
    if (out(x1, z1)) { wallBounce(s, x1, z1, h0); return; }
    const h1 = P.H(x1, z1, g1);
    if (h1 - h0 > STEP && !SK.sab.nowalls) { wallBounce(s, x1, z1, h0); return; }
    if (!bailing) {
      // EASY: low things in the way (a ledge, a rail) get an ollie by themselves
      const mx = dx * sg, mz = dz * sg;
      if (L.autoOllie && Math.abs(s.sp) > 1.5) {
        const la = 0.5 + Math.abs(s.sp) * 0.12, ax = s.x + mx * la, az = s.z + mz * la;
        const ha = P.H(ax, az, ga), rise = ha - h0;
        // a step up (a ledge's side), not a ramp: the rise is more than the slopes here and there explain
        const abrupt = rise > STEP && rise < 0.75 && rise > Math.max(ga.gx * mx + ga.gz * mz, go.gx * mx + go.gz * mz) * la + 0.2;
        const r = abrupt ? null : railInWay(s.x, s.z, ax, az, 0.35);
        if (abrupt || r) { ollie(s, inp, abrupt ? ha + 0.35 : P.railY(r, 0.5) + 0.4); return; }
      } else if (!L.autoOllie) {
        const r = railInWay(s.x, s.z, x1, z1, 0.12);
        if (r) {
          // bump into the rail: bounce off it
          const ux = r.ux, uz = r.uz, along = dx * ux + dz * uz;
          s.th = Math.atan2(2 * along * uz - dz, 2 * along * ux - dx);
          s.sp *= 0.45;
          s.stats.walls++;
          ev(s, 'bonk');
          return;
        }
      }
    }
    if (bailing) { s.x = x1; s.z = z1; s.y = h1; return; } // sliding along, down: just follow the ground
    const vy = s.sp * sinA;
    const slope1 = (g1.gx * dx + g1.gz * dz) * sg;
    if (h0 - h1 > 4 * dist + 0.02) { launch(s, x1, z1, h0 + vy * DT, slope * sg, true, false, go); return; } // off a lip or an edge
    const yb = h0 + vy * DT - 0.5 * G * DT * DT;
    if (slope * sg > 0.6 && slope1 > -0.05 && vy > 0.3 && h1 < yb - 0.002) { launch(s, x1, z1, yb, slope * sg, false, false, go); return; } // off a steep lip (gentle tops like the funbox's he rolls over)
    s.x = x1; s.z = z1; s.y = h1;
  }

  // leave the ground: cliff = off an edge (a kicker's lip, a ledge), else over a crest (a quarter pipe's top, the funbox)
  function launch(s, x, z, y, slopeAlong, cliff, popped, grad) {
    const L = s.L, x0 = s.x, z0 = s.z;
    const dx = Math.cos(s.th), dz = Math.sin(s.th);
    const sl = slopeAlong * Math.sign(s.sp);
    const cosA = 1 / Math.sqrt(1 + sl * sl), sinA = sl * cosA;
    const vh = s.sp * cosA;
    s.vx = dx * vh; s.vz = dz * vh; s.vy = s.sp * sinA;
    let kind = popped ? (slopeAlong > 0.3 ? 'ramp' : 'ollie') : cliff ? (slopeAlong > 0.3 ? 'ramp' : 'drop') : slopeAlong > 1.2 ? 'vert' : 'hop';
    s.x = x; s.z = z; s.y = y;
    const air = { t: 0, kind, flip: null, flipNext: null, grab: null, spinUser: 0, autoLeft: 0, autoRate: 0, grind: false };
    if (kind === 'ramp' && L.kickPop && !popped) s.vy += L.kickPop; // EASY pops off kickers by itself
    if (kind === 'vert') {
      // vert: straight up the wall and back down it. Keep only the speed along the coping, plus a nudge back in.
      const gl = Math.hypot(grad.gx, grad.gz) || 1, ux = grad.gx / gl, uz = grad.gz / gl;
      const into = s.vx * ux + s.vz * uz;
      s.vx -= (into + 0.55) * ux;
      s.vz -= (into + 0.55) * uz;
      s.x = x0 - ux * 0.03; s.z = z0 - uz * 0.03; // back over the wall, not the deck
      s.y = Math.max(s.y, P.H(s.x, s.z));
      s.vy = Math.max(s.vy, L.vertMin);
      const tAir = (2 * s.vy) / (G * L.grav);
      air.autoLeft = Math.PI;
      air.autoRate = Math.PI / Math.max(0.3, tAir * 0.8);
    }
    s.mode = 'air';
    s.air = air;
    s.stats.airs++;
    openCombo(s);
    ev(s, 'air', { kind });
  }

  // an ollie; auto (EASY's own ollie over something in the way) is the height to clear, and pops just enough for it
  function ollie(s, inp, auto) {
    if (s.L.safe && Math.abs(s.sp) < 2) s.sp = 2 * Math.sign(s.sp || 1); // EASY: never a dead stop in the air
    const h0 = P.H(s.x, s.z, go);
    const dx = Math.cos(s.th), dz = Math.sin(s.th);
    const slope = (go.gx * dx + go.gz * dz) * Math.sign(s.sp || 1);
    launch(s, s.x, s.z, h0, slope, false, true, go);
    let pop = s.L.pop;
    if (auto) pop = clamp(Math.sqrt(2 * G * s.L.grav * Math.max(0.2, auto - h0)) - s.vy, 1.5, s.L.pop);
    s.vy += pop;
    s.popT = 0;
    ev(s, 'ollie', { auto: !!auto });
  }

  // ---- the air ----
  function airTricks(s, inp) {
    const a = s.air;
    if (inp.flip && !a.grab) {
      const name = flipFor(inp.dir);
      if (!a.flip) { a.flip = { name, p: 0 }; s.stats.flips++; } else if (a.flip.p > 0.55) a.flipNext = name;
    }
    if (a.flip) {
      a.flip.p += DT / FLIP_DUR[a.flip.name];
      if (a.flip.p >= 1) {
        trick(s, a.flip.name);
        s.stats.flipsDone++;
        a.flip = null;
        if (a.flipNext) { a.flip = { name: a.flipNext, p: 0 }; a.flipNext = null; s.stats.flips++; }
      }
    }
    if (inp.grab && !a.flip) {
      if (!a.grab) { a.grab = { name: grabFor(inp.dir), t: 0 }; s.stats.grabs++; } else a.grab.t += DT;
    } else if (a.grab) endGrab(s);
  }
  function endGrab(s) {
    const g = s.air.grab;
    s.air.grab = null;
    if (g.t > 0.08) trick(s, g.name, g.t);
  }

  // the end of the air: the tricks that finish on landing. Returns false if it's a bail.
  function settleAir(s, md, onRail) {
    const a = s.air, L = s.L, safe = L.safe && !SK.sab.noassist;
    let ok = true;
    if (a.flip) {
      if (safe || a.flip.p >= 0.75) { trick(s, a.flip.name); s.stats.flipsDone++; } else ok = false;
      a.flip = null;
    }
    if (a.grab) endGrab(s);
    // board against the way he's going: forwards or fakie both fine; sideways is a bail
    const diff = Math.abs(wrap(s.th - md));
    const off = onRail ? Math.min(diff, Math.PI - diff, Math.abs(diff - Math.PI / 2)) : Math.min(diff, Math.PI - diff);
    if (!safe && off > 0.7) ok = false;
    if (!ok) return false;
    const spun = Math.abs(a.spinUser);
    if (spun > 2.6) trick(s, String(Math.min(5, Math.round(spun / Math.PI)) * 180));
    if (a.kind === 'ollie') trick(s, 'OLLIE');
    else if ((a.kind === 'ramp' || a.kind === 'drop' || a.kind === 'hop') && a.t >= 0.6) trick(s, 'AIR', a.t);
    else if (a.kind === 'vert' && a.t >= 0.5) trick(s, 'VERT AIR', a.t);
    return true;
  }

  function airStep(s, inp) {
    const L = s.L, a = s.air;
    a.t += DT;
    if (inp.steer) { const d = inp.steer * L.spin * DT; s.th = wrap(s.th + d); a.spinUser += d; }
    if (a.autoLeft) {
      const d = Math.min(a.autoLeft, a.autoRate * DT);
      s.th = wrap(s.th + d * (a.spinUser < -0.3 ? -1 : 1));
      a.autoLeft -= d;
    }
    airTricks(s, inp);
    if (s.mode !== 'air') return;
    const g = G * L.grav;
    let x1 = s.x + s.vx * DT, z1 = s.z + s.vz * DT;
    const y1 = s.y + s.vy * DT - 0.5 * g * DT * DT;
    s.vy -= g * DT;
    if (out(x1, z1)) {
      if (x1 < P.bounds.x0 + 0.35 || x1 > P.bounds.x1 - 0.35) { s.vx = -s.vx * 0.5; x1 = s.x; }
      if (z1 < P.bounds.z0 + 0.35 || z1 > P.bounds.z1 - 0.35) { s.vz = -s.vz * 0.5; z1 = s.z; }
      ev(s, 'bonk');
    }
    if (tryGrind(s, x1, y1, z1)) return;
    const h1 = P.H(x1, z1, g1);
    if (y1 >= h1 || (SK.sab.noclamp && s.vy < -6)) { s.x = x1; s.y = y1; s.z = z1; return; }
    const h0 = P.H(s.x, s.z);
    if (h1 - y1 > 0.45 && h0 <= s.y + 1e-6 && !SK.sab.nowalls) {
      // flew into the side of something: bounce off it
      const bx = P.H(x1, s.z) > y1 + 0.45, bz = P.H(s.x, z1) > y1 + 0.45;
      if (bx || !bz) s.vx = -s.vx * 0.4;
      if (bz || !bx) s.vz = -s.vz * 0.4;
      s.stats.walls++;
      ev(s, 'bonk');
      if (y1 >= h0) { s.y = y1; return; }
      P.H(s.x, s.z, g1);
      land(s, s.x, h0, s.z, g1);
      return;
    }
    land(s, x1, h1, z1, g1);
  }

  function land(s, x, y, z, gr) {
    const L = s.L;
    // keep the part of the velocity along the surface
    let nx = -gr.gx, ny = 1, nz = -gr.gz;
    const nl = Math.hypot(nx, ny, nz);
    nx /= nl; ny /= nl; nz /= nl;
    const vn = s.vx * nx + s.vy * ny + s.vz * nz;
    const tx = s.vx - vn * nx, ty = s.vy - vn * ny, tz = s.vz - vn * nz;
    const lh = Math.hypot(tx, tz);
    let md = lh > 0.3 ? Math.atan2(tz, tx) : Math.hypot(gr.gx, gr.gz) > 0.2 ? Math.atan2(-gr.gz, -gr.gx) : s.th;
    s.x = x; s.y = y; s.z = z;
    const fall = -s.vy;
    if (!settleAir(s, md, false)) { s.vx = s.vz = 0; bail(s, 'land'); return; }
    const diff = Math.abs(wrap(s.th - md));
    const fakie = diff > Math.PI / 2;
    s.th = wrap(fakie ? md + Math.PI : md);
    let v = Math.min(MAXV, Math.hypot(tx, ty, tz));
    if (L.safe) v = Math.max(v, 2.5);
    s.sp = fakie ? -v : v;
    s.mode = 'ground';
    s.air = null;
    s.landT = 0;
    s.comboT = 0;
    s.stats.landed++;
    ev(s, 'land', { fall, fakie });
    if (s.combo && s.combo.tricks.length >= MAX_TRICKS) bank(s);
  }

  // ---- rails ----
  function tryGrind(s, x, y, z) {
    const L = s.L;
    if (s.vy > (L.safe ? 1.6 : 1.0)) return false;
    const vh = Math.hypot(s.vx, s.vz);
    if (vh < 1.2) return false;
    for (const r of P.rails) {
      if (r === s.lastRail && s.railCool > 0) continue;
      const u = ((x - r.a[0]) * r.ux + (z - r.a[2]) * r.uz) / r.lh;
      if (u < 0.02 || u > 0.97) continue;
      const cx = r.a[0] + r.ux * u * r.lh, cz = r.a[2] + r.uz * u * r.lh;
      if (Math.hypot(x - cx, z - cz) > L.snapR) continue;
      const ry = P.railY(r, u), dy = y - ry;
      if (dy < -0.3 || dy > L.snapUp) continue;
      const along = (s.vx * r.ux + s.vz * r.uz) / vh;
      const ang = Math.acos(Math.min(1, Math.abs(along)));
      if (ang > L.snapAng) continue;
      const md = Math.atan2(s.vz, s.vx);
      if (!settleAir(s, md, true)) { s.x = cx; s.z = cz; s.y = P.H(cx, cz); bail(s, 'rail'); return true; }
      let gs = s.vx * r.ux + s.vz * r.uz;
      const minV = L.safe ? 3 : 2;
      if (Math.abs(gs) < minV) gs = Math.sign(gs || 1) * minV;
      s.mode = 'grind';
      s.air = null;
      s.grind = { rail: r, u, gs, t: 0, type: ang < 0.42 ? '50-50' : 'BOARDSLIDE' };
      s.x = cx; s.z = cz; s.y = ry;
      s.th = Math.atan2(r.uz * Math.sign(gs), r.ux * Math.sign(gs));
      s.balance = 0;
      s.balDrift = (s.rnd() < 0.5 ? -1 : 1) * (0.35 + s.rnd() * 0.4);
      s.stats.grinds++;
      openCombo(s);
      ev(s, 'grind', { rail: r.id, kind: r.kind, type: s.grind.type });
      return true;
    }
    return false;
  }

  function grindStep(s, inp) {
    const g = s.grind, r = g.rail, L = s.L;
    g.t += DT;
    const sl = r.dy / r.lh, cosA = 1 / Math.sqrt(1 + sl * sl);
    g.gs += -G * sl * cosA * DT - Math.sign(g.gs) * 0.6 * DT;
    if (L.safe && Math.abs(g.gs) < 3) g.gs = Math.sign(g.gs || 1) * 3;
    if (!L.safe) {
      s.balance += (s.balance * 1.8 + s.balDrift) * DT + inp.steer * 2.8 * DT;
      if (Math.abs(s.balance) > 1) { endGrind(s, false); bail(s, 'balance'); return; }
    }
    if (inp.jump || inp.flip || inp.grab) {
      // pop off the rail
      endGrind(s, true);
      s.vy = L.pop * 0.85;
      s.popT = 0;
      ev(s, 'ollie', { auto: false, rail: true });
      airTricks(s, inp);
      return;
    }
    if (Math.abs(g.gs) < 0.6) { endGrind(s, true); s.vy = 1.6; return; }
    g.u += (g.gs * cosA * DT) / r.lh;
    if (g.u < 0 || g.u > 1) { endGrind(s, true); s.vy += 0.8; return; }
    s.x = r.a[0] + r.ux * g.u * r.lh;
    s.z = r.a[2] + r.uz * g.u * r.lh;
    s.y = P.railY(r, g.u);
  }
  function endGrind(s, toAir) {
    const g = s.grind, r = g.rail;
    if (g.t > 0.05) trick(s, g.type, g.t);
    s.lastRail = r;
    s.railCool = 0.45;
    s.grind = null;
    ev(s, 'grindEnd', { rail: r.id });
    if (!toAir) return;
    const sl = r.dy / r.lh, cosA = 1 / Math.sqrt(1 + sl * sl);
    s.vx = r.ux * g.gs * cosA;
    s.vz = r.uz * g.gs * cosA;
    s.vy = g.gs * sl * cosA;
    s.mode = 'air';
    s.air = { t: 0, kind: 'grind', flip: null, flipNext: null, grab: null, spinUser: 0, autoLeft: 0, autoRate: 0 };
  }

  // ---- one step ----
  const NONE = { steer: 0, push: false, brake: false, jump: false, flip: false, grab: false, dir: '' };
  function step(s, inp) {
    inp = inp || NONE;
    s.t += DT;
    s.railCool = Math.max(0, s.railCool - DT);
    s.landT += DT;
    s.popT += DT;
    if (s.mode === 'ground') {
      if (inp.jump || inp.flip || inp.grab) {
        ollie(s, inp, false);
        airTricks(s, inp);
      } else groundStep(s, inp, false);
      if (s.mode === 'ground' && s.combo) {
        // the combo waits while he's on a big ramp (rolling up to the next air)
        P.H(s.x, s.z, go);
        if (Math.hypot(go.gx, go.gz) < 0.5) s.comboT += DT;
        if (s.comboT > s.L.window) bank(s);
      }
    } else if (s.mode === 'air') airStep(s, inp);
    else if (s.mode === 'grind') grindStep(s, inp);
    else if (s.mode === 'bail') {
      s.bailT += DT;
      groundStep(s, NONE, true);
      if (s.mode === 'air') { s.mode = 'bail'; s.air = null; s.y = P.H(s.x, s.z); } // sliding off an edge while down
      if (s.bailT > 1.4) { s.mode = 'ground'; ev(s, 'up'); }
    }
    const pen = P.H(s.x, s.z) - s.y;
    if (pen > s.stats.maxPen) s.stats.maxPen = pen;
  }

  SK.skater = { DT, G, LEVEL, FLIP_DUR, create, setLevel, place, step, finish, bank, rng, railInWay, wrap };
})(typeof window !== 'undefined' ? window : globalThis);
