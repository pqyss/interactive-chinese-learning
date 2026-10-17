/* ============================================================
 * 题型渲染器：单选/多选/判断/填空/开放/排序/配对/图片点选
 * 每个渲染器 mount(container, Q, ctx) 返回 { getValue() }
 * ctx = { assetUrl(id), onSubmit(value) }
 * ============================================================ */
(function () {
  'use strict';

  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html !== undefined && html !== null) d.innerHTML = html;
    return d;
  }
  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------- 公共片段 ---------- */
  function mediaStrip(Q, ctx) {
    var wrap = el('div', 'q-media');
    (Q.media || []).forEach(function (aid) {
      var url = ctx.assetUrl(aid);
      if (!url) return;
      var a = Store.project.assets[aid];
      if (!a) return;
      if (a.kind === 'image') wrap.appendChild(el('img', 'q-media-img', '')).src = url;
      else if (a.kind === 'video') {
        var v = el('video', 'q-media-video');
        v.controls = true; v.preload = 'metadata'; v.src = url;
        wrap.appendChild(v);
      } else if (a.kind === 'audio') {
        var au = el('audio', 'q-media-audio');
        au.controls = true; au.src = url;
        wrap.appendChild(au);
      }
    });
    return wrap.children.length ? wrap : null;
  }

  function optionMedia(o, ctx) {
    var wrap = el('div', 'op-media');
    (o.media || []).forEach(function (aid) {
      var url = ctx.assetUrl(aid);
      var a = Store.project.assets[aid];
      if (!url || !a) return;
      if (a.kind === 'image') { var im = el('img'); im.src = url; im.alt = o.text || ''; wrap.appendChild(im); }
    });
    return wrap.children.length ? wrap : null;
  }

  /* ---------- 各题型 ---------- */
  var Renderers = {};

  Renderers.single = {
    mount: function (box, Q, ctx) {
      var submitted = false;
      Q.options.forEach(function (o) {
        var b = el('button', 'opt-card opt-single');
        b.type = 'button';
        b.innerHTML = '<span class="opt-label">' + esc(o.text) + '</span>';
        var m = optionMedia(o, ctx); if (m) b.appendChild(m);
        b.addEventListener('click', function () {
          if (submitted) return;
          submitted = true;
          ctx.onSubmit(o.id);
        });
        box.appendChild(b);
      });
      return { getValue: function () { return null; } };
    }
  };

  Renderers.judge = {
    mount: function (box, Q, ctx) {
      var submitted = false;
      var row = el('div', 'judge-row');
      Q.options.forEach(function (o) {
        var b = el('button', 'judge-btn ' + (o.text === '正确' || o.correct ? 'judge-yes' : 'judge-no'));
        b.type = 'button';
        b.innerHTML = '<span class="judge-icon">' + (o.text === '错误' && !o.correct ? '✗' : '✓') + '</span><span>' + esc(o.text) + '</span>';
        b.addEventListener('click', function () {
          if (submitted) return;
          submitted = true;
          ctx.onSubmit(o.id);
        });
        row.appendChild(b);
      });
      box.appendChild(row);
      return { getValue: function () { return null; } };
    }
  };

  Renderers.multi = {
    mount: function (box, Q, ctx) {
      var picked = {};
      var cards = [];
      Q.options.forEach(function (o) {
        var b = el('button', 'opt-card opt-multi');
        b.type = 'button';
        b.innerHTML = '<span class="opt-check">☐</span><span class="opt-label">' + esc(o.text) + '</span>';
        var m = optionMedia(o, ctx); if (m) b.appendChild(m);
        b.addEventListener('click', function () {
          picked[o.id] = !picked[o.id];
          b.classList.toggle('picked', picked[o.id]);
          b.querySelector('.opt-check').textContent = picked[o.id] ? '☑' : '☐';
        });
        cards.push(b);
        box.appendChild(b);
      });
      var submit = el('button', 'btn-primary btn-submit', '提交答案');
      submit.type = 'button';
      submit.addEventListener('click', function () {
        var ids = Object.keys(picked).filter(function (k) { return picked[k]; });
        if (!ids.length) { Player.toast('先选择一个答案吧'); return; }
        ctx.onSubmit(ids);
      });
      box.appendChild(submit);
      return {
        getValue: function () {
          return Object.keys(picked).filter(function (k) { return picked[k]; });
        }
      };
    }
  };

  Renderers.fill = {
    mount: function (box, Q, ctx) {
      var wrap = el('div', 'fill-wrap');
      var inp = el('input', 'fill-input');
      inp.type = 'text';
      inp.placeholder = '在这里输入答案';
      inp.setAttribute('autocomplete', 'off');
      wrap.appendChild(inp);
      var submit = el('button', 'btn-primary btn-submit', '提交答案');
      submit.type = 'button';
      function go() { if (inp.value.trim()) ctx.onSubmit(inp.value.trim()); else Player.toast('先填写答案吧'); }
      submit.addEventListener('click', go);
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
      wrap.appendChild(submit);
      box.appendChild(wrap);
      setTimeout(function () { inp.focus(); }, 50);
      return { getValue: function () { return inp.value.trim(); } };
    }
  };

  Renderers.open = {
    mount: function (box, Q, ctx) {
      var wrap = el('div', 'open-wrap');
      var ta = el('textarea', 'open-input');
      ta.rows = 4;
      ta.placeholder = '把你的想法写在这里，可以写几句话～';
      wrap.appendChild(ta);
      var submit = el('button', 'btn-primary btn-submit', '提交回答');
      submit.type = 'button';
      submit.addEventListener('click', function () {
        if (ta.value.trim()) ctx.onSubmit(ta.value.trim());
        else Player.toast('先写一点内容吧');
      });
      wrap.appendChild(submit);
      box.appendChild(wrap);
      setTimeout(function () { ta.focus(); }, 50);
      return { getValue: function () { return ta.value.trim(); } };
    }
  };

  Renderers.order = {
    mount: function (box, Q, ctx) {
      var items = Q.options.slice();
      var list = el('div', 'order-list');
      function render() {
        list.innerHTML = '';
        items.forEach(function (o, i) {
          var row = el('div', 'order-item');
          row.innerHTML = '<span class="order-no">' + (i + 1) + '</span>';
          var url = (o.media || []).map(function (a) { return ctx.assetUrl(a); }).filter(Boolean)[0];
          if (url) { var im = el('img', 'order-img'); im.src = url; row.appendChild(im); }
          row.appendChild(el('span', 'order-text', esc(o.text)));
          var ctrl = el('div', 'order-ctrl');
          var up = el('button', 'btn-mini', '↑'); up.type = 'button';
          up.disabled = i === 0;
          up.addEventListener('click', function () {
            var t = items[i - 1]; items[i - 1] = items[i]; items[i] = t; render();
          });
          var down = el('button', 'btn-mini', '↓'); down.type = 'button';
          down.disabled = i === items.length - 1;
          down.addEventListener('click', function () {
            var t = items[i + 1]; items[i + 1] = items[i]; items[i] = t; render();
          });
          ctrl.appendChild(up); ctrl.appendChild(down);
          row.appendChild(ctrl);
          list.appendChild(row);
        });
      }
      render();
      box.appendChild(list);
      var submit = el('button', 'btn-primary btn-submit', '我排好了');
      submit.type = 'button';
      submit.addEventListener('click', function () {
        ctx.onSubmit(items.map(function (o) { return o.id; }));
      });
      box.appendChild(submit);
      return { getValue: function () { return items.map(function (o) { return o.id; }); } };
    }
  };

  Renderers.match = {
    mount: function (box, Q, ctx) {
      var lefts = Q.options.filter(function (o) { return o.side === 'L'; });
      var rights = Q.options.filter(function (o) { return o.side === 'R'; });
      var pairs = {};       // leftId -> rightId
      var selLeft = null;
      var rightBtns = {}, leftBtns = {};
      var wrap = el('div', 'match-wrap');
      var colL = el('div', 'match-col'), colR = el('div', 'match-col');
      function paint(leftId) {
        var rid = pairs[leftId];
        if (leftBtns[leftId]) leftBtns[leftId].classList.toggle('paired', !!rid);
        if (rid && rightBtns[rid]) rightBtns[rid].classList.toggle('paired', true);
      }
      lefts.forEach(function (o) {
        var b = el('button', 'match-item', esc(o.text));
        b.type = 'button';
        b.addEventListener('click', function () {
          if (pairs[o.id]) { delete pairs[o.id]; paint(o.id); if (rightBtns[pairs[o.id]]) rightBtns[pairs[o.id]].classList.remove('paired'); return; }
          selLeft = o.id;
          Object.keys(leftBtns).forEach(function (k) { leftBtns[k].classList.remove('sel'); });
          b.classList.add('sel');
        });
        leftBtns[o.id] = b; colL.appendChild(b);
      });
      rights.forEach(function (o) {
        var b = el('button', 'match-item', esc(o.text));
        b.type = 'button';
        b.addEventListener('click', function () {
          if (!selLeft) { Player.toast('先点左边的一项，再点右边配对'); return; }
          // 右侧已被占用则解绑旧左侧
          Object.keys(pairs).forEach(function (lk) { if (pairs[lk] === o.id) delete pairs[lk]; });
          pairs[selLeft] = o.id;
          paint(selLeft);
          selLeft = null;
          Object.keys(leftBtns).forEach(function (k) { leftBtns[k].classList.remove('sel'); });
        });
        rightBtns[o.id] = b; colR.appendChild(b);
      });
      wrap.appendChild(colL); wrap.appendChild(colR);
      box.appendChild(wrap);
      var submit = el('button', 'btn-primary btn-submit', '提交答案');
      submit.type = 'button';
      submit.addEventListener('click', function () {
        if (Object.keys(pairs).length < lefts.length) { Player.toast('还有没有配对的项哦'); return; }
        ctx.onSubmit(pairs);
      });
      box.appendChild(submit);
      return { getValue: function () { return pairs; } };
    }
  };

  Renderers.clickimg = {
    mount: function (box, Q, ctx) {
      var url = (Q.media || []).map(function (a) { return ctx.assetUrl(a); }).filter(Boolean)[0];
      var stage = el('div', 'click-stage');
      if (url) {
        var img = el('img', 'click-img');
        img.src = url; img.alt = Q.text || '';
        stage.appendChild(img);
      } else {
        stage.appendChild(el('div', 'click-missing', '（未设置图片素材）'));
      }
      var submitted = false;
      Q.options.forEach(function (o, idx) {
        if (!o.region) return;
        var r = o.region;
        var b = el('button', 'click-region');
        b.type = 'button';
        b.style.left = (r.x || 0) + '%';
        b.style.top = (r.y || 0) + '%';
        b.style.width = (r.w || 10) + '%';
        b.style.height = (r.h || 10) + '%';
        b.title = o.text || ('区域' + (idx + 1));
        b.innerHTML = '<span class="click-pin">' + (idx + 1) + '</span>';
        b.addEventListener('click', function () {
          if (submitted) return;
          submitted = true;
          ctx.onSubmit(o.id);
        });
        stage.appendChild(b);
      });
      box.appendChild(stage);
      return { getValue: function () { return null; } };
    }
  };

  /* ---------- 判定 ---------- */
  function normalizeFill(s) {
    return String(s || '').trim().toLowerCase()
      .replace(/[\s，。！？、；：""''《》(),.!?;:"'·~～-]/g, '');
  }
  Renderers.evaluate = function (Q, value) {
    switch (Q.type) {
      case 'single':
      case 'judge':
      case 'clickimg': {
        var o = (Q.options || []).find(function (x) { return x.id === value; });
        return { correct: !!(o && o.correct) };
      }
      case 'multi': {
        var picked = Array.isArray(value) ? value.slice().sort() : [];
        var correctIds = (Q.options || []).filter(function (x) { return x.correct; })
          .map(function (x) { return x.id; }).sort();
        return { correct: picked.length === correctIds.length && picked.every(function (v, i) { return v === correctIds[i]; }) };
      }
      case 'fill': {
        var ans = (Q.answers || []).map(normalizeFill).filter(Boolean);
        return { correct: ans.indexOf(normalizeFill(value)) >= 0 };
      }
      case 'order': {
        var cur = Array.isArray(value) ? value : [];
        var right = (Q.options || []).map(function (x) { return x.id; });
        return { correct: cur.length === right.length && cur.every(function (v, i) { return v === right[i]; }) };
      }
      case 'match': {
        var byKey = {};
        (Q.options || []).forEach(function (o) { byKey[o.id] = o.pairKey; });
        var ok = Object.keys(value || {}).length > 0;
        Object.keys(value || {}).forEach(function (lk) {
          if (byKey[lk] !== byKey[value[lk]]) ok = false;
        });
        // 必须左右都配对
        var leftCount = (Q.options || []).filter(function (o) { return o.side === 'L'; }).length;
        if (Object.keys(value || {}).length !== leftCount) ok = false;
        return { correct: ok };
      }
      case 'open':
        return { correct: null };
      default:
        return { correct: false };
    }
  };

  Renderers.mediaStrip = mediaStrip;

  window.QuestionRenderers = Renderers;
})();
