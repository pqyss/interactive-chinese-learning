/* ============================================================
 * 编辑器面板：素材 / 小游戏 / 成就与经验 / API / 检查与导出
 * ============================================================ */
(function () {
  'use strict';
  var UI = window.UI, h = UI.h, esc = UI.esc;

  /* ==================== 素材管理 ==================== */
  var AssetsPanel = {
    render: function (box) {
      var P = App.project;
      box.appendChild(h('div', 'section-title', '素材管理（图片 / 视频 / 音频）'));
      box.appendChild(h('p', 'muted',
        '所有上传的素材都会保存在浏览器本地（IndexedDB），并随“导出项目配置”或“导出完整网页”一起打包。' +
        '素材不会依赖编辑器临时文件。视频建议压缩到较小体积，避免项目文件过大。'));

      var up = h('div', 'upload-zone', '📤 点击或拖拽文件到此处上传<br><span class="muted">支持 JPG / PNG / WebP / GIF / MP4 / WebM / MP3 / WAV</span>');
      var inp = h('input');
      inp.type = 'file'; inp.multiple = true; inp.style.display = 'none';
      inp.accept = 'image/*,video/*,audio/*';
      inp.onchange = function () { handleFiles(inp.files); inp.value = ''; };
      up.onclick = function () { inp.click(); };
      up.ondragover = function (e) { e.preventDefault(); up.style.borderColor = '#3b7ddd'; };
      up.ondragleave = function () { up.style.borderColor = ''; };
      up.ondrop = function (e) {
        e.preventDefault(); up.style.borderColor = '';
        handleFiles(e.dataTransfer.files);
      };
      box.appendChild(up);
      box.appendChild(inp);

      function handleFiles(files) {
        var chain = Promise.resolve();
        Array.from(files).forEach(function (f) {
          chain = chain.then(function () { return App.uploadAsset(f); }).catch(function (e) {
            App.notice('上传失败：' + e.message, 'err');
          });
        });
        chain.then(function () { App.renderTab(); });
      }

      // 统计
      var ids = Object.keys(P.assets);
      var counts = { image: 0, video: 0, audio: 0 };
      ids.forEach(function (id) { if (counts[P.assets[id].kind] !== undefined) counts[P.assets[id].kind]++; });
      var stat = h('div', 'card');
      stat.innerHTML = '<div class="kv">共 <b>' + ids.length + '</b> 个素材：图片 <b>' + counts.image +
        '</b> · 视频 <b>' + counts.video + '</b> · 音频 <b>' + counts.audio + '</b>。素材可在题目、分支、小游戏、成就中重复使用。</div>';
      box.appendChild(stat);

      var grid = h('div', 'asset-grid');
      ids.forEach(function (id) {
        var a = P.assets[id];
        var card = h('div', 'asset-card');
        var url = App._assetUrls[id];
        if (a.kind === 'image' && url) {
          var im = h('img'); im.src = url; im.alt = a.name; card.appendChild(im);
        } else if (a.kind === 'video' && url) {
          var v = h('video'); v.src = url; v.muted = true; v.preload = 'metadata'; card.appendChild(v);
        } else {
          card.appendChild(h('div', 'asset-card', '<div style="height:90px;display:flex;align-items:center;justify-content:center;font-size:34px;background:#f0f3f8;border-radius:6px">' + (a.kind === 'audio' ? '🎵' : '📦') + '</div>'));
        }
        card.appendChild(h('div', 'a-name', esc(a.name)));
        var usage = usageCount(id);
        card.appendChild(h('div', 'a-meta', esc(a.kind) + ' · ' + fmtSize(a.size) + ' · 引用 ' + usage + ' 处'));
        var note = h('input');
        note.type = 'text'; note.placeholder = '备注/用途'; note.value = a.note || '';
        note.addEventListener('input', function () { a.note = note.value; App.markDirty(); });
        card.appendChild(note);
        var acts = h('div', 'a-actions');
        acts.appendChild(UI.btn('替换', function () {
          var inp2 = h('input'); inp2.type = 'file';
          inp2.onchange = function () {
            if (!inp2.files[0]) return;
            App.uploadAsset(inp2.files[0]).then(function (meta) {
              a.note = (a.note || '') + '（由 ' + meta.name + ' 替换）';
              App.markDirty(); App.renderTab();
              App.notice('已上传新素材「' + meta.name + '」，请在题目中改用它', 'ok');
            });
          };
          inp2.click();
        }));
        acts.appendChild(UI.btn('删除', function () {
          if (!confirm('删除素材「' + a.name + '」？引用它的位置将显示为缺失。')) return;
          delete P.assets[id];
          DB.deleteAsset(id);
          App.markDirty(); App.renderTab();
        }, 'danger'));
        card.appendChild(acts);
        grid.appendChild(card);
      });
      if (!ids.length) grid.appendChild(h('div', 'muted', '还没有素材。'));
      box.appendChild(grid);
    }
  };

  function usageCount(id) {
    var s = JSON.stringify(App.project);
    return s.split('"' + id + '"').length - 1;
  }
  function fmtSize(n) {
    if (!n) return '未知大小';
    if (n < 1024) return n + 'B';
    if (n < 1048576) return (n / 1024).toFixed(1) + 'KB';
    return (n / 1048576).toFixed(1) + 'MB';
  }

  /* ==================== 小游戏 ==================== */
  var GamesPanel = {
    render: function (box) {
      var P = App.project;
      box.appendChild(h('div', 'section-title', '小游戏配置（玩法由框架提供，文字与素材由你填写）'));
      var layout = h('div', 'flow-layout');

      var left = h('div');
      left.appendChild(h('h3', null, '小游戏列表'));
      var list = h('div', 'list');
      Object.keys(P.games).forEach(function (gid) {
        var G = P.games[gid];
        var t = (Schema.GAME_TYPES.find(function (x) { return x.type === G.type; }) || {}).label || G.type;
        var item = h('div', 'list-item' + (App.sel.type === 'game' && App.sel.id === gid ? ' sel' : ''));
        item.appendChild(h('span', 'grow', '<div class="title">🎮 ' + esc(G.name) + '</div><div class="sub">' + esc(t) + '</div>'));
        item.appendChild(h('div', 'actions', UI.btn('删除', function () {
          if (!confirm('删除小游戏「' + G.name + '」？')) return;
          delete P.games[gid];
          App.markDirty(); App.renderTab();
        }, 'danger')));
        item.onclick = function (e) {
          if (e.target.tagName === 'BUTTON') return;
          App.sel = { type: 'game', id: gid }; App.renderTab();
        };
        list.appendChild(item);
      });
      left.appendChild(list);
      var addRow = h('div', 'btn-row');
      Schema.GAME_TYPES.forEach(function (t) {
        addRow.appendChild(UI.btn('＋ ' + t.label.slice(0, 6), function () {
          var G = Schema.newGame(t.type);
          P.games[G.id] = G;
          App.sel = { type: 'game', id: G.id };
          App.markDirty(); App.renderTab();
        }));
      });
      left.appendChild(addRow);
      layout.appendChild(left);

      var right = h('div');
      var G = App.sel.type === 'game' ? P.games[App.sel.id] : null;
      if (!G) {
        right.appendChild(h('div', 'card', '<p class="muted">在左侧选择小游戏进行编辑，或点击上方按钮新建。</p>'));
      } else if (G.type === 'hotspot') {
        right.appendChild(renderHotspotForm(G));
      } else if (G.type === 'order') {
        right.appendChild(renderOrderGameForm(G));
      } else if (G.type === 'detective') {
        right.appendChild(renderDetectiveForm(G));
      }
      layout.appendChild(right);
      box.appendChild(layout);
    }
  };

  function renderHotspotForm(G) {
    var cfg = G.config;
    var card = h('div', 'card');
    card.appendChild(h('h3', null, '🔍 森林线索大搜查'));
    card.appendChild(UI.row([
      UI.field('游戏名称', UI.txt(G.name, function (v) { G.name = v; App.markDirty(); })),
      UI.field('游戏说明', UI.txt(G.desc || '', function (v) { G.desc = v; App.markDirty(); }))
    ]));
    card.appendChild(UI.row([
      UI.field('背景图', UI.assetPicker('image', cfg.bgImage, function (v) { cfg.bgImage = v; App.markDirty(); })),
      UI.field('完成条件', UI.sel([
        { value: 'all', label: '找到全部热点' },
        { value: 'count', label: '找到指定数量' }
      ], cfg.requireAll ? 'all' : 'count', function (v) {
        cfg.requireAll = v === 'all'; App.markDirty(); App.renderTab();
      }))
    ]));
    if (!cfg.requireAll) {
      card.appendChild(UI.row([UI.field('需要找到的热点数量', UI.num(cfg.targetCount || 1, function (v) { cfg.targetCount = v; App.markDirty(); }))]));
    }
    card.appendChild(UI.row([
      UI.field('找对反馈（默认）', UI.txt(cfg.foundFeedback || '', function (v) { cfg.foundFeedback = v; App.markDirty(); })),
      UI.field('找错反馈', UI.txt(cfg.missFeedback || '', function (v) { cfg.missFeedback = v; App.markDirty(); }))
    ]));
    card.appendChild(UI.row([
      UI.field('完成反馈', UI.txt(cfg.completeFeedback || '', function (v) { cfg.completeFeedback = v; App.markDirty(); })),
      UI.field('奖励经验值', UI.num(cfg.rewardXp, function (v) { cfg.rewardXp = v; App.markDirty(); })),
      UI.field('连续找错几次后给提示', UI.num(cfg.hintAfterMiss || 3, function (v) { cfg.hintAfterMiss = v; App.markDirty(); }))
    ]));

    card.appendChild(h('h3', null, '热点列表（坐标为背景图百分比）'));
    var list = h('div', 'list');
    (cfg.hotspots || []).forEach(function (hs, i) {
      var item = h('div', 'list-item');
      item.style.flexWrap = 'wrap';
      item.appendChild(h('span', null, '<b>' + (i + 1) + '.</b>'));
      item.appendChild(UI.field('名称', UI.txt(hs.name, function (v) { hs.name = v; App.markDirty(); })));
      item.appendChild(UI.field('提示', UI.txt(hs.hint || '', function (v) { hs.hint = v; App.markDirty(); })));
      item.appendChild(UI.field('找到后的反馈', UI.txt(hs.foundFeedback || '', function (v) { hs.foundFeedback = v; App.markDirty(); })));
      item.appendChild(UI.field('X%', UI.num(hs.x, function (v) { hs.x = v; App.markDirty(); })));
      item.appendChild(UI.field('Y%', UI.num(hs.y, function (v) { hs.y = v; App.markDirty(); })));
      item.appendChild(UI.field('宽%', UI.num(hs.w, function (v) { hs.w = v; App.markDirty(); })));
      item.appendChild(UI.field('高%', UI.num(hs.h, function (v) { hs.h = v; App.markDirty(); })));
      item.appendChild(h('div', 'actions', UI.btn('删除', function () {
        cfg.hotspots.splice(i, 1); App.markDirty(); App.renderTab();
      }, 'danger')));
      list.appendChild(item);
    });
    card.appendChild(list);
    card.appendChild(h('div', 'btn-row', UI.btn('＋ 添加热点', function () {
      cfg.hotspots.push({ id: Schema.uid('hs'), name: '新线索', hint: '', foundFeedback: '', x: 20, y: 20, w: 14, h: 14 });
      App.markDirty(); App.renderTab();
    })));
    return card;
  }

  function renderOrderGameForm(G) {
    var cfg = G.config;
    var card = h('div', 'card');
    card.appendChild(h('h3', null, '🧩 故事顺序拼拼乐'));
    card.appendChild(UI.row([
      UI.field('游戏名称', UI.txt(G.name, function (v) { G.name = v; App.markDirty(); })),
      UI.field('游戏说明', UI.txt(G.desc || '', function (v) { G.desc = v; App.markDirty(); }))
    ]));
    card.appendChild(h('h3', null, '排序卡片（下方“正确顺序”决定胜利条件）'));
    var list = h('div', 'list');
    (cfg.cards || []).forEach(function (c, i) {
      var item = h('div', 'list-item');
      item.style.flexWrap = 'wrap';
      item.appendChild(UI.field('卡片文字', UI.txt(c.text, function (v) { c.text = v; App.markDirty(); })));
      item.appendChild(UI.field('卡片配图（可选）', UI.assetPicker('image', c.image, function (v) { c.image = v; App.markDirty(); })));
      item.appendChild(h('div', 'actions', UI.btn('删除', function () {
        cfg.cards.splice(i, 1);
        cfg.correctOrder = cfg.correctOrder.filter(function (x) { return x !== c.id; });
        App.markDirty(); App.renderTab();
      }, 'danger')));
      list.appendChild(item);
    });
    card.appendChild(list);
    card.appendChild(h('div', 'btn-row', UI.btn('＋ 添加卡片', function () {
      var c = { id: Schema.uid('cd'), text: '', image: null };
      cfg.cards.push(c);
      if (cfg.correctOrder.length !== cfg.cards.length - 1) cfg.correctOrder = [];
      cfg.correctOrder.push(c.id);
      App.markDirty(); App.renderTab();
    })));

    card.appendChild(h('h3', null, '正确顺序（用 ↑↓ 调整）'));
    var orderList = h('div', 'list');
    function renderOrder() {
      orderList.innerHTML = '';
      var order = cfg.correctOrder.length === cfg.cards.length ? cfg.correctOrder : cfg.cards.map(function (c) { return c.id; });
      cfg.correctOrder = order;
      order.forEach(function (cid, i) {
        var c = cfg.cards.find(function (x) { return x.id === cid; });
        if (!c) return;
        var item = h('div', 'list-item');
        item.appendChild(h('span', null, '<b>' + (i + 1) + '.</b>'));
        item.appendChild(h('span', 'grow', esc(c.text || ('卡片' + (i + 1)))));
        item.appendChild(h('div', 'actions',
          UI.btn('↑', function () {
            if (!i) return;
            order.splice(i - 1, 0, order.splice(i, 1)[0]);
            App.markDirty(); renderOrder();
          }),
          UI.btn('↓', function () {
            if (i >= order.length - 1) return;
            order.splice(i + 1, 0, order.splice(i, 1)[0]);
            App.markDirty(); renderOrder();
          })));
        orderList.appendChild(item);
      });
    }
    renderOrder();
    card.appendChild(orderList);
    card.appendChild(UI.row([
      UI.field('排序错误提示', UI.txt(cfg.wrongHint || '', function (v) { cfg.wrongHint = v; App.markDirty(); })),
      UI.field('完成反馈', UI.txt(cfg.completeFeedback || '', function (v) { cfg.completeFeedback = v; App.markDirty(); })),
      UI.field('奖励经验值', UI.num(cfg.rewardXp, function (v) { cfg.rewardXp = v; App.markDirty(); }))
    ]));
    return card;
  }

  function renderDetectiveForm(G) {
    var cfg = G.config;
    var card = h('div', 'card');
    card.appendChild(h('h3', null, '🐃 帮野牛当侦探'));
    card.appendChild(UI.row([
      UI.field('游戏名称', UI.txt(G.name, function (v) { G.name = v; App.markDirty(); })),
      UI.field('开场白', UI.txt(cfg.intro || '', function (v) { cfg.intro = v; App.markDirty(); }))
    ]));
    card.appendChild(UI.field('情境描述', UI.ta(cfg.scenario || '', function (v) { cfg.scenario = v; App.markDirty(); }, 3)));
    card.appendChild(UI.row([
      UI.field('奖励经验值', UI.num(cfg.rewardXp, function (v) { cfg.rewardXp = v; App.markDirty(); })),
      UI.field('完成时解锁成就（可选）', UI.achievementSel(cfg.achievementId, function (v) { cfg.achievementId = v; App.markDirty(); }))
    ]));
    card.appendChild(h('h3', null, '行动选项'));
    var list = h('div', 'list');
    (cfg.options || []).forEach(function (o, i) {
      var item = h('div', 'list-item');
      item.style.flexWrap = 'wrap';
      var main = h('div', 'grow');
      main.appendChild(UI.row([
        UI.field('选项文字', UI.txt(o.text, function (v) { o.text = v; App.markDirty(); })),
        UI.field('结果标题', UI.txt(o.result || '', function (v) { o.result = v; App.markDirty(); }))
      ]));
      main.appendChild(UI.row([
        UI.field('解释说明', UI.ta(o.explanation || '', function (v) { o.explanation = v; App.markDirty(); }, 2)),
        UI.field('后续分支（选择后跳转到节点，留空则完成小游戏）', UI.nodeSelect(o.next, function (v) { o.next = v; App.markDirty(); }))
      ]));
      item.appendChild(main);
      item.appendChild(h('div', 'actions', UI.btn('删除', function () {
        cfg.options.splice(i, 1); App.markDirty(); App.renderTab();
      }, 'danger')));
      list.appendChild(item);
    });
    card.appendChild(list);
    card.appendChild(h('div', 'btn-row', UI.btn('＋ 添加选项', function () {
      cfg.options.push({ id: Schema.uid('op'), text: '', result: '', explanation: '', next: null });
      App.markDirty(); App.renderTab();
    })));
    return card;
  }

  /* ==================== 成就与经验 ==================== */
  var AchPanel = {
    render: function (box) {
      var P = App.project;
      box.appendChild(h('div', 'section-title', '成就与经验值系统'));
      var layout = h('div', 'flow-layout');

      var left = h('div');
      left.appendChild(h('h3', null, '成就列表'));
      var list = h('div', 'list');
      (P.achievements || []).forEach(function (a) {
        var item = h('div', 'list-item' + (App.sel.type === 'ach' && App.sel.id === a.id ? ' sel' : ''));
        item.appendChild(h('span', 'grow', '<div class="title">' + esc(a.iconEmoji || '🏅') + ' ' + esc(a.name) +
          (a.hidden ? ' <span class="tag">隐藏</span>' : '') + (a.repeatable ? ' <span class="tag">可重复</span>' : '') + '</div>' +
          '<div class="sub">+' + (a.xp || 0) + ' 经验 · ' + esc(condLabel(a.condition)) + '</div>'));
        item.appendChild(h('div', 'actions', UI.btn('删除', function () {
          if (!confirm('删除成就「' + a.name + '」？')) return;
          P.achievements = P.achievements.filter(function (x) { return x.id !== a.id; });
          App.markDirty(); App.renderTab();
        }, 'danger')));
        item.onclick = function (e) {
          if (e.target.tagName === 'BUTTON') return;
          App.sel = { type: 'ach', id: a.id }; App.renderTab();
        };
        list.appendChild(item);
      });
      left.appendChild(list);
      left.appendChild(h('div', 'btn-row', UI.btn('＋ 新建成就', function () {
        var a = Schema.newAchievement();
        P.achievements.push(a);
        App.sel = { type: 'ach', id: a.id };
        App.markDirty(); App.renderTab();
      })));
      layout.appendChild(left);

      var right = h('div');
      var a = App.sel.type === 'ach' ? (P.achievements || []).find(function (x) { return x.id === App.sel.id; }) : null;
      if (a) right.appendChild(renderAchForm(a));
      else right.appendChild(h('div', 'card', '<p class="muted">选择或新建一个成就进行配置。</p>'));

      // 经验值规则
      var xpCard = h('div', 'card');
      xpCard.appendChild(h('h3', null, '⚡ 经验值规则（防刷取：每项只按规则发放一次，记录保存在学生浏览器本地）'));
      var r1 = h('div', 'frm-row');
      r1.appendChild(UI.field('首次答对', UI.num(P.xpRules.firstCorrect, function (v) { P.xpRules.firstCorrect = v; App.markDirty(); })));
      r1.appendChild(UI.field('提示后答对', UI.num(P.xpRules.hintCorrect, function (v) { P.xpRules.hintCorrect = v; App.markDirty(); })));
      r1.appendChild(UI.field('完成小游戏', UI.num(P.xpRules.gameComplete, function (v) { P.xpRules.gameComplete = v; App.markDirty(); })));
      r1.appendChild(UI.field('完成开放题', UI.num(P.xpRules.openComplete, function (v) { P.xpRules.openComplete = v; App.markDirty(); })));
      r1.appendChild(UI.field('查看材料', UI.num(P.xpRules.materialView, function (v) { P.xpRules.materialView = v; App.markDirty(); })));
      r1.appendChild(UI.field('完成关卡', UI.num(P.xpRules.levelComplete, function (v) { P.xpRules.levelComplete = v; App.markDirty(); })));
      xpCard.appendChild(r1);
      right.appendChild(xpCard);

      // 通用反馈模板
      var fbCard = h('div', 'card');
      fbCard.appendChild(h('h3', null, '💬 通用备用反馈'));
      fbCard.appendChild(UI.field('开放题默认反馈（未设置参考答案和 API 时使用）', UI.ta(P.feedback.openDefault, function (v) { P.feedback.openDefault = v; App.markDirty(); }, 2)));
      fbCard.appendChild(UI.field('API 不可用时的备用反馈', UI.ta(P.feedback.apiFail, function (v) { P.feedback.apiFail = v; App.markDirty(); }, 2)));
      right.appendChild(fbCard);

      layout.appendChild(right);
      box.appendChild(layout);
    }
  };

  function condLabel(cond) {
    if (!cond || !cond.type) return '未设置条件';
    var t = Schema.CONDITION_TYPES.find(function (x) { return x.type === cond.type; });
    var label = t ? t.label : cond.type;
    if (cond.type === 'gameCompleted') {
      var G = App.project.games[cond.gameId];
      return label + '：' + (G ? G.name : '(缺失)');
    }
    if (cond.type === 'eggCompleted') {
      var L = App.project.levels[cond.levelId];
      return label + '：' + (L ? L.name : '(缺失)');
    }
    if (cond.type === 'all' || cond.type === 'any') {
      return label + '（' + (cond.children || []).length + ' 项）';
    }
    return label + ' ' + (cond.count || 1) + (t ? t.unit : '');
  }

  function renderAchForm(a) {
    var card = h('div', 'card');
    card.appendChild(h('h3', null, '成就配置'));
    card.appendChild(UI.row([
      UI.field('成就名称', UI.txt(a.name, function (v) { a.name = v; App.markDirty(); })),
      UI.field('图标 Emoji', UI.txt(a.iconEmoji || '🏅', function (v) { a.iconEmoji = v; App.markDirty(); })),
      UI.field('图标图片（可选，优先于 Emoji）', UI.assetPicker('image', a.icon, function (v) { a.icon = v; App.markDirty(); }))
    ]));
    card.appendChild(UI.field('成就描述', UI.txt(a.desc || '', function (v) { a.desc = v; App.markDirty(); })));
    var flags = h('div', 'frm-row');
    flags.appendChild(UI.field('选项', UI.chk('隐藏成就（未解锁时显示为问号）', a.hidden, function (v) { a.hidden = v; App.markDirty(); })));
    flags.appendChild(UI.field('　', UI.chk('允许重复获得', a.repeatable, function (v) { a.repeatable = v; App.markDirty(); })));
    flags.appendChild(UI.field('奖励经验值', UI.num(a.xp, function (v) { a.xp = v; App.markDirty(); })));
    card.appendChild(flags);
    card.appendChild(UI.field('解锁提示语', UI.txt(a.unlockedTip || '', function (v) { a.unlockedTip = v; App.markDirty(); })));
    card.appendChild(h('h3', null, '解锁条件'));
    card.appendChild(renderConditionBuilder(a.condition, function (c) { a.condition = c; App.markDirty(); App.renderTab(); }, true));
    return card;
  }

  function renderConditionBuilder(cond, onChange, isRoot) {
    var wrap = h('div', 'condition-builder');
    wrap.style.cssText = 'border:1px solid var(--line);border-radius:8px;padding:10px;background:#fbfcfe';
    function render() {
      wrap.innerHTML = '';
      var opts = Schema.CONDITION_TYPES.map(function (t) { return { value: t.type, label: t.label }; });
      wrap.appendChild(UI.field('条件类型', UI.sel(opts, cond.type, function (v) {
        var nc = { type: v };
        if (v === 'gameCompleted') nc.gameId = null;
        if (v === 'eggCompleted') nc.levelId = null;
        if (v === 'all' || v === 'any') nc.children = [];
        else nc.count = 1;
        onChange(nc);
      })));
      if (cond.type === 'gameCompleted') {
        var gOpts = Object.keys(App.project.games).map(function (gid) { return { value: gid, label: App.project.games[gid].name }; });
        wrap.appendChild(UI.field('小游戏', UI.sel([{ value: '', label: '（选择）' }].concat(gOpts), cond.gameId || '', function (v) { cond.gameId = v || null; App.markDirty(); })));
      } else if (cond.type === 'eggCompleted') {
        var lOpts = Object.keys(App.project.levels).filter(function (lid) { return App.project.levels[lid].isEgg; })
          .map(function (lid) { return { value: lid, label: App.project.levels[lid].name }; });
        if (!lOpts.length) lOpts = [{ value: '', label: '（还没有彩蛋关卡，请在关卡设置中勾选“彩蛋关卡”）' }];
        wrap.appendChild(UI.field('彩蛋关卡', UI.sel(lOpts, cond.levelId || '', function (v) { cond.levelId = v || null; App.markDirty(); })));
      } else if (cond.type === 'all' || cond.type === 'any') {
        wrap.appendChild(h('div', 'muted', '组合条件：同时满足 / 满足其一'));
        (cond.children || []).forEach(function (ch, i) {
          var row = h('div', 'frm-row');
          row.style.alignItems = 'flex-start';
          var sub = renderConditionBuilder(ch, function (nc) { cond.children[i] = nc; App.markDirty(); App.renderTab(); }, false);
          sub.style.flex = '1';
          row.appendChild(sub);
          row.appendChild(h('div', 'actions', '<button class="btn danger small" type="button" style="margin-top:18px">移除</button>'));
          row.querySelector('button').onclick = function () {
            cond.children.splice(i, 1); App.markDirty(); App.renderTab();
          };
          wrap.appendChild(row);
        });
        var addRow = h('div', 'btn-row');
        Schema.CONDITION_TYPES.filter(function (t) { return t.type !== 'all' && t.type !== 'any'; }).forEach(function (t) {
          addRow.appendChild(UI.btn('＋ ' + t.label.slice(0, 6), function () {
            var nc = { type: t.type };
            if (t.type === 'gameCompleted') nc.gameId = null;
            else if (t.type === 'eggCompleted') nc.levelId = null;
            else nc.count = 1;
            cond.children = cond.children || [];
            cond.children.push(nc);
            App.markDirty(); App.renderTab();
          }));
        });
        wrap.appendChild(addRow);
      } else {
        wrap.appendChild(UI.field('阈值', UI.num(cond.count, function (v) { cond.count = v; App.markDirty(); })));
      }
    }
    render();
    return wrap;
  }

  /* ==================== API 设置 ==================== */
  var ApiPanel = {
    render: function (box) {
      var P = App.project;
      box.appendChild(h('div', 'section-title', 'API 主观题评价设置'));
      box.appendChild(h('div', 'card', '<h3>🔐 安全提示</h3>' +
        '<p>1. <b>API Key 只保存在当前浏览器本地</b>（localStorage），不会写入项目文件，导出时也绝不打包 Key。<br>' +
        '2. 浏览器直接调用第三方 API 时，Key 理论上可能被技术人员看到。正式环境建议自建代理转发请求。<br>' +
        '3. 没有 API Key 时，所有本地题目、分支、小游戏、成就和报告都<b>完整可用</b>，开放题使用你设置的备用反馈。</p>'));

      var card = h('div', 'card');
      card.appendChild(h('h3', null, '接口配置（随项目导出，不含 Key）'));
      card.appendChild(UI.row([
        UI.field('API 服务地址（OpenAI 兼容，如 https://api.openai.com/v1/chat/completions）', UI.txt(P.api.endpoint, function (v) { P.api.endpoint = v; App.markDirty(); })),
        UI.field('模型名称', UI.txt(P.api.model, function (v) { P.api.model = v; App.markDirty(); }))
      ]));
      card.appendChild(UI.row([
        UI.field('请求超时（秒）', UI.num(P.api.timeout, function (v) { P.api.timeout = v; App.markDirty(); }))
      ]));
      box.appendChild(card);

      var pCard = h('div', 'card');
      pCard.appendChild(h('h3', null, '提示词与评价规则（完全由你填写）'));
      pCard.appendChild(UI.field('系统提示词', UI.ta(P.api.systemPrompt, function (v) { P.api.systemPrompt = v; App.markDirty(); }, 4)));
      pCard.appendChild(UI.field('用户提示词模板（可用占位符：{question} 题目 / {answer} 学生回答 / {reference} 参考答案 / {criteria} 评价标准）',
        UI.ta(P.api.userPromptTemplate, function (v) { P.api.userPromptTemplate = v; App.markDirty(); }, 5)));
      pCard.appendChild(UI.field('输出格式要求', UI.ta(P.api.outputFormat, function (v) { P.api.outputFormat = v; App.markDirty(); }, 2)));
      pCard.appendChild(UI.field('API 不可用时的备用反馈', UI.ta(P.api.fallback, function (v) { P.api.fallback = v; App.markDirty(); }, 2)));
      box.appendChild(pCard);

      var kCard = h('div', 'card');
      kCard.appendChild(h('h3', null, '本机 API Key（仅当前浏览器，不随项目导出）'));
      var keyInput = h('input');
      keyInput.type = 'password';
      keyInput.value = localStorage.getItem('lls_setting_api_key') || '';
      keyInput.placeholder = 'sk-...';
      keyInput.addEventListener('input', function () {
        try { localStorage.setItem('lls_setting_api_key', keyInput.value.trim()); } catch (e) {}
      });
      kCard.appendChild(UI.field('API Key', keyInput));
      kCard.appendChild(h('p', 'muted', '保存在本机浏览器 localStorage 中；清除浏览器数据或点击下方“清除 Key”后会消失。'));
      var kRow = h('div', 'btn-row');
      var testBtn = UI.btn('🧪 发送测试请求', function () {
        testBtn.disabled = true;
        testBtn.textContent = '请求中…';
        var resultBox = document.getElementById('api-test-result');
        resultBox.innerHTML = '';
        ApiKitTest(function (ok, msg) {
          testBtn.disabled = false;
          testBtn.textContent = '🧪 发送测试请求';
          resultBox.innerHTML = '<div class="check-item ' + (ok ? 'ok' : 'err') + '"><span>' + (ok ? '✓' : '✗') + '</span><span>' + esc(msg) + '</span></div>';
        });
      });
      kRow.appendChild(testBtn);
      kRow.appendChild(UI.btn('🧹 清除本机 Key', function () {
        if (!confirm('清除本机保存的 API Key？')) return;
        try { localStorage.removeItem('lls_setting_api_key'); } catch (e) {}
        keyInput.value = '';
        App.notice('已清除本机 API Key', 'ok');
      }, 'danger'));
      kCard.appendChild(kRow);
      var kResult = h('div', '');
      kResult.id = 'api-test-result';
      kCard.appendChild(kResult);
      box.appendChild(kCard);
    }
  };

  function ApiKitTest(done) {
    var P = App.project;
    var key = localStorage.getItem('lls_setting_api_key') || '';
    if (!P.api.endpoint) { done(false, '请先填写 API 服务地址'); return; }
    if (!key) { done(false, '请先填写 API Key（仅本机保存）'); return; }
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, (Number(P.api.timeout) || 15) * 1000);
    fetch(P.api.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({
        model: P.api.model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: P.api.systemPrompt || '你是一位小学语文老师。' },
          { role: 'user', content: '请回复"连接成功"四个字。' }
        ]
      }),
      signal: ctrl.signal
    }).then(function (res) {
      clearTimeout(timer);
      if (!res.ok) { done(false, 'HTTP ' + res.status + '：请检查地址、Key 和模型名称'); return; }
      return res.json().then(function (j) {
        var t = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
        if (t) done(true, '连接成功，模型返回：' + t.slice(0, 50));
        else done(false, '返回格式无法解析（未找到 choices[0].message.content）');
      });
    }).catch(function (e) {
      clearTimeout(timer);
      done(false, '请求失败：' + (e && e.name === 'AbortError' ? '超时' : (e && e.message || '网络错误')));
    });
  }

  /* ==================== 检查与导出 ==================== */
  var CheckPanel = {
    render: function (box) {
      var P = App.project;
      box.appendChild(h('div', 'section-title', '项目信息'));

      var info = h('div', 'card');
      info.appendChild(h('h3', null, '基本信息'));
      info.appendChild(UI.row([
        UI.field('项目标题', UI.txt(P.meta.title, function (v) { P.meta.title = v; App.markDirty(); App.softRefresh(); })),
        UI.field('副标题', UI.txt(P.meta.subtitle, function (v) { P.meta.subtitle = v; App.markDirty(); }))
      ]));
      info.appendChild(UI.row([
        UI.field('作者', UI.txt(P.meta.author, function (v) { P.meta.author = v; App.markDirty(); })),
        UI.field('首页描述', UI.txt(P.meta.description, function (v) { P.meta.description = v; App.markDirty(); }))
      ]));
      info.appendChild(UI.row([
        UI.field('报告页附加复习建议（可选）', UI.txt(P.meta.reviewTip || '', function (v) { P.meta.reviewTip = v; App.markDirty(); })),
        UI.field('学生页顶部展示的课文原文', materialMainSel(P.mainTextMaterialId, function (v) { P.mainTextMaterialId = v; App.markDirty(); }))
      ]));
      var themeRow = h('div', 'frm-row');
      themeRow.appendChild(UI.field('主题色', UI.txt(P.theme.primary, function (v) { P.theme.primary = v; App.markDirty(); })));
      themeRow.appendChild(UI.field('强调色', UI.txt(P.theme.accent, function (v) { P.theme.accent = v; App.markDirty(); })));
      themeRow.appendChild(UI.field('背景色', UI.txt(P.theme.bg, function (v) { P.theme.bg = v; App.markDirty(); })));
      info.appendChild(themeRow);
      var acts = h('div', 'btn-row');
      acts.appendChild(UI.btn('📥 载入示例项目（演示数据）', function () { loadDemo(); }));
      acts.appendChild(UI.btn('🗑️ 新建空白项目', function () {
        if (!confirm('新建空白项目？当前项目内容会被覆盖（建议先导出备份）。')) return;
        App.project = Schema.emptyProject();
        App.saveNow(false).then(function () {
          App.renderTree(); App.select({ type: 'stage', id: null }); App.renderTab();
          App.notice('已新建空白项目', 'ok');
        });
      }));
      info.appendChild(acts);
      box.appendChild(info);

      // 统计
      var stat = h('div', 'card');
      var qCount = Object.keys(P.questions).length;
      var nCount = Object.keys(P.nodes).length;
      stat.innerHTML = '<h3>内容统计</h3><div class="kv">' +
        '阶段 <b>' + P.stages.length + '</b> · 关卡 <b>' + Object.keys(P.levels).length + '</b> · ' +
        '流程节点 <b>' + nCount + '</b> · 题目 <b>' + qCount + '</b> · ' +
        '材料 <b>' + (P.materials || []).length + '</b> · 小游戏 <b>' + Object.keys(P.games).length + '</b> · ' +
        '成就 <b>' + (P.achievements || []).length + '</b> · 素材 <b>' + Object.keys(P.assets).length + '</b>' +
        '</div>';
      box.appendChild(stat);

      // 检查
      var check = h('div', 'card');
      check.appendChild(h('h3', null, '导出前检查'));
      var resultBox = h('div', '');
      resultBox.id = 'check-result';
      check.appendChild(resultBox);
      var btnRow = h('div', 'btn-row');
      btnRow.appendChild(UI.btn('🔍 立即检查', function () { renderChecks(); }));
      check.appendChild(btnRow);
      box.appendChild(check);

      function renderChecks() {
        resultBox.innerHTML = '<p class="muted">检查中…</p>';
        Exporter.runChecks().then(function (res) {
          var html = '';
          if (!res.errors.length && !res.warnings.length) {
            html += '<div class="check-item ok"><span>✓</span><span>全部检查通过，可以导出。</span></div>';
          }
          res.errors.forEach(function (e) {
            html += '<div class="check-item err"><span>✗</span><span><span class="where">' + esc(e.where) + '：</span>' + esc(e.msg) + '</span></div>';
          });
          res.warnings.forEach(function (w) {
            html += '<div class="check-item warn"><span>⚠</span><span><span class="where">' + esc(w.where) + '：</span>' + esc(w.msg) + '</span></div>';
          });
          resultBox.innerHTML = html;
        }).catch(function (e) {
          resultBox.innerHTML = '<div class="check-item err"><span>✗</span><span>检查失败：' + esc(e && e.message || e) + '</span></div>';
        });
      }
      renderChecks();

      // 导出
      var exp = h('div', 'card');
      exp.appendChild(h('h3', null, '导出'));
      exp.appendChild(h('p', 'muted',
        '<b>导出项目配置（JSON）</b>：包含全部文字内容与素材（以内嵌数据形式），用于备份和继续编辑，可重新导入本编辑器。<br>' +
        '<b>导出完整网页（ZIP）</b>：包含学生运行网页、互动引擎、全部素材文件和使用说明，解压后即可交给老师/学生使用，无需编辑器和网络。'));
      var eRow = h('div', 'btn-row');
      eRow.appendChild(UI.btn('📄 导出项目配置（JSON）', function () { Exporter.projectJSON(); }));
      eRow.appendChild(UI.btn('📦 导出完整网页（ZIP）', function () { Exporter.fullWeb(); }, 'primary'));
      exp.appendChild(eRow);
      var expLog = h('div', '');
      expLog.id = 'export-log';
      exp.appendChild(expLog);
      box.appendChild(exp);
    }
  };

  function materialMainSel(value, onChange) {
    var opts = [{ value: '', label: '（自动选择第一个教材原文）' }];
    (App.project.materials || []).forEach(function (m) {
      var k = (Schema.MATERIAL_KINDS.find(function (x) { return x.type === m.kind; }) || {}).label || m.kind;
      opts.push({ value: m.id, label: '[' + k + '] ' + (m.title || m.id) });
    });
    return UI.sel(opts, value || '', function (v) { onChange(v || null); });
  }

  function loadDemo() {
    if (!confirm('载入示例项目？当前项目会被示例内容覆盖（建议先导出备份）。')) return;
    fetch('../examples/demo-project.json').then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (data) {
      App.applyImportedProject(Schema.migrate(data), data);
      App.notice('示例项目已载入', 'ok');
    }).catch(function (e) {
      App.notice('载入示例失败：' + e.message + '（请通过本地服务器打开编辑器）', 'err');
    });
  }
  window.loadDemoProject = loadDemo;

  function softRefresh2() { }
  App.panels.assets = AssetsPanel;
  App.panels.games = GamesPanel;
  App.panels.achievements = AchPanel;
  App.panels.api = ApiPanel;
  App.panels.check = CheckPanel;
})();
