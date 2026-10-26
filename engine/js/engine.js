/* ============================================================
 * 互动学习引擎 · 流程状态机 + 学生界面外壳
 * 教学内容全部来自项目配置，程序内不写死任何题目。
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

  var XP_TITLES = ['学习新星', '智慧小苗', '勇敢探险家', '知识小博士', '学问小达人', '语文小能手', '超级小学者'];

  var Player = {
    project: null,
    state: { view: 'home', levelId: null, nodeId: null, stack: [], returnStack: [], lastOpenAnswer: null }
  };

  /* ---------------- 初始化 ---------------- */
  Player.init = function () {
    var self = this;
    return Store.loadProject().then(function (p) {
      self.project = p;
      Store.records = Store.loadRecords();
      return Store.ensureAssets();
    }).then(function () {
      self.buildShell();
      self.goHome();
    }).catch(function (e) {
      document.getElementById('stage').innerHTML =
        '<div class="empty-error"><h2>无法加载学习内容</h2><p>' + esc(e.message) + '</p>' +
        '<p class="hint">如果你是老师：请确认项目文件完整；如果通过编辑器预览，请先在编辑器中保存项目。</p></div>';
    });
  };

  /* ---------------- 界面外壳 ---------------- */
  Player.buildShell = function () {
    var P = this.project;
    document.getElementById('sidebar-brand').textContent = P.meta.title || '互动学习';
    if (P.meta.subtitle) {
      document.getElementById('sidebar-sub').textContent = P.meta.subtitle;
    }
    this.renderTextPanel();
    this.refreshSidebar();
  };

  Player.renderTextPanel = function () {
    var P = this.project;
    var panel = document.getElementById('text-panel');
    var mat = null;
    if (P.mainTextMaterialId) {
      mat = (P.materials || []).find(function (m) { return m.id === P.mainTextMaterialId; });
    }
    if (!mat) mat = (P.materials || []).find(function (m) { return m.kind === 'text'; });
    var body = document.getElementById('text-body');
    if (!mat) {
      panel.style.display = 'none';
      return;
    }
    panel.style.display = '';
    document.getElementById('text-title').textContent = mat.title || '课文原文';
    body.innerHTML = '<p>' + esc(mat.content).replace(/\n/g, '<br>') + '</p>';
    var btn = document.getElementById('text-more-btn');
    btn.onclick = function () { Player.openMaterialsModal(); };
    btn.style.display = (P.materials || []).length > 1 ? '' : 'none';
  };

  Player.openMaterialsModal = function () {
    var P = this.project;
    var html = '<h2>学习材料</h2>';
    (P.materials || []).forEach(function (m) {
      var kindLabel = (window.Schema.MATERIAL_KINDS.find(function (k) { return k.type === m.kind; }) || {}).label || m.kind;
      html += '<div class="material-block"><div class="material-kind">' + esc(kindLabel) + '</div>' +
        '<h3>' + esc(m.title) + '</h3><p>' + esc(m.content).replace(/\n/g, '<br>') + '</p></div>';
    });
    this.openModal(html);
    // 查看材料计入记录
    var R = Store.records;
    (P.materials || []).forEach(function (m) {
      if (m.kind === 'text' || m.kind === 'expansion' || m.kind === 'word') {
        R.materialsViewed[m.id] = (R.materialsViewed[m.id] || 0) + 1;
      }
    });
    Store.saveRecords();
    this.refreshSidebar();
  };

  Player.refreshSidebar = function () {
    var P = this.project, R = Store.records;
    // 经验值
    var xp = R.xp || 0;
    var lv = Math.floor(xp / 50) + 1;
    var inLv = xp % 50;
    document.getElementById('xp-level').textContent = 'Lv.' + lv;
    document.getElementById('xp-title').textContent = XP_TITLES[Math.min(lv - 1, XP_TITLES.length - 1)];
    document.getElementById('xp-num').textContent = xp + ' 经验';
    document.getElementById('xp-bar-fill').style.width = (inLv / 50 * 100) + '%';

    // 进度（计分关卡中的题目）
    var qids = {};
    Object.keys(P.levels).forEach(function (lid) {
      var L = P.levels[lid];
      if (L.countInScore === false) return;
      window.Schema.levelQuestionIds(P, lid).forEach(function (q) { qids[q] = 1; });
    });
    var total = Object.keys(qids).length;
    var done = Object.keys(qids).filter(function (q) { return R.questions[q] && R.questions[q].correct; }).length;
    document.getElementById('progress-text').textContent = done + ' / ' + total + ' 题';
    document.getElementById('progress-bar-fill').style.width = (total ? done / total * 100 : 0) + '%';

    // 成就墙
    var wall = document.getElementById('ach-wall');
    wall.innerHTML = '';
    (P.achievements || []).forEach(function (a) {
      var rec = R.achievements[a.id];
      var unlocked = !!rec;
      var b = el('div', 'ach-badge' + (unlocked ? ' unlocked' : ' locked'));
      if (unlocked) {
        var url = a.icon ? Store.assetUrl(a.icon) : null;
        if (url) { var im = el('img'); im.src = url; im.alt = a.name; b.appendChild(im); }
        else b.appendChild(el('div', 'ach-emoji', a.iconEmoji || '🏅'));
        b.appendChild(el('div', 'ach-name', a.name));
        b.title = a.name + '：' + (a.desc || '') + (rec.count > 1 ? '（已获得 ' + rec.count + ' 次）' : '');
      } else {
        b.appendChild(el('div', 'ach-emoji', a.hidden ? '❓' : '🔒'));
        b.appendChild(el('div', 'ach-name', a.hidden ? '？？？' : a.name));
        var prog = window.Achievements.conditionProgress(a.condition, R, P);
        b.title = (a.hidden ? '隐藏成就' : a.name + '：' + (a.desc || '')) +
          '\n进度：' + prog.cur + ' / ' + prog.need;
      }
      wall.appendChild(b);
    });
    if (!(P.achievements || []).length) {
      wall.innerHTML = '<div class="ach-empty">还没有配置成就</div>';
    }
  };

  /* ---------------- 视图切换 ---------------- */
  Player.goHome = function () {
    this.state = { view: 'home', levelId: null, nodeId: null, stack: [], returnStack: [], lastOpenAnswer: this.state.lastOpenAnswer };
    var P = this.project;
    document.getElementById('topbar').style.display = 'none';
    var stage = document.getElementById('stage');
    stage.innerHTML = '';
    stage.className = 'stage-home';

    var hero = el('div', 'home-hero');
    hero.appendChild(el('h1', null, esc(P.meta.title)));
    if (P.meta.subtitle) hero.appendChild(el('p', 'home-sub', esc(P.meta.subtitle)));
    if (P.meta.description) hero.appendChild(el('p', 'home-desc', esc(P.meta.description)));
    stage.appendChild(hero);

    var stats = el('div', 'home-stats');
    stats.innerHTML =
      '<div class="home-stat"><b>' + (Store.records.xp || 0) + '</b><span>经验值</span></div>' +
      '<div class="home-stat"><b>' + Object.keys(Store.records.levels).filter(function (k) { return Store.records.levels[k].completed; }).length + '</b><span>已完成关卡</span></div>' +
      '<div class="home-stat"><b>' + Object.keys(Store.records.achievements).length + ' / ' + (P.achievements || []).length + '</b><span>成就</span></div>';
    stage.appendChild(stats);

    var actions = el('div', 'home-actions');
    var reportBtn = el('button', 'btn-secondary', '📋 学习报告');
    reportBtn.type = 'button';
    reportBtn.onclick = function () { Player.showReport(); };
    actions.appendChild(reportBtn);
    stage.appendChild(actions);

    (P.stages || []).forEach(function (stg) {
      var card = el('div', 'stage-card');
      card.appendChild(el('h2', null, '🌈 ' + esc(stg.name || '未命名阶段')));
      if (stg.desc) card.appendChild(el('p', 'stage-desc', esc(stg.desc)));
      var row = el('div', 'level-row');
      (stg.levels || []).forEach(function (lid) {
        var L = P.levels[lid];
        if (!L) return;
        var done = Store.records.levels[lid] && Store.records.levels[lid].completed;
        var b = el('button', 'level-card' + (done ? ' done' : ''));
        b.type = 'button';
        b.innerHTML =
          '<div class="level-card-top">' +
          (L.isEgg ? '<span class="tag tag-egg">🥚 彩蛋</span>' : '') +
          (L.optional ? '<span class="tag tag-opt">选做</span>' : '') +
          (done ? '<span class="tag tag-done">✓ 已完成</span>' : '') +
          '</div>' +
          '<div class="level-card-name">' + esc(L.name) + '</div>' +
          (L.intro ? '<div class="level-card-intro">' + esc(L.intro) + '</div>' : '') +
          '<div class="level-card-go">' + (done ? '再学一次' : '开始学习') + ' ▶</div>';
        b.onclick = function () { Player.startLevel(lid); };
        row.appendChild(b);
      });
      if (!(stg.levels || []).length) row.appendChild(el('div', 'level-empty', '（本阶段还没有关卡）'));
      card.appendChild(row);
      stage.appendChild(card);
    });

    if (!(P.stages || []).length) {
      stage.appendChild(el('div', 'empty-error', '<h2>项目还是空的</h2><p>请使用内容编辑器添加阶段、关卡和题目。</p>'));
    }
    this.refreshSidebar();
  };

  Player.startLevel = function (lid) {
    var P = this.project, L = P.levels[lid];
    if (!L) { this.toast('关卡不存在'); return; }
    this.state = { view: 'level', levelId: lid, nodeId: null, stack: [], returnStack: [], lastOpenAnswer: this.state.lastOpenAnswer };
    document.getElementById('topbar').style.display = '';
    document.getElementById('topbar-title').textContent = L.name || '';
    document.getElementById('topbar-back').onclick = function () { Player.goHome(); };
    var stage = document.getElementById('stage');
    stage.innerHTML = '';
    stage.className = 'stage-level';
    if (L.bgImage && Store.assetUrl(L.bgImage)) {
      stage.style.backgroundImage = 'url(' + Store.assetUrl(L.bgImage) + ')';
    } else {
      stage.style.backgroundImage = '';
    }
    if (L.startTip) {
      this.openModal('<h2>🚩 关卡开始</h2><p class="modal-tip">' + esc(L.startTip) + '</p>', function () {
        Player.gotoNode(L.entry);
      }, '开始学习 ▶');
    } else {
      this.gotoNode(L.entry);
    }
    this.refreshSidebar();
  };

  /* ---------------- 流程引擎 ---------------- */
  Player.gotoNode = function (id, opts) {
    var P = this.project;
    var N = P.nodes[id];
    if (!N) {
      this.toast('流程节点不存在：' + id);
      return;
    }
    if (!opts || !opts.noPush) {
      if (this.state.nodeId) {
        this.state.stack.push(this.state.nodeId);
        if (this.state.stack.length > 60) this.state.stack.shift();
      }
    }
    this.state.nodeId = id;
    this.renderNode(N);
  };

  Player.renderNode = function (N) {
    var stage = document.getElementById('stage');
    stage.innerHTML = '';
    var card = el('div', 'flow-card node-' + N.type);
    stage.appendChild(card);

    var handler = NodeHandlers[N.type];
    if (!handler) {
      card.appendChild(el('div', 'empty-error', '未知节点类型：' + esc(N.type)));
      return;
    }
    handler(card, N);
  };

  /* 继续按钮（文字/图片/音频/excerpt 等节点共用） */
  function continueButton(N, extraText) {
    var b = el('button', 'btn-primary btn-continue', extraText || '继续 ▶');
    b.type = 'button';
    b.addEventListener('click', function () {
      if (N.next) Player.gotoNode(N.next);
      else Player.completeLevel();
    });
    return b;
  }

  var NodeHandlers = {
    text: function (card, N) {
      if (N.title) card.appendChild(el('h2', 'node-title', esc(N.title)));
      if (N.text) card.appendChild(el('div', 'node-text', esc(N.text).replace(/\n/g, '<br>')));
      (N.media || []).forEach(function (aid) { Player.appendMedia(card, aid); });
      card.appendChild(continueButton(N));
    },

    image: function (card, N) {
      if (N.title) card.appendChild(el('h2', 'node-title', esc(N.title)));
      (N.media || []).forEach(function (aid) { Player.appendMedia(card, aid); });
      if (N.caption) card.appendChild(el('div', 'node-caption', esc(N.caption)));
      card.appendChild(continueButton(N));
    },

    video: function (card, N) {
      if (N.title) card.appendChild(el('h2', 'node-title', esc(N.title)));
      var url = (N.media || []).map(function (a) { return Store.assetUrl(a); }).filter(Boolean)[0];
      if (url) {
        var v = el('video', 'node-video');
        v.controls = true; v.preload = 'metadata'; v.playsInline = true; v.src = url;
        card.appendChild(v);
      } else {
        card.appendChild(el('div', 'media-missing', '⚠️ 视频素材缺失，请联系老师检查项目文件。'));
      }
      if (N.caption) card.appendChild(el('div', 'node-caption', esc(N.caption)));
      card.appendChild(continueButton(N, '我看完了，继续 ▶'));
    },

    audio: function (card, N) {
      if (N.title) card.appendChild(el('h2', 'node-title', esc(N.title)));
      var url = (N.media || []).map(function (a) { return Store.assetUrl(a); }).filter(Boolean)[0];
      if (url) {
        var a = el('audio', 'node-audio');
        a.controls = true; a.src = url;
        card.appendChild(a);
      } else {
        card.appendChild(el('div', 'media-missing', '⚠️ 音频素材缺失，请联系老师检查项目文件。'));
      }
      if (N.caption) card.appendChild(el('div', 'node-caption', esc(N.caption)));
      card.appendChild(continueButton(N, '听完了，继续 ▶'));
    },

    hint: function (card, N) {
      card.appendChild(el('div', 'hint-card', '<span class="hint-icon">💡</span><div>' + esc(N.text || N.title || '这里有一点点提示～') + '</div>'));
      card.appendChild(continueButton(N, '我知道了，继续 ▶'));
    },

    excerpt: function (card, N) {
      var P = Player.project;
      var mat = (P.materials || []).find(function (m) { return m.id === N.materialId; });
      if (!mat) {
        card.appendChild(el('div', 'media-missing', '⚠️ 引用的教学材料不存在。'));
        card.appendChild(continueButton(N));
        return;
      }
      if (N.title) card.appendChild(el('h2', 'node-title', esc(N.title)));
      var kindLabel = (window.Schema.MATERIAL_KINDS.find(function (k) { return k.type === mat.kind; }) || {}).label || '';
      card.appendChild(el('div', 'excerpt-kind', esc(kindLabel) + ' · ' + esc(mat.title)));
      var html = esc(mat.content).replace(/\n/g, '<br>');
      (N.keywords || []).forEach(function (kw) {
        if (!kw) return;
        var safe = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        html = html.replace(new RegExp(safe, 'g'), '<mark class="hl">' + esc(kw) + '</mark>');
      });
      card.appendChild(el('div', 'excerpt-body', html));
      card.appendChild(continueButton(N, '读完了，继续 ▶'));
    },

    question: function (card, N) {
      Player.renderQuestion(card, N);
    },

    game: function (card, N) {
      var P = Player.project;
      var G = P.games[N.gameId];
      if (!G) {
        card.appendChild(el('div', 'media-missing', '⚠️ 小游戏不存在或已被删除。'));
        card.appendChild(continueButton(N));
        return;
      }
      var box = el('div', 'game-box');
      card.appendChild(box);
      var runner = window.Games[G.type];
      if (!runner) {
        box.appendChild(el('div', 'media-missing', '⚠️ 未知的小游戏类型：' + esc(G.type)));
        card.appendChild(continueButton(N));
        return;
      }
      runner.mount(box, G.config, {
        assetUrl: function (id) { return Store.assetUrl(id); },
        grantXp: function (n, reason) { Achievements.grantXp(n, reason); Store.saveRecords(); Player.refreshSidebar(); },
        gotoNode: function (id) { Player.gotoNode(id); },
        onComplete: function (result) {
          var R = Store.records;
          var g = R.games[G.id] || (R.games[G.id] = { completed: false, cluesFound: [], attempts: 0 });
          g.completed = true;
          g.at = new Date().toISOString();
          if (result && typeof result.cluesFound === 'number') g.cluesFound.push(result.cluesFound);
          if (!g.rewarded) {
            Achievements.grantXp(P.xpRules.gameComplete || 0, '完成小游戏');
            g.rewarded = true;
          }
          Store.saveRecords();
          Achievements.checkAll();
          if (N.next) Player.gotoNode(N.next);
          else Player.completeLevel();
        }
      });
    },

    reward: function (card, N) {
      var html = '<div class="reward-emoji">🎁</div><div class="reward-text">';
      if (N.xp) html += '获得 <b>' + N.xp + '</b> 点经验值！';
      if (N.achievementId) {
        var a = (Player.project.achievements || []).find(function (x) { return x.id === N.achievementId; });
        if (a) html += (N.xp ? '<br>' : '') + '解锁成就「' + esc(a.name) + '」！';
      }
      html += '</div>';
      card.appendChild(el('div', 'reward-card', html));
      if (N.xp) Achievements.grantXp(N.xp, '流程奖励');
      if (N.achievementId) {
        var R = Store.records;
        if (!R.achievements[N.achievementId]) {
          R.achievements[N.achievementId] = { unlockedAt: new Date().toISOString(), count: 1 };
        }
      }
      Store.saveRecords();
      Achievements.checkAll();
      setTimeout(function () {
        if (N.next) Player.gotoNode(N.next);
        else Player.completeLevel();
      }, 1600);
    },

    api: function (card, N) {
      var P = Player.project;
      var last = Player.state.lastOpenAnswer;
      card.appendChild(el('h2', 'node-title', esc(N.title || '老师点评')));
      var box = el('div', 'api-box');
      card.appendChild(box);
      box.appendChild(el('div', 'api-loading', '⏳ 正在请求老师点评，请稍等…'));
      var cfg = N.useGlobalPrompts ? P.api : {
        endpoint: P.api.endpoint,
        model: P.api.model,
        systemPrompt: N.systemPrompt || P.api.systemPrompt,
        userPromptTemplate: N.userPromptTemplate || P.api.userPromptTemplate,
        timeout: P.api.timeout,
        fallback: P.api.fallback
      };
      var vars = {
        question: last ? last.question : '',
        answer: last ? last.text : '',
        reference: N.reference || (last ? last.reference : '') || '',
        criteria: N.criteria || ''
      };
      if (!last) {
        box.innerHTML = '<div class="api-fallback">' + esc(P.feedback.apiFail || P.api.fallback || '还没有可以评价的回答。') + '</div>';
        card.appendChild(continueButton(N));
        return;
      }
      ApiKit.evaluate(cfg, vars).then(function (r) {
        box.innerHTML = '';
        if (r.ok) {
          box.appendChild(el('div', 'api-result', esc(r.text)));
          var R = Store.records;
          if (R.openAnswers[last.qid]) R.openAnswers[last.qid].apiResult = r.text;
          Store.saveRecords();
        } else {
          box.appendChild(el('div', 'api-fallback',
            esc(P.feedback.apiFail || P.api.fallback || '点评服务暂时不可用，我们先继续学习吧！')));
          box.appendChild(el('div', 'api-error-note', '（' + esc(r.error || '未知错误') + '，可检查本地 API 设置）'));
        }
        card.appendChild(continueButton(N));
      });
    },

    jump: function (card, N) {
      var j = N.jump || {};
      var P = Player.project;
      if (j.targetType === 'node' && P.nodes[j.targetId]) Player.gotoNode(j.targetId);
      else if (j.targetType === 'level' && P.levels[j.targetId]) Player.startLevel(j.targetId);
      else if (j.targetType === 'question') {
        var qid = j.targetId;
        var nodeId = Object.keys(P.nodes).find(function (nid) {
          return P.nodes[nid].type === 'question' && P.nodes[nid].questionId === qid;
        });
        if (nodeId) Player.gotoNode(nodeId);
        else { card.appendChild(el('div', 'media-missing', '⚠️ 找不到包含该题目的问题节点。')); card.appendChild(continueButton(N)); }
      } else if (j.targetType === 'home') Player.goHome();
      else if (j.targetType === 'report') Player.showReport();
      else if (j.targetType === 'end') Player.completeLevel();
      else {
        card.appendChild(el('div', 'media-missing', '⚠️ 跳转目标无效。'));
        card.appendChild(continueButton(N));
      }
    },

    return: function (card, N) {
      var st = Player.state;
      var P = Player.project;
      // 优先回到触发分支的原题
      while (st.returnStack.length) {
        var origin = st.returnStack.pop();
        var node = P.nodes[origin];
        if (node && node.type === 'question') {
          st.nodeId = origin;
          Player.renderNode(node);
          return;
        }
      }
      // 兜底：沿调用栈找最近的问题节点
      while (st.stack.length) {
        var id = st.stack.pop();
        var node2 = P.nodes[id];
        if (node2 && node2.type === 'question') {
          st.nodeId = id;
          Player.renderNode(node2);
          return;
        }
      }
      Player.goHome();
    },

    end: function (card, N) {
      Player.completeLevel();
    }
  };

  /* ---------------- 题目渲染与判定 ---------------- */
  Player.renderQuestion = function (card, N) {
    var P = this.project;
    var Q = P.questions[N.questionId];
    if (!Q) {
      card.appendChild(el('div', 'media-missing', '⚠️ 题目不存在：' + esc(N.questionId)));
      card.appendChild(continueButton(N));
      return;
    }
    var R = Store.records;
    var qrec = R.questions[Q.id];

    if (N.title) card.appendChild(el('h2', 'node-title', esc(N.title)));
    var typeLabel = (window.Schema.QUESTION_TYPES.find(function (t) { return t.type === Q.type; }) || {}).label || '';
    var meta = el('div', 'q-meta');
    meta.appendChild(el('span', 'q-type', esc(typeLabel)));
    if (Q.knowledgePoint) meta.appendChild(el('span', 'q-kp', '📖 ' + esc(Q.knowledgePoint)));
    card.appendChild(meta);

    card.appendChild(el('div', 'q-text', esc(Q.text).replace(/\n/g, '<br>')));
    var ms = QuestionRenderers.mediaStrip ? QuestionRenderers.mediaStrip(Q, { assetUrl: Store.assetUrl }) : null;
    if (ms) card.appendChild(ms);

    var body = el('div', 'q-body');
    card.appendChild(body);

    var feedback = el('div', 'q-feedback');
    card.appendChild(feedback);

    var actions = el('div', 'q-actions');
    card.appendChild(actions);

    function mountRenderer() {
      body.innerHTML = '';
      var runner = QuestionRenderers[Q.type];
      if (!runner) {
        body.appendChild(el('div', 'media-missing', '⚠️ 不支持的题型：' + esc(Q.type)));
        return;
      }
      runner.mount(body, Q, {
        assetUrl: function (id) { return Store.assetUrl(id); },
        onSubmit: function (value) { Player.handleSubmit(Q, N, value); }
      });
    }
    mountRenderer();

    // 提示按钮
    if (Q.hint) {
      var hb = el('button', 'btn-hint', '💡 看提示');
      hb.type = 'button';
      hb.addEventListener('click', function () {
        feedback.innerHTML = '<div class="fb fb-hint"><span class="fb-icon">💡</span><div>' + esc(Q.hint) + '</div></div>';
        var rec = Store.records.questions[Q.id] || (Store.records.questions[Q.id] = { attempts: 0 });
        if (!rec.hintUsed) {
          rec.hintUsed = true;
          Store.saveRecords();
        }
        hb.disabled = true;
        hb.textContent = '💡 已看提示';
      });
      actions.appendChild(hb);
    }

    // 答对后允许查看参考答案
    if (qrec && qrec.correct && Q.reference) {
      var rb = el('button', 'btn-hint', '📖 看参考答案');
      rb.type = 'button';
      rb.addEventListener('click', function () {
        feedback.innerHTML = '<div class="fb fb-ref"><span class="fb-icon">📖</span><div>' + esc(Q.reference) + '</div></div>';
      });
      actions.appendChild(rb);
    }
  };

  Player.handleSubmit = function (Q, N, value) {
    var P = this.project, R = Store.records;
    var qrec = R.questions[Q.id] || (R.questions[Q.id] = {
      attempts: 0, firstCorrect: false, hintUsed: false, correct: false, rewarded: false
    });
    var isOptionId = ['single', 'judge', 'clickimg'].indexOf(Q.type) >= 0;
    var option = isOptionId ? (Q.options || []).find(function (o) { return o.id === value; }) : null;

    var res = QuestionRenderers.evaluate(Q, value);
    if (Q.countAttempts !== false) qrec.attempts++;
    var first = qrec.attempts <= 1;
    var correct = res.correct === true;

    if (Q.type === 'open') {
      this.handleOpenSubmit(Q, N, value, qrec);
      return;
    }

    if (correct) {
      qrec.correct = true;
      qrec.firstCorrect = first;
      if (!qrec.rewarded) {
        var xp = qrec.hintUsed ? (P.xpRules.hintCorrect || 0) : (P.xpRules.firstCorrect || 0);
        Achievements.grantXp(xp, '答对题目');
        qrec.rewarded = true;
      }
      R.events.push({ t: new Date().toISOString(), type: 'answer', detail: '答对 ' + Q.id });
    } else {
      R.events.push({ t: new Date().toISOString(), type: 'answer', detail: '答错 ' + Q.id });
    }
    Store.saveRecords();

    // 反馈文本：优先选项专属反馈
    var fbKind = correct ? 'ok' : 'no';
    var fbText;
    if (correct) fbText = Q.correctFeedback || '真棒！答对了！';
    else if (option && option.feedback) fbText = option.feedback;
    else fbText = Q.wrongFeedback || '再想一想，你可以的！';

    var card = document.querySelector('#stage .flow-card');
    var feedback = card ? card.querySelector('.q-feedback') : null;
    if (feedback) {
      feedback.innerHTML = '<div class="fb fb-' + fbKind + '"><span class="fb-icon">' +
        (correct ? '🌟' : '💪') + '</span><div>' + esc(fbText) + '</div></div>';
    }
    this.refreshSidebar();

    // 后续节点：选项分支优先
    var target = (option && option.next) ? option.next : (N.next || null);
    var branchy = !!(option && option.next);

    if (branchy) {
      // 记录分支来源题目，“返回原题”节点将回到这里
      this.state.returnStack.push(N.id);
    }

    var self = this;
    function proceed() {
      if (target) self.gotoNode(target);
      else if (correct) self.completeLevel();
      else self.renderNode(N); // 答错且无分支：留在原题重答
    }

    if (correct || branchy) {
      setTimeout(proceed, 1500);   // 留出阅读反馈的时间（儿童需要更长的阅读时间）
    } else {
      // 答错无分支：显示“再试一次”
      var again = el('button', 'btn-primary', '再试一次 🔁');
      again.type = 'button';
      again.addEventListener('click', function () { self.renderNode(N); });
      var actions = card ? card.querySelector('.q-actions') : null;
      if (actions) actions.appendChild(again);
    }
  };

  Player.handleOpenSubmit = function (Q, N, text, qrec) {
    var P = this.project, R = Store.records;
    var now = new Date().toISOString();
    R.openAnswers[Q.id] = { text: text, at: now, apiResult: null };
    this.state.lastOpenAnswer = {
      qid: Q.id, text: text, question: Q.text, reference: Q.reference || ''
    };
    if (!qrec.rewarded) {
      Achievements.grantXp(P.xpRules.openComplete || 0, '完成开放题');
      qrec.rewarded = true;
    }
    qrec.answered = true;
    Store.saveRecords();
    this.refreshSidebar();

    var card = document.querySelector('#stage .flow-card');
    var feedback = card ? card.querySelector('.q-feedback') : null;

    function showResult(html) {
      if (feedback) feedback.innerHTML = html;
      var actions = card ? card.querySelector('.q-actions') : null;
      if (actions && !actions.querySelector('.btn-open-next')) {
        var b = el('button', 'btn-primary btn-open-next', '继续 ▶');
        b.type = 'button';
        b.addEventListener('click', function () {
          if (N.next) Player.gotoNode(N.next);
          else Player.completeLevel();
        });
        actions.appendChild(b);
      }
    }

    var baseFb = '<div class="fb fb-ok"><span class="fb-icon">📝</span><div>' +
      esc(Q.correctFeedback || P.feedback.openDefault || '收到你的回答，写得真棒！') + '</div></div>';
    if (Q.reference) {
      baseFb += '<button class="btn-hint btn-ref-open" type="button">📖 看看参考答案</button>';
    }

    if (Q.useAPI && P.api.endpoint) {
      showResult(baseFb + '<div class="api-loading">⏳ 正在请老师评价你的回答…</div>');
      var refBtn = card.querySelector('.btn-ref-open');
      if (refBtn) refBtn.addEventListener('click', function () {
        if (feedback) feedback.insertAdjacentHTML('beforeend',
          '<div class="fb fb-ref"><span class="fb-icon">📖</span><div>' + esc(Q.reference) + '</div></div>');
        refBtn.remove();
      });
      ApiKit.evaluate(P.api, {
        question: Q.text, answer: text, reference: Q.reference || '', criteria: ''
      }).then(function (r) {
        var loading = card.querySelector('.api-loading');
        if (loading) loading.remove();
        if (r.ok) {
          R.openAnswers[Q.id].apiResult = r.text;
          Store.saveRecords();
          showResult('<div class="fb fb-ok"><span class="fb-icon">👩‍🏫</span><div>' + esc(r.text) + '</div></div>' + baseFb);
        } else {
          showResult(baseFb + '<div class="api-fallback">' + esc(P.feedback.apiFail || P.api.fallback || '点评服务暂时不可用，我们先继续学习吧！') + '</div>' +
            '<div class="api-error-note">（' + esc(r.error || '未知错误') + '）</div>');
        }
      });
    } else {
      showResult(baseFb);
      var refBtn2 = card.querySelector('.btn-ref-open');
      if (refBtn2) refBtn2.addEventListener('click', function () {
        if (feedback) feedback.insertAdjacentHTML('beforeend',
          '<div class="fb fb-ref"><span class="fb-icon">📖</span><div>' + esc(Q.reference) + '</div></div>');
        refBtn2.remove();
      });
    }
  };

  /* ---------------- 关卡完成 ---------------- */
  Player.completeLevel = function () {
    var P = this.project, R = Store.records;
    var lid = this.state.levelId;
    var L = P.levels[lid];
    if (!L) { this.goHome(); return; }
    var first = !R.levels[lid];
    if (first || !R.levels[lid].completed) {
      R.levels[lid] = R.levels[lid] || {};
      R.levels[lid].completed = true;
      R.levels[lid].at = new Date().toISOString();
      if (first) Achievements.grantXp(P.xpRules.levelComplete || 0, '完成关卡');
    }
    Store.saveRecords();
    Achievements.checkAll();
    this.refreshSidebar();

    var stage = document.getElementById('stage');
    stage.innerHTML = '';
    var card = el('div', 'flow-card node-complete');
    card.innerHTML = '<div class="complete-emoji">🎉</div><h2>关卡完成！</h2>';
    if (L.completeTip) card.appendChild(el('p', 'complete-tip', esc(L.completeTip)));
    stage.appendChild(card);
    this.confetti(stage);

    var next = L.next;
    if (next && next.type === 'level' && P.levels[next.levelId]) {
      var b = el('button', 'btn-primary', '进入下一关 ▶');
      b.type = 'button';
      b.addEventListener('click', function () { Player.startLevel(next.levelId); });
      card.appendChild(b);
    }
    var home = el('button', 'btn-secondary', '🏠 返回首页');
    home.type = 'button';
    home.addEventListener('click', function () { Player.goHome(); });
    card.appendChild(home);
    if (next && next.type === 'report') {
      var rp = el('button', 'btn-secondary', '📋 查看学习报告');
      rp.type = 'button';
      rp.addEventListener('click', function () { Player.showReport(); });
      card.appendChild(rp);
    }
  };

  /* ---------------- 通用 UI ---------------- */
  Player.appendMedia = function (card, aid) {
    var url = Store.assetUrl(aid);
    var a = this.project.assets[aid];
    if (!url || !a) {
      card.appendChild(el('div', 'media-missing', '⚠️ 素材缺失：' + esc(aid)));
      return;
    }
    if (a.kind === 'image') card.appendChild(el('img', 'node-img')).src = url;
    else if (a.kind === 'video') {
      var v = el('video', 'node-video');
      v.controls = true; v.preload = 'metadata'; v.playsInline = true; v.src = url;
      card.appendChild(v);
    } else if (a.kind === 'audio') {
      var au = el('audio', 'node-audio');
      au.controls = true; au.src = url;
      card.appendChild(au);
    }
  };

  Player.toast = function (msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  };

  Player.openModal = function (html, onClose, okText) {
    var root = document.getElementById('modal-root');
    root.innerHTML = '';
    var mask = el('div', 'modal-mask');
    var box = el('div', 'modal-box');
    box.innerHTML = html;
    if (okText) {
      var ok = el('button', 'btn-primary', okText);
      ok.type = 'button';
      ok.addEventListener('click', function () {
        root.innerHTML = '';
        if (onClose) onClose();
      });
      box.appendChild(ok);
    } else {
      var close = el('button', 'btn-secondary modal-close', '关闭');
      close.type = 'button';
      close.addEventListener('click', function () {
        root.innerHTML = '';
        if (onClose) onClose();
      });
      box.appendChild(close);
    }
    mask.appendChild(box);
    root.appendChild(mask);
  };

  Player.showAchievementUnlock = function (a) {
    this._achQueue = this._achQueue || [];
    this._achQueue.push(a);
    if (!this._achShowing) this._nextAchUnlock();
  };

  Player._nextAchUnlock = function () {
    var self = this;
    var a = (this._achQueue || []).shift();
    if (!a) { this._achShowing = false; return; }
    this._achShowing = true;
    var url = a.icon ? Store.assetUrl(a.icon) : null;
    var html = '<div class="unlock-emoji">' + (url ? '<img src="' + url + '" alt="">' : esc(a.iconEmoji || '🏅')) + '</div>' +
      '<h2>解锁成就</h2><h3>' + esc(a.name) + '</h3>' +
      (a.desc ? '<p>' + esc(a.desc) + '</p>' : '') +
      (a.unlockedTip ? '<p class="unlock-tip">' + esc(a.unlockedTip) + '</p>' : '') +
      (a.xp ? '<p class="unlock-xp">+' + a.xp + ' 经验值</p>' : '');
    this.openModal(html, function () { self._nextAchUnlock(); }, '太棒了！');
  };

  Player.confetti = function (container) {
    for (var i = 0; i < 24; i++) {
      var c = el('div', 'confetti');
      c.style.left = Math.random() * 100 + '%';
      c.style.animationDelay = (Math.random() * 0.6) + 's';
      c.style.background = ['#ff8a3d', '#43b581', '#4a90d9', '#f7c948', '#e05c8a'][i % 5];
      container.appendChild(c);
    }
  };

  Player.showReport = function () {
    if (window.ReportPage) window.ReportPage.show();
  };

  Player.confirmDialog = function (msg, onOk) {
    this.openModal('<h2>请确认</h2><p>' + esc(msg) + '</p>', function () { onOk(); }, '确定');
  };

  window.Player = Player;

  document.addEventListener('DOMContentLoaded', function () {
    Player.init();
  });
})();
