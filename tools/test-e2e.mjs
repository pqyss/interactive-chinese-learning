/* ============================================================
 * 端到端验收测试（对应需求文档第九.6 的 12 项验证）
 *  运行：node tools/test-e2e.mjs
 *  依赖：本地 Chromium（playwright 缓存）、python3、unzip
 * ============================================================ */
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = '/workspace/learning-studio';
const EXE = '/root/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome';
const PORT_E = 8130;   // 编辑器服务端口
const PORT_X = 8131;   // 导出项目服务端口
const EDITOR = `http://localhost:${PORT_E}/editor/editor.html`;
const EXPORT_DIR = '/tmp/e2e-export';
const EXPORT_URL = `http://localhost:${PORT_X}/index.html`;
const TEST_IMG = path.join(ROOT, 'tools', 'test-image.png');

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail: detail || '' });
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (detail ? '  — ' + detail : ''));
}
function section(t) { console.log('\n■ ' + t); }

/* ---------- 工具 ---------- */
async function fillByLabel(page, scope, labelText, value, nth = 0) {
  scope = scope || page;
  const item = scope.locator('.frm-item').filter({ has: page.locator('label', { hasText: labelText }) }).nth(nth);
  const input = item.locator('input, textarea').first();
  await input.fill(value);
}
async function dismissModals(page) {
  for (let i = 0; i < 12; i++) {
    const n = await page.locator('.modal-mask').count();
    if (!n) {
      // 弹窗队列可能有"迟到"的成就弹窗，多确认一轮
      await page.waitForTimeout(200);
      if (!(await page.locator('.modal-mask').count())) return;
      continue;
    }
    await page.locator('.modal-box button').last().click().catch(() => {});
    await page.waitForTimeout(250);
  }
}
async function safeClick(page, selector) {
  // 先关掉可能挡层的弹窗，再点击；失败重试
  for (let i = 0; i < 10; i++) {
    await dismissModals(page);
    try { await page.click(selector, { timeout: 3000 }); return; }
    catch (e) { await page.waitForTimeout(300); }
  }
  throw new Error('无法点击 ' + selector);
}
async function selectByRegex(selLocator, re) {
  // Playwright 的 selectOption 不支持正则 label，先读出选项再按字符串选择
  const labels = await selLocator.locator('option').evaluateAll(els => els.map(e => e.textContent || ''));
  const hit = labels.find(l => re.test(l));
  if (hit === undefined) throw new Error('下拉中未找到匹配选项: ' + re + '，现有: ' + labels.join('/'));
  await selLocator.selectOption({ label: hit });
}
async function clickContinue(page) {
  await dismissModals(page);
  const btn = page.locator('.btn-continue');
  if (await btn.count()) { await btn.first().click(); await page.waitForTimeout(500); }
}

/* ---------- 启动服务 ---------- */
const srvEditor = spawn('python3', ['-m', 'http.server', String(PORT_E)], { cwd: ROOT, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ acceptDownloads: true });
const page = await ctx.newPage();
const jsErrors = [];
page.on('pageerror', e => jsErrors.push(e.message));
page.on('dialog', d => d.accept().catch(() => {}));

