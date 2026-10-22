/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: window.SK_TITLE || 'TT Skate Park',
  keys: [
    ['steer · spin in the air · balance on a rail', '← → or A D'],
    ['push (and pump in the half-pipe)', '↑ or W'],
    ['slow down', '↓ or S'],
    ['jump (an ollie)', 'Space'],
    ['flip trick in the air', 'F'],
    ['other flips: hold an arrow, then', '← → ↑ ↓ + F'],
    ['grab the board in the air', 'hold G'],
    ['call your brother', 'T'],
    ['start', 'Enter'],
    ['pause', 'P or Esc'],
    ['sound on / off', 'M'],
  ],
  note: "Do tricks one after another without stopping for a combo: its points times how many tricks are in it. Mix them up, the same trick again is worth half. Taking turns, both players use the same keys.",
  touch: "◀ ▶ to steer (and spin in the air), JUMP, FLIP and GRAB on the right, PUSH on NORMAL. Tap your brother's face for help: he shows you a trick line.",
});
