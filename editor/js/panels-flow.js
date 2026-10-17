/* ============================================================
 * 编辑器面板：分支流程编辑器（节点列表 + 节点表单 + 流程图预览 + 关卡校验）
 * ============================================================ */
(function () {
  'use strict';
  var UI = window.UI, h = UI.h, esc = UI.esc;

  var FlowPanel = {
    render: function (box) {
      var P = App.project;
      box.appendChild(h('div', 'section-title', '分支流程配置'));

      // 关卡选择
      var levelOpts = Object.keys(P.levels).map(function (lid) {
        return { value: lid, label: P.levels[lid].name || lid };
      });
      var curLevelId = App.sel.type === 'level' ? App.sel.id
        : (App.sel.type === 'question' ? findLevelOfQuestion(App.sel.id) : null);
      if (!curLevelId || !P.levels[curLevelId]) curLevelId = levelOpts.length ? levelOpts[0].value : null;
      if (!curLevelId) {
        box.appendChild(h('div', 'card', '<p class="muted">还没有关卡，请先在“关卡与题目”中创建。</p>'));
        return;
      }
      var L = P.levels[curLevelId];

      var selCard = h('div', 'card');
      selCard.appendChild(UI.row([
        UI.field('选择要编辑流程的关卡', UI.sel(levelOpts, curLevelId, function (v) {
          App.sel = { type: 'level', id: v };
          App.renderTab();
        })),
        UI.field('入口节点', UI.nodeSelect(L.entry, function (v) { L.entry = v; App.markDirty(); App.renderTab(); }, '（未设置）'))
      ]));
      selCard.appendChild(h('p', 'muted',
        '💡 流程由节点串联而成。问题节点按“选项分支”跳转，其他节点按“后续节点”跳转。' +
        '“返回原题”节点会结束当前分支并回到触发它的题目。添加节点后，记得在上方选择入口或用“后续节点”把它接进流程。'));
      box.appendChild(selCard);

      var layout = h('div', 'flow-layout');

      /* ---------- 左：节点列表 ---------- */
      var left = h('div');
      left.appendChild(h('h3', null, '流程节点'));
      var nodes = flowOrder(P, L);
      var nodeList = h('div', 'node-list');
      nodes.forEach(function (n) {
        var t = (Schema.NODE_TYPES.find(function (x) { return x.type === n.type; }) || {});
        var item = h('div', 'node-item' + (App.sel.type === 'node' && App.sel.id === n.id ? ' sel' : ''));
        item.appendChild(h('span', 'nt nt-' + n.type, esc((t.label || n.type).slice(0, 2))));
        item.appendChild(h('span', 'grow', esc(nodeLabel(n)).slice(0, 26)));
        item.title = t.desc || '';
        item.onclick = function () {
          App.sel = { type: 'node', id: n.id };
          App.renderTab();
        };
        nodeList.appendChild(item);
      });
      if (!nodes.length) nodeList.appendChild(h('div', 'muted', '（空流程）'));
      left.appendChild(nodeList);

      var addRow = h('div', 'btn-row');
      Schema.NODE_TYPES.forEach(function (t) {
        addRow.appendChild(UI.btn('＋' + t.label.slice(0, 2), function () {
          var n = Schema.newNode(t.type);
          P.nodes[n.id] = n;
          // 自动接到入口或末尾
          if (!L.entry) { L.entry = n.id; }
          else {
            var tail = flowTail(P, L);
            if (tail && tail.type !== 'end' && !tail.next) tail.next = n.id;
            else if (!L.entry) L.entry = n.id;
          }
          App.sel = { type: 'node', id: n.id };
          App.markDirty(); App.renderTab();
        }));
      });
      left.appendChild(addRow);
      layout.appendChild(left);

      /* ---------- 右：节点表单 + 预览 + 校验 ---------- */
      var right = h('div');
      var node = App.sel.type === 'node' ? P.nodes[App.sel.id] : null;
      if (node) {
        right.appendChild(renderNodeForm(node, L));
      } else {
        right.appendChild(h('div', 'card', '<p class="muted">点击左侧节点进行编辑，或用上方按钮添加节点。</p>'));
      }

      // 流程图预览
      var prevCard = h('div', 'card');
      prevCard.appendChild(h('h3', null, '流程图预览'));
      var prev = h('div', 'flow-preview');
      prev.appendChild(buildFlowSvg(P, L));
      prevCard.appendChild(prev);
      prevCard.appendChild(h('div', 'flow-legend',
        '<span class="tag">点击图中节点可快速选中</span> · 箭头表示流程方向 · 虚线框表示问题节点的选项分支'));
      right.appendChild(prevCard);

      // 关卡校验
      var checkCard = h('div', 'card');
      checkCard.appendChild(h('h3', null, '本关分支检查'));
      var res = validateLevel(P, L);
      if (!res.errors.length && !res.warnings.length) {
        checkCard.appendChild(h('div', 'check-item ok', '<span>✓</span><span>未发现问题</span>'));
      }
      res.errors.concat(res.warnings).forEach(function (c) {
        checkCard.appendChild(h('div', 'check-item ' + (c.level === 'err' ? 'err' : 'warn'),
          '<span>' + (c.level === 'err' ? '✗' : '⚠') + '</span><span><span class="where">' + esc(c.where) + '：</span>' + esc(c.msg) + '</span>'));
      });
      checkCard.appendChild(h('p', 'muted', '完整检查（含素材、成就、API Key 等）请到“检查与导出”标签页。'));
      right.appendChild(checkCard);

      layout.appendChild(right);
      box.appendChild(layout);
    }
  };

  function nodeLabel(n) {
    if (n.type === 'question') {
      var Q = App.project.questions[n.questionId];
      return '问题：' + (Q ? (Q.text || '').slice(0, 16) : '(缺失)');
    }
    if (n.type === 'game') {
      var G = App.project.games[n.gameId];
      return '游戏：' + (G ? G.name : '(缺失)');
    }
    if (n.type === 'excerpt') {
      var m = (App.project.materials || []).find(function (x) { return x.id === n.materialId; });
      return '原文：' + (m ? m.title : '(缺失)');
    }
    return n.title || n.text || (Schema.NODE_TYPES.find(function (t) { return t.type === n.type; }) || {}).label || n.type;
  }

  /* BFS 流程顺序 */
  function flowOrder(P, L) {
    if (!L.entry) return [];
    var out = [], visited = {}, q = [L.entry];
    while (q.length) {
      var id = q.shift();
      if (visited[id]) continue;
      visited[id] = 1;
      var N = P.nodes[id];
      if (!N) continue;
      out.push(N);
      var outs = [];
      if (N.next) outs.push(N.next);
      if (N.type === 'question' && N.questionId) {
        (P.questions[N.questionId] || { options: [] }).options.forEach(function (o) { if (o.next) outs.push(o.next); });
      }
      if (N.type === 'jump' && N.jump && N.jump.targetType === 'node' && N.jump.targetId) outs.push(N.jump.targetId);
      outs.forEach(function (t) { if (!visited[t]) q.push(t); });
    }
    return out;
  }

  function flowTail(P, L) {
    var nodes = flowOrder(P, L);
    // 找最后一个没有后续的节点
    for (var i = nodes.length - 1; i >= 0; i--) {
      var N = nodes[i];
      var hasNext = N.next || N.type === 'end' || N.type === 'return' ||
        (N.type === 'jump' && N.jump && N.jump.targetType) ||
        (N.type === 'question' && (P.questions[N.questionId] || { options: [] }).options.some(function (o) { return o.next; }));
      if (!hasNext) return N;
    }
    return nodes[nodes.length - 1] || null;
  }

  function findLevelOfQuestion(qid) {
    var self = App;
    return Object.keys(App.project.levels).find(function (lid) {
      return Schema.levelQuestionIds(App.project, lid).indexOf(qid) >= 0;
    });
  }

  /* ---------- 节点表单 ---------- */
  function renderNodeForm(N, L) {
    var P = App.project;
    var card = h('div', 'card');
    var t = (Schema.NODE_TYPES.find(function (x) { return x.type === N.type; }) || {});
    card.appendChild(h('div', 'card-head',
      '<h3>节点：' + esc(t.label || N.type) + '</h3>' +
      '<span class="muted">' + esc(t.desc || '') + '</span>'));

    if (N.type !== 'return' && N.type !== 'end' && N.type !== 'jump') {
      card.appendChild(UI.row([
        UI.field('节点标题（可选，显示给学生）', UI.txt(N.title || '', function (v) { N.title = v; App.markDirty(); }))
      ]));
    }

    if (N.type === 'text' || N.type === 'hint') {
      card.appendChild(UI.field(N.type === 'hint' ? '提示内容' : '文字内容（支持换行）',
        UI.ta(N.text || '', function (v) { N.text = v; App.markDirty(); }, 4)));
    }
    if (N.type === 'text') {
      card.appendChild(UI.field('附加素材（可选）', UI.mediaList(N.media || [], function (v) { N.media = v; App.markDirty(); })));
    }
    if (N.type === 'excerpt') {
      var matOpts = (P.materials || []).map(function (m) {
        var k = (Schema.MATERIAL_KINDS.find(function (x) { return x.type === m.kind; }) || {}).label || m.kind;
        return { value: m.id, label: '[' + k + '] ' + (m.title || m.id) };
      });
      card.appendChild(UI.row([
        UI.field('引用材料', UI.sel([{ value: '', label: '（选择材料）' }].concat(matOpts), N.materialId || '', function (v) { N.materialId = v || null; App.markDirty(); App.renderTab(); }))
      ]));
      card.appendChild(UI.field('高亮关键词（逗号分隔）', UI.txt((N.keywords || []).join('，'), function (v) {
        N.keywords = v.split(/[，,]/).map(function (s) { return s.trim(); }).filter(Boolean);
        App.markDirty();
      })));
    }
    if (N.type === 'question') {
      var qOpts = Object.keys(P.questions).map(function (qid) {
        return { value: qid, label: (P.questions[qid].text || qid).slice(0, 24) };
      });
      card.appendChild(UI.field('选择题目', UI.sel([{ value: '', label: '（选择题目）' }].concat(qOpts), N.questionId || '', function (v) {
        N.questionId = v || null; App.markDirty(); App.renderTree(); App.renderTab();
      })));
      card.appendChild(UI.field('答对且无选项分支时的后续节点', UI.nodeSelect(N.next, function (v) { N.next = v; App.markDirty(); })));
      card.appendChild(h('p', 'muted', '💡 每个选项可以单独设置“选择后进入的节点”（在题目编辑器里配置），实现不同选项走不同分支。'));
    }
    if (N.type === 'image' || N.type === 'video' || N.type === 'audio') {
      var kind = N.type === 'image' ? 'image' : N.type === 'video' ? 'video' : 'audio';
      card.appendChild(UI.field('素材（' + (kind === 'image' ? '图片' : kind === 'video' ? '视频' : '音频') + '）',
        UI.mediaList(N.media || [], function (v) { N.media = v; App.markDirty(); }, kind)));
      card.appendChild(UI.field('说明文字（可选）', UI.txt(N.caption || '', function (v) { N.caption = v; App.markDirty(); })));
    }
    if (N.type === 'game') {
      var gOpts = Object.keys(P.games).map(function (gid) {
        return { value: gid, label: P.games[gid].name + '（' + P.games[gid].type + '）' };
      });
      card.appendChild(UI.field('选择小游戏', UI.sel([{ value: '', label: '（选择小游戏）' }].concat(gOpts), N.gameId || '', function (v) {
        N.gameId = v || null; App.markDirty(); App.renderTab();
      })));
      if (!gOpts.length) card.appendChild(h('p', 'muted', '还没有小游戏，请先到“小游戏”标签页创建。'));
    }
    if (N.type === 'reward') {
      card.appendChild(UI.row([
        UI.field('奖励经验值', UI.num(N.xp, function (v) { N.xp = v; App.markDirty(); })),
        UI.field('解锁成就（可选）', achievementSel(N.achievementId, function (v) { N.achievementId = v; App.markDirty(); }))
      ]));
    }
    if (N.type === 'api') {
      card.appendChild(UI.chk('使用全局 API 提示词（在“API 设置”中配置）', N.useGlobalPrompts !== false, function (v) {
        N.useGlobalPrompts = v; App.markDirty(); App.renderTab();
      }));
      if (!N.useGlobalPrompts) {
        card.appendChild(UI.field('系统提示词', UI.ta(N.systemPrompt || '', function (v) { N.systemPrompt = v; App.markDirty(); }, 3)));
        card.appendChild(UI.field('用户提示词模板（可用 {question}{answer}{reference}{criteria}）', UI.ta(N.userPromptTemplate || '', function (v) { N.userPromptTemplate = v; App.markDirty(); }, 3)));
      }
      card.appendChild(UI.row([
        UI.field('参考答案', UI.ta(N.reference || '', function (v) { N.reference = v; App.markDirty(); }, 2)),
        UI.field('评价标准', UI.ta(N.criteria || '', function (v) { N.criteria = v; App.markDirty(); }, 2))
      ]));
      card.appendChild(h('p', 'muted', '💡 该节点评价学生最近一次提交的开放题回答；API 失败时自动使用备用反馈。'));
    }
    if (N.type === 'jump') {
      var j = N.jump || (N.jump = { targetType: 'node', targetId: null });
      var tOpts = [
        { value: 'node', label: '节点' },
        { value: 'level', label: '关卡' },
        { value: 'question', label: '题目' },
        { value: 'home', label: '返回首页' },
        { value: 'report', label: '学习报告' },
        { value: 'end', label: '结束本关' }
      ];
      card.appendChild(UI.field('跳转类型', UI.sel(tOpts, j.targetType, function (v) {
        j.targetType = v; j.targetId = null; App.markDirty(); App.renderTab();
      })));
      if (j.targetType === 'node') {
        card.appendChild(UI.field('目标节点', UI.nodeSelect(j.targetId, function (v) { j.targetId = v; App.markDirty(); })));
      } else if (j.targetType === 'level') {
        card.appendChild(UI.field('目标关卡', levelSel(j.targetId, function (v) { j.targetId = v; App.markDirty(); })));
      } else if (j.targetType === 'question') {
        var qo = Object.keys(P.questions).map(function (qid) {
          return { value: qid, label: (P.questions[qid].text || qid).slice(0, 24) };
        });
        card.appendChild(UI.field('目标题目', UI.sel([{ value: '', label: '（选择题目）' }].concat(qo), j.targetId, function (v) { j.targetId = v; App.markDirty(); })));
      }
    }

    if (N.type !== 'return' && N.type !== 'end' && N.type !== 'jump' && N.type !== 'question') {
      card.appendChild(UI.field('后续节点（完成后进入）', UI.nodeSelect(N.next, function (v) { N.next = v; App.markDirty(); })));
    }

    var acts = h('div', 'btn-row');
    acts.appendChild(UI.btn('📋 复制节点', function () {
      var copy = JSON.parse(JSON.stringify(N));
      copy.id = Schema.uid('nd');
      P.nodes[copy.id] = copy;
      App.sel = { type: 'node', id: copy.id };
      App.markDirty(); App.renderTab();
    }));
    acts.appendChild(UI.btn('🗑️ 删除节点', function () {
      if (!confirm('删除该节点？引用它的跳转会失效。')) return;
      // 清理引用
      Object.keys(P.nodes).forEach(function (nid) {
        var M = P.nodes[nid];
        if (M.next === N.id) M.next = null;
        if (M.type === 'question' && M.questionId) {
          (P.questions[M.questionId].options || []).forEach(function (o) { if (o.next === N.id) o.next = null; });
        }
        if (M.type === 'jump' && M.jump && M.jump.targetId === N.id) M.jump.targetId = null;
      });
      if (L.entry === N.id) L.entry = null;
      delete P.nodes[N.id];
      App.sel = { type: 'level', id: L.id };
      App.markDirty(); App.renderTree(); App.renderTab();
    }, 'danger'));
    card.appendChild(acts);
    return card;
  }

  function levelSel(value, onChange) {
    var opts = Object.keys(App.project.levels).map(function (lid) {
      return { value: lid, label: App.project.levels[lid].name || lid };
    });
    return UI.sel([{ value: '', label: '（选择关卡）' }].concat(opts), value || '', function (v) { onChange(v || null); });
  }
  function achievementSel(value, onChange) {
    var opts = (App.project.achievements || []).map(function (a) {
      return { value: a.id, label: a.name || a.id };
    });
    return UI.sel([{ value: '', label: '（不解锁）' }].concat(opts), value || '', function (v) { onChange(v || null); });
  }
  UI.levelSel = levelSel;
  UI.achievementSel = achievementSel;

  /* ---------- 关卡级校验 ---------- */
  function validateLevel(P, L) {
    var errors = [], warnings = [];
    function err(w, m) { errors.push({ level: 'err', where: w, msg: m }); }
    function warn(w, m) { warnings.push({ level: 'warn', where: w, msg: m }); }
    if (!L.entry) { err('关卡', '未设置入口节点'); return { errors: errors, warnings: warnings }; }
    var nodes = flowOrder(P, L);
    var reach = {};
    nodes.forEach(function (n) { reach[n.id] = 1; });

    nodes.forEach(function (N) {
      var where = '节点「' + nodeLabel(N).slice(0, 14) + '」';
      if (N.next && !P.nodes[N.next]) err(where, '后续节点不存在');
      if (N.type === 'question') {
        var Q = P.questions[N.questionId];
        if (!Q) { err(where, '题目不存在'); return; }
        if (!N.next && !Q.options.some(function (o) { return o.next; })) {
          warn(where, '题目没有选项分支也没有后续节点，答对后将直接结束本关');
        }
        if (!Q.options.some(function (o) { return o.correct; })) err(where, '题目「' + (Q.text || '').slice(0, 8) + '」没有正确答案');
        if (!Q.hint) warn(where, '题目没有提示内容');
      }
      if (N.type === 'excerpt' && !N.materialId) err(where, '未选择要展示的材料');
      if ((N.type === 'image' || N.type === 'video' || N.type === 'audio') && !(N.media || []).length) err(where, '未选择素材');
      if (N.type === 'game' && !N.gameId) err(where, '未选择小游戏');
      if (N.type === 'jump') {
        var j = N.jump || {};
        if (j.targetType === 'node' && !P.nodes[j.targetId]) err(where, '跳转目标不存在');
        if (j.targetType === 'level' && !P.levels[j.targetId]) err(where, '跳转关卡不存在');
        if (j.targetType === 'question' && !P.questions[j.targetId]) err(where, '跳转题目不存在');
      }
      // 死路
      var hasExit = N.next || N.type === 'end' || N.type === 'return' ||
        (N.type === 'jump' && N.jump && N.jump.targetType) ||
        (N.type === 'question' && P.questions[N.questionId] && P.questions[N.questionId].options.some(function (o) { return o.next; }));
      if (!hasExit) err(where, '没有后续出口（死路）');
    });

    // 不可退出检测
    var canExit = {};
    (function compute() {
      var changed = true;
      while (changed) {
        changed = false;
        nodes.forEach(function (N) {
          if (canExit[N.id]) return;
          if (N.type === 'end' || N.type === 'return') { canExit[N.id] = 1; changed = true; return; }
          if (N.type === 'jump' && N.jump && ['level', 'home', 'report', 'end'].indexOf(N.jump.targetType) >= 0) { canExit[N.id] = 1; changed = true; return; }
          var outs = [];
          if (N.next) outs.push(N.next);
          if (N.type === 'question' && N.questionId) (P.questions[N.questionId].options || []).forEach(function (o) { if (o.next) outs.push(o.next); });
          if (N.type === 'jump' && N.jump && N.jump.targetType === 'node') outs.push(N.jump.targetId);
          for (var i = 0; i < outs.length; i++) {
            if (canExit[outs[i]]) { canExit[N.id] = 1; changed = true; break; }
          }
        });
      }
    })();
    nodes.forEach(function (N) {
      if (!canExit[N.id]) err('节点「' + nodeLabel(N).slice(0, 14) + '」', '无法退出本关流程（形成死循环，学生将无法继续）');
    });
    return { errors: errors, warnings: warnings };
  }
  FlowPanel.validateLevel = validateLevel;

  /* ---------- 流程图 SVG 预览 ---------- */
  function buildFlowSvg(P, L) {
    var nodes = flowOrder(P, L);
    if (!nodes.length) return h('div', 'muted', '（空流程，无预览）');
    // 分层：BFS 深度
    var depth = {}, q = [[L.entry, 0]];
    var maxD = 0;
    while (q.length) {
      var it = q.shift();
      var id = it[0], d = it[1];
      if (depth[id] !== undefined && depth[id] >= d) continue;
      depth[id] = d;
      if (d > maxD) maxD = d;
      var N = P.nodes[id];
      if (!N) continue;
      var outs = [];
      if (N.next) outs.push([N.next, 'solid']);
      if (N.type === 'question' && N.questionId) {
        (P.questions[N.questionId].options || []).forEach(function (o) { if (o.next) outs.push([o.next, 'dash']); });
      }
      if (N.type === 'jump' && N.jump && N.jump.targetType === 'node' && N.jump.targetId) outs.push([N.jump.targetId, 'solid']);
      outs.forEach(function (o) { q.push([o[0], d + 1]); });
    }
    var cols = {};
    Object.keys(depth).forEach(function (id) {
      var d = depth[id];
      (cols[d] = cols[d] || []).push(id);
    });
    var COL_W = 190, ROW_H = 64, PAD = 16;
    var width = (maxD + 1) * COL_W + PAD * 2;
    var rows = 0;
    Object.keys(cols).forEach(function (d) { rows = Math.max(rows, cols[d].length); });
    var height = rows * ROW_H + PAD * 2;
    var pos = {};
    Object.keys(cols).forEach(function (d) {
      cols[d].forEach(function (id, i) {
        pos[id] = { x: PAD + d * COL_W, y: PAD + i * ROW_H + 8 };
      });
    });

    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', Math.max(height, 120));
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + Math.max(height, 120));

    function line(x1, y1, x2, y2, dash) {
      var ln = document.createElementNS(NS, 'line');
      ln.setAttribute('x1', x1); ln.setAttribute('y1', y1);
      ln.setAttribute('x2', x2); ln.setAttribute('y2', y2);
      ln.setAttribute('stroke', dash ? '#e05c8a' : '#8aa3c7');
      ln.setAttribute('stroke-width', '1.6');
      if (dash) ln.setAttribute('stroke-dasharray', '5,4');
      svg.appendChild(ln);
      // 箭头
      var ang = Math.atan2(y2 - y1, x2 - x1);
      var ah = document.createElementNS(NS, 'polygon');
      var ax = x2, ay = y2;
      var p1 = (ax - 8 * Math.cos(ang - 0.4)) + ',' + (ay - 8 * Math.sin(ang - 0.4));
      var p2 = (ax - 8 * Math.cos(ang + 0.4)) + ',' + (ay - 8 * Math.sin(ang + 0.4));
      ah.setAttribute('points', ax + ',' + ay + ' ' + p1 + ' ' + p2);
      ah.setAttribute('fill', dash ? '#e05c8a' : '#8aa3c7');
      svg.appendChild(ah);
    }

    // 先画线
    Object.keys(depth).forEach(function (id) {
      var N = P.nodes[id];
      if (!N || !pos[id]) return;
      var outs = [];
      if (N.next) outs.push([N.next, false]);
      if (N.type === 'question' && N.questionId) {
        (P.questions[N.questionId].options || []).forEach(function (o) { if (o.next) outs.push([o.next, true]); });
      }
      if (N.type === 'jump' && N.jump && N.jump.targetType === 'node' && N.jump.targetId) outs.push([N.jump.targetId, false]);
      outs.forEach(function (o) {
        var t = pos[o[0]];
        if (!t) return;
        line(pos[id].x + 150, pos[id].y + 18, t.x, t.y + 18, o[1]);
      });
    });

    // 再画节点
    Object.keys(pos).forEach(function (id) {
      var N = P.nodes[id];
      if (!N) return;
      var g = document.createElementNS(NS, 'g');
      g.style.cursor = 'pointer';
      g.addEventListener('click', function () {
        App.sel = { type: 'node', id: id };
        App.renderTab();
      });
      var rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('x', pos[id].x); rect.setAttribute('y', pos[id].y);
      rect.setAttribute('width', 150); rect.setAttribute('height', 36);
      rect.setAttribute('rx', 8);
      var colors = {
        text: '#eef2f8', question: '#dbe8fb', hint: '#fdf3d7', excerpt: '#e3f4e9',
        image: '#f0e6fc', video: '#f0e6fc', audio: '#f0e6fc', game: '#fbe3ef',
        reward: '#fdead9', api: '#dff3f7', jump: '#e8ebf1', return: '#e8ebf1', end: '#fbe0e0'
      };
      rect.setAttribute('fill', colors[N.type] || '#eef2f8');
      rect.setAttribute('stroke', App.sel.type === 'node' && App.sel.id === id ? '#3b7ddd' : '#c4cfdd');
      rect.setAttribute('stroke-width', App.sel.type === 'node' && App.sel.id === id ? '2.5' : '1.2');
      g.appendChild(rect);
      var txt = document.createElementNS(NS, 'text');
      txt.setAttribute('x', pos[id].x + 8);
      txt.setAttribute('y', pos[id].y + 23);
      txt.setAttribute('font-size', '11.5');
      txt.setAttribute('fill', '#3a4763');
      var t = (Schema.NODE_TYPES.find(function (x) { return x.type === N.type; }) || {}).label || N.type;
      txt.textContent = '[' + t + '] ' + nodeLabel(N).slice(0, 10);
      g.appendChild(txt);
      svg.appendChild(g);
    });
    return svg;
  }

  App.panels.flow = FlowPanel;
})();
