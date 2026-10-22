/* TT Skate Park: everything you see, in Three.js r149. The ramps are built from the very shapes the physics rides
   (js/park.js), so what you see is what you skate. Also here: the skaters on their boards (flips, grabs, grinds,
   bails, celebrations), the cameras (chase, the half-pipe's side view, the title's fly-around, the winner),
   the brother's glowing trick line, and the confetti, sparks and dust. */
(function () {
  'use strict';
  const T = THREE, Kit = window.Kit, SK = window.SK, P = SK.park, gfx = Kit.gfx;
  const { std, makeCanvas, toTexture } = gfx;
  const wrap = SK.skater.wrap;
  let renderer, scene, camera, sun;
  const view = { w: 1, h: 1 };
  const V3 = new T.Vector3(), V4 = new T.Vector3(), Q = new T.Quaternion(), M4 = new T.Matrix4(), S1 = new T.Vector3(), E1 = new T.Euler();
  const UP = new T.Vector3(0, 1, 0);
  const tall = () => view.w / view.h < 0.8;

  function init(canvas) {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene();
    scene.background = skyTexture();
    scene.fog = new T.Fog('#cfe9ff', 70, 170);
    camera = new T.PerspectiveCamera(55, 1, 0.1, 400);
    scene.add(new T.HemisphereLight('#e8f4ff', '#7a6a52', 0.75));
    sun = new T.DirectionalLight('#fff1d6', 0.95);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.03;
    const sc = sun.shadow.camera;
    sc.left = -24; sc.right = 24; sc.top = 24; sc.bottom = -24; sc.near = 1; sc.far = 90;
    scene.add(sun, sun.target);
    buildPark();
    buildSurroundings();
    makeParticles();
    makeLineBits();
  }

  function fit(w, h) {
    view.w = w; view.h = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 68 : w / h < 1.3 ? 58 : 52;
    camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------------ textures
  function skyTexture() {
    const [c, g] = makeCanvas(4, 256);
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#4aa8f0'); gr.addColorStop(0.55, '#9fd4ff'); gr.addColorStop(1, '#e9f6ff');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    return toTexture(c);
  }
  function speckle(g, w, h, n, cols, size = 2) {
    for (let i = 0; i < n; i++) {
      g.fillStyle = cols[i % cols.length];
      g.globalAlpha = 0.25 + Math.random() * 0.35;
      g.fillRect(Math.random() * w, Math.random() * h, size * Math.random() + 0.6, size * Math.random() + 0.6);
    }
    g.globalAlpha = 1;
  }
  function concreteTex() {
    const [c, g] = makeCanvas(512, 512);
    g.fillStyle = '#cdc7bd'; g.fillRect(0, 0, 512, 512);
    speckle(g, 512, 512, 5000, ['#b3ada3', '#e2ddd4', '#a59f95']);
    // expansion joints every 4 m (the texture is 8 m)
    g.strokeStyle = 'rgba(90,84,76,0.55)'; g.lineWidth = 3;
    for (const v of [0, 256]) { g.beginPath(); g.moveTo(v, 0); g.lineTo(v, 512); g.stroke(); g.beginPath(); g.moveTo(0, v); g.lineTo(512, v); g.stroke(); }
    const t = toTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  }
  function grassTex() {
    const [c, g] = makeCanvas(256, 256);
    g.fillStyle = '#6fbf4e'; g.fillRect(0, 0, 256, 256);
    speckle(g, 256, 256, 3500, ['#5aa83c', '#86d062', '#4d9a33'], 3);
    const t = toTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
  }
  // painted ramp boards: a colour with faint panel seams and screws (one texture square is 2 m)
  function rampTex(color) {
    const [c, g] = makeCanvas(256, 256);
    g.fillStyle = color; g.fillRect(0, 0, 256, 256);
    speckle(g, 256, 256, 1500, [gfx.shade(color, -0.12), gfx.shade(color, 0.1)], 2);
    g.strokeStyle = gfx.shade(color, -0.25); g.lineWidth = 2;
    for (const v of [0, 128]) { g.beginPath(); g.moveTo(v, 0); g.lineTo(v, 256); g.stroke(); }
    g.beginPath(); g.moveTo(0, 0); g.lineTo(256, 0); g.stroke();
    g.fillStyle = gfx.shade(color, -0.35);
    for (let y = 16; y < 256; y += 32) for (const x of [6, 122, 134, 250]) { g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); }
    const t = toTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  }
  // our own mural for the half-pipe's ends: stars, swooshes, a board and the brothers' TT
  function muralTex(base, seed) {
    const [c, g] = makeCanvas(1024, 256);
    g.fillStyle = base; g.fillRect(0, 0, 1024, 256);
    const cols = ['#ffd400', '#ff3d7f', '#18d4ff', '#3fe0b0', '#ff8a1f', '#ffffff'];
    let r = seed;
    const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 6; i++) {
      g.strokeStyle = cols[i % cols.length]; g.lineWidth = 18; g.lineCap = 'round';
      g.beginPath(); const y = 60 + rnd() * 150; g.moveTo(-20, y);
      g.bezierCurveTo(300, y - 120 + rnd() * 240, 700, y - 120 + rnd() * 240, 1050, y + rnd() * 60 - 30); g.stroke();
    }
    const star = (x, y, rr, col) => {
      g.fillStyle = col; g.strokeStyle = '#14121f'; g.lineWidth = 6; g.beginPath();
      for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, q = k % 2 ? rr * 0.45 : rr; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
      g.closePath(); g.stroke(); g.fill();
    };
    for (let i = 0; i < 7; i++) star(80 + i * 140 + rnd() * 40, 50 + rnd() * 160, 22 + rnd() * 18, cols[i % 5]);
    g.font = `150px ${gfx.FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 14; g.strokeStyle = '#14121f';
    g.strokeText('TT', 512, 140); g.fillStyle = '#ffffff'; g.fillText('TT', 512, 140);
    g.fillStyle = '#18d4ff'; g.fillText('T', 512 - 52, 140);
    g.fillStyle = '#ff8a1f'; g.fillText('T', 512 + 52, 140);
    g.font = `110px ${gfx.EMOJI_FONT}`;
    g.fillText('🛹', 240, 150); g.fillText('🛹', 790, 130);
    return toTexture(c);
  }

  // ------------------------------------------------------------------ the park
  const LOOK = {
    pipe: { top: '#2f7de1', side: '#1d5bb0' },
    qp: { top: '#ff8a1f', side: '#d96a10' },
    kicker: { top: '#ffd400', side: '#e0b400' },
    funbox: { top: '#3fe0b0', side: '#28b88d' },
    ledge: { top: '#b9b3aa', side: '#9b958c' },
  };
  const mats = {};
  function matFor(look, part) {
    const k = look + part;
    if (!mats[k]) {
      const col = LOOK[look][part];
      mats[k] = part === 'top' ? std('#ffffff', { map: rampTex(col), roughness: 0.75 }) : std(col, { roughness: 0.8, side: T.DoubleSide });
    }
    return mats[k];
  }
  function geo(pos, uv, idx) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    if (uv) g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    if (idx) g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  function addMesh(g, m, shadow = true) {
    const me = new T.Mesh(g, m);
    me.castShadow = shadow;
    me.receiveShadow = true;
    scene.add(me);
    return me;
  }

  // an extrusion: the riding surface (each profile piece its own strip, so the edges stay crisp), its two side caps
  // and any upright faces at the ends of the profile (a kicker's lip, a deck's back)
  function extrudeMeshes(sh, sideMat) {
    const P3 = (a, t, y) => (sh.axis === 'x' ? [a, y, t] : [t, y, a]);
    const flip = sh.axis === 'x';
    const pos = [], uv = [], idx = [], samples = [];
    let arc = 0;
    for (const seg of sh.segs) {
      const d0 = seg.d(seg.t0), curved = d0 !== seg.d(seg.t1) || d0 !== seg.d((seg.t0 + seg.t1) / 2);
      const n = curved ? Math.max(2, Math.ceil((seg.t1 - seg.t0) / 0.08)) : 1;
      const base = pos.length / 3;
      let pt = seg.t0, py = seg.f(seg.t0);
      for (let i = 0; i <= n; i++) {
        const t = seg.t0 + ((seg.t1 - seg.t0) * i) / n, y = seg.f(t);
        arc += Math.hypot(t - pt, y - py);
        pt = t; py = y;
        for (const a of [sh.a0, sh.a1]) { pos.push(...P3(a, t, y)); uv.push(a / 2, arc / 2); }
        samples.push([t, y]);
      }
      for (let i = 0; i < n; i++) {
        const k = base + i * 2;
        if (flip) idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
        else idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    const top = addMesh(geo(pos, uv, idx), matFor(sh.look, 'top'));
    // side caps
    const cp = [], cuv = [];
    for (const a of [sh.a0, sh.a1]) {
      for (let i = 0; i < samples.length - 1; i++) {
        const [t0, y0] = samples[i], [t1, y1] = samples[i + 1];
        if (t1 === t0) continue;
        cp.push(...P3(a, t0, 0), ...P3(a, t0, y0), ...P3(a, t1, y1), ...P3(a, t0, 0), ...P3(a, t1, y1), ...P3(a, t1, 0));
        const U = (t) => (t - sh.t0) / (sh.t1 - sh.t0), V = (y) => y / 2.4;
        cuv.push(U(t0), 0, U(t0), V(y0), U(t1), V(y1), U(t0), 0, U(t1), V(y1), U(t1), 0);
      }
    }
    addMesh(geo(cp, cuv), sideMat || matFor(sh.look, 'side'));
    // upright faces where the profile starts or ends above the ground
    const ep = [];
    for (const t of [sh.t0, sh.t1]) {
      const y = sh.segs[t === sh.t0 ? 0 : sh.segs.length - 1].f(t);
      if (y < 0.01) continue;
      ep.push(...P3(sh.a0, t, 0), ...P3(sh.a1, t, 0), ...P3(sh.a1, t, y), ...P3(sh.a0, t, 0), ...P3(sh.a1, t, y), ...P3(sh.a0, t, y));
    }
    if (ep.length) addMesh(geo(ep), matFor(sh.look, 'side'));
    return top;
  }

  function funboxMesh(sh) {
    const { cx, cz, hx, hz, run, h } = sh;
    const X0 = cx - hx, X1 = cx + hx, Z0 = cz - hz, Z1 = cz + hz;
    const F0x = X0 - run, F1x = X1 + run, F0z = Z0 - run, F1z = Z1 + run;
    const pos = [], uv = [];
    const quad = (a, b, c, d) => {
      for (const p of [a, b, c, a, c, d]) { pos.push(...p); uv.push(p[0] / 2, p[2] / 2); }
    };
    // top, then the four banks (winding: counter-clockwise seen from above)
    quad([X0, h, Z1], [X1, h, Z1], [X1, h, Z0], [X0, h, Z0]);
    quad([F0x, 0, F1z], [F1x, 0, F1z], [X1, h, Z1], [X0, h, Z1]); // south
    quad([X0, h, Z0], [X1, h, Z0], [F1x, 0, F0z], [F0x, 0, F0z]); // north
    quad([X1, h, Z1], [F1x, 0, F1z], [F1x, 0, F0z], [X1, h, Z0]); // east
    quad([F0x, 0, F1z], [X0, h, Z1], [X0, h, Z0], [F0x, 0, F0z]); // west
    addMesh(geo(pos, uv), matFor('funbox', 'top'));
    // painted edge stripes where the banks meet the top
    const stripe = std('#ffffff', { roughness: 0.6 });
    for (const [x, z, w, d] of [[cx, Z0, hx * 2, 0.08], [cx, Z1, hx * 2, 0.08], [X0, cz, 0.08, hz * 2], [X1, cz, 0.08, hz * 2]]) {
      const m = new T.Mesh(new T.BoxGeometry(w, 0.012, d), stripe);
      m.position.set(x, h + 0.004, z);
      scene.add(m);
    }
  }

  const steel = () => std('#d9dde3', { metalness: 0.85, roughness: 0.28 });
  function pipeAlong(a, b, r, mat, cast = true) {
    const d = V3.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = d.length();
    const m = new T.Mesh(new T.CylinderGeometry(r, r, len, 12), mat);
    m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    m.quaternion.setFromUnitVectors(UP, d.normalize());
    m.castShadow = cast;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }

  function buildPark() {
    // the concrete slab inside the fence
    const B = P.bounds, W = B.x1 - B.x0, D = B.z1 - B.z0;
    const ct = concreteTex();
    ct.repeat.set(W / 8, D / 8);
    const slab = new T.Mesh(new T.PlaneGeometry(W, D), std('#ffffff', { map: ct, roughness: 0.92 }));
    slab.rotation.x = -Math.PI / 2;
    slab.position.set((B.x0 + B.x1) / 2, 0, (B.z0 + B.z1) / 2);
    slab.receiveShadow = true;
    scene.add(slab);
    // painted circles and a start line on the concrete
    const paint = (r0, r1, col, x, z) => {
      const m = new T.Mesh(new T.RingGeometry(r0, r1, 48), new T.MeshStandardMaterial({ color: col, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }));
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.005, z); m.receiveShadow = true; scene.add(m);
    };
    paint(2.2, 2.5, '#ff3d7f', -17, 10); paint(1.4, 1.65, '#18d4ff', 17, 12); paint(2.8, 3.1, '#ffd400', 12, -18); paint(1.6, 1.85, '#3fe0b0', -6, -1);

    const murals = [];
    for (const sh of P.shapes) {
      if (sh.kind === 'extrude') {
        let side = null;
        if (sh.id === 'halfpipe') {
          side = std('#ffffff', { map: muralTex('#1d5bb0', 7), roughness: 0.8, side: T.DoubleSide });
          murals.push(side);
        }
        extrudeMeshes(sh, side);
      } else if (sh.kind === 'funbox') funboxMesh(sh);
      else if (sh.kind === 'box') {
        const m = new T.Mesh(new T.BoxGeometry(sh.x1 - sh.x0, sh.h, sh.z1 - sh.z0), [matFor('ledge', 'side'), matFor('ledge', 'side'), std('#ffffff', { map: rampTex('#c4beb4') }), matFor('ledge', 'side'), matFor('ledge', 'side'), matFor('ledge', 'side')]);
        m.position.set((sh.x0 + sh.x1) / 2, sh.h / 2, (sh.z0 + sh.z1) / 2);
        m.castShadow = m.receiveShadow = true;
        scene.add(m);
      }
    }
    // metal: copings on the half-pipe and quarter pipes, the kickers' lips, the ledges' edges
    const st = steel();
    for (const z of [-14 + P.DM, -18 - P.DM]) pipeAlong([-11, P.HP, z], [11, P.HP, z], 0.06, st);
    for (const x of [-26, 26]) pipeAlong([x, P.QH, -2], [x, P.QH, 20], 0.06, st);
    for (const x of [-12, 12]) pipeAlong([x, P.KH, 4], [x, P.KH, 8], 0.03, st);
    const red = std('#e53935', { metalness: 0.4, roughness: 0.4 });
    const yel = std('#ffd400', { metalness: 0.3, roughness: 0.45 });
    for (const r of P.rails) {
      if (r.kind === 'ledge') { pipeAlong(r.a, r.b, 0.035, st); continue; }
      pipeAlong(r.a, r.b, 0.045, r.id === 'railFunbox' ? red : r.id === 'railDiagonal' ? std('#18d4ff', { metalness: 0.4, roughness: 0.4 }) : yel);
      const n = Math.max(2, Math.ceil(r.lh / 2.4) + 1);
      for (let i = 0; i < n; i++) {
        const u = 0.04 + (0.92 * i) / (n - 1);
        const x = r.a[0] + (r.b[0] - r.a[0]) * u, z = r.a[2] + (r.b[2] - r.a[2]) * u, y = P.railY(r, u);
        pipeAlong([x, P.H(x, z), z], [x, y, z], 0.03, st);
      }
    }
    // a hand rail along the back of the half-pipe's north deck
    const hr = std('#14121f', { metalness: 0.5, roughness: 0.5 });
    pipeAlong([-11, P.HP + 0.9, -23.6], [11, P.HP + 0.9, -23.6], 0.04, hr);
    for (let x = -11; x <= 11; x += 2.75) pipeAlong([x, P.HP, -23.6], [x, P.HP + 0.9, -23.6], 0.03, hr);
    lettering.murals = murals;
  }
  const lettering = { murals: [] };

  function buildSurroundings() {
    const B = P.bounds;
    const gt = grassTex();
    gt.repeat.set(50, 50);
    const grass = new T.Mesh(new T.PlaneGeometry(400, 400), std('#ffffff', { map: gt, roughness: 1 }));
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.03;
    grass.receiveShadow = true;
    scene.add(grass);
    // a path round the park
    const path = new T.Mesh(new T.RingGeometry(1, 1, 4, 1), std('#d9cdb4'));
    path.visible = false;
    scene.add(path);
    // the fence: posts, a top bar and see-through mesh panels
    const [c, g] = makeCanvas(64, 64);
    g.strokeStyle = 'rgba(70,80,90,0.9)'; g.lineWidth = 3;
    for (let i = -64; i < 128; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke(); g.beginPath(); g.moveTo(i + 64, 0); g.lineTo(i, 64); g.stroke(); }
    const ft = toTexture(c);
    ft.wrapS = ft.wrapT = T.RepeatWrapping;
    const fenceMat = new T.MeshStandardMaterial({ map: ft, transparent: true, alphaTest: 0.3, side: T.DoubleSide, roughness: 0.6, metalness: 0.4 });
    const postMat = std('#5d6670', { metalness: 0.6, roughness: 0.4 });
    const FH = 1.5;
    const sides = [[B.x0, B.z0, B.x1, B.z0], [B.x1, B.z0, B.x1, B.z1], [B.x1, B.z1, B.x0, B.z1], [B.x0, B.z1, B.x0, B.z0]];
    for (const [x0, z0, x1, z1] of sides) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const t = ft.clone();
      t.needsUpdate = true;
      t.repeat.set(len / 0.9, FH / 0.9);
      const pm = fenceMat.clone();
      pm.map = t;
      const panel = new T.Mesh(new T.PlaneGeometry(len, FH), pm);
      panel.position.set((x0 + x1) / 2, FH / 2, (z0 + z1) / 2);
      panel.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
      scene.add(panel);
      const n = Math.ceil(len / 4);
      for (let i = 0; i <= n; i++) {
        const u = i / n, x = x0 + (x1 - x0) * u, z = z0 + (z1 - z0) * u;
        const p = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, FH + 0.1, 8), postMat);
        p.position.set(x, (FH + 0.1) / 2, z);
        scene.add(p);
      }
      pipeAlong([x0, FH, z0], [x1, FH, z1], 0.04, postMat, false);
    }
    // trees (round crowns), lamp posts, bleachers by the start, and the sign over the half-pipe
    const trunk = std('#7a5232', { roughness: 0.9 });
    const leafCols = ['#4caf50', '#3d9a40', '#67c05a', '#2f8a3a'];
    let r = 3;
    const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
    const crowns = leafCols.map((c2) => std(c2, { roughness: 0.85 }));
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2 + rnd() * 0.08, R = 42 + rnd() * 22;
      const x = Math.cos(a) * R * 1.1, z = Math.sin(a) * R * 0.95;
      const s = 0.8 + rnd() * 0.7;
      const tr = new T.Mesh(new T.CylinderGeometry(0.22 * s, 0.3 * s, 2.2 * s, 7), trunk);
      tr.position.set(x, 1.1 * s, z);
      tr.castShadow = true;
      scene.add(tr);
      const cr = new T.Mesh(new T.IcosahedronGeometry(1.8 * s, 1), crowns[i % 4]);
      cr.position.set(x, 3.1 * s, z);
      cr.castShadow = true;
      scene.add(cr);
    }
    const lampMat = std('#3a3f48', { metalness: 0.5, roughness: 0.5 });
    for (const [x, z] of [[B.x0 - 1.5, B.z0 - 1.5], [B.x1 + 1.5, B.z0 - 1.5], [B.x0 - 1.5, B.z1 + 1.5], [B.x1 + 1.5, B.z1 + 1.5]]) {
      pipeAlong([x, 0, z], [x, 8, z], 0.12, lampMat);
      const head = new T.Mesh(new T.BoxGeometry(1.2, 0.3, 0.6), lampMat);
      head.position.set(x, 8, z);
      scene.add(head);
    }
    // bleachers along the south fence
    const seatCols = ['#ff3d7f', '#ffd400', '#18d4ff', '#3fe0b0'];
    for (let k = 0; k < 3; k++) {
      const m = new T.Mesh(new T.BoxGeometry(18, 0.4, 1), std(seatCols[k], { roughness: 0.7 }));
      m.position.set(0, 0.2 + k * 0.45, B.z1 + 1.2 + k * 1);
      m.castShadow = m.receiveShadow = true;
      scene.add(m);
      const base = new T.Mesh(new T.BoxGeometry(18, 0.2 + k * 0.45, 1), std('#8d939b'));
      base.position.set(0, (0.2 + k * 0.45) / 2 - 0.1, B.z1 + 1.2 + k * 1);
      scene.add(base);
    }
    // the big sign
    const sign = new T.Group();
    const [sc, sg] = makeCanvas(1024, 256);
    sign.paint = () => {
      sg.clearRect(0, 0, 1024, 256);
      sg.fillStyle = '#14121f'; gfx.roundRect(sg, 6, 6, 1012, 244, 40); sg.fill();
      sg.fillStyle = '#ffd400'; gfx.roundRect(sg, 22, 22, 980, 212, 30); sg.fill();
      const name = (window.SK_TITLE || 'TT Skate Park').toUpperCase();
      sg.font = `120px ${gfx.FONT}`; sg.textAlign = 'center'; sg.textBaseline = 'middle';
      const w = sg.measureText(name).width, k = Math.min(1, 900 / w);
      sg.save(); sg.translate(512, 132); sg.scale(k, k);
      sg.lineWidth = 16; sg.strokeStyle = '#14121f'; sg.strokeText(name, 0, 0);
      // every TT in the brothers' colours
      let x = -w / 2;
      for (let i = 0; i < name.length; i++) {
        const ch = name[i], cw = sg.measureText(ch).width;
        const tt = name.slice(i, i + 2) === 'TT' ? 0 : name.slice(i - 1, i + 1) === 'TT' ? 1 : -1;
        sg.fillStyle = tt === 0 ? '#18d4ff' : tt === 1 ? '#ff8a1f' : '#ffffff';
        sg.textAlign = 'left';
        sg.fillText(ch, x, 0);
        x += cw;
      }
      sg.restore();
      if (sign.tex) sign.tex.needsUpdate = true;
    };
    sign.paint();
    sign.tex = toTexture(sc);
    const board = new T.Mesh(new T.PlaneGeometry(16, 4), new T.MeshStandardMaterial({ map: sign.tex, roughness: 0.6 }));
    board.position.set(0, P.HP + 4.2, -24.8);
    sign.add(board);
    for (const x of [-6, 6]) pipeAlong([x, 0, -24.9], [x, P.HP + 4.2, -24.9], 0.14, lampMat);
    scene.add(sign);
    lettering.sign = sign;
  }

  // ------------------------------------------------------------------ particles
  const parts = [];
  let confettiMesh, dotMesh;
  const PMAX = 500;
  function makeParticles() {
    confettiMesh = new T.InstancedMesh(new T.PlaneGeometry(0.09, 0.14), new T.MeshBasicMaterial({ side: T.DoubleSide }), PMAX);
    dotMesh = new T.InstancedMesh(new T.IcosahedronGeometry(0.06, 0), new T.MeshBasicMaterial({ transparent: true, opacity: 0.92 }), PMAX);
    confettiMesh.frustumCulled = dotMesh.frustumCulled = false;
    confettiMesh.count = dotMesh.count = 0;
    const white = new T.Color('#ffffff');
    for (let i = 0; i < PMAX; i++) { confettiMesh.setColorAt(i, white); dotMesh.setColorAt(i, white); }
    scene.add(confettiMesh, dotMesh);
  }
  function emit(kind, x, y, z, n, opts = {}) {
    const rand = Math.random;
    for (let i = 0; i < n && parts.length < PMAX * 2; i++) {
      const a = rand() * Math.PI * 2, sp = (opts.speed || 2) * (0.4 + rand() * 0.8);
      parts.push({
        kind, x: x + (rand() - 0.5) * (opts.spread || 0.1), y, z: z + (rand() - 0.5) * (opts.spread || 0.1),
        vx: Math.cos(a) * sp + (opts.vx || 0), vy: (opts.up || 3) * (0.6 + rand() * 0.7), vz: Math.sin(a) * sp + (opts.vz || 0),
        life: (opts.life || 1) * (0.7 + rand() * 0.6), t: 0, size: (opts.size || 1) * (0.6 + rand() * 0.8),
        color: new T.Color(Array.isArray(opts.color) ? opts.color[Math.floor(rand() * opts.color.length)] : opts.color || '#ffffff'),
        rx: rand() * 6, ry: rand() * 6, spin: (rand() - 0.5) * 14, g: opts.gravity === undefined ? 9 : opts.gravity, drag: opts.drag || 0,
      });
    }
  }
  const CONF = ['#ff3d7f', '#ffd400', '#18d4ff', '#3fe0b0', '#ff8a1f', '#9b6bff', '#ffffff'];
  const fx = {
    confetti(x, y, z, n = 180) { emit('c', x, y + 1, z, n, { speed: 3, up: 7, life: 2.8, color: CONF, gravity: 4.5, drag: 1.5, spread: 1 }); },
    sparkle(x, y, z, n = 26) { emit('d', x, y + 0.1, z, n, { speed: 1.6, up: 3, life: 0.8, color: ['#ffd400', '#ffffff', '#fff3a0'], size: 0.8, gravity: 4 }); },
    poof(x, y, z) { emit('d', x, y + 0.6, z, 30, { speed: 1.6, up: 1.4, life: 0.7, color: ['#ffffff', '#fff3c4', '#e8e8ff'], size: 2, gravity: -1, drag: 3, spread: 0.6 }); },
    sparks(x, y, z, vx, vz) { emit('d', x, y, z, 3, { speed: 1.2, up: 1.6, life: 0.35, color: ['#ffd27a', '#ffb02e', '#fff3a0'], size: 0.45, gravity: 9, vx: -vx * 0.3, vz: -vz * 0.3 }); },
    dust(x, y, z) { emit('d', x, y + 0.05, z, 12, { speed: 1.6, up: 0.8, life: 0.5, color: ['#d9d2c5', '#c4bcae'], size: 1.3, gravity: 1, drag: 3, spread: 0.4 }); },
  };
  function updateParticles(dt) {
    let nc = 0, nd = 0;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.t += dt;
      if (p.t >= p.life) { parts.splice(i, 1); continue; }
      p.vy -= p.g * dt;
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vy *= p.kind === 'c' ? Math.exp(-p.drag * 0.6 * dt) : k; p.vz *= k;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.rx += p.spin * dt; p.ry += p.spin * 0.7 * dt;
      const fade = Math.min(1, (p.life - p.t) / 0.3), s = p.size * fade;
      Q.setFromEuler(E1.set(p.rx, p.ry, 0));
      M4.compose(V3.set(p.x, p.y, p.z), Q, S1.set(s, s, s));
      if (p.kind === 'c' && nc < PMAX) { confettiMesh.setMatrixAt(nc, M4); confettiMesh.setColorAt(nc, p.color); nc++; } else if (nd < PMAX) { dotMesh.setMatrixAt(nd, M4); dotMesh.setColorAt(nd, p.color); nd++; }
    }
    confettiMesh.count = nc;
    dotMesh.count = nd;
    confettiMesh.instanceMatrix.needsUpdate = dotMesh.instanceMatrix.needsUpdate = true;
    if (confettiMesh.instanceColor) confettiMesh.instanceColor.needsUpdate = true;
    if (dotMesh.instanceColor) dotMesh.instanceColor.needsUpdate = true;
  }

  // ------------------------------------------------------------------ skaters
  const boardTexCache = {};
  function boardTex(color, top) {
    const k = color + top;
    if (boardTexCache[k]) return boardTexCache[k];
    const [c, g] = makeCanvas(64, 256);
    if (top) {
      g.fillStyle = '#26242c'; g.fillRect(0, 0, 64, 256);
      speckle(g, 64, 256, 600, ['#3a3842', '#1a1920'], 2);
      g.fillStyle = color; g.fillRect(26, 0, 12, 256);
    } else {
      g.fillStyle = color; g.fillRect(0, 0, 64, 256);
      g.fillStyle = '#ffffff'; g.font = `40px ${gfx.EMOJI_FONT}`; g.textAlign = 'center'; g.fillText('⭐', 32, 140);
      g.fillStyle = gfx.shade(color, -0.3); g.fillRect(0, 20, 64, 10); g.fillRect(0, 226, 64, 10);
    }
    return (boardTexCache[k] = toTexture(c));
  }
  // the board: 0.8 m along its local -z, the group's origin at the deck's middle (flips spin round it)
  function makeBoard(color) {
    const g = new T.Group();
    const deckMat = [std('#e8c58a'), std('#e8c58a'), std('#ffffff', { map: boardTex(color, true) }), std('#ffffff', { map: boardTex(color, false) }), std('#e8c58a'), std('#e8c58a')];
    const deck = new T.Mesh(new T.BoxGeometry(0.22, 0.025, 0.6), deckMat);
    g.add(deck);
    for (const s of [-1, 1]) {
      const kick = new T.Mesh(new T.BoxGeometry(0.22, 0.025, 0.14), deckMat);
      kick.position.set(0, 0.022, s * 0.36);
      kick.rotation.x = s * 0.35;
      g.add(kick);
      const truck = new T.Mesh(new T.BoxGeometry(0.17, 0.035, 0.05), std('#c9ced6', { metalness: 0.7, roughness: 0.3 }));
      truck.position.set(0, -0.03, s * 0.23);
      g.add(truck);
      for (const w of [-1, 1]) {
        const wh = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.035, 10), std('#fff6d8', { roughness: 0.5 }));
        wh.rotation.z = Math.PI / 2;
        wh.position.set(w * 0.1, -0.055, s * 0.23);
        g.add(wh);
      }
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.position.y = 0.088;
    return g;
  }
  const blobTex = () => blobTex.t || (blobTex.t = gfx.radialTexture(64, [[0, 'rgba(0,0,0,0.42)'], [1, 'rgba(0,0,0,0)']]));

  function makeSkater(entry, scale, color) {
    const holder = new T.Group();
    const body = new T.Group();
    holder.add(body);
    const board = makeBoard(color || entry.tag || '#ff3d7f');
    body.add(board);
    const p = Kit.people.build(entry.look);
    const rider = new T.Group();
    rider.add(p.root);
    rider.scale.setScalar(scale);
    rider.position.y = 0.105;
    p.root.rotation.y = -Math.PI / 2; // sideways on the board, facing his toe side (+x); the nose is his left
    p.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    body.add(rider);
    scene.add(holder);
    const blob = new T.Mesh(new T.PlaneGeometry(1.1, 1.1), new T.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    scene.add(blob);
    return { holder, body, board, rider, p, entry, scale, blob, ph: Math.random() * 6, n: new T.Vector3(0, 1, 0), pos: new T.Vector3(), first: true, tag: null, celebrate: null, jump: 0, sparkT: 0, hide: false, cheer: 0 };
  }
  function removeSkater(v) { if (!v) return; scene.remove(v.holder); scene.remove(v.blob); }
  function setTag(v, text, color) {
    if (v.tag) v.rider.remove(v.tag);
    v.tag = gfx.nameTag(text, color);
    v.tag.position.y = 2.55;
    v.tag.scale.multiplyScalar(1 / v.scale * 0.75);
    v.rider.add(v.tag);
  }

  // a skater's own poses on the board
  function ridePose(v, s, k, extra) {
    const p = v.p, to = (o, prop, val) => { o[prop] += (val - o[prop]) * k; };
    let ll = 0, rl = 0, llz = -0.3, rlz = 0.3, la = 0.25, ra = 0.25, laz = -1.05, raz = 1.05, lean = -0.14, head = 0.05, headY = 0.95, bob = 0;
    const a = s.air, mode = s.mode;
    if (mode === 'air') {
      llz = -0.38; rlz = 0.38; ll = rl = 0.35; la = ra = 0.6; laz = -1.5; raz = 1.5; lean = -0.25;
      if (a && a.grab) {
        // reach down for the board: front hand for nose grabs, back hand for the rest
        ll = rl = 0.75; lean = -0.62; headY = 0.5;
        if (a.grab.name === 'NOSEGRAB') { la = 0.85; laz = -0.2; } else if (a.grab.name === 'MELON') { la = 0.55; laz = 0.25; } else { ra = 0.85; raz = 0.2; }
      }
      if (a && a.flip) { ll = rl = 0.55; llz = -0.5; rlz = 0.5; lean = -0.35; }
    } else if (mode === 'grind') {
      la = ra = 0.1; laz = -1.35; raz = 1.35; lean = -0.2; bob = -0.05;
      const b = s.balance || 0;
      lean += b * 0.1;
    } else if (extra.push && mode === 'ground') {
      // a push: the back foot kicks along the ground
      const c = Math.sin(v.ph * 0.9);
      rl = c * 0.65; rlz = 0.12; lean = -0.3; bob = -0.04 - Math.abs(c) * 0.03; headY = 1.1;
    } else if (s.landT < 0.25) { bob = -0.12 * (1 - s.landT / 0.25); lean = -0.35; ll = rl = 0.25; }
    if (s.popT < 0.2) { bob = -0.08; ll = rl = 0.45; }
    if (v.cheer > 0) { v.cheer -= extra.dt || 0.016; la = ra = 2.8; laz = -0.15; raz = 0.15; headY = 0.4; }
    to(p.legL.rotation, 'x', ll); to(p.legR.rotation, 'x', rl);
    to(p.legL.rotation, 'z', llz); to(p.legR.rotation, 'z', rlz);
    to(p.armL.rotation, 'x', la); to(p.armR.rotation, 'x', ra);
    to(p.armL.rotation, 'z', laz); to(p.armR.rotation, 'z', raz);
    to(p.hips.rotation, 'x', lean); to(p.hips.rotation, 'y', 0);
    to(p.head.rotation, 'x', head); to(p.head.rotation, 'y', headY);
    p.hips.position.y = p.hipY + bob;
    p.rig.scale.setScalar(1);
    p.rig.rotation.set(0, 0, 0);
    if (p.fingers) for (const f of p.fingers) f.visible = false;
  }

  const NV = new T.Vector3(), FV = new T.Vector3(), XV = new T.Vector3(), ZV = new T.Vector3(), BM = new T.Matrix4();
  const gq = { gx: 0, gz: 0 };
  // place and pose a skater from his physics state s. extra: { push, dt }
  function updateSkater(v, s, dt, extra = {}) {
    v.holder.visible = v.blob.visible = !v.hide;
    if (v.hide) return;
    v.ph += dt * 8;
    const k = 1 - Math.exp(-16 * dt);
    // position: straight on, except a snap (onto a rail) slides over quickly
    V3.set(s.x, s.y, s.z);
    if (v.first || v.pos.distanceTo(V3) < 0.25) v.pos.copy(V3); else v.pos.lerp(V3, 1 - Math.exp(-28 * dt));
    v.holder.position.copy(v.pos);
    // the board sits on the surface: tilt to its slope on the ground, level out in the air
    if (s.mode === 'ground' || s.mode === 'bail') { P.H(s.x, s.z, gq); NV.set(-gq.gx, 1, -gq.gz).normalize(); } else NV.copy(UP);
    if (v.first) v.n.copy(NV); else v.n.lerp(NV, s.mode === 'air' ? 1 - Math.exp(-3 * dt) : 1 - Math.exp(-30 * dt)).normalize();
    v.first = false;
    FV.set(Math.cos(s.th), 0, Math.sin(s.th));
    FV.addScaledVector(v.n, -FV.dot(v.n)).normalize();
    ZV.copy(FV).negate();
    XV.crossVectors(v.n, ZV).normalize();
    BM.makeBasis(XV, v.n, ZV);
    v.holder.quaternion.setFromRotationMatrix(BM);
    // the board: ollie pop, flips, boardslides
    const b = v.board, a = s.air;
    b.rotation.set(0, 0, 0);
    b.position.set(0, 0.088, 0);
    v.body.rotation.y = s.mode === 'grind' && s.grind.type === 'BOARDSLIDE' ? Math.PI / 2 : 0;
    v.rider.position.y = 0.105;
    if (s.popT < 0.28) b.rotation.x = Math.sin((s.popT / 0.28) * Math.PI) * 0.5;
    if (a && a.flip) {
      const u = a.flip.p, n = a.flip.name;
      if (n === 'KICKFLIP') b.rotation.z = u * Math.PI * 2;
      else if (n === 'HEELFLIP') b.rotation.z = -u * Math.PI * 2;
      else if (n === 'POP SHOVE-IT') b.rotation.y = u * Math.PI;
      else { b.rotation.y = u * Math.PI * 2; b.rotation.z = u * Math.PI * 2; }
      b.position.y = 0.088 + Math.sin(u * Math.PI) * 0.22;
      v.rider.position.y = 0.105 + Math.sin(u * Math.PI) * 0.3;
    }
    if (a && a.grab) b.position.y = 0.12;
    // the rider
    const p = v.p;
    if (s.mode === 'bail') {
      Kit.people.pose(p, v.ph, 'fall', k);
      const u = Math.min(1, s.bailT / 0.4);
      p.rig.rotation.z = -u * 1.3;
      v.rider.position.y = 0.105 - u * 0.25;
      b.position.set(0.5 * u, 0.03, -0.6 * u);
      b.rotation.z = u * 3;
    } else if (v.celebrate) {
      p.rig.rotation.set(0, 0, 0);
      Kit.people.pose(p, v.ph, v.celebrate === 'stand' || v.celebrate === 'high5' ? 'none' : v.celebrate, k);
      p.legL.rotation.x *= 0.2; p.legR.rotation.x *= 0.2;
      if (v.celebrate === 'high5') { p.armL.rotation.x = p.armR.rotation.x = 2.8; p.armL.rotation.z = -0.15; p.armR.rotation.z = 0.15; }
      p.head.rotation.y += (0 - p.head.rotation.y) * k;
      if (v.jump > 0) {
        v.jump = Math.max(0, v.jump - dt);
        v.rider.position.y = 0.105 + Math.sin(Math.min(1, 1 - v.jump / 0.7) * Math.PI) * 0.5;
      }
    } else ridePose(v, s, k, extra);
    // grinding: sparks off the rail
    if (s.mode === 'grind') {
      v.sparkT -= dt;
      if (v.sparkT <= 0) { v.sparkT = 0.04; fx.sparks(s.x, s.y + 0.03, s.z, Math.cos(s.th) * s.grind.gs, Math.sin(s.th) * s.grind.gs); }
    }
    // the blob shadow, on the ground under him
    const gy = s.mode === 'air' || s.mode === 'grind' ? P.H(s.x, s.z, gq) : s.y;
    if (s.mode !== 'ground' && s.mode !== 'bail') NV.set(-gq.gx, 1, -gq.gz).normalize();
    v.blob.position.set(s.x, gy + 0.03, s.z);
    v.blob.quaternion.setFromUnitVectors(V4.set(0, 0, 1), NV);
    const hgt = Math.max(0, s.y - gy);
    v.blob.scale.setScalar(Math.max(0.35, 1 - hgt * 0.15));
    v.blob.material.opacity = Math.max(0.25, 1 - hgt * 0.2);
  }

  // ------------------------------------------------------------------ the brother's trick line
  const line = { arrows: null, markers: [], stars: [], on: false, t: 0 };
  function chevronTex() {
    const [c, g] = makeCanvas(64, 64);
    g.fillStyle = '#ffd400'; g.strokeStyle = '#ff8a1f'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(8, 44); g.lineTo(32, 14); g.lineTo(56, 44); g.lineTo(44, 50); g.lineTo(32, 34); g.lineTo(20, 50); g.closePath();
    g.fill(); g.stroke();
    return toTexture(c);
  }
  function makeLineBits() {
    line.arrows = new T.InstancedMesh(new T.PlaneGeometry(0.75, 0.75), new T.MeshBasicMaterial({ map: chevronTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }), 240);
    line.arrows.count = 0;
    line.arrows.frustumCulled = false;
    line.arrows.renderOrder = 2;
    scene.add(line.arrows);
  }
  const ICON = { jump: '⬆️', flip: '🌀', grab: '✋', spin: '🔄', grind: '🛤️' };
  function emojiSprite(e, size) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: gfx.emojiTexture(e), transparent: true, depthWrite: false }));
    s.scale.set(size, size, 1);
    s.renderOrder = 3;
    scene.add(s);
    return s;
  }
  function clearLine() {
    for (const m of line.markers) scene.remove(m.s);
    for (const m of line.stars) scene.remove(m.s);
    line.markers = [];
    line.stars = [];
    line.arrows.count = 0;
    line.on = false;
  }
  // draw a line: arrows on the ground through its spots, an icon over each trick, a gold star to collect at each spot
  function showLine(ln) {
    clearLine();
    const pts = ln.steps.map((st) => new T.Vector3(st.x, 0, st.z));
    const curve = new T.CatmullRomCurve3(pts, false, 'centripetal');
    const len = curve.getLength(), n = Math.min(240, Math.floor(len / 0.9));
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n;
      const p = curve.getPointAt(u), tg = curve.getTangentAt(u);
      P.H(p.x, p.z, gq);
      NV.set(-gq.gx, 1, -gq.gz).normalize();
      const y = P.H(p.x, p.z) + 0.04;
      // flat on the surface, pointing along the line
      ZV.set(tg.x, 0, tg.z).normalize();
      FV.copy(ZV).addScaledVector(NV, -ZV.dot(NV)).normalize(); // forward on the surface
      XV.crossVectors(FV, NV).normalize();
      BM.makeBasis(XV, FV, NV); // the plane's +y points along the line, its face up
      Q.setFromRotationMatrix(BM);
      M4.compose(V3.set(p.x, y, p.z), Q, S1.set(1, 1, 1));
      line.arrows.setMatrixAt(i, M4);
    }
    line.arrows.count = n;
    line.arrows.instanceMatrix.needsUpdate = true;
    // icons for the tricks, and a rail icon over any rail the line rides
    ln.steps.forEach((st, i) => {
      const icon = st.jump ? (st.air ? ICON[st.air] : ICON.jump) : st.air ? ICON[st.air] : null;
      if (icon) line.markers.push({ s: emojiSprite(icon, 1.1), x: st.x, z: st.z, y: P.H(st.x, st.z) + 2.1 + (st.air && !st.jump ? 1.2 : 0), ph: i });
      if (i > 0) line.stars.push({ s: emojiSprite('⭐', 0.8), x: st.x, z: st.z, y: P.H(st.x, st.z) + 1.0, i, got: false });
    });
    for (let i = 0; i < ln.steps.length - 1; i++) {
      const a = ln.steps[i], b2 = ln.steps[i + 1];
      for (const r of P.rails) {
        const mx = (a.x + b2.x) / 2, mz = (a.z + b2.z) / 2;
        const u = ((mx - r.a[0]) * r.ux + (mz - r.a[2]) * r.uz) / r.lh;
        if (u < 0 || u > 1) continue;
        const cx = r.a[0] + r.ux * u * r.lh, cz = r.a[2] + r.uz * u * r.lh;
        if (Math.hypot(mx - cx, mz - cz) < 0.6) line.markers.push({ s: emojiSprite(ICON.grind, 1.0), x: cx, z: cz, y: P.railY(r, u) + 1.5, ph: i + 0.5 });
      }
    }
    line.on = true;
    line.t = 0;
  }
  function collectStar(i) {
    const st = line.stars.find((m) => m.i === i && !m.got);
    if (!st) return null;
    st.got = true;
    fx.sparkle(st.x, st.y, st.z, 30);
    return st;
  }
  function updateLine(dt) {
    if (!line.on) return;
    line.t += dt;
    for (const m of line.markers) m.s.position.set(m.x, m.y + Math.sin(line.t * 3 + m.ph) * 0.15, m.z);
    for (const m of line.stars) {
      if (m.got) { m.s.scale.multiplyScalar(Math.exp(-8 * dt)); m.s.position.y += dt * 2; continue; }
      const s = 0.8 + Math.sin(line.t * 5 + m.i) * 0.1;
      m.s.scale.set(s, s, 1);
      m.s.position.set(m.x, m.y, m.z);
      m.s.material.rotation = Math.sin(line.t * 2 + m.i) * 0.3;
    }
    // the arrows pulse
    line.arrows.material.opacity = 0.65 + Math.sin(line.t * 6) * 0.3;
  }

  // ------------------------------------------------------------------ sprites
  function treatSprite(emoji) { return emojiSprite(emoji, 0.6); }
  function removeObj(o) { if (o) scene.remove(o); }

  // ------------------------------------------------------------------ cameras
  const cam = { pos: new T.Vector3(0, 8, 30), look: new T.Vector3(0, 0, 0), yaw: -Math.PI / 2, pipe: 0, snap: true };
  const inPipe = (s) => Math.abs(s.x) < 11.2 && s.z < -9.6 && s.z > -23.5;
  const WANT = new T.Vector3(), WLOOK = new T.Vector3(), PP = new T.Vector3(), PL = new T.Vector3();
  function camFollow(s, dt) {
    const vh = Math.hypot(s.vx, s.vz);
    let md = cam.yaw;
    if (s.mode === 'ground' && Math.abs(s.sp) > 1.2) md = s.sp >= 0 ? s.th : s.th + Math.PI;
    else if (s.mode === 'grind') md = Math.atan2(Math.sin(s.th), Math.cos(s.th));
    else if (s.mode === 'air' && vh > 2.5 && s.air && s.air.kind !== 'vert') md = Math.atan2(s.vz, s.vx);
    cam.yaw = wrap(cam.yaw + wrap(md - cam.yaw) * (cam.snap ? 1 : 1 - Math.exp(-2.4 * dt)));
    cam.pipe += ((inPipe(s) ? 1 : 0) - cam.pipe) * (cam.snap ? 1 : 1 - Math.exp(-2.5 * dt));
    const t = tall();
    const back = t ? 8.2 : 6.6, up = t ? 4.3 : 3.1;
    const gy = Math.max(s.y, P.H(s.x, s.z)) * 0.85 + (s.mode === 'air' ? s.y * 0.15 : 0);
    WANT.set(s.x - Math.cos(cam.yaw) * back, gy + up, s.z - Math.sin(cam.yaw) * back);
    WLOOK.set(s.x + Math.cos(cam.yaw) * 2.2, s.y + 0.9, s.z + Math.sin(cam.yaw) * 2.2);
    // in the half-pipe: from its open east end, so he goes back and forth across the screen
    if (cam.pipe > 0.001) {
      PP.set(s.x + (t ? 15 : 12.5), 4.6 + s.y * 0.3, -16);
      PL.set(s.x - 1, 1.4 + s.y * 0.45, -16 + (s.z + 16) * 0.55);
      WANT.lerp(PP, cam.pipe);
      WLOOK.lerp(PL, cam.pipe);
    }
    WANT.y = Math.max(WANT.y, P.H(WANT.x, WANT.z) + 1.2);
    const k = cam.snap ? 1 : 1 - Math.exp(-5 * dt);
    cam.pos.lerp(WANT, k);
    cam.look.lerp(WLOOK, cam.snap ? 1 : 1 - Math.exp(-8 * dt));
    cam.snap = false;
    place(s.x, s.z);
  }
  function camTitle(time) {
    const a = time * 0.07 + 0.9;
    cam.pos.set(Math.cos(a) * 30, 15 + Math.sin(time * 0.13) * 2, Math.sin(a) * 25 + 2);
    cam.look.set(0, 0.5, -2);
    cam.snap = true;
    place(0, 0);
  }
  // in front of someone (the winner), looking at him
  function camAt(x, y, z, yaw, dist = 4.2, h = 1.6) {
    WANT.set(x + Math.cos(yaw) * dist, y + h, z + Math.sin(yaw) * dist);
    cam.pos.lerp(WANT, 0.08);
    cam.look.lerp(WLOOK.set(x, y + 0.9, z), 0.12);
    place(x, z);
  }
  function place(fx2, fz) {
    camera.position.copy(cam.pos);
    camera.lookAt(cam.look);
    sun.position.set(fx2 + 18, 32, fz + 12);
    sun.target.position.set(fx2, 0, fz);
  }

  function update(dt) {
    updateParticles(dt);
    updateLine(dt);
  }
  function render() { renderer.render(scene, camera); }
  function repaintSign() { if (lettering.sign) lettering.sign.paint(); }

  SK.scene = {
    init, fit, render, update, fx, cam, camFollow, camTitle, camAt, makeSkater, removeSkater, updateSkater, setTag,
    showLine, clearLine, collectStar, treatSprite, emojiSprite, removeObj, repaintSign, inPipe,
    get camera() { return camera; }, get scene() { return scene; }, get renderer() { return renderer; },
  };
})();
