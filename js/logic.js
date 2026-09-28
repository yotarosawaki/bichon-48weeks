// ゲームルール（画面に依存しない純粋なロジック）。ブラウザとNodeの両方で動く。
(function (root) {
  'use strict';

  var TOTAL_WEEKS = 48;
  var SLOTS = 3;
  var START_MONEY = 20000;
  var FOOD_COST = 4700;
  var SALON_COST = 10000;
  var SALON_MATS_FEE = 4000;
  var SHAMPOO_COST = 1000;
  var VET_COST = 15000;
  var SUMMER_CUT_FEE = 2000;
  var COOL_GOODS_COST = 4000;
  var AIRCON_COST = 1000;
  var HEAT_VET_COST = 20000;
  var FILARIA_TEST_COST = 5000;
  var FILARIA_MED_COST = 1800;
  var MAX_WARN = 3;
  var WARN_CUTE = 53;     // かわいさがこれ未満だと協会から警告
  var WARN_HEALTH = 30;   // 健康がこれ未満だと協会から警告
  var WIN_SCORE = 840;    // 優勝ライン

  var ACTIONS = [
    { id: 'walk',    label: 'おさんぽ',     cost: 0,          desc: '健康↑ ストレス↓ ちょっと汚れる' },
    { id: 'brush',   label: 'ブラッシング', cost: 0,          desc: '毛玉↓ なかよし↑' },
    { id: 'play',    label: 'あそぶ',       cost: 0,          desc: 'ストレス↓ なかよし↑' },
    { id: 'shampoo', label: 'シャンプー', cost: SHAMPOO_COST, desc: 'おうちで。清潔↑ 毛は絡みやすい' },
    { id: 'salon',   label: 'サロン', cost: SALON_COST, desc: 'トリミングで形が元通り。夏はサマーカット' },
    { id: 'job',     label: '副業',         cost: 0,          desc: 'お金を稼ぐ。そのあいだ犬はさみしい' },
    { id: 'bigjob',  label: '高額副業',     cost: 0,          desc: 'がっつり稼ぐ。疲れて翌週はお世話できない' }
  ];

  // 1年の季節と、その週に決まって起こる出費
  var CALENDAR = {
    6:  { title: '狂犬病ワクチン', cost: 3500, text: '年に1回の狂犬病ワクチン。法律で決まっています。' },
    10: { title: '混合ワクチン', cost: 8000, text: '混合ワクチンの季節。病院はちょっと苦手。' },
    30: { title: 'ノミ・ダニ予防', cost: 4000, text: '夏の草むらはノミやダニがいっぱい。予防薬を買いました。' },
    40: { title: '健康診断', cost: 7000, text: 'コンテスト前の健康診断。問題なし！' }
  };

  // その週に払う決まった出費（週末に引かれる）
  function expensesFor(week) {
    var list = [];
    if (CALENDAR[week]) list.push(CALENDAR[week]);
    if (week === 8) list.push({ title: 'フィラリア検査', cost: FILARIA_TEST_COST, text: '蚊の季節の前に、フィラリアにかかっていないか血液検査。' });
    if (week >= 8 && week <= 40 && week % 4 === 0) list.push({ title: 'フィラリア予防薬', cost: FILARIA_MED_COST, text: '月に1回のフィラリアのお薬。蚊がいる季節は毎月欠かせない。' });
    return list;
  }

  function season(week) {
    if (week <= 8) return 'spring';
    if (week <= 20) return 'rainy';   // 春〜梅雨
    if (week <= 34) return 'summer';
    if (week <= 42) return 'autumn';
    return 'winter';
  }
  var SEASON_LABEL = { spring: 'はる', rainy: 'つゆ', summer: 'なつ', autumn: 'あき', winter: 'ふゆ' };

  // --- 乱数（セーブしても同じ流れになるよう状態に持たせる） ---
  function rand(s) {
    var t = (s.rng = (s.rng + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function randInt(s, a, b) { return a + Math.floor(rand(s) * (b - a + 1)); }
  function clamp(v) { return Math.max(0, Math.min(100, Math.round(v))); }
  function add(s, key, d) { s.stats[key] = clamp(s.stats[key] + d); }

  function newGame(dogName, seed) {
    return {
      v: 1,
      dogName: dogName,
      week: 1,
      money: START_MONEY,
      stats: { shape: 90, mats: 10, clean: 80, health: 80, stress: 30, bond: 40 },
      warnings: 0,
      sick: false,
      rng: (seed >>> 0) || 1,
      over: null,
      tired: false,       // 高額副業の疲れで、今週はお世話できない
      tiredNext: false,
      cool: false,        // 保冷グッズを持っている
      summerCutUntil: 0,  // この週までサマーカットで涼しい
      totalEarned: 0,
      log: []
    };
  }

  // かわいさ = 毛のカタチ・毛玉・清潔から決まる見た目の点数
  function cute(s) {
    var st = s.stats;
    return clamp(0.45 * st.shape + 0.35 * (100 - st.mats) + 0.20 * st.clean);
  }
  function cuteLabel(c) {
    if (c >= 80) return 'ふわふわ';
    if (c >= 60) return 'まあまあ';
    if (c >= 40) return 'モコモコ';
    return 'ボサボサ';
  }

  function slotsFor(s) { return s.sick ? SLOTS - 1 : SLOTS; }

  var CARE = { walk: 1, brush: 1, play: 1, shampoo: 1, salon: 1 };
  // その行動が今週えらべるか（お金以外の理由）
  function canDo(s, id) {
    if (s.tired && (CARE[id] || id === 'bigjob')) return false;
    return true;
  }

  function actionCost(s, id) {
    if (id === 'salon') return SALON_COST + (s.stats.mats >= 60 ? SALON_MATS_FEE : 0) + (season(s.week) === 'summer' ? SUMMER_CUT_FEE : 0);
    for (var i = 0; i < ACTIONS.length; i++) if (ACTIONS[i].id === id) return ACTIONS[i].cost;
    return 0;
  }

  // 行動をひとつ実行する。{ msg, anim, events } を返す
  function runAction(s, id) {
    var st = s.stats, sea = season(s.week), ev = [], msg = '', anim = id;
    var cost = actionCost(s, id);
    s.money -= cost;
    switch (id) {
      case 'walk':
        add(s, 'health', sea === 'summer' ? 10 : 16);
        add(s, 'stress', -35);
        add(s, 'clean', sea === 'rainy' ? -12 : -6);
        add(s, 'mats', 4);
        add(s, 'bond', 3);
        msg = sea === 'summer' ? 'あついので朝早くにおさんぽ。アスファルトに気をつけて。'
            : sea === 'rainy' ? '雨あがりのおさんぽ。足がどろんこ…'
            : 'たのしいおさんぽ。においをいっぱいかいだ。';
        if (st.shape < 60 ? rand(s) < 0.5 : rand(s) < 0.12) ev.push('poodle');
        break;
      case 'brush':
        add(s, 'mats', sea === 'winter' ? -30 : -38);
        add(s, 'bond', 4);
        add(s, 'clean', 3);
        msg = st.mats > 50 ? 'スリッカーブラシで毛玉と格闘。おたがいヘトヘト。' : 'シャッシャッ。気持ちよさそうに目を細めている。';
        if (st.mats > 50) add(s, 'stress', 8);
        break;
      case 'play':
        add(s, 'stress', -25);
        add(s, 'bond', 8);
        add(s, 'health', 3);
        msg = 'ボールあそび！何回投げても持ってくる。';
        break;
      case 'shampoo':
        add(s, 'clean', 45);
        add(s, 'mats', 8);
        add(s, 'stress', 10);
        msg = 'おうちでシャンプー。泡だらけ。';
        ev.push('wet');
        if (rand(s) < 0.45) ev.push('blitz');
        break;
      case 'salon':
        var fee = s.stats.mats >= 60;
        st.shape = 100;
        st.mats = 0;
        st.clean = Math.max(st.clean, 92);
        add(s, 'stress', 12);
        msg = fee ? '毛玉がひどくて追加料金をとられた…でもまんまるに戻った！' : 'まんまるのパウダーパフカット！トリマーさんにほめられた。';
        if (sea === 'summer') {
          s.summerCutUntil = s.week + 5;
          msg = (fee ? '毛玉の追加料金もとられたけど、' : '') + 'すっきりサマーカット！これで6週間は暑さも平気。';
        }
        if (rand(s) < 0.35) ev.push('blitz');
        break;
      case 'job':
        var earn = randInt(s, 8, 11) * 1000;
        s.money += earn;
        s.totalEarned += earn;
        add(s, 'bond', -2);
        add(s, 'stress', 8);
        msg = '副業で ' + earn.toLocaleString() + '円 かせいだ。ドアの前でずっと待っていたらしい。';
        break;
      case 'bigjob':
        var big = randInt(s, 22, 28) * 1000;
        s.money += big;
        s.totalEarned += big;
        s.tiredNext = true;
        add(s, 'bond', -5);
        add(s, 'stress', 15);
        msg = '徹夜で高額副業！' + big.toLocaleString() + '円 かせいだ。…でもヘトヘトで、来週は犬のお世話どころじゃない。';
        anim = 'job';
        break;
    }
    return { msg: msg, anim: anim, events: ev };
  }

  // 週の終わり。自然変化・出費・病気・協会チェック
  function endWeek(s) {
    var st = s.stats, sea = season(s.week), notes = [], ev = [];

    s.money -= FOOD_COST;
    notes.push('ごはん・消耗品代 -' + FOOD_COST.toLocaleString() + '円');
    expensesFor(s.week).forEach(function (x) { s.money -= x.cost; notes.push(x.title + ' -' + x.cost.toLocaleString() + '円'); });
    if (sea === 'summer') { s.money -= AIRCON_COST; notes.push('エアコン代 -' + AIRCON_COST.toLocaleString() + '円'); }

    // 最終週はコンテスト当日。毛がのびる前に審査を受ける
    if (s.week >= TOTAL_WEEKS) return { notes: notes, events: [] };

    add(s, 'shape', -12);
    add(s, 'mats', sea === 'winter' ? 24 : sea === 'rainy' ? 22 : 19);
    add(s, 'clean', sea === 'summer' ? -13 : -9);
    add(s, 'health', -12 - (st.stress >= 80 ? 6 : 0));
    add(s, 'stress', 22);
    add(s, 'bond', -2);

    // 夏の暑さ。白いモコモコの毛は熱がこもる
    if (sea === 'summer') {
      if (s.summerCutUntil >= s.week) notes.push('サマーカットで涼しそう');
      else {
        var f = s.cool ? 0.5 : 1;
        add(s, 'health', -8 * f);
        add(s, 'stress', 12 * f);
        notes.push(s.cool ? '保冷グッズでなんとか暑さをしのいだ' : '暑さでぐったり…');
        if (rand(s) < (s.cool ? 0.08 : 0.3)) ev.push('heat');
      }
    }

    // 毛玉がひどいと皮膚トラブルで健康にも響く
    if (st.mats >= 80) { add(s, 'health', -6); notes.push('毛玉で皮膚がかゆそう'); }

    // 病気
    if (s.sick) {
      if (st.health < 35) {
        s.money -= 8000; notes.push('通院のつづき -8,000円'); add(s, 'health', 12);
      } else { s.sick = false; notes.push('病気がなおった！'); }
    } else if (st.health < 40) {
      var p = 0.15 + (40 - st.health) / 40 * 0.7;
      if (rand(s) < p) { ev.push('sick'); }
    }

    // ストレスが溜まるとビション・ブリッツ
    if (st.stress >= 75 && rand(s) < 0.7) ev.push('blitz');

    // あるあるイベント
    if (rand(s) < 0.4) ev.push(pickFlavor(s));

    return { notes: notes, events: ev.filter(Boolean) };
  }

  function pickFlavor(s) {
    var st = s.stats, pool = ['towel', 'hesoten', 'stalker', 'macho'];
    if (st.clean < 55) pool.push('tears', 'tears');
    if (st.mats >= 60) pool.push('matting', 'matting');
    return pool[Math.floor(rand(s) * pool.length)];
  }

  // 協会の判定。週の終わりのイベントを片付けたあとに呼ぶ
  function kyokaiCheck(s) {
    var c = cute(s), st = s.stats, out = [];
    if (c < WARN_CUTE) { s.warnings++; out.push({ type: 'warn', reason: 'かわいさが ' + c + ' まで下がっています' }); }
    if (st.health < WARN_HEALTH) { s.warnings++; out.push({ type: 'warn', reason: '健康が ' + st.health + ' しかありません' }); }
    if (s.week % 4 === 0 && out.length === 0) {
      if (c >= 70 && st.health >= 60 && s.warnings > 0) { s.warnings--; out.push({ type: 'praise' }); }
      else out.push({ type: 'visit', cute: c });
    }
    return out;
  }

  function checkOver(s) {
    if (s.over) return s.over;
    if (s.warnings >= MAX_WARN) s.over = { type: 'kyokai' };
    else if (s.money < 0) s.over = { type: 'bankrupt' };
    else if (s.week > TOTAL_WEEKS) s.over = { type: 'clear' };
    return s.over;
  }

  function nextWeek(s) {
    s.week++;
    s.tired = !!s.tiredNext;
    s.tiredNext = false;
    return checkOver(s);
  }

  // --- イベント定義。選択肢の効果は状態を書き換えて結果の文を返す ---
  var EVENTS = {
    blitz: {
      title: 'ビション・ブリッツ！',
      text: 'なんの前ぶれもなくスイッチON！部屋じゅうを猛スピードで走りまわりはじめた！',
      anim: 'blitz',
      choices: [
        { label: '部屋を片付けて、そっと見守る', fx: function (s) {
          s.stats.stress = clamp(s.stats.stress * 0.2); add(s, 'bond', 6);
          return '危ないものをどけて、落ち着くまで見守った。満足そうにへそ天。'; } },
        { label: 'つかまえようと追いかける', fx: function (s) {
          add(s, 'stress', -10);
          if (rand(s) < 0.5) { s.money -= 12000; add(s, 'health', -15);
            return '追いかけっこだと思ってさらに加速！家具にぶつかって足をいためた。病院代 12,000円。'; }
          return 'ますます興奮してしまった…なかなか止まらない。'; } },
        { label: '大声で「ストップ！」', fx: function (s) {
          add(s, 'bond', -10); add(s, 'stress', 10);
          return 'びっくりして固まってしまった。なんだかしょんぼり。'; } }
      ]
    },
    wet: {
      title: 'だれ…？',
      text: 'シャンプーでペタンコになったら、ほっそりしたネズミ…いや宇宙人のような姿に！',
      anim: 'wet',
      choices: [
        { label: 'ドライヤーでしっかり乾かす', fx: function (s) {
          add(s, 'clean', 5); add(s, 'mats', -5); add(s, 'shape', 3);
          return 'ふわっふわに復活！やっぱりこっちのほうがいい。'; } },
        { label: '自然乾燥でいいか', fx: function (s) {
          add(s, 'mats', 15); add(s, 'health', -6); add(s, 'shape', -5);
          return '生乾きで毛がからまり、ちょっとくさい…'; } }
      ]
    },
    poodle: {
      title: '「トイプードルですか？」',
      text: 'おさんぽ中、通りすがりの人に話しかけられた。',
      anim: 'side',
      choices: [
        { label: '「ビションフリーゼです！」', fx: function (s) {
          if (s.stats.shape >= 60) { add(s, 'bond', 3); return '「へぇ〜かわいい！」ほめられてしっぽブンブン。'; }
          add(s, 'bond', 1); return '「えっ…？」毛がのびてアフロの形がくずれているせいか、信じてもらえなかった。'; } },
        { label: '「…そんな感じです」', fx: function (s) {
          return '説明をあきらめた。こういうことはよくある。'; } }
      ]
    },
    towel: {
      title: 'しろいかたまり',
      text: '床の白いタオルを、丸まって寝ているうちの子と見まちがえて話しかけてしまった。',
      anim: 'sleep',
      choices: [
        { label: '本物をなでに行く', fx: function (s) { add(s, 'bond', 4); add(s, 'stress', -5); return 'こっちが本物。あったかい。'; } },
        { label: 'タオルを片付ける', fx: function (s) { add(s, 'clean', 2); return 'これでもう間違えない…はず。'; } }
      ]
    },
    hesoten: {
      title: 'へそ天',
      text: '仰向けでおなかを丸出しにして爆睡している。警戒心ゼロ。',
      anim: 'sleep',
      choices: [
        { label: 'そっとしておく', fx: function (s) { add(s, 'health', 5); add(s, 'stress', -10); return 'ぐっすり眠って元気いっぱい。'; } },
        { label: 'おなかをなでる', fx: function (s) { add(s, 'bond', 5); return '寝ぼけながら足をピクピク。しあわせ。'; } }
      ]
    },
    stalker: {
      title: 'いえのなかのストーカー',
      text: 'リビング、キッチン、トイレのドアの前…どこへ行ってもついてくる。',
      anim: 'front',
      choices: [
        { label: 'だっこしてあげる', fx: function (s) { add(s, 'bond', 6); return '満足そう。いつもさみしいのかも。'; } },
        { label: 'ついでにブラッシング', fx: function (s) { add(s, 'mats', -12); add(s, 'bond', 2); return 'すきま時間にちょっとだけブラッシングできた。'; } }
      ]
    },
    macho: {
      title: 'みためよりずっしり',
      text: 'だっこしたら想像以上に重い！綿あめみたいなのに、中身はしっかり筋肉質。',
      anim: 'happy',
      choices: [
        { label: '「いい筋肉だね」', fx: function (s) {
          if (s.stats.health >= 60) { add(s, 'bond', 3); return 'おさんぽの成果が出ている。健康そのもの。'; }
          add(s, 'health', -2); return 'あれ…最近ちょっと運動不足かも？'; } }
      ]
    },
    tears: {
      title: '涙やけ',
      text: '目の下と口のまわりが茶色くなってきた。白い毛だとすごく目立つ…',
      anim: 'front',
      choices: [
        { label: 'ていねいに拭く（300円）', fx: function (s) { s.money -= 300; add(s, 'clean', 15); return 'ケア用品で拭いてきれいになった。'; } },
        { label: 'あとでやる', fx: function (s) { add(s, 'clean', -8); return '茶色いしみが広がってしまった…'; } }
      ]
    },
    matting: {
      title: '毛玉地獄',
      text: '根元にフェルトみたいな毛玉ができている！放っておくとどんどん固くなる。',
      anim: 'side',
      choices: [
        { label: '今すぐ格闘する', fx: function (s) { add(s, 'mats', -20); add(s, 'stress', 15); add(s, 'bond', -3); return 'なんとかほぐした。おたがいヘトヘト。'; } },
        { label: '次のサロンで…', fx: function (s) { add(s, 'mats', 8); return '毛玉がさらに育ってしまった。'; } }
      ]
    },
    summer: {
      title: '夏がきた！',
      text: 'ビションフリーゼの白いモコモコは、夏はまるで毛皮のコート。暑さ対策をしないと熱中症の危険も。',
      anim: 'side',
      choices: [
        { label: '保冷グッズを買う（' + COOL_GOODS_COST.toLocaleString() + '円）', fx: function (s) {
          if (s.money < COOL_GOODS_COST) return 'お金が足りなくて買えなかった…。夏のサロンでサマーカットにする手もある。';
          s.money -= COOL_GOODS_COST; s.cool = true;
          return '保冷剤ベストとひんやりマットを買った。夏のあいだ、暑さのダメージが半分になる。'; } },
        { label: 'サロンでサマーカットにする', fx: function () {
          return '夏のサロンはサマーカット（+' + SUMMER_CUT_FEE.toLocaleString() + '円）。カットから6週間は暑さを気にしなくていい。'; } },
        { label: '気合いで乗り切る', fx: function () {
          return 'エアコンだけでがんばる。…ほんとうに大丈夫？'; } }
      ]
    },
    heat: {
      title: '熱中症！',
      text: 'ハァハァと息が荒く、ぐったりしている。モコモコの毛に熱がこもってしまった！',
      anim: 'sick',
      choices: [
        { label: 'すぐ病院へ（' + HEAT_VET_COST.toLocaleString() + '円）', fx: function (s) {
          s.money -= HEAT_VET_COST; add(s, 'health', 10);
          return '点滴をしてもらって、なんとか元気になった。'; } },
        { label: '体を冷やして様子を見る', fx: function (s) {
          if (rand(s) < 0.5) { add(s, 'health', -25); s.sick = true; s.money -= 8000;
            return '悪化してしまい、結局病院へ。通院代 8,000円。来週は看病が必要。'; }
          add(s, 'health', -8); return '保冷剤で冷やしたら、なんとか落ち着いた。ヒヤッとした…'; } }
      ]
    },
    sick: {
      title: 'ぐったり…',
      text: '元気がなく、ごはんも残している。運動不足で体力が落ちていたのかも。動物病院へ。',
      anim: 'sick',
      choices: [
        { label: '病院へ行く（' + VET_COST.toLocaleString() + '円）', fx: function (s) {
          s.money -= VET_COST; s.sick = true; add(s, 'health', 20);
          return '注射と薬をもらった。来週は看病があるので、できることが1つ減る。'; } }
      ]
    }
  };

  function applyChoice(s, evId, idx) {
    var e = EVENTS[evId];
    var c = e.choices[idx] || e.choices[0];
    return c.fx(s);
  }

  // コンテストの点数（最大1000点）
  function contestScore(s) {
    var st = s.stats;
    var parts = {
      cute: cute(s) * 5,
      health: st.health * 2,
      bond: st.bond * 2,
      money: Math.floor(Math.min(Math.max(s.money, 0), 100000) / 1000)
    };
    var total = parts.cute + parts.health + parts.bond + parts.money;
    return { total: total, parts: parts, rank: contestRank(total) };
  }
  function contestRank(t) {
    if (t >= WIN_SCORE) return { place: 1, label: '優勝' };
    if (t >= 760) return { place: 2, label: '準優勝' };
    if (t >= 660) return { place: 3, label: '3位' };
    if (t >= 500) return { place: 4, label: '入賞' };
    return { place: 5, label: '参加賞' };
  }

  root.Logic = {
    TOTAL_WEEKS: TOTAL_WEEKS, SLOTS: SLOTS, ACTIONS: ACTIONS, EVENTS: EVENTS, CALENDAR: CALENDAR,
    MAX_WARN: MAX_WARN, WARN_CUTE: WARN_CUTE, WARN_HEALTH: WARN_HEALTH, WIN_SCORE: WIN_SCORE, START_MONEY: START_MONEY, SEASON_LABEL: SEASON_LABEL, FOOD_COST: FOOD_COST,
    expensesFor: expensesFor, canDo: canDo, SUMMER_START: 21,
    newGame: newGame, cute: cute, cuteLabel: cuteLabel, season: season, slotsFor: slotsFor,
    actionCost: actionCost, runAction: runAction, endWeek: endWeek, kyokaiCheck: kyokaiCheck,
    checkOver: checkOver, nextWeek: nextWeek, applyChoice: applyChoice,
    contestScore: contestScore, rand: rand
  };
})(typeof window !== 'undefined' ? window : globalThis);
