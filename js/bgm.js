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

  // 画面から見えなくなったら止める
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else if (enabled && wanted) start(wanted);
  });

  window.BGM = {
    // 鳴らしたい曲を指定（おとOFFのときは覚えておくだけ）
    play: function (name) { wanted = name; if (enabled) start(name); },
    setEnabled: function (on) { enabled = on; if (on && wanted) start(wanted); else stop(); }
  };
})();
