/* TT Skate Park: the park itself, as numbers. No Three.js here, so node can run it too (tools/check.js).
   The ground is a height field: H(x, z) is the top of whatever stands at a point (0 on the concrete). It's built
   from shapes: the half-pipe with its bank, two quarter pipes, two kickers, the funbox and two ledges. Every shape
   gives its exact height and slope, so the skater rides the very surface the scene draws. Rails are 3D segments.
   Axes: x east, z south (toward the start camera), y up. Metres. */
(function (root) {
  'use strict';
  const SK = (root.SK = root.SK || {});

  // A quarter-pipe curve of radius r, d metres into it. Cut just short of vertical (73°), so the height field never
  // needs an infinite slope; the skater module turns a launch off a steep lip into vert air.
  const qpH = (d, r) => r - Math.sqrt(Math.max(0, r * r - d * d));
  const qpS = (d, r) => d / Math.sqrt(Math.max(1e-6, r * r - d * d));

  // Profile pieces over one coordinate t: f(t) the height, d(t) its slope.
  const flat = (t0, t1, h) => ({ t0, t1, f: () => h, d: () => 0 });
  const lin = (t0, t1, h0, h1) => ({ t0, t1, f: (t) => h0 + ((h1 - h0) * (t - t0)) / (t1 - t0), d: () => (h1 - h0) / (t1 - t0) });
  const qpUp = (t0, t1, r) => ({ t0, t1, f: (t) => qpH(t - t0, r), d: (t) => qpS(t - t0, r) }); // rises with t
  const qpDown = (t0, t1, r) => ({ t0, t1, f: (t) => qpH(t1 - t, r), d: (t) => -qpS(t1 - t, r) }); // falls with t
  const powUp = (t0, t1, h) => ({ t0, t1, f: (t) => h * ((t - t0) / (t1 - t0)) ** 2, d: (t) => (2 * h * (t - t0)) / (t1 - t0) ** 2 });
  const powDown = (t0, t1, h) => ({ t0, t1, f: (t) => h * ((t1 - t) / (t1 - t0)) ** 2, d: (t) => (-2 * h * (t1 - t)) / (t1 - t0) ** 2 });

  // An extrusion: the profile runs across `axis` ('x': the shape spans x from a0 to a1, the profile is over z).
  function extrude(id, axis, a0, a1, segs, look) {
    const t0 = segs[0].t0, t1 = segs[segs.length - 1].t1;
    return {
      id, kind: 'extrude', axis, a0, a1, segs, t0, t1, look,
      eval(x, z, o) {
        const a = axis === 'x' ? x : z, t = axis === 'x' ? z : x;
        if (a < a0 || a > a1 || t < t0 || t > t1) return -1;
        for (const s of segs) {
          if (t <= s.t1) {
            const h = s.f(t), d = s.d(t);
            if (axis === 'x') { o.gx = 0; o.gz = d; } else { o.gx = d; o.gz = 0; }
            return h;
          }
        }
        return -1;
      },
    };
  }
  function box(id, x0, x1, z0, z1, h, look) {
    return {
      id, kind: 'box', x0, x1, z0, z1, h, look,
      eval(x, z, o) {
        if (x < x0 || x > x1 || z < z0 || z > z1) return -1;
        o.gx = o.gz = 0;
        return h;
      },
    };
  }
  // the funbox: a flat top (half sizes hx, hz) with a bank of `run` metres on every side
  function funbox(id, cx, cz, hx, hz, run, h, look) {
    return {
      id, kind: 'funbox', cx, cz, hx, hz, run, h, look,
      eval(x, z, o) {
        const dx = Math.abs(x - cx) - hx, dz = Math.abs(z - cz) - hz;
        const d = Math.max(dx, dz, 0);
        if (d > run) return -1;
        o.gx = o.gz = 0;
        if (d > 0) {
          if (dx >= dz) o.gx = (-h / run) * Math.sign(x - cx);
          else o.gz = (-h / run) * Math.sign(z - cz);
        }
        return h * (1 - d / run);
      },
    };
  }

  // ---- the park ----
  const R = 3.2, DM = 0.96 * R, HP = qpH(DM, R); // half-pipe: 3.2 m transitions, 2.30 m decks
  const R2 = 2.6, DM2 = 2.5, QH = qpH(DM2, R2); // quarter pipes: 1.89 m
  const KH = 0.8; // kickers
  const shapes = [
    extrude('halfpipe', 'x', -11, 11, [
      flat(-24, -14 - 4 - DM, HP), qpDown(-18 - DM, -18, R), flat(-18, -14, 0), qpUp(-14, -14 + DM, R),
      flat(-14 + DM, -9.5, HP), lin(-9.5, -4.5, HP, 0),
    ], 'pipe'),
    extrude('qpWest', 'z', -2, 20, [flat(-28, -26, QH), qpDown(-26, -26 + DM2, R2)], 'qp'),
    extrude('qpEast', 'z', -2, 20, [qpUp(26 - DM2, 26, R2), flat(26, 28, QH)], 'qp'),
    extrude('kickerWest', 'z', 4, 8, [powDown(-12, -9, KH)], 'kicker'),
    extrude('kickerEast', 'z', 4, 8, [powUp(9, 12, KH)], 'kicker'),
    funbox('funbox', 0, 6, 2.5, 2.5, 2.4, 0.8, 'funbox'),
    box('ledgeWest', -20, -12, 17, 18.2, 0.5, 'ledge'),
    box('ledgeEast', 14, 21, -15, -14, 0.45, 'ledge'),
  ];

  const tmp = { gx: 0, gz: 0 };
  // The height under (x, z); o (optional) gets the slope gx = dH/dx, gz = dH/dz.
  function H(x, z, o) {
    let best = 0, gx = 0, gz = 0;
    for (let i = 0; i < shapes.length; i++) {
      const h = shapes[i].eval(x, z, tmp);
      if (h > best) { best = h; gx = tmp.gx; gz = tmp.gz; }
    }
    if (o) { o.gx = gx; o.gz = gz; }
    return best;
  }

  // Rails: a and b are [x, y, z]. Ledge edges are rails too (kind 'ledge').
  const rails = [
    ['railLong', [-6.5, 0.6, 18.5], [6.5, 0.6, 18.5], 'rail'],
    ['railFunbox', [0, 1.22, 8.1], [0, 1.22, 3.9], 'rail'],
    ['railDiagonal', [12, 0.55, 11], [19, 0.55, 18], 'rail'],
    ['railPipe', [-18, 0.5, -8], [-18, 0.5, -17], 'rail'],
    ['ledgeWestN', [-20, 0.5, 17], [-12, 0.5, 17], 'ledge'],
    ['ledgeWestS', [-20, 0.5, 18.2], [-12, 0.5, 18.2], 'ledge'],
    ['ledgeEastN', [14, 0.45, -15], [21, 0.45, -15], 'ledge'],
    ['ledgeEastS', [14, 0.45, -14], [21, 0.45, -14], 'ledge'],
  ].map(([id, a, b, kind]) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const lh = Math.hypot(dx, dz);
    return { id, a, b, kind, len: Math.hypot(dx, dy, dz), lh, ux: dx / lh, uz: dz / lh, dy };
  });
  const railY = (r, u) => r.a[1] + r.dy * u;

  const bounds = { x0: -28, x1: 28, z0: -24, z1: 22 };
  const spawn = { x: 0, z: 12.6, heading: -Math.PI / 2 }; // facing north, at the funbox

  // Trick lines: what the brother shows you, and what the CPU friends skate. Each step is a spot to ride to;
  // jump: ollie there; air: the trick for the next time you're in the air after it (flip, grab, spin);
  // v: the speed to ride at. say: what the brother tells you. expect: what the check wants it to land on EASY.
  const lines = [
    { id: 'funboxPipe', expect: ['GRIND', 'VERT AIR', 'INDY', 'KICKFLIP'], say: 'GRIND THE FUNBOX RAIL, THEN DROP IN THE HALF-PIPE!', steps: [
      { x: 0, z: 13.6 }, { x: 0, z: 11.2, v: 6.5 }, { x: 0, z: 8.0, jump: true }, { x: 0, z: 3 }, { x: 0, z: -3, v: 7 },
      { x: 0, z: -10.3, v: 8.5 }, { x: 0, z: -19.6, air: 'grab' }, { x: 0, z: -12.2, air: 'flip' }, { x: 0, z: -19.6, air: 'spin' },
    ] },
    { id: 'railLong', expect: ['GRIND'], say: 'OLLIE ONTO THE RAIL AND GRIND IT!', steps: [
      { x: -19, z: 18.7 }, { x: -12.5, z: 18.5, v: 6.5 }, { x: -9.4, z: 18.5, jump: true }, { x: 7, z: 18.5 }, { x: 10.5, z: 18.3 },
    ] },
    { id: 'kickerWest', expect: ['AIR', 'KICKFLIP', 'VERT AIR', 'INDY'], say: 'JUMP THE KICKER AND DO A KICKFLIP!', steps: [
      { x: -5.5, z: 13 }, { x: -7, z: 7.5, v: 7 }, { x: -11.6, z: 6, jump: true, air: 'flip' }, { x: -19.5, z: 6, v: 8.5 },
      { x: -24.8, z: 6, air: 'grab' },
    ] },
    { id: 'kickerEast', expect: ['AIR', 'INDY', 'VERT AIR', 'KICKFLIP'], say: 'FLY OFF THE KICKER AND GRAB THE BOARD!', steps: [
      { x: 5.5, z: 13 }, { x: 7, z: 7.5, v: 7 }, { x: 11.6, z: 6, jump: true, air: 'grab' }, { x: 19.5, z: 6, v: 8.5 },
      { x: 24.8, z: 6, air: 'flip' },
    ] },
    { id: 'ledgeWest', expect: ['GRIND'], say: 'GRIND THE LONG LEDGE!', steps: [
      { x: -2, z: 16.7 }, { x: -6, z: 16.7, v: 6.5 }, { x: -9.6, z: 16.7, jump: true }, { x: -21, z: 16.9 }, { x: -24, z: 14 },
    ] },
    { id: 'railDiagonal', expect: ['GRIND'], say: 'GRIND THE BIG DIAGONAL RAIL!', steps: [
      { x: 6.6, z: 5.6 }, { x: 8, z: 7, v: 6.5 }, { x: 9.7, z: 8.7, jump: true }, { x: 19.6, z: 18.6 }, { x: 21, z: 20 },
    ] },
    { id: 'railPipe', expect: ['GRIND'], say: 'GRIND THE RAIL BY THE BIG RAMP!', steps: [
      { x: -18, z: 2 }, { x: -18, z: -2, v: 6.5 }, { x: -18, z: -5.1, jump: true }, { x: -18, z: -18 }, { x: -13.5, z: -21 },
    ] },
    { id: 'ledgeEast', expect: ['GRIND'], say: 'RIDE OUT OF THE HALF-PIPE AND GRIND THE LEDGE!', steps: [
      { x: 1, z: -15.3 }, { x: 7, z: -15.3, v: 6.5 }, { x: 11.2, z: -15.3, jump: true }, { x: 22, z: -15.2 }, { x: 24.5, z: -11 },
    ] },
  ];

  SK.park = { H, shapes, rails, railY, bounds, spawn, lines, HP, QH, KH, R, DM, R2, DM2 };
})(typeof window !== 'undefined' ? window : globalThis);
