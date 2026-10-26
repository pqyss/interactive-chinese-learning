/* ============================================================
 * 生成示例项目 examples/demo-project.json
 * 《咕咚》主题演示：覆盖 8 种题型、三分支演示、3 个小游戏、
 * 成就条件组合、素材引用。素材以 dataURL 内嵌。
 * 运行：node tools/make-demo.js
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/* ---------- 工具 ---------- */
function b64(str) { return Buffer.from(str, 'utf8').toString('base64'); }
function svgUrl(svg) { return 'data:image/svg+xml;base64,' + b64(svg); }

/* ---------- SVG 素材 ---------- */
const FOREST_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#aee3f5"/><stop offset="1" stop-color="#e6f7e6"/>
</linearGradient>
<linearGradient id="lake" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#7cc7e8"/><stop offset="1" stop-color="#4a9ec4"/>
</linearGradient>
</defs>
<rect width="800" height="500" fill="url(#sky)"/>
<circle cx="690" cy="70" r="42" fill="#ffe066"/>
<polygon points="0,300 140,120 300,300" fill="#7fb069"/>
<polygon points="180,300 330,150 480,300" fill="#6a9955"/>
<polygon points="430,300 600,130 760,300" fill="#7fb069"/>
<rect x="0" y="300" width="800" height="90" fill="#8fc97f"/>
<ellipse cx="400" cy="420" rx="360" ry="70" fill="url(#lake)"/>
<ellipse cx="400" cy="418" rx="330" ry="58" fill="#9adbf0"/>
<g fill="#3d7a3d">
<rect x="120" y="230" width="26" height="80" rx="8" fill="#8b5a2b"/>
<circle cx="133" cy="205" r="46"/><circle cx="100" cy="230" r="34"/><circle cx="166" cy="230" r="34"/>
</g>
<g fill="#3d7a3d">
<rect x="640" y="240" width="24" height="70" rx="8" fill="#8b5a2b"/>
<circle cx="652" cy="215" r="40"/><circle cx="622" cy="240" r="30"/><circle cx="682" cy="240" r="30"/>
</g>
<g>
<ellipse cx="560" cy="392" rx="46" ry="26" fill="#7cc7e8"/>
<circle cx="560" cy="372" r="17" fill="#7cc7e8"/>
<circle cx="553" cy="369" r="4" fill="#123"/><circle cx="567" cy="369" r="4" fill="#123"/>
<ellipse cx="560" cy="430" rx="52" ry="8" fill="#3d8fb5" opacity="0.5"/>
</g>
<g>
<ellipse cx="240" cy="360" rx="40" ry="22" fill="#f4a261"/>
<circle cx="272" cy="348" r="15" fill="#f4a261"/>
<circle cx="266" cy="344" r="3.5" fill="#123"/><circle cx="278" cy="344" r="3.5" fill="#123"/>
<path d="M212 352 q-14 -8 -18 2 q10 6 18 4" fill="#f4a261"/>
<path d="M228 336 l-6 -16 l12 8 z" fill="#e76f51"/>
</g>
<g>
<circle cx="400" cy="200" r="12" fill="#e05c8a"/>
<ellipse cx="386" cy="200" rx="12" ry="6" fill="#c94a75" transform="rotate(-20 386 200)"/>
<ellipse cx="414" cy="200" rx="12" ry="6" fill="#c94a75" transform="rotate(20 414 200)"/>
</g>
<g>
<ellipse cx="330" cy="452" rx="14" ry="10" fill="#c98f5a"/>
<path d="M330 442 q-6 -12 4 -14 q8 2 6 14" fill="#c98f5a"/>
</g>
<g>
<ellipse cx="470" cy="330" rx="13" ry="9" fill="#8d99ae"/>
<circle cx="481" cy="325" r="7" fill="#8d99ae"/>
</g>
</svg>`;

const PAPAYA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500">
<defs>
<linearGradient id="sky2" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#cdeffd"/><stop offset="1" stop-color="#fdf6e3"/>
</linearGradient>
</defs>
<rect width="800" height="500" fill="url(#sky2)"/>
<circle cx="120" cy="90" r="40" fill="#ffe066"/>
<rect x="0" y="330" width="800" height="170" fill="#9ed67c"/>
<ellipse cx="560" cy="430" rx="220" ry="55" fill="#7cc7e8"/>
<ellipse cx="560" cy="426" rx="200" ry="45" fill="#9adbf0"/>
<g>
<rect x="380" y="140" width="40" height="210" rx="14" fill="#8b5a2b"/>
<circle cx="400" cy="120" r="90" fill="#5f9e4e"/>
<circle cx="310" cy="160" r="60" fill="#6fae5a"/>
<circle cx="490" cy="160" r="60" fill="#6fae5a"/>
<circle cx="400" cy="200" r="66" fill="#5f9e4e"/>
</g>
<g>
<ellipse cx="330" cy="215" rx="22" ry="30" fill="#f7c948" transform="rotate(18 330 215)"/>
<ellipse cx="330" cy="208" rx="8" ry="12" fill="#e8a93c" transform="rotate(18 330 208)"/>
<ellipse cx="455" cy="180" rx="20" ry="28" fill="#f7c948" transform="rotate(-14 455 180)"/>
<ellipse cx="455" cy="174" rx="7" ry="11" fill="#e8a93c" transform="rotate(-14 455 174)"/>
<ellipse cx="405" cy="238" rx="21" ry="29" fill="#f2b93b" transform="rotate(6 405 238)"/>
</g>
<g>
<ellipse cx="180" cy="380" rx="42" ry="26" fill="#fff"/>
<circle cx="216" cy="362" r="18" fill="#fff"/>
<circle cx="210" cy="356" r="4" fill="#123"/><circle cx="224" cy="356" r="4" fill="#123"/>
<ellipse cx="228" cy="366" rx="9" ry="6" fill="#ffb3c6"/>
<path d="M204 348 l-5 -14 l12 7 z" fill="#fff"/>
<path d="M232 348 l6 -14 l-12 7 z" fill="#fff"/>
<ellipse cx="150" cy="392" rx="10" ry="16" fill="#fff"/>
<circle cx="150" cy="380" r="7" fill="#fff"/>
</g>
<g>
<ellipse cx="600" cy="350" rx="18" ry="12" fill="#e05c8a"/>
<circle cx="614" cy="342" r="9" fill="#e05c8a"/>
<circle cx="610" cy="339" r="2.5" fill="#123"/>
<path d="M622 338 l8 -6 l-3 9 z" fill="#e05c8a"/>
</g>
</svg>`;

