// ドット絵の描画：犬スプライトの加工、背景、アニメーション
(function () {
  'use strict';

  var W = 256, H = 160, SCALE = 2;
  var OUT = [24, 22, 44], WHITE = [255, 255, 255], LIGHT = [206, 214, 232], MID = [150, 162, 196], DARK = [70, 80, 130];
  var CREAM = [240, 230, 206], BROWN = [176, 124, 92];

  var raw = {};       // name -> HTMLImageElement
  var cache = {};     // 加工済みスプライト
  var ready;

  function load() {
    if (ready) return ready;
    var names = Object.keys(window.SPRITES);
    ready = Promise.all(names.map(function (n) {
      return new Promise(function (res) {
        var im = new Image();
        im.onload = function () { raw[n] = im; res(); };
        im.onerror = function () { res(); };
        im.src = window.SPRITES[n];
      });
    }));
    return ready;
  }

  function hash(a, b, c) {
    var h = (a * 374761393 + b * 668265263 + c * 2147483647) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // 状態から見た目の段階を決める
  function lookOf(state) {
    var st = state.stats;
    return {
      moko: st.shape >= 75 ? 0 : st.shape >= 50 ? 1 : st.shape >= 25 ? 2 : 3,
      mats: Math.min(6, Math.floor(st.mats / 14)),
      dirt: st.clean >= 55 ? 0 : st.clean >= 30 ? 1 : 2
    };
  }

  // 元スプライトに「毛の伸び」「毛玉」「汚れ」を足した絵を作る
  function dogSprite(name, look) {
    look = look || { moko: 0, mats: 0, dirt: 0 };
    var key = name + '|' + look.moko + '|' + look.mats + '|' + look.dirt;
    if (cache[key]) return cache[key];
    var im = raw[name];
    if (!im) return null;
    var pad = 4, w = im.width + pad * 2, h = im.height + pad * 2;
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d');
    g.drawImage(im, pad, pad);
    var d = g.getImageData(0, 0, w, h), px = d.data;
    var idx = function (x, y) { return (y * w + x) * 4; };
    var inside = function (x, y) { return x >= 0 && y >= 0 && x < w && y < h && px[idx(x, y) + 3] > 0; };
    var isCol = function (x, y, col) { var i = idx(x, y); return px[i] === col[0] && px[i + 1] === col[1] && px[i + 2] === col[2]; };
    var set = function (x, y, col) { var i = idx(x, y); px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2]; px[i + 3] = 255; };

    var orig = new Uint8Array(w * h);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) orig[y * w + x] = inside(x, y) ? 1 : 0;
    var origEdge = function (x, y) {
      return orig[y * w + x] && (!orig[y * w + x - 1] || !orig[y * w + x + 1] || !orig[(y - 1) * w + x] || !orig[(y + 1) * w + x]);
    };

    // 毛がのびる：上と横に不ぞろいにふくらませる（足元はそのまま）
    if (look.moko > 0) {
      var region = orig.slice();
      var limitY = pad + Math.floor(im.height * 0.72);
      for (var it = 0; it < look.moko; it++) {
        var add = [];
        for (y = 1; y < Math.min(limitY, h - 1); y++) for (x = 1; x < w - 1; x++) {
          if (region[y * w + x]) continue;
          if (region[y * w + x - 1] || region[y * w + x + 1] || region[(y - 1) * w + x] || region[(y + 1) * w + x]) {
            if (hash(x, y, it + name.length) < 0.8) add.push(y * w + x);
          }
        }
        add.forEach(function (p) { region[p] = 1; });
      }
      for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) {
        var p = y * w + x;
        if (!region[p]) continue;
        var edge = !region[p - 1] || !region[p + 1] || !region[p - w] || !region[p + w];
        if (edge) set(x, y, OUT);
        else if (!orig[p]) set(x, y, hash(x, y, 7) < 0.25 ? LIGHT : WHITE);
        else if (origEdge(x, y) && y < limitY) set(x, y, hash(x, y, 3) < 0.5 ? LIGHT : WHITE);
      }
    }

    // 白い毛の場所（内側）を集める
    var whites = [];
    for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) {
      if (isCol(x, y, WHITE) && inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1)) whites.push([x, y]);
    }

    // 汚れ：全体が黄ばむ＋目の下と口まわりが茶色
    if (look.dirt > 0) {
      var eyes = [];
      for (y = 1; y < h - 3; y++) for (x = 1; x < w - 1; x++) {
        if (isCol(x, y, OUT) && inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1) && y < pad + im.height * 0.45) eyes.push([x, y]);
      }
      eyes.forEach(function (e) {
        for (var k = 1; k <= look.dirt; k++) if (isCol(e[0], e[1] + k, WHITE) || isCol(e[0], e[1] + k, LIGHT)) set(e[0], e[1] + k, BROWN);
      });
      if (look.dirt >= 2) whites.forEach(function (q) { if (hash(q[0], q[1], 11) < 0.55) set(q[0], q[1], CREAM); });
    }

    // 毛玉：灰色のかたまりを散らす
    if (look.mats > 0 && whites.length) {
      for (var m = 0; m < look.mats * 2; m++) {
        var q = whites[Math.floor(hash(m, whites.length, 5) * whites.length)];
        set(q[0], q[1], DARK);
        if (inside(q[0] + 1, q[1])) set(q[0] + 1, q[1], MID);
        if (inside(q[0], q[1] - 1)) set(q[0], q[1] - 1, MID);
      }
    }

    g.putImageData(d, 0, 0);
    c.pad = pad;
    cache[key] = c;
    return c;
  }

  // 足元中央 (x, y) を基準に犬を描く
  function drawDog(g, name, x, y, look, opt) {
    opt = opt || {};
    var s = dogSprite(name, look);
    if (!s) return;
    var sc = opt.scale || SCALE, sx = opt.sx || 1;
    var dw = Math.round(s.width * sc * sx), dh = s.height * sc;
    g.save();
    g.translate(Math.round(x), Math.round(y - dh + s.pad * sc));
    if (opt.flipX) g.scale(-1, 1);
    if (opt.flipY) { g.translate(0, dh); g.scale(1, -1); }
    if (opt.alpha != null) g.globalAlpha = opt.alpha;
    g.drawImage(s, -Math.round(dw / 2), 0, dw, dh);
    g.restore();
  }

  // --- 小さなドット模様 ---
  function pattern(g, rows, x, y, cols, s) {
    s = s || 1;
    for (var r = 0; r < rows.length; r++) for (var c = 0; c < rows[r].length; c++) {
      var ch = rows[r][c];
      if (ch === '.' || ch === ' ') continue;
      g.fillStyle = cols[ch];
      g.fillRect(x + c * s, y + r * s, s, s);
    }
  }
  var HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
  var SPARK = ['..#..', '..#..', '##.##', '..#..', '..#..'];
  var NOTE = ['..##', '..#.', '..#.', '###.', '###.'];
  var DROP = ['.#.', '###', '###', '.#.'];
  var Z = ['####', '..#.', '.#..', '####'];
  function heart(g, x, y, s) { pattern(g, HEART, x, y, { '#': '#f2949f' }, s); }
  function spark(g, x, y, col) { pattern(g, SPARK, x, y, { '#': col || '#ffd86b' }); }

  function rect(g, col, x, y, w, h) { g.fillStyle = col; g.fillRect(x, y, w, h); }
  function ellipse(g, col, cx, cy, rx, ry) {
    g.fillStyle = col;
    for (var yy = -ry; yy <= ry; yy++) {
      var hw = Math.round(rx * Math.sqrt(1 - (yy * yy) / (ry * ry)));
      g.fillRect(cx - hw, cy + yy, hw * 2, 1);
    }
  }
  function cloud(g, x, y) { ellipse(g, '#ffffff', x, y, 12, 4); ellipse(g, '#ffffff', x + 8, y - 3, 8, 4); ellipse(g, '#ffffff', x - 6, y - 2, 6, 3); }

  // --- 背景 ---
  var SEASON_TREE = { spring: ['#f7b9cd', '#f29bb5'], rainy: ['#7cc49a', '#5aa97c'], summer: ['#6cc27e', '#4ea562'], autumn: ['#f0a24a', '#d97a3a'], winter: ['#e9f2f7', '#c9d9e4'] };

  function room(g, night) {
    rect(g, night ? '#d9c7e6' : '#fdeff2', 0, 0, W, 104);
    for (var x = 0; x < W; x += 16) rect(g, night ? '#cfbadf' : '#f9e1e8', x, 0, 8, 104);
    rect(g, '#e7c6cf', 0, 100, W, 6);
    rect(g, night ? '#c9a985' : '#ebcfa8', 0, 106, W, 54);
    for (var y = 112; y < H; y += 9) {
      rect(g, night ? '#b6966f' : '#d9b88c', 0, y, W, 1);
      for (x = (y % 18 === 4 ? 0 : 24); x < W; x += 48) rect(g, night ? '#b6966f' : '#d9b88c', x, y - 8, 1, 8);
    }
    // 窓
    rect(g, '#2a2c4a', 148, 14, 66, 58);
    rect(g, night ? '#2b3566' : '#bfe6f5', 151, 17, 60, 52);
    if (night) {
      pattern(g, ['.###.', '##...', '##...', '##...', '.###.'], 196, 22, { '#': '#fff3b0' }, 2);
      [[160, 26], [178, 40], [170, 58], [200, 52]].forEach(function (p) { rect(g, '#fff3b0', p[0], p[1], 1, 1); });
    } else { cloud(g, 172, 36); cloud(g, 198, 54); }
    rect(g, '#2a2c4a', 180, 17, 2, 52); rect(g, '#2a2c4a', 151, 42, 60, 2);
    rect(g, '#ffffff', 144, 70, 74, 5); rect(g, '#2a2c4a', 144, 75, 74, 1);
    // ソファ
    rect(g, '#2a2c4a', 10, 64, 76, 48);
    rect(g, '#9ec3e8', 12, 66, 72, 26);
    rect(g, '#86b0da', 12, 90, 72, 20);
    rect(g, '#b8d6f2', 18, 72, 26, 16); rect(g, '#b8d6f2', 52, 72, 26, 16);
    // 植木
    rect(g, '#2a2c4a', 229, 86, 18, 20); rect(g, '#e9a07a', 231, 88, 14, 17);
    ellipse(g, '#6cc27e', 238, 76, 11, 12); ellipse(g, '#4ea562', 234, 80, 5, 6);
    // ラグ
    ellipse(g, '#a8d3c0', 128, 138, 70, 14); ellipse(g, '#c9e7da', 128, 138, 66, 12);
    // 時計
    ellipse(g, '#2a2c4a', 112, 30, 9, 9); ellipse(g, '#ffffff', 112, 30, 7, 7);
    rect(g, '#2a2c4a', 112, 25, 1, 6); rect(g, '#2a2c4a', 112, 30, 4, 1);
  }

  function park(g, season, scroll) {
    rect(g, season === 'rainy' ? '#b9c7d8' : season === 'winter' ? '#d6e6f2' : '#bfe6f5', 0, 0, W, 90);
    rect(g, season === 'rainy' ? '#c7d3e1' : '#d4eff8', 0, 60, W, 30);
    if (season === 'summer') { ellipse(g, '#ffe27a', 30, 22, 10, 10); ellipse(g, '#fff3b0', 30, 22, 7, 7); }
    var off = Math.floor(scroll || 0);
    cloud(g, ((60 - off * 0.2) % 300 + 300) % 300 - 20, 24);
    cloud(g, ((200 - off * 0.2) % 300 + 300) % 300 - 20, 40);
    rect(g, season === 'winter' ? '#f4f8fb' : season === 'autumn' ? '#c6d98a' : '#a8db8f', 0, 88, W, 72);
    var tc = SEASON_TREE[season] || SEASON_TREE.spring;
    for (var i = 0; i < 6; i++) {
      var tx = ((i * 64 - off * 0.6) % 384 + 384) % 384 - 40;
      rect(g, '#8a5a3c', tx + 10, 70, 6, 22);
      ellipse(g, tc[1], tx + 13, 60, 18, 16);
      ellipse(g, tc[0], tx + 11, 57, 14, 12);
    }
    rect(g, season === 'winter' ? '#e2e9ef' : '#ead7b0', 0, 118, W, 30);
    rect(g, season === 'winter' ? '#cfd9e2' : '#d9c092', 0, 118, W, 2);
    for (i = 0; i < 12; i++) {
      var fx = ((i * 37 - off) % 296 + 296) % 296 - 20;
      if (season !== 'winter') pattern(g, ['.#.', '#o#', '.#.'], fx, 152 - (i % 3) * 3, { '#': season === 'autumn' ? '#f0a24a' : '#f7b9cd', o: '#ffd86b' });
    }
  }

  function salon(g) {
    rect(g, '#e8f4f4', 0, 0, W, 110);
    for (var x = 0; x < W; x += 16) rect(g, '#d6ecec', x, 0, 1, 110);
    for (var y = 0; y < 110; y += 16) rect(g, '#d6ecec', 0, y, W, 1);
    rect(g, '#f7d6dc', 0, 106, W, 54);
    for (x = 0; x < W; x += 16) for (y = 106; y < H; y += 16) if (((x + y) / 16) % 2 === 0) rect(g, '#f3c4cd', x, y, 16, 16);
    ellipse(g, '#2a2c4a', 60, 50, 26, 32); ellipse(g, '#cfe9f5', 60, 50, 23, 29); rect(g, '#ffffff', 48, 32, 3, 20);
    rect(g, '#2a2c4a', 150, 20, 80, 22); rect(g, '#f2949f', 152, 22, 76, 18);
    pattern(g, ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'], 160, 24, { '#': '#ffffff' }, 2);
    pattern(g, ['.##.', '#..#', '.##.'], 160, 34, { '#': '#ffffff' }, 1);
    rect(g, '#ffffff', 178, 28, 44, 3);
    rect(g, '#2a2c4a', 96, 120, 110, 8); rect(g, '#ffffff', 98, 121, 106, 5);
  }

  function vet(g) {
    rect(g, '#eaf6ee', 0, 0, W, 106);
    rect(g, '#d2ecdc', 0, 96, W, 10);
    rect(g, '#dde6ea', 0, 106, W, 54);
    rect(g, '#7fcfae', 110, 18, 36, 12); rect(g, '#7fcfae', 122, 6, 12, 36);
    rect(g, '#2a2c4a', 70, 116, 120, 6); rect(g, '#ffffff', 72, 117, 116, 3);
    rect(g, '#2a2c4a', 76, 122, 4, 30); rect(g, '#2a2c4a', 176, 122, 4, 30);
    rect(g, '#ffffff', 196, 24, 40, 50); rect(g, '#2a2c4a', 196, 24, 40, 2);
    for (var i = 0; i < 5; i++) rect(g, '#b9c7d8', 200, 32 + i * 8, 30, 2);
  }

  function stage(g, t) {
    rect(g, '#3b2f5c', 0, 0, W, H);
    for (var x = 0; x < W; x += 12) rect(g, '#43366a', x, 0, 6, 110);
    rect(g, '#d6465a', 0, 0, 34, 118); rect(g, '#d6465a', W - 34, 0, 34, 118);
    for (x = 4; x < 34; x += 8) { rect(g, '#b83348', x, 0, 2, 118); rect(g, '#b83348', W - x - 2, 0, 2, 118); }
    rect(g, '#b83348', 0, 0, W, 10);
    g.globalAlpha = 0.25; g.fillStyle = '#fff6c8';
    g.beginPath(); g.moveTo(118, 0); g.lineTo(138, 0); g.lineTo(186, 140); g.lineTo(70, 140); g.fill(); g.globalAlpha = 1;
    rect(g, '#8a5a3c', 0, 118, W, 42); rect(g, '#a8704b', 0, 118, W, 3);
    rect(g, '#2a2c4a', 96, 128, 64, 22); rect(g, '#ffd86b', 98, 130, 60, 18);
    pattern(g, ['.##.', '#.##', '..#.', '..#.', '.###'], 122, 132, { '#': '#b8862b' }, 2);
    var cols = ['#f2949f', '#ffd86b', '#7fcfae', '#9fd3ee', '#ffffff'];
    for (var i = 0; i < 40; i++) {
      var cx = (i * 53) % W, cy = ((i * 29 + t * 30 * (1 + (i % 3) * 0.3)) % 130);
      rect(g, cols[i % cols.length], cx, Math.floor(cy), 2, 2);
    }
  }

  function kyokai(g) {
    var bands = ['#f6b6a0', '#f0a3a0', '#d99aae', '#b98fbd', '#8e7cc3'];
    for (var i = 0; i < 5; i++) rect(g, bands[4 - i], 0, i * 20, W, 20);
    rect(g, '#9aa0b8', 0, 100, W, 60);
    rect(g, '#2a2c4a', 60, 26, 136, 78); rect(g, '#f2eff6', 62, 28, 132, 74);
    rect(g, '#2a2c4a', 70, 34, 116, 18); rect(g, '#ffffff', 72, 36, 112, 14);
    g.fillStyle = '#2a2c4a'; g.font = '10px "DotGothic16", monospace'; g.textBaseline = 'middle'; g.textAlign = 'center';
    g.fillText('ビションフリーゼ協会', 128, 43);
    for (var x = 74; x < 180; x += 24) { rect(g, '#2a2c4a', x, 60, 16, 14); rect(g, '#ffe7a8', x + 2, 62, 12, 10); }
    rect(g, '#2a2c4a', 114, 78, 28, 26); rect(g, '#8e7cc3', 116, 80, 24, 24);
    rect(g, '#7a7f99', 0, 104, W, 2);
  }

  function bath(g) {
    room(g, false);
    rect(g, '#2a2c4a', 84, 112, 90, 36); rect(g, '#ffffff', 86, 114, 86, 32); rect(g, '#cfe9f5', 86, 114, 86, 6);
    rect(g, '#2a2c4a', 92, 148, 6, 6); rect(g, '#2a2c4a', 160, 148, 6, 6);
  }

  function desk(g) {
    rect(g, '#2a2c4a', 150, 100, 84, 6); rect(g, '#c99a6b', 152, 101, 80, 4);
    rect(g, '#2a2c4a', 154, 106, 4, 40); rect(g, '#2a2c4a', 226, 106, 4, 40);
    rect(g, '#2a2c4a', 170, 76, 44, 26); rect(g, '#9fd3ee', 172, 78, 40, 20);
    for (var i = 0; i < 4; i++) rect(g, '#ffffff', 176, 82 + i * 4, 18 + (i * 7) % 14, 1);
    rect(g, '#2a2c4a', 164, 100, 56, 2);
  }

  function title(g, t) {
    park(g, 'spring', t * 8);
  }

  // --- アニメーション ---
  var anim = { name: 'idle', t0: 0, x: 128, tx: 128, face: 1, wait: 0, scene: 'room', season: 'spring', look: null, opts: {} };

  function setAnim(name, scene, opts) {
    anim.name = name; anim.scene = scene || anim.scene; anim.t0 = performance.now() / 1000; anim.opts = opts || {};
    if (name === 'idle') { anim.x = 128; anim.tx = 128; anim.wait = 1; }
  }

  function drawScene(g, t, dt) {
    var at = t - anim.t0, look = anim.look, sea = anim.season;
    g.imageSmoothingEnabled = false;
    switch (anim.scene) {
      case 'room': room(g, false); break;
      case 'night': room(g, true); break;
      case 'park': park(g, sea, at * 40); break;
      case 'salon': salon(g); break;
      case 'vet': vet(g); break;
      case 'stage': stage(g, t); break;
      case 'kyokai': kyokai(g); break;
      case 'bath': bath(g); break;
      case 'desk': room(g, true); desk(g); break;
      case 'title': title(g, t); break;
    }
    var f2 = Math.floor(at * 3) % 2, f4 = Math.floor(at * 7) % 4;

    switch (anim.name) {
      case 'idle':
        // 部屋をうろうろする
        if (anim.wait > 0) {
          anim.wait -= dt;
          var blink = (at % 3) < 0.25;
          drawDog(g, blink ? 'front2' : 'front1', anim.x, 142, look);
          if (anim.wait <= 0) anim.tx = 60 + Math.random() * 140;
        } else {
          var dir = anim.tx > anim.x ? 1 : -1;
          anim.x += dir * 28 * dt;
          drawDog(g, (dir > 0 ? 'walkR' : 'walkL') + (f4 + 1), anim.x, 142, look);
          if (Math.abs(anim.tx - anim.x) < 2) anim.wait = 1.5 + Math.random() * 2.5;
        }
        break;
      case 'walk':
        drawDog(g, 'walkR' + (f4 + 1), 110, 140, look);
        rect(g, '#d6465a', 124, 110, 1, 1);
        g.strokeStyle = '#d6465a'; g.lineWidth = 1; g.beginPath(); g.moveTo(128, 116); g.lineTo(170, 60); g.stroke();
        if (sea === 'rainy') rain(g, t);
        if (sea === 'winter') snow(g, t);
        break;
      case 'brush':
        drawDog(g, 'sit2', 128, 142, look);
        var bx = 118 + Math.sin(at * 6) * 14;
        rect(g, '#2a2c4a', bx - 1, 92, 22, 8); rect(g, '#f2949f', bx, 93, 20, 6);
        rect(g, '#2a2c4a', bx + 20, 94, 14, 4); rect(g, '#c99a6b', bx + 21, 95, 12, 2);
        for (var i = 0; i < 5; i++) rect(g, '#b9c7d8', bx + 2 + i * 4, 100, 1, 3);
        if (f2) spark(g, 160, 80); else spark(g, 94, 88, '#ffffff');
        break;
      case 'play':
        var pf = ['ball1', 'play', 'ball2'][Math.floor(at * 3) % 3];
        drawDog(g, pf, 128, 142, look);
        if (f2) heart(g, 150, 76);
        break;
      case 'shampoo':
        drawDog(g, 'front1', 128, 132, look);
        for (i = 0; i < 9; i++) {
          var bxx = 100 + (i * 23) % 60, byy = 90 + ((i * 17 + at * 20) % 40);
          ellipse(g, '#ffffff', bxx, Math.floor(byy), 3, 3); rect(g, '#9fd3ee', bxx - 1, Math.floor(byy) - 1, 1, 1);
        }
        break;
      case 'wet':
        drawDog(g, f2 ? 'front1' : 'front2', 128, 132, { moko: 0, mats: 0, dirt: 0 }, { sx: 0.62 });
        for (i = 0; i < 4; i++) pattern(g, DROP, 110 + i * 12, 96 + ((at * 30 + i * 9) % 30), { '#': '#9fd3ee' });
        break;
      case 'salon':
        drawDog(g, at > 1.8 ? 'cheer' : 'sit1', 150, 124, look);
        if (at <= 1.8) {
          var sx = 168 + Math.sin(at * 10) * 3;
          pattern(g, ['#...#', '.#.#.', '..#..', '.#.#.', '##.##', '##.##'], sx, 78, { '#': '#2a2c4a' }, 2);
        } else { spark(g, 124, 70); spark(g, 172, 80, '#f2949f'); }
        break;
      case 'job':
        drawDog(g, 'sit2', 70, 146, look);
        if (f2) pattern(g, ['#.#.#'], 64, 94, { '#': '#2a2c4a' }, 2);
        break;
      case 'blitz':
        var period = 1.1, ph = (at % period) / period, goingR = Math.floor(at / period) % 2 === 0;
        var bxp = goingR ? 30 + ph * 196 : 226 - ph * 196;
        var name = (goingR ? 'walkR' : 'walkL') + (Math.floor(at * 16) % 4 + 1);
        drawDog(g, name, bxp, 144 - Math.abs(Math.sin(at * 16)) * 4, look);
        for (i = 0; i < 4; i++) rect(g, '#ffffff', bxp + (goingR ? -40 - i * 6 : 26 + i * 6), 112 + i * 7, 14, 2);
        for (i = 0; i < 3; i++) ellipse(g, '#e6d3b3', bxp + (goingR ? -20 - i * 9 : 20 + i * 9), 142 - i, 3 + i, 2);
        break;
      case 'sleep':
      case 'hesoten':
        drawDog(g, f2 ? 'sleep1' : 'sleep2', 128, 144, look, anim.name === 'hesoten' ? { flipY: true } : null);
        pattern(g, Z, 150 + f2 * 3, 96 - f2 * 4, { '#': '#5d6180' }, 2);
        break;
      case 'sick':
        drawDog(g, 'lie1', 128, 144, look);
        rect(g, '#2a2c4a', 128, 106, 14, 8); rect(g, '#9fd3ee', 129, 107, 12, 6);
        pattern(g, DROP, 108, 104 + f2, { '#': '#9fd3ee' });
        break;
      case 'happy':
        drawDog(g, f2 ? 'happy' : 'joy', 128, 144, look);
        heart(g, 104, 80 - f2 * 2); heart(g, 146, 74 + f2 * 2);
        break;
      case 'side':
        drawDog(g, f2 ? 'side1' : 'side2', 128, 142, look);
        break;
      case 'front':
        drawDog(g, (at % 3) < 0.25 ? 'front2' : 'front1', 128, 142, look);
        break;
      case 'eat':
        drawDog(g, f2 ? 'eat1' : 'eat2', 128, 144, look);
        break;
      case 'excited':
        drawDog(g, 'excited', 128, 144, look);
        break;
      case 'cheer':
        drawDog(g, f2 ? 'cheer' : 'joy', 128, 126 - (f2 ? 4 : 0), look);
        heart(g, 94, 60); heart(g, 150, 54); spark(g, 80, 90); spark(g, 170, 86, '#f2949f');
        break;
      case 'leave':
        // 協会の建物へ入っていく
        var lx = 60 + Math.min(at, 4) * 17;
        var fade = at < 4 ? 1 : Math.max(0, 1 - (at - 4));
        drawDog(g, 'walkR' + (f4 + 1), lx, 118, look, { alpha: fade, scale: 1 });
        break;
      case 'title':
        drawDog(g, f2 ? 'cheer' : 'joy', 128, 146 - (f2 ? 4 : 0), look, { scale: 3 });
        heart(g, 82, 58 - f2 * 2, 2); spark(g, 180, 50); spark(g, 60, 90, '#ffffff');
        break;
      case 'none':
        break;
    }
  }

  function rain(g, t) {
    g.fillStyle = '#7f95b8';
    for (var i = 0; i < 40; i++) { var x = (i * 41) % W, y = ((i * 23 + t * 160) % H); g.fillRect(x, Math.floor(y), 1, 4); }
  }
  function snow(g, t) {
    g.fillStyle = '#ffffff';
    for (var i = 0; i < 30; i++) { var x = (i * 47 + Math.sin(t + i) * 6) % W, y = ((i * 31 + t * 20) % H); g.fillRect(Math.floor(x), Math.floor(y), 2, 2); }
  }

  // 16x16 のアイコン（行動ボタン用）
  var ICONS = {
    walk:   ['......####......', '.....#....#.....', '....#......#....', '....#......#....', '.....#....#.....', '......####......', '.......##.......', '.......##.......', '.......##.......', '.......##.......', '.......##.......', '.......##.......', '....########....', '...#........#...', '...#........#...', '....########....'],
    brush:  ['................', '..############..', '..#..........#..', '..#.#.#.#.#.#.#.', '..#.#.#.#.#.#.#.', '..############..', '......####......', '......#..#......', '......#..#......', '......#..#......', '......#..#......', '......#..#......', '......#..#......', '......####......', '................', '................'],
    play:   ['................', '.....######.....', '...##oooooo##...', '..#oooooooooo#..', '.#oo##oooooooo#.', '.#o#oooooooooo#.', '#oo#ooooooooooo#', '#oooooooooooooo#', '#oooooooooooooo#', '#oooooooooooooo#', '.#oooooooooooo#.', '.#oooooooooooo#.', '..#oooooooooo#..', '...##oooooo##...', '.....######.....', '................'],
    shampoo:['.....####.......', '.....#..#.......', '....######......', '...#......#.....', '...#.bbbb.#..o..', '...#.b..b.#.o.o.', '...#.bbbb.#..o..', '...#......#.....', '...#......#..o..', '...#......#.....', '...#......#.o...', '...########.....', '................', '................', '................', '................'],
    salon:  ['................', '.##.........##..', '#..#.......#..#.', '#..#.......#..#.', '.##.#.....#.##..', '.....#...#......', '......#.#.......', '.......#........', '......#.#.......', '.....#...#......', '....#.....#.....', '...#.......#....', '..#.........#...', '................', '................', '................'],
    job:    ['................', '..############..', '..#bbbbbbbbbb#..', '..#b........b#..', '..#b.####...b#..', '..#b........b#..', '..#b.######.b#..', '..#b........b#..', '..#bbbbbbbbbb#..', '..############..', '.##############.', '#..............#', '################', '................', '................', '................']
  };
  function iconURL(id) {
    var c = document.createElement('canvas'); c.width = 16; c.height = 16;
    pattern(c.getContext('2d'), ICONS[id] || ICONS[id === 'bigjob' ? 'job' : 'walk'], 0, 0, { '#': '#2a2c4a', o: '#f2949f', b: '#9fd3ee' });
    return c.toDataURL();
  }

  window.Art = { W: W, H: H, load: load, lookOf: lookOf, drawScene: drawScene, setAnim: setAnim, anim: anim, iconURL: iconURL };
})();
