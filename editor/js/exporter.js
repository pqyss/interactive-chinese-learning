/* ============================================================
 * 导出器
 *  1. runChecks()     导出前检查（错误/警告）
 *  2. projectJSON()   导出项目配置（JSON，素材内嵌 dataURL，可重新导入）
 *  3. fullWeb()       导出完整网页（ZIP：学生页 + 引擎 + 素材文件 + 说明）
 * ============================================================ */
(function () {
  'use strict';

  function log(msg) {
    var box = document.getElementById('export-log');
    if (!box) { console.log(msg); return; }
    var line = document.createElement('div');
    line.className = 'kv';
    line.textContent = '· ' + msg;
    box.appendChild(line);
  }

  function download(blob, filename) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 8000);
  }

  /* ---------------- 检查 ---------------- */
  function runChecks() {
    var P = App.project;
    var res = Schema.validate(P);
    var errors = res.errors.slice();
    var warnings = res.warnings.slice();

    // 素材二进制是否都在本地库
    return DB.allAssetBlobs().then(function (blobs) {
      var have = {};
      (blobs || []).forEach(function (b) { if (b && b.id) have[b.id] = true; });
      Object.keys(P.assets).forEach(function (id) {
        if (!have[id]) errors.push({ where: '素材「' + (P.assets[id].name || id) + '」', msg: '二进制文件不在本地库中，导出会丢失该素材，请重新上传' });
      });
      // 未使用素材提示
      Object.keys(P.assets).forEach(function (id) {
        var used = JSON.stringify(P).split('"' + id + '"').length - 1;
        if (used <= 1) warnings.push({ where: '素材「' + (P.assets[id].name || id) + '」', msg: '没有被任何题目/分支/小游戏/成就引用，导出后仍会打包（确认是否遗漏）' });
      });
      // API Key 泄漏检查（项目配置中绝不允许出现）
      var raw = JSON.stringify(P);
      if (/sk-[A-Za-z0-9]{16,}/.test(raw)) {
        errors.push({ where: 'API 设置', msg: '项目内容中检测到疑似 API Key，导出已阻止' });
      }
      if (P.api && P.api.key) {
        errors.push({ where: 'API 设置', msg: '项目配置包含 api.key 字段，已阻止导出' });
      }
      return { errors: errors, warnings: warnings };
    });
  }

  /* 同步检查（不查 IDB） */
  function runChecksSync() {
    var P = App.project;
    var res = Schema.validate(P);
    var errors = res.errors.slice();
    var warnings = res.warnings.slice();
    var raw = JSON.stringify(P);
    if (/sk-[A-Za-z0-9]{16,}/.test(raw)) errors.push({ where: 'API 设置', msg: '项目内容中检测到疑似 API Key' });
    if (P.api && P.api.key) errors.push({ where: 'API 设置', msg: '项目配置包含 api.key 字段' });
    return { errors: errors, warnings: warnings };
  }

  /* ---------------- 工具 ---------------- */
  function sanitizeName(name) {
    return String(name || 'asset')
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 40) || 'asset';
  }
  function extOf(mime) {
    var map = {
      'image/png': '.png', 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/gif': '.gif',
      'image/webp': '.webp', 'image/svg+xml': '.svg', 'image/bmp': '.bmp',
      'video/mp4': '.mp4', 'video/webm': '.webm', 'video/ogg': '.ogv', 'video/quicktime': '.mov',
      'audio/mpeg': '.mp3', 'audio/mp3': '.mp3', 'audio/wav': '.wav', 'audio/x-wav': '.wav',
      'audio/ogg': '.ogg', 'audio/aac': '.aac', 'audio/webm': '.weba'
    };
    return map[mime] || '';
  }
  function blobToDataURL(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(new Error('素材读取失败')); };
      r.readAsDataURL(blob);
    });
  }
  function blobToU8(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(new Uint8Array(r.result)); };
      r.onerror = function () { reject(new Error('素材读取失败')); };
      r.readAsArrayBuffer(blob);
    });
  }

  /* 给每个资源分配导出文件名 */
  function assignFilenames(P) {
    var used = {};
    Object.keys(P.assets).forEach(function (id) {
      var a = P.assets[id];
      if (!a.filename || used[a.filename]) {
        var base = sanitizeName(a.name).replace(/\.[^.]+$/, '');
        var ext = extOf(a.mime) || '';
        var fn = base + ext;
        var n = 2;
        while (used[fn]) { fn = base + '_' + n + ext; n++; }
        a.filename = fn;
      }
      used[a.filename] = true;
    });
  }

  /* 读取本地静态文件（优先 fetch，file:// 时回退到内嵌副本） */
  function readSource(relPath) {
    return fetch(relPath, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).catch(function () {
      // file:// 下 fetch 被浏览器拦截：回退到构建期内嵌的源码副本。
      // 内嵌副本的键相对于项目根目录（如 shared/schema.js），
      // 而调用方传的是相对 editor/ 的路径（如 ../shared/schema.js），这里归一化。
      var key = relPath.replace(/^(\.\.\/)+/, '');
      var emb = window.EMBEDDED_SOURCES &&
        (window.EMBEDDED_SOURCES[relPath] || window.EMBEDDED_SOURCES[key]);
      if (emb) return Promise.resolve(emb);
      return Promise.reject(new Error('无法读取 ' + relPath + '。请通过“启动脚本”以本地服务器方式打开编辑器后再导出。'));
    });
  }

  /* ---------------- 导出项目配置 JSON ---------------- */
  function projectJSON() {
    var P = App.project;
    log('开始导出项目配置…');
    var ready = App.hasUnsaved() ? App.saveNow(false) : Promise.resolve();
    ready.then(function () {
      return runChecks();
    }).then(function (res) {
      if (res.errors.length) {
        App.notice('导出中止：发现 ' + res.errors.length + ' 个错误，请修复后重试（详见“检查与导出”）', 'err');
        log('✗ 检查未通过：' + res.errors.length + ' 个错误');
        res.errors.slice(0, 8).forEach(function (e) { log('  ✗ ' + e.where + '：' + e.msg); });
        App.switchTab('check');
        return;
      }
      if (res.warnings.length) {
        log('⚠ ' + res.warnings.length + ' 个警告（不阻止导出）');
      }
      var data = JSON.parse(JSON.stringify(P));
      data.meta.exportedAt = new Date().toISOString();
      assignFilenames(data);
      // 内嵌素材
      var ids = Object.keys(data.assets);
      var chain = Promise.resolve();
      ids.forEach(function (id) {
        chain = chain.then(function () {
          return DB.getAssetBlob(id);
        }).then(function (blob) {
          if (!blob) throw new Error('素材「' + data.assets[id].name + '」的二进制不在本地库中');
          return blobToDataURL(blob).then(function (url) {
            data.assets[id].data = url;
          });
        });
      });
      return chain.then(function () {
        var json = JSON.stringify(data, null, 2);
        var sizeMB = (json.length / 1048576).toFixed(2);
        download(new Blob([json], { type: 'application/json' }),
          sanitizeName(P.meta.title) + '-项目配置.json');
        log('✓ 项目配置已导出（' + sizeMB + ' MB，含 ' + ids.length + ' 个素材）');
        App.notice('项目配置已导出，可用于备份或导入继续编辑', 'ok');
      });
    }).catch(function (e) {
      log('✗ 导出失败：' + e.message);
      App.notice('导出失败：' + e.message, 'err');
    });
  }

  /* ---------------- 导出完整网页 ZIP ---------------- */
  function fullWeb() {
    var P = App.project;
    log('开始导出完整网页…');
    var ready = App.hasUnsaved() ? App.saveNow(false) : Promise.resolve();
    ready.then(function () {
      return runChecks();
    }).then(function (res) {
      if (res.errors.length) {
        App.notice('导出中止：发现 ' + res.errors.length + ' 个错误，请修复后重试', 'err');
        log('✗ 检查未通过：' + res.errors.length + ' 个错误');
        res.errors.slice(0, 10).forEach(function (e) { log('  ✗ ' + e.where + '：' + e.msg); });
        App.switchTab('check');
        return;
      }
      if (res.warnings.length) log('⚠ ' + res.warnings.length + ' 个警告（不阻止导出）');

      var data = JSON.parse(JSON.stringify(P));
      data.meta.exportedAt = new Date().toISOString();
      assignFilenames(data);
      // 清理运行时不用的字段
      Object.keys(data.assets).forEach(function (id) { delete data.assets[id].data; });

      var files = [];
      var title = P.meta.title || '互动学习';

      // 1) 学生入口页与引擎
      var sources = [
        ['play.html', 'index.html'],
        ['../shared/schema.js', 'shared/schema.js'],
        ['../shared/db.js', 'shared/db.js'],
        ['../engine/player.css', 'engine/player.css'],
        ['../engine/js/store.js', 'engine/js/store.js'],
        ['../engine/js/api.js', 'engine/js/api.js'],
        ['../engine/js/achievements.js', 'engine/js/achievements.js'],
        ['../engine/js/renderers.js', 'engine/js/renderers.js'],
        ['../engine/js/games.js', 'engine/js/games.js'],
        ['../engine/js/engine.js', 'engine/js/engine.js'],
        ['../engine/js/report.js', 'engine/js/report.js']
      ];
      var chain = Promise.resolve();
      sources.forEach(function (s) {
        chain = chain.then(function () {
          return readSource(s[0]).then(function (text) {
            files.push({ name: s[1], data: new TextEncoder().encode(text) });
          });
        });
      });

      return chain.then(function () {
        // 2) 项目数据（脚本方式内嵌，file:// 双击也能加载）
        files.push({
          name: 'data/project.js',
          data: new TextEncoder().encode('window.__PROJECT__ = ' + JSON.stringify(data) + ';\n')
        });
        // 3) 素材文件
        var ids = Object.keys(data.assets);
        var achain = Promise.resolve();
        ids.forEach(function (id) {
          achain = achain.then(function () {
            return DB.getAssetBlob(id).then(function (blob) {
              if (!blob) throw new Error('素材「' + data.assets[id].name + '」的二进制不在本地库中，请重新上传');
              return blobToU8(blob).then(function (u8) {
                files.push({ name: 'assets/' + data.assets[id].filename, data: u8 });
              });
            });
          });
        });
        return achain.then(function () {
          // 4) 说明与启动脚本
          files.push({ name: '使用说明.txt', data: new TextEncoder().encode(buildReadme(title)) });
          files.push({ name: '启动学习网页.bat', data: new TextEncoder().encode(buildBat()) });
          files.push({ name: '启动学习网页.command', data: new TextEncoder().encode(buildSh()) });
          files.push({ name: '启动学习网页.sh', data: new TextEncoder().encode(buildSh()) });

          var zipBlob = ZipKit.makeZip(files);
          var sizeMB = (zipBlob.size / 1048576).toFixed(2);
          download(zipBlob, sanitizeName(title) + '-学习网页.zip');
          log('✓ 完整网页已导出：' + sanitizeName(title) + '-学习网页.zip（' + sizeMB + ' MB）');
          log('  包含：学生网页 + 引擎 + ' + ids.length + ' 个素材文件 + 使用说明 + 启动脚本');
          App.notice('完整网页导出成功！解压后即可交给老师使用', 'ok');
        });
      });
    }).catch(function (e) {
      log('✗ 导出失败：' + e.message);
      App.notice('导出失败：' + e.message, 'err');
      console.error(e);
    });
  }

  function buildReadme(title) {
    return [
      '========================================',
      '  ' + title + ' · 互动学习网页',
      '  由“儿童互动学习网页框架”导出',
      '  导出时间：' + new Date().toLocaleString(),
      '========================================',
      '',
      '一、如何打开（推荐）',
      '  双击本文件夹中的“启动学习网页.bat”（Windows）',
      '  或“启动学习网页.command”（macOS）',
      '  或“启动学习网页.sh”（Linux），',
      '  会自动启动本地服务并打开学习页面。',
      '',
      '二、直接双击 index.html 通常也可以运行',
      '  （ Chrome / Edge / Firefox 均支持；',
      '    若浏览器安全设置较严，请使用上面的启动脚本 ）',
      '',
      '三、文件夹说明',
      '  index.html      学生学习入口',
      '  engine/          互动引擎（题目、分支、小游戏、成就、报告）',
      '  shared/          共享数据模型',
      '  data/project.js  全部教学内容（题目/分支/素材清单/成就规则）',
      '  assets/          图片、视频、音频素材',
      '',
      '四、常见问题',
      '  · 学习记录保存在本机浏览器中，换电脑/换浏览器后会重新开始；',
      '  · 在报告页可以打印、保存 PDF、导出学习记录、清空记录；',
      '  · 本网页不需要联网，也不需要任何服务器数据库；',
      '  · 开放题 API 评价需要在编辑器所在电脑上单独配置 Key，',
      '    导出的网页默认不包含 Key，未配置时自动使用备用反馈。',
      '',
      '五、重新编辑内容',
      '  请使用本框架的内容编辑器打开“项目配置 JSON”继续修改，',
      '  然后重新导出完整网页。不要直接修改 data/project.js。',
      ''
    ].join('\r\n');
  }

  function buildBat() {
    return [
      '@echo off',
      'chcp 65001 >nul',
      'cd /d %~dp0',
      'echo 正在启动本地服务，请稍候…',
      'echo 启动后请用浏览器访问 http://localhost:8001/index.html',
      'echo 关闭此窗口即可停止服务。',
      'start "" http://localhost:8001/index.html',
      'where python >nul 2>nul && (python -m http.server 8001) || (py -m http.server 8001)',
      'pause'
    ].join('\r\n');
  }

  function buildSh() {
    return [
      '#!/bin/sh',
      'cd "$(dirname "$0")"',
      'echo "启动后请用浏览器访问 http://localhost:8001/index.html"',
      '(sleep 1; (command -v xdg-open >/dev/null && xdg-open http://localhost:8001/index.html) || (command -v open >/dev/null && open http://localhost:8001/index.html)) &',
      'python3 -m http.server 8001 || python -m http.server 8001'
    ].join('\n');
  }

  window.Exporter = {
    runChecks: runChecks,
    runChecksSync: runChecksSync,
    projectJSON: projectJSON,
    fullWeb: fullWeb
  };
})();
