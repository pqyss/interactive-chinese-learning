/* ============================================================
 * 编辑器外壳：状态 / 树 / 标签页 / 保存 / 导入 / 通知
 * ============================================================ */
(function () {
  'use strict';

  function h(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html !== undefined && html !== null) {
      if (typeof html === 'string') d.innerHTML = html;
      else if (html instanceof Node) d.appendChild(html);
      else if (html instanceof Array) html.forEach(function (x) { d.appendChild(x); });
      else d.innerHTML = String(html);
    }
    return d;
  }
  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  var App = {
    project: null,
    sel: { type: 'stage', id: null },
    tab: 'levels',
    panels: {},
    _assetUrls: {},
    _saveTimer: null,
    _dirty: false,

    /* ---------- 生命周期 ---------- */
    init: function () {
      var self = this;
      return DB.getProject().then(function (p) {
        if (p) {
          self.project = Schema.migrate(p);
        } else {
          self.project = Schema.emptyProject();
        }
        return DB.allAssetBlobs();
      }).then(function (blobs) {
        (blobs || []).forEach(function (r) {
          if (r && r.blob) self._assetUrls[r.id] = URL.createObjectURL(r.blob);
        });
      }).then(function () {
        self.renderTopbar();
        self.renderTabs();
        self.renderTree();
        self.switchTab('levels');
        // 默认选中第一个阶段
        if (self.project.stages.length && !self.sel.id) {
          self.select({ type: 'stage', id: self.project.stages[0].id });
        }
        self.setStatus('已加载本地项目');
      }).catch(function (e) {
        self.notice('初始化失败：' + e.message, 'err');
        console.error(e);
      });
    },

    /* ---------- 顶栏 ---------- */
    renderTopbar: function () {
      document.getElementById('proj-name').textContent = this.project.meta.title || '未命名项目';
      document.getElementById('btn-save').onclick = function () { App.saveNow(true); };
      document.getElementById('btn-preview').onclick = function () { App.preview(); };
      document.getElementById('btn-import').onclick = function () { document.getElementById('import-file').click(); };
      document.getElementById('btn-export-json').onclick = function () { Exporter.projectJSON(); };
      document.getElementById('btn-export-zip').onclick = function () { Exporter.fullWeb(); };
      document.getElementById('import-file').onchange = function (e) {
        var f = e.target.files[0];
        if (f) App.importProjectFile(f);
        e.target.value = '';
      };
    },

    /* ---------- 标签页 ---------- */
    TABS: [
      { id: 'levels', label: '🎯 关卡与题目' },
      { id: 'flow', label: '🔀 分支流程' },
      { id: 'materials', label: '📚 教学材料' },
      { id: 'assets', label: '🖼️ 素材管理' },
      { id: 'games', label: '🎮 小游戏' },
      { id: 'achievements', label: '🏅 成就与经验' },
      { id: 'api', label: '⚙️ API 设置' },
      { id: 'check', label: '✅ 检查与导出' }
    ],

    renderTabs: function () {
      var nav = document.getElementById('tabs');
      nav.innerHTML = '';
      this.TABS.forEach(function (t) {
        var b = h('button', 'tab' + (App.tab === t.id ? ' active' : ''), esc(t.label));
        b.type = 'button';
        b.onclick = function () { App.switchTab(t.id); };
        nav.appendChild(b);
      });
    },

    switchTab: function (tab) {
      this.tab = tab;
      this.renderTabs();
      this.renderTab();
    },

    renderTab: function () {
      var box = document.getElementById('tab-content');
      box.innerHTML = '';
      var panel = this.panels[this.tab];
      if (panel && panel.render) panel.render(box);
      else box.appendChild(h('div', 'muted', '面板未实现'));
    },

    /* ---------- 左侧树 ---------- */
    renderTree: function () {
      var self = this;
      var tree = document.getElementById('tree');
      tree.innerHTML = '';
      var head = h('div', 'btn-row');
      var bAddStage = h('button', 'btn small', '＋ 阶段');
      bAddStage.type = 'button';
      bAddStage.onclick = function () {
        var st = Schema.newStage();
        self.project.stages.push(st);
        self.markDirty();
        self.select({ type: 'stage', id: st.id });
      };
      head.appendChild(bAddStage);
      var bAddLevel = h('button', 'btn small', '＋ 关卡');
      bAddLevel.type = 'button';
      bAddLevel.onclick = function () {
        var stg = self.currentStage();
        if (!stg) { self.notice('请先选择一个阶段', 'err'); return; }
        self.addLevel(stg);
      };
      head.appendChild(bAddLevel);
      var bAddQ = h('button', 'btn small', '＋ 题目');
      bAddQ.type = 'button';
      bAddQ.onclick = function () {
        var L = self.currentLevel();
        if (!L) { self.notice('请先选择一个关卡', 'err'); return; }
        self.addQuestion(L);
      };
      head.appendChild(bAddQ);
      tree.appendChild(head);

      if (!this.project.stages.length) {
        tree.appendChild(h('div', 'tree-empty', '还没有阶段，点“＋ 阶段”开始'));
        return;
      }
      this.project.stages.forEach(function (stg) {
        var sEl = h('div', 'tree-stage');
        var name = h('div', 'tree-stage-name' + (self.sel.type === 'stage' && self.sel.id === stg.id ? ' sel' : ''));
        name.innerHTML = '📁 ' + esc(stg.name || '未命名阶段');
        name.onclick = function () { self.select({ type: 'stage', id: stg.id }); };
        sEl.appendChild(name);
        (stg.levels || []).forEach(function (lid) {
          var L = self.project.levels[lid];
          if (!L) return;
          var lEl = h('div', 'tree-level');
          var lname = h('div', 'tree-level-name' + (self.sel.type === 'level' && self.sel.id === lid ? ' sel' : ''));
          lname.innerHTML = (L.isEgg ? '🥚 ' : L.optional ? '📎 ' : '🎯 ') + esc(L.name || '未命名关卡');
          lname.onclick = function () { self.select({ type: 'level', id: lid }); };
          lEl.appendChild(lname);
          var qids = Schema.levelQuestionIds(self.project, lid);
          qids.forEach(function (qid) {
            var Q = self.project.questions[qid];
            if (!Q) return;
            var qEl = h('div', 'tree-q');
            var qname = h('div', 'tree-q-name' + (self.sel.type === 'question' && self.sel.id === qid ? ' sel' : ''));
            var tlabel = (Schema.QUESTION_TYPES.find(function (t) { return t.type === Q.type; }) || {}).label || Q.type;
            qname.innerHTML = '📝 ' + esc((Q.text || '未命名题目').slice(0, 14)) + ' <span class="tag">' + esc(tlabel) + '</span>';
            qname.onclick = function () { self.select({ type: 'question', id: qid }); };
            qEl.appendChild(qname);
            lEl.appendChild(qEl);
          });
          if (!qids.length) lEl.appendChild(h('div', 'tree-empty', '（本关还没有题目节点）'));
          sEl.appendChild(lEl);
        });
        if (!(stg.levels || []).length) sEl.appendChild(h('div', 'tree-empty', '（还没有关卡）'));
        tree.appendChild(sEl);
      });
    },

    select: function (sel) {
      this.sel = sel;
      if (this.tab !== 'levels' && this.tab !== 'flow') this.switchTab('levels');
      else this.renderTab();
      this.renderTree();
    },

    currentStage: function () {
      var self = this;
      if (this.sel.type === 'stage') return this.project.stages.find(function (s) { return s.id === self.sel.id; });
      if (this.sel.type === 'level') {
        var L = this.project.levels[this.sel.id];
        return L && this.project.stages.find(function (s) { return s.id === L.stageId; });
      }
      if (this.sel.type === 'question') {
        var nid = Object.keys(this.project.nodes).find(function (n) {
          return self.project.nodes[n].questionId === self.sel.id;
        });
        var node = nid && this.project.nodes[nid];
        // 找到包含该题目的关卡
        var lid = Object.keys(this.project.levels).find(function (l) {
          return Schema.levelQuestionIds(self.project, l).indexOf(self.sel.id) >= 0;
        });
        var LL = lid && this.project.levels[lid];
        return LL && this.project.stages.find(function (s) { return s.id === LL.stageId; });
      }
      return this.project.stages[0];
    },

    currentLevel: function () {
      var self = this;
      if (this.sel.type === 'level') return this.project.levels[this.sel.id];
      if (this.sel.type === 'question') {
        var lid = Object.keys(this.project.levels).find(function (l) {
          return Schema.levelQuestionIds(self.project, l).indexOf(self.sel.id) >= 0;
        });
        return lid && this.project.levels[lid];
      }
      var stg = this.currentStage();
      if (stg && stg.levels.length) return this.project.levels[stg.levels[stg.levels.length - 1]];
      return null;
    },

    /* ---------- 增删 ---------- */
    addLevel: function (stg) {
      var L = Schema.newLevel(stg.id);
      var start = Schema.newNode('text');
      start.title = L.name + ' · 开始';
      start.text = '欢迎来到「' + L.name + '」！';
      var end = Schema.newNode('end');
      this.project.levels[L.id] = L;
      this.project.nodes[start.id] = start;
      this.project.nodes[end.id] = end;
      L.entry = start.id;
      start.next = end.id;
      stg.levels.push(L.id);
      this.markDirty();
      this.select({ type: 'level', id: L.id });
      this.notice('已添加关卡「' + L.name + '」，请在右侧填写内容', 'ok');
      return L;
    },

    addQuestion: function (L, type) {
      var Q = Schema.newQuestion(type || 'single');
      var node = Schema.newNode('question');
      node.questionId = Q.id;
      node.title = '问题';
      this.project.questions[Q.id] = Q;
      this.project.nodes[node.id] = node;
      // 接入关卡流程：优先插到"结束节点"前面，保持 开始→…→题目→结束 的结构
      if (!L.entry) {
        L.entry = node.id; // 空流程直接作为入口
      } else if (!this.insertBeforeEnd(L, node.id)) {
        // 没有结束节点可插：追加到流程末尾
        var target = this.findFlowTail(L);
        if (target && target.type !== 'end' && target.id !== node.id) target.next = node.id;
      }
      this.markDirty();
      this.select({ type: 'question', id: Q.id });
      this.notice('已添加题目，请在中间区域填写', 'ok');
      return Q;
    },

    /* 把 newNodeId 插入到关卡流程中第一个"结束节点"之前；成功返回 true */
    insertBeforeEnd: function (L, newNodeId) {
      if (!L.entry) return false;
      var endNode = null;
      var visited = {}, q = [L.entry];
      while (q.length) {
        var id = q.shift();
        if (visited[id]) continue;
        visited[id] = 1;
        var N = this.project.nodes[id];
        if (!N) continue;
        if (N.type === 'end') { endNode = N; break; }
        var outs = [];
        if (N.next) outs.push(N.next);
        if (N.type === 'question' && N.questionId) {
          (this.project.questions[N.questionId].options || []).forEach(function (o) { if (o.next) outs.push(o.next); });
        }
        outs.forEach(function (t) { if (!visited[t]) q.push(t); });
      }
      if (!endNode) return false;
      // 入口本身就是结束节点
      if (L.entry === endNode.id) {
        this.project.nodes[newNodeId].next = endNode.id;
        L.entry = newNodeId;
        return true;
      }
      // 精确查找一条指向 endNode 的边（节点 next 或选项分支）
      var edgeFrom = null;
      var visited2 = {}, q2 = [L.entry];
      while (q2.length) {
        var id2 = q2.shift();
        if (visited2[id2]) continue;
        visited2[id2] = 1;
        var N2 = this.project.nodes[id2];
        if (!N2) continue;
        if (N2.next === endNode.id) { edgeFrom = N2; break; }
        if (N2.type === 'question' && N2.questionId) {
          var hitOpt = null;
          (this.project.questions[N2.questionId].options || []).forEach(function (o) {
            if (o.next === endNode.id) hitOpt = o;
          });
          if (hitOpt) { edgeFrom = hitOpt; break; }
        }
        var outs2 = [];
        if (N2.next) outs2.push(N2.next);
        if (N2.type === 'question' && N2.questionId) {
          (this.project.questions[N2.questionId].options || []).forEach(function (o) { if (o.next) outs2.push(o.next); });
        }
        outs2.forEach(function (t) { if (!visited2[t]) q2.push(t); });
      }
      if (!edgeFrom) return false;
      edgeFrom.next = newNodeId;
      this.project.nodes[newNodeId].next = endNode.id;
      return true;
    },

    findFlowTail: function (L) {
      if (!L.entry) return null;
      var visited = {};
      var q = [L.entry], last = null;
      while (q.length) {
        var id = q.shift();
        if (visited[id]) continue;
        visited[id] = 1;
        var N = this.project.nodes[id];
        if (!N) continue;
        last = N;
        var outs = [];
        if (N.next) outs.push(N.next);
        if (N.type === 'question' && N.questionId) {
          (this.project.questions[N.questionId].options || []).forEach(function (o) { if (o.next) outs.push(o.next); });
        }
        outs.forEach(function (t) { if (!visited[t]) q.push(t); });
      }
      return last;
    },

    duplicateLevel: function (lid) {
      var self = this;
      var L = this.project.levels[lid];
      if (!L) return;
      var stg = this.project.stages.find(function (s) { return s.id === L.stageId; });
      var copy = JSON.parse(JSON.stringify(L));
      copy.id = Schema.uid('lvl');
      copy.name = L.name + '（副本）';
      // 复制流程节点与题目
      var idMap = {};
      function cloneQuestion(qid) {
        var Q = self.project.questions[qid];
        if (!Q) return null;
        var nq = JSON.parse(JSON.stringify(Q));
        nq.id = Schema.uid('q');
        self.project.questions[nq.id] = nq;
        idMap[qid] = nq.id;
        return nq.id;
      }
      function cloneFlow(oldEntry) {
        if (!oldEntry) return null;
        var newEntry = null;
        var visited = {};
        var queue = [oldEntry];
        var newIds = {};
        while (queue.length) {
          var nid = queue.shift();
          if (visited[nid]) continue;
          visited[nid] = 1;
          var N = self.project.nodes[nid];
          if (!N) continue;
          var nn = JSON.parse(JSON.stringify(N));
          nn.id = Schema.uid('nd');
          self.project.nodes[nn.id] = nn;
          newIds[nid] = nn.id;
          if (nid === oldEntry) newEntry = nn.id;
          if (N.type === 'question' && N.questionId) {
            nn.questionId = cloneQuestion(N.questionId) || N.questionId;
          }
          var outs = [];
          if (N.next) outs.push(N.next);
          if (N.type === 'question' && N.questionId) {
            (self.project.questions[N.questionId].options || []).forEach(function (o) { if (o.next) outs.push(o.next); });
          }
          outs.forEach(function (t) { if (!visited[t]) queue.push(t); });
        }
        // 重接
        Object.keys(newIds).forEach(function (old) {
          var N = self.project.nodes[old], nn = self.project.nodes[newIds[old]];
          if (N.next && newIds[N.next]) nn.next = newIds[N.next];
          if (N.type === 'question' && N.questionId) {
            var newQ = self.project.questions[nn.questionId];
            var oldQ = self.project.questions[N.questionId];
            (newQ.options || []).forEach(function (o, i) {
              var oldOpt = (oldQ.options || [])[i];
              if (oldOpt && oldOpt.next && newIds[oldOpt.next]) o.next = newIds[oldOpt.next];
            });
          }
        });
        return newEntry;
      }
      copy.entry = cloneFlow(L.entry);
      this.project.levels[copy.id] = copy;
      if (stg) stg.levels.push(copy.id);
      this.markDirty();
      this.select({ type: 'level', id: copy.id });
      this.notice('已复制关卡', 'ok');
    },

    deleteLevel: function (lid) {
      var self = this;
      var L = this.project.levels[lid];
      if (!L) return;
      if (!confirm('确定删除关卡「' + (L.name || '') + '」及其流程和题目吗？此操作不可撤销。')) return;
      // 删除关联节点与题目
      var qids = Schema.levelQuestionIds(this.project, lid);
      qids.forEach(function (q) { delete self.project.questions[q]; });
      var visited = {};
      (function walk(nid) {
        if (!nid || visited[nid]) return;
        visited[nid] = 1;
        var N = self.project.nodes[nid];
        if (!N) return;
        if (N.next) walk(N.next);
        if (N.type === 'question' && N.questionId) {
          (self.project.questions[N.questionId] || { options: [] }).options.forEach(function (o) { if (o.next) walk(o.next); });
        }
        delete self.project.nodes[nid];
      })(L.entry);
      delete this.project.levels[lid];
      this.project.stages.forEach(function (s) {
        s.levels = s.levels.filter(function (l) { return l !== lid; });
      });
      this.markDirty();
      this.select({ type: 'stage', id: this.currentStage() ? this.currentStage().id : null });
    },

    duplicateQuestion: function (qid) {
      var Q = this.project.questions[qid];
      if (!Q) return;
      var copy = JSON.parse(JSON.stringify(Q));
      copy.id = Schema.uid('q');
      copy.text = Q.text + '（副本）';
      this.project.questions[copy.id] = copy;
      // 找到引用原题的问题节点，复制该节点并接在后面
      var self = this;
      var nid = Object.keys(this.project.nodes).find(function (n) { return self.project.nodes[n].questionId === qid; });
      if (nid) {
        var N = this.project.nodes[nid];
        var nn = JSON.parse(JSON.stringify(N));
        nn.id = Schema.uid('nd');
        nn.questionId = copy.id;
        this.project.nodes[nn.id] = nn;
        nn.next = N.next;
        N.next = nn.id;
      }
      this.markDirty();
      this.select({ type: 'question', id: copy.id });
      this.notice('已复制题目', 'ok');
    },

    deleteQuestion: function (qid) {
      var self = this;
      if (!confirm('确定删除这道题目吗？引用它的问题节点会显示为缺失。')) return;
      Object.keys(this.project.nodes).forEach(function (nid) {
        var N = self.project.nodes[nid];
        if (N.type === 'question' && N.questionId === qid) {
          // 旁路掉该节点
          var prev = Object.keys(self.project.nodes).find(function (p) {
            var PN = self.project.nodes[p];
            if (PN.next === nid) return true;
            if (PN.type === 'question' && PN.questionId) {
              return (self.project.questions[PN.questionId].options || []).some(function (o) { return o.next === nid; });
            }
            return false;
          });
          if (prev) {
            var PN = self.project.nodes[prev];
            if (PN.next === nid) PN.next = N.next;
            (PN.type === 'question' && self.project.questions[PN.questionId] ? self.project.questions[PN.questionId].options : [])
              .forEach(function (o) { if (o.next === nid) o.next = N.next; });
          }
        }
      });
      delete this.project.questions[qid];
      this.markDirty();
      this.renderTree();
      this.renderTab();
      this.notice('已删除题目', 'ok');
    },

    /* ---------- 保存 ---------- */
    markDirty: function () {
      var self = this;
      this._dirty = true;
      this.setStatus('有未保存的修改…', true);
      clearTimeout(this._saveTimer);
      this._saveTimer = setTimeout(function () { self.saveNow(false); }, 900);
    },

    saveNow: function (manual) {
      var self = this;
      clearTimeout(this._saveTimer);
      this.project.meta.updatedAt = new Date().toISOString();
      return DB.saveProject(JSON.parse(JSON.stringify(this.project))).then(function () {
        self._dirty = false;
        self.setStatus('已保存 ' + new Date().toLocaleTimeString(), false);
        if (manual) self.notice('项目已保存到浏览器本地', 'ok');
      }).catch(function (e) {
        self.setStatus('保存失败：' + e.message, true);
        self.notice('保存失败：' + e.message, 'err');
      });
    },

    setStatus: function (text, unsaved) {
      var s = document.getElementById('save-status');
      s.textContent = text;
      s.classList.toggle('unsaved', !!unsaved);
    },

    softRefresh: function () {
      this.renderTree();
      document.getElementById('proj-name').textContent = this.project.meta.title || '未命名项目';
    },

    hasUnsaved: function () { return this._dirty; },

    /* ---------- 预览 ---------- */
    preview: function () {
      var self = this;
      this.saveNow(false).then(function () {
        window.open('../play.html?preview=1', '_blank');
      });
    },

    /* ---------- 导入 ---------- */
    importProjectFile: function (file) {
      var self = this;
      var reader = new FileReader();
      reader.onload = function () {
        var data;
        try { data = JSON.parse(reader.result); }
        catch (e) { self.notice('导入失败：不是有效的 JSON 文件', 'err'); return; }
        var p;
        try { p = Schema.migrate(data); }
        catch (e) { self.notice('导入失败：' + e.message, 'err'); return; }
        var result = Schema.validate(p);
        if (result.errors.length) {
          self.notice('导入校验未通过：' + result.errors.length + ' 个错误，详见“检查与导出”', 'err');
          self.project = p;
          self._importedPending = true;
          App.select({ type: 'stage', id: p.stages.length ? p.stages[0].id : null });
          self.switchTab('check');
          return;
        }
        self.applyImportedProject(p, data);
      };
      reader.readAsText(file);
    },

    applyImportedProject: function (p, raw) {
      var self = this;
      // 写入素材二进制
      var jobs = [];
      var assetList = [];
      if (raw && raw.assets) {
        Object.keys(raw.assets).forEach(function (id) {
          var a = raw.assets[id];
          if (a && a.data) {
            assetList.push({ id: id, data: a.data, meta: a });
          } else if (p.assets[id]) {
            assetList.push({ id: id, data: null, meta: p.assets[id] });
          }
        });
      }
      var chain = Promise.resolve();
      assetList.forEach(function (item) {
        chain = chain.then(function () {
          if (item.data) return dataUrlToBlob(item.data).then(function (blob) {
            return DB.putAsset(item.id, blob, item.meta);
          });
          return null;
        });
      });
      chain.then(function () {
        self.project = p;
        return self.saveNow(false);
      }).then(function () {
        self._importedPending = false;
        self.renderTopbar();
        self.notice('项目导入成功' + (assetList.length ? '（含 ' + assetList.length + ' 个素材）' : ''), 'ok');
        self.renderTree();
        self.select({ type: 'stage', id: p.stages.length ? p.stages[0].id : null });
        self.renderTextPanelSafe();
      }).catch(function (e) {
        self.notice('导入素材时出错：' + e.message, 'err');
      });
    },

    renderTextPanelSafe: function () { /* 占位：编辑器无需渲染学生页 */ },

    /* ---------- 通知 ---------- */
    notice: function (msg, kind) {
      var box = document.getElementById('notice');
      var n = h('div', 'notice' + (kind ? ' ' + kind : ''), esc(msg));
      box.appendChild(n);
      setTimeout(function () { n.remove(); }, 4200);
    },

    /* ---------- UI 助手 ---------- */
    ui: {
      h: h, esc: esc,

      txt: function (value, oninput, ph) {
        var i = h('input');
        i.type = 'text'; i.value = value || ''; if (ph) i.placeholder = ph;
        i.addEventListener('input', function () { oninput(i.value); });
        return i;
      },
      num: function (value, oninput) {
        var i = h('input');
        i.type = 'number'; i.value = (value === undefined || value === null) ? '' : value;
        i.addEventListener('input', function () { oninput(i.value === '' ? null : Number(i.value)); });
        return i;
      },
      ta: function (value, oninput, rows) {
        var t = h('textarea');
        t.rows = rows || 3; t.value = value || '';
        t.addEventListener('input', function () { oninput(t.value); });
        return t;
      },
      sel: function (options, value, onchange) {
        var s = h('select');
        options.forEach(function (o) {
          var op = h('option', null, esc(o.label));
          op.value = o.value;
          if (String(o.value) === String(value)) op.selected = true;
          s.appendChild(op);
        });
        s.addEventListener('change', function () { onchange(s.value); });
        return s;
      },
      chk: function (label, checked, onchange) {
        var w = h('label', 'check-line');
        var c = h('input'); c.type = 'checkbox'; c.checked = !!checked;
        c.addEventListener('change', function () { onchange(c.checked); });
        w.appendChild(c);
        w.appendChild(h('span', null, esc(label)));
        return w;
      },
      field: function (label, control, hint) {
        var f = h('div', 'frm-item');
        f.appendChild(h('label', null, esc(label)));
        f.appendChild(control);
        if (hint) f.appendChild(h('div', 'hint', esc(hint)));
        return f;
      },
      row: function (items) {
        var r = h('div', 'frm-row');
        items.forEach(function (i) { r.appendChild(i); });
        return r;
      },
      btn: function (label, onclick, cls) {
        var b = h('button', 'btn' + (cls ? ' ' + cls : ''), esc(label));
        b.type = 'button';
        b.onclick = onclick;
        return b;
      },
      /* 素材选择器 */
      assetPicker: function (kind, value, onChange, allowClear) {
        var self = this;
        var wrap = h('div');
        var opts = [{ value: '', label: '（无）' }];
        Object.keys(App.project.assets).forEach(function (id) {
          var a = App.project.assets[id];
          if (kind && a.kind !== kind) return;
          opts.push({ value: id, label: (a.name || id) + '（' + a.kind + '）' });
        });
        var sel = this.sel(opts, value || '', function (v) {
          onChange(v || null);
          refreshPreview();
        });
        wrap.appendChild(sel);
        var prev = h('div', 'asset-preview');
        function refreshPreview() {
          prev.innerHTML = '';
          var id = sel.value;
          var url = id && App._assetUrls[id];
          var a = id && App.project.assets[id];
          if (url && a && a.kind === 'image') {
            var im = h('img'); im.src = url; prev.appendChild(im);
          } else if (a) {
            prev.appendChild(h('span', 'muted', '已选择：' + esc(a.name)));
          }
        }
        refreshPreview();
        wrap.appendChild(prev);
        var up = h('button', 'btn small', '⬆️ 上传新素材');
        up.type = 'button';
        up.onclick = function () {
          var inp = h('input');
          inp.type = 'file';
          inp.accept = kind === 'image' ? 'image/*' : kind === 'video' ? 'video/*' : kind === 'audio' ? 'audio/*' : '*/*';
          inp.onchange = function () {
            if (!inp.files[0]) return;
            App.uploadAsset(inp.files[0]).then(function (meta) {
              if (kind && meta.kind !== kind) { App.notice('素材类型不匹配', 'err'); return; }
              onChange(meta.id);
              sel.value = meta.id;
              refreshPreview();
            });
          };
          inp.click();
        };
        wrap.appendChild(up);
        return wrap;
      },
      /* 节点下拉 */
      nodeSelect: function (value, onChange, anyLabel) {
        var opts = [{ value: '', label: anyLabel || '（无 / 流程结束）' }];
        Object.keys(App.project.nodes).forEach(function (id) {
          var N = App.project.nodes[id];
          var t = (Schema.NODE_TYPES.find(function (x) { return x.type === N.type; }) || {}).label || N.type;
          opts.push({ value: id, label: '[' + t + '] ' + (N.title || N.text || id).slice(0, 18) });
        });
        return this.sel(opts, value || '', function (v) { onChange(v || null); });
      }
    },

    /* ---------- 素材上传 ---------- */
    uploadAsset: function (file) {
      var self = this;
      var kind = file.type.indexOf('image/') === 0 ? 'image'
        : file.type.indexOf('video/') === 0 ? 'video'
          : file.type.indexOf('audio/') === 0 ? 'audio' : null;
      if (!kind) {
        return Promise.reject(new Error('不支持的文件类型：' + (file.type || file.name)));
      }
      var id = Schema.uid('ast');
      var meta = {
        id: id, name: file.name, kind: kind, mime: file.type,
        note: '', usage: '', size: file.size
      };
      this.project.assets[id] = meta;
      this._assetUrls[id] = URL.createObjectURL(file);
      return DB.putAsset(id, file, meta).then(function () {
        self.markDirty();
        self.notice('素材「' + file.name + '」已上传', 'ok');
        return meta;
      });
    }
  };

  function dataUrlToBlob(dataUrl) {
    return new Promise(function (resolve, reject) {
      try {
        var parts = dataUrl.split(',');
        var mime = (parts[0].match(/:(.*?);/) || [])[1] || 'application/octet-stream';
        var bin = atob(parts[1] || '');
        var len = bin.length;
        var u8 = new Uint8Array(len);
        for (var i = 0; i < len; i++) u8[i] = bin.charCodeAt(i);
        resolve(new Blob([u8], { type: mime }));
      } catch (e) { reject(e); }
    });
  }
  App.dataUrlToBlob = dataUrlToBlob;

  window.App = App;
  window.UI = App.ui;

  document.addEventListener('DOMContentLoaded', function () { App.init(); });
})();
