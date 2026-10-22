/* 中文 for TT Skate Park: the words on the page, the toasts, the tricks, the brother's lines and the ? panel
   (Kit.lang, from kit/lang.js). The kids' names and the game's name stay in English on purpose (the big sign over
   the half-pipe only shows the name). Skate words: 滑板 skateboard, 跳跃 jump (an ollie), 技巧 tricks, 连招 combo,
   栏杆 rail, U型池 half-pipe, 跳台 kicker. */
(function () {
  const L = Kit.lang;
  L.keep(['TT Skate Park', 'TEDDY', 'TOMMY', 'FOXY', 'FROGGY', 'ZOOM', 'LUNA', 'BOLT', 'BRUNO', 'Teddy', 'Tommy', 'Foxy', 'Froggy', 'Claude Code', 'P · Esc', 'Esc', 'Enter']);
  const TRICK = {
    OLLIE: '跳跃', AIR: '腾空', 'VERT AIR': '高高腾空', KICKFLIP: '踢翻', HEELFLIP: '脚跟翻', 'POP SHOVE-IT': '转板', '360 FLIP': '360 大翻板',
    INDY: '抓板', MELON: '后手抓板', NOSEGRAB: '抓板头', TAILGRAB: '抓板尾', BOARDSLIDE: '横板滑杆',
  };
  const SAY = {
    'GRIND THE FUNBOX RAIL, THEN DROP IN THE HALF-PIPE!': '先在大平台的栏杆上滑一段，再冲进 U型池！',
    'OLLIE ONTO THE RAIL AND GRIND IT!': '跳上栏杆，一直滑过去！',
    'JUMP THE KICKER AND DO A KICKFLIP!': '冲上跳台，来个踢翻！',
    'FLY OFF THE KICKER AND GRAB THE BOARD!': '从跳台上飞出去，抓住滑板！',
    'GRIND THE LONG LEDGE!': '在长长的台子边上滑！',
    'GRIND THE BIG DIAGONAL RAIL!': '滑过那根斜斜的长栏杆！',
    'GRIND THE RAIL BY THE BIG RAMP!': '滑过大坡道旁边的栏杆！',
    'RIDE OUT OF THE HALF-PIPE AND GRIND THE LEDGE!': '从 U型池里滑出来，再在台子边上滑！',
  };
  L.add(Object.assign({}, TRICK, SAY, {
    // title screen
    'Ride the ramps, grind the rails and fly out of the half-pipe! Mix up your tricks for big combos.': '冲上坡道，在栏杆上滑，从 U型池里飞起来！换着花样做技巧，连招分数更高！',
    'How many players': '几个人玩', '1 PLAYER': '1 个人', '2 PLAYERS': '2 个人', SKATER: '滑板手', 'Previous': '上一个', 'Next': '下一个',
    'How hard': '难度', '🐣 EASY': '🐣 简单', '🔥 NORMAL': '🔥 普通', '▶ PLAY': '▶ 开始',
    '🦊 Foxy and 🐸 Froggy skate with you. Get the best score!': '🦊 Foxy 和 🐸 Froggy 跟你一起玩滑板。看谁的分数最高！',
    'Take turns: who gets the best score?': '轮流来：看谁的分数最高？',
    'steer and spin': '转弯和旋转', 'jump': '跳跃', 'flip': '翻板', 'hold': '按住', 'grab': '抓板', 'push': '蹬地加速', 'call your brother': '叫兄弟来帮忙',
    '👆 ◀ ▶ steer, JUMP, FLIP and GRAB on the right': '👆 ◀ ▶ 转弯，右边有跳跃、翻板和抓板',
    'built with': '制作工具', 'LOADING…': '加载中…',
    // HUD and buttons
    'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)', 'TAP ME!': '点我！', 'HIGH FIVE!': '击掌！', 'Call your brother (T)': '叫兄弟来帮忙 (T)',
    '▲ PUSH': '▲ 蹬地', 'GRAB': '抓板', 'FLIP': '翻板', 'JUMP': '跳跃', 'Left': '左', 'Right': '右',
    // toasts
    'TIME!': '时间到！', 'SKATE!': '出发！', 'SICK COMBO!': '超级连招！', 'AWESOME!': '太棒了！', 'NICE!': '不错！', 'OOPS!': '哎呀！',
    'LINE COMPLETE! +500': '路线完成！+500',
    // turns, pause and the end
    '▶ GO!': '▶ 出发！', '▶ RESUME': '▶ 继续', '🏠 MENU': '🏠 菜单', "IT'S A TIE!": '平手！', '↻ PLAY AGAIN': '↻ 再玩一次',
    // the ? panel (js/keys.js)
    'steer · spin in the air · balance on a rail': '转弯 · 在空中旋转 · 在栏杆上保持平衡', 'push (and pump in the half-pipe)': '蹬地加速（在 U型池里也能加速）',
    'slow down': '减速', 'jump (an ollie)': '跳跃', 'flip trick in the air': '在空中翻板', 'other flips: hold an arrow, then': '别的翻法：按住方向键，再按',
    'grab the board in the air': '在空中抓板', 'start': '开始',
    'Do tricks one after another without stopping for a combo: its points times how many tricks are in it. Mix them up, the same trick again is worth half. Taking turns, both players use the same keys.':
      '一个技巧接一个技巧不停下来，就是连招：分数乘以连招里技巧的个数。换着花样做，同一个技巧再做一次只算一半分。两个人轮流玩，用同一套按键。',
    "◀ ▶ to steer (and spin in the air), JUMP, FLIP and GRAB on the right, PUSH on NORMAL. Tap your brother's face for help: he shows you a trick line.":
      '◀ ▶ 转弯（在空中就是旋转），右边有跳跃、翻板和抓板，普通难度还有蹬地。点兄弟的头像让他来帮忙：他会给你指一条技巧路线。',
  }));

  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', 'JUICE BOX': '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };
  L.rule(/^PLAYER (\d)$/, '玩家 $1');
  L.rule(/^BEST ([\d,]+)$/, '最高分 $1');
  L.rule(/^TO BEAT: ([\d,]+)$/, '要超过：$1');
  L.rule(/^(.+)'S BEST$/, (m, who) => `${L.t(who)} 的最高分`);
  L.rule(/^(.+)'S BEST ([\d,]+)$/, (m, who, n) => `${L.t(who)} 的最高分 ${n}`);
  L.rule(/^(.+)'S RUN$/, '轮到 $1 滑啦');
  L.rule(/^(.+)'S TURN!$/, '轮到 $1 啦！');
  L.rule(/^(.+) WINS!$/, '$1 赢啦！');
  L.rule(/^(.+) IS HERE!$/, '$1 来啦！');
  L.rule(/^(.+): NEW BEST!$/, '$1：新纪录！');
  L.rule(/^Call (.+) \(T\)$/, '叫 $1 来帮忙 (T)');
  L.rule(/^([A-Z]+): ([\d,]+)$/, '$1：$2');
  L.rule(/^(\S+) SAYS: (.+)$/, (m, who, say) => `${who} 说：${SAY[say] || say}`);
  L.rule(/^(\S+) (ICE CREAM|WATER|JUICE BOX|COOKIE|WATERMELON|BANANA) FROM (.+)!$/, (m, emoji, item, who) => `${emoji} ${who} 送来的${TREAT[item]}！`);
})();
