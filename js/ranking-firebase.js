// Cloud Firestore の REST API でランキングを読み書きする（SDKなし）
(function () {
  'use strict';
  var cfg = window.RANKING_FIREBASE;
  if (!cfg || !cfg.apiKey || !cfg.projectId) return;

  var base = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(cfg.projectId) + '/databases/(default)/documents';
  var key = '?key=' + encodeURIComponent(cfg.apiKey);

  function toFields(o) {
    var f = {};
    Object.keys(o).forEach(function (k) {
      var v = o[k];
      f[k] = typeof v === 'number' ? { integerValue: String(Math.round(v)) } : { stringValue: String(v) };
    });
    return f;
  }
  function fromFields(f) {
    var o = {};
    Object.keys(f || {}).forEach(function (k) {
      var v = f[k];
      o[k] = 'integerValue' in v ? Number(v.integerValue) : 'doubleValue' in v ? Number(v.doubleValue) : v.stringValue;
    });
    return o;
  }

  window.FirebaseRanking = {
    add: function (entry) {
      return fetch(base + '/scores' + key, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: toFields(entry) })
      }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return true; });
    },
    top: function (n) {
      return fetch(base + ':runQuery' + key, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ structuredQuery: {
          from: [{ collectionId: 'scores' }],
          orderBy: [{ field: { fieldPath: 'score' }, direction: 'DESCENDING' }],
          limit: n
        } })
      }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (rows) { return rows.filter(function (x) { return x.document; }).map(function (x) { return fromFields(x.document.fields); }); });
    }
  };
})();
