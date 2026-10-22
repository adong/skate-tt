/* TT Skate Park: the headless check, the rules the game promises, tested on the real engine (no Three.js).
   node tools/check.js runs it (and --fail proves it can fail); in the page, game.check() runs a quicker version.
   1. Tricks land reliably on EASY: the autopilot skates every trick line on EASY and does the line's tricks with
      no bail, and hundreds of runs of random button mashing on EASY never bail and finish every flip they start.
   2. Scoring: trick points, multipliers, repeats and lost combos give the numbers they should, and the score is
      exactly the banked combos.
   3. No falling through ramps: random riding and thousands of drops from the sky onto every ramp never end up
      inside anything, never jump up through the side of a ramp, and stay in the park. */
(function (root) {
  'use strict';
  const SK = (root.SK = root.SK || {});
  const P = SK.park, K = SK.skater, S = SK.score;

  const names = (s) => Object.keys(s.stats.trickNames);
  const has = (s, want) => (want === 'GRIND' ? s.stats.grinds > 0 : (s.stats.trickNames[want] || 0) > 0);

  // the skater starts at a line's first spot, facing the second, at the line's speed
  function lineSkater(line, level, seed) {
    const a = line.steps[0], b = line.steps[1];
    const s = K.create({ level, seed, spawn: { x: a.x, z: a.z, heading: Math.atan2(b.z - a.z, b.x - a.x) } });
    s.sp = b.v || 6.5;
    return s;
  }
  function runLine(line, level, seed, maxT) {
    const s = lineSkater(line, level, seed);
    const b = SK.bot.create({ seed });
    SK.bot.setLine(b, line);
    let t = 0, maxJump = 0;
    while (t < (maxT || 25) && (b.line || s.mode !== 'ground' || s.combo)) {
      const y0 = s.y;
      K.step(s, SK.bot.think(b, s));
      maxJump = Math.max(maxJump, s.y - y0);
      t += K.DT;
    }
    K.finish(s);
    return { s, done: !b.line, t, maxJump };
  }

  // random buttons: steering held for a while, ollies, flips and grabs at random moments
  function monkey(level, seed, secs, from) {
    const r = K.rng(seed);
    const sp = from || { x: P.bounds.x0 + 4 + r() * (P.bounds.x1 - P.bounds.x0 - 8), z: P.bounds.z0 + 4 + r() * (P.bounds.z1 - P.bounds.z0 - 8), heading: r() * 6.28 };
    const s = K.create({ level, seed, spawn: sp });
    s.sp = r() * 8;
    const inp = { steer: 0, push: false, brake: false, jump: false, flip: false, grab: false, dir: '' };
    let hold = 0, maxJump = 0, bad = '';
    const dirs = ['', 'left', 'right', 'up', 'down'];
    for (let i = 0; i < secs / K.DT; i++) {
      if (--hold <= 0) {
        hold = 10 + Math.floor(r() * 60);
        inp.steer = [-1, -0.5, 0, 0, 0.5, 1][Math.floor(r() * 6)];
        inp.push = r() < 0.6;
        inp.brake = r() < 0.05;
        inp.grab = r() < 0.2;
        inp.dir = dirs[Math.floor(r() * 5)];
      }
      inp.jump = r() < 0.012;
      inp.flip = r() < 0.02;
      const y0 = s.y;
      K.step(s, inp);
      maxJump = Math.max(maxJump, s.y - y0);
      if (!bad && !(Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isFinite(s.z) && Number.isFinite(s.sp))) bad = 'NaN';
      if (!bad && (s.x < P.bounds.x0 || s.x > P.bounds.x1 || s.z < P.bounds.z0 || s.z > P.bounds.z1)) bad = 'left the park';
    }
    return { s, maxJump, bad };
  }

  // dropped from the sky with a random push, onto anything
  function drop(seed) {
    const r = K.rng(seed);
    const x = P.bounds.x0 + 1 + r() * (P.bounds.x1 - P.bounds.x0 - 2), z = P.bounds.z0 + 1 + r() * (P.bounds.z1 - P.bounds.z0 - 2);
    const s = K.create({ level: r() < 0.5 ? 'easy' : 'normal', seed, spawn: { x, z, heading: r() * 6.28 } });
    s.mode = 'air';
    s.air = { t: 0, kind: 'drop', flip: null, flipNext: null, grab: null, spinUser: 0, autoLeft: 0, autoRate: 0 };
    s.y = P.H(x, z) + 0.3 + r() * 6;
    s.vx = (r() * 2 - 1) * 11; s.vz = (r() * 2 - 1) * 11; s.vy = -12 + r() * 16;
    let maxJump = 0;
    for (let i = 0; i < 6 / K.DT; i++) { const y0 = s.y; K.step(s); maxJump = Math.max(maxJump, s.y - y0); }
    return { s, maxJump, settled: s.stats.landed + s.stats.grinds + s.stats.bails > 0 };
  }

  function run(opt = {}) {
    const quick = !!opt.quick, out = [];
    const ok = (name, pass, detail) => { out.push({ name, pass: !!pass, detail }); };

    // ---- 2. scoring ----
    const c = (list) => { const k = S.newCombo(); for (const [n, t] of list) S.add(k, n, t); return S.value(k); };
    ok('a kickflip alone is 300', c([['KICKFLIP']]) === 300, c([['KICKFLIP']]));
    ok('kickflip + 1 s 50-50 grind = (300 + 350) x 2 = 1300', c([['KICKFLIP'], ['50-50', 1]]) === 1300, c([['KICKFLIP'], ['50-50', 1]]));
    ok('an ollie adds points but no multiplier: ollie + kickflip = 350', c([['OLLIE'], ['KICKFLIP']]) === 350, c([['OLLIE'], ['KICKFLIP']]));
    ok('the same trick twice is worth half: kickflip x2 = (300 + 150) x 2 = 900', c([['KICKFLIP'], ['KICKFLIP']]) === 900, c([['KICKFLIP'], ['KICKFLIP']]));
    ok('a half-second indy grab is 350, a 360 spin 400', S.points('INDY', 0.5) === 350 && S.points('360') === 400);
    {
      // a real run: every banked combo is its tricks' sum x multiplier, and the score is all of them
      let fine = true, banked = 0, n = 0;
      for (let seed = 1; seed <= (quick ? 4 : 12); seed++) {
        const m = monkey(seed % 2 ? 'easy' : 'normal', 900 + seed, 30);
        for (const e of m.s.events) {
          if (e.type !== 'combo') continue;
          n++;
          banked += e.pts;
          if (!e.tricks.length || e.pts !== e.sum * Math.max(1, e.mult)) fine = false;
        }
        if (m.s.score !== banked) fine = false;
        banked = 0;
      }
      ok('in real runs the score is exactly the banked combos (sum x multiplier)', fine && n > 0, `${n} combos`);
    }
    {
      // a bail loses the combo: NORMAL, a kickflip straight away, then another just before the ground
      const s = K.create({ level: 'normal', spawn: { x: 0, z: 18.5, heading: Math.PI } });
      s.sp = 5;
      K.step(s, { steer: 0, flip: true });
      let flipped = false;
      for (let i = 0; i < 240 && s.mode !== 'bail'; i++) {
        const near = s.mode === 'air' && s.vy < 0 && s.y - P.H(s.x, s.z) < 0.25;
        K.step(s, { steer: 0, flip: near && !flipped });
        if (near) flipped = true;
      }
      const lost = s.events.find((e) => e.type === 'lost');
      ok('NORMAL: landing in the middle of a flip is a bail, and the kickflip before it is lost', s.mode === 'bail' && lost && lost.pts === 300 && s.score === 0, s.mode + ' ' + (lost && lost.pts));
    }

    // ---- 1. tricks land reliably on EASY ----
    for (const line of P.lines) {
      const r = runLine(line, 'easy', 3);
      const miss = (line.expect || []).filter((w) => !has(r.s, w));
      ok(`EASY: the autopilot skates "${line.id}" and lands ${(line.expect || []).join(', ')}`, r.done && !miss.length && !r.s.stats.bails,
        `${names(r.s).join(' ')} | score ${r.s.score}${miss.length ? ' | missing ' + miss.join(' ') : ''}${r.s.stats.bails ? ' | BAILS ' + r.s.stats.bails : ''}`);
    }
    {
      let bails = 0, flips = 0, flipsDone = 0, airs = 0, landed = 0, tricks = 0;
      const N = quick ? 40 : 300;
      for (let seed = 1; seed <= N; seed++) {
        const m = monkey('easy', seed, 20);
        bails += m.s.stats.bails; flips += m.s.stats.flips; flipsDone += m.s.stats.flipsDone + (m.s.air && m.s.air.flip ? 1 : 0);
        airs += m.s.stats.airs; landed += m.s.stats.landed; tricks += m.s.stats.tricks;
      }
      ok(`EASY: ${N} runs of random buttons never bail`, bails === 0 && tricks > N, `${bails} bails, ${tricks} tricks, ${airs} airs`);
      ok('EASY: every flip they start, they finish', flips === flipsDone && flips > N, `${flipsDone} / ${flips}`);
      let nb = 0;
      for (let seed = 1; seed <= (quick ? 20 : 60); seed++) nb += monkey('normal', seed, 20).s.stats.bails;
      ok('NORMAL has real bails (so EASY is the one keeping Tommy up)', nb > 0, `${nb} bails`);
    }

    // ---- 3. no falling through ramps ----
    {
      let pen = 0, jump = 0, bad = '', n = 0;
      const N = quick ? 40 : 240;
      for (let seed = 1; seed <= N; seed++) {
        for (const level of ['easy', 'normal']) {
          const m = monkey(level, 5000 + seed, 25);
          pen = Math.max(pen, m.s.stats.maxPen); jump = Math.max(jump, m.maxJump); bad = bad || m.bad; n++;
        }
      }
      ok(`${n} random rides never sink into a ramp (deepest ${pen.toExponential(1)} m)`, pen <= 1e-6, pen);
      ok(`... never jump up through a ramp's side (biggest step up ${jump.toFixed(2)} m)`, jump <= 0.5, jump);
      ok('... and stay in the park with sane numbers', !bad, bad || 'fine');
    }
    {
      let pen = 0, jump = 0, unsettled = 0;
      const N = quick ? 400 : 3000;
      for (let seed = 1; seed <= N; seed++) {
        const d = drop(seed);
        pen = Math.max(pen, d.s.stats.maxPen); jump = Math.max(jump, d.maxJump);
        if (!d.settled) unsettled++;
      }
      ok(`${N} drops from the sky land on top of whatever is there (deepest ${pen.toExponential(1)} m)`, pen <= 1e-6 && unsettled === 0, `${unsettled} still falling`);
      ok(`... and never pass up through a side (biggest ${jump.toFixed(2)} m)`, jump <= 0.5, jump);
    }
    {
      let low = 0;
      for (const r of P.rails) for (let i = 0; i <= 40; i++) {
        const u = i / 40, x = r.a[0] + (r.b[0] - r.a[0]) * u, z = r.a[2] + (r.b[2] - r.a[2]) * u;
        if (P.railY(r, u) < P.H(x, z) - 1e-9) low++;
      }
      ok('every rail is above the ground it stands on', low === 0, `${low} points under`);
    }
    return { pass: out.every((r) => r.pass), results: out };
  }

  SK.checks = { run, runLine, monkey, drop, lineSkater };
})(typeof window !== 'undefined' ? window : globalThis);
