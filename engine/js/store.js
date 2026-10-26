/* ============================================================
 * 运行引擎 · 存储与项目加载
 *  - files 模式：导出版，window.__PROJECT__ + assets/ 文件
 *  - idb   模式：编辑器预览，从 IndexedDB 读取
 * ============================================================ */
(function () {
  'use strict';

  var MODE = window.__PLAY_MODE__ || 'files';
  var _urlCache = {};   // assetId -> objectURL（idb 模式）

  function projectIdentity(p) {
    return (p.meta.title || '') + '|' + (p.meta.createdAt || '');
  }

  function loadProject() {
    if (MODE === 'files') {
      var p = window.__PROJECT__;
      if (p) {
        Store.project = window.Schema.migrate(p);
        return Promise.resolve(Store.project);
      }
      // 源码目录中直接打开（未导出）：没有内嵌的 data/project.js，
      // 回退读取编辑器保存的项目（IndexedDB），让门户页"学生学习网页"入口可用。
      return window.DB.getProject().then(function (p2) {
        if (!p2) return Promise.reject(new Error('还没有可运行的项目内容。如果你在源码目录中打开：请先到编辑器里填写并保存，或通过编辑器“预览学生页”打开；如果你拿到的是导出的网页：请确认 data/project.js 与本网页在同一个文件夹。'));
        MODE = 'idb';   // 素材改为从 IndexedDB 读取（blob URL）
        Store.mode = MODE;
        Store.project = window.Schema.migrate(p2);
        return Store.project;
      });
    }
    // idb 模式（编辑器预览）
    return window.DB.getProject().then(function (p) {
      if (!p) return Promise.reject(new Error('还没有项目内容，请先在编辑器中填写并保存'));
      Store.project = window.Schema.migrate(p);
      return Store.project;
    });
  }

  /* 素材 URL：同步（files）或异步（idb，需先 ensureAssets） */
  function assetUrl(id) {
    var P = Store.project;
    var a = P && P.assets[id];
    if (!a) return null;
    if (MODE === 'files') {
      if (a.data) return a.data;            // 内嵌 dataURL（小素材）
      return 'assets/' + a.filename;
    }
    return _urlCache[id] || null;
  }
  function assetUrlAsync(id) {
    var u = assetUrl(id);
    if (u) return Promise.resolve(u);
    if (MODE === 'idb' && Store.project && Store.project.assets[id]) {
      return window.DB.getAssetBlob(id).then(function (blob) {
        if (!blob) return null;
        _urlCache[id] = URL.createObjectURL(blob);
        return _urlCache[id];
      });
    }
    return Promise.resolve(null);
  }
  function ensureAssets() {
    if (MODE !== 'idb' || !Store.project) return Promise.resolve();
    var ids = Object.keys(Store.project.assets);
    return Promise.all(ids.map(assetUrlAsync));
  }

  /* ---------- 学习记录 ---------- */
  var RECORDS_KEY_PREFIX = 'lls_records_v1_';

  function recordsKey() {
    return RECORDS_KEY_PREFIX + btoa(unescape(encodeURIComponent(projectIdentity(Store.project)))).replace(/=+$/, '');
  }

  function blankRecords() {
    return {
      identity: projectIdentity(Store.project),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      xp: 0,
      levels: {}, questions: {}, games: {}, achievements: {},
      materialsViewed: {}, mediaViewed: {}, openAnswers: {}, events: []
    };
  }

  function loadRecords() {
    try {
      var raw = localStorage.getItem(recordsKey());
      if (raw) {
        var r = JSON.parse(raw);
        if (r && r.identity === projectIdentity(Store.project)) return r;
      }
    } catch (e) { /* 忽略损坏数据 */ }
    return blankRecords();
  }
  function saveRecords() {
    Store.records.updatedAt = new Date().toISOString();
    try { localStorage.setItem(recordsKey(), JSON.stringify(Store.records)); } catch (e) {
      console.warn('学习记录保存失败（存储空间不足？）', e);
    }
  }
  function clearRecords() {
    try { localStorage.removeItem(recordsKey()); } catch (e) {}
    Store.records = blankRecords();
    saveRecords();
  }

  /* ---------- 本地设置（API Key 等，绝不进入项目文件） ---------- */
  function getSetting(k, d) {
    try { var v = localStorage.getItem('lls_setting_' + k); return v === null ? d : v; }
    catch (e) { return d; }
  }
  function setSetting(k, v) {
    try { localStorage.setItem('lls_setting_' + k, v); } catch (e) {}
  }

  var Store = {
    mode: MODE,
    project: null,
    records: null,
    loadProject: loadProject,
    ensureAssets: ensureAssets,
    assetUrl: assetUrl,
    assetUrlAsync: assetUrlAsync,
    loadRecords: loadRecords,
    saveRecords: saveRecords,
    clearRecords: clearRecords,
    getSetting: getSetting,
    setSetting: setSetting
  };

  window.Store = Store;
})();
