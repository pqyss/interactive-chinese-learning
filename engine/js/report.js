/* ============================================================
 * 学习报告页：真实记录统计 + 打印/PDF + 数据导出 + 清空
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

  var ReportPage = {};

  ReportPage.show = function () {
    var P = Store.project, R = Store.records;
    Player.state.view = 'report';
    document.getElementById('topbar').style.display = '';
    document.getElementById('topbar-title').textContent = '学习报告';
    document.getElementById('topbar-back').onclick = function () { Player.goHome(); };

    var stage = document.getElementById('stage');
    stage.innerHTML = '';
    stage.className = 'stage-report';

    var page = el('div', 'report-page');
    stage.appendChild(page);

    /* ---------- 抬头 ---------- */
    var head = el('div', 'report-head');
    head.innerHTML = '<h1>📋 ' + esc(P.meta.title || '学习报告') + '</h1>' +
      '<p class="report-sub">' + esc(P.meta.subtitle || '') + '</p>' +
      '<p class="report-time">生成时间：' + new Date().toLocaleString() + '</p>';
    page.appendChild(head);

    /* ---------- 工具按钮（不打印） ---------- */
    var tools = el('div', 'report-tools no-print');
    var printBtn = el('button', 'btn-primary', '🖨️ 打印 / 保存为 PDF');
    printBtn.type = 'button';
    printBtn.onclick = function () { window.print(); };
    tools.appendChild(printBtn);
    var exportBtn = el('button', 'btn-secondary', '💾 导出学习记录');
    exportBtn.type = 'button';
    exportBtn.onclick = function () { exportRecords(); };
    tools.appendChild(exportBtn);
    var clearBtn = el('button', 'btn-danger', '🗑️ 清空学习记录');
    clearBtn.type = 'button';
    clearBtn.onclick = function () {
      Player.confirmDialog('确定要清空当前学生的学习记录吗？此操作不可撤销，报告将重新开始统计。', function () {
        Store.clearRecords();
        Player.refreshSidebar();
        Player.toast('学习记录已清空');
        ReportPage.show();
      });
    };
    tools.appendChild(clearBtn);
    var backBtn = el('button', 'btn-secondary', '🏠 返回首页');
    backBtn.type = 'button';
    backBtn.onclick = function () { Player.goHome(); };
    tools.appendChild(backBtn);
    page.appendChild(tools);

    /* ---------- 1. 总体进度 ---------- */
    var qids = {};
    Object.keys(P.levels).forEach(function (lid) {
      if (P.levels[lid].countInScore === false) return;
      Schema.levelQuestionIds(P, lid).forEach(function (q) { qids[q] = 1; });
    });
    var totalQ = Object.keys(qids).length;
    var correctQ = Object.keys(qids).filter(function (q) { return R.questions[q] && R.questions[q].correct; }).length;
    var touchedQ = Object.keys(qids).filter(function (q) { return R.questions[q]; }).length;
    var levelsDone = Object.keys(R.levels).filter(function (k) { return R.levels[k].completed; }).length;
    var levelsTotal = Object.keys(P.levels).length;

    var sec1 = el('div', 'report-sec');
    sec1.innerHTML = '<h2>📊 总体学习进度</h2>' +
      '<div class="report-cards">' +
      '<div class="report-stat"><b>' + levelsDone + ' / ' + levelsTotal + '</b><span>完成关卡</span></div>' +
      '<div class="report-stat"><b>' + correctQ + ' / ' + totalQ + '</b><span>答对题目</span></div>' +
      '<div class="report-stat"><b>' + (R.xp || 0) + '</b><span>获得经验值</span></div>' +
      '<div class="report-stat"><b>' + Object.keys(R.achievements).length + ' / ' + (P.achievements || []).length + '</b><span>解锁成就</span></div>' +
      '</div>' +
      '<div class="report-progress"><div class="report-progress-fill" style="width:' + (totalQ ? correctQ / totalQ * 100 : 0) + '%"></div></div>';
    page.appendChild(sec1);

    /* ---------- 2. 答题情况 ---------- */
    var firstOk = 0, hintOk = 0, wrongTotal = 0, attemptsTotal = 0;
    Object.keys(qids).forEach(function (q) {
      var rec = R.questions[q];
      if (!rec) return;
      attemptsTotal += rec.attempts || 0;
      if (rec.firstCorrect) firstOk++;
      if (rec.hintUsed && rec.correct) hintOk++;
    });
    var sec2 = el('div', 'report-sec');
    sec2.innerHTML = '<h2>✅ 答题情况</h2>' +
      '<div class="report-cards">' +
      '<div class="report-stat"><b>' + firstOk + '</b><span>首次答对</span></div>' +
      '<div class="report-stat"><b>' + hintOk + '</b><span>提示后答对</span></div>' +
      '<div class="report-stat"><b>' + touchedQ + '</b><span>做过题目</span></div>' +
      '<div class="report-stat"><b>' + attemptsTotal + '</b><span>总作答次数</span></div>' +
      '</div>';
    page.appendChild(sec2);

    /* ---------- 3. 知识点掌握 ---------- */
    var kpMap = {};
    Object.keys(qids).forEach(function (q) {
      var Q = P.questions[q];
      if (!Q) return;
      var kp = Q.knowledgePoint || '未标注知识点';
      var rec = R.questions[q] || { attempts: 0 };
      var m = kpMap[kp] || (kpMap[kp] = { attempts: 0, correct: 0, first: 0, count: 0 });
      m.count++;
      m.attempts += rec.attempts || 0;
      if (rec.correct) m.correct++;
      if (rec.firstCorrect) m.first++;
    });
    var sec3 = el('div', 'report-sec');
    var kpHtml = '<h2>📖 知识点掌握情况</h2>';
    var kpKeys = Object.keys(kpMap);
    if (!kpKeys.length) {
      kpHtml += '<p class="report-note">本项目题目尚未标注知识点。</p>';
    } else {
      kpHtml += '<table class="report-table"><thead><tr><th>知识点</th><th>练习题数</th><th>答对</th><th>首次答对</th><th>掌握情况</th></tr></thead><tbody>';
      kpKeys.forEach(function (kp) {
        var m = kpMap[kp];
        var status, cls;
        if (m.attempts === 0) { status = '尚未评估'; cls = 'lv0'; }
        else if (m.attempts < 2) { status = '练习次数不足'; cls = 'lv1'; }
        else {
          var rate = m.first / m.count;
          if (rate >= 0.8) { status = '掌握良好 🌟'; cls = 'lv3'; }
          else if (rate >= 0.5) { status = '基本掌握 👍'; cls = 'lv2'; }
          else { status = '需要复习 💪'; cls = 'lv1'; }
        }
        kpHtml += '<tr><td>' + esc(kp) + '</td><td>' + m.count + '</td><td>' + m.correct + '</td><td>' + m.first + '</td><td class="' + cls + '">' + status + '</td></tr>';
      });
      kpHtml += '</tbody></table>';
    }
    sec3.innerHTML = kpHtml;
    page.appendChild(sec3);

    /* ---------- 4. 成就 ---------- */
    var sec4 = el('div', 'report-sec');
    var aHtml = '<h2>🏅 已解锁成就</h2>';
    var unlocked = (P.achievements || []).filter(function (a) { return R.achievements[a.id]; });
    if (!unlocked.length) {
      aHtml += '<p class="report-note">还没有解锁成就，继续加油！</p>';
    } else {
      aHtml += '<div class="report-ach-list">';
      unlocked.forEach(function (a) {
        var rec = R.achievements[a.id];
        aHtml += '<div class="report-ach"><span class="report-ach-icon">' + esc(a.iconEmoji || '🏅') + '</span>' +
          '<div><b>' + esc(a.name) + '</b><span>' + esc(a.desc || '') + '</span>' +
          '<span class="report-ach-time">' + new Date(rec.unlockedAt).toLocaleString() + (rec.count > 1 ? ' · 获得 ' + rec.count + ' 次' : '') + '</span></div></div>';
      });
      aHtml += '</div>';
    }
    sec4.innerHTML = aHtml;
    page.appendChild(sec4);

    /* ---------- 5. 小游戏 ---------- */
    var sec5 = el('div', 'report-sec');
    var gHtml = '<h2>🎮 小游戏完成情况</h2>';
    var gameIds = Object.keys(P.games);
    if (!gameIds.length) gHtml += '<p class="report-note">本项目没有配置小游戏。</p>';
    else {
      gHtml += '<table class="report-table"><thead><tr><th>小游戏</th><th>完成情况</th><th>找到线索</th></tr></thead><tbody>';
      gameIds.forEach(function (gid) {
        var G = P.games[gid];
        var rec = R.games[gid];
        gHtml += '<tr><td>' + esc(G.name) + '</td><td>' +
          (rec && rec.completed ? '<span class="lv3">✓ 已完成</span>' : '<span class="lv1">未完成</span>') + '</td><td>' +
          ((rec && rec.cluesFound && rec.cluesFound.length) ? rec.cluesFound.reduce(function (s, n) { return s + n; }, 0) : 0) + ' 个</td></tr>';
      });
      gHtml += '</tbody></table>';
    }
    sec5.innerHTML = gHtml;
    page.appendChild(sec5);

    /* ---------- 6. 开放题回答与评价 ---------- */
    var sec6 = el('div', 'report-sec');
    var openIds = Object.keys(R.openAnswers);
    var oHtml = '<h2>✍️ 开放题回答与评价</h2>';
    if (!openIds.length) oHtml += '<p class="report-note">还没有提交过开放题回答。</p>';
    else {
      openIds.forEach(function (qid) {
        var oa = R.openAnswers[qid];
        var Q = P.questions[qid];
        oHtml += '<div class="report-open"><div class="report-open-q">' + esc(Q ? Q.text : qid) + '</div>' +
          '<div class="report-open-a">' + esc(oa.text) + '</div>' +
          (oa.apiResult ? '<div class="report-open-api">👩‍🏫 老师评价：' + esc(oa.apiResult) + '</div>' : '') +
          '</div>';
      });
    }
    sec6.innerHTML = oHtml;
    page.appendChild(sec6);

    /* ---------- 7. 素材与原文查看 ---------- */
    var sec7 = el('div', 'report-sec');
    var matCount = Object.keys(R.materialsViewed).length;
    var mediaCount = Object.keys(R.mediaViewed).length;
    sec7.innerHTML = '<h2>📚 学习材料查看</h2>' +
      '<div class="report-cards">' +
      '<div class="report-stat"><b>' + matCount + '</b><span>查看过的材料</span></div>' +
      '<div class="report-stat"><b>' + mediaCount + '</b><span>观看的素材节点</span></div>' +
      '</div>';
    page.appendChild(sec7);

    /* ---------- 8. 复习建议 ---------- */
    var sec8 = el('div', 'report-sec');
    var sHtml = '<h2>🌱 后续复习建议</h2><ul class="report-suggest">';
    var weak = [];
    kpKeys.forEach(function (kp) {
      var m = kpMap[kp];
      if (m.attempts >= 1 && m.first / m.count < 0.8) weak.push(kp);
    });
    if (weak.length) {
      sHtml += '<li>建议重点复习：<b>' + weak.map(esc).join('、') + '</b>。可以回到相应关卡再练一次，答错时记得先看提示哦。</li>';
    }
    if (unlocked.length < (P.achievements || []).length) {
      sHtml += '<li>还有 ' + ((P.achievements || []).length - unlocked.length) + ' 个成就等待解锁，试试完成更多练习和小游戏吧！</li>';
    }
    gameIds.forEach(function (gid) {
      if (!R.games[gid] || !R.games[gid].completed) sHtml += '<li>小游戏「' + esc(P.games[gid].name) + '」还没有完成，去挑战一下？</li>';
    });
    if (!weak.length && unlocked.length === (P.achievements || []).length) {
      sHtml += '<li>太棒了！所有内容都完成得很好，可以读一读科普拓展，看看词语解释，继续探索吧。</li>';
    }
    if (P.meta.reviewTip) sHtml += '<li>' + esc(P.meta.reviewTip) + '</li>';
    sHtml += '</ul>';
    sec8.innerHTML = sHtml;
    page.appendChild(sec8);

    Player.refreshSidebar();
  };

  function exportRecords() {
    var data = {
      exportedAt: new Date().toISOString(),
      project: Store.project.meta.title,
      records: Store.records
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '学习记录-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }

  window.ReportPage = ReportPage;
})();