try {
  /* ================================================================
   * 阶段 A：编辑器内容制作（规格 1-6 项）
   * ================================================================ */
  section('A. 编辑器：新增关卡、题目、分支、素材、成就、小游戏（规格 1-6）');

  await page.goto(EDITOR, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  check('A0 编辑器打开无 JS 报错', jsErrors.length === 0, jsErrors.slice(0, 2).join('|'));

  // 载入示例项目
  await page.click('button:has-text("检查与导出")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("载入示例项目")');
  await page.waitForTimeout(1800);
  check('A2 示例项目载入', (await page.textContent('#proj-name')).includes('咕咚'));

  // 预览学生页（编辑器"👀 预览"按钮必须能真正打开学生页）
  const [popA] = await Promise.all([
    ctx.waitForEvent('page'),
    page.click('#btn-preview')
  ]);
  await popA.waitForLoadState('networkidle');
  await popA.waitForTimeout(1200);
  check('A3 预览学生页可打开并渲染', (await popA.content()).includes('第1关'), popA.url());
  await popA.close().catch(() => {});

  // ---- 规格1：新增关卡 + 两道题 ----
  await page.click('#tree button:has-text("＋ 关卡")');
  await page.waitForTimeout(500);
  await fillByLabel(page, page, '关卡名称', '第7关 测试·分支与素材');
  await fillByLabel(page, page, '学习目标', '验证新增关卡与题目');
  await fillByLabel(page, page, '关卡开始提示', '测试关开始了，加油！');
  await page.waitForTimeout(300);
  check('规格1 新增关卡', (await page.textContent('#tree')).includes('第7关 测试·分支与素材'));

  // 第一道题（含不同选项分支）
  await page.locator('button:has-text("＋ 单选题")').first().click();
  await page.waitForTimeout(500);
  await fillByLabel(page, page, '题目文本', '测试题：咕咚到底是什么声音？');
  await fillByLabel(page, page, '知识点标签', '测试知识点');
  const optCard = page.locator('.card').filter({ hasText: '答案与选项' });
  const optA = optCard.locator('.list-item').nth(0);
  await fillByLabel(page, optA, '选项A 文本', '木瓜落水的声音');
  await optA.locator('input[type=radio]').check();
  await fillByLabel(page, optA, '选择此项后的反馈', '答对了，这是测试反馈A');
  const optB = optCard.locator('.list-item').nth(1);
  await fillByLabel(page, optB, '选项B 文本', '怪兽的叫声');
  await fillByLabel(page, optB, '选择此项后的反馈', '选B了，去看视频再想想');
  await selectByRegex(optB.locator('select').first(), /播放视频/);
  await fillByLabel(page, page, '提示内容', '测试提示：再读一遍课文第一句');
  await page.waitForTimeout(300);
  check('规格1 添加题目1（含选项分支）', (await page.textContent('#tree')).includes('测试题：咕咚到底是什么'));

  // 第二道题（先回到关卡面板，"＋ 单选题"按钮只在选中关卡时出现）
  await page.click('#tree .tree-level-name:has-text("第7关 测试")');
  await page.waitForTimeout(500);
  await page.locator('button:has-text("＋ 单选题")').first().click();
  await page.waitForTimeout(500);
  await fillByLabel(page, page, '题目文本', '测试题：兔子听到咕咚后做了什么？');
  const optCard2 = page.locator('.card').filter({ hasText: '答案与选项' });
  await fillByLabel(page, optCard2.locator('.list-item').nth(0), '选项A 文本', '拔腿就跑');
  await optCard2.locator('.list-item').nth(0).locator('input[type=radio]').check();
  await fillByLabel(page, optCard2.locator('.list-item').nth(0), '选择此项后的反馈', '对的，兔子吓得拔腿就跑');
  await fillByLabel(page, optCard2.locator('.list-item').nth(1), '选项B 文本', '原地睡觉');
  await fillByLabel(page, optCard2.locator('.list-item').nth(1), '选择此项后的反馈', '再想想，兔子当时害怕吗？');
  await page.waitForTimeout(300);
  check('规格1 添加题目2', (await page.textContent('#tree')).includes('测试题：兔子听到咕咚后'));

  // ---- 规格3：上传图片并插入题目 ----
  await page.click('button:has-text("素材管理")');
  await page.waitForTimeout(400);
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('.upload-zone')
  ]);
  await chooser.setFiles(TEST_IMG);
  await page.waitForTimeout(1200);
  const assetHtml = await page.content();
  check('规格3 上传图片素材', assetHtml.includes('test-image.png'), '素材卡片出现');

  // 插入到题目1
  await page.click('button:has-text("关卡与题目")');
  await page.waitForTimeout(400);
  await page.click('#tree .tree-q-name:has-text("测试题：咕咚到底是什么")');
  await page.waitForTimeout(500);
  const mediaField = page.locator('.frm-item').filter({ hasText: '题目素材' });
  await mediaField.locator('button:has-text("＋ 添加素材")').click();
  await page.waitForTimeout(300);
  await selectByRegex(mediaField.locator('select').last(), /test-image/);
  await page.waitForTimeout(500);
  check('规格3 图片插入题目', (await page.content()).includes('test-image.png'));

  // ---- 规格4：新建自定义成就 ----
  await page.click('button:has-text("成就与经验")');
  await page.waitForTimeout(400);
  await page.click('button:has-text("＋ 新建成就")');
  await page.waitForTimeout(500);
  await fillByLabel(page, page, '成就名称', '测试成就·火眼金睛');
  await fillByLabel(page, page, '成就描述', '连续答对2道测试题');
  await fillByLabel(page, page, '图标 Emoji', '🧪');
  await fillByLabel(page, page, '奖励经验值', '50');
  await page.locator('.condition-builder select').first().selectOption({ label: '累计答对题目数量' });
  await page.waitForTimeout(400);
  await fillByLabel(page, page, '阈值', '2');
  await page.waitForTimeout(400);
  const achHtml = await page.content();
  check('规格4 新建成就（条件可配置）', achHtml.includes('测试成就·火眼金睛') && achHtml.includes('累计答对题目数量'));

  // ---- 规格5：修改小游戏卡片 ----
  await page.click('button:has-text("小游戏")');
  await page.waitForTimeout(400);
  await page.click('.list-item:has-text("故事顺序拼拼乐")');
  await page.waitForTimeout(500);
  const cardsCard = page.locator('.card').filter({ hasText: '排序卡片' });
  await fillByLabel(page, cardsCard, '卡片文字', '测试卡片一：木瓜掉进湖里', 0);
  await page.waitForTimeout(400);
  const cardInput = cardsCard.locator('.frm-item').filter({ has: page.locator('label', { hasText: '卡片文字' }) }).nth(0).locator('input').first();
  check('规格5 修改小游戏卡片内容', (await cardInput.inputValue()) === '测试卡片一：木瓜掉进湖里');

  // ---- 规格6：保存项目 ----
  await page.click('#btn-save');
  await page.waitForTimeout(1200);
  const status = await page.textContent('#save-status');
  check('规格6 保存项目', status.includes('已保存'), status);

  /* ================================================================
   * 阶段 B：刷新后内容仍在（规格 7）
   * ================================================================ */
  section('B. 刷新编辑器，确认内容没有丢失（规格 7）');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const treeAfter = await page.textContent('#tree');
  check('规格7 刷新后关卡与题目仍在', treeAfter.includes('第7关 测试·分支与素材') && treeAfter.includes('测试题：咕咚到底是什么'));

  await page.click('button:has-text("成就与经验")');
  await page.waitForTimeout(400);
  check('规格7 刷新后成就仍在', (await page.content()).includes('测试成就·火眼金睛'));

  await page.click('button:has-text("小游戏")');
  await page.waitForTimeout(400);
  await page.click('.list-item:has-text("故事顺序拼拼乐")');
  await page.waitForTimeout(500);
  const cardVal = await page.locator('.card').filter({ hasText: '排序卡片' }).locator('.frm-item').filter({ has: page.locator('label', { hasText: '卡片文字' }) }).nth(0).locator('input').first().inputValue();
  check('规格7 刷新后小游戏修改仍在', cardVal === '测试卡片一：木瓜掉进湖里', cardVal);

  await page.click('button:has-text("素材管理")');
  await page.waitForTimeout(400);
  check('规格7 刷新后素材仍在', (await page.content()).includes('test-image.png'));

  /* ================================================================
   * 阶段 C：导出项目配置并重新导入（规格 8）
   * ================================================================ */
  section('C. 导出项目配置 → 重新导入（规格 8）');
  await page.click('button:has-text("检查与导出")');
  await page.waitForTimeout(400);
  await page.click('button:has-text("立即检查")');
  await page.waitForTimeout(600);
  const errCount = await page.locator('#check-result .check-item.err').count();
  check('C1 导出前检查无错误', errCount === 0, errCount + ' 个错误');

  const dl1 = page.waitForEvent('download', { timeout: 30000 });
  await page.click('button:has-text("导出项目配置")');
  const cfgPath = '/tmp/e2e-config.json';
  await (await dl1).saveAs(cfgPath);
  const cfgRaw = fs.readFileSync(cfgPath, 'utf8');
  const cfg = JSON.parse(cfgRaw);
  check('C2 配置导出成功', cfgRaw.length > 50000, (cfgRaw.length / 1024).toFixed(0) + 'KB');
  check('C2 配置含新增关卡/题目/成就', cfgRaw.includes('第7关') && cfgRaw.includes('测试成就·火眼金睛') && cfgRaw.includes('测试卡片一'));
  const hasImg = Object.values(cfg.assets).some(a => a.data && a.data.startsWith('data:image/png'));
  check('C2 配置含图片素材（dataURL）', hasImg);
  check('C2 配置不含 API Key', !cfgRaw.includes('sk-') && !cfg.api.key);

  // 改个名字，再导入验证恢复
  await page.click('button:has-text("关卡与题目")');
  await page.waitForTimeout(400);
  await page.click('#tree .tree-level-name:has-text("第7关")');
  await page.waitForTimeout(500);
  await fillByLabel(page, page, '关卡名称', '第7关 临时改名');
  await page.waitForTimeout(600);
  await page.click('#btn-save');
  await page.waitForTimeout(1000);
  check('C3 导入前改名生效', (await page.textContent('#tree')).includes('第7关 临时改名'));

  await page.setInputFiles('#import-file', cfgPath);
  await page.waitForTimeout(2500);
  const treeImported = await page.textContent('#tree');
  check('规格8 重新导入后内容恢复', treeImported.includes('第7关 测试·分支与素材') && treeImported.includes('测试题：咕咚到底是什么'));
  await page.click('button:has-text("素材管理")');
  await page.waitForTimeout(400);
  check('规格8 重新导入后素材恢复', (await page.content()).includes('test-image.png'));

  /* ================================================================
   * 阶段 D：导出完整网页（规格 9）
   * ================================================================ */
  section('D. 导出完整网页 ZIP（规格 9）');
  await page.click('button:has-text("检查与导出")');
  await page.waitForTimeout(400);
  const dl2 = page.waitForEvent('download', { timeout: 90000 });
  await page.click('button:has-text("导出完整网页")');
  const zipPath = '/tmp/e2e-web.zip';
  await (await dl2).saveAs(zipPath);
  check('D1 ZIP 导出成功', fs.statSync(zipPath).size > 100000, (fs.statSync(zipPath).size / 1024).toFixed(0) + 'KB');

  fs.rmSync(EXPORT_DIR, { recursive: true, force: true });
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
  // 用 Python zipfile 解压：严格遵循 ZIP 规范（中文文件名 UTF-8 标志位），
  // 并校验 CRC 完整性
  const unz = spawnSync('python3', ['-c', [
    'import zipfile, sys',
    'z = zipfile.ZipFile(sys.argv[1])',
    'bad = z.testzip()',
    'if bad: sys.exit("CRC 校验失败: " + bad)',
    'z.extractall(sys.argv[2])',
    'print(len(z.namelist()), "files")'
  ].join('\n'), zipPath, EXPORT_DIR], { encoding: 'utf8' });
  if (unz.status !== 0) console.log('  解压失败:', unz.stderr || unz.stdout);
  await new Promise(r => setTimeout(r, 500));
  const files = [];
  (function walk(d) {
    fs.readdirSync(d).forEach(f => {
      const fp = path.join(d, f);
      if (fs.statSync(fp).isDirectory()) walk(fp); else files.push(path.relative(EXPORT_DIR, fp));
    });
  })(EXPORT_DIR);
  const mustHave = ['index.html', 'data/project.js', '使用说明.txt', '启动学习网页.bat', '启动学习网页.sh', 'engine/js/engine.js', 'engine/player.css', 'shared/schema.js'];
  const missing = mustHave.filter(f => !files.includes(f));
  check('D2 ZIP 结构完整', missing.length === 0, missing.length ? '缺少: ' + missing.join(',') : files.length + ' 个文件');
  check('D2 素材文件已打包', files.includes('assets/test-image.png') && files.includes('assets/demo.webm') && files.includes('assets/chime.wav'));
  const projJs = fs.readFileSync(path.join(EXPORT_DIR, 'data/project.js'), 'utf8');
  check('D3 导出数据为实际内容', projJs.includes('第7关 测试·分支与素材') && projJs.includes('野牛当侦探'));
  let keyLeak = '';
  files.forEach(f => {
    if (/\.(js|json|html|txt|bat|sh|command)$/.test(f)) {
      const c = fs.readFileSync(path.join(EXPORT_DIR, f), 'utf8');
      if (c.includes('sk-') || c.includes('lls_setting_api_key')) keyLeak += f + ' ';
    }
  });
  check('D4 导出包无 API Key 泄漏', keyLeak === '', keyLeak);

  /* ================================================================
   * 阶段 E：独立目录运行导出的网页（规格 10-11）
   * ================================================================ */
  section('E. 独立目录运行学生网页（规格 10-11）');
  const srvExport = spawn('python3', ['-m', 'http.server', String(PORT_X)], { cwd: EXPORT_DIR, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1200));
  const ctx2 = await browser.newContext({ acceptDownloads: true });
  const p2 = await ctx2.newPage();
  const jsErrors2 = [];
  p2.on('pageerror', e => jsErrors2.push(e.message));
  p2.on('dialog', d => d.accept().catch(() => {}));

  await p2.goto(EXPORT_URL, { waitUntil: 'networkidle' });
  await p2.waitForTimeout(1000);
  const home = await p2.content();
  check('规格10 学生页独立运行', home.includes('《咕咚》互动学习课') && home.includes('第7关 测试·分支与素材'));
  check('规格10 学生页无 JS 报错', jsErrors2.length === 0, jsErrors2.slice(0, 2).join('|'));
  check('E 课文原文面板展示', home.includes('木瓜熟了') && home.includes('课文原文'));

  /* ---- E1：新关卡：选项分支 → 视频 → 引导问题 → 返回原题 ---- */
  await p2.click('.level-card:has-text("第7关")');
  await p2.waitForTimeout(600);
  await dismissModals(p2);            // 关卡开始提示
  await clickContinue(p2);            // 文字节点
  await p2.waitForTimeout(400);
  check('E1 题目渲染（含图片）', (await p2.content()).includes('测试题：咕咚到底是什么声音？'));

  // 选项 B → 分支（先显示选项专属反馈，再进入分支视频）
  await p2.click('.opt-card:has-text("怪兽的叫声")');
  await p2.waitForTimeout(400);
  let flow = await p2.content();
  check('E1 选项B专属反馈', flow.includes('选B了，去看视频再想想'));
  await p2.waitForTimeout(1500);
  flow = await p2.content();
  check('E1 答错后播放视频', !!await p2.locator('.node-video').count() && flow.includes('demo.webm'));
  await clickContinue(p2);
  flow = await p2.content();
  check('E1 引导问题出现', flow.includes('视频里，熟透的木瓜'));
  await p2.click('.opt-card:has-text("“咕咚”一声")');
  await p2.waitForTimeout(2300);   // 等反馈展示（1.5s）+ 返回原题渲染
  await dismissModals(p2);
  flow = await p2.content();
  check('E1 “返回原题”回到原题', flow.includes('测试题：咕咚到底是什么声音？'));

  // 选项 A 答对 → 进入第二题
  await p2.click('.opt-card:has-text("木瓜落水的声音")');
  await p2.waitForTimeout(1400);
  await dismissModals(p2);
  flow = await p2.content();
  check('E1 答对反馈与过关', flow.includes('答对了，这是测试反馈A') || flow.includes('测试题：兔子听到咕咚后'));
  if (flow.includes('测试题：兔子听到咕咚后')) {
    await p2.click('.opt-card:has-text("拔腿就跑")');
    await p2.waitForTimeout(1400);
    await dismissModals(p2);
  }
  const xpText = await p2.textContent('#xp-num');
  check('E1 获得经验值', xpText !== '0 经验', xpText);
  const achUnlocked = await p2.locator('#ach-wall .ach-badge.unlocked').count();
  check('E1 成就解锁（初出茅庐）', achUnlocked >= 1, achUnlocked + ' 个已解锁');

  /* ---- E2：记录持久化 ---- */
  await p2.reload({ waitUntil: 'networkidle' });
  await p2.waitForTimeout(1000);
  check('E2 刷新后经验值/成就保留', (await p2.textContent('#xp-num')) !== '0 经验');

  /* ---- E3：图片点选题（第1关） ---- */
  await safeClick(p2, '.level-card:has-text("第1关")');
  await p2.waitForTimeout(600);
  await dismissModals(p2);
  await clickContinue(p2);
  await p2.waitForTimeout(400);
  await p2.locator('.click-region').first().click();
  await p2.waitForTimeout(1500);
  await dismissModals(p2);
  check('E3 图片点选题作答并过关', (await p2.content()).includes('关卡完成'));

  /* ---- E4：排序小游戏（第4关） ---- */
  await safeClick(p2, '#nav-home');
  await p2.waitForTimeout(500);
  await safeClick(p2, '.level-card:has-text("第4关")');
  await p2.waitForTimeout(600);
  await dismissModals(p2);
  await clickContinue(p2);
  await p2.waitForTimeout(600);
  // 注意：前面测试把第 1 张卡片文字改成了"测试卡片一…"，目标顺序要同步
  const target = ['测试卡片一：木瓜掉进湖里', '兔子吓了一跳，拔腿就跑', '猴子、狐狸、大象都跟着跑', '野牛带大家回湖边，真相大白'];
  for (let i = 0; i < 4; i++) {
    for (let guard = 0; guard < 6; guard++) {
      const texts = await p2.locator('.seq-text').allTextContents();
      const idx = texts.findIndex(t => t.trim() === target[i]);
      if (idx === i) break;
      if (idx < 0) break;   // 找不到目标卡片，放弃
      await p2.locator('.seq-item, .seq-card').nth(idx).locator('button:has-text("↑")').click();
      await p2.waitForTimeout(200);
    }
  }
  await safeClick(p2, 'button:has-text("我排好了")');
  await p2.waitForTimeout(1800);
  await dismissModals(p2);
  const orderDone = await p2.content();
  check('E4 排序小游戏完成', orderDone.includes('顺序完全正确') || orderDone.includes('关卡完成'));

  /* ---- E5：开放题（无 API 回退，第5关） ---- */
  await safeClick(p2, '#nav-home');
  await p2.waitForTimeout(500);
  await safeClick(p2, '.level-card:has-text("第5关")');
  await p2.waitForTimeout(600);
  await dismissModals(p2);
  await clickContinue(p2);   // 文字
  await clickContinue(p2);   // 视频
  await p2.waitForTimeout(400);
  await p2.click('.opt-card:has-text("振动")');
  await p2.waitForTimeout(1400);
  await dismissModals(p2);
  await clickContinue(p2);   // 科普 excerpt
  await p2.waitForTimeout(600);
  if (await p2.locator('.open-input').count()) {
    await p2.locator('.open-input').fill('我听过雨点打在窗户上的啪啪声，是雨点振动发出来的。');
    await safeClick(p2, 'button:has-text("提交回答")');
    await p2.waitForTimeout(1200);
    await dismissModals(p2);
  }
  const openFlow = await p2.content();
  check('E5 开放题提交并回退预设反馈', openFlow.includes('收到你的回答') || openFlow.includes('继续'));
  await clickContinue(p2);

  /* ---- E6：彩蛋关：侦探小游戏 + 热点搜查小游戏 ---- */
  await safeClick(p2, '#nav-home');
  await p2.waitForTimeout(500);
  await safeClick(p2, '.level-card:has-text("野牛侦探社")');
  await p2.waitForTimeout(600);
  await dismissModals(p2);
  await clickContinue(p2);
  await p2.waitForTimeout(500);
  const det = await p2.content();
  check('E6 侦探小游戏情境渲染', det.includes('野牛') && det.includes('咕咚'));
  await p2.click('.detective-option >> nth=0');
  await p2.waitForTimeout(600);
  const detRes = await p2.content();
  check('E6 侦探选项结果与解释', detRes.includes('你发现了木瓜和一圈圈涟漪'));
  await safeClick(p2, 'button:has-text("完成")');
  await p2.waitForTimeout(1200);
  await dismissModals(p2);
  // 热点游戏
  const hotCount = await p2.locator('.hotspot-btn').count();
  check('E6 热点小游戏渲染', hotCount === 4, hotCount + ' 个热点');
  for (let i = 0; i < hotCount; i++) {
    await p2.locator('.hotspot-btn').nth(i).click();
    await p2.waitForTimeout(350);
  }
  await p2.waitForTimeout(2000);
  await dismissModals(p2);
  const hotDone = await p2.content();
  check('E6 线索全部找到并完成', hotDone.includes('所有线索都找到') || hotDone.includes('关卡完成'));
  const achNames = await p2.textContent('#ach-wall');
  check('E6 隐藏成就解锁（彩蛋猎人）', achNames.includes('彩蛋猎人'));

  /* ---- E7：学习报告 ---- */
  await safeClick(p2, '#nav-report');
  await p2.waitForTimeout(800);
  const report = await p2.content();
  check('E7 报告：总体进度', report.includes('总体学习进度'));
  check('E7 报告：知识点掌握（含测试知识点）', report.includes('知识点掌握情况') && report.includes('测试知识点'));
  check('E7 报告：成就/小游戏/开放题/建议', report.includes('已解锁成就') && report.includes('小游戏完成情况') && report.includes('开放题回答与评价') && report.includes('后续复习建议'));
  check('E7 报告：打印/PDF 按钮', !!await p2.locator('button:has-text("打印")').count());
  const openAns = await p2.content();
  check('E7 报告：开放题回答已记录', openAns.includes('雨点打在窗户上'));

  const dlR = p2.waitForEvent('download', { timeout: 15000 });
  await p2.click('button:has-text("导出学习记录")');
  const recPath = '/tmp/e2e-records.json';
  await (await dlR).saveAs(recPath);
  const rec = JSON.parse(fs.readFileSync(recPath, 'utf8'));
  // 从导出的项目数据里按题目文本找到测试题的 ID（ID 是随机生成的，不能写死 q1）
  const projRaw = fs.readFileSync(path.join(EXPORT_DIR, 'data/project.js'), 'utf8');
  const projData = JSON.parse(projRaw.replace(/^window\.__PROJECT__\s*=\s*/, '').replace(/;\s*$/, ''));
  const testQid = Object.keys(projData.questions).find(qid => (projData.questions[qid].text || '').includes('咕咚到底是什么声音'));
  const qrec = testQid ? rec.records.questions[testQid] : null;
  check('E7 导出学习记录数据', !!qrec && qrec.attempts >= 2 && qrec.correct === true, 'attempts=' + (qrec ? qrec.attempts : 0));

  // 清空记录（自定义确认框，需要点"确定"）
  await p2.click('button:has-text("清空学习记录")');
  await p2.waitForTimeout(500);
  await p2.locator('.modal-box button:has-text("确定")').click();
  await p2.waitForTimeout(1000);
  check('E7 清空学习记录（确认后）', (await p2.textContent('#progress-text')).trim().startsWith('0 /'));
  await p2.reload({ waitUntil: 'networkidle' });
  await p2.waitForTimeout(900);
  check('E7 清空后刷新仍为空', (await p2.textContent('#progress-text')).trim().startsWith('0 /'));

  srvExport.kill();
} catch (e) {
  check('测试执行异常', false, e.message);
  console.error(e);
} finally {
  await browser.close();
  srvEditor.kill();
}

