/* ============================================================
 * API 主观题评价（OpenAI 兼容 chat/completions）
 *  - Key 只从浏览器本地设置读取，绝不写入项目/导出文件
 *  - 超时、失败、格式错误 → 返回 { ok:false }，由调用方回退到预设反馈
 * ============================================================ */
(function () {
  'use strict';

  function fillTemplate(tpl, vars) {
    return (tpl || '').replace(/\{(\w+)\}/g, function (m, k) {
      return vars[k] !== undefined ? vars[k] : '';
    });
  }

  /**
   * @param {object} cfg  { endpoint, model, systemPrompt, userPromptTemplate, timeout, fallback }
   * @param {object} vars { question, answer, reference, criteria }
   * @returns {Promise<{ok:boolean, text?:string, error?:string}>}
   */
  function evaluate(cfg, vars) {
    var key = Store.getSetting('api_key', '');
    if (!cfg || !cfg.endpoint) {
      return Promise.resolve({ ok: false, error: '未配置 API 地址' });
    }
    if (!key) {
      return Promise.resolve({ ok: false, error: '未在本地设置 API Key（学生端不会预置 Key）' });
    }
    var sys = cfg.systemPrompt || '你是一位温柔、耐心的小学语文老师，请根据学生的回答进行鼓励式评价。';
    var userTpl = cfg.userPromptTemplate ||
      '题目：{question}\n学生的回答：{answer}\n参考答案：{reference}\n评价标准：{criteria}\n请给出适合小学低年级学生的简短鼓励式评价。';
    var body = {
      model: cfg.model || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: fillTemplate(userTpl, vars) }
      ],
      temperature: 0.7
    };
    var timeoutMs = Math.max(3, Number(cfg.timeout) || 15) * 1000;
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, timeoutMs);
    return fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify(body),
      signal: ctrl.signal
    }).then(function (res) {
      clearTimeout(timer);
      if (!res.ok) return { ok: false, error: 'API 返回 HTTP ' + res.status };
      return res.json().then(function (j) {
        var text = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
        if (!text || typeof text !== 'string') return { ok: false, error: 'API 返回格式不正确' };
        return { ok: true, text: text.trim() };
      }).catch(function () { return { ok: false, error: 'API 返回格式不正确' }; });
    }).catch(function (e) {
      clearTimeout(timer);
      if (e && e.name === 'AbortError') return { ok: false, error: 'API 请求超时' };
      return { ok: false, error: 'API 请求失败：' + (e && e.message ? e.message : '网络错误') };
    });
  }

  window.ApiKit = { evaluate: evaluate, fillTemplate: fillTemplate };
})();
