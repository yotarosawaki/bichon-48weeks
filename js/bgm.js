// やわらかいBGM（オリジナル曲）。Web Audio で三角波・正弦波を鳴らす
(function () {
  'use strict';

  // 音名 → 周波数
  function hz(n) {
    var m = /^([A-G])(#?)(\d)$/.exec(n);
    var base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0);
    var midi = base + (Number(m[3]) + 1) * 12;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // 1マス = 8分音符。「-」はのばす、「.」は休み
  var SONGS = {
    // タイトル：ヘ長調、夢みたいにゆっくり
    title: {
      bpm: 76,
      melody: ['A4 - C5 - F5 - - -', 'E5 - D5 - C5 - - -', 'D5 - F5 - A5 - G5 -', 'F5 - - - - - - -'],
      bass: ['F2 C3', 'C3 G3', 'D3 A3', 'F2 C3'],
      pad: [['F3', 'A3', 'C4'], ['C4', 'E4', 'G4'], ['D4', 'F4', 'A4'], ['F3', 'A3', 'C4']]
    },
    // つゆ：しっとり
    rainy: {
      bpm: 72,
      melody: ['C5 - B4 - A4 - E4 -', 'F4 - A4 - C5 - - -', 'B4 - C5 - D5 - E5 -', 'A4 - - - - - - -'],
      bass: ['A2 E3', 'F2 C3', 'G2 D3', 'A2 E3'],
      pad: [['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['G3', 'B3', 'D4'], ['A3', 'C4', 'E4']]
    },
    // なつ：はずむ
    summer: {
      bpm: 108,
      melody: ['G4 B4 D5 B4 G5 - D5 -', 'E5 C5 E5 G5 E5 - - -', 'A4 C5 E5 C5 A5 - G5 -', 'F#5 - D5 - B4 - - -',
               'G4 B4 D5 G5 B5 - A5 G5', 'E5 - G5 - E5 C5 - -', 'A4 - D5 - F#5 - A5 -', 'G5 - D5 - G4 - - -'],
      bass: ['G2 D3', 'C3 G3', 'A2 E3', 'D3 A3', 'G2 D3', 'C3 G3', 'D3 A3', 'G2 D3'],
      pad: [['G3', 'B3', 'D4'], ['C4', 'E4', 'G4'], ['A3', 'C4', 'E4'], ['D4', 'F#4', 'A4'],
            ['G3', 'B3', 'D4'], ['C4', 'E4', 'G4'], ['D4', 'F#4', 'A4'], ['G3', 'B3', 'D4']]
    },
    // あき：すこしせつない
    autumn: {
      bpm: 76,
      melody: ['D5 - F5 - E5 D5 C5 -', 'A4 - - - C5 - - -', 'A#4 - D5 - F5 - E5 -', 'D5 - C5 - A4 - - -'],
      bass: ['D3 A3', 'F2 C3', 'A#2 F3', 'A2 E3'],
      pad: [['D4', 'F4', 'A4'], ['F3', 'A3', 'C4'], ['A#3', 'D4', 'F4'], ['A3', 'C#4', 'E4']]
    },
    // ふゆ：オルゴールのように
    winter: {
      bpm: 66,
      melody: ['G5 - E5 - C6 - B5 -', 'A5 - F5 - - - - -', 'G5 - E5 - D5 - C5 -', 'D5 - - - - - - -',
               'G5 - E5 - C6 - B5 -', 'A5 - F5 - A5 - C6 -', 'B5 - G5 - D5 - B4 -', 'C5 - - - - - - -'],
      bass: ['C3 G3', 'F2 C3', 'C3 G3', 'G2 D3', 'C3 G3', 'F2 C3', 'G2 D3', 'C3 G3'],
      pad: [['C4', 'E4', 'G4'], ['F3', 'A3', 'C4'], ['C4', 'E4', 'G4'], ['G3', 'B3', 'D4'],
            ['C4', 'E4', 'G4'], ['F3', 'A3', 'C4'], ['G3', 'B3', 'D4'], ['C4', 'E4', 'G4']]
    },
    // おさんぽ：るんるん
    walk: {
      bpm: 116,
      melody: ['D5 - F#5 A5 - F#5 D5 -', 'E5 - G5 B5 - G5 E5 -', 'F#5 A5 D6 - A5 F#5 D5 -', 'E5 - C#5 - A4 - - -'],
      bass: ['D3 A3', 'E3 B3', 'D3 A3', 'A2 E3'],
      pad: [['D4', 'F#4', 'A4'], ['E4', 'G4', 'B4'], ['D4', 'F#4', 'A4'], ['A3', 'C#4', 'E4']]
    },
    // ビション・ブリッツ：大あわて
    blitz: {
      bpm: 144,
      melody: ['A4 C5 E5 A5 G5 E5 C5 E5', 'F5 E5 D5 C5 B4 C5 D5 -', 'A4 C5 E5 A5 G5 E5 C5 E5', 'D5 E5 F5 E5 D5 B4 G4 -'],
      bass: ['A2 A3', 'F2 F3', 'A2 A3', 'G2 G3'],
      pad: [['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['A3', 'C4', 'E4'], ['G3', 'B3', 'D4']]
    },
    // 病気・協会の警告：ちょっと不安
    trouble: {
      bpm: 80,
      melody: ['E5 - . - D#5 - . -', 'E5 - G5 - F#5 - - -', 'C5 - . - B4 - . -', 'A4 - B4 - E4 - - -'],
      bass: ['E2 B2', 'E2 B2', 'C3 G3', 'B2 F#3'],
      pad: [['E4', 'G4', 'B4'], ['E4', 'G4', 'B4'], ['C4', 'E4', 'G4'], ['B3', 'D#4', 'F#4']]
    },
    // コンテスト：晴れ舞台
    contest: {
      bpm: 112,
      melody: ['G4 - C5 - E5 - G5 -', 'A5 G5 E5 C5 D5 - - -', 'F5 - E5 - D5 - G5 -', 'E5 - C5 - C5 - - -'],
      bass: ['C3 G3', 'F2 C3', 'G2 D3', 'C3 G3'],
      pad: [['C4', 'E4', 'G4'], ['F3', 'A3', 'C4'], ['G3', 'B3', 'D4'], ['C4', 'E4', 'G4']]
    },
    // おうち（はる）：ハ長調、ゆったり
    home: {
      bpm: 84,
      melody: [
        'E5 - G5 - E5 D5 C5 -', 'C5 - E5 - A4 - - -', 'F5 E5 D5 C5 A4 - C5 -', 'D5 - - B4 G4 - - -',
        'E5 G5 C6 - G5 - E5 -', 'A5 G5 E5 - C5 - - -', 'A4 C5 F5 - E5 D5 C5 -', 'D5 - B4 - C5 - - -'
      ],
      bass: ['C3 G3', 'A2 E3', 'F2 C3', 'G2 D3', 'C3 G3', 'A2 E3', 'F2 C3', 'G2 C3'],
      pad: [['C4', 'E4', 'G4'], ['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['G3', 'B3', 'D4'],
            ['C4', 'E4', 'G4'], ['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['G3', 'B3', 'D4']]
    },
    // ゲームオーバー：イ短調、ゆっくり
    sad: {
      bpm: 64,
      melody: ['E5 - D5 - C5 - B4 -', 'A4 - - - C5 - - -', 'D5 - C5 - B4 - G4 -', 'A4 - - - - - - -'],
      bass: ['A2 E3', 'F2 C3', 'G2 D3', 'A2 E3'],
      pad: [['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['G3', 'B3', 'D4'], ['A3', 'C4', 'E4']]
    }
  };

  SONGS.spring = SONGS.home;
  var ctx = null, master = null, timer = null, cur = null, step = 0, nextTime = 0, wanted = null, enabled = false;
  var resumeAt = {};   // 曲ごとの続きの位置（小節の頭）

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      return true;
    } catch (e) { return false; }
  }

  function note(type, f, t, dur, vol, attack) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function parse(song) {
    var mel = [];
    song.melody.forEach(function (bar) { bar.split(/\s+/).forEach(function (tok) { mel.push(tok); }); });
    return mel;
  }

  function tick() {
    if (!cur) return;
    var eighth = 60 / cur.bpm / 2;
    while (nextTime < ctx.currentTime + 0.25) {
      var i = step % cur.mel.length, bar = Math.floor(i / 8), pos = i % 8, tok = cur.mel[i];
      // メロディ：のばす長さを数える
      if (tok !== '-' && tok !== '.') {
        var len = 1;
        while (cur.mel[(i + len) % cur.mel.length] === '-' && len < 8) len++;
        note('triangle', hz(tok), nextTime, eighth * len * 0.95 + 0.15, 0.05, 0.02);
      }
      // ベース：1拍目と3拍目
      if (pos === 0 || pos === 4) {
        var b = cur.song.bass[bar].split(' ')[pos === 0 ? 0 : 1];
        note('sine', hz(b), nextTime, eighth * 3.5, 0.07, 0.01);
      }
      // 和音：小節の頭にふんわり
      if (pos === 0) cur.song.pad[bar].forEach(function (n) { note('sine', hz(n), nextTime, eighth * 7.5, 0.018, 0.25); });
      nextTime += eighth;
      step++;
    }
  }

  function start(name) {
    if (!SONGS[name] || !ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (cur && cur.name === name && timer) return;
    stop();
    cur = { name: name, song: SONGS[name], bpm: SONGS[name].bpm, mel: parse(SONGS[name]) };
    step = resumeAt[name] || 0; nextTime = ctx.currentTime + 0.3;
    timer = setInterval(tick, 60);
    tick();
  }
  function stop() {
    if (cur) resumeAt[cur.name] = Math.ceil(step / 8) * 8 % cur.mel.length;
    if (timer) clearInterval(timer);
    timer = null; cur = null;
  }

  // ファンファーレなどを鳴らすあいだ、BGMを止めておく
  var duckTimer = null;
  function duck(sec) {
    stop();
    clearTimeout(duckTimer);
    duckTimer = setTimeout(function () { duckTimer = null; if (enabled && wanted) start(wanted); }, sec * 1000);
  }

  // 画面から見えなくなったら止める
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else if (enabled && wanted && !duckTimer) start(wanted);
  });

  // ---------- 効果音 ----------
  function tone(f, t, d, type, vol, f2) {
    var o = ctx.createOscillator(), g = ctx.createGain(), now = ctx.currentTime + t;
    o.type = type || 'square'; o.frequency.setValueAtTime(f, now);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, now + d);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol || 0.05, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + d);
    o.connect(g); g.connect(master);
    o.start(now); o.stop(now + d + 0.05);
  }
  var noiseBuf = null;
  function noise(t, d, vol, freq, q) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var ch = noiseBuf.getChannelData(0);
      for (var i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    }
    var src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), now = ctx.currentTime + t;
    src.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = freq || 3000; f.Q.value = q || 1;
    g.gain.setValueAtTime(vol || 0.1, now); g.gain.exponentialRampToValueAtTime(0.0001, now + d);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(now, Math.random() * 0.5); src.stop(now + d + 0.02);
  }
  function seq(list, type, vol) { list.forEach(function (n) { tone(hz(n[1]), n[0], n[2], type, vol); }); }
  function sparkle(t) { seq([[t, 'G6', 0.15], [t + 0.07, 'C7', 0.15], [t + 0.14, 'E7', 0.25]], 'triangle', 0.035); }

  var SFX = {
    ok: function () { tone(880, 0, 0.06, 'square', 0.035); },
    pick: function () { tone(660, 0, 0.05, 'square', 0.035); tone(990, 0.05, 0.06, 'square', 0.035); },
    bad: function () { tone(220, 0, 0.15, 'square', 0.05); tone(160, 0.12, 0.22, 'square', 0.05); },
    coin: function () { tone(988, 0, 0.06, 'square', 0.04); tone(1319, 0.06, 0.18, 'square', 0.04); },
    // お金を払う：コインが出ていく
    pay: function () { tone(1319, 0, 0.05, 'square', 0.035); tone(988, 0.06, 0.05, 'square', 0.035); tone(659, 0.12, 0.14, 'square', 0.035); },
    // おさんぽ：ぽてぽて
    walk: function () { [0, 0.16, 0.32, 0.48].forEach(function (t, i) { tone(i % 2 ? 294 : 330, t, 0.08, 'triangle', 0.09); }); },
    // ブラッシング：シャッシャッ
    brush: function () { [0, 0.18, 0.36].forEach(function (t) { noise(t, 0.1, 0.12, 4000, 0.8); }); },
    // あそぶ：ボールがぽーん
    play: function () { tone(330, 0, 0.22, 'sine', 0.08, 880); tone(660, 0.28, 0.18, 'sine', 0.06, 990); },
    // シャンプー：あわあわ
    bubbles: function () { [600, 820, 700, 1000, 880, 1200].forEach(function (f, i) { tone(f, i * 0.07, 0.07, 'sine', 0.05, f * 1.5); }); },
    // サロン：チョキチョキ → キラリン
    salon: function () { [0, 0.12, 0.3, 0.42].forEach(function (t) { noise(t, 0.035, 0.18, 6000, 2); }); sparkle(0.62); },
    sparkle: function () { sparkle(0); },
    // 週のおわり：チーン
    bell: function () { tone(hz('C6'), 0, 0.8, 'triangle', 0.045); tone(hz('E6'), 0, 0.6, 'sine', 0.02); },
    // ビション・ブリッツ：ダダダッ
    blitz: function () { noise(0, 0.35, 0.08, 1200, 0.7); ['C5', 'E5', 'G5', 'C6', 'G5', 'C6', 'E6'].forEach(function (n, i) { tone(hz(n), i * 0.05, 0.05, 'square', 0.035); }); },
    // びしょ濡れ：ぽたぽた
    drip: function () { [0, 0.3, 0.55].forEach(function (t) { tone(1400, t, 0.1, 'sine', 0.06, 500); }); },
    // 「トイプードルですか？」：はてな
    question: function () { tone(523, 0, 0.1, 'square', 0.035); tone(659, 0.13, 0.22, 'square', 0.035, 880); },
    // ほのぼの
    heart: function () { seq([[0, 'E5', 0.12], [0.1, 'G5', 0.12], [0.2, 'C6', 0.3]], 'triangle', 0.05); },
    hmm: function () { seq([[0, 'G4', 0.12], [0.15, 'E4', 0.2]], 'triangle', 0.06); },
    // 協会の警告：ピンポン
    warn: function () { [0, 0.3].forEach(function (t) { tone(hz('A5'), t, 0.14, 'square', 0.04); tone(hz('F5'), t + 0.14, 0.16, 'square', 0.04); }); },
    // 病気・熱中症
    sick: function () { tone(440, 0, 0.35, 'triangle', 0.07, 330); tone(330, 0.35, 0.5, 'triangle', 0.07, 247); },
    // 高額副業の疲れ
    tired: function () { tone(392, 0, 0.7, 'square', 0.03, 147); },
    // 夏のはじまり
    summer: function () { seq([[0, 'G5', 0.1], [0.08, 'B5', 0.1], [0.16, 'D6', 0.1], [0.24, 'G6', 0.3]], 'triangle', 0.05); },
    // セーブ
    save: function () { tone(660, 0, 0.05, 'square', 0.035); tone(990, 0.05, 0.06, 'square', 0.035); sparkle(0.15); },
    // 小さなファンファーレ（ほめられた・入賞）
    fanSmall: function () {
      seq([[0, 'C5', 0.12], [0.14, 'E5', 0.12], [0.28, 'G5', 0.35], [0.7, 'E5', 0.12], [0.85, 'G5', 0.5]], 'square', 0.035);
      seq([[0.28, 'E4', 0.35], [0.85, 'C5', 0.5]], 'triangle', 0.04);
    },
    // コンテスト：ドラムロール
    drumroll: function () {
      for (var t = 0; t < 1.6; t += 0.045) noise(t, 0.05, 0.03 + t * 0.05, 900, 0.6);
      noise(1.65, 0.4, 0.2, 500, 0.5);
    },
    // 優勝ファンファーレ
    fanfare: function () {
      var lead = [[0, 'G4', 0.12], [0.14, 'C5', 0.12], [0.28, 'E5', 0.12], [0.42, 'G5', 0.42], [0.9, 'E5', 0.14], [1.08, 'G5', 0.14], [1.26, 'C6', 1.1]];
      seq(lead, 'square', 0.045);
      seq([[0.42, 'E5', 0.42], [1.26, 'G5', 1.1]], 'triangle', 0.04);
      seq([[0.42, 'C4', 0.42], [0.9, 'G3', 0.32], [1.26, 'C3', 1.2]], 'sine', 0.09);
      noise(1.26, 0.5, 0.12, 5000, 0.5);
      sparkle(1.5); sparkle(1.9);
    },
    // ゲームオーバー
    gameover: function () {
      seq([[0, 'E5', 0.32], [0.34, 'D5', 0.32], [0.68, 'C5', 0.32], [1.02, 'B4', 0.32], [1.36, 'A4', 1.0]], 'triangle', 0.06);
      seq([[0, 'A3', 0.66], [0.68, 'F3', 0.66], [1.36, 'A2', 1.0]], 'sine', 0.07);
    }
  };

  window.BGM = {
    // 鳴らしたい曲を指定（おとOFFのときは覚えておくだけ）
    play: function (name) { wanted = name; if (enabled && !duckTimer) start(name); },
    setEnabled: function (on) { enabled = on; if (on && wanted && !duckTimer) start(wanted); else if (!on) stop(); },
    // 効果音。sec を渡すと、そのあいだBGMを止める
    sfx: function (name, sec) {
      if (!SFX[name] || !ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      if (sec && enabled) duck(sec);
      try { SFX[name](); } catch (e) { /* 音が出せない環境は無視 */ }
    }
  };
})();
