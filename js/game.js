/* TT Skate Park: the game. Menus, the run (90 seconds in the park), turns for two players, the CPU friends,
   the brother's trick lines, the HUD, sounds, and the winner's celebration. The physics is js/skater.js, the
   pictures js/scene.js. window.game has hooks for tests: start, step, info, check. */
(function () {
  'use strict';
  const Kit = window.Kit, SK = window.SK, P = SK.park, K = SK.skater, SC = SK.scene, SFX = SK.sfx, BUD = SK.buddy;
  const RUN = 90, DT = K.DT;
  const CAST = ['teddy', 'tommy', 'zoom', 'luna', 'bolt', 'bruno'];
  const SIZE = { teddy: 0.9, tommy: 0.78, foxy: 0.85, froggy: 0.78 };
  const scaleOf = (id) => 0.8 * (SIZE[id] || 0.88);
  const BOARD = { teddy: '#4a86cf', tommy: '#3fe0b0', foxy: '#ff8a1f', froggy: '#57d16a', zoom: '#ff3d7f', luna: '#9b6bff', bolt: '#18d4ff', bruno: '#c98a4a' };
  const $ = (id) => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem('ttSkate.' + k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('ttSkate.' + k, v); } catch (e) { /* private mode */ } },
  };
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const NONE = { steer: 0, push: false, brake: false, jump: false, flip: false, grab: false, dir: '' };

  const G = {
    state: 'loading', paused: false, n: 1, slots: ['teddy', 'tommy'], levels: {}, turn: 0, runs: [],
    time: RUN, clock: 0, acc: 0, me: null, cpus: [], attract: [], podium: [], endT: 0, countT: 0,
    line: null, lineT: 0, got: 0, lastLine: null, keys: {}, edges: { jump: false, flip: false, grab: false }, pad: {},
    rollT: 0, grindT: 0, lastInput: -9, comboKey: '', comboHideT: 0, hold: false, faces: {}, tickSec: 99, overT: 0, confT: 0,
    pushing: false, autoJumpT: 0,
  };

  // ------------------------------------------------------------------ settings
  function loadSettings() {
    G.n = store.get('n', '1') === '2' ? 2 : 1;
    const sl = store.get('slots', 'teddy,tommy').split(',');
    G.slots = [CAST.includes(sl[0]) ? sl[0] : 'teddy', CAST.includes(sl[1]) ? sl[1] : 'tommy'];
    for (const id of CAST) G.levels[id] = store.get('level.' + id, 'easy') === 'normal' ? 'normal' : 'easy';
  }
  const bestOf = (id, level) => +store.get(`best.${id}.${level}`, '0') || 0;

  // ------------------------------------------------------------------ title screen
  function logo() {
    const words = (window.SK_TITLE || 'TT Skate Park').split(' ');
    const tt = (w) => w.replace(/TT/g, '<em>T</em><em>T</em>');
    const l1 = words.length > 1 ? words.slice(0, -1).join(' ') : words[0];
    const l2 = words.length > 1 ? words[words.length - 1] : '';
    $('logo').innerHTML = `<span class="l1">${tt(l1)}</span>${l2 ? `<span class="l2">${tt(l2)}</span>` : ''}`;
  }
  function buildSlots() {
    const box = $('slots');
    box.innerHTML = '';
    for (let i = 0; i < G.n; i++) {
      const id = G.slots[i], e = Kit.roster.get(id), lv = G.levels[id];
      const d = document.createElement('div');
      d.className = 'slot';
      d.dataset.id = id;
      d.innerHTML = `<div class="who">${G.n === 2 ? `PLAYER ${i + 1}` : 'SKATER'}</div>
        <div class="face"><button class="arrow" data-d="-1" aria-label="Previous">◀</button><img alt="" src="${G.faces[id] || ''}"><button class="arrow" data-d="1" aria-label="Next">▶</button></div>
        <div class="nm" data-no-lang>${e.name}</div>
        <div class="seg" role="group" aria-label="How hard"><button data-level="easy" aria-pressed="${lv === 'easy'}">🐣 EASY</button><button data-level="normal" aria-pressed="${lv === 'normal'}">🔥 NORMAL</button></div>`;
      d.querySelectorAll('.arrow').forEach((b) => b.addEventListener('click', () => {
        SFX.click();
        let k = CAST.indexOf(G.slots[i]);
        do { k = (k + +b.dataset.d + CAST.length) % CAST.length; } while (G.n === 2 && CAST[k] === G.slots[1 - i]);
        G.slots[i] = CAST[k];
        store.set('slots', G.slots.join(','));
        buildSlots();
      }));
      d.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => {
        SFX.click();
        G.levels[id] = b.dataset.level;
        store.set('level.' + id, b.dataset.level);
        buildSlots();
      }));
      box.appendChild(d);
    }
    document.querySelectorAll('#countSeg button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.n === G.n)));
    $('friendsNote').classList.toggle('hidden', G.n !== 1);
    $('turnsNote').classList.toggle('hidden', G.n !== 2);
    const ids = G.slots.slice(0, G.n);
    $('bestLine').innerHTML = ids.map((id) => `<span>${Kit.roster.get(id).name}'S BEST</span> <b>${fmt(bestOf(id, G.levels[id]))}</b>`).join(' · ');
  }

  // skaters riding around behind the menus
  function startAttract() {
    clearAttract();
    const who = [['teddy', 0.15], ['tommy', 0.3], ['foxy', 0.1], ['froggy', 0.5]];
    who.forEach(([id, skill], i) => {
      const ln = P.lines[(i * 2) % P.lines.length];
      const a = ln.steps[0], b = ln.steps[1];
      const sim = K.create({ level: id === 'tommy' ? 'easy' : 'normal', seed: 50 + i, spawn: { x: a.x, z: a.z, heading: Math.atan2(b.z - a.z, b.x - a.x) } });
      sim.sp = 5;
      const bot = SK.bot.create({ seed: 60 + i, skill, loop: true });
      SK.bot.setLine(bot, ln, 0);
      const vis = SC.makeSkater(Kit.roster.get(id), scaleOf(id), BOARD[id]);
      G.attract.push({ id, sim, bot, vis });
    });
  }
  function clearAttract() { for (const a of G.attract) SC.removeSkater(a.vis); G.attract = []; }

  function showScreen(id) {
    for (const s of ['title', 'turn', 'pause', 'over']) $(s).classList.toggle('hidden', s !== id);
  }

  function toTitle() {
    G.state = 'title';
    G.paused = false;
    endPlayStuff();
    clearPodium();
    showScreen('title');
    $('hud').classList.add('hidden');
    buildSlots();
    startAttract();
    Kit.sound.music('title');
  }

  // ------------------------------------------------------------------ a game
  function startGame(opts = {}) {
    if (opts.players) {
      G.n = opts.players.length;
      opts.players.forEach((id, i) => { G.slots[i] = id; });
    }
    if (opts.levels) Object.assign(G.levels, opts.levels);
    G.runs = [];
    G.turn = 0;
    clearAttract();
    clearPodium();
    startRun(0, opts);
  }
  const playerIds = () => G.slots.slice(0, G.n);

  function startRun(turn, opts = {}) {
    endPlayStuff();
    G.turn = turn;
    const id = playerIds()[turn], entry = Kit.roster.get(id), level = G.levels[id];
    const sim = K.create({ id, level, seed: (opts.seed || 1) + turn * 31, spawn: P.spawn });
    const vis = SC.makeSkater(entry, scaleOf(id), BOARD[id]);
    G.me = { id, entry, level, sim, vis };
    // the CPU friends skate with you in 1 player; they take it easy when you're on EASY
    if (G.n === 1) {
      const easy = level === 'easy';
      [['foxy', -15, 11, 0.12, easy ? 4.5 : 1.2], ['froggy', 15, 11, 0.55, easy ? 7 : 2.5]].forEach(([cid, x, z, skill, rest], i) => {
        const e = Kit.roster.get(cid);
        const s = K.create({ id: cid, level: 'normal', seed: 70 + i + (opts.seed || 0), spawn: { x, z, heading: -Math.PI / 2 } });
        const bot = SK.bot.create({ seed: 80 + i + (opts.seed || 0), skill, loop: true, rest });
        const v = SC.makeSkater(e, scaleOf(cid), BOARD[cid]);
        SC.setTag(v, `${e.emoji} ${e.name}`, e.tag);
        G.cpus.push({ id: cid, entry: e, sim: s, bot, vis: v });
      });
    }
    const bud = Kit.roster.get(Kit.roster.buddyFor(id));
    BUD.setEntry(bud, 0.8 * (bud.buddyScale || 0.8));
    $('buddyFace').src = G.faces[bud.id] || '';
    $('buddyName').textContent = bud.name;
    $('buddyBtn').title = `Call ${bud.name} (T)`;
    $('buddyBtn').classList.toggle('five', partner());
    $('meFace').src = G.faces[id] || '';
    $('meName').textContent = entry.name;
    $('meBest').textContent = `BEST ${fmt(bestOf(id, level))}`;
    $('pad').classList.toggle('easy', level === 'easy');
    $('who').classList.toggle('hidden', G.n !== 2);
    if (G.n === 2) $('who').textContent = G.runs.length ? `TO BEAT: ${fmt(G.runs[0].score)}` : `${entry.name}'S RUN`;
    G.time = RUN;
    G.tickSec = 99;
    G.acc = 0;
    G.countT = opts.noCount ? 0 : 3.2;
    G.state = opts.noCount ? 'play' : 'count';
    G.lastLine = null;
    G.keys = {};
    G.pad = {};
    SC.cam.snap = true;
    showScreen(null);
    $('hud').classList.remove('hidden');
    setCombo(null);
    renderScore();
    Kit.sound.music('play');
  }
  // is the brother who comes to help the other player? (2 players: then it's a high five)
  const partner = () => G.n === 2 && !!G.me && playerIds().includes(Kit.roster.buddyFor(G.me.id));

  function endPlayStuff() {
    G.auto = null;
    BUD.dismiss(true);
    clearLine();
    if (G.me) SC.removeSkater(G.me.vis);
    for (const c of G.cpus) SC.removeSkater(c.vis);
    G.me = null;
    G.cpus = [];
  }

  // ------------------------------------------------------------------ input
  const KEYMAP = { ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1, KeyA: 1, KeyD: 1, KeyW: 1, KeyS: 1, KeyG: 1, KeyK: 1 };
  function readInput() {
    const k = G.keys, t = G.pad;
    const left = k.ArrowLeft || k.KeyA || t.left, right = k.ArrowRight || k.KeyD || t.right;
    const up = k.ArrowUp || k.KeyW, down = k.ArrowDown || k.KeyS;
    const inp = {
      steer: (right ? 1 : 0) - (left ? 1 : 0), push: !!(up || t.push), brake: !!down,
      jump: G.edges.jump, flip: G.edges.flip, grab: !!(k.KeyG || k.KeyK || t.grab), grabPress: G.edges.grab,
      dir: left ? 'left' : right ? 'right' : up ? 'up' : down ? 'down' : '',
    };
    G.edges.jump = G.edges.flip = G.edges.grab = false;
    if (inp.steer || inp.jump || inp.flip || inp.grab) G.lastInput = G.clock;
    G.pushing = inp.push;
    return inp;
  }

  // EASY and the brother's line: with no steering from you, the board turns gently toward the next star,
  // and pops an ollie at a star that says jump
  function lineAssist(inp, s) {
    if (!G.line || G.me.level !== 'easy' || s.mode !== 'ground') return inp;
    const st = nextStar();
    if (!st) return inp;
    if (!inp.steer) {
      const md = s.sp >= 0 ? s.th : s.th + Math.PI;
      const err = K.wrap(Math.atan2(st.z - s.z, st.x - s.x) - md);
      inp.steer = Math.max(-0.7, Math.min(0.7, err * 1.8));
    }
    return inp;
  }

  // ------------------------------------------------------------------ the brother's line
  function chooseLine(s) {
    const md = s.sp >= 0 ? s.th : s.th + Math.PI;
    let best = null, bv = Infinity;
    for (const ln of P.lines) {
      if (ln.id === G.lastLine) continue;
      const st = ln.steps[0], dx = st.x - s.x, dz = st.z - s.z, d = Math.hypot(dx, dz);
      const ahead = (dx * Math.cos(md) + dz * Math.sin(md)) / (d || 1);
      const v = d * (1.6 - 0.6 * ahead);
      if (v < bv) { bv = v; best = ln; }
    }
    G.lastLine = best.id;
    return best;
  }
  function showLine(ln) {
    G.line = ln;
    G.lineT = 0;
    G.got = 0;
    G.gotSet = {};
    SC.showLine(ln);
  }
  function clearLine() { G.line = null; SC.clearLine(); }
  function nextStar() {
    if (!G.line) return null;
    for (let i = 1; i < G.line.steps.length; i++) if (!G.gotSet[i]) return Object.assign({ i }, G.line.steps[i]);
    return null;
  }
  function checkStars(s) {
    if (!G.line) return;
    for (let i = 1; i < G.line.steps.length; i++) {
      if (G.gotSet[i]) continue;
      const st = G.line.steps[i];
      if (Math.hypot(st.x - s.x, st.z - s.z) > 1.9) continue;
      G.gotSet[i] = true;
      G.got++;
      SC.collectStar(i);
      s.score += 100;
      SFX.star();
      if (st.jump && G.me.level === 'easy' && s.mode === 'ground' && G.clock - G.lastInput > 0.4) G.edges.jump = true;
      if (G.got === G.line.steps.length - 1) {
        s.score += 500;
        toast('LINE COMPLETE! +500', 'big');
        SFX.lineDone();
        SC.fx.confetti(s.x, s.y, s.z, 80);
        const done = G.line;
        setTimeout(() => { if (G.line === done) clearLine(); }, 1200);
      } else toast('⭐ +100', 'buddy');
    }
  }

  function callBuddy() {
    if (G.state !== 'play' && G.state !== 'count') return;
    Kit.sound.init();
    BUD.call();
    $('buddyBtn').classList.add('here');
  }

  // ------------------------------------------------------------------ the world, one fixed step
  function stepWorld() {
    const me = G.me;
    const playing = G.state === 'play';
    let inp = playing ? readInput() : NONE;
    if (playing) inp = G.auto ? SK.bot.think(G.auto, me.sim) : lineAssist(Object.assign({}, inp), me.sim);
    K.step(me.sim, inp);
    for (const c of G.cpus) { K.step(c.sim, SK.bot.think(c.bot, c.sim)); c.sim.events.length = 0; }
    BUD.step();
    for (const e of me.sim.events) onEvent(e, me.sim);
    me.sim.events.length = 0;
    checkStars(me.sim);
    if (playing) {
      G.time -= DT;
      const sec = Math.ceil(G.time);
      if (sec <= 10 && sec !== G.tickSec && sec > 0) { G.tickSec = sec; SFX.tick(); }
      if (G.time <= 0) { G.time = 0; G.state = 'end'; G.endT = 0; toast('TIME!', 'big'); SFX.horn(); }
    } else if (G.state === 'end') {
      G.endT += DT;
      if ((me.sim.mode === 'ground' || me.sim.mode === 'bail') || G.endT > 3) {
        if (me.sim.mode === 'air' || me.sim.mode === 'grind') me.sim.combo = null;
        K.finish(me.sim);
        for (const e of me.sim.events) onEvent(e, me.sim);
        me.sim.events.length = 0;
        finishRun();
      }
    }
  }

  function onEvent(e, s) {
    switch (e.type) {
      case 'ollie': SFX.pop(); break;
      case 'trick':
        if (/FLIP|SHOVE/.test(e.name)) SFX.flip();
        SFX.trick(s.combo ? s.combo.tricks.length : 1);
        break;
      case 'grind': SFX.grindStart(); break;
      case 'land':
        SFX.land(e.fall > 6);
        if (e.fall > 4.5) SC.fx.dust(s.x, s.y, s.z);
        break;
      case 'combo':
        SFX.combo(e.tricks.length);
        setCombo({ banked: e.pts, tricks: e.tricks });
        if (e.pts >= 6000) { toast('SICK COMBO!', 'big'); SC.fx.confetti(s.x, s.y, s.z, 90); } else if (e.pts >= 2500) toast('AWESOME!', 'big');
        else if (e.pts >= 1000) toast('NICE!', '');
        renderScore();
        break;
      case 'lost': setCombo({ lost: e.pts }); break;
      case 'bail': SFX.bail(); toast('OOPS!', 'oops'); SC.fx.dust(s.x, s.y, s.z); break;
      case 'bonk': SFX.bonk(); break;
    }
  }

  function finishRun() {
    const me = G.me, s = me.sim;
    G.runs.push({ id: me.id, level: me.level, score: s.score, best: s.bestCombo });
    const old = bestOf(me.id, me.level);
    me.newBest = s.score > old;
    if (me.newBest) store.set(`best.${me.id}.${me.level}`, String(s.score));
    if (G.n === 2 && G.turn === 0) {
      G.state = 'turn';
      clearToasts();
      BUD.dismiss(false);
      clearLine();
      const nx = playerIds()[1], e = Kit.roster.get(nx);
      $('turnTitle').textContent = `${e.name}'S TURN!`;
      $('turnFace').src = G.faces[nx] || '';
      $('turnSub').textContent = `${me.entry.name}: ${fmt(s.score)}`;
      showScreen('turn');
      $('hud').classList.add('hidden');
      Kit.sound.music('pause');
      return;
    }
    showResults();
  }

  // ------------------------------------------------------------------ the end
  function clearPodium() { for (const p of G.podium) SC.removeSkater(p.vis); G.podium = []; }
  function clearToasts() { toastBox().innerHTML = ''; }
  function showResults() {
    clearToasts();
    const rows = G.runs.map((r) => ({ id: r.id, entry: Kit.roster.get(r.id), score: r.score, kid: true, level: r.level }));
    if (G.n === 1) for (const c of G.cpus) rows.push({ id: c.id, entry: c.entry, score: c.sim.score, kid: false });
    rows.sort((a, b) => b.score - a.score || (a.kid ? -1 : 1));
    const top = rows[0].score, winners = rows.filter((r) => r.score === top);
    endPlayStuff();
    G.state = 'over';
    G.overT = 0;
    G.confT = 0;
    // everyone in front of the funbox: the winner in the middle doing his signature move, the others waving
    const spots = [[0, 12.3], [-1.6, 12.9], [1.6, 12.9]];
    rows.forEach((r, i) => {
      const [x, z] = spots[i] || [0, 7];
      const sim = K.create({ level: 'easy', spawn: { x, z, heading: 0 } });
      const vis = SC.makeSkater(r.entry, scaleOf(r.id), BOARD[r.id]);
      const win = r.score === top;
      let pose = win ? Kit.roster.signature(r.entry, 'hello') : 'wave';
      if (win && r.id === 'teddy' && Math.random() < 0.5) pose = 'jumpshot';
      vis.celebrate = pose;
      if (pose === 'jumpshot') vis.jump = 0.7;
      G.podium.push({ sim, vis, win, pose });
    });
    $('overTitle').textContent = winners.length > 1 ? "IT'S A TIE!" : `${rows[0].entry.name} WINS!`;
    const kids = G.runs.map((r) => {
      const best = bestOf(r.id, r.level);
      return r.score >= best && r.score > 0 ? `${Kit.roster.get(r.id).name}: NEW BEST!` : `${Kit.roster.get(r.id).name}'S BEST ${fmt(best)}`;
    });
    $('overBest').innerHTML = kids.map((k) => `<span>${k}</span>`).join(' · ');
    $('ranks').innerHTML = rows.map((r) => `<div class="rank${r.score === top ? ' win' : ''}"><img alt="" src="${G.faces[r.id] || ''}"><span data-no-lang>${r.entry.emoji ? r.entry.emoji + ' ' : ''}${r.entry.name}</span><span class="pts">${fmt(r.score)}</span></div>`).join('');
    showScreen('over');
    $('hud').classList.add('hidden');
    SFX.fanfare();
    SC.fx.confetti(0, 0, 12.3, 200);
    Kit.sound.music('over');
  }

  // ------------------------------------------------------------------ HUD
  function renderScore() {
    if (!G.me) return;
    $('score').textContent = fmt(G.me.sim.score);
    $('rivals').innerHTML = G.cpus.map((c) => `<div><span data-no-lang>${c.entry.emoji} ${c.entry.name}</span> <b>${fmt(c.sim.score)}</b></div>`).join('');
  }
  // the combo bar: the tricks so far and "points × multiplier"; a banked one flashes green, a lost one red
  function setCombo(o) {
    const box = $('combo');
    if (!o) { box.classList.add('hidden'); G.comboKey = ''; return; }
    box.classList.remove('hidden');
    const pts = $('comboPts');
    pts.classList.remove('banked', 'lost');
    if (o.banked !== undefined) {
      pts.textContent = `+${fmt(o.banked)}`;
      pts.classList.add('banked');
      G.comboHideT = 1.6;
    } else if (o.lost !== undefined) {
      pts.textContent = `${fmt(o.lost)}`;
      pts.classList.add('lost');
      G.comboHideT = 1.2;
    }
  }
  function updateComboBar(dt) {
    const s = G.me && G.me.sim;
    if (!s) return;
    const c = s.combo;
    if (c && c.tricks.length) {
      const key = c.tricks.length + ':' + c.sum;
      if (key !== G.comboKey) {
        const box = $('comboTricks');
        const shown = box.children.length;
        if (!G.comboKey || shown > c.tricks.length) box.innerHTML = '';
        for (let i = box.children.length; i < c.tricks.length; i++) {
          const sp = document.createElement('span');
          sp.textContent = c.tricks[i].name;
          sp.className = 'new';
          box.appendChild(sp);
        }
        while (box.children.length > 6) box.removeChild(box.firstChild);
        $('comboPts').classList.remove('banked', 'lost');
        $('comboPts').textContent = `${fmt(c.sum)} × ${SK.score.mult(c)}`;
        $('combo').classList.remove('hidden');
        G.comboKey = key;
        G.comboHideT = 0;
      }
    } else if (G.comboHideT > 0) {
      G.comboHideT -= dt;
      if (G.comboHideT <= 0) { $('combo').classList.add('hidden'); $('comboTricks').innerHTML = ''; G.comboKey = ''; }
    } else if (G.comboKey) {
      G.comboKey = '';
    }
    // the balance meter on a rail (NORMAL)
    const bal = s.mode === 'grind' && !s.L.safe;
    $('balance').classList.toggle('hidden', !bal);
    if (bal) $('balanceDot').style.left = `${50 + Math.max(-1, Math.min(1, s.balance)) * 48}%`;
  }

  let lastShown = '';
  function renderHud(dt) {
    if (!G.me) return;
    const t = Math.max(0, Math.ceil(G.time));
    const txt = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    if (txt !== lastShown) { $('timer').textContent = txt; lastShown = txt; }
    $('timer').classList.toggle('low', t <= 10 && G.state === 'play');
    renderScore();
    updateComboBar(dt);
    $('buddyBtn').classList.toggle('here', BUD.here());
    // the JUMP button glows at a jump star on the brother's line
    const st = nextStar();
    $('bJump').classList.toggle('glow', !!(st && st.jump && Math.hypot(st.x - G.me.sim.x, st.z - G.me.sim.z) < 6));
  }

  const toastBox = () => $('toasts');
  function toast(text, cls) {
    const d = document.createElement('div');
    d.className = 'toast ' + (cls || '');
    d.textContent = text;
    const box = toastBox();
    box.appendChild(d);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(() => d.remove(), cls === 'hint' ? 3700 : 2000);
  }

  // ------------------------------------------------------------------ the frame
  function tick(dt) {
    G.clock += dt;
    if (G.paused) return;
    if (G.state === 'count') {
      const before = Math.ceil(G.countT - 0.2);
      G.countT -= dt;
      const after = Math.ceil(G.countT - 0.2);
      if (after !== before) {
        if (after >= 1) { toast(String(after), 'count'); SFX.beep(false); } else { toast('SKATE!', 'count'); SFX.beep(true); }
      }
      if (G.countT <= 0) G.state = 'play';
    }
    if (G.state === 'play' || G.state === 'end') {
      G.acc += dt;
      let n = 0;
      while (G.acc >= DT && n < 30) { G.acc -= DT; n++; stepWorld(); if (G.state !== 'play' && G.state !== 'end') break; }
      if (G.acc > DT * 4) G.acc = 0;
    } else if (G.state === 'title' || G.state === 'count') {
      G.acc += dt;
      let n = 0;
      while (G.acc >= DT && n < 30) {
        G.acc -= DT; n++;
        for (const a of G.attract) { K.step(a.sim, SK.bot.think(a.bot, a.sim)); a.sim.events.length = 0; }
        if (G.state === 'count') for (const c of G.cpus) { /* everyone waits for GO */ }
      }
      if (G.acc > DT * 4) G.acc = 0;
    }
    if (!G.noDraw) draw(dt);
  }

  function draw(dt) {
    SC.update(dt);
    if (G.state === 'title') {
      for (const a of G.attract) SC.updateSkater(a.vis, a.sim, dt, {});
      SC.camTitle(G.clock);
    } else if (G.me && (G.state === 'play' || G.state === 'count' || G.state === 'end' || G.state === 'turn')) {
      SC.updateSkater(G.me.vis, G.me.sim, dt, { push: G.pushing && G.state === 'play', dt });
      for (const c of G.cpus) SC.updateSkater(c.vis, c.sim, dt, { push: false, dt });
      BUD.update(dt);
      SC.camFollow(G.me.sim, dt);
      if (G.line) { G.lineT += dt; if (G.lineT > 32) clearLine(); }
      // wheels on the concrete, and the rail
      if (G.state === 'play' || G.state === 'end') {
        const s = G.me.sim;
        G.rollT -= dt;
        if (G.rollT <= 0) { G.rollT = 0.1; if (s.mode === 'ground' && Math.abs(s.sp) > 0.6) SFX.roll(Math.abs(s.sp)); }
        G.grindT -= dt;
        if (G.grindT <= 0) { G.grindT = 0.07; if (s.mode === 'grind') SFX.grind(); }
      }
      renderHud(dt);
    } else if (G.state === 'over') {
      G.overT += dt;
      for (const p of G.podium) SC.updateSkater(p.vis, p.sim, dt, {});
      const w = G.podium.find((p) => p.win) || G.podium[0];
      if (w) {
        SC.camAt(0, w.sim.y, w.sim.z, Math.PI / 2, tallView() ? 5.8 : 5.4, 1.4);
        G.confT -= dt;
        if (G.confT <= 0) { G.confT = 1.4; SC.fx.confetti(w.sim.x, w.sim.y, w.sim.z, 60); }
        if (w.pose === 'jumpshot' && w.vis.jump <= 0 && G.overT % 2.4 < dt) {
          w.vis.jump = 0.7;
          const b = SC.treatSprite('🏀');
          b.position.set(w.sim.x, w.sim.y + 1.8, w.sim.z);
          setTimeout(() => SC.removeObj(b), 700);
        }
      }
    }
    SC.render();
  }
  const tallView = () => innerWidth / innerHeight < 0.8;
  // a test's fast-forward: everything but the picture (the skaters' poses, the camera, the HUD still move along)
  function drawQuiet(dt) { const r = SC.render; SC.render = () => {}; try { draw(dt); } finally { SC.render = r; } }

  let last = 0;
  function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, Math.max(0, (t - (last || t)) / 1000));
    last = t;
    if (!G.hold) tick(dt);
  }

  // ------------------------------------------------------------------ controls
  function pause(on) {
    if (G.state !== 'play' && G.state !== 'count' && G.state !== 'end') return;
    G.paused = on === undefined ? !G.paused : on;
    showScreen(G.paused ? 'pause' : null);
    Kit.sound.music(G.paused ? 'pause' : 'play');
    G.keys = {};
    G.pad = {};
  }
  function toggleMute() {
    Kit.sound.init();
    Kit.sound.toggleMute();
    paintMute();
  }
  function paintMute() { $('muteBtn').textContent = Kit.sound.isMuted() ? '🔇' : '🔊'; }

  function bindKeys() {
    addEventListener('keydown', (e) => {
      if (e.repeat && !KEYMAP[e.code]) return;
      Kit.sound.init();
      const c = e.code;
      if (c === 'KeyM') { toggleMute(); return; }
      if (c === 'KeyP' || c === 'Escape') { pause(); return; }
      if (G.state === 'title' && c === 'Enter') { $('playBtn').click(); return; }
      if (G.state === 'turn' && (c === 'Enter' || c === 'Space')) { $('turnBtn').click(); return; }
      if (G.state === 'over' && c === 'Enter') { $('againBtn').click(); return; }
      if (G.paused) return;
      if (G.state !== 'play' && G.state !== 'count' && G.state !== 'end') return;
      if (c === 'KeyT') { callBuddy(); e.preventDefault(); return; }
      if (G.state !== 'play') return;
      if (c === 'Space' && !e.repeat) G.edges.jump = true;
      if ((c === 'KeyF' || c === 'KeyJ') && !e.repeat) G.edges.flip = true;
      if ((c === 'KeyG' || c === 'KeyK') && !e.repeat) G.edges.grab = true;
      if (KEYMAP[c]) G.keys[c] = true;
      if (c === 'Space' || c.startsWith('Arrow')) e.preventDefault();
    });
    addEventListener('keyup', (e) => { delete G.keys[e.code]; });
    addEventListener('blur', () => { G.keys = {}; G.pad = {}; });
    document.addEventListener('visibilitychange', () => { if (document.hidden && (G.state === 'play' || G.state === 'count')) pause(true); });
  }
  function bindPad() {
    document.querySelectorAll('#pad .pb').forEach((b) => {
      const k = b.dataset.k;
      const down = (e) => {
        e.preventDefault();
        Kit.sound.init();
        try { b.setPointerCapture(e.pointerId); } catch (er) { /* fine */ }
        b.classList.add('on');
        if (G.state !== 'play') return;
        if (k === 'jump') G.edges.jump = true;
        else if (k === 'flip') G.edges.flip = true;
        else { G.pad[k] = true; if (k === 'grab') G.edges.grab = true; }
      };
      const up = () => { b.classList.remove('on'); if (k !== 'jump' && k !== 'flip') G.pad[k] = false; };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('lostpointercapture', up);
    });
  }
  function bindButtons() {
    document.querySelectorAll('#countSeg button').forEach((b) => b.addEventListener('click', () => {
      SFX.click();
      G.n = +b.dataset.n;
      store.set('n', String(G.n));
      if (G.n === 2 && G.slots[0] === G.slots[1]) G.slots[1] = G.slots[0] === 'tommy' ? 'teddy' : 'tommy';
      buildSlots();
    }));
    $('playBtn').addEventListener('click', () => { Kit.sound.init(); SFX.click(); startGame(); });
    $('turnBtn').addEventListener('click', () => { Kit.sound.init(); SFX.click(); startRun(1); });
    $('pauseBtn').addEventListener('click', () => pause());
    $('muteBtn').addEventListener('click', toggleMute);
    $('resumeBtn').addEventListener('click', () => pause(false));
    $('quitBtn').addEventListener('click', () => { G.paused = false; toTitle(); });
    $('againBtn').addEventListener('click', () => { Kit.sound.init(); SFX.click(); startGame(); });
    $('menuBtn').addEventListener('click', () => { SFX.click(); toTitle(); });
    $('buddyBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); callBuddy(); });
    Kit.sound.onMute(paintMute);
  }

  // ------------------------------------------------------------------ start up
  function boot() {
    loadSettings();
    logo();
    SC.init($('game'));
    const fitNow = () => SC.fit(innerWidth, innerHeight);
    fitNow();
    addEventListener('resize', fitNow);
    G.faces = Kit.portraits(['teddy', 'tommy', 'zoom', 'luna', 'bolt', 'bruno', 'foxy', 'froggy'].map((id) => Kit.roster.get(id)), { size: 152 });
    BUD.init({
      player: () => G.me,
      toast,
      sfx: (n) => SFX[n] && SFX[n](),
      chooseLine,
      showLine,
      partner,
      cheer: () => { if (G.me) G.me.vis.cheer = 0.9; },
    });
    bindKeys();
    bindPad();
    bindButtons();
    paintMute();
    $('loading').remove();
    toTitle();
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------------ test hooks
  window.game = {
    // start a game now: opts { players: ['teddy'] or ['teddy', 'tommy'], levels: { teddy: 'easy' }, seed, noCount }
    start(opts = {}) { startGame(Object.assign({ noCount: true }, opts)); return this.info(); },
    // run the game for this many seconds of game time, in frames of 1/fps, drawing once at the end
    step(seconds = 1, fps = 60) {
      const n = Math.round(seconds * fps);
      G.noDraw = true;
      try { for (let i = 0; i < n - 1; i++) { tick(1 / fps); drawQuiet(1 / fps); } } finally { G.noDraw = false; }
      tick(1 / fps);
      return this.info();
    },
    hold(on = true) { G.hold = on; },
    // tests: the autopilot skates one of the trick lines for you (from where you are, or from its start)
    auto(lineId, fromStart) {
      const ln = P.lines.find((l) => l.id === lineId);
      if (!ln) { G.auto = null; return null; }
      if (fromStart) {
        const a = ln.steps[0], b = ln.steps[1];
        K.place(G.me.sim, a.x, a.z, Math.atan2(b.z - a.z, b.x - a.x), b.v || 6.5);
        G.me.vis.first = true;
        SC.cam.snap = true;
      }
      G.auto = SK.bot.create({ seed: 5 });
      SK.bot.setLine(G.auto, ln, 0);
      return ln.id;
    },
    press(code, ms) {
      if (code === 'Space') G.edges.jump = true;
      else if (code === 'KeyF') G.edges.flip = true;
      else if (code === 'KeyT') callBuddy();
      else { G.keys[code] = true; if (ms) setTimeout(() => delete G.keys[code], ms); }
    },
    release(code) { delete G.keys[code]; },
    keys: G.keys,
    callBuddy,
    endRun() { if (G.state === 'play') G.time = 0.001; },
    toTitle,
    pause,
    // the rules, headless: tricks land reliably on EASY, scoring, no falling through ramps
    check(quick = true) { const r = SK.checks.run({ quick }); return { pass: r.pass, failed: r.results.filter((x) => !x.pass).map((x) => x.name), n: r.results.length }; },
    // the same check with each rule broken on purpose: every one must fail (proves the check can fail)
    checkFail() {
      const out = {};
      for (const k of ['noassist', 'mult', 'noclamp', 'nowalls']) {
        SK.sab[k] = true;
        try { out[k] = SK.checks.run({ quick: true }).pass ? 'MISSED' : 'caught'; } finally { SK.sab[k] = false; }
      }
      return out;
    },
    info() {
      const me = G.me && G.me.sim;
      return {
        state: G.state, paused: G.paused, time: +G.time.toFixed(2), n: G.n, turn: G.turn,
        me: me && { id: G.me.id, level: G.me.level, mode: me.mode, x: +me.x.toFixed(2), y: +me.y.toFixed(2), z: +me.z.toFixed(2), sp: +me.sp.toFixed(2), score: me.score, combo: me.combo && me.combo.tricks.map((t) => t.name), stats: me.stats },
        cpus: G.cpus.map((c) => ({ id: c.id, score: c.sim.score, mode: c.sim.mode })),
        buddy: BUD.info(), line: G.line && G.line.id, stars: G.got, runs: G.runs, title: document.title,
      };
    },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
