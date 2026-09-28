// 画面の流れ：タイトル → 名前 → 48週 → コンテスト／ゲームオーバー
(function () {
  'use strict';
  var L = window.Logic, A = window.Art;
  var $ = function (id) { return document.getElementById(id); };
  var cv = $('scene'), g = cv.getContext('2d');

  var SAVE_KEY = 'bichon48.save', RANK_KEY = 'bichon48.rank', SOUND_KEY = 'bichon48.sound';
  var S = null;        // ゲームの状態
  var plan = [];       // 今週の予定
  var busy = false;    // 週を進めている最中
  var prevStats = null;

  var STAT_DEF = [
    { k: 'shape',  label: '毛のカタチ', good: 'high', hint: 'サロンで元通り' },
    { k: 'mats',   label: '毛玉',       good: 'low',  hint: 'ブラッシングで減る' },
    { k: 'clean',  label: '清潔',       good: 'high', hint: 'シャンプーで上がる' },
    { k: 'health', label: '健康',       good: 'high', hint: 'おさんぽで上がる' },
    { k: 'stress', label: 'ストレス',   good: 'low',  hint: 'たまるとブリッツ' },
    { k: 'bond',   label: 'なかよし',   good: 'high', hint: 'コンテストに影響' }
  ];

  // ---------- ちいさな道具 ----------
  function store(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    } catch (e) { return null; }
    return null;
  }
  function yen(n) { return (n < 0 ? '-' : '') + Math.abs(n).toLocaleString() + '円'; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function cleanName(s, max) { return String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max); }
  var toastTimer;
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 2200);
  }
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- おと ----------
  var soundOn = store(SOUND_KEY) === '1', actx = null;
  function beep(notes) {
    if (!soundOn) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var t = actx.currentTime;
      notes.forEach(function (n) {
        var o = actx.createOscillator(), gn = actx.createGain();
        o.type = 'square'; o.frequency.value = n[0];
        gn.gain.setValueAtTime(0.05, t + n[1]); gn.gain.exponentialRampToValueAtTime(0.001, t + n[1] + n[2]);
        o.connect(gn); gn.connect(actx.destination); o.start(t + n[1]); o.stop(t + n[1] + n[2] + 0.02);
      });
    } catch (e) { /* 音が出せない環境は無視 */ }
  }
  var SFX = {
    ok: [[880, 0, .06]], pick: [[660, 0, .05], [990, .05, .06]], bad: [[220, 0, .15], [160, .12, .2]],
    coin: [[988, 0, .06], [1319, .06, .12]], fan: [[523, 0, .12], [659, .12, .12], [784, .24, .12], [1047, .36, .3]]
  };
  function sfx(n) { beep(SFX[n] || SFX.ok); }
  function renderSoundBtn() { $('btnSound').textContent = 'おと：' + (soundOn ? 'ON' : 'OFF'); }
  $('btnSound').addEventListener('click', function () { soundOn = !soundOn; store(SOUND_KEY, soundOn ? '1' : '0'); renderSoundBtn(); sfx('ok'); BGM.setEnabled(soundOn); });
  renderSoundBtn();
  // ブラウザは画面に触れるまで音を出せないので、最初の操作でBGMを始める
  document.addEventListener('pointerdown', function first() { document.removeEventListener('pointerdown', first); BGM.setEnabled(soundOn); });

  // ---------- 描画ループ ----------
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.1, (now - last) / 1000); last = now;
    A.anim.look = S ? A.lookOf(S) : null;
    A.anim.season = S ? L.season(Math.min(S.week, L.TOTAL_WEEKS)) : 'spring';
    A.drawScene(g, now / 1000, dt);
    requestAnimationFrame(frame);
  }

  // ---------- 会話ウィンドウ ----------
  var advance = null, typeTimer = null;
  function openDialog(title, text) {
    var d = $('dialog');
    clearInterval(typeTimer);
    $('dlgTitle').hidden = !title; $('dlgTitle').textContent = title || '';
    $('dlgChoices').innerHTML = '';
    d.hidden = false;
    var p = $('dlgText'), i = 0, done = false, timer = null;
    p.textContent = '';
    function finish() { clearInterval(timer); p.textContent = text; done = true; }
    if (reduceMotion) finish();
    else timer = typeTimer = setInterval(function () { i += 2; p.textContent = text.slice(0, i); if (i >= text.length) finish(); }, 30);
    return { isDone: function () { return done; }, finish: finish };
  }
  function say(text, title) {
    return new Promise(function (res) {
      var tw = openDialog(title, text);
      $('dlgNext').hidden = false;
      advance = function () {
        if (!tw.isDone()) { tw.finish(); return; }
        advance = null; $('dialog').hidden = true; sfx('ok'); res();
      };
    });
  }
  function choose(title, text, labels) {
    return new Promise(function (res) {
      var tw = openDialog(title, text);
      $('dlgNext').hidden = true;
      advance = function () { if (!tw.isDone()) tw.finish(); };
      var box = $('dlgChoices'), picked = -1, btns = [];
      // タップミス防止：えらぶ → 「これにする」で決定。決定までは何度でも選びなおせる
      var ok = document.createElement('button');
      ok.type = 'button'; ok.className = 'choice confirm'; ok.id = 'choiceOk'; ok.hidden = true;
      ok.addEventListener('click', function (e) {
        e.stopPropagation(); if (picked < 0) return;
        advance = null; $('dialog').hidden = true; sfx('ok'); res(picked);
      });
      labels.forEach(function (lb, i) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'choice'; b.id = 'choice' + i; b.textContent = '▶ ' + lb;
        b.setAttribute('aria-pressed', 'false');
        b.addEventListener('click', function (e) {
          e.stopPropagation(); picked = i; sfx('pick');
          btns.forEach(function (x, k) { x.setAttribute('aria-pressed', String(k === i)); });
          ok.hidden = false; ok.textContent = 'これにする：' + lb;
          ok.focus();
        });
        btns.push(b); box.appendChild(b);
      });
      box.appendChild(ok);
      setTimeout(function () { var f = box.querySelector('button'); if (f) f.focus(); }, 50);
    });
  }
  $('dialog').addEventListener('click', function () { if (advance) advance(); });
  document.addEventListener('keydown', function (e) {
    if (!advance || $('dialog').hidden) return;
    if ((e.key === 'Enter' || e.key === ' ') && !$('dlgChoices').children.length) { e.preventDefault(); advance(); }
  });

  // ---------- 表示 ----------
  function renderHud() {
    var hud = $('hud'); hud.hidden = !S;
    if (!S) return;
    var wk = Math.min(S.week, L.TOTAL_WEEKS), sea = L.season(wk);
    $('hudWeek').textContent = '第' + wk + '週 / ' + L.TOTAL_WEEKS;
    var se = $('hudSeason'); se.className = 'season ' + sea; se.textContent = L.SEASON_LABEL[sea];
    var w = '協会の警告 ';
    for (var i = 0; i < L.MAX_WARN; i++) w += '<i class="' + (i < S.warnings ? 'on' : '') + '"></i>';
    $('hudWarns').innerHTML = w;
    var m = $('hudMoney');
    m.innerHTML = '<span class="coin"></span>' + esc(yen(S.money));
    m.className = 'money' + (S.money < 15000 ? ' low' : '');
  }

  function barClass(def, v) {
    if (def.good === 'high') return v < 30 ? 'bad' : v < 55 ? 'warn' : '';
    return v > 70 ? 'bad' : v > 45 ? 'warn' : '';
  }
  function renderStats() {
    if (!S) return;
    var c = L.cute(S);
    $('cuteNum').textContent = c;
    $('dogNameLbl').textContent = S.dogName + ' のかわいさ';
    var tag = $('cuteTag');
    tag.textContent = L.cuteLabel(c) + (c < L.WARN_CUTE ? '（協会に目をつけられる）' : '');
    tag.className = 'tag ' + (c >= 80 ? 'good' : c >= 65 ? 'ok' : c >= L.WARN_CUTE ? 'warn' : 'bad');
    var box = $('stats');
    if (!box.children.length) {
      STAT_DEF.forEach(function (d) {
        var row = document.createElement('div');
        row.className = 'stat'; row.id = 'st_' + d.k;
        row.innerHTML = '<span>' + d.label + '<br><span class="hint">' + d.hint + '</span></span><div class="bar"><span></span></div><span class="v"></span>';
        box.appendChild(row);
      });
    }
    STAT_DEF.forEach(function (d) {
      var v = S.stats[d.k], row = $('st_' + d.k);
      row.querySelector('.bar').className = 'bar ' + barClass(d, v);
      row.querySelector('.bar > span').style.width = v + '%';
      row.querySelector('.v').textContent = v;
      if (prevStats && prevStats[d.k] !== v) {
        var better = (v > prevStats[d.k]) === (d.good === 'high');
        row.classList.remove('flash-up', 'flash-down'); void row.offsetWidth;
        row.classList.add(better ? 'flash-up' : 'flash-down');
        setTimeout(function () { row.classList.remove('flash-up', 'flash-down'); }, 1600);
      }
    });
    prevStats = Object.assign({}, S.stats);
  }

  var ICON_URL = {};
  function renderPlan() {
    if (!S) return;
    var n = L.slotsFor(S), box = $('plan');
    box.innerHTML = '';
    for (var i = 0; i < L.SLOTS; i++) {
      var sl = document.createElement(i < plan.length ? 'button' : 'div');
      if (i >= n) { sl.className = 'slot locked'; sl.textContent = '看病'; }
      else if (i < plan.length) {
        sl.type = 'button'; sl.className = 'slot filled'; sl.id = 'slot' + i;
        sl.textContent = actionLabel(plan[i]);
        sl.setAttribute('aria-label', actionLabel(plan[i]) + ' を取り消す');
        sl.disabled = busy;
        (function (k) { sl.addEventListener('click', function () { plan.splice(k, 1); sfx('ok'); renderPlan(); }); })(i);
      } else { sl.className = 'slot'; sl.textContent = (i + 1) + 'つめ'; }
      box.appendChild(sl);
    }

    var acts = $('acts');
    if (!acts.children.length) {
      L.ACTIONS.forEach(function (a) {
        ICON_URL[a.id] = ICON_URL[a.id] || A.iconURL(a.id);
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'act'; b.id = 'act_' + a.id;
        b.innerHTML = '<span class="n"><img class="ico" alt="" src="' + ICON_URL[a.id] + '">' + a.label + '</span><span class="c"></span><span class="d">' + a.desc + '</span>';
        b.addEventListener('click', function () {
          if (plan.length >= L.slotsFor(S)) return;
          plan.push(a.id); sfx('pick'); renderPlan();
        });
        acts.appendChild(b);
      });
    }
    var projected = projectedMoney();
    L.ACTIONS.forEach(function (a) {
      var b = $('act_' + a.id), cost = L.actionCost(S, a.id);
      var extra = [];
      if (a.id === 'salon' && S.stats.mats >= 60) extra.push('毛玉料金');
      if (a.id === 'salon' && L.season(S.week) === 'summer') extra.push('サマーカット');
      b.querySelector('.c').textContent = a.id === 'job' ? '+8,000〜11,000円' : a.id === 'bigjob' ? '+22,000〜28,000円'
        : cost ? yen(cost) + (extra.length ? '（' + extra.join('・') + '込み）' : '') : '0円';
      b.disabled = busy || plan.length >= n || !L.canDo(S, a.id) || cost > projected
        || ((a.id === 'salon' || a.id === 'bigjob') && plan.indexOf(a.id) >= 0);
    });

    var exps = L.expensesFor(S.week), need = L.FOOD_COST, names = [];
    exps.forEach(function (x) { need += x.cost; names.push(x.title); });
    if (L.season(S.week) === 'summer') { need += 1000; names.push('エアコン代'); }
    var note = '週末に ' + names.concat(['ごはん代']).join('＋') + ' ' + yen(need) + ' がかかります。';
    if (projected < need) note = '⚠ このままだと週末にお金が足りず破産します！（' + yen(need) + ' 必要）';
    if (S.sick) note = '看病中なので、今週できることは2つだけ。' + note;
    if (S.tired) note = '高額副業の疲れで、今週は犬のお世話ができません（副業だけ）。' + note;
    if (L.season(S.week) === 'summer') note += S.summerCutUntil >= S.week ? '（サマーカット中：第' + S.summerCutUntil + '週まで）' : S.cool ? '（保冷グッズあり）' : '（暑さ対策なし！）';
    var gn = $('goNote'); gn.textContent = note; gn.style.color = projected < need ? 'var(--bad)' : '';
    $('btnGo').disabled = busy || plan.length < n;
  }
  function projectedMoney() {
    var m = S.money;
    plan.forEach(function (id) { if (id !== 'job') m -= L.actionCost(S, id); });
    return m;
  }
  function actionLabel(id) { for (var i = 0; i < L.ACTIONS.length; i++) if (L.ACTIONS[i].id === id) return L.ACTIONS[i].label; return id; }

  function render() { renderHud(); renderStats(); renderPlan(); }

  function showPlay() {
    $('sheet').hidden = true; $('carePanel').hidden = false;
    $('btnSave').hidden = false; $('btnTitle').hidden = false;
    render();
  }
  function showSheet(html) {
    var sh = $('sheet');
    sh.innerHTML = html; sh.hidden = false; $('carePanel').hidden = true;
    return sh;
  }

  // ---------- セーブ ----------
  // オートセーブ（毎週はじめ）＋ 手動のセーブスロット3つ。どれもこのブラウザに保存される
  var SLOTS = [
    { key: SAVE_KEY, label: 'オートセーブ', auto: true },
    { key: 'bichon48.slot1', label: 'セーブ 1' },
    { key: 'bichon48.slot2', label: 'セーブ 2' },
    { key: 'bichon48.slot3', label: 'セーブ 3' }
  ];
  function save() { if (S && !S.over) writeSlot(SLOTS[0], S); }
  function validState(o) {
    if (!o || o.v !== 1 || typeof o.dogName !== 'string' || !o.stats) return false;
    if (typeof o.week !== 'number' || o.week < 1 || o.week > L.TOTAL_WEEKS) return false;
    if (typeof o.money !== 'number' || !isFinite(o.money)) return false;
    var ok = true;
    STAT_DEF.forEach(function (d) { var v = o.stats[d.k]; if (typeof v !== 'number' || v < 0 || v > 100) ok = false; });
    return ok && typeof o.warnings === 'number' && typeof o.rng === 'number';
  }
  function writeSlot(slot, state) { store(slot.key, JSON.stringify({ state: state, at: Date.now() })); }
  function readSlot(slot) {
    try {
      var o = JSON.parse(store(slot.key));
      if (o && o.state) return validState(o.state) ? { state: o.state, at: o.at } : null;
      return validState(o) ? { state: o, at: 0 } : null;   // 以前の形式
    } catch (e) { return null; }
  }
  function anySave() { return SLOTS.some(function (sl) { return !!readSlot(sl); }); }
  function when(t) {
    if (!t) return '';
    var d = new Date(t), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  // セーブ／ロードの画面。mode = 'save' | 'load'
  function slotSheet(mode) {
    var list = mode === 'save' ? SLOTS.slice(1) : SLOTS;
    var html = '<h2>' + (mode === 'save' ? 'どこにセーブしますか？' : 'どのデータで遊びますか？') + '</h2><div class="slots">';
    list.forEach(function (sl, i) {
      var d = readSlot(sl), id = 'slot_' + i;
      html += '<button class="savecard" type="button" id="' + id + '"' + (!d && mode === 'load' ? ' disabled' : '') + '>' +
        '<span class="sc-label">' + sl.label + '</span>' +
        (d ? '<span class="sc-name">' + esc(d.state.dogName) + '</span>' +
             '<span class="sc-info">第' + d.state.week + '週　' + esc(yen(d.state.money)) + '　かわいさ ' + L.cute(d.state) + '</span>' +
             '<span class="sc-time">' + when(d.at) + '</span>'
           : '<span class="sc-empty">データなし</span>') +
        '</button>';
    });
    html += '</div><p class="caution" id="slotAsk" hidden></p>' +
      '<div class="suggest" id="slotYesNo" hidden><button class="btn primary" type="button" id="slotYes">はい</button><button class="btn" type="button" id="slotNo">いいえ</button></div>' +
      '<p class="note">セーブデータはこのブラウザに保存されます。</p>' +
      '<div class="suggest"><button class="btn" type="button" id="btnBack">もどる</button></div>';
    var sh = showSheet(html), pending = null;
    var ask = sh.querySelector('#slotAsk'), yn = sh.querySelector('#slotYesNo');
    function doSave(sl) {
      writeSlot(sl, S); save(); sfx('fan');
      toast(sl.label + ' にセーブしました'); showPlay();
    }
    list.forEach(function (sl, i) {
      sh.querySelector('#slot_' + i).addEventListener('click', function () {
        var d = readSlot(sl);
        if (mode === 'load') { if (d) { S = d.state; save(); resume(); } return; }
        if (!d) { doSave(sl); return; }
        pending = sl; sfx('pick');
        ask.hidden = false; yn.hidden = false;
        ask.textContent = sl.label + '（' + d.state.dogName + '・第' + d.state.week + '週）に上書きしますか？';
        sh.querySelector('#slotYes').focus();
      });
    });
    sh.querySelector('#slotYes').addEventListener('click', function () { if (pending) doSave(pending); });
    sh.querySelector('#slotNo').addEventListener('click', function () { pending = null; ask.hidden = true; yn.hidden = true; });
    sh.querySelector('#btnBack').addEventListener('click', function () { if (mode === 'save') showPlay(); else titleScreen(); });
  }
  $('btnSave').addEventListener('click', function () { if (S && !busy) slotSheet('save'); });
  $('btnTitle').addEventListener('click', function () { if (!busy) { save(); titleScreen(); } });

  // ---------- 週の進行 ----------
  var ACTION_ANIM = { walk: ['walk', 'park'], brush: ['brush', 'room'], play: ['play', 'room'], shampoo: ['shampoo', 'bath'], salon: ['none', 'cg:salon'], job: ['job', 'desk'], bigjob: ['job', 'desk'] };
  var EVENT_ANIM = { blitz: ['blitz', 'room'], wet: ['wet', 'room'], side: ['side', 'park'], sleep: ['sleep', 'room'], front: ['front', 'room'], happy: ['happy', 'room'], sick: ['sick', 'room'] };
  // イベントごとの専用の絵（1枚絵・専用ポーズ）
  var EVENT_SCENE = { hesoten: ['hesoten', 'room'], poodle: ['none', 'cg:poodle'], towel: ['none', 'cg:towel'], macho: ['none', 'cg:macho'],
    stalker: ['stalker', 'room'], tears: ['tears', 'room'], matting: ['matting', 'room'], sick: ['none', 'cg:vet'], heat: ['heat', 'room'], summer: ['side', 'park'] };

  $('btnGo').addEventListener('click', function () { if (!busy && plan.length === L.slotsFor(S)) runWeek(); });

  async function runWeek() {
    busy = true; render();
    var actions = plan.slice(); plan = [];
    for (var i = 0; i < actions.length; i++) {
      var id = actions[i];
      var r = L.runAction(S, id);
      var an = ACTION_ANIM[id]; A.setAnim(an[0], an[1]);
      sfx(id === 'job' || id === 'bigjob' ? 'coin' : 'ok');
      render();
      await say(r.msg, actionLabel(id));
      for (var j = 0; j < r.events.length; j++) await runEvent(r.events[j]);
    }

    // 週末
    A.setAnim('eat', 'night');
    var wk = S.week;
    var w = L.endWeek(S);
    render();
    await say('第' + wk + '週のおわり。\n' + w.notes.join('\n'), '週のまとめ');
    for (var k = 0; k < w.events.length; k++) await runEvent(w.events[k]);

    var checks = S.week >= L.TOTAL_WEEKS ? [] : L.kyokaiCheck(S);
    render();
    for (var c = 0; c < checks.length; c++) {
      var x = checks[c];
      if (x.type === 'warn') {
        A.setAnim('front', 'kyokai'); sfx('bad');
        await say('「' + x.reason + '。このままでは保護します」\n警告 ' + S.warnings + ' / ' + L.MAX_WARN, 'ビションフリーゼ協会より');
      } else if (x.type === 'praise') {
        A.setAnim('happy', 'room'); sfx('fan');
        await say('協会の人が見回りに来た。「とてもきれいにしていますね」\n警告をひとつ取り消してもらえた！', 'ビションフリーゼ協会より');
      } else {
        A.setAnim('front', 'room');
        await say('協会の人が見回りに来た。「かわいさ ' + x.cute + '…引き続きよろしくお願いします」', 'ビションフリーゼ協会より');
      }
    }

    var over = L.checkOver(S);
    if (over) { busy = false; return gameOver(over.type); }
    if (S.week >= L.TOTAL_WEEKS) { busy = false; return contest(); }

    L.nextWeek(S);
    save();
    busy = false;
    A.setAnim('idle', 'room');
    render();
    await weekStartNotices();
    if (S.week === L.TOTAL_WEEKS) await say('来週はいよいよコンテスト！今週が最後の準備です。サロンに行くなら今。', 'コンテスト直前');
  }

  // 週のはじめのお知らせ（決まった出費・夏の到来・疲れ）
  async function weekStartNotices() {
    busy = true; renderPlan();
    var exps = L.expensesFor(S.week);
    for (var i = 0; i < exps.length; i++) await say(exps[i].text + '\n（週末に ' + yen(exps[i].cost) + '）', '第' + S.week + '週 ' + exps[i].title);
    if (S.week === L.SUMMER_START) { A.setAnim('side', 'park'); await runEvent('summer'); A.setAnim('idle', 'room'); }
    if (S.tired) { A.setAnim('sleep', 'night'); await say('高額副業の疲れで、体が動かない…。今週は犬のお世話ができず、副業しかできない。', 'ヘトヘト'); A.setAnim('idle', 'room'); }
    busy = false; render();
  }

  async function runEvent(id) {
    var e = L.EVENTS[id];
    if (!e) return;
    var an = EVENT_SCENE[id] || EVENT_ANIM[e.anim] || ['front', 'room'];
    A.setAnim(an[0], an[1]);
    if (id === 'blitz' || id === 'sick') sfx('bad');
    var idx = e.choices.length > 1 ? await choose(e.title, e.text, e.choices.map(function (c) { return c.label; }))
      : (await say(e.text, e.title), 0);
    var res = L.applyChoice(S, id, idx);
    if (id === 'blitz' && idx === 0) A.setAnim('hesoten', 'room');
    if (id === 'wet' && idx === 0) A.setAnim('happy', 'room');
    render();
    await say(res, e.title);
  }

  // ---------- 終わり ----------
  async function gameOver(type) {
    BGM.play('sad');
    store(SAVE_KEY, null);
    $('btnSave').hidden = true;
    $('carePanel').hidden = true;
    if (type === 'bankrupt') {
      A.setAnim('none', 'cg:bankrupt'); sfx('bad');
      await say('サイフがからっぽ…。ごはんもサロン代も払えなくなってしまった。', '破産');
    }
    A.setAnim('none', 'cg:kyokai'); sfx('bad');
    await say('ビションフリーゼ協会の人がやってきた。\n「' + S.dogName + 'ちゃんは、しばらく協会で保護します」', 'ゲームオーバー');
    var reason = type === 'bankrupt' ? 'お金が足りなくなりました。副業とお世話のバランスが大事です。'
      : 'お世話が足りず、警告が3つたまりました。かわいさ' + L.WARN_CUTE + '未満・健康' + L.WARN_HEALTH + '未満で警告されます。';
    var sh = showSheet(
      '<h2>' + esc(S.dogName) + ' は協会に連れていかれた…</h2>' +
      '<p>第' + S.week + '週でゲームオーバー。' + reason + '</p>' +
      statusCard(S) +
      '<div class="menu"><button class="btn primary" type="button" id="btnRetry">もういちど（同じ名前で）</button>' +
      '<button class="btn" type="button" id="btnToTitle">タイトルへ</button></div>');
    var name = S.dogName;
    sh.querySelector('#btnRetry').addEventListener('click', function () { startNew(name); });
    sh.querySelector('#btnToTitle').addEventListener('click', titleScreen);
  }

  async function contest() {
    store(SAVE_KEY, null);
    $('btnSave').hidden = true;
    $('carePanel').hidden = true;
    A.setAnim('front', 'stage');
    await say('ついにコンテスト当日！\n' + S.dogName + ' はステージに上がった。', 'ビションフリーゼ・コンテスト');
    var sc = L.contestScore(S);
    S.over = { type: 'clear', score: sc.total };
    if (sc.rank.place === 1) A.setAnim('none', 'cg:contest'); else A.setAnim(sc.rank.place <= 3 ? 'cheer' : 'happy', 'stage');
    sfx('fan');
    await say('結果は… ' + sc.total + '点で「' + sc.rank.label + '」！', '審査結果');
    resultSheet(sc);
  }

  // 最終スコアのカード。ランキング登録のあとも表示し続ける
  function scoreCard(st, sc) {
    var p = sc.parts;
    return '<div class="finalscore">' +
      '<div class="fs-head"><span class="fs-label">最終スコア</span><span class="fs-rank rank' + sc.rank.place + '">' + esc(sc.rank.label) + '</span></div>' +
      '<div class="fs-total">' + sc.total + '<small> / 1000点</small></div>' +
      '<div class="breakdown">' +
      '<span>かわいさ ' + L.cute(st) + ' × 5</span><span>' + p.cute + '</span>' +
      '<span>健康 ' + st.stats.health + ' × 2</span><span>' + p.health + '</span>' +
      '<span>なかよし ' + st.stats.bond + ' × 2</span><span>' + p.bond + '</span>' +
      '<span>貯金 ' + esc(yen(st.money)) + '</span><span>' + p.money + '</span></div>' +
      '<p class="note">1年間で副業でかせいだお金：' + esc(yen(st.totalEarned || 0)) + '　／　優勝ライン ' + L.WIN_SCORE + '点</p>' +
      '</div>';
  }
  function statusCard(st) {
    return '<div class="finalscore">' +
      '<div class="fs-head"><span class="fs-label">最終ステータス（第' + st.week + '週）</span></div>' +
      '<div class="breakdown">' +
      '<span>かわいさ</span><span>' + L.cute(st) + '</span>' +
      '<span>健康</span><span>' + st.stats.health + '</span>' +
      '<span>なかよし</span><span>' + st.stats.bond + '</span>' +
      '<span>所持金</span><span>' + esc(yen(st.money)) + '</span>' +
      '<span>協会の警告</span><span>' + st.warnings + ' / ' + L.MAX_WARN + '</span></div>' +
      '<p class="note">1年間で副業でかせいだお金：' + esc(yen(st.totalEarned || 0)) + '</p>' +
      '</div>';
  }

  function resultSheet(sc) {
    var msg = sc.rank.place === 1 ? '1年間おつかれさまでした。' + S.dogName + ' はビションフリーゼの中のビションフリーゼです！'
      : '1年間おつかれさまでした。優勝は ' + L.WIN_SCORE + '点以上。かわいさ・健康・なかよし・貯金のバランスが大事です。';
    var sh = showSheet(
      '<h2>' + esc(S.dogName) + ' の1年間</h2>' +
      '<p>' + esc(msg) + '</p>' +
      scoreCard(S, sc) +
      '<div class="field"><label for="ownerName">飼い主のニックネーム（なくてもOK）</label>' +
      '<input id="ownerName" maxlength="10" autocomplete="off" placeholder="例：ビション好き"></div>' +
      '<p class="caution">ランキングはほかの人にも表示されます。本名など、個人がわかる名前は入れないでください。</p>' +
      '<div class="suggest"><button class="btn primary" type="button" id="btnSubmit">ランキングに登録</button>' +
      '<button class="btn" type="button" id="btnToTitle">タイトルへ</button></div>');
    sh.querySelector('#btnSubmit').addEventListener('click', async function (e) {
      var btn = e.currentTarget; btn.disabled = true;
      var entry = { dog: S.dogName, owner: cleanName(sh.querySelector('#ownerName').value, 10), score: sc.total, rank: sc.rank.label, cute: L.cute(S), at: new Date().toISOString().slice(0, 10), v: 1 };
      addLocalRank(entry);
      var shared = await submitShared(entry);
      toast(shared === true ? 'みんなのランキングに登録しました' : 'この端末のランキングに登録しました');
      rankingSheet(shared === true ? 'all' : 'local', entry, scoreCard(S, sc));
    });
    sh.querySelector('#btnToTitle').addEventListener('click', titleScreen);
  }

  // ---------- ランキング ----------
  var dbPromise = null;
  function getDb() {
    if (!dbPromise) {
      dbPromise = (window.claude && typeof window.claude.use === 'function')
        ? window.claude.use('db').catch(function () { return null; }) : Promise.resolve(null);
    }
    return dbPromise;
  }
  function localRanks() { try { var a = JSON.parse(store(RANK_KEY)); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function addLocalRank(entry) {
    var a = localRanks(); a.push(entry);
    a.sort(function (x, y) { return y.score - x.score; });
    store(RANK_KEY, JSON.stringify(a.slice(0, 20)));
  }
  var sharedError = '';
  async function submitShared(entry) {
    var db = await getDb();
    if (!db && window.FirebaseRanking) {
      try { await window.FirebaseRanking.add(entry); return true; }
      catch (e) { toast('みんなのランキングに登録できませんでした。時間をおいてもう一度お試しください。'); return false; }
    }
    if (!db) return false;
    try { await db.collection('scores').add(entry); return true; }
    catch (e) {
      sharedError = e && e.code === 'invalid_argument' ? 'このページでは閲覧のみのため、みんなのランキングに登録できませんでした。'
        : e && e.code === 'quota_exceeded' ? 'ランキングがいっぱいで登録できませんでした。'
        : 'みんなのランキングに登録できませんでした。時間をおいてもう一度お試しください。';
      toast(sharedError);
      return false;
    }
  }
  async function fetchShared() {
    var db = await getDb();
    if (!db && window.FirebaseRanking) {
      try { return await window.FirebaseRanking.top(50); } catch (e) { return null; }
    }
    if (!db) return null;
    try {
      var snap = await db.collection('scores').orderBy('score', 'desc').limit(50).get();
      return snap.docs.map(function (d) { return d.data(); });
    } catch (e) { return null; }
  }
  function rowsHtml(rows, me) {
    if (!rows.length) return '<p>まだ記録がありません。最初の優勝をめざそう！</p>';
    var h = '<div class="tablewrap"><table class="scoretable"><thead><tr><th>順位</th><th>犬の名前</th><th>飼い主</th><th>結果</th><th class="r">点数</th></tr></thead><tbody>';
    rows.forEach(function (r, i) {
      var score = Math.max(0, Math.min(1000, Math.round(Number(r.score) || 0)));
      var isMe = me && r.dog === me.dog && r.score === me.score && r.at === me.at;
      h += '<tr' + (isMe ? ' class="me"' : '') + '><td>' + (i + 1) + '</td><td>' + esc(cleanName(r.dog, 8)) + '</td><td>' + esc(cleanName(r.owner, 10) || '—') + '</td><td>' + esc(cleanName(r.rank, 4)) + '</td><td class="r">' + score + '</td></tr>';
    });
    return h + '</tbody></table></div>';
  }
  async function rankingSheet(tab, me, card) {
    tab = tab || 'all';
    var sh = showSheet(
      (card ? '<h2>今回の結果</h2>' + card : '') +
      '<h2>ランキング</h2>' +
      '<div class="tabs" role="tablist"><button class="btn small" type="button" role="tab" id="tabAll" aria-selected="' + (tab === 'all') + '">みんな</button>' +
      '<button class="btn small" type="button" role="tab" id="tabLocal" aria-selected="' + (tab === 'local') + '">この端末</button></div>' +
      '<div id="rankBody"><p>よみこみ中…</p></div>' +
      '<div class="suggest"><button class="btn" type="button" id="btnRankBack">もどる</button></div>');
    sh.querySelector('#tabAll').addEventListener('click', function () { rankingSheet('all', me, card); });
    sh.querySelector('#tabLocal').addEventListener('click', function () { rankingSheet('local', me, card); });
    sh.querySelector('#btnRankBack').addEventListener('click', function () { if (S && !S.over) showPlay(); else titleScreen(); });
    var body = sh.querySelector('#rankBody');
    if (tab === 'local') { body.innerHTML = rowsHtml(localRanks(), me); return; }
    var rows = await fetchShared();
    if (!body.isConnected) return;
    body.innerHTML = rows ? rowsHtml(rows, me)
      : '<p>みんなのランキングは、このページではまだ使えません。「この端末」タブで自分の記録を見られます。</p>';
  }
  $('btnRank').addEventListener('click', function () { if (!busy) rankingSheet('all'); });

  // ---------- タイトル・はじめかた ----------
  function titleScreen() {
    S = null; plan = []; prevStats = null;
    $('hud').hidden = true; $('carePanel').hidden = true; $('btnSave').hidden = true; $('btnTitle').hidden = true;
    $('dialog').hidden = true; advance = null;
    A.setAnim('none', 'cg:title');
    BGM.play('home');
    var sv = anySave();
    var sh = showSheet(
      '<h2>ビションフリーゼと、48週間。</h2>' +
      '<p>毎週「お世話」か「副業」を選んで、ふわふわのまま1年間くらそう。サボるとモコモコ、お金を使いすぎると破産、かわいくないと協会に連れていかれます。</p>' +
      '<div class="menu">' +
      '<button class="btn primary" type="button" id="btnNew">はじめから</button>' +
      (sv ? '<button class="btn" type="button" id="btnCont">つづきから</button>' : '') +
      '<button class="btn" type="button" id="btnHow">あそびかた</button></div>');
    sh.querySelector('#btnNew').addEventListener('click', nameSheet);
    if (sv) sh.querySelector('#btnCont').addEventListener('click', function () { slotSheet('load'); });
    sh.querySelector('#btnHow').addEventListener('click', howSheet);
  }

  function resume() {
    prevStats = null; plan = [];
    A.setAnim('idle', 'room');
    showPlay();
    say('おかえりなさい。第' + S.week + '週のはじめから再開します。', S.dogName);
  }

  function howSheet() {
    var sh = showSheet(
      '<h2>あそびかた</h2>' +
      '<ul class="howto">' +
      '<li>1週間にできることは3つ。お世話と副業から選んで「この週をすすめる」。</li>' +
      '<li>ビションフリーゼは毛がのび続けます。月に1回はトリミングサロンへ（10,000円）。</li>' +
      '<li>ブラッシングをサボると毛玉地獄。毛玉が多いとサロンで追加料金。</li>' +
      '<li>おさんぽしないと健康が下がって病気に。ストレスがたまると「ビション・ブリッツ」で大暴走。</li>' +
      '<li>毎週ごはん代' + yen(L.FOOD_COST) + '。ワクチンや、毎月のフィラリア予防薬（第8〜40週）の出費も。お金がマイナスになったら破産です。</li>' +
      '<li>夏（第21〜34週）はモコモコの毛で熱中症の危険。保冷グッズか、サロンのサマーカット（+2,000円・6週間）で対策を。エアコン代もかかります。</li>' +
      '<li>高額副業は22,000〜28,000円かせげるけど、翌週は疲れて犬のお世話ができません。</li>' +
      '<li>かわいさ' + L.WARN_CUTE + '未満・健康' + L.WARN_HEALTH + '未満だとビションフリーゼ協会から警告。3つで連れていかれます。4週ごとの見回りで良い状態なら警告が1つ消えます。</li>' +
      '<li>第44週にコンテストの登録料 ' + yen(L.ENTRY_FEE) + ' がかかります。</li>' +
      '<li>48週目はコンテスト。かわいさ・健康・なかよし・貯金で採点。' + L.WIN_SCORE + '点以上で優勝！</li>' +
      '<li>毎週はじめに自動でセーブされます。</li></ul>' +
      '<div class="suggest"><button class="btn" type="button" id="btnBack">もどる</button></div>');
    sh.querySelector('#btnBack').addEventListener('click', titleScreen);
  }

  var NAME_IDEAS = ['マシュマロ', 'わたあめ', 'ポポ', 'ミルク', 'コットン', 'ぷりん'];
  function nameSheet() {
    A.setAnim('front', 'room');
    var sh = showSheet(
      '<h2>この子の名前は？</h2>' +
      '<div class="field"><label for="dogName">犬の名前（8文字まで）</label>' +
      '<input id="dogName" maxlength="8" autocomplete="off" value=""></div>' +
      '<div class="suggest" aria-label="名前の例">' + NAME_IDEAS.map(function (n) { return '<button class="btn small" type="button" data-n="' + n + '">' + n + '</button>'; }).join('') + '</div>' +
      '<p class="caution">名前はランキングでほかの人にも表示されます。飼い主さんの本名など、個人がわかる言葉は入れないでください。</p>' +
      '<p id="nameErr" class="caution" hidden>名前を入れてください。</p>' +
      '<div class="suggest"><button class="btn primary" type="button" id="btnStart">この名前ではじめる</button><button class="btn" type="button" id="btnBack">もどる</button></div>');
    var input = sh.querySelector('#dogName');
    sh.querySelectorAll('[data-n]').forEach(function (b) { b.addEventListener('click', function () { input.value = b.dataset.n; input.focus(); }); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') sh.querySelector('#btnStart').click(); });
    sh.querySelector('#btnStart').addEventListener('click', function () {
      var n = cleanName(input.value, 8);
      if (!n) { sh.querySelector('#nameErr').hidden = false; input.focus(); return; }
      startNew(n);
    });
    sh.querySelector('#btnBack').addEventListener('click', titleScreen);
    setTimeout(function () { input.focus(); }, 50);
  }

  async function startNew(name) {
    S = L.newGame(name, (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    plan = []; prevStats = null;
    save();
    A.setAnim('happy', 'room');
    showPlay();
    busy = true; renderPlan();
    await say('今日から ' + name + ' との生活がはじまる！', 'はじまり');
    A.setAnim('front', 'room');
    await say('ビションフリーゼは毛がのび続ける犬種。\n月1回のサロン、こまめなブラッシング、毎週のおさんぽが欠かせない。', 'はじまり');
    await say('手持ちは ' + yen(S.money) + '。足りなくなったら副業でかせごう。\n目標は48週目のコンテストで優勝！', 'はじまり');
    busy = false;
    A.setAnim('idle', 'room');
    render();
  }

  // ---------- 起動 ----------
  A.load().then(function () {
    requestAnimationFrame(frame);
    titleScreen();
  });
})();
