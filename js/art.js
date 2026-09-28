// ドット絵の描画：犬スプライトの加工、背景、アニメーション
// 画面は 512x320（内部）。手描きの小物（ハート・泡など）は 256x160 の座標で描いて2倍にする。
(function () {
  'use strict';

  var W = 256, H = 160, PX = 2;          // 論理座標と、論理1pxあたりの実ピクセル
  var DOG_SCALE = 3;                      // 犬スプライト1ドット = 実3px
  // スプライトごとの大きさの補正（描かれたドットの細かさが違うもの）
  var SCALE = { wet1: 1.5, wet2: 1.5, cheer: 1.25, jump: 1.25, owner: 2, owner_pc1: 3, owner_pc2: 3 };

  var raw = {};       // スプライト名 -> Image
  var pics = {};      // 背景・イベント絵 -> Image
  var cache = {};
  var ready;

  var PICS = ['bg_room', 'bg_night', 'bg_park', 'ev_title', 'ev_salon', 'ev_towel', 'ev_poodle', 'ev_macho', 'ev_kyokai', 'ev_bankrupt', 'ev_contest', 'ev_vet'];

  function loadImg(src) {
    return new Promise(function (res) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = function () { res(null); };
      im.src = src;
    });
  }
  function load() {
    if (ready) return ready;
    var ver = (document.querySelector('script[src*="art.js"]') || {}).src || '';
    var q = ver.indexOf('?') >= 0 ? ver.slice(ver.indexOf('?')) : '';
    var jobs = Object.keys(window.SPRITES).map(function (n) {
      return loadImg(window.SPRITES[n]).then(function (im) { if (im) raw[n] = im; });
    });
    // 背景は最初の画面に要るものだけ待つ。残りは後から読み込まれる
    PICS.forEach(function (n) {
      var p = loadImg('img/' + n + '.jpg' + q).then(function (im) { if (im) pics[n] = im; });
      if (n === 'ev_title' || n === 'bg_room') jobs.push(p);
    });
    ready = Promise.all(jobs);
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

  // モコモコの段階で、手描きの差分があるポーズは差し替える
  // ふつう（少し伸びた）は a2、モコモコは a3 の手描き差分
  var MOKO_SWAP = { front1: 'm_front', blink: 'm_blink', doze: 'm_blink', side1: 'm_side', sit1: 'm_sit', sit3: 'm_sit', sit4: 'm_sit' };
  var NORMAL_SWAP = { front1: 'n_front', blink: 'n_blink', side1: 'n_side', sit1: 'n_sit', sit3: 'n_sit', sit4: 'n_sit' };
  function resolve(name, look) {
    if (!look) return { name: name, fluff: 0 };
    if (look.moko >= 2 && MOKO_SWAP[name]) return { name: MOKO_SWAP[name], fluff: look.moko - 2 };
    if (look.moko === 1 && NORMAL_SWAP[name] && look.dirt === 0) return { name: NORMAL_SWAP[name], fluff: 0 };
    if (look.dirt >= 1 && look.moko < 2 && (name === 'front1' || name === 'sit1')) return { name: 'tears', fluff: look.moko };
    return { name: name, fluff: look.moko, cream: look.moko >= 2 };
  }

  var OUT = [30, 30, 60], LIGHT = [214, 220, 234], CREAM = [238, 230, 212], BROWN = [168, 118, 86], MAT = [150, 140, 128], MAT2 = [110, 100, 92];
  var DOGGY = { owner: 0, owner_pc1: 0, owner_pc2: 0, owner_walk1: 0, owner_walk2: 0, peek: 0, follow: 0 };

  // 手描きの絵に「毛の伸び」「毛玉」「汚れ」を足す
  function dogSprite(name, look) {
    var r = resolve(name, look);
    var lk = look || { moko: 0, mats: 0, dirt: 0 };
    var isDog = !(name in DOGGY) && name.indexOf('i_') !== 0;
    var key = r.name + '|' + (isDog ? r.fluff + '|' + (r.cream ? 1 : 0) + '|' + lk.mats + '|' + lk.dirt : '');
    if (cache[key]) return cache[key];
    var im = raw[r.name];
    if (!im) return null;
    var pad = 4, w = im.width + pad * 2, h = im.height + pad * 2;
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d');
    g.drawImage(im, pad, pad);
    c.pad = pad;
    cache[key] = c;
    if (!isDog) return c;

    var d = g.getImageData(0, 0, w, h), px = d.data;
    var at = function (x, y) { return (y * w + x) * 4; };
    var inside = function (x, y) { return x >= 0 && y >= 0 && x < w && y < h && px[at(x, y) + 3] > 0; };
    var white = function (x, y) { var i = at(x, y); return px[i + 3] > 0 && px[i] > 205 && px[i + 1] > 205 && px[i + 2] > 205; };
    var dark = function (x, y) { var i = at(x, y); return px[i + 3] > 0 && px[i] + px[i + 1] + px[i + 2] < 210; };
    var set = function (x, y, col) { var i = at(x, y); px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2]; px[i + 3] = 255; };

    // 毛がのびる：上と横に不ぞろいにふくらませる（足元はそのまま）
    if (r.fluff > 0) {
      var region = new Uint8Array(w * h), orig = new Uint8Array(w * h);
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) region[y * w + x] = orig[y * w + x] = inside(x, y) ? 1 : 0;
      var limitY = pad + Math.floor(im.height * 0.7);
      for (var it = 0; it < r.fluff; it++) {
        var add = [];
        for (y = 1; y < Math.min(limitY, h - 1); y++) for (x = 1; x < w - 1; x++) {
          var p0 = y * w + x;
          if (region[p0]) continue;
          if ((region[p0 - 1] || region[p0 + 1] || region[p0 - w] || region[p0 + w]) && hash(x, y, it + r.name.length) < 0.8) add.push(p0);
        }
        add.forEach(function (p) { region[p] = 1; });
      }
      var fur = r.cream ? CREAM : [250, 250, 252];
      for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) {
        var p = y * w + x;
        if (!region[p] || orig[p]) continue;
        var edge = !region[p - 1] || !region[p + 1] || !region[p - w] || !region[p + w];
        set(x, y, edge ? OUT : (hash(x, y, 7) < 0.25 ? LIGHT : fur));
      }
      // 元の輪郭のうち、毛に埋もれた部分は明るくする
      for (y = 1; y < limitY; y++) for (x = 1; x < w - 1; x++) {
        p = y * w + x;
        if (!orig[p] || !dark(x, y)) continue;
        var wasEdge = !orig[p - 1] || !orig[p + 1] || !orig[p - w] || !orig[p + w];
        var nowEdge = !region[p - 1] || !region[p + 1] || !region[p - w] || !region[p + w];
        if (wasEdge && !nowEdge) set(x, y, hash(x, y, 3) < 0.5 ? LIGHT : fur);
      }
    }

    // 白い毛の場所（内側）
    var whites = [];
    for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) {
      if (white(x, y) && inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1)) whites.push([x, y]);
    }
    if (r.cream) whites.forEach(function (q) { if (hash(q[0], q[1], 13) < 0.7) set(q[0], q[1], CREAM); });

    // 汚れ：目の下が茶色、ひどいと全体が黄ばむ
    if (lk.dirt > 0 && r.name !== 'tears') {
      for (y = pad + 2; y < pad + im.height * 0.45; y++) for (x = 1; x < w - 1; x++) {
        if (dark(x, y) && inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1) && white(x, y + 1)) {
          for (var k = 1; k <= lk.dirt; k++) if (white(x, y + k)) set(x, y + k, BROWN);
        }
      }
    }
    if (lk.dirt >= 2) whites.forEach(function (q) { if (hash(q[0], q[1], 11) < 0.5) set(q[0], q[1], CREAM); });

    // 毛玉：くすんだかたまりを散らす
    if (lk.mats > 0 && whites.length) {
      for (var m = 0; m < lk.mats * 3; m++) {
        var q = whites[Math.floor(hash(m, whites.length, 5) * whites.length)];
        set(q[0], q[1], MAT2);
        if (inside(q[0] + 1, q[1])) set(q[0] + 1, q[1], MAT);
        if (inside(q[0], q[1] - 1)) set(q[0], q[1] - 1, MAT);
      }
    }

    g.putImageData(d, 0, 0);
    return c;
  }

  // 足元中央 (x, y)（論理座標）を基準に描く
  function drawDog(g, name, x, y, look, opt) {
    opt = opt || {};
    var s = dogSprite(name, look);
    if (!s) return;
    var sc = (opt.scale || SCALE[name] || DOG_SCALE);
    var dw = Math.round(s.width * sc * (opt.sx || 1)), dh = Math.round(s.height * sc);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = false;
    g.translate(Math.round(x * PX), Math.round(y * PX - dh + s.pad * sc));
    if (opt.flipX) g.scale(-1, 1);
    if (opt.flipY) { g.translate(0, dh); g.scale(1, -1); }
    if (opt.alpha != null) g.globalAlpha = opt.alpha;
    g.drawImage(s, -Math.round(dw / 2), 0, dw, dh);
    g.restore();
  }

  function drawPic(g, name) {
    var im = pics[name];
    if (!im) return false;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = true;
    g.drawImage(im, 0, 0, W * PX, H * PX);
    g.restore();
    return true;
  }

  // --- 小さなドット模様（論理座標） ---
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

  // --- 手描きの場面（画像がない場面用） ---
  function plain(g, top, bottom, split) { rect(g, top, 0, 0, W, split); rect(g, bottom, 0, split, W, H - split); }

  function stage(g, t) {
    rect(g, '#3b2f5c', 0, 0, W, H);
    for (var x = 0; x < W; x += 12) rect(g, '#43366a', x, 0, 6, 110);
    rect(g, '#d6465a', 0, 0, 34, 118); rect(g, '#d6465a', W - 34, 0, 34, 118);
    for (x = 4; x < 34; x += 8) { rect(g, '#b83348', x, 0, 2, 118); rect(g, '#b83348', W - x - 2, 0, 2, 118); }
    rect(g, '#b83348', 0, 0, W, 10);
    g.globalAlpha = 0.25; g.fillStyle = '#fff6c8';
    g.beginPath(); g.moveTo(118, 0); g.lineTo(138, 0); g.lineTo(186, 140); g.lineTo(70, 140); g.fill(); g.globalAlpha = 1;
    rect(g, '#8a5a3c', 0, 118, W, 42); rect(g, '#a8704b', 0, 118, W, 3);
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
  }

  function tub(g) {
    rect(g, '#2a2c4a', 84, 118, 90, 34); rect(g, '#ffffff', 86, 120, 86, 30); rect(g, '#cfe9f5', 86, 120, 86, 6);
    rect(g, '#2a2c4a', 92, 152, 6, 6); rect(g, '#2a2c4a', 160, 152, 6, 6);
  }

  // --- アニメーション ---
  var anim = { name: 'idle', t0: 0, scene: 'room', season: 'spring', look: null, opts: {}, x: 128, tx: 128, pose: 'front1', flip: false, wait: 2 };

  function setAnim(name, scene, opts) {
    anim.name = name; anim.scene = scene || anim.scene; anim.t0 = performance.now() / 1000; anim.opts = opts || {};
    if (name === 'idle') { anim.x = 128; anim.tx = 128; anim.pose = 'front1'; anim.wait = 2; }
  }

  var IDLE_POSES = ['front1', 'front1', 'sit1', 'side1', 'side1', 'doze', 'lie'];

  function drawScene(g, t, dt) {
    var at = t - anim.t0, look = anim.look, sea = anim.season;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, W * PX, H * PX);

    // 背景
    var sc = anim.scene;
    if (sc.indexOf('cg:') === 0) { if (!drawPic(g, 'ev_' + sc.slice(3))) plain(g, '#fdeff2', '#ebcfa8', 106); }
    else if (sc === 'room' || sc === 'bath') { if (!drawPic(g, 'bg_room')) plain(g, '#fdeff2', '#ebcfa8', 106); }
    else if (sc === 'night' || sc === 'desk') { if (!drawPic(g, 'bg_night')) plain(g, '#d9c7e6', '#c9a985', 106); }
    else if (sc === 'park') { if (!drawPic(g, 'bg_park')) plain(g, '#bfe6f5', '#a8db8f', 88); }
    g.setTransform(PX, 0, 0, PX, 0, 0);
    g.imageSmoothingEnabled = false;
    if (sc === 'stage') stage(g, t);
    if (sc === 'kyokai') kyokai(g);
    if (sc === 'bath') tub(g);

    var f2 = Math.floor(at * 3) % 2, f4 = Math.floor(at * 7) % 4;
    var FLOOR = 152;

    switch (anim.name) {
      case 'idle':
        // 部屋でのんびり。ときどき場所とポーズを変える
        anim.wait -= dt;
        if (Math.abs(anim.tx - anim.x) > 1) {
          var dir = anim.tx > anim.x ? 1 : -1;
          anim.x += dir * 30 * dt;
          drawDog(g, 'run' + (Math.floor(at * 8) % 4 + 1), anim.x, FLOOR, look, { flipX: dir < 0 });
        } else {
          var pose = anim.pose === 'front1' && (at % 3) < 0.25 ? 'blink' : anim.pose;
          drawDog(g, pose, anim.x, FLOOR, look, { flipX: anim.flip });
          if (anim.pose === 'doze' || anim.pose === 'lie') pattern(g, Z, anim.x + 18 + f2 * 2, FLOOR - 50 - f2 * 3, { '#': '#5d6180' }, 2);
          if (anim.wait <= 0) {
            anim.wait = 3 + Math.random() * 3;
            if (Math.random() < 0.4) { anim.tx = 70 + Math.random() * 120; anim.pose = 'front1'; }
            else { anim.pose = IDLE_POSES[Math.floor(Math.random() * IDLE_POSES.length)]; anim.flip = Math.random() < 0.5; }
          }
        }
        break;
      case 'walk':
        drawDog(g, 'walk' + (f4 + 1), 128, 156, look);
        if (sea === 'rainy') rain(g, t);
        if (sea === 'winter') snow(g, t);
        if (sea === 'summer') { g.globalAlpha = 0.15; rect(g, '#ffb347', 0, 0, W, H); g.globalAlpha = 1; }
        break;
      case 'brush':
        drawDog(g, ['brush1', 'brush2', 'brush3', 'brush2'][Math.floor(at * 6) % 4], 128, FLOOR, look);
        if (f2) spark(g, 160, 80); else spark(g, 94, 88, '#ffffff');
        break;
      case 'play':
        var bx = 128 + Math.sin(at * 3) * 60, by = 110 - Math.abs(Math.sin(at * 6)) * 30;
        ellipse(g, '#d9606f', Math.round(bx + 36), Math.round(by), 5, 5); ellipse(g, '#f2949f', Math.round(bx + 35), Math.round(by - 1), 3, 3);
        drawDog(g, 'run' + (Math.floor(at * 8) % 4 + 1), bx, FLOOR, look, { flipX: Math.cos(at * 3) < 0 });
        if (f2) heart(g, Math.round(bx) - 10, 70);
        break;
      case 'shampoo':
        drawDog(g, 'front1', 128, 146, look);
        for (var i = 0; i < 9; i++) {
          var bxx = 100 + (i * 23) % 60, byy = 80 + ((i * 17 + at * 20) % 50);
          ellipse(g, '#ffffff', bxx, Math.floor(byy), 3, 3); rect(g, '#9fd3ee', bxx - 1, Math.floor(byy) - 1, 1, 1);
        }
        break;
      case 'wet':
        drawDog(g, f2 ? 'wet1' : 'wet2', 128, 150, null);
        for (i = 0; i < 4; i++) pattern(g, DROP, 104 + i * 14, 70 + ((at * 30 + i * 9) % 40), { '#': '#9fd3ee' });
        break;
      case 'job':
        drawDog(g, f2 ? 'owner_pc1' : 'owner_pc2', 170, 156, null);
        drawDog(g, 'peek', 40, 156, look);
        if (f2) pattern(g, ['#.#.#'], 52, 70, { '#': '#ffffff' }, 2);
        break;
      case 'blitz':
        var period = 1.1, ph = (at % period) / period, goingR = Math.floor(at / period) % 2 === 0;
        var bxp = goingR ? 30 + ph * 196 : 226 - ph * 196;
        drawDog(g, 'run' + (Math.floor(at * 14) % 4 + 1), bxp, FLOOR - Math.abs(Math.sin(at * 16)) * 4, look, { flipX: !goingR });
        for (i = 0; i < 4; i++) rect(g, '#ffffff', bxp + (goingR ? -44 - i * 6 : 30 + i * 6), 112 + i * 7, 14, 2);
        for (i = 0; i < 3; i++) ellipse(g, '#e6d3b3', bxp + (goingR ? -24 - i * 9 : 24 + i * 9), FLOOR - 2 - i, 3 + i, 2);
        break;
      case 'sleep':
        drawDog(g, 'lie', 128, FLOOR, look);
        pattern(g, Z, 150 + f2 * 3, 96 - f2 * 4, { '#': '#5d6180' }, 2);
        break;
      case 'hesoten':
        drawDog(g, f2 ? 'hesoten1' : 'hesoten2', 128, FLOOR, look);
        pattern(g, Z, 162 + f2 * 3, 104 - f2 * 4, { '#': '#5d6180' }, 2);
        break;
      case 'sick':
        drawDog(g, f2 ? 'sick1' : 'sick2', 128, FLOOR, look);
        break;
      case 'heat':
        drawDog(g, 'sick5', 128, FLOOR, look);
        pattern(g, DROP, 104, 96 + f2, { '#': '#9fd3ee' });
        g.globalAlpha = 0.18; rect(g, '#ff7a3d', 0, 0, W, H); g.globalAlpha = 1;
        break;
      case 'happy':
      case 'cheer':
        drawDog(g, f2 ? 'cheer' : 'jump', 128, FLOOR - (f2 ? 0 : 6), look);
        heart(g, 90, 50 - f2 * 2); heart(g, 156, 44 + f2 * 2);
        if (anim.name === 'cheer') { spark(g, 76, 80); spark(g, 176, 76, '#f2949f'); }
        break;
      case 'side':
        drawDog(g, 'side1', 128, FLOOR - (f2 ? 2 : 0), look);
        break;
      case 'front':
        drawDog(g, (at % 3) < 0.25 ? 'blink' : 'front1', 128, FLOOR, look);
        break;
      case 'eat':
        drawDog(g, ['eat1', 'eat2', 'eat2', 'eat3'][Math.floor(at * 2) % 4], 128, FLOOR, look);
        break;
      case 'excited':
        drawDog(g, 'excited', 128, FLOOR, look);
        break;
      case 'stalker':
        drawDog(g, Math.floor(at / 1.6) % 2 ? 'follow' : 'peek', 128, 156, look);
        break;
      case 'tears':
        drawDog(g, 'tears', 128, FLOOR, null);
        break;
      case 'matting':
        drawDog(g, 'm_side', 128, FLOOR, null);
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

  // 行動ボタンのアイコン
  var ICON = { walk: 'i_leash', brush: 'i_brush', play: 'i_heart', shampoo: 'i_shower', salon: 'i_scissors', job: 'i_laptop', bigjob: 'i_coin' };
  function iconURL(id) { return window.SPRITES[ICON[id] || 'i_heart'] || ''; }

  window.Art = { W: W, H: H, load: load, lookOf: lookOf, drawScene: drawScene, setAnim: setAnim, anim: anim, iconURL: iconURL };
})();
