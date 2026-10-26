/* ============================================================
 * 成就系统：条件判定 / 解锁 / 防重复刷取
 * ============================================================ */
(function () {
  'use strict';

  /* 统计助手 */
  function stats(R) {
    var s = {
      totalCorrect: 0, firstCorrect: 0, hintThenCorrect: 0,
      levelsCompleted: 0, cluesFound: 0, openCompleted: 0, viewMaterial: 0,
      gameCompleted: {}
    };
    Object.keys(R.questions).forEach(function (qid) {
      var q = R.questions[qid];
      if (q.correct) s.totalCorrect++;
      if (q.firstCorrect) s.firstCorrect++;
      if (q.hintUsed && q.correct) s.hintThenCorrect++;
    });
    Object.keys(R.levels).forEach(function (lid) { if (R.levels[lid].completed) s.levelsCompleted++; });
    Object.keys(R.games).forEach(function (gid) {
      var g = R.games[gid];
      if (g.completed) s.gameCompleted[gid] = true;
      s.cluesFound += (g.cluesFound || []).length;
    });
    s.openCompleted = Object.keys(R.openAnswers).length;
    Object.keys(R.materialsViewed).forEach(function (m) { s.viewMaterial += R.materialsViewed[m] || 0; });
    return s;
  }

  function evalCondition(cond, R, project) {
    if (!cond || !cond.type) return false;
    var s = stats(R);
    var t = cond.type;
    if (t === 'totalCorrect') return s.totalCorrect >= (cond.count || 1);
    if (t === 'firstCorrect') return s.firstCorrect >= (cond.count || 1);
    if (t === 'levelsCompleted') return s.levelsCompleted >= (cond.count || 1);
    if (t === 'gameCompleted') return !!s.gameCompleted[cond.gameId];
    if (t === 'cluesFound') return s.cluesFound >= (cond.count || 1);
    if (t === 'viewMaterial') return s.viewMaterial >= (cond.count || 1);
    if (t === 'hintThenCorrect') return s.hintThenCorrect >= (cond.count || 1);
    if (t === 'openCompleted') return s.openCompleted >= (cond.count || 1);
    if (t === 'eggCompleted') {
      var L = project.levels[cond.levelId];
      return !!(L && L.isEgg && R.levels[cond.levelId] && R.levels[cond.levelId].completed);
    }
    if (t === 'totalXp') return R.xp >= (cond.count || 1);
    if (t === 'all') {
      return (cond.children || []).every(function (c) { return evalCondition(c, R, project); });
    }
    if (t === 'any') {
      return (cond.children || []).some(function (c) { return evalCondition(c, R, project); });
    }
    return false;
  }

  /* 当前进度值（用于成就墙展示“还差多少”） */
  function conditionProgress(cond, R, project) {
    var s = stats(R);
    var t = cond.type;
    if (t === 'totalCorrect') return { cur: s.totalCorrect, need: cond.count || 1 };
    if (t === 'firstCorrect') return { cur: s.firstCorrect, need: cond.count || 1 };
    if (t === 'levelsCompleted') return { cur: s.levelsCompleted, need: cond.count || 1 };
    if (t === 'cluesFound') return { cur: s.cluesFound, need: cond.count || 1 };
    if (t === 'viewMaterial') return { cur: s.viewMaterial, need: cond.count || 1 };
    if (t === 'hintThenCorrect') return { cur: s.hintThenCorrect, need: cond.count || 1 };
    if (t === 'openCompleted') return { cur: s.openCompleted, need: cond.count || 1 };
    if (t === 'totalXp') return { cur: R.xp, need: cond.count || 1 };
    if (t === 'gameCompleted') return { cur: s.gameCompleted[cond.gameId] ? 1 : 0, need: 1 };
    if (t === 'eggCompleted') {
      var L = project.levels[cond.levelId];
      var done = L && R.levels[cond.levelId] && R.levels[cond.levelId].completed;
      return { cur: done ? 1 : 0, need: 1 };
    }
    if (t === 'all' || t === 'any') {
      var ch = cond.children || [];
      var cur = ch.filter(function (c) { return evalCondition(c, R, project); }).length;
      return { cur: cur, need: ch.length };
    }
    return { cur: 0, need: 1 };
  }

  /**
   * 检查所有成就，返回本次新解锁的成就数组。
   * 防刷取：成就记录持久化；可重复成就按倍数阈值再次触发。
   */
  function checkAll() {
    var R = Store.records, P = Store.project;
    var unlocked = [];
    (P.achievements || []).forEach(function (a) {
      if (!a || !a.id || !a.condition) return;
      var rec = R.achievements[a.id];
      var times = rec ? (rec.count || 1) : 0;
      var threshold = (a.condition.count || 1) * (times + 1);
      // 对组合/固定型条件，重复获得时阈值同样按倍数推进
      var cond = JSON.parse(JSON.stringify(a.condition));
      if (times > 0 && cond.count) cond.count = threshold;
      if (evalCondition(cond, R, P)) {
        if (!rec) {
          R.achievements[a.id] = { unlockedAt: new Date().toISOString(), count: 1 };
        } else {
          rec.count = times + 1;
          rec.unlockedAt = new Date().toISOString();
        }
        if (a.xp) grantXp(a.xp, '成就:' + a.name);
        unlocked.push(a);
      }
    });
    if (unlocked.length) {
      Store.saveRecords();
      unlocked.forEach(function (a) { Player.showAchievementUnlock(a); });
      Player.refreshSidebar();
    }
    return unlocked;
  }

  function grantXp(n, reason) {
    Store.records.xp += Math.max(0, Math.round(n || 0));
    Store.records.events.push({ t: new Date().toISOString(), type: 'xp', detail: reason + ' +' + n });
    if (Store.records.events.length > 500) Store.records.events = Store.records.events.slice(-500);
  }

  window.Achievements = {
    checkAll: checkAll,
    evalCondition: evalCondition,
    conditionProgress: conditionProgress,
    grantXp: grantXp,
    stats: stats
  };
})();
