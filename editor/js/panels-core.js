/* ============================================================
 * 编辑器面板：阶段 / 关卡 / 题目 / 教学材料
 * ============================================================ */
(function () {
  'use strict';
  var UI = window.UI, h = UI.h, esc = UI.esc;

  function softRefresh() { App.renderTree(); document.getElementById('proj-name').textContent = App.project.meta.title || '未命名项目'; }

  /* ==================== 关卡与题目 ==================== */
  var LevelsPanel = {
    render: function (box) {
      var sel = App.sel;
      if (sel.type === 'question') { renderQuestionForm(box); return; }
      if (sel.type === 'level') { renderLevelForm(box); return; }
      renderStagePanel(box);
    }
  };

  function renderStagePanel(box) {
    var P = App.project;
    var stg = App.currentStage();
    box.appendChild(h('div', 'section-title', '阶段管理'));
    if (!stg) {
      box.appendChild(h('div', 'card', '<p class="muted">还没有阶段。点击左侧“＋ 阶段”创建一个。</p>'));
      return;
    }
    var card = h('div', 'card');
    card.appendChild(h('h3', null, '阶段信息'));
    card.appendChild(UI.row([
      UI.field('阶段名称', UI.txt(stg.name, function (v) { stg.name = v; App.markDirty(); softRefresh(); })),
      UI.field('阶段简介（显示在首页）', UI.txt(stg.desc || '', function (v) { stg.desc = v; App.markDirty(); }))
    ]));
    box.appendChild(card);

    // 阶段列表（排序/删除）
    var listCard = h('div', 'card');
    listCard.appendChild(h('div', 'card-head', '<h3>全部阶段（' + P.stages.length + '）</h3>'));
    var list = h('div', 'list');
    P.stages.forEach(function (s, i) {
      var item = h('div', 'list-item' + (s.id === stg.id ? ' sel' : ''));
      item.appendChild(h('span', 'grow', '<div class="title">📁 ' + esc(s.name || '未命名') + '</div><div class="sub">' + (s.levels || []).length + ' 个关卡</div>'));
      var acts = h('div', 'actions');
      acts.appendChild(UI.btn('↑', function () {
        if (i === 0) return;
        P.stages.splice(i - 1, 0, P.stages.splice(i, 1)[0]);
        App.markDirty(); App.renderTree(); App.renderTab();
      }));
      acts.appendChild(UI.btn('↓', function () {
        if (i >= P.stages.length - 1) return;
        P.stages.splice(i + 1, 0, P.stages.splice(i, 1)[0]);
        App.markDirty(); App.renderTree(); App.renderTab();
      }));
      acts.appendChild(UI.btn('编辑', function () { App.select({ type: 'stage', id: s.id }); }));
      acts.appendChild(UI.btn('删除', function () {
        if (!confirm('删除阶段「' + (s.name || '') + '」及其全部关卡？')) return;
        P.stages.splice(i, 1);
        App.markDirty(); App.renderTree(); App.renderTab();
      }, 'danger'));
      item.appendChild(acts);
      list.appendChild(item);
    });
    listCard.appendChild(list);
    listCard.appendChild(h('div', 'btn-row', UI.btn('＋ 在本阶段后添加关卡', function () { App.addLevel(stg); })));
    box.appendChild(listCard);
  }

  function renderLevelForm(box) {
    var P = App.project;
    var L = App.project.levels[App.sel.id];
    if (!L) { box.appendChild(h('div', 'card', '<p class="muted">关卡不存在。</p>')); return; }

    var card = h('div', 'card');
    card.appendChild(h('div', 'card-head', '<h3>🎯 关卡设置</h3>'));
    card.appendChild(UI.row([
      UI.field('关卡名称', UI.txt(L.name, function (v) { L.name = v; App.markDirty(); softRefresh(); })),
      UI.field('学习目标', UI.txt(L.goals || '', function (v) { L.goals = v; App.markDirty(); }))
    ]));
    card.appendChild(UI.row([
      UI.field('关卡介绍（显示在首页卡片）', UI.txt(L.intro || '', function (v) { L.intro = v; App.markDirty(); }))
    ]));
    card.appendChild(UI.row([
      UI.field('关卡开始提示（进入关卡时弹出）', UI.ta(L.startTip || '', function (v) { L.startTip = v; App.markDirty(); }, 2)),
      UI.field('关卡完成提示', UI.ta(L.completeTip || '', function (v) { L.completeTip = v; App.markDirty(); }, 2))
    ]));
    card.appendChild(UI.row([
      UI.field('关卡背景图（可选）', UI.assetPicker('image', L.bgImage, function (v) { L.bgImage = v; App.markDirty(); })),
      UI.field('入口节点（流程起点）', UI.nodeSelect(L.entry, function (v) { L.entry = v; App.markDirty(); }, '（未设置）'))
    ]));
    var flags = h('div', 'frm-row');
    flags.appendChild(UI.field('选项', UI.chk('参与成绩统计', L.countInScore !== false, function (v) { L.countInScore = v; App.markDirty(); })));
    flags.appendChild(UI.field('　', UI.chk('选做内容', L.optional, function (v) { L.optional = v; App.markDirty(); softRefresh(); })));
    flags.appendChild(UI.field('　', UI.chk('彩蛋关卡', L.isEgg, function (v) { L.isEgg = v; App.markDirty(); softRefresh(); })));
    card.appendChild(flags);

    // 完成后的去向
    var nextTypes = [
      { value: '', label: '完成后返回首页' },
      { value: 'level', label: '进入指定关卡' },
      { value: 'report', label: '打开学习报告' },
      { value: 'end', label: '结束（停留完成页）' }
    ];
    var nrow = h('div', 'frm-row');
    nrow.appendChild(UI.field('完成后进入', UI.sel(nextTypes, (L.next && L.next.type) || '', function (v) {
      L.next = v ? { type: v, levelId: L.next && L.next.levelId } : null;
      App.markDirty(); App.renderTab();
    })));
    if (L.next && L.next.type === 'level') {
      var opts = Object.keys(P.levels).filter(function (k) { return k !== L.id; })
        .map(function (k) { return { value: k, label: P.levels[k].name || k }; });
      nrow.appendChild(UI.field('目标关卡', UI.sel(opts, L.next.levelId, function (v) { L.next.levelId = v; App.markDirty(); })));
    }
    card.appendChild(nrow);

    var acts = h('div', 'btn-row');
    acts.appendChild(UI.btn('🔀 编辑本关分支流程', function () { App.switchTab('flow'); }));
    acts.appendChild(UI.btn('📋 复制关卡', function () { App.duplicateLevel(L.id); }));
    acts.appendChild(UI.btn('🗑️ 删除关卡', function () { App.deleteLevel(L.id); }, 'danger'));
    card.appendChild(acts);
    box.appendChild(card);

    // 本关题目列表
    var qCard = h('div', 'card');
    var qids = Schema.levelQuestionIds(P, L.id);
    qCard.appendChild(h('div', 'card-head', '<h3>本关题目（' + qids.length + '，按流程顺序）</h3>'));
    if (!qids.length) qCard.appendChild(h('p', 'muted', '本关流程中还没有问题节点。可以在“分支流程”里添加，或用下面按钮快速添加。'));
    var list = h('div', 'list');
    qids.forEach(function (qid, i) {
      var Q = P.questions[qid];
      if (!Q) return;
      var tlabel = (Schema.QUESTION_TYPES.find(function (t) { return t.type === Q.type; }) || {}).label || Q.type;
      var item = h('div', 'list-item' + (App.sel.type === 'question' && App.sel.id === qid ? ' sel' : ''));
      item.appendChild(h('span', 'grow',
        '<div class="title">' + (i + 1) + '. ' + esc((Q.text || '未命名题目').slice(0, 30)) + '</div>' +
        '<div class="sub"><span class="tag blue">' + esc(tlabel) + '</span> ' +
        (Q.knowledgePoint ? '<span class="tag">' + esc(Q.knowledgePoint) + '</span> ' : '') +
        (Q.countInScore === false ? '<span class="tag warn">不计分</span>' : '<span class="tag">' + (Q.score || 0) + '分</span>') +
        (Q.useAPI ? '<span class="tag">API评价</span>' : '') + '</div>'));
      var acts = h('div', 'actions');
      acts.appendChild(UI.btn('编辑', function () { App.select({ type: 'question', id: qid }); }));
      acts.appendChild(UI.btn('复制', function () { App.duplicateQuestion(qid); }));
      acts.appendChild(UI.btn('删除', function () { App.deleteQuestion(qid); }, 'danger'));
      item.appendChild(acts);
      list.appendChild(item);
    });
    qCard.appendChild(list);
    var addRow = h('div', 'btn-row');
    Schema.QUESTION_TYPES.forEach(function (t) {
      addRow.appendChild(UI.btn('＋ ' + t.label, function () { App.addQuestion(L, t.type); }));
    });
    qCard.appendChild(addRow);
    box.appendChild(qCard);
  }

  /* ==================== 题目表单 ==================== */
  function renderQuestionForm(box) {
    var P = App.project;
    var Q = P.questions[App.sel.id];
    if (!Q) { box.appendChild(h('div', 'card', '<p class="muted">题目不存在。</p>')); return; }

    var card = h('div', 'card');
    var tlabel = (Schema.QUESTION_TYPES.find(function (t) { return t.type === Q.type; }) || {}).label || Q.type;
    card.appendChild(h('div', 'card-head',
      '<h3>📝 题目设置 <span class="tag blue">' + esc(tlabel) + '</span></h3>'));
    card.appendChild(UI.row([
      UI.field('题目文本', UI.ta(Q.text, function (v) { Q.text = v; App.markDirty(); softRefresh(); }, 2)),
      UI.field('关联教学材料（可选，用于展示原文/参考答案）', materialSel(Q.materialId, function (v) { Q.materialId = v; App.markDirty(); }))
    ]));
    card.appendChild(UI.row([
      UI.field('知识点标签（用于报告统计）', UI.txt(Q.knowledgePoint || '', function (v) { Q.knowledgePoint = v; App.markDirty(); })),
      UI.field('题目素材（图片/视频/音频）', mediaList(Q.media || [], function (v) { Q.media = v; App.markDirty(); }))
    ]));
    box.appendChild(card);

    // 题型特定
    var typeCard = h('div', 'card');
    typeCard.appendChild(h('h3', null, '答案与选项'));
    if (['single', 'multi', 'judge', 'clickimg'].indexOf(Q.type) >= 0) renderOptionsEditor(typeCard, Q);
    else if (Q.type === 'fill') renderFillEditor(typeCard, Q);
    else if (Q.type === 'open') renderOpenEditor(typeCard, Q);
    else if (Q.type === 'order') renderOrderEditor(typeCard, Q);
    else if (Q.type === 'match') renderMatchEditor(typeCard, Q);
    box.appendChild(typeCard);

    // 反馈与讲解
    var fbCard = h('div', 'card');
    fbCard.appendChild(h('h3', null, '反馈 · 提示 · 讲解'));
    fbCard.appendChild(UI.row([
      UI.field('提示内容（学生点“看提示”时显示）', UI.ta(Q.hint || '', function (v) { Q.hint = v; App.markDirty(); }, 2)),
      UI.field('参考答案 / 讲解', UI.ta(Q.reference || '', function (v) { Q.reference = v; App.markDirty(); }, 2))
    ]));
    fbCard.appendChild(UI.row([
      UI.field('答对后的反馈', UI.ta(Q.correctFeedback || '', function (v) { Q.correctFeedback = v; App.markDirty(); }, 2)),
      UI.field('答错后的通用反馈', UI.ta(Q.wrongFeedback || '', function (v) { Q.wrongFeedback = v; App.markDirty(); }, 2))
    ]));
    box.appendChild(fbCard);

    // 计分与统计
    var scCard = h('div', 'card');
    scCard.appendChild(h('h3', null, '计分与统计'));
    var row1 = h('div', 'frm-row');
    row1.appendChild(UI.field('分值', UI.num(Q.score, function (v) { Q.score = v; App.markDirty(); })));
    row1.appendChild(UI.field('　', UI.chk('记录答题次数', Q.countAttempts !== false, function (v) { Q.countAttempts = v; App.markDirty(); })));
    row1.appendChild(UI.field('　', UI.chk('在学习报告中统计', Q.inReport !== false, function (v) { Q.inReport = v; App.markDirty(); })));
    row1.appendChild(UI.field('　', UI.chk('调用 API 评价（仅开放题有效）', Q.useAPI, function (v) { Q.useAPI = v; App.markDirty(); App.renderTab(); })));
    scCard.appendChild(row1);
    if (Q.useAPI && !P.api.endpoint) {
      scCard.appendChild(h('p', 'muted', '⚠️ 尚未配置 API 地址，本题将自动使用备用反馈。请到“API 设置”标签页配置。'));
    }
    scCard.appendChild(h('div', 'btn-row',
      UI.btn('📋 复制题目', function () { App.duplicateQuestion(Q.id); }),
      UI.btn('🗑️ 删除题目', function () { App.deleteQuestion(Q.id); }, 'danger')
    ));
    box.appendChild(scCard);
  }

  /* ---------- 选项编辑器（单选/多选/判断/图片点选） ---------- */
  function renderOptionsEditor(card, Q) {
    var P = App.project;
    var isRadio = Q.type === 'single' || Q.type === 'judge';
    var list = h('div', 'list');
    (Q.options || []).forEach(function (o, i) {
      var item = h('div', 'list-item');
      item.style.flexWrap = 'wrap';
      var main = h('div', 'grow');
      var r1 = h('div', 'frm-row');
      // 正确标记
      var correctCtl = h('label', 'check-line');
      var cb = h('input'); cb.type = isRadio ? 'radio' : 'checkbox';
      cb.name = 'correct_' + Q.id;
      cb.checked = !!o.correct;
      cb.addEventListener('change', function () {
        if (isRadio) Q.options.forEach(function (x) { x.correct = false; });
        o.correct = cb.checked;
        App.markDirty();
      });
      correctCtl.appendChild(cb);
      correctCtl.appendChild(h('span', null, '正确'));
      r1.appendChild(correctCtl);
      r1.appendChild(UI.field('选项' + String.fromCharCode(65 + i) + ' 文本', UI.txt(o.text, function (v) {
        o.text = v; App.markDirty(); softRefresh();
      })));
      if (Q.type === 'clickimg') {
        r1.appendChild(UI.field('区域 X%', UI.num(o.region ? o.region.x : 10, function (v) { o.region = o.region || {}; o.region.x = v; App.markDirty(); })));
        r1.appendChild(UI.field('区域 Y%', UI.num(o.region ? o.region.y : 10, function (v) { o.region = o.region || {}; o.region.y = v; App.markDirty(); })));
        r1.appendChild(UI.field('宽%', UI.num(o.region ? o.region.w : 15, function (v) { o.region = o.region || {}; o.region.w = v; App.markDirty(); })));
        r1.appendChild(UI.field('高%', UI.num(o.region ? o.region.h : 15, function (v) { o.region = o.region || {}; o.region.h = v; App.markDirty(); })));
      }
      main.appendChild(r1);
      var r2 = h('div', 'frm-row');
      r2.appendChild(UI.field('选择此项后的反馈（专属分支反馈）', UI.ta(o.feedback || '', function (v) { o.feedback = v; App.markDirty(); }, 2)));
      r2.appendChild(UI.field('选择此项后进入的节点（分支跳转）', UI.nodeSelect(o.next, function (v) { o.next = v; App.markDirty(); })));
      main.appendChild(r2);
      if (Q.type !== 'judge') {
        var r3 = h('div', 'frm-row');
        r3.appendChild(UI.field('选项配图（可选）', UI.assetPicker('image', (o.media || [])[0], function (v) { o.media = v ? [v] : []; App.markDirty(); })));
        main.appendChild(r3);
      }
      item.appendChild(main);
      var acts = h('div', 'actions');
      acts.appendChild(UI.btn('↑', function () {
        if (i === 0) return;
        Q.options.splice(i - 1, 0, Q.options.splice(i, 1)[0]);
        App.markDirty(); App.renderTab();
      }));
      acts.appendChild(UI.btn('↓', function () {
        if (i >= Q.options.length - 1) return;
        Q.options.splice(i + 1, 0, Q.options.splice(i, 1)[0]);
        App.markDirty(); App.renderTab();
      }));
      acts.appendChild(UI.btn('删除', function () {
        if (!confirm('删除该选项？')) return;
        Q.options.splice(i, 1);
        App.markDirty(); App.renderTab();
      }, 'danger'));
      item.appendChild(acts);
      list.appendChild(item);
    });
    card.appendChild(list);
    card.appendChild(h('div', 'btn-row', UI.btn('＋ 添加选项', function () {
      Q.options.push({ id: Schema.uid('op'), text: '', correct: false, feedback: '', next: null, media: [] });
      App.markDirty(); App.renderTab();
    })));
    if (Q.type === 'clickimg') {
      card.appendChild(h('p', 'muted', '💡 图片点选题：在上方“题目素材”中选择一张图片，然后为每个选项设置点击区域（百分比坐标，相对于图片左上角）。'));
    }
    if (Q.type === 'judge') {
      card.appendChild(h('p', 'muted', '💡 判断题固定为“正确/错误”两个选项，可分别设置反馈与分支。'));
    }
  }

  /* ---------- 填空题 ---------- */
  function renderFillEditor(card, Q) {
    card.appendChild(h('p', 'muted', '学生输入答案后与下方正确答案比对（忽略标点、空格与大小写）。可设置多个可接受的答案。'));
    var list = h('div', 'list');
    (Q.answers || []).forEach(function (a, i) {
      var item = h('div', 'list-item');
      item.appendChild(UI.field('可接受的答案 ' + (i + 1), UI.txt(a, function (v) { Q.answers[i] = v; App.markDirty(); })));
      item.appendChild(h('div', 'actions', UI.btn('删除', function () {
        Q.answers.splice(i, 1); App.markDirty(); App.renderTab();
      }, 'danger')));
      list.appendChild(item);
    });
    card.appendChild(list);
    card.appendChild(h('div', 'btn-row', UI.btn('＋ 添加可接受答案', function () {
      Q.answers.push(''); App.markDirty(); App.renderTab();
    })));
  }

  /* ---------- 开放题 ---------- */
  function renderOpenEditor(card, Q) {
    card.appendChild(h('p', 'muted', '开放题由学生自由作答。可调用 API 进行评价（需在“API 设置”中配置），未配置时使用下方通用备用反馈。'));
    card.appendChild(UI.row([
      UI.field('参考答案（发送给 API / 学生可查看）', UI.ta(Q.reference || '', function (v) { Q.reference = v; App.markDirty(); }, 3)),
      UI.field('未配置 API 时的反馈（留空则用项目通用备用反馈）', UI.ta(Q.correctFeedback || '', function (v) { Q.correctFeedback = v; App.markDirty(); }, 3))
    ]));
    card.appendChild(h('div', 'btn-row', UI.chk('本题调用 API 评价', Q.useAPI, function (v) { Q.useAPI = v; App.markDirty(); App.renderTab(); })));
  }

  /* ---------- 排序题 ---------- */
  function renderOrderEditor(card, Q) {
    card.appendChild(h('p', 'muted', '列表顺序即为正确顺序。学生会拿到打乱的卡片，用上下按钮排列。'));
    var list = h('div', 'list');
    (Q.options || []).forEach(function (o, i) {
      var item = h('div', 'list-item');
      item.appendChild(h('span', null, '<b>' + (i + 1) + '.</b>'));
      item.appendChild(UI.field('卡片文字', UI.txt(o.text, function (v) { o.text = v; App.markDirty(); softRefresh(); })));
      item.appendChild(UI.field('卡片配图（可选）', UI.assetPicker('image', (o.media || [])[0], function (v) { o.media = v ? [v] : []; App.markDirty(); })));
      item.appendChild(h('div', 'actions',
        UI.btn('↑', function () { if (i) { Q.options.splice(i - 1, 0, Q.options.splice(i, 1)[0]); App.markDirty(); App.renderTab(); } }),
        UI.btn('↓', function () { if (i < Q.options.length - 1) { Q.options.splice(i + 1, 0, Q.options.splice(i, 1)[0]); App.markDirty(); App.renderTab(); } }),
        UI.btn('删除', function () { Q.options.splice(i, 1); App.markDirty(); App.renderTab(); }, 'danger')));
      list.appendChild(item);
    });
    card.appendChild(list);
    card.appendChild(h('div', 'btn-row', UI.btn('＋ 添加卡片', function () {
      Q.options.push({ id: Schema.uid('op'), text: '', media: [] });
      App.markDirty(); App.renderTab();
    })));
  }

  /* ---------- 配对题 ---------- */
  function renderMatchEditor(card, Q) {
    card.appendChild(h('p', 'muted', '每对包含一个“左项”和一个“右项”，用相同的配对键互相匹配（例如 键=1）。学生先点左项、再点右项完成配对。'));
    var list = h('div', 'list');
    (Q.options || []).forEach(function (o, i) {
      var item = h('div', 'list-item');
      item.style.flexWrap = 'wrap';
      item.appendChild(UI.field('配对键（相同的为一对）', UI.txt(o.pairKey || '', function (v) { o.pairKey = v; App.markDirty(); })));
      item.appendChild(UI.field('位置', UI.sel([{ value: 'L', label: '左列' }, { value: 'R', label: '右列' }], o.side || 'L', function (v) { o.side = v; App.markDirty(); })));
      item.appendChild(UI.field('文字', UI.txt(o.text, function (v) { o.text = v; App.markDirty(); softRefresh(); })));
      item.appendChild(UI.field('配图（可选）', UI.assetPicker('image', (o.media || [])[0], function (v) { o.media = v ? [v] : []; App.markDirty(); })));
      item.appendChild(h('div', 'actions', UI.btn('删除', function () {
        Q.options.splice(i, 1); App.markDirty(); App.renderTab();
      }, 'danger')));
      list.appendChild(item);
    });
    card.appendChild(list);
    card.appendChild(h('div', 'btn-row',
      UI.btn('＋ 添加左项', function () {
        Q.options.push({ id: Schema.uid('op'), text: '', side: 'L', pairKey: '', media: [] });
        App.markDirty(); App.renderTab();
      }),
      UI.btn('＋ 添加右项', function () {
        Q.options.push({ id: Schema.uid('op'), text: '', side: 'R', pairKey: '', media: [] });
        App.markDirty(); App.renderTab();
      })));
  }

  /* ---------- 材料下拉 ---------- */
  function materialSel(value, onChange) {
    var opts = [{ value: '', label: '（不关联）' }];
    (App.project.materials || []).forEach(function (m) {
      var k = (Schema.MATERIAL_KINDS.find(function (x) { return x.type === m.kind; }) || {}).label || m.kind;
      opts.push({ value: m.id, label: '[' + k + '] ' + (m.title || m.id) });
    });
    return UI.sel(opts, value || '', function (v) { onChange(v || null); });
  }

  /* ---------- 多素材列表 ---------- */
  function mediaList(value, onChange, kind) {
    var wrap = h('div');
    function render() {
      wrap.innerHTML = '';
      var list = h('div', 'list');
      (value || []).forEach(function (aid, i) {
        var a = App.project.assets[aid];
        var item = h('div', 'list-item');
        var url = App._assetUrls[aid];
        if (url && a && a.kind === 'image') {
          var im = h('img'); im.src = url; im.style.cssText = 'width:56px;height:40px;object-fit:cover;border-radius:4px';
          item.appendChild(im);
        }
        item.appendChild(h('span', 'grow', '<div class="title">' + esc(a ? a.name : aid) + '</div><div class="sub">' + esc(a ? a.kind : '缺失') + '</div>'));
        item.appendChild(h('div', 'actions', UI.btn('移除', function () {
          value.splice(i, 1); onChange(value); render();
        }, 'danger')));
        list.appendChild(item);
      });
      if (!(value || []).length) list.appendChild(h('div', 'muted', '（暂无素材）'));
      wrap.appendChild(list);
      var add = UI.btn('＋ 添加素材', function () {
        var opts = [{ value: '', label: '选择素材…' }];
        Object.keys(App.project.assets).forEach(function (id) {
          var a = App.project.assets[id];
          if (kind && a.kind !== kind) return;
          opts.push({ value: id, label: a.name + '（' + a.kind + '）' });
        });
        var sel = UI.sel(opts, '', function (v) {
          if (!v) return;
          if (value.indexOf(v) < 0) value.push(v);
          onChange(value); render();
        });
        wrap.appendChild(sel);
        sel.focus();
      });
      wrap.appendChild(add);
    }
    render();
    return wrap;
  }
  UI.mediaList = mediaList;
  UI.materialSel = materialSel;

  /* ==================== 教学材料 ==================== */
  var MaterialsPanel = {
    render: function (box) {
      var P = App.project;
      box.appendChild(h('div', 'section-title', '教学材料管理（教材原文与科普拓展分开管理）'));
      var card = h('div', 'card');
      card.appendChild(h('div', 'card-head', '<h3>材料列表（' + (P.materials || []).length + '）</h3>'));
      var list = h('div', 'list');
      (P.materials || []).forEach(function (m, i) {
        var k = (Schema.MATERIAL_KINDS.find(function (x) { return x.type === m.kind; }) || {}).label || m.kind;
        var item = h('div', 'list-item' + (App.sel.type === 'material' && App.sel.id === m.id ? ' sel' : ''));
        item.appendChild(h('span', 'grow',
          '<div class="title">' + esc(m.title || '未命名') + '</div>' +
          '<div class="sub"><span class="tag">' + esc(k) + '</span> ' + esc((m.content || '').slice(0, 40)) + '</div>'));
        var acts = h('div', 'actions');
        if (P.mainTextMaterialId !== m.id) {
          acts.appendChild(UI.btn('设为主原文', function () {
            P.mainTextMaterialId = m.id; App.markDirty(); App.renderTab();
            App.notice('已设为学生页顶部展示的课文原文', 'ok');
          }));
        } else {
          acts.appendChild(h('span', 'tag ok', '当前主原文'));
        }
        acts.appendChild(UI.btn('编辑', function () {
          App.sel = { type: 'material', id: m.id }; App.renderTab();
        }));
        acts.appendChild(UI.btn('删除', function () {
          if (!confirm('删除材料「' + (m.title || '') + '」？')) return;
          P.materials.splice(i, 1);
          if (P.mainTextMaterialId === m.id) P.mainTextMaterialId = null;
          App.markDirty(); App.renderTab();
        }, 'danger'));
        item.appendChild(acts);
        list.appendChild(item);
      });
      card.appendChild(list);
      var addRow = h('div', 'btn-row');
      Schema.MATERIAL_KINDS.forEach(function (k) {
        addRow.appendChild(UI.btn('＋ ' + k.label, function () {
          var m = Schema.newMaterial(k.type);
          P.materials.push(m);
          App.sel = { type: 'material', id: m.id };
          App.markDirty(); App.renderTab();
        }));
      });
      card.appendChild(addRow);
      box.appendChild(card);

      // 编辑选中材料
      if (App.sel.type === 'material') {
        var m = (P.materials || []).find(function (x) { return x.id === App.sel.id; });
        if (m) {
          var ec = h('div', 'card');
          ec.appendChild(h('h3', null, '编辑材料'));
          ec.appendChild(UI.row([
            UI.field('标题', UI.txt(m.title, function (v) { m.title = v; App.markDirty(); })),
            UI.field('类型', UI.sel(Schema.MATERIAL_KINDS.map(function (k) { return { value: k.type, label: k.label }; }), m.kind, function (v) { m.kind = v; App.markDirty(); App.renderTab(); }))
          ]));
          ec.appendChild(UI.field('内容（支持换行）', UI.ta(m.content, function (v) { m.content = v; App.markDirty(); }, 8)));
          ec.appendChild(UI.field('高亮关键词（逗号分隔，用于“展示原文/高亮”节点）', UI.txt((m.keywords || []).join('，'), function (v) {
            m.keywords = v.split(/[，,]/).map(function (s) { return s.trim(); }).filter(Boolean);
            App.markDirty();
          })));
          box.appendChild(ec);
        }
      } else {
        box.appendChild(h('p', 'muted', '点击材料列表中的“编辑”填写内容。教材原文（type=教材原文）可设为顶栏展示的主原文。'));
      }
    }
  };

  App.panels.levels = LevelsPanel;
  App.panels.materials = MaterialsPanel;
})();
