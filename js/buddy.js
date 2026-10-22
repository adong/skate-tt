/* TT Skate Park: the brother who comes to help. Call him (T or his face button) any time, as often as you like.
   He pops in rolling along beside you on his own board, at his buddy size, says hi with his signature move
   (Tommy's Y with peace fingers, Teddy's boxing or his jump shot), tosses you a treat, then shows you the next trick
   line: it lights up on the ground (gold arrows, a star at each spot, an icon over each trick) and he skates it
   ahead of you, "TOMMY SAYS: GRIND THE RAIL!". When both brothers are playing (taking turns), the one waiting
   comes in for a high five first. When the line's done he waves bye (his signature again) and pops out.
   The game passes in hooks: player() (his sim and visual), toast, sfx, chooseLine(), showLine(), partner(). */
(function () {
  'use strict';
  const SK = window.SK, Kit = window.Kit, SC = SK.scene, P = SK.park, K = SK.skater;
  const TREATS = [['🍦', 'ICE CREAM'], ['💧', 'WATER'], ['🧃', 'JUICE BOX'], ['🍪', 'COOKIE'], ['🍉', 'WATERMELON'], ['🍌', 'BANANA']];
  const B = { entry: null, vis: null, sim: null, bot: null, state: 'away', t: 0, calls: 0, treatN: 0, tossed: 0, flying: null, treats: [], line: null, hooks: null, high5: false, scale: 0.6, ball: null };

  function init(hooks) { B.hooks = hooks; }
  function setEntry(entry, scale) {
    if (B.entry && entry && B.entry.id === entry.id) return;
    dismiss(true);
    B.entry = entry;
    B.scale = scale;
  }
  const sig = (which) => Kit.roster.signature(B.entry, which);

  // a free spot beside the skater: his side, or the other side, or right behind him
  function spotBeside(s) {
    const md = s.sp >= 0 ? s.th : s.th + Math.PI;
    const y = P.H(s.x, s.z);
    for (const [side, back] of [[1.4, 0.3], [-1.4, 0.3], [0, 1.6]]) {
      const x = s.x + Math.cos(md + Math.PI / 2) * side - Math.cos(md) * back, z = s.z + Math.sin(md + Math.PI / 2) * side - Math.sin(md) * back;
      if (x < P.bounds.x0 + 1 || x > P.bounds.x1 - 1 || z < P.bounds.z0 + 1 || z > P.bounds.z1 - 1) continue;
      if (Math.abs(P.H(x, z) - y) < 0.25) return { x, z, heading: md };
    }
    return { x: s.x, z: s.z, heading: md };
  }

  function call() {
    if (!B.entry) return;
    const h = B.hooks, pl = h.player();
    B.calls++;
    B.treatN++;
    if (B.state === 'away') {
      const sp = spotBeside(pl.sim);
      B.sim = K.create({ id: 'buddy', level: 'easy', seed: 90 + B.calls, spawn: sp });
      B.sim.sp = Math.max(2.5, Math.min(6.5, Math.abs(pl.sim.sp)));
      if (!B.vis) {
        B.vis = SC.makeSkater(B.entry, B.scale, B.entry.tag);
        SC.setTag(B.vis, B.entry.name, B.entry.tag || '#ffd27a');
      }
      B.vis.first = true;
      B.vis.hide = false;
      B.high5 = !!(h.partner && h.partner());
      SC.fx.poof(sp.x, P.H(sp.x, sp.z), sp.z);
      h.sfx('poof');
      h.toast(B.high5 ? 'HIGH FIVE!' : `${B.entry.name} IS HERE!`, 'buddy');
      if (B.high5) { h.sfx('highFive'); h.cheer(); }
    }
    hello();
  }
  // the high five first (when his brother is the one skating), then his signature move
  function hello() {
    B.t = 0;
    B.bot = null;
    if (B.high5) { B.state = 'high5'; B.vis.celebrate = 'high5'; B.high5 = false; return; }
    B.state = 'hello';
    B.vis.celebrate = sig('hello');
    if (B.vis.celebrate === 'jumpshot') { B.vis.jump = 0.7; ballUp(); }
  }
  function ballUp() {
    const s = SC.treatSprite('🏀');
    s.position.set(B.sim.x, B.sim.y + 1.6, B.sim.z);
    B.ball = { s, t: 0 };
  }

  function tossTreat() {
    const [emoji, name] = TREATS[(B.treatN - 1) % TREATS.length];
    const s = SC.treatSprite(emoji);
    s.position.set(B.sim.x, B.sim.y + 1.2, B.sim.z);
    B.flying = { s, t: 0, emoji, name, from: s.position.clone() };
    B.hooks.sfx('swish');
  }

  // one physics step (the game calls it with its fixed steps)
  function step() {
    if (B.state === 'away' || !B.sim) return;
    const pl = B.hooks.player().sim;
    let inp = null;
    if (B.state === 'show' && B.bot) inp = SK.bot.think(B.bot, B.sim);
    else {
      // roll along beside the skater, at his speed, toward the spot at his side
      const md = pl.sp >= 0 ? pl.th : pl.th + Math.PI;
      const bm = B.sim.sp >= 0 ? B.sim.th : B.sim.th + Math.PI;
      const tx = pl.x + Math.cos(md + Math.PI / 2) * 1.4 + Math.cos(md) * 1.2, tz = pl.z + Math.sin(md + Math.PI / 2) * 1.4 + Math.sin(md) * 1.2;
      const want = Math.hypot(tx - B.sim.x, tz - B.sim.z) > 0.8 ? Math.atan2(tz - B.sim.z, tx - B.sim.x) : md;
      inp = { steer: B.sim.mode === 'ground' ? Math.max(-1, Math.min(1, K.wrap(want - bm) * 2)) : 0 };
      if (B.sim.mode === 'ground' && pl.mode === 'ground') B.sim.sp = Math.max(1.5, Math.min(8, Math.abs(pl.sp) * 0.9 + 0.4));
    }
    K.step(B.sim, inp);
    B.sim.events.length = 0;
  }

  function update(dt) {
    const h = B.hooks;
    if (B.flying) {
      const f = B.flying, pl = h.player().sim;
      f.t += dt / 0.7;
      const u = Math.min(1, f.t);
      f.s.position.set(f.from.x + (pl.x - f.from.x) * u, f.from.y + (pl.y + 1.1 - f.from.y) * u + Math.sin(u * Math.PI) * 1.3, f.from.z + (pl.z - f.from.z) * u);
      f.s.material.rotation = u * 6;
      if (u >= 1) {
        h.sfx('treat');
        h.toast(`${f.emoji} ${f.name} FROM ${B.entry.name}!`, 'buddy');
        SC.fx.sparkle(pl.x, pl.y + 1.1, pl.z, 16);
        SC.removeObj(f.s);
        B.flying = null;
      }
    }
    if (B.ball) {
      B.ball.t += dt;
      B.ball.s.position.set(B.sim.x, B.sim.y + 1.7 + B.ball.t * 3, B.sim.z);
      if (B.ball.t > 0.8) { SC.removeObj(B.ball.s); B.ball = null; }
    }
    if (B.state === 'away') return;
    B.t += dt;
    if (B.state === 'high5') {
      if (B.t > 0.85) hello();
    } else if (B.state === 'hello') {
      if (B.t > 0.9 && B.treatN > B.tossed && !B.flying) { B.tossed = B.treatN; tossTreat(); }
      if (B.t > 1.7) {
        // his job: the next trick line
        B.state = 'show';
        B.t = 0;
        B.vis.celebrate = null;
        B.line = h.chooseLine(h.player().sim);
        h.showLine(B.line);
        h.toast(`${B.entry.name} SAYS: ${B.line.say}`, 'hint');
        B.bot = SK.bot.create({ seed: 7 + B.calls, boost: 1.6 }); // a little faster: he leads the way
        SK.bot.setLine(B.bot, B.line, 0);
      }
    } else if (B.state === 'show') {
      if ((B.bot && !B.bot.line && B.sim.mode === 'ground') || B.t > 22) goodbye();
    } else if (B.state === 'bye') {
      if (B.t > 1.3) {
        SC.fx.poof(B.sim.x, B.sim.y, B.sim.z);
        h.sfx('poof');
        B.vis.hide = true;
        B.vis.celebrate = null;
        B.state = 'away';
      }
    }
    if (B.vis && B.state !== 'away') SC.updateSkater(B.vis, B.sim, dt, {});
  }

  function goodbye() {
    if (B.state === 'away' || B.state === 'bye') return;
    B.state = 'bye';
    B.t = 0;
    B.vis.celebrate = sig('goodbye');
    if (B.vis.celebrate === 'jumpshot') { B.vis.jump = 0.7; ballUp(); }
  }

  function dismiss(drop) {
    if (B.flying) { SC.removeObj(B.flying.s); B.flying = null; }
    if (B.ball) { SC.removeObj(B.ball.s); B.ball = null; }
    if (B.vis) {
      if (drop) { SC.removeSkater(B.vis); B.vis = null; } else { B.vis.hide = true; SC.updateSkater(B.vis, B.sim || K.create(), 0, {}); }
    }
    B.state = 'away';
    B.bot = null;
    B.line = null;
  }

  const here = () => B.state !== 'away';
  const info = () => ({ state: B.state, entry: B.entry && B.entry.id, calls: B.calls, treats: B.treatN, line: B.line && B.line.id, pos: B.sim && [B.sim.x, B.sim.z] });

  SK.buddy = { init, setEntry, call, step, update, dismiss, here, info, goodbye, get sim() { return B.sim; } };
})();