const BUFFALO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<circle cx="100" cy="100" r="92" fill="#ffe9c7"/>
<path d="M30 70 q-18 -26 6 -30 q10 14 26 16 z" fill="#8d99ae"/>
<path d="M170 70 q18 -26 -6 -30 q-10 14 -26 16 z" fill="#8d99ae"/>
<ellipse cx="100" cy="105" rx="62" ry="58" fill="#a8b4c6"/>
<ellipse cx="100" cy="128" rx="40" ry="30" fill="#e8b4a0"/>
<ellipse cx="100" cy="118" rx="18" ry="14" fill="#d98f7a"/>
<circle cx="78" cy="96" r="9" fill="#fff"/><circle cx="122" cy="96" r="9" fill="#fff"/>
<circle cx="80" cy="98" r="4.5" fill="#123"/><circle cx="120" cy="98" r="4.5" fill="#123"/>
<ellipse cx="86" cy="136" rx="5" ry="3.5" fill="#123" opacity="0.6"/>
<ellipse cx="114" cy="136" rx="5" ry="3.5" fill="#123" opacity="0.6"/>
</svg>`;

/* ---------- WAV 提示音（8bit 8kHz 单声道） ---------- */
function makeWav() {
  const sr = 8000, dur = 0.9, n = Math.floor(sr * dur);
  const samples = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let v = 0.5 * Math.sin(2 * Math.PI * 523.25 * t);
    if (t > 0.45) v += 0.4 * Math.sin(2 * Math.PI * 783.99 * (t - 0.45));
    const env = Math.min(1, t * 8) * Math.max(0, 1 - Math.max(0, t - 0.55) * 3);
    samples[i] = Math.max(0, Math.min(255, Math.round(128 + 100 * v * env)));
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + n, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22); header.writeUInt32LE(sr, 24); header.writeUInt32LE(sr, 28);
  header.writeUInt16LE(1, 32); header.writeUInt16LE(8, 34);
  header.write('data', 36); header.writeUInt32LE(n, 40);
  return 'data:audio/wav;base64,' + Buffer.concat([header, Buffer.from(samples)]).toString('base64');
}

/* ---------- 读取 ffmpeg 生成的演示视频（VP9/WebM，现代浏览器均支持） ---------- */
function readVideo() {
  const p = path.join(ROOT, 'tools', 'demo-video.webm');
  if (!fs.existsSync(p)) return null;
  return 'data:video/webm;base64,' + fs.readFileSync(p).toString('base64');
}

/* ---------- 组装项目 ---------- */
function build() {
  const wav = makeWav();
  const video = readVideo();
  const assets = {
    ast_forest: { id: 'ast_forest', name: '森林背景（示例）', kind: 'image', mime: 'image/svg+xml', note: '小游戏背景图', usage: '小游戏', size: 0, filename: 'forest.svg', data: svgUrl(FOREST_SVG) },
    ast_papaya: { id: 'ast_papaya', name: '木瓜与小兔（示例）', kind: 'image', mime: 'image/svg+xml', note: '图片点选题配图', usage: '题目', size: 0, filename: 'papaya.svg', data: svgUrl(PAPAYA_SVG) },
    ast_buffalo: { id: 'ast_buffalo', name: '野牛图标（示例）', kind: 'image', mime: 'image/svg+xml', note: '成就图标', usage: '成就', size: 0, filename: 'buffalo.svg', data: svgUrl(BUFFALO_SVG) },
    ast_chime: { id: 'ast_chime', name: '提示音（示例）', kind: 'audio', mime: 'audio/wav', note: '奖励音效', usage: '分支', size: 0, filename: 'chime.wav', data: wav }
  };
  if (video) {
    assets.ast_video = { id: 'ast_video', name: '咕咚科普小视频（示例）', kind: 'video', mime: 'video/webm', note: '答错分支播放', usage: '分支', size: 0, filename: 'demo.webm', data: video };
  }

  const P = {
    schemaVersion: 1,
    meta: {
      title: '《咕咚》互动学习课（示例项目）',
      subtitle: '小学语文 · 一年级下册',
      author: '示例作者',
      description: '这是一个示例项目，演示题目、分支、小游戏、成就与报告的配置方法。请在实际教学中替换为你自己的内容。',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reviewTip: '课后可以再读一遍课文，把故事讲给爸爸妈妈听。'
    },
    theme: { primary: '#ff8a3d', accent: '#43b581', bg: '#fff8ec', fontScale: 1 },
    mainTextMaterialId: 'mat_text',

    stages: [
      { id: 'stg1', name: '🌅 预习篇', desc: '认一认故事里的角色和词语', levels: ['lvl1', 'lvl2'] },
      { id: 'stg2', name: '📖 精读篇', desc: '读完故事，弄清“咕咚”的秘密', levels: ['lvl3', 'lvl4'] },
      { id: 'stg3', name: '🔬 拓展篇', desc: '声音是从哪里来的？', levels: ['lvl5'] },
      { id: 'stg4', name: '🥚 彩蛋篇', desc: '课后小游戏，自愿挑战', levels: ['lvl6'] }
    ],

    levels: {
      lvl1: {
        id: 'lvl1', stageId: 'stg1', name: '第1关 木瓜熟了', intro: '看图找木瓜，认识故事背景',
        startTip: '木瓜成熟后会掉下来哦，仔细观察图片吧！',
        completeTip: '你真会观察！木瓜掉进湖里，就会发出“咕咚”的声音。',
        bgImage: null, goals: '观察图画，理解故事背景',
        countInScore: true, optional: false, isEgg: false,
        entry: 'n1_text', next: { type: 'level', levelId: 'lvl2' }
      },
      lvl2: {
        id: 'lvl2', stageId: 'stg1', name: '第2关 生字词闯关', intro: '判断题、填空题、多选题',
        startTip: '一共有三道小题，加油！',
        completeTip: '生字词掌握得不错！',
        bgImage: null, goals: '掌握“咕咚”等词语',
        countInScore: true, optional: false, isEgg: false,
        entry: 'n2_text', next: { type: 'level', levelId: 'lvl3' }
      },
      lvl3: {
        id: 'lvl3', stageId: 'stg2', name: '第3关 咕咚来了', intro: '读故事，弄清咕咚的秘密',
        startTip: '读课文的时候要动脑筋想一想：咕咚到底是什么？',
        completeTip: '你真是个爱思考的孩子！遇到事情要先观察、多动脑。',
        bgImage: null, goals: '理解课文内容与寓意',
        countInScore: true, optional: false, isEgg: false,
        entry: 'n3_text', next: { type: 'level', levelId: 'lvl4' }
      },
      lvl4: {
        id: 'lvl4', stageId: 'stg2', name: '第4关 故事拼拼乐', intro: '把故事排成正确顺序',
        startTip: '还记得故事发生的顺序吗？来试试看！',
        completeTip: '故事顺序全对，你就是故事大王！',
        bgImage: null, goals: '复述故事顺序',
        countInScore: true, optional: false, isEgg: false,
        entry: 'n4_text', next: { type: 'level', levelId: 'lvl5' }
      },
      lvl5: {
        id: 'lvl5', stageId: 'stg3', name: '第5关 声音科普站', intro: '看视频，做小科学家',
        startTip: '先看一个科普小视频，再回答后面的问题。',
        completeTip: '原来声音是物体振动产生的！你了解了吗？',
        bgImage: null, goals: '了解声音由振动产生',
        countInScore: true, optional: false, isEgg: false,
        entry: 'n5_text', next: { type: 'level', levelId: 'lvl6' }
      },
      lvl6: {
        id: 'lvl6', stageId: 'stg4', name: '彩蛋关 野牛侦探社', intro: '帮野牛伯伯找出森林里的线索',
        startTip: '野牛伯伯遇到了难题，勇敢的小侦探，出发吧！',
        completeTip: '太厉害了，所有线索都找到了！野牛伯伯谢谢你！',
        bgImage: 'ast_forest', goals: '综合运用与拓展',
        countInScore: false, optional: true, isEgg: true,
        entry: 'n6_text', next: { type: 'home' }
      }
    },

    nodes: {
      /* ---- 第1关 ---- */
      n1_text: { id: 'n1_text', type: 'text', title: '木瓜熟了', text: '山坡上有一棵木瓜树，树上结满了木瓜。有一天，一个木瓜熟了，从高高的树上掉了下来……', media: [], next: 'q1' },
      q1: {
        id: 'q1', type: 'question', questionId: 'q1', next: 'n1_end', title: '找一找'
      },
      n1_end: { id: 'n1_end', type: 'end' },

      /* ---- 第2关 ---- */
      n2_text: { id: 'n2_text', type: 'text', title: '生字词闯关', text: '下面有三道小题，仔细读题再作答哦。', media: [], next: 'q2' },
      q2: { id: 'q2', type: 'question', questionId: 'q2', next: 'q3', title: '第一题' },
      q3: { id: 'q3', type: 'question', questionId: 'q3', next: 'q4', title: '第二题' },
      q4: { id: 'q4', type: 'question', questionId: 'q4', next: 'n2_end', title: '第三题' },
      n2_end: { id: 'n2_end', type: 'end' },

      /* ---- 第3关：三分支演示 ---- */
      n3_text: { id: 'n3_text', type: 'text', title: '咕咚来了', text: '兔子听到“咕咚”一声，拔腿就跑，边跑边喊：“咕咚来了，快跑呀！”猴子、狐狸、山羊、小鹿、大象都跟着跑了起来。只有野牛拦住大家问：“咕咚是什么？你们谁看到的？”大家都说不出话来。', media: [], next: 'n3_excerpt' },
      n3_excerpt: {
        id: 'n3_excerpt', type: 'excerpt', materialId: 'mat_text', keywords: ['咕咚'], title: '读课文，找答案', next: 'q5'
      },
      q5: {
        id: 'q5', type: 'question', questionId: 'q5', next: 'n3_after', title: '动脑筋想一想'
      },
      /* 选项B 分支：播放视频 → 引导问题 → 返回原题 */
      n3_video: {
        id: 'n3_video', type: 'video', title: '看一看，再想一想', media: ['ast_video'], caption: '木瓜掉进水里会发出什么声音呢？', next: 'q5_guide'
      },
      q5_guide: {
        id: 'q5_guide', type: 'question', questionId: 'q5_guide', next: 'n3_ret1', title: '引导问题'
      },
      n3_ret1: { id: 'n3_ret1', type: 'return', title: '返回原题' },
      /* 选项C 分支：高亮原文 → 提示 → 返回原题 */
      n3_hl: {
        id: 'n3_hl', type: 'excerpt', materialId: 'mat_text', keywords: ['木瓜', '湖里', '咕咚一声'], title: '再读一读课文', next: 'n3_hint'
      },
      n3_hint: { id: 'n3_hint', type: 'hint', title: '小提示', text: '课文第一句就告诉我们：木瓜熟了，掉进湖里。再想想“咕咚”是谁发出来的？', next: 'n3_ret2' },
      n3_ret2: { id: 'n3_ret2', type: 'return', title: '返回原题' },
      n3_after: {
        id: 'n3_after', type: 'text', title: '真相大白', text: '大家回到湖边一看，原来“咕咚”是木瓜掉进湖里发出来的声音！兔子不好意思地低下了头。', media: [], next: 'q6'
      },
      q6: { id: 'q6', type: 'question', questionId: 'q6', next: 'n3_end', title: '故事顺序' },
      n3_end: { id: 'n3_end', type: 'end' },

      /* ---- 第4关 ---- */
      n4_text: { id: 'n4_text', type: 'text', title: '故事顺序拼拼乐', text: '把下面的卡片排成故事发生的正确顺序。', media: [], next: 'n4_game' },
      n4_game: { id: 'n4_game', type: 'game', gameId: 'gm_order', next: 'n4_reward' },
      n4_reward: { id: 'n4_reward', type: 'reward', xp: 10, achievementId: null, next: 'n4_end' },
      n4_end: { id: 'n4_end', type: 'end' },

      /* ---- 第5关 ---- */
      n5_text: { id: 'n5_text', type: 'text', title: '声音科普站', text: '先看一个科普小视频，再回答后面的问题。', media: [], next: 'n5_video' },
      n5_video: {
        id: 'n5_video', type: 'video', title: '声音的秘密', media: ['ast_video'], caption: '注意看：物体振动会产生声音', next: 'q7'
      },
      q7: { id: 'q7', type: 'question', questionId: 'q7', next: 'n5_exp', title: '小科学家' },
      n5_exp: {
        id: 'n5_exp', type: 'excerpt', materialId: 'mat_exp', keywords: ['振动'], title: '科普拓展', next: 'q8'
      },
      q8: { id: 'q8', type: 'question', questionId: 'q8', next: 'n5_end', title: '开放题' },
      n5_end: { id: 'n5_end', type: 'end' },

      /* ---- 第6关 彩蛋 ---- */
      n6_text: {
        id: 'n6_text', type: 'text', title: '野牛侦探社', text: '野牛伯伯年纪大了，眼睛看不太清。它听说森林里藏着一个和“咕咚”有关的秘密，想请你帮忙找一找。',
        media: ['ast_buffalo'], next: 'n6_det'
      },
      n6_det: { id: 'n6_det', type: 'game', gameId: 'gm_det', next: 'n6_hot' },
      n6_hot: { id: 'n6_hot', type: 'game', gameId: 'gm_hot', next: 'n6_reward' },
      n6_reward: { id: 'n6_reward', type: 'reward', xp: 20, achievementId: 'ach_egg', next: 'n6_end' },
      n6_end: { id: 'n6_end', type: 'end' }
    },

    questions: {
      /* 图片点选题 */
      q1: {
        id: 'q1', type: 'clickimg', text: '木瓜熟了会掉下来。请你在图中找到“木瓜”，点一点它！',
        media: ['ast_papaya'], materialId: null, knowledgePoint: '看图说话',
        options: [
          { id: 'q1a', text: '木瓜', correct: true, feedback: '找到啦！木瓜熟了就会从树上掉下来。', next: null, media: [], region: { x: 36, y: 26, w: 16, h: 22 } },
          { id: 'q1b', text: '小兔子', correct: false, feedback: '这是小兔子，它在草地上玩呢。再找找木瓜在哪里？', next: null, media: [], region: { x: 15, y: 62, w: 20, h: 26 } },
          { id: 'q1c', text: '湖面', correct: false, feedback: '这是湖面，木瓜掉进湖里才会发出“咕咚”声。再仔细看看树上！', next: null, media: [], region: { x: 55, y: 72, w: 40, h: 22 } }
        ],
        answers: [], hint: '看一看高高的大树上，结了什么样的果子？',
        correctFeedback: '观察得真仔细！木瓜挂在树上，熟了就会掉下来。',
        wrongFeedback: '再看看图片，木瓜在什么地方呢？',
        reference: '', score: 10, countAttempts: true, inReport: true, useAPI: false
      },
      /* 判断题 */
      q2: {
        id: 'q2', type: 'judge', text: '“咕咚”是一个表示声音的词。',
        media: [], materialId: null, knowledgePoint: '字词积累',
        options: [
          { id: 'q2a', text: '正确', correct: true, feedback: '答对啦！“咕咚”是拟声词，表示东西掉进水里的声音。', next: null, media: [] },
          { id: 'q2b', text: '错误', correct: false, feedback: '再想想：木瓜掉进湖里，“咕咚”一声——这是在写声音哦。', next: null, media: [] }
        ],
        answers: [], hint: '读一读课文里“咕咚一声”这句话。',
        correctFeedback: '真棒！拟声词能让故事更生动。',
        wrongFeedback: '别着急，再读一遍课文试试。',
        reference: '“咕咚”是拟声词，模拟重物落水的声音。',
        score: 10, countAttempts: true, inReport: true, useAPI: false
      },
      /* 填空题 */
      q3: {
        id: 'q3', type: 'fill', text: '兔子听到“______”一声，拔腿就跑。（填一个字词）',
        media: [], materialId: null, knowledgePoint: '字词积累',
        options: [],
        answers: ['咕咚', '咕咚一声'],
        hint: '就是课文题目那个表示声音的词。',
        correctFeedback: '填对啦！就是“咕咚”。',
        wrongFeedback: '再读读课文第一自然段，答案就在里面。',
        reference: '咕咚',
        score: 10, countAttempts: true, inReport: true, useAPI: false
      },
      /* 多选题 */
      q4: {
        id: 'q4', type: 'multi', text: '《咕咚》这个故事里，下面哪些小动物跟着兔子一起跑了？（多选）',
        media: [], materialId: null, knowledgePoint: '课文内容理解',
        options: [
          { id: 'q4a', text: '猴子', correct: true, feedback: '对！猴子也跟着跑了。', next: null, media: [] },
          { id: 'q4b', text: '大象', correct: true, feedback: '对！大象也跟着跑了。', next: null, media: [] },
          { id: 'q4c', text: '小鹿', correct: true, feedback: '对！小鹿也跟着跑了。', next: null, media: [] },
          { id: 'q4d', text: '刺猬', correct: false, feedback: '故事里没有刺猬哦，它没有跟着跑。', next: null, media: [] }
        ],
        answers: [], hint: '读课文，数一数一共有哪些动物。',
        correctFeedback: '全找对啦！你读得真认真。',
        wrongFeedback: '有漏掉的或者多选的，再读一遍课文看看。',
        reference: '猴子、狐狸、山羊、小鹿、大象都跟着跑了。',
        score: 10, countAttempts: true, inReport: true, useAPI: false
      },
      /* 三分支单选题（核心演示） */
      q5: {
        id: 'q5', type: 'single', text: '兔子拼命喊的“咕咚来了”，这里的“咕咚”到底是什么？',
        media: [], materialId: null, knowledgePoint: '课文内容理解',
        options: [
          {
            id: 'q5a', text: '木瓜从树上掉进湖里发出的声音', correct: true,
            feedback: '完全正确！“咕咚”就是木瓜掉进湖里的声音。遇到事情要像野牛一样多动脑筋！',
            next: null, media: []
          },
          {
            id: 'q5b', text: '一只可怕的怪兽在叫', correct: false,
            feedback: '嗯，很多小朋友会这么想。可是森林里真的有怪兽吗？我们来看一段视频，再想一想。',
            next: 'n3_video', media: []
          },
          {
            id: 'q5c', text: '打雷的声音', correct: false,
            feedback: '打雷是“轰隆隆”，不是“咕咚”哦。我们再读一读课文，找找线索。',
            next: 'n3_hl', media: []
          }
        ],
        answers: [], hint: '课文第一句说：木瓜熟了，一个木瓜从高高的树上掉进湖里，咕咚一声！',
        correctFeedback: '你真是个爱思考的孩子！',
        wrongFeedback: '别急，再读读课文，或者看看提示。',
        reference: '“咕咚”是木瓜掉进湖里发出的声音。',
        score: 20, countAttempts: true, inReport: true, useAPI: false
      },
      /* 引导问题（分支B内） */
      q5_guide: {
        id: 'q5_guide', type: 'single', text: '视频里，熟透的木瓜掉进水里发出了什么声音？',
        media: [], materialId: null, knowledgePoint: '课文内容理解',
        options: [
          { id: 'q5g_a', text: '“咕咚”一声', correct: true, feedback: '对啦！现在你知道“咕咚”是什么了吧？', next: null, media: [] },
          { id: 'q5g_b', text: '“轰隆”一声', correct: false, feedback: '“轰隆”是打雷的声音。再想想木瓜落水的声音～', next: null, media: [] }
        ],
        answers: [], hint: '重物掉进水里，会发出闷闷的响声。',
        correctFeedback: '真聪明！',
        wrongFeedback: '再听一遍视频里的声音。',
        reference: '木瓜落水发出“咕咚”的声音。',
        score: 10, countAttempts: true, inReport: true, useAPI: false
      },
      /* 排序题 */
      q6: {
        id: 'q6', type: 'order', text: '按故事发生的顺序排列下面四句话。',
        media: [], materialId: null, knowledgePoint: '课文内容理解',
        options: [
          { id: 'q6a', text: '木瓜从高高的树上掉进湖里。', media: [] },
          { id: 'q6b', text: '兔子听到声音，拔腿就跑。', media: [] },
          { id: 'q6c', text: '大家都跟着兔子跑起来。', media: [] },
          { id: 'q6d', text: '野牛带大家回湖边，弄清了真相。', media: [] }
        ],
        answers: [], hint: '先发生什么，再发生什么？野牛是最后出场的。',
        correctFeedback: '顺序完全正确！你可以把这个故事讲给别人听了。',
        wrongFeedback: '顺序还不对，用上下按钮调整一下，再想一想。',
        reference: '木瓜落水 → 兔子逃跑 → 大家跟跑 → 野牛弄清真相。',
        score: 20, countAttempts: true, inReport: true, useAPI: false
      },
      /* 科普单选 */
      q7: {
        id: 'q7', type: 'single', text: '声音是由物体的什么产生的？',
        media: [], materialId: null, knowledgePoint: '声音的秘密',
        options: [
          { id: 'q7a', text: '振动', correct: true, feedback: '答对啦！物体振动会产生声音。', next: null, media: [] },
          { id: 'q7b', text: '颜色', correct: false, feedback: '颜色是眼睛看到的，和声音没关系哦。再想想视频里的实验。', next: null, media: [] },
          { id: 'q7c', text: '魔法', correct: false, feedback: '世界上没有魔法，科学才能解释声音。看看下面的科普拓展吧！', next: null, media: [] }
        ],
        answers: [], hint: '视频里敲鼓时，鼓面上的纸屑跳了起来，说明鼓面在……',
        correctFeedback: '你真是个小科学家！',
        wrongFeedback: '看看下面的科普拓展，再想一想。',
        reference: '声音由物体振动产生，振动停止，声音也停止。',
        score: 10, countAttempts: true, inReport: true, useAPI: false
      },
      /* 开放题 */
      q8: {
        id: 'q8', type: 'open', text: '生活中你还听到过哪些有趣的“咕咚”声？它是怎么发出来的？请写一写。',
        media: [], materialId: null, knowledgePoint: '声音的秘密',
        options: [],
        answers: [],
        hint: '比如：皮球掉在地上是“砰砰”，敲门是“咚咚”。',
        correctFeedback: '你的观察真细致，继续保持这份好奇心！',
        wrongFeedback: '',
        reference: '示例：妈妈切菜时，菜刀碰案板发出“咚咚”声；下雨时雨点打在窗户上发出“啪啪”声。这些声音都是物体碰撞产生振动发出来的。',
        score: 10, countAttempts: true, inReport: true, useAPI: true
      }
    },

    materials: [
      {
        id: 'mat_text', kind: 'text', title: '课文原文《咕咚》',
        content: '木瓜熟了。一个木瓜从高高的树上掉进湖里，咕咚一声！\n兔子吓了一跳，拔腿就跑，边跑边喊：“咕咚来了，咕咚来了！”\n猴子看见兔子跑，问也不问，跟着跑。狐狸呀，山羊呀，小鹿呀，也都跟着跑起来。\n大象看见了，也跟着跑。边跑边问：“咕咚在哪里？咕咚在哪里？”\n谁也说不上来。\n最后野牛问：“咕咚是什么？你们谁看到的？”\n兔子说：“不知道，我听见‘咕咚’一声，就跑了。”\n大家跟着野牛回到湖边，一看，原来是一个木瓜掉进湖里发出的声音。\n兔子难为情地低下了头。',
        keywords: ['咕咚', '木瓜', '湖里']
      },
      {
        id: 'mat_exp', kind: 'expansion', title: '科普拓展：声音从哪里来',
        content: '声音是由物体振动产生的。\n敲鼓的时候，鼓面在振动，所以发出声音；说话的时候，我们的声带在振动；木瓜掉进水里，会把水“震”出一圈圈波纹，同时也发出“咕咚”的声音。\n振动停止了，声音也就停止了。\n声音可以在空气、水和墙壁中传播，所以站在很远的地方也能听见“咕咚”声。',
        keywords: ['振动', '传播']
      },
      {
        id: 'mat_word1', kind: 'word', title: '词语解释：咕咚',
        content: '拟声词，重物掉进水里或掉在地上发出的声音，如“咕咚一声”。',
        keywords: []
      },
      {
        id: 'mat_word2', kind: 'word', title: '词语解释：拔腿就跑',
        content: '形容非常害怕或着急，立刻转身快步跑开。课文里兔子听到“咕咚”声，害怕得拔腿就跑。',
        keywords: []
      },
      {
        id: 'mat_kp', kind: 'knowledge', title: '知识点：遇事要动脑筋',
        content: '别人说什么就信什么，遇到事情不思考，就会闹出笑话。野牛拦住大家问“咕咚是什么”，体现了好问与思考。',
        keywords: []
      }
    ],

    games: {
      gm_order: {
        id: 'gm_order', type: 'order', name: '故事顺序拼拼乐', desc: '把《咕咚》的故事排成正确顺序',
        config: {
          cards: [
            { id: 'cd1', text: '木瓜从树上掉进湖里，咕咚一声', image: null },
            { id: 'cd2', text: '兔子吓了一跳，拔腿就跑', image: null },
            { id: 'cd3', text: '猴子、狐狸、大象都跟着跑', image: null },
            { id: 'cd4', text: '野牛带大家回湖边，真相大白', image: null }
          ],
          correctOrder: ['cd1', 'cd2', 'cd3', 'cd4'],
          wrongHint: '顺序还不对哦，再读一读故事，调整一下试试！',
          completeFeedback: '太棒了，故事顺序完全正确！',
          rewardXp: 15
        }
      },
      gm_hot: {
        id: 'gm_hot', type: 'hotspot', name: '森林线索大搜查', desc: '野牛伯伯年纪大了，帮它找出森林里藏着的线索吧！',
        config: {
          bgImage: 'ast_forest', hotspots: [
            { id: 'hs1', name: '大木瓜', hint: '看一看湖边的草地上，有个圆圆的东西。', foundFeedback: '这是熟透的大木瓜！它掉进湖里就会发出咕咚声。', x: 16, y: 62, w: 14, h: 16 },
            { id: 'hs2', name: '小青蛙', hint: '湖面上绿色的小身影是谁？', foundFeedback: '是一只小青蛙！青蛙的叫声是“呱呱”。', x: 62, y: 68, w: 16, h: 16 },
            { id: 'hs3', name: '花蝴蝶', hint: '蓝天上飘着一个小亮点。', foundFeedback: '是一只花蝴蝶！蝴蝶振动翅膀会发出很小的声音。', x: 46, y: 34, w: 12, h: 12 },
            { id: 'hs4', name: '小松鼠', hint: '左边大树下有个毛茸茸的尾巴。', foundFeedback: '是小松鼠！松鼠啃松果会发出“咔嚓咔嚓”的声音。', x: 36, y: 84, w: 12, h: 10 }
          ],
          requireAll: true, targetCount: 4,
          foundFeedback: '找到了！',
          missFeedback: '这里没有线索，再试试别的地方～',
          completeFeedback: '所有线索都找到啦！你就是森林小侦探！',
          rewardXp: 20, hintAfterMiss: 3
        }
      },
      gm_det: {
        id: 'gm_det', type: 'detective', name: '帮野牛当侦探', desc: '野牛伯伯遇到了难题，你会怎么帮它？',
        config: {
          intro: '野牛伯伯年纪大了，眼睛看不太清，耳朵也有点背。它听说森林里有个“咕咚”的秘密。',
          scenario: '兔子们一边跑一边喊“咕咚来了”，野牛伯伯想知道“咕咚”到底是什么。你会怎么帮它？',
          options: [
            {
              id: 'do1', text: '不急着跑，先去湖边看看现场', result: '你发现了木瓜和一圈圈涟漪',
              explanation: '遇到事情先观察、动脑筋，才能找到真相。你真像个小侦探！', next: null
            },
            {
              id: 'do2', text: '跟着大家一起跑，跑得远远的', result: '你越跑越远，什么也没发现',
              explanation: '遇事不思考、盲目跟风，反而离真相更远。下次记得先问一问“到底是什么”！', next: null
            },
            {
              id: 'do3', text: '去请教最有经验的野牛伯伯', result: '野牛伯伯带你回到湖边',
              explanation: '虚心请教有经验的人，也是解决问题的好办法！', next: null
            }
          ],
          completeWhen: 'any', rewardXp: 15, achievementId: null
        }
      }
    },

    achievements: [
      {
        id: 'ach_first', name: '初出茅庐', desc: '答对第一道题', icon: null, iconEmoji: '🌱',
        hidden: false, repeatable: false, unlockedTip: '良好的开始是成功的一半！', xp: 10,
        condition: { type: 'totalCorrect', count: 1 }
      },
      {
        id: 'ach_read', name: '识字小达人', desc: '首次答对 3 道题，并完成一次小游戏', icon: null, iconEmoji: '📚',
        hidden: false, repeatable: false, unlockedTip: '又认识了好多字！', xp: 20,
        condition: { type: 'all', children: [{ type: 'firstCorrect', count: 3 }, { type: 'gameCompleted', gameId: 'gm_order' }] }
      },
      {
        id: 'ach_story', name: '故事大王', desc: '完成“故事顺序拼拼乐”', icon: null, iconEmoji: '👑',
        hidden: false, repeatable: false, unlockedTip: '你已经能把故事讲清楚了！', xp: 15,
        condition: { type: 'gameCompleted', gameId: 'gm_order' }
      },
      {
        id: 'ach_clue', name: '侦探之眼', desc: '在森林里找到 3 个线索', icon: null, iconEmoji: '🔍',
        hidden: false, repeatable: false, unlockedTip: '好厉害的观察力！', xp: 20,
        condition: { type: 'cluesFound', count: 3 }
      },
      {
        id: 'ach_think', name: '爱思考的孩子', desc: '完成一道开放题', icon: null, iconEmoji: '💡',
        hidden: false, repeatable: false, unlockedTip: '保持好奇心，你会更棒！', xp: 15,
        condition: { type: 'openCompleted', count: 1 }
      },
      {
        id: 'ach_egg', name: '彩蛋猎人', desc: '完成彩蛋关“野牛侦探社”', icon: 'ast_buffalo', iconEmoji: '🐃',
        hidden: true, repeatable: false, unlockedTip: '你发现了隐藏的彩蛋！', xp: 30,
        condition: { type: 'eggCompleted', levelId: 'lvl6' }
      },
      {
        id: 'ach_xp', name: '满腹经纶', desc: '累计获得 100 点经验值', icon: null, iconEmoji: '🌟',
        hidden: false, repeatable: true, unlockedTip: '知识就是力量！', xp: 20,
        condition: { type: 'totalXp', count: 100 }
      }
    ],

    xpRules: { firstCorrect: 10, hintCorrect: 5, gameComplete: 15, openComplete: 8, materialView: 2, levelComplete: 10 },

    feedback: {
      openDefault: '收到你的回答，真善于思考！',
      apiFail: '点评服务暂时不可用，我们先继续学习吧！',
      allWrong: ''
    },

    api: {
      endpoint: '', model: '', systemPrompt: '你是一位温柔、耐心的小学语文老师，请根据学生的回答进行鼓励式评价，语气要适合小学低年级学生。',
      userPromptTemplate: '题目：{question}\n学生的回答：{answer}\n参考答案：{reference}\n请给出 1-3 句鼓励式评价，先肯定优点，再 gently 给出小建议。',
      outputFormat: '1-3 句话，语气温柔亲切，多鼓励，避免批评。',
      timeout: 15,
      fallback: '老师现在不在线，但你的回答已经很棒了！继续加油！'
    }
  };

  // 去掉 dataURL 中的大字段前记录素材大小
  Object.keys(assets).forEach(function (id) {
    assets[id].size = Math.round(assets[id].data.length * 0.75);
  });
  P.assets = assets;
  return P;
}

/* ---------- 本地校验 ---------- */
const project = build();
global.window = {};
require(path.join(ROOT, 'shared', 'schema.js'));
const res = window.Schema.validate(project);
console.log('errors:', res.errors.length, 'warnings:', res.warnings.length);
res.errors.forEach(function (e) { console.log('  ✗', e.where, '-', e.msg); });
res.warnings.forEach(function (w) { console.log('  ⚠', w.where, '-', w.msg); });
if (res.errors.length) process.exit(1);

const out = path.join(ROOT, 'examples', 'demo-project.json');
fs.writeFileSync(out, JSON.stringify(project, null, 1));
console.log('written', out, (fs.statSync(out).size / 1024).toFixed(1) + 'KB');
