#!/usr/bin/env node
/* The headless check: node tools/check.js            (the full check, ~1 min)
                       node tools/check.js --quick    (the smaller one the page runs as game.check())
                       node tools/check.js --fail     (proves it can fail: each sabotage must be caught)
                       node tools/check.js --lines    (each trick line on EASY and NORMAL, what it lands)
   Runs js/park.js, score.js, skater.js, bot.js and checks.js, the same files the page uses, with no browser. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function load() {
  const ctx = { console, Math, Object, Array, Number, String, JSON, Infinity, NaN };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ['park', 'score', 'skater', 'bot', 'checks']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
  }
  return ctx.SK;
}

const args = process.argv.slice(2);
const quick = args.includes('--quick');

function report(SK, label) {
  const t0 = Date.now();
  const r = SK.checks.run({ quick });
  console.log(`\n${label} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  for (const x of r.results) console.log(`  ${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.detail !== undefined ? '  [' + x.detail + ']' : ''}`);
  console.log(r.pass ? 'ALL PASS' : 'SOMETHING FAILED');
  return r;
}

if (args.includes('--lines')) {
  const SK = load();
  for (const level of ['easy', 'normal']) {
    for (const line of SK.park.lines) {
      const r = SK.checks.runLine(line, level, 3);
      const tr = r.s.events.filter((e) => e.type === 'trick').map((e) => e.name).join(' ');
      console.log(`${level.padEnd(6)} ${line.id.padEnd(13)} done ${r.done ? 'yes' : 'NO '} ${r.t.toFixed(1)}s bails ${r.s.stats.bails} walls ${r.s.stats.walls} score ${String(r.s.score).padStart(6)} | ${tr}`);
    }
  }
} else if (args.includes('--fail')) {
  // each sabotage breaks one promise; the check has to notice every one
  const sabotages = {
    noassist: 'EASY loses its help (flips must finish, landings must be straight)',
    mult: 'combos forget their multiplier',
    noclamp: 'a fast fall goes through the ground',
    nowalls: 'the sides of ramps and ledges stop being solid',
  };
  let caught = 0;
  for (const [k, what] of Object.entries(sabotages)) {
    const SK = load();
    SK.sab[k] = true;
    const r = report(SK, `--fail ${k}: ${what}`);
    if (!r.pass) caught++;
  }
  console.log(`\n${caught} of ${Object.keys(sabotages).length} sabotages caught${caught === Object.keys(sabotages).length ? ': the check can fail.' : ': THE CHECK MISSED ONE.'}`);
  process.exit(caught === Object.keys(sabotages).length ? 0 : 1);
} else {
  const r = report(load(), quick ? 'quick check' : 'full check');
  process.exit(r.pass ? 0 : 1);
}
