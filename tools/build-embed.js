/* 生成 editor/js/embedded-sources.js：
 * 把学生网页所需的引擎/共享文件内嵌为字符串，
 * 使编辑器在 file:// 协议下（fetch 不可用）也能导出完整网页。
 * 修改 engine/ 或 shared/ 下的文件后，请重新运行：node tools/build-embed.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const files = [
  'play.html',
  'shared/schema.js',
  'shared/db.js',
  'engine/player.css',
  'engine/js/store.js',
  'engine/js/api.js',
  'engine/js/achievements.js',
  'engine/js/renderers.js',
  'engine/js/games.js',
  'engine/js/engine.js',
  'engine/js/report.js'
];

let out = '/* 自动生成，请勿手改。更新引擎后运行 node tools/build-embed.js */\n';
out += 'window.EMBEDDED_SOURCES = {\n';
files.forEach(function (f) {
  const content = fs.readFileSync(path.join(ROOT, f), 'utf8');
  out += JSON.stringify(f) + ': ' + JSON.stringify(content) + ',\n';
});
out += '};\n';
fs.writeFileSync(path.join(ROOT, 'editor', 'js', 'embedded-sources.js'), out);
console.log('embedded-sources.js written,', files.length, 'files,', (out.length / 1024).toFixed(1) + 'KB');
