/* ============================================================
 * IndexedDB 本地存储（编辑器工作区）
 *  - store "project": 键 "current" 保存项目配置 JSON（不含二进制）
 *  - store "assets":  键 assetId 保存 { id, blob, name, mime, kind, size }
 *  - store "kv":      杂项（保存状态、API Key 等）
 * ============================================================ */
(function () {
  'use strict';

  var DB_NAME = 'kids_learning_studio';
  var DB_VERSION = 1;

  function open() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains('project')) db.createObjectStore('project');
        if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets');
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function tx(store, mode, fn) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(store, mode);
        var s = t.objectStore(store);
        var out = fn(s);
        t.oncomplete = function () { resolve(out && out.result !== undefined ? out.result : out); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error); };
      });
    });
  }

  function get(store, key) {
    return tx(store, 'readonly', function (s) { return s.get(key); });
  }
  function put(store, key, val) {
    return tx(store, 'readwrite', function (s) { return s.put(val, key); });
  }
  function del(store, key) {
    return tx(store, 'readwrite', function (s) { return s.delete(key); });
  }
  function all(store) {
    return tx(store, 'readonly', function (s) { return s.getAll(); });
  }
  function clearStore(store) {
    return tx(store, 'readwrite', function (s) { return s.clear(); });
  }

  var DB = {
    /* ---- 项目 ---- */
    getProject: function () { return get('project', 'current'); },
    saveProject: function (p) { return put('project', 'current', p); },

    /* ---- 素材 ---- */
    putAsset: function (id, blob, meta) {
      return put('assets', id, {
        id: id, blob: blob, name: meta.name, mime: meta.mime,
        kind: meta.kind, size: meta.size
      });
    },
    getAssetBlob: function (id) {
      return get('assets', id).then(function (r) { return r ? r.blob : null; });
    },
    allAssetBlobs: function () { return all('assets'); },
    deleteAsset: function (id) { return del('assets', id); },

    /* ---- 杂项 ---- */
    kvGet: function (k) { return get('kv', k); },
    kvPut: function (k, v) { return put('kv', k, v); },

    clearAll: function () {
      return Promise.all([clearStore('project'), clearStore('assets'), clearStore('kv')]);
    }
  };

  window.DB = DB;
})();
