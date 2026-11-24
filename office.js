// 顧問先への質問アプリ 第1版（事務所の画面）。文字はすべて textContent で入れる。
(function () {
  'use strict';
  var API = window.Q_API || '', sess = '', main = document.getElementById('main');
  function el(tag, props, kids) {
    var e = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      if (k === 'text') e.textContent = props[k];
      else if (k === 'on') Object.keys(props.on).forEach(function (ev) { e.addEventListener(ev, props.on[ev]); });
      else if (props[k] != null) e.setAttribute(k, props[k]);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  function show(kids) { main.textContent = ''; kids.forEach(function (c) { if (c) main.appendChild(c); }); }
  var tick = null, lastList = null;   // lastList：顧問先の一覧の控え（「一覧へ戻る」をすぐ出すため）
  function busy(on) {   // 待つあいだ、経過の秒を出す（止まっているのか、動いているのかが分かるように）
    var t = document.getElementById('busytext'), t0 = Date.now();
    document.getElementById('busy').hidden = !on;
    if (tick) { clearInterval(tick); tick = null; }
    t.textContent = on ? '処理しています' : '';
    if (on) tick = setInterval(function () { t.textContent = '処理しています（' + Math.round((Date.now() - t0) / 1000) + '秒）'; }, 1000);
  }
  function api(fn, args) {
    busy(true);
    return fetch(API, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain' },
                        body: JSON.stringify({ fn: fn, args: args || {}, sess: sess }) })
      .then(function (r) { return r.json(); })
      .catch(function () { return { ok: false, err: '通信できませんでした。' }; })
      .then(function (r) {
        busy(false);
        if (!r.ok && r.code === 'sess') { sess = ''; login(r.err); throw new Error('sess'); }
        if (!r.ok) throw new Error(r.err);
        return r.r;
      });
  }
  function day(s) { return (s || '').slice(0, 10); }

  function login(note) {
    var pw = el('input', { type: 'password', autocomplete: 'off' }), totp = el('input', { type: 'text', inputmode: 'numeric', maxlength: '10', autocomplete: 'off' });
    var m = el('p', { class: 'warn', text: note || '', hidden: note ? null : '' });
    show([el('div', { class: 'card' }, [el('h1', { text: '事務所のログイン' }), m,
      el('label', { text: 'パスワード' }), pw, el('label', { text: '認証アプリの6桁（またはバックアップコード）' }), totp,
      el('button', { text: 'ログイン', on: { click: function () {
        api('oLogin', { pw: pw.value, totp: totp.value }).then(function (r) { sess = r.sess; list(); })
          .catch(function (e) { if (e.message !== 'sess') { m.textContent = e.message; m.hidden = false; } pw.value = ''; totp.value = ''; });
      } } })])]);
  }

  function list(note, url, quick) {   // quick：控えからすぐ出す（押したあとの動きは、いつも読み直す）
    ((quick && lastList) ? Promise.resolve(lastList) : api('oClients').then(function (r) { lastList = r; return r; })).then(function (r) {
      var code6 = el('input', { type: 'text', inputmode: 'numeric', maxlength: '10', autocomplete: 'off', placeholder: 'いまの6桁' });
      var m = el('p', { class: note && note.bad ? 'warn' : 'done', text: note ? note.text : '', hidden: note ? null : '' });
      function act(fn, args, done) {
        return function () {
          if (!code6.value) { m.className = 'warn'; m.textContent = '上の欄に、認証アプリのいまの6桁を入れてから押してください。'; m.hidden = false; return; }
          args.totp = code6.value;
          api(fn, args).then(done).catch(function (e) { if (e.message !== 'sess') list({ text: e.message, bad: true }); });
        };
      }
      var rows = r.clients.map(function (c) {
        var state = !c.issued ? 'URLなし' : c.stopped ? '停止中（番号ちがい10回）' : c.expires < r.today ? 'URLの期限切れ' : !c.hasPin ? '番号を決める前' : '利用中';
        return el('tr', {}, [
          el('td', { text: c.name }), el('td', { text: state }), el('td', { text: c.expires }),
          el('td', {}, [
            el('button', { class: 'small', text: c.issued ? 'URLを作り直す' : 'URLを作る', on: { click: act('oIssue', { code: c.code }, function (x) {
              list({ text: c.name + ' のURLを作りました（期限 ' + x.expires + '）。古いURLは使えなくなりました。' }, x.url); }) } }),
            c.issued ? el('button', { class: 'small soft', text: '番号を消す', on: { click: act('oReset', { code: c.code }, function () {
              list({ text: c.name + ' の番号を消しました。次に開いたとき、ご本人が決め直します。' }); }) } }) : null,
            el('button', { class: 'small soft', text: '回答を見る', on: { click: function () { status(c.code); } } })])]);
      });
      var urlBox = null;
      if (url) {
        var u = el('input', { type: 'text', readonly: '' }); u.value = url;
        urlBox = el('div', { class: 'card' }, [el('h2', { text: '顧問先へ送るURL' }),
          el('p', { class: 'sub', text: 'このURLは、その顧問先のご本人にだけ送ってください。この画面を閉じると、もう表示できません（作り直しはできます）。' }), u,
          el('button', { class: 'small', text: 'コピー', on: { click: function () { u.select(); navigator.clipboard && navigator.clipboard.writeText(url); } } })]);
      }
      show([m, urlBox, el('div', { class: 'card' }, [el('h1', { text: '顧問先の一覧' }),
        el('label', { text: 'URLを作る・番号を消す・送信済みを戻すときは、認証アプリのいまの6桁を入れてから押します（1回ごとに新しい6桁）' }), code6,
        el('table', {}, [el('tr', {}, ['顧問先', '状態', 'URLの期限', '操作'].map(function (h) { return el('th', { text: h }); }))].concat(rows))])]);
    }).catch(function () {});
  }

  function status(code) {
    api('oStatus', { code: code }).then(function (r) {
      var code6 = el('input', { type: 'text', inputmode: 'numeric', maxlength: '10', autocomplete: 'off', placeholder: 'いまの6桁（送信済みを戻すとき）' });
      var m = el('p', { class: 'warn', hidden: '' });
      function reopen(wd) {
        return el('button', { class: 'small soft', text: '直せる状態に戻す', on: { click: function () {
          if (!code6.value) { m.textContent = '認証アプリのいまの6桁を入れてから押してください。'; m.hidden = false; return; }
          api('oReopen', { code: code, wd: wd, totp: code6.value }).then(function () { status(code); })
            .catch(function (e) { if (e.message !== 'sess') { m.textContent = e.message; m.hidden = false; } });
        } } });
      }
      var kids = [el('button', { class: 'small soft', text: '一覧へ戻る', on: { click: function () { list(null, null, true); } } }), el('h1', { text: r.name }), m, code6];
      if (!r.works.length) kids.push(el('p', { class: 'sub', text: '領収書の質問は、まだありません（ReceiptScan で保留にして出力すると出ます）。' }));
      r.works.forEach(function (w) {
        kids.push(el('div', { class: 'card' }, [
          el('h2', { text: '作業日 ' + w.workdate + '　期限 ' + w.limit + '　' + (w.submitted ? '送信済み ' + day(w.submitted) : '未送信') }),
          el('table', {}, [el('tr', {}, ['番号', '読めた内容', '質問', '事業の割合', 'お答え・メモ'].map(function (h) { return el('th', { text: h }); }))]
            .concat(w.items.map(function (it) {
              var a = it.answer;
              return el('tr', {}, [el('td', { text: String(it.seq) }), el('td', { text: [it.date, it.payee, it.amount].filter(function (v) { return v !== '' && v != null; }).join(' ') }),
                el('td', { text: it.question }), el('td', { text: !a ? '（まだ）' : a.percent + '％' }),
                el('td', { text: !a ? '' : a.skipped ? '（お答えなし。100％経費とだけ意思表示）' : [a.what, a.memo].filter(Boolean).join(' ／ ') })]);
            }))), w.submitted ? reopen(w.workdate) : null]));
      });
      var rt = r.ratio;
      if (rt && (rt.history || []).length > 1) kids.push(el('p', { class: 'warn', text: '割合の送り直しが ' + (rt.history.length - 1) + '回 あります。いつからの内容か：'
        + rt.history.map(function (h) { return h.from === 'start' ? '年度のはじめから' : h.from + ' から'; }).join(' → ') + '（下の表は最新の内容。前の内容は回答のファイルの history にあります）' }));
      Object.keys((rt && rt.groups) || {}).forEach(function (name) {   // 住宅ローン控除を受けている人：控除額の計算に響くので、担当者が必ず見る
        var g = rt.groups[name];
        if (g.loan !== 'はい') return;
        kids.push(el('p', { class: g.percent > 10 || g.basis !== '広さ（面積）' ? 'warn' : 'done',
          text: '住宅ローン控除あり：' + name + ' 事業 ' + g.percent + '％（決め方：' + g.basis + '）。'
            + (g.percent > 50 ? '50％を超えています。控除が受けられるか確認してください。' : g.percent > 10 ? '10％を超えています。控除額の計算を確認してください。' : '')
            + (g.basis !== '広さ（面積）' ? '控除の判定は床面積です。床面積での割合を確認してください。' : '') }));
      });
      kids.push(el('div', { class: 'card' }, [
        el('h2', { text: r.year + '年分　事業で使っている割合　' + (rt && rt.submitted ? '送信済み ' + day(rt.submitted) : rt ? '途中' : 'まだ') }),
        rt ? el('table', {}, [el('tr', {}, ['項目', '割合', '決め方', '個別に変えた理由'].map(function (h) { return el('th', { text: h }); }))]
          .concat(r.items.map(function (name) {
            var a = rt.rows[name];
            return el('tr', {}, [el('td', { text: name }), el('td', { text: a ? a.percent + '％' : '（まだ）' }), el('td', { text: a ? a.basis : '' }), el('td', { text: a ? a.memo : '' })]);
          }))) : null, rt && rt.submitted ? reopen('ratio') : null]));
      kids.push(el('p', { class: 'sub', text: '回答は、顧問先のフォルダの 出力／回答 に保存されています。' }));
      show(kids);
    }).catch(function () {});
  }

  if (!API) show([el('div', { class: 'card' }, [el('p', { text: '準備中です（config.js に GAS のURLを入れてください）。' })])]);
  else login();
})();
