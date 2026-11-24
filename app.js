// 顧問先への質問アプリ 第14版（顧問先の画面）
// 決まり：入力された文字・サーバーから来た文字は、すべて textContent で入れる（innerHTML は使わない）。
(function () {
  'use strict';
  var API = window.Q_API || '';
  var qs = new URLSearchParams(location.search);
  var CODE = /^\d{1,8}$/.test(qs.get('c') || '') ? qs.get('c') : '';
  var KEY = /^[0-9a-f]{32}$/.test(qs.get('k') || '') ? qs.get('k') : '';
  var sess = '', data = null, images = {};
  var texts = {};   // 図解・説明文（ログインのあとに届く）
  var main = document.getElementById('main');

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
  function show(kids) {
    main.textContent = '';
    kids.forEach(function (c) { if (c) main.appendChild(c); });
    window.scrollTo(0, 0);
  }
  function card(kids) { return el('div', { class: 'card' }, kids); }
  function yen(n) { return n == null || n === '' ? '' : Number(n).toLocaleString('ja-JP') + '円'; }
  function day(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? Number(m[2]) + '月' + Number(m[3]) + '日' : ''; }

  var busyTimer = null;
  function busy(text) {
    var b = document.getElementById('busy'), t = document.getElementById('busytext'), t0 = Date.now();
    clearInterval(busyTimer);
    if (!text) { b.hidden = true; return; }
    b.hidden = false; t.textContent = text;
    busyTimer = setInterval(function () { t.textContent = text + '（' + Math.round((Date.now() - t0) / 1000) + '秒）'; }, 1000);
  }
  function api(fn, args, text) {
    busy(text || '読み込んでいます');
    return fetch(API, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain' },
                        body: JSON.stringify({ fn: fn, args: args || {}, sess: sess }) })
      .then(function (r) { return r.json(); })
      .catch(function () { return { ok: false, err: '通信できませんでした。電波のよい所で、もう一度お試しください。' }; })
      .then(function (r) {
        busy('');
        if (!r.ok && r.code === 'sess') { sess = ''; pinScreen('pin', r.err); throw new Error('sess'); }
        if (!r.ok) { var e = new Error(r.err); e.shown = r.err; e.code = r.code; throw e; }
        return r.r;
      });
  }
  function fail(box) { return function (e) { if (e.message !== 'sess') box.textContent = e.shown || 'うまくいきませんでした。もう一度お試しください。'; box.hidden = false; }; }
  function msgBox() { return el('p', { class: 'warn', hidden: '' }); }

  // 文字盤で入力欄が隠れないようにする
  document.addEventListener('focusin', function (ev) {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(ev.target.tagName))
      setTimeout(function () { ev.target.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 300);
  });

  // ───── 入口 ─────
  function start() {
    if (!API) return show([card([el('p', { text: '準備中です。' })])]);
    if (!CODE || !KEY) return show([card([el('p', { text: 'このURLは使えません。事務所から届いたURLを、そのまま開いてください。' })])]);
    api('hello', { code: CODE, key: KEY }).then(function (r) { pinScreen(r.state); })
      .catch(function (e) { show([card([el('p', { class: 'warn', text: e.shown || '開けませんでした。' })])]); });
  }
  function pinInput() { return el('input', { class: 'pin', type: 'password', inputmode: 'numeric', maxlength: '6', autocomplete: 'off', pattern: '\\d{6}' }); }
  function pinScreen(state, note) {
    var m = msgBox(), p1 = pinInput(), p2 = pinInput(), set = state === 'setpin';
    if (note) { m.textContent = note; m.hidden = false; }
    function go() {
      m.hidden = true;
      if (!/^\d{6}$/.test(p1.value)) { m.textContent = '数字6つを入れてください。'; m.hidden = false; return; }
      if (set && p1.value !== p2.value) { m.textContent = '2回の番号がちがいます。もう一度入れてください。'; m.hidden = false; return; }
      api(set ? 'setPin' : 'login', { code: CODE, key: KEY, pin: p1.value }, '確かめています')
        .then(function (r) { sess = r.sess; home(); }).catch(function (e) { p1.value = ''; p2.value = ''; fail(m)(e); });
    }
    show([card([
      el('h1', { text: set ? 'はじめに、番号を決めてください' : '番号を入れてください' }),
      el('p', { class: 'sub', text: set ? 'ご自分で決める数字6つです。次からは、開くたびにこの番号を入れます。誕生日や電話番号は避けてください。'
                                        : 'はじめに決めた数字6つです。忘れたときは、事務所へご連絡ください。' }),
      m, el('label', { text: '番号（数字6つ）' }), p1,
      set ? el('label', { text: 'もう一度' }) : null, set ? p2 : null,
      el('button', { text: set ? 'この番号に決める' : '開く', on: { click: go } })
    ])]);
  }

  // ───── はじめの画面 ─────
  function home(note) {
    api('list').then(function (r) {
      data = r;
      texts = r.texts || {};
      var gb = document.getElementById('guidebtn'); if (gb) gb.hidden = !texts.guide;   // 図解は、ログインのあとにだけ出す
      document.getElementById('who').textContent = r.name + ' 様';
      var kids = [note ? el('p', { class: 'done', text: note }) : null];
      var open = r.works.filter(function (w) { return !w.submitted; });
      if (!open.length && r.ratio.submitted) kids.push(card([el('p', { text: 'いま、お答えいただくものはありません。ありがとうございました。' })]));
      r.works.forEach(function (w) {
        var left = w.items.filter(function (i) { return !i.answer; }).length;
        kids.push(card([
          el('h2', { text: '領収書の確認　' + w.items.length + '件' }),
          el('p', { class: 'sub', text: w.submitted ? '送信済みです（' + day(w.submitted) + '）。' : 'お答えの期限：' + day(w.limit) + '　残り ' + left + '件' }),
          el('button', { class: w.submitted ? 'soft' : '', text: w.submitted ? '回答を見る' : left === w.items.length ? '答える' : '続きから答える', on: { click: function () { list(w); } } })
        ]));
      });
      kids.push(card([
        el('h2', { text: r.ratio.year + '年分　事業で使っている割合' }),
        el('p', { class: 'sub', text: r.ratio.submitted ? '送信済みです（' + day(r.ratio.submitted) + '）。' : '家賃や電気代などのうち、事業で使っている割合をおたずねします。年に1回です。' }),
        r.ratio.submitted
          ? el('button', { class: 'link', text: '使い方が変わったので、送り直す', on: { click: function () { api('ratioReopen').then(ratioStart).catch(function () {}); } } })
          : el('button', { class: 'soft', text: '割合を決める', on: { click: function () { ratioStart(); } } })
      ]));
      show(kids);
    }).catch(function (e) { if (e.message !== 'sess') show([card([el('p', { class: 'warn', text: e.shown || '読み込めませんでした。' })])]); });
  }

  // ───── 選ぶボタン（どれか1つ） ─────
  function picker(options, current, onPick) {
    var box = el('div'), value = current || '';
    options.forEach(function (o) {
      var b = el('button', { class: 'pick' + (o[0] === value ? ' on' : ''), type: 'button', text: o[1], on: { click: function () {
        value = o[0];
        Array.prototype.forEach.call(box.children, function (c) { c.classList.toggle('on', c === b); });
        onPick(value);
      } } });
      box.appendChild(b);
    });
    box.value = function () { return value; };
    return box;
  }
  function percentSelect(current) {
    var s = el('select');
    s.appendChild(el('option', { value: '', text: 'えらんでください' }));
    for (var p = 5; p <= 95; p += 5) { var o = el('option', { value: String(p), text: p + '％' }); if (p === current) o.selected = true; s.appendChild(o); }
    return s;
  }

  // ───── 領収書1枚ずつ（スマホの1画面に収める。画像は押すと大きく出る） ─────
  function zoom(src) {
    var box = el('div', { class: 'pop' }, [el('img', { src: src, alt: '領収書の画像' }), el('p', { text: '画面を押すと閉じます' })]);
    box.addEventListener('click', function () { box.remove(); });
    document.body.appendChild(box);
  }
  function pctLabel(v) { v = Number(v); return v + '％' + (v === 100 ? '（全部が事業用）' : v === 0 ? '（私用・経費にしません）' : '（一部が事業用）'); }
  function answerText(a) { return [a.what, (a.memo || '').replace(/^'/, '')].filter(Boolean).join('　'); }
  function receipt(w, i) {
    var it = w.items[i], a = it.answer || {}, m = msgBox(), editing = !!it.answer;
    var thumb = el('button', { class: 'thumb', type: 'button', text: it.hasImage ? '読み込み中' : '画像なし' });
    if (it.hasImage) {
      var k = w.workdate + '/' + it.seq;
      var put = function (src) {
        thumb.textContent = '';
        thumb.appendChild(el('img', { src: src, alt: '領収書の画像' }));
        thumb.appendChild(el('span', { text: '押すと拡大' }));
        thumb.addEventListener('click', function () { zoom(src); });
      };
      if (images[k]) put(images[k]);
      else fetch(API, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain' },
                        body: JSON.stringify({ fn: 'image', args: { wd: w.workdate, seq: it.seq }, sess: sess }) })
        .then(function (r) { return r.json(); })
        .then(function (r) { if (r.ok) { images[k] = 'data:image/jpeg;base64,' + r.r.data; put(images[k]); } else thumb.textContent = '画像なし'; })
        .catch(function () { thumb.textContent = '画像なし'; });
    }
    var pct = el('input', { type: 'range', min: '0', max: '100', step: '5' });
    pct.value = a.percent == null ? 100 : a.percent;   // はじめは100％。減らすのは本人
    var pctText = el('b', { class: 'pct', text: pctLabel(pct.value) });
    pct.addEventListener('input', function () { pctText.textContent = pctLabel(pct.value); });
    // 答えの選択肢は、質問ごとに付いてくる。無い質問は、文字で答える
    var choices = it.choices || [], kind = null;
    if (choices.length) {
      kind = el('select');   // iPhone では、一覧から選ぶ形で出る
      kind.appendChild(el('option', { value: '', text: 'えらんでください' }));
      choices.concat(['その他']).forEach(function (name) { var o = el('option', { value: name, text: name }); if (name === a.what) o.selected = true; kind.appendChild(o); });
    }
    if (kind) kind.addEventListener('change', function () {   // 「（私用）」の答えを選んだら、割合を0％にする（あとで動かせる）
      if (/私用/.test(kind.value)) { pct.value = 0; pctText.textContent = pctLabel(0); }
    });
    var memo = el('input', { type: 'text', maxlength: '300', placeholder: kind ? 'メモ（「その他」のときは内容を）' : 'ここに書いてください' });
    memo.value = (a.memo || '').replace(/^'/, '');
    function save() {
      m.hidden = true;
      if (kind && !kind.value) { m.textContent = 'お答えをえらんでください。'; m.hidden = false; return; }
      if (kind && kind.value === 'その他' && !memo.value.trim()) { m.textContent = '「その他」のときは、メモに内容を書いてください。'; m.hidden = false; return; }
      if (!kind && !memo.value.trim()) { m.textContent = 'お答えを書いてください。'; m.hidden = false; return; }
      api('answer', { wd: w.workdate, seq: it.seq, what: kind ? kind.value : '', percent: Number(pct.value), memo: memo.value }, '保存しています')
        .then(function (r) {
          it.answer = r.answer;
          var next = w.items.findIndex(function (x, j) { return j > i && !x.answer; });
          editing || next < 0 ? list(w) : receipt(w, next);   // 直したときは一覧へ戻る。はじめてのときは、次のまだのものへ
        }).catch(fail(m));
    }
    show([card([
      el('p', { class: 'step', text: (i + 1) + ' / ' + w.items.length + ' 件目　お答えの期限 ' + day(w.limit) }),
      el('div', { class: 'top' }, [thumb, el('div', {}, [
        el('p', { class: 'sub', text: [day(it.date), it.payee, yen(it.amount)].filter(Boolean).join('　') }),
        el('p', { class: 'q', text: it.question })])]),
      m,
      el('label', {}, [document.createTextNode('事業で使った割合　'), pctText]), pct,
      el('div', { class: 'scale' }, [el('span', { text: '0％' }), el('span', { text: '50％' }), el('span', { text: '100％' })]),
      el('label', { text: '上の質問へのお答え' }), kind, memo,
      chieLink(it, m),
      el('div', { class: 'row' }, [
        el('button', { class: 'soft back', text: '一覧へ', on: { click: function () { list(w); } } }),
        el('button', { text: editing ? '保存する' : '保存して次へ', on: { click: save } })])
    ])]);
  }
  // ───── 「ちえに聞く」：LINE を別の画面で開く（このアプリの画面は閉じない）。質問の書き出しを写しておく ─────
  function chieLink(it, m) {
    var url = String(window.Q_CHIE || '');
    if (!/^https:\/\/line\.me\//.test(url)) return null;   // LINE の住所だけを受け付ける
    var a = el('a', { class: 'chie', text: '分からないときは、ちえに聞く（LINEが開きます）' });
    a.setAttribute('href', url); a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener');
    a.addEventListener('click', function () {
      var line = 'レシート' + it.seq + '（' + [day(it.date), it.payee, yen(it.amount)].filter(Boolean).join(' ') + '）について質問です。';
      try {
        navigator.clipboard.writeText(line).then(function () {
          m.textContent = '質問の書き出しを写しました。LINEの入力欄に貼り付けて、続きを書いてください。'; m.hidden = false;
        }, function () {});
      } catch (e) { /* 写せなくても、LINEは開く */ }
    });
    return a;
  }
  // ───── 一覧の部品：1行目に名前と今の状態、2行目にボタンを並べる（文字の長さで折り返さない） ─────
  function entry(cls, title, state, buttons, extra) {
    return el('div', { class: 'entry ' + cls }, [
      el('div', { class: 'head' }, [el('span', { class: 'name' }, [].concat(title).map(function (t) { return el('span', { text: t }); })), el('span', { class: 'state', text: state })]),
      buttons.length ? el('div', { class: 'tri' }, buttons.map(function (b) {
        return el('button', { type: 'button', class: b.on ? 'on' : '', text: b.text, on: { click: b.click } });
      })) : null].concat(extra || []));
  }
  // ───── 領収書の一覧（種類ごとにまとめて決められる。1枚ずつも決められる） ─────
  function list(w) {
    var m = msgBox(), left = w.items.filter(function (i) { return !i.answer; }).length, locked = !!w.submitted;
    w.open = w.open || {};
    function quick(it, percent) {
      return function () {
        api('answer', { wd: w.workdate, seq: it.seq, quick: true, percent: percent }, '保存しています')
          .then(function (r) { it.answer = r.answer; list(w); }).catch(fail(m));
      };
    }
    function bulk(kind, percent) {
      api('bulk', { wd: w.workdate, kind: kind, percent: percent }, '保存しています').then(function (r) {
        w.items.forEach(function (it) { if (r.answers[String(it.seq)]) it.answer = r.answers[String(it.seq)]; });
        list(w);
      }).catch(fail(m));
    }
    function row(it) {
      var a = it.answer, i = w.items.indexOf(it);
      // 日付・取引先・金額は、1行ずつ出す（1行に詰めると、長い店名で切れて読めない）
      var title = [(i + 1) + '．' + (day(it.date) || '日付なし'), it.payee || '（取引先は読めていません）', yen(it.amount)].filter(Boolean);
      return entry('rc' + (a ? '' : ' todo'), title, a ? a.percent + '％' : 'まだ', locked ? [] : [
        { text: '0％', on: a && a.percent === 0, click: quick(it, 0) },
        { text: '割合設定', on: a && a.percent > 0 && a.percent < 100, click: function () { receipt(w, i); } },
        { text: '100％', on: a && a.percent === 100, click: quick(it, 100) }]);
    }
    var noBulk = data.noBulk || [];
    var kinds = [], rest = [];
    w.items.forEach(function (it) { if (!it.kind || noBulk.indexOf(it.kind) >= 0) rest.push(it); else if (kinds.indexOf(it.kind) < 0) kinds.push(it.kind); });
    var blocks = kinds.map(function (kind) {
      var its = w.items.filter(function (it) { return it.kind === kind; });
      var done = its.filter(function (it) { return it.answer; }), ps = done.map(function (it) { return it.answer.percent; });
      var same = done.length === its.length && ps.every(function (p) { return p === ps[0]; });
      var state = same ? ps[0] + '％' : done.length === its.length ? '1枚ずつ' : 'まだ ' + (its.length - done.length) + '枚';
      var toggle = el('button', { class: 'fold', type: 'button', text: (w.open[kind] ? '▲ とじる' : '▼ レシートを1枚ずつ見る') + '（' + its.length + '枚）',
        on: { click: function () { w.open[kind] = !w.open[kind]; list(w); } } });
      return entry('grp' + (done.length === its.length ? '' : ' todo'), kind + '　' + its.length + '枚', state, locked ? [] : [
        { text: '0％', on: same && ps[0] === 0, click: function () { bulk(kind, 0); } },
        { text: '割合設定', on: same && ps[0] > 0 && ps[0] < 100, click: function () { bulkSet(w, kind, bulk); } },
        { text: '100％', on: same && ps[0] === 100, click: function () { bulk(kind, 100); } }],
        [toggle].concat(w.open[kind] ? [el('div', { class: 'inner' }, [el('p', { class: 'sub', text: kind + 'のレシート（' + its.length + '枚）' })].concat(its.map(row)))] : []));
    });
    var skippedN = w.items.filter(function (x) { return x.answer && x.answer.skipped && x.answer.percent > 0; }).length;
    function doSend(confirmed) {
      api('submit', { wd: w.workdate, confirmSkipped: confirmed }, '送信しています').then(function () { home('送信しました。ありがとうございました。'); }).catch(fail(m));
    }
    var send = el('button', { text: 'この内容で送信する', on: { click: function () { skippedN ? confirmSkipped(w, skippedN, doSend) : doSend(false); } } });
    send.disabled = left > 0;
    show([card([
      el('h1', { text: '領収書の確認　' + w.items.length + '件' }),
      el('p', { class: 'sub', text: locked ? '送信済みです。直すときは、事務所へご連絡ください。' : 'お答えの期限 ' + day(w.limit) }),
      locked ? null : el('div', { class: 'legend' }, [
        el('span', { text: '0％：経費にしない' }), el('span', { text: '割合設定：質問に答えて、割合を決める' }), el('span', { text: '100％：全額を経費にする' })]),
      m].concat(blocks.length ? [el('h2', { class: 'sec', text: '種類ごとにまとめて決める' })] : []).concat(blocks)
      .concat(rest.length && blocks.length ? [el('h2', { class: 'sec', text: '1枚ずつ決める' })] : []).concat(rest.map(row)).concat(locked ? [] : [send,
      left ? el('p', { class: 'sub', text: 'まだのものが ' + left + '件 あります。全部が決まると、送信できます。' }) : null]).concat([
      el('button', { class: 'soft', text: 'はじめの画面へ', on: { click: function () { home(); } } })]))]);
  }
  // 種類ごとに、まとめて割合を決める
  function bulkSet(w, kind, bulk) {
    var m = msgBox(), box = slider(null);
    show([card([el('h1', { text: kind + '　まとめて割合を決める' }),
      el('p', { class: 'sub', text: 'この種類のレシート全部に、同じ割合を入れます。1枚ずつ決めたレシートは変わりません。' }), m, box,
      el('div', { class: 'row' }, [
        el('button', { class: 'soft back', text: '戻る', on: { click: function () { list(w); } } }),
        el('button', { text: 'この割合にする', on: { click: function () {
          if (box.value() == null) { m.textContent = '目盛りを押すか、動かして決めてください。'; m.hidden = false; return; }
          bulk(kind, box.value());
        } } })])])]);
  }

  // お答えなし（100％経費とだけ意思表示）があるとき、送信の前に確かめる
  function confirmSkipped(w, n, doSend) {
    show([card([
      el('h1', { text: 'お答えのない領収書が ' + n + '件 あります' }),
      el('p', { text: '質問にお答えがないまま、全額を経費にする内容です。' }),
      el('p', { class: 'warn', text: '税務調査で内容を聞かれたとき、説明の材料がありません。説明できない場合は、経費と認められず、追加の税金がかかることがあります。' }),
      el('button', { text: '戻って質問に答える', on: { click: function () { list(w); } } }),
      el('button', { class: 'soft', text: 'このまま経費として送信する', on: { click: function () { doSend(true); } } })
    ])]);
  }

  // ───── 事業で使っている割合（まとまりごとに1つ決める。項目ごとに変えるときは理由を書く） ─────
  var ratio = null;
  function ratioStart() {
    api('ratioGet').then(function (r) {
      ratio = r;
      ratioReview();   // いつも一覧から始める
    }).catch(function (e) { if (e.message !== 'sess') home(); });
  }
  // 目盛り。はじめの値は入れず、本人が押すか動かして決める。決まるまでは薄い色で「まだ」と分かるようにする
  function slider(value, onChange) {
    var input = el('input', { type: 'range', min: '0', max: '100', step: '5' }), touched = value != null;
    input.value = touched ? value : 50;
    if (!touched) input.classList.add('unset');
    var text = el('b', { class: 'pct', text: touched ? value + '％' : 'まだ決まっていません' });
    function touch() { touched = true; input.classList.remove('unset'); text.textContent = input.value + '％'; if (onChange) onChange(); }
    // 動かさずに押しただけ（まん中の50％のまま）でも「決めた」とする
    ['input', 'change', 'pointerdown', 'touchstart', 'mousedown', 'keydown'].forEach(function (ev) { input.addEventListener(ev, function () { setTimeout(touch, 0); }); });
    var box = el('div', {}, [el('label', {}, [document.createTextNode('事業で使っている割合　'), text]), input,
      el('div', { class: 'scale' }, [el('span', { text: '0％' }), el('span', { text: '50％' }), el('span', { text: '100％' })])]);
    box.value = function () { return touched ? Number(input.value) : null; };
    return box;
  }
  // まとまり1つを、1画面1問で進める：①種類 → ②住宅ローン控除（持ち家だけ）→ ③説明（「はい」だけ）→ ④割合
  function ratioGroup(i, preset) {
    var def = ratio.groups[i], a = ratio.saved[def.name] || {}, NONE = ratio.none;
    var kinds = def.kinds ? Object.keys(def.kinds).map(function (k) { return [k, k]; }) : [['あり', '事業で使っている']];
    var st = { kind: a.kind || '', loan: a.loan || '' };
    var main = slider(preset != null ? preset : a.kind && a.kind !== NONE ? a.percent : null);
    var basis = el('select');
    basis.appendChild(el('option', { value: '', text: 'えらんでください' }));
    def.bases.forEach(function (b) { var o = el('option', { value: b, text: b }); if (b === a.basis) o.selected = true; basis.appendChild(o); });
    if (preset === 100 || a.basis === ratio.full) { var fo = el('option', { value: ratio.full, text: ratio.full }); fo.selected = true; basis.appendChild(fo); }
    var over = {}, itemsFor = '', more = el('details', { class: 'more' });
    function asksLoan(kind) { return (def.loanKinds || []).indexOf(kind) >= 0; }
    function head() { return [el('p', { class: 'step', text: ratio.year + '年分　' + (i + 1) + ' / ' + ratio.groups.length }), el('h1', { text: def.name })]; }
    function toList() { return el('button', { class: 'link', text: '一覧へ', on: { click: function () { ratioReview(); } } }); }
    function send(g, m) {
      var groups = {}; groups[def.name] = g;
      api('ratioSave', { groups: groups }, '保存しています')
        .then(function (r) { ratio.saved = r.saved; i + 1 < ratio.groups.length && !ratio.saved[ratio.groups[i + 1].name] ? ratioGroup(i + 1) : ratioReview(); }).catch(fail(m));
    }
    function stepKind() {
      var m = msgBox();
      show([card(head().concat([m, el('label', { text: 'どれに当たりますか' }),
        picker(kinds.concat([[NONE, NONE]]), st.kind, function (v) {
          st.kind = v;
          if (v === NONE) send({ kind: NONE }, m); else if (asksLoan(v)) stepLoan(); else stepRatio();
        }), toList()]))]);
    }
    function stepLoan() {
      show([card(head().concat([el('label', { text: '住宅ローン控除を受けていますか' }),
        picker([['はい', 'はい'], ['いいえ', 'いいえ']], st.loan, function (v) { st.loan = v; v === 'はい' ? stepNote() : stepRatio(); }),
        el('button', { class: 'link', text: '前へ', on: { click: stepKind } })]))]);
    }
    function stepNote() {   // 文面は、ログインのあとにサーバーから届く（設定.json の「案内の文」）
      var t = texts.loan || {};
      show([card([
        el('h1', { text: t.title || '住宅ローン控除を受けている方へ' }),
        el('p', { text: t.lead || '' }),
        el('div', { class: 'note' }, (t.lines || []).map(function (x) { return el('p', { text: x }); })),
        el('b', { text: t.cautionTitle || '' })]
        .concat((t.cautions || []).map(function (x) { return el('p', { class: 'small', text: x }); }))
        .concat([el('button', { text: '読みました。割合を決める', on: { click: stepRatio } })]))]);
    }
    function drawItems() {   // 項目ごとの変更は、たたんでおく（開くのは変えたい人だけ）
      if (itemsFor === st.kind) return;
      itemsFor = st.kind; over = {}; more.textContent = '';
      var items = def.kinds ? def.kinds[st.kind] : def.items, any = false;
      var sum = el('summary', {}, [el('b', { text: '項目ごとに変える' }), el('span', { class: 'openmark' })]);
      more.appendChild(sum);
      more.appendChild(el('p', { class: 'sub', text: '何もしなければ、どの項目も上の割合と同じです。' }));
      items.forEach(function (name) {
        var saved = a.kind === st.kind && a.overrides && a.overrides[name], row = el('div', { class: 'ov' });
        function same() {
          delete over[name]; row.textContent = '';
          row.appendChild(el('span', { text: name }));
          row.appendChild(el('button', { class: 'link', type: 'button', text: 'この項目だけ変える', on: { click: function () { differ(null); } } }));
        }
        function differ(o) {
          var box = slider(o ? o.percent : null), reason = el('input', { type: 'text', maxlength: '200', placeholder: '理由（例：仕事専用の回線）' });
          reason.value = o ? o.reason.replace(/^'/, '') : '';
          over[name] = { box: box, reason: reason };
          row.textContent = '';
          row.appendChild(el('div', { class: 'ovbox' }, [el('b', { text: name + '（この項目だけ変える）' }), box, reason,
            el('button', { class: 'link', type: 'button', text: '上の割合と同じに戻す', on: { click: same } })]));
        }
        if (saved) { any = true; differ(saved); } else same();
        more.appendChild(row);
      });
      more.open = any;
    }
    function stepRatio() {
      var m = msgBox();
      drawItems();
      function stop(t) { m.textContent = t; m.hidden = false; m.scrollIntoView({ block: 'center' }); }
      function save() {
        m.hidden = true;
        var g = { kind: st.kind, overrides: {} };
        if (asksLoan(st.kind)) g.loan = st.loan;
        if (main.value() == null) return stop('いちばん上の「事業で使っている割合」が、まだ決まっていません。目盛りを押すか、動かして決めてください。');
        if (!basis.value) return stop('「割合の決め方」をえらんでください。');
        g.percent = main.value(); g.basis = basis.value;
        for (var name in over) {
          more.open = true;
          if (over[name].box.value() == null) return stop('「' + name + '」の割合が、まだ決まっていません。「' + name + '」の目盛りを押すか、動かして決めてください。');
          if (!over[name].reason.value.trim()) return stop('「' + name + '」だけ割合を変える理由を書いてください。');
          g.overrides[name] = { percent: over[name].box.value(), reason: over[name].reason.value };
        }
        send(g, m);
      }
      show([card(head().concat([
        el('p', { class: 'chosen' }, [document.createTextNode((def.kinds ? st.kind : '事業で使っている') + '　'),
          el('button', { class: 'link', type: 'button', text: 'えらび直す', on: { click: stepKind } })]),
        asksLoan(st.kind) && st.loan === 'はい' ? el('button', { class: 'link', type: 'button', text: '住宅ローン控除の説明をもう一度見る', on: { click: stepNote } }) : null,
        m, main, el('label', { text: '割合の決め方' }), basis, more,
        el('div', { class: 'row' }, [
          el('button', { class: 'soft back', text: '一覧へ', on: { click: function () { ratioReview(); } } }),
          el('button', { text: '保存して次へ', on: { click: save } })])]))]);
    }
    !st.kind || st.kind === NONE || (preset != null && def.kinds) ? stepKind() : stepRatio();
  }
  function ratioReview() {
    var m = msgBox(), left = ratio.groups.filter(function (g) { return !ratio.saved[g.name]; }).length;
    function doSend(from) {
      api('ratioSave', { groups: {}, submit: true, from: from }, '送信しています').then(function () { home('送信しました。ありがとうございました。'); }).catch(fail(m));
    }
    var send = el('button', { text: 'この内容で送信する', on: { click: function () { ratio.resend ? askFrom(doSend) : doSend(''); } } });
    var rows = ratio.groups.map(function (def, i) {
      var a = ratio.saved[def.name], none = a && a.kind === ratio.none;
      var detail = !a || none ? null : el('p', { class: 'sub', text: [def.kinds ? a.kind : '', a.basis].filter(Boolean).join('・')
        + Object.keys(a.overrides || {}).map(function (k) { return '　' + k + 'だけ ' + a.overrides[k].percent + '％'; }).join('') });
      function put(g) {
        var groups = {}; groups[def.name] = g;
        api('ratioSave', { groups: groups }, '保存しています').then(function (r) { ratio.saved = r.saved; ratioReview(); }).catch(fail(m));
      }
      return entry('rg' + (a ? '' : ' todo'), def.short || def.name, !a ? 'まだ' : none ? '0％' : a.percent + '％', [
        { text: '0％', on: none, click: function () { put({ kind: ratio.none }); } },
        { text: '割合設定', on: a && !none && a.percent < 100, click: function () { ratioGroup(i); } },
        // 100％：種類（賃貸・持ち家）を聞くまとまりは、聞いてから保存する。聞かないまとまりは、その場で保存する
        { text: '100％', on: a && !none && a.percent === 100, click: function () { def.kinds ? ratioGroup(i, 100) : put({ kind: 'あり', percent: 100, basis: ratio.full }); } }], [detail]);
    });
    show([card([el('h1', { text: ratio.year + '年分　事業で使っている割合' }),
      el('div', { class: 'legend' }, [el('span', { text: '0％：事業では使っていない' }), el('span', { text: '割合設定：割合を決める' }), el('span', { text: '100％：全部を事業で使っている' })]), m]
      .concat(rows).concat([left ? null : send, left ? el('p', { class: 'sub', text: '全部が決まると、送信できます。' }) : null,
      el('button', { class: 'soft', text: 'はじめの画面へ', on: { click: function () { home(); } } })]))]);
  }
  // 送り直しのとき：使い方が変わったのは何月からかを聞く
  function askFrom(doSend) {
    var sel = el('select'), m = msgBox();
    sel.appendChild(el('option', { value: '', text: 'えらんでください' }));
    sel.appendChild(el('option', { value: 'start', text: '前の年から（年度のはじめから変わっていた）' }));
    for (var mo = 1; mo <= 12; mo++) sel.appendChild(el('option', { value: ratio.year + '-' + ('0' + mo).slice(-2), text: ratio.year + '年' + mo + '月から' }));
    show([card([el('h1', { text: '使い方が変わったのは、いつからですか' }),
      el('p', { class: 'sub', text: '前に送っていただいた割合は、その前の月までの分として残します。' }), m, sel,
      el('button', { text: '送信する', on: { click: function () {
        if (!sel.value) { m.textContent = 'いつからかを、えらんでください。'; m.hidden = false; return; }
        doSend(sel.value);
      } } }),
      el('button', { class: 'soft', text: '戻る', on: { click: function () { ratioReview(); } } })])]);
  }

  // ───── 経費の図解（上の「経費の図解」で、いつでも開く）。A4の1枚の形のまま、画面の幅に合わせて縮めて出す ─────
  function guide() {
    var g = texts.guide;
    if (!g || document.querySelector('.guide')) return;
    function ul(items, cls) { return el('ul', { class: cls }, items.map(function (t) { return el('li', { text: t }); })); }
    function ps(items) { return items.map(function (t) { return el('p', { text: t }); }); }
    var sheet = el('div', { class: 'sheet' }, [
      el('div', { class: 's-top' }, [el('img', { src: window.Q_LOGO || 'logo.png', alt: g.firm || '' }), el('span', { text: g.label || '' })]),
      el('h1', { text: g.title }), el('p', { class: 's-lead', text: g.lead }),
      el('div', { class: 's-row s-head' }, [el('div'), el('div', { class: 's-ok', text: '○ 入れてよい経費' }), el('div', { class: 's-ng', text: '× 入れてはいけない経費' })])
    ].concat(g.rows.map(function (r) {
      return el('div', { class: 's-row' }, [el('div', { class: 's-name', text: r.name }), ul(r.ok, 's-ok'), ul(r.ng, 's-ng')]);
    })).concat([
      el('p', { class: 's-note', text: g.note }),
      el('div', { class: 's-two' }, [
        el('div', { class: 's-box never' }, [el('h2', { text: 'どんな場合でも入れてはいけないもの' }), ul(g.never, 's-ng')]),
        el('div', { class: 's-box' }, [el('h2', { text: '税務調査で聞かれやすいもの' }), ul(g.asked, '')])]),
      el('div', { class: 's-tip' }, [el('h2', { text: '節税のコツ！' }), el('div', {}, ps(g.tip))]),
      el('div', { class: 's-warn' }, ps(g.warn))]));
    var holder = el('div', { class: 'holder' }, [sheet]);
    var close = el('button', { class: 'soft', type: 'button', text: 'とじる' });
    var zoom = el('button', { class: 'soft', type: 'button', text: '大きくする' });
    var box = el('div', { class: 'guide' }, [el('div', { class: 'row' }, [close, zoom]), holder]);
    var k = 0;   // いまの倍率（1000pxの紙に対して）
    function base() { return (box.clientWidth - 16) / 1000; }   // 画面の幅にちょうど入る倍率
    function setScale(next, cx, cy) {   // cx, cy：画面の上で動かしたくない点（指のまん中）。その点の下の絵がずれないようにする
      var min = base(), old = k || min;
      k = Math.max(min, Math.min(min * 6, next));
      sheet.style.transform = 'scale(' + k + ')';
      holder.style.width = Math.ceil(1000 * k) + 'px';
      holder.style.height = Math.ceil(sheet.offsetHeight * k) + 'px';
      if (cx != null) {
        box.scrollLeft = (box.scrollLeft + cx) * (k / old) - cx;
        box.scrollTop = (box.scrollTop + cy) * (k / old) - cy;
      }
      zoom.textContent = k > min * 1.05 ? '全体を見る' : '大きくする';
    }
    // 指2本で、好きな大きさに合わせる
    var pinch = null;
    function gap(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }
    box.addEventListener('touchstart', function (ev) { if (ev.touches.length === 2) pinch = { d: gap(ev.touches) || 1, k: k }; }, { passive: true });
    box.addEventListener('touchmove', function (ev) {
      if (!pinch || ev.touches.length !== 2) return;
      ev.preventDefault();   // 画面全体が動かないように、ここで受ける
      var r = box.getBoundingClientRect();
      setScale(pinch.k * gap(ev.touches) / pinch.d,
        (ev.touches[0].clientX + ev.touches[1].clientX) / 2 - r.left, (ev.touches[0].clientY + ev.touches[1].clientY) / 2 - r.top);
    }, { passive: false });
    box.addEventListener('touchend', function (ev) { if (ev.touches.length < 2) pinch = null; });
    function fit() { setScale(k && k > base() * 1.05 ? k : base()); }
    zoom.addEventListener('click', function () { setScale(k > base() * 1.05 ? base() : base() * 2.2, 0, 0); });
    close.addEventListener('click', function () { window.removeEventListener('resize', fit); box.remove(); });
    window.addEventListener('resize', fit);
    document.body.appendChild(box);
    setScale(base());
  }
  var gb = document.getElementById('guidebtn');
  if (gb) gb.addEventListener('click', guide);

  start();
})();
