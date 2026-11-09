/* 在线解读：把页面生成的提示词交给 Puter.js（用户自付、无需 API key）流式生成。
 * Puter 脚本在用户第一次点击时才加载，页面本身不引入任何第三方脚本。
 * 模型输出只用 textContent 显示，不解析 HTML。 */
(function (root) {
  const SRC = 'https://js.puter.com/v2/';
  const $ = (s) => document.querySelector(s);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 隐私模式：忽略 */ } },
  };

  let loading = null;
  function loadPuter() {
    if (root.puter) return Promise.resolve();
    if (!loading) {
      loading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = SRC;
        s.onload = () => resolve();
        s.onerror = () => { loading = null; s.remove(); reject(new Error('无法加载 Puter（网络问题，或被浏览器 / 插件拦截了 js.puter.com）')); };
        document.head.appendChild(s);
      });
    }
    return loading;
  }

  function errMsg(e) {
    if (!e) return '未知错误';
    if (typeof e === 'string') return e;
    const m = e.message || (e.error && (e.error.message || e.error)) || e.msg || e.code;
    if (m) return String(m);
    try { return JSON.stringify(e); } catch (x) { return '未知错误'; }
  }
  // 非流式结果里 content 可能是字符串，也可能是内容块数组
  function contentText(resp) {
    const c = resp && resp.message && resp.message.content;
    if (typeof c === 'string') return c;
    if (Array.isArray(c)) return c.map((b) => (b && b.text) || '').join('');
    return typeof resp === 'string' ? resp : '';
  }

  let controller = null, busy = false;
  const ui = () => ({ run: $('#ai-run'), stop: $('#ai-stop'), box: $('#ai-out'), status: $('#ai-status'), text: $('#ai-text') });

  function setBusy(b) {
    busy = b;
    const u = ui();
    u.run.disabled = b;
    u.stop.hidden = !b;
  }

  async function run() {
    const prompt = $('#prompt-text').value;
    if (busy || !prompt) return;
    const model = $('#ai-model').value;
    store.set('ai-model', model);
    const u = ui();
    u.box.hidden = false; u.text.textContent = ''; u.status.textContent = '正在连接 Puter…首次使用会弹出登录窗口';
    controller = new AbortController();
    setBusy(true);
    // 登录弹窗、加载脚本阶段 puter 不响应 signal，所以用一个"中止即拒绝"的 promise 来竞速
    const aborted = new Promise((_, reject) => {
      controller.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e); });
    });
    aborted.catch(() => {});
    try {
      await Promise.race([loadPuter(), aborted]);
      const call = root.puter.ai.chat(prompt, { model, stream: true, max_tokens: 1500, signal: controller.signal });
      call.catch(() => {});   // 已中止后才失败的调用，不再冒泡成未处理的拒绝
      const resp = await Promise.race([call, aborted]);
      u.status.textContent = `生成中 · ${model}`;
      let got = false;
      if (resp && typeof resp[Symbol.asyncIterator] === 'function') {
        for await (const part of resp) {
          if (controller.signal.aborted) break;
          if (part && part.type === 'error') throw new Error(part.message || '模型返回了错误');
          const t = part && part.text;
          if (t) { u.text.textContent += t; got = true; }
        }
      } else {
        const t = contentText(resp);
        if (t) { u.text.textContent = t; got = true; }
      }
      if (controller.signal.aborted) { const e = new Error('aborted'); e.name = 'AbortError'; throw e; }
      if (!got) throw new Error('模型没有返回内容，请换一个模型再试');
      u.status.textContent = `完成 · ${model}`;
    } catch (e) {
      u.status.textContent = e && e.name === 'AbortError' ? '已停止' : `失败：${errMsg(e)}。可以换个模型，或用“复制提示词”。`;
    } finally {
      setBusy(false); controller = null;
    }
  }

  function stop() { if (controller) controller.abort(); }
  // 重新起卦后，旧解读不再对应当前卦象
  function reset() {
    stop();
    const u = ui();
    u.box.hidden = true; u.text.textContent = ''; u.status.textContent = '';
  }

  function init() {
    const saved = store.get('ai-model'), sel = $('#ai-model');
    if (saved && [...sel.options].some((o) => o.value === saved)) sel.value = saved;
    $('#ai-run').addEventListener('click', run);
    $('#ai-stop').addEventListener('click', stop);
  }
  init();
  root.Ai = { reset, _loadPuter: loadPuter };
})(window);
