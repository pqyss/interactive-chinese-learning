/* ============================================================
 * 共享数据模型 / 校验 / 迁移  （编辑器与运行引擎共用）
 * 项目配置为纯 JSON，素材二进制单独存放（编辑器存 IndexedDB，
 * 导出时内嵌 dataURL 或落盘为 assets/ 文件）。
 * ============================================================ */
(function () {
  'use strict';

  var SCHEMA_VERSION = 1;

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function emptyProject() {
    var now = new Date().toISOString();
    return {
      schemaVersion: SCHEMA_VERSION,
      meta: {
        title: '未命名学习项目',
        subtitle: '',
        author: '',
        description: '',
        createdAt: now,
        updatedAt: now
      },
      theme: { primary: '#ff8a3d', accent: '#43b581', bg: '#fff8ec', fontScale: 1 },
      // 主原文材料（学生页顶部“课文原文”默认展示）
      mainTextMaterialId: null,
      stages: [],                 // [{id,name,desc,levels:[levelId]}]
      levels: {},                 // id -> level
      nodes: {},                  // id -> flow node
      questions: {},              // id -> question
      materials: [],              // [{id,kind,title,content,keywords}]
      games: {},                  // id -> game
      assets: {},                 // id -> asset meta（二进制在 IDB / 导出文件）
      achievements: [],
      xpRules: {
        firstCorrect: 10, hintCorrect: 5, gameComplete: 15,
        openComplete: 8, materialView: 2, levelComplete: 10
      },
      feedback: { openDefault: '', apiFail: '', allWrong: '' },
      api: {
        endpoint: '', model: '', systemPrompt: '', userPromptTemplate: '',
        outputFormat: '', timeout: 15, fallback: ''
        // 注意：api.key 绝不写入项目配置，仅保存在浏览器本地
      }
    };
  }

  /* ---------- 节点类型定义（分支流程编辑器据此生成表单） ---------- */
  var NODE_TYPES = [
    { type: 'text', label: '显示文字', desc: '展示一段文字/讲解，学生点击继续' },
    { type: 'question', label: '显示问题', desc: '展示一道题目，按选项分支' },
    { type: 'hint', label: '显示提示', desc: '展示提示内容' },
    { type: 'excerpt', label: '展示原文/高亮', desc: '展示教材原文并可高亮片段' },
    { type: 'image', label: '显示图片', desc: '展示一张图片' },
    { type: 'video', label: '播放视频', desc: '学生点击后播放视频（不自动播放）' },
    { type: 'audio', label: '播放音频', desc: '展示音频播放按钮' },
    { type: 'game', label: '显示小游戏', desc: '启动一个可配置小游戏' },
    { type: 'reward', label: '奖励', desc: '发放经验值 / 解锁成就' },
    { type: 'api', label: '调用API评价', desc: '评价学生最近的开放题回答' },
    { type: 'jump', label: '跳转', desc: '跳转到指定节点/关卡/题目/页面' },
    { type: 'return', label: '返回原题', desc: '结束当前分支，返回触发分支的题目' },
    { type: 'end', label: '结束本关', desc: '本关流程结束，进入完成提示' }
  ];

  var QUESTION_TYPES = [
    { type: 'single', label: '单选题' },
    { type: 'multi', label: '多选题' },
    { type: 'judge', label: '判断题' },
    { type: 'fill', label: '填空题' },
    { type: 'open', label: '开放题' },
    { type: 'order', label: '排序题' },
    { type: 'match', label: '配对题' },
    { type: 'clickimg', label: '图片点选题' }
  ];

  var MATERIAL_KINDS = [
    { type: 'text', label: '教材原文' },
    { type: 'expansion', label: '科普拓展' },
    { type: 'word', label: '词语解释' },
    { type: 'knowledge', label: '知识点' },
    { type: 'reference', label: '参考答案/学习建议' }
  ];

  var GAME_TYPES = [
    { type: 'hotspot', label: '森林线索大搜查（热点点击）' },
    { type: 'order', label: '故事顺序拼拼乐（排序）' },
    { type: 'detective', label: '帮野牛当侦探（情境选择）' }
  ];

  /* ---------- 成就条件类型 ---------- */
  var CONDITION_TYPES = [
    { type: 'totalCorrect', label: '累计答对题目数量', field: 'count', unit: '题' },
    { type: 'firstCorrect', label: '首次作答答对数量', field: 'count', unit: '题' },
    { type: 'levelsCompleted', label: '累计完成关卡数量', field: 'count', unit: '关' },
    { type: 'gameCompleted', label: '完成指定小游戏', field: 'gameId', unit: '' },
    { type: 'cluesFound', label: '找到图片线索数量', field: 'count', unit: '个' },
    { type: 'viewMaterial', label: '查看原文/提示次数', field: 'count', unit: '次' },
    { type: 'hintThenCorrect', label: '使用提示后答对数量', field: 'count', unit: '题' },
    { type: 'openCompleted', label: '完成开放题数量', field: 'count', unit: '题' },
    { type: 'eggCompleted', label: '完成指定彩蛋关卡', field: 'levelId', unit: '' },
    { type: 'totalXp', label: '累计获得经验值', field: 'count', unit: '点' },
    { type: 'all', label: '同时满足（组合条件）', field: 'children', unit: '' },
    { type: 'any', label: '满足其一（组合条件）', field: 'children', unit: '' }
  ];

  /* ---------- 新建对象工厂 ---------- */
  function newStage() { return { id: uid('stg'), name: '新阶段', desc: '', levels: [] }; }
  function newLevel(stageId) {
    return {
      id: uid('lvl'), stageId: stageId, name: '新关卡', intro: '',
      startTip: '', completeTip: '', bgImage: null, goals: '',
      countInScore: true, optional: false, isEgg: false,
      entry: null, next: null
    };
  }
  function newNode(type) {
    var n = { id: uid('nd'), type: type, title: '', text: '', media: [], next: null };
    if (type === 'question') n.questionId = null;
    if (type === 'excerpt') { n.materialId = null; n.keywords = []; }
    if (type === 'image') n.caption = '';
    if (type === 'video') { n.caption = ''; n.allowReplay = true; }
    if (type === 'audio') n.caption = '';
    if (type === 'game') n.gameId = null;
    if (type === 'reward') { n.xp = 10; n.achievementId = null; }
    if (type === 'api') {
      n.useGlobalPrompts = true; n.systemPrompt = ''; n.userPromptTemplate = '';
      n.reference = ''; n.criteria = '';
    }
    if (type === 'jump') n.jump = { targetType: 'node', targetId: null };
    return n;
  }
  function newQuestion(type) {
    var q = {
      id: uid('q'), type: type || 'single', text: '', media: [], materialId: null,
      knowledgePoint: '', options: [], answers: [],
      hint: '', correctFeedback: '', wrongFeedback: '', reference: '',
      score: 10, countAttempts: true, inReport: true, useAPI: false
    };
    if (type === 'judge') {
      q.options = [
        { id: uid('op'), text: '正确', correct: true, feedback: '', next: null, media: [] },
        { id: uid('op'), text: '错误', correct: false, feedback: '', next: null, media: [] }
      ];
    } else if (type === 'single' || type === 'multi') {
      q.options = [
        { id: uid('op'), text: '', correct: false, feedback: '', next: null, media: [] },
        { id: uid('op'), text: '', correct: false, feedback: '', next: null, media: [] }
      ];
    }
    return q;
  }
  function newMaterial(kind) {
    return { id: uid('mat'), kind: kind || 'text', title: '新材料', content: '', keywords: [] };
  }
  function newGame(type) {
    var g = { id: uid('gm'), type: type || 'hotspot', name: '新小游戏', desc: '', config: {} };
    if (type === 'hotspot') {
      g.config = {
        bgImage: null, hotspots: [], requireAll: true, targetCount: 1,
        foundFeedback: '', missFeedback: '', completeFeedback: '', rewardXp: 15
      };
    } else if (type === 'order') {
      g.config = {
        cards: [], correctOrder: [], wrongHint: '', completeFeedback: '',
        rewardXp: 15, showCheckButton: true
      };
    } else if (type === 'detective') {
      g.config = {
        scenario: '', options: [], completeWhen: 'any', rewardXp: 15, achievementId: null,
        intro: ''
      };
    }
    return g;
  }
  function newAchievement() {
    return {
      id: uid('ach'), name: '新成就', desc: '', icon: null, iconEmoji: '🏅',
      hidden: false, repeatable: false, unlockedTip: '', xp: 20,
      condition: { type: 'totalCorrect', count: 1 }
    };
  }

  /* ---------- 导入迁移与清洗 ---------- */
  function migrate(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('项目文件不是有效的 JSON 对象');
    var p = JSON.parse(JSON.stringify(raw));
    if (!p.schemaVersion) p.schemaVersion = 1;
    if (p.schemaVersion > SCHEMA_VERSION) {
      throw new Error('项目版本(v' + p.schemaVersion + ')高于本框架支持的最高版本(v' + SCHEMA_VERSION + ')，请升级框架');
    }
    // 逐步升级占位：未来 schemaVersion 2/3 在此转换
    var base = emptyProject();
    p.meta = Object.assign({}, base.meta, p.meta || {});
    p.theme = Object.assign({}, base.theme, p.theme || {});
    p.stages = Array.isArray(p.stages) ? p.stages : [];
    p.levels = p.levels || {};
    p.nodes = p.nodes || {};
    p.questions = p.questions || {};
    p.materials = Array.isArray(p.materials) ? p.materials : [];
    p.games = p.games || {};
    p.assets = p.assets || {};
    p.achievements = Array.isArray(p.achievements) ? p.achievements : [];
    p.xpRules = Object.assign({}, base.xpRules, p.xpRules || {});
    p.feedback = Object.assign({}, base.feedback, p.feedback || {});
    p.api = Object.assign({}, base.api, p.api || {});
    delete p.api.key; // 双保险：导入文件中的 key 一律丢弃
    return p;
  }

  /* ---------- 校验 ---------- */
  // 返回 { errors:[{where,msg}], warnings:[{where,msg}] }
  function validate(project) {
    var errors = [], warnings = [];
    var P = project;
    function err(where, msg) { errors.push({ where: where, msg: msg }); }
    function warn(where, msg) { warnings.push({ where: where, msg: msg }); }

    if (!P.meta || !P.meta.title) err('项目信息', '项目标题为空');

    // 阶段 / 关卡
    (P.stages || []).forEach(function (st, si) {
      if (!st || !st.id) err('阶段#' + (si + 1), '阶段缺少 ID');
      if (!st || !st.name) warn('阶段#' + (si + 1), '阶段名称为空');
      (st.levels || []).forEach(function (lid) {
        if (!P.levels[lid]) err('阶段「' + (st.name || si + 1) + '」', '引用了不存在的关卡 ' + lid);
      });
    });
    Object.keys(P.levels).forEach(function (lid) {
      var L = P.levels[lid];
      var where = '关卡「' + (L.name || lid) + '」';
      if (!L.stageId || !P.stages.some(function (s) { return s.id === L.stageId; })) {
        err(where, '关卡没有归属到任何阶段');
      }
      if (!L.entry || !P.nodes[L.entry]) err(where, '未设置入口节点或入口节点不存在');
      if (L.bgImage && !P.assets[L.bgImage]) err(where, '背景图素材不存在: ' + L.bgImage);
      if (L.next && L.next.type === 'level' && !P.levels[L.next.levelId]) {
        err(where, '“完成后进入”指向不存在的关卡');
      }
    });
    // 孤儿关卡（不在任何阶段中）
    var inStage = {};
    (P.stages || []).forEach(function (s) { (s.levels || []).forEach(function (l) { inStage[l] = 1; }); });
    Object.keys(P.levels).forEach(function (lid) {
      if (!inStage[lid]) warn('关卡「' + (P.levels[lid].name || lid) + '」', '未加入任何阶段，学生将看不到它');
    });

    // 节点
    var nodeIds = Object.keys(P.nodes);
    nodeIds.forEach(function (nid) {
      var N = P.nodes[nid];
      var where = '节点「' + (N.title || N.id) + '」(' + N.type + ')';
      if (N.type === 'question') {
        if (!N.questionId || !P.questions[N.questionId]) err(where, '引用了不存在的问题 ' + N.questionId);
        if (!N.next && !P.questions[N.questionId]) err(where, '未设置后续节点');
      }
      if (N.type === 'excerpt') {
        if (!N.materialId || !(P.materials || []).some(function (m) { return m.id === N.materialId; })) {
          err(where, '引用了不存在的教学材料');
        }
      }
      if (N.type === 'game' && (!N.gameId || !P.games[N.gameId])) err(where, '引用了不存在的小游戏');
      if (N.type === 'reward' && N.achievementId && !(P.achievements || []).some(function (a) { return a.id === N.achievementId; })) {
        err(where, '引用了不存在的成就');
      }
      if ((N.type === 'image' || N.type === 'video' || N.type === 'audio')) {
        (N.media || []).forEach(function (aid) {
          if (!P.assets[aid]) err(where, '素材不存在: ' + aid);
        });
        if (!(N.media || []).length) err(where, '没有选择素材');
      }
      if (N.next && !P.nodes[N.next]) err(where, '后续节点不存在: ' + N.next);
      if (N.type === 'jump') {
        var j = N.jump || {};
        if (j.targetType === 'node' && !P.nodes[j.targetId]) err(where, '跳转目标节点不存在');
        if (j.targetType === 'level' && !P.levels[j.targetId]) err(where, '跳转目标关卡不存在');
        if (j.targetType === 'question' && !P.questions[j.targetId]) err(where, '跳转目标题目不存在');
        if (!j.targetType) err(where, '未设置跳转目标');
      }
      // 死路判断（end/return/jump 视为有出口）
      var hasExit = N.next || N.type === 'end' || N.type === 'return' ||
        (N.type === 'jump' && N.jump && N.jump.targetType);
      if (!hasExit) err(where, '没有后续出口（死路）');
    });

    // 题目
    Object.keys(P.questions).forEach(function (qid) {
      var Q = P.questions[qid];
      var where = '题目「' + (Q.text ? Q.text.slice(0, 12) : qid) + '」';
      if (!Q.text) err(where, '题目文本为空');
      (Q.media || []).forEach(function (aid) { if (!P.assets[aid]) err(where, '素材不存在: ' + aid); });
      if (Q.materialId && !(P.materials || []).some(function (m) { return m.id === Q.materialId; })) {
        err(where, '引用的教学材料不存在');
      }
      if (['single', 'multi', 'judge'].indexOf(Q.type) >= 0) {
        if (!Q.options || Q.options.length < 2) err(where, '选项少于 2 个');
        if (!Q.options || !Q.options.some(function (o) { return o.correct; })) err(where, '没有设置正确答案');
        (Q.options || []).forEach(function (o, oi) {
          if (!o.text) err(where, '选项' + (oi + 1) + '文本为空');
          if (!o.feedback) warn(where, '选项' + (oi + 1) + '未设置专属反馈（将使用题目通用反馈）');
          if (o.next && !P.nodes[o.next]) err(where, '选项' + (oi + 1) + '的分支节点不存在: ' + o.next);
        });
        if (!Q.correctFeedback) warn(where, '未设置答对反馈');
        if (!Q.wrongFeedback) warn(where, '未设置答错反馈');
      }
      if (Q.type === 'fill' && (!Q.answers || !Q.answers.length)) err(where, '填空题未设置正确答案');
      if (Q.type === 'open') {
        if (!Q.reference && !P.feedback.openDefault) warn(where, '开放题未设置参考答案，且未设置通用备用反馈');
        if (Q.useAPI && !P.api.endpoint) warn(where, '本题调用 API，但全局 API 地址未配置（将使用备用反馈）');
      }
      if (Q.type === 'clickimg') {
        if (!(Q.media || []).length) err(where, '图片点选题未选择图片');
        (Q.options || []).forEach(function (o) { if (!o.region) err(where, '选项缺少点击区域'); });
      }
      if (Q.type === 'match') {
        var pairs = {};
        (Q.options || []).forEach(function (o) {
          if (!o.pairKey) err(where, '配对题存在未配对的选项');
          pairs[o.pairKey] = (pairs[o.pairKey] || 0) + 1;
        });
        Object.keys(pairs).forEach(function (k) { if (pairs[k] !== 2) err(where, '配对「' + k + '」不是成对出现'); });
      }
      if (Q.type === 'order' && (!Q.options || Q.options.length < 2)) err(where, '排序题至少需要 2 个条目');
    });

    // 关卡内可达性 / 可退出性
    Object.keys(P.levels).forEach(function (lid) {
      var L = P.levels[lid];
      var where = '关卡「' + (L.name || lid) + '」';
      if (!L.entry || !P.nodes[L.entry]) return;
      // 从 entry 可达
      var reach = {}, q = [L.entry];
      while (q.length) {
        var id = q.pop();
        if (reach[id]) continue;
        reach[id] = 1;
        var N = P.nodes[id];
        if (!N) continue;
        var outs = outgoing(N, P);
        outs.forEach(function (t) { if (P.nodes[t] && !reach[t]) q.push(t); });
      }
      // 本关不可达节点（可能是共享给别的关卡的，所以只做提示）
      Object.keys(P.nodes).forEach(function (nid) {
        if (!reach[nid] && !nodeUsedByOtherLevel(P, nid, lid)) {
          warn(where, '节点「' + (P.nodes[nid].title || nid) + '」从本关入口无法到达');
        }
      });
      // 可退出性：能到达 end / 跳转到关卡/主页/报告 / return 的节点
      var canExit = {};
      function exitsFlow(N) {
        if (N.type === 'end') return true;
        if (N.type === 'return') return true;
        if (N.type === 'jump' && N.jump && ['level', 'home', 'report', 'end'].indexOf(N.jump.targetType) >= 0) return true;
        return false;
      }
      var changed = true;
      while (changed) {
        changed = false;
        Object.keys(P.nodes).forEach(function (nid) {
          if (canExit[nid]) return;
          var N = P.nodes[nid];
          if (exitsFlow(N)) { canExit[nid] = 1; changed = true; return; }
          var outs = outgoing(N, P);
          for (var i = 0; i < outs.length; i++) {
            if (canExit[outs[i]]) { canExit[nid] = 1; changed = true; break; }
          }
        });
      }
      Object.keys(reach).forEach(function (nid) {
        if (!canExit[nid]) err(where, '节点「' + (P.nodes[nid].title || nid) + '」无法退出本关流程（死循环）');
      });
    });

    // 素材引用（成就图标 / 游戏配置）
    (P.achievements || []).forEach(function (a) {
      if (a.icon && !P.assets[a.icon]) err('成就「' + a.name + '」', '图标素材不存在');
    });
    Object.keys(P.games).forEach(function (gid) {
      var G = P.games[gid];
      var where = '小游戏「' + (G.name || gid) + '」';
      if (G.type === 'hotspot' && G.config.bgImage && !P.assets[G.config.bgImage]) err(where, '背景图素材不存在');
      if (G.type === 'hotspot' && !(G.config.hotspots || []).length) err(where, '未配置任何热点');
      if (G.type === 'order' && (!G.config.cards || G.config.cards.length < 2)) err(where, '排序卡片少于 2 张');
      if (G.type === 'detective' && (!G.config.options || !G.config.options.length)) err(where, '未配置任何行动选项');
    });

    // API Key 泄漏检查
    if (P.api && P.api.key) err('API 设置', '项目配置中意外包含 API Key，导出前必须移除');

    return { errors: errors, warnings: warnings };
  }

  function outgoing(N, P) {
    var outs = [];
    if (N.next) outs.push(N.next);
    if (N.type === 'question' && N.questionId && P.questions[N.questionId]) {
      (P.questions[N.questionId].options || []).forEach(function (o) { if (o.next) outs.push(o.next); });
    }
    if (N.type === 'jump' && N.jump) {
      if (N.jump.targetType === 'node' && N.jump.targetId) outs.push(N.jump.targetId);
    }
    return outs;
  }
  function nodeUsedByOtherLevel(P, nid, exceptLevelId) {
    var used = false;
    Object.keys(P.levels).forEach(function (lid) {
      if (lid === exceptLevelId) return;
      var L = P.levels[lid];
      if (!L.entry) return;
      var reach = {}, q = [L.entry];
      while (q.length) {
        var id = q.pop();
        if (reach[id]) continue;
        reach[id] = 1;
        if (id === nid) { used = true; return; }
        var N = P.nodes[id];
        if (!N) continue;
        outgoing(N, P).forEach(function (t) { if (!reach[t]) q.push(t); });
      }
    });
    return used;
  }

  /* 收集某关卡流程中实际出现的题目（编辑器左侧树用） */
  function levelQuestionIds(P, levelId) {
    var L = P.levels[levelId];
    if (!L || !L.entry) return [];
    var reach = {}, q = [L.entry], out = [];
    while (q.length) {
      var id = q.pop();
      if (reach[id]) continue;
      reach[id] = 1;
      var N = P.nodes[id];
      if (!N) continue;
      if (N.type === 'question' && N.questionId && out.indexOf(N.questionId) < 0) out.push(N.questionId);
      outgoing(N, P).forEach(function (t) { if (!reach[t]) q.push(t); });
    }
    return out;
  }

  window.Schema = {
    version: SCHEMA_VERSION,
    uid: uid,
    emptyProject: emptyProject,
    migrate: migrate,
    validate: validate,
    levelQuestionIds: levelQuestionIds,
    NODE_TYPES: NODE_TYPES,
    QUESTION_TYPES: QUESTION_TYPES,
    MATERIAL_KINDS: MATERIAL_KINDS,
    GAME_TYPES: GAME_TYPES,
    CONDITION_TYPES: CONDITION_TYPES,
    newStage: newStage,
    newLevel: newLevel,
    newNode: newNode,
    newQuestion: newQuestion,
    newMaterial: newMaterial,
    newGame: newGame,
    newAchievement: newAchievement
  };
})();
