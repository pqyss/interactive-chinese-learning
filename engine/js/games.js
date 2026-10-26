/* ============================================================
 * 三个可配置小游戏模板（与教材内容解耦）
 *  1. hotspot   森林线索大搜查
 *  2. order     故事顺序拼拼乐
 *  3. detective 帮野牛当侦探
 * mount(container, config, ctx)
 * ctx = { assetUrl(id), grantXp(n, reason), gotoNode(id), onComplete(result) }
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
  function shuffle(arr, seed) {
    var a = arr.slice();
    var s = seed || 12345;
    for (var i = a.length - 1; i > 0; i--) {
      s = (s * 9301 + 49297) % 233280;
      var j = Math.floor((s / 233280) * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  var Games = {};

  /* ================= 1. 森林线索大搜查 ================= */
  Games.hotspot = {
    mount: function (box, cfg, ctx) {
      var hotspots = (cfg.hotspots || []).filter(function (h) { return h && h.id; });
      var found = {};
      var missCount = 0;
      var hintAfter = Number(cfg.hintAfterMiss || 3);

      var title = el('div', 'game-title', esc(cfg.name || '森林线索大搜查'));
      box.appendChild(title);
      if (cfg.desc) box.appendChild(el('div', 'game-desc', esc(cfg.desc)));

      var stage = el('div', 'game-stage');
      var url = cfg.bgImage ? ctx.assetUrl(cfg.bgImage) : null;
      if (url) {
        var img = el('img', 'game-bg');
        img.src = url; img.alt = '搜索背景';
        stage.appendChild(img);
      } else {
        stage.appendChild(el('div', 'game-bg-missing', '（未设置背景图）'));
      }

      var bubble = el('div', 'game-bubble');
      bubble.innerHTML = esc(cfg.intro || '点击画面，找出隐藏的线索吧！');
      stage.appendChild(bubble);

      function unfound() { return hotspots.filter(function (h) { return !found[h.id]; }); }

      function checkComplete() {
        var need = cfg.requireAll ? hotspots.length : Math.max(1, Number(cfg.targetCount || 1));
        if (found_count() >= need) {
          var done = el('div', 'game-complete');
          done.innerHTML = '<div class="game-complete-emoji">🎉</div><div>' + esc(cfg.completeFeedback || '全部线索都找到啦！') + '</div>';
          stage.appendChild(done);
          ctx.grantXp(cfg.rewardXp || 0, '小游戏奖励');
          setTimeout(function () {
            ctx.onComplete({ cluesFound: found_count(), total: hotspots.length });
          }, 1200);
        }
      }
      function found_count() { return Object.keys(found).length; }

      hotspots.forEach(function (h) {
        var b = el('button', 'hotspot-btn');
        b.type = 'button';
        b.style.left = (h.x || 0) + '%';
        b.style.top = (h.y || 0) + '%';
        b.style.width = (h.w || 12) + '%';
        b.style.height = (h.h || 12) + '%';
        b.title = '？';
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          if (found[h.id]) return;
          found[h.id] = true;
          b.classList.add('found');
          b.innerHTML = '<span class="hotspot-check">✓</span>';
          bubble.innerHTML = '<b>' + esc(h.name || '线索') + '</b><br>' + esc(h.foundFeedback || cfg.foundFeedback || '找到了！');
          checkComplete();
        });
        stage.appendChild(b);
      });

      stage.addEventListener('click', function () {
        if (found_count() >= hotspots.length) return;
        missCount++;
        if (missCount >= hintAfter) {
          var uf = unfound();
          if (uf.length) {
            bubble.innerHTML = '🔍 小提示：' + esc(uf[0].hint || '再仔细看看画面~');
            missCount = 0;
            return;
          }
        }
        bubble.innerHTML = esc(cfg.missFeedback || '这里没有线索，再试试别的地方～');
      });

      box.appendChild(stage);
      return {};
    }
  };

  /* ================= 2. 故事顺序拼拼乐 ================= */
  Games.order = {
    mount: function (box, cfg, ctx) {
      var cards = (cfg.cards || []).filter(function (c) { return c && c.id; });
      var order = cfg.correctOrder && cfg.correctOrder.length === cards.length
        ? cfg.correctOrder.slice()
        : cards.map(function (c) { return c.id; });
      var items = shuffle(cards, cards.length * 7 + 13);
      var wrongTimes = 0;

      box.appendChild(el('div', 'game-title', esc(cfg.name || '故事顺序拼拼乐')));
      if (cfg.desc) box.appendChild(el('div', 'game-desc', esc(cfg.desc)));
      var tip = el('div', 'game-desc', '用 ↑ ↓ 调整卡片的顺序，排好后点“我排好了”。');
      box.appendChild(tip);

      var list = el('div', 'seq-list');
      function render() {
        list.innerHTML = '';
        items.forEach(function (c, i) {
          var row = el('div', 'seq-card');
          var no = el('span', 'seq-no', String(i + 1));
          row.appendChild(no);
          var url = c.image ? ctx.assetUrl(c.image) : null;
          if (url) { var im = el('img', 'seq-img'); im.src = url; row.appendChild(im); }
          row.appendChild(el('span', 'seq-text', esc(c.text)));
          var ctrl = el('div', 'seq-ctrl');
          var up = el('button', 'btn-mini', '↑'); up.type = 'button'; up.disabled = i === 0;
          up.addEventListener('click', function () { var t = items[i - 1]; items[i - 1] = items[i]; items[i] = t; render(); });
          var down = el('button', 'btn-mini', '↓'); down.type = 'button'; down.disabled = i === items.length - 1;
          down.addEventListener('click', function () { var t = items[i + 1]; items[i + 1] = items[i]; items[i] = t; render(); });
          ctrl.appendChild(up); ctrl.appendChild(down);
          row.appendChild(ctrl);
          list.appendChild(row);
        });
      }
      render();
      box.appendChild(list);

      var submit = el('button', 'btn-primary', '我排好了 ✓');
      submit.type = 'button';
      submit.addEventListener('click', function () {
        var ok = items.length === order.length && items.every(function (c, i) { return c.id === order[i]; });
        if (ok) {
          list.classList.add('seq-done');
          submit.disabled = true;
          box.appendChild(el('div', 'game-complete', '<div class="game-complete-emoji">🎉</div><div>' + esc(cfg.completeFeedback || '顺序完全正确！') + '</div>'));
          ctx.grantXp(cfg.rewardXp || 0, '小游戏奖励');
          setTimeout(function () { ctx.onComplete({}); }, 1200);
        } else {
          wrongTimes++;
          Player.toast(cfg.wrongHint || '顺序还不对哦，再读一读故事，调整一下试试！');
        }
      });
      box.appendChild(submit);
      return {};
    }
  };

  /* ================= 3. 帮野牛当侦探 ================= */
  Games.detective = {
    mount: function (box, cfg, ctx) {
      box.appendChild(el('div', 'game-title', esc(cfg.name || '帮野牛当侦探')));
      if (cfg.intro) box.appendChild(el('div', 'game-desc', esc(cfg.intro)));
      var scene = el('div', 'detective-scene');
      scene.appendChild(el('div', 'detective-buffalo', '🐃'));
      scene.appendChild(el('div', 'detective-scenario', esc(cfg.scenario || '')));
      box.appendChild(scene);

      var options = (cfg.options || []).filter(function (o) { return o && o.id; });
      var chosen = null;

      var optBox = el('div', 'detective-options');
      options.forEach(function (o) {
        var b = el('button', 'detective-option', esc(o.text));
        b.type = 'button';
        b.addEventListener('click', function () {
          if (chosen) return;
          chosen = o;
          Array.prototype.forEach.call(optBox.children, function (c) { c.disabled = true; });
          b.classList.add('chosen');
          var panel = el('div', 'detective-result');
          panel.innerHTML = '<div class="detective-result-title">' + esc(o.result || '结果') + '</div>' +
            (o.explanation ? '<div class="detective-result-exp">' + esc(o.explanation) + '</div>' : '');
          box.appendChild(panel);
          if (o.next) {
            var go = el('button', 'btn-primary', '继续 ▶');
            go.type = 'button';
            go.addEventListener('click', function () { ctx.gotoNode(o.next); });
            box.appendChild(go);
          } else {
            ctx.grantXp(cfg.rewardXp || 0, '小游戏奖励');
            var done = el('button', 'btn-primary', '完成 ✓');
            done.type = 'button';
            done.addEventListener('click', function () {
              ctx.onComplete({ optionId: o.id });
            });
            box.appendChild(done);
          }
        });
        optBox.appendChild(b);
      });
      box.appendChild(optBox);
      return {};
    }
  };

  window.Games = Games;
})();