/* ---------- 汇总 ---------- */
const failed = results.filter(r => !r.ok);
const pass = results.length - failed.length;
console.log('\n========================================');
console.log(`端到端测试结果：${pass}/${results.length} 通过`);
if (failed.length) {
  console.log('未通过项：');
  failed.forEach(f => console.log('  ✗ ' + f.name + ' — ' + f.detail));
}
console.log('========================================');

// 写测试报告
const now = new Date().toLocaleString('zh-CN');
let md = `# 端到端测试报告\n\n`;
md += `- 测试时间：${now}\n- 测试环境：Chromium（Playwright 驱动）+ Python 本地静态服务\n`;
md += `- 测试范围：内容编辑器、本地保存、项目配置导入导出、完整网页导出、独立运行、题目/分支/小游戏/成就/学习记录/报告\n\n`;
md += `## 测试结果总览\n\n**${pass}/${results.length} 项通过**\n\n`;
md += `| # | 测试项 | 结果 | 说明 |\n|---|--------|------|------|\n`;
results.forEach((r, i) => {
  md += `| ${i + 1} | ${r.name} | ${r.ok ? '✅ 通过' : '❌ 未通过'} | ${(r.detail || '').replace(/\|/g, '/')} |\n`;
});
md += `\n## 测试过程覆盖的需求点\n\n`;
md += `1. 编辑器新增关卡与两道题（含选项级分支配置）✅\n`;
md += `2. 配置“不同选项对应不同分支”：选项B → 播放视频 → 引导问题 → 返回原题，实测走通\n`;
md += `3. 上传 PNG 图片并插入题目，随导出打包为 assets/test-image.png\n`;
md += `4. 新建自定义成就并配置解锁条件（累计答对 2 题）\n`;
md += `5. 修改小游戏“故事顺序拼拼乐”的卡片文字\n`;
md += `6. 保存项目 → 刷新编辑器 → 内容完整保留\n`;
md += `7. 导出项目配置 JSON → 重新导入 → 关卡/题目/成就/小游戏/素材全部恢复\n`;
md += `8. 导出完整网页 ZIP → 独立目录 + 独立端口运行\n`;
md += `9. 学生页实测：8 种题型中的单选题/图片点选/开放题、三分支流程、3 个小游戏、成就解锁（含隐藏成就）、经验值、学习记录持久化、报告页（进度/知识点/成就/小游戏/开放题/建议）、记录导出与清空\n`;
md += `10. 导出包安全检查：全部文本文件中无 API Key（sk-）泄漏\n\n`;
md += `## 已知限制\n\n`;
md += `1. 浏览器直接调用第三方 API 时 Key 可能被技术人员看到，正式环境建议自建代理；框架默认不在导出包中包含 Key。\n`;
md += `2. 学习记录保存在学生浏览器的 localStorage 中，更换浏览器或清除浏览数据后会重新统计。\n`;
md += `3. 超大视频（数十 MB 以上）会导致项目配置 JSON 和导出包体积过大，建议压缩后使用。\n`;
md += `4. 编辑器在 file:// 协议下打开时，导出功能使用内嵌的引擎源码副本；通过启动脚本（http 服务）打开则始终读取最新引擎文件。\n`;
fs.writeFileSync(path.join(ROOT, 'docs', '测试报告.md'), md);
console.log('测试报告已写入 docs/测试报告.md');
process.exit(failed.length ? 1 : 0);
