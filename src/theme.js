/* 明暗主题：CSS 变量为唯一来源，画布通过 Theme.c 读取同一份颜色。 */
(function (root) {
  const KEYS = {
    ink: '--ink', dim: '--dim', gold: '--gold', red: '--red', bg: '--bg', dot: '--dot',
    goldRgb: '--gold-rgb', redRgb: '--red-rgb', inkRgb: '--ink-rgb',
    arcSY: '--arc-sy', arcLY: '--arc-ly', arcSN: '--arc-sn', arcLN: '--arc-ln',
  };
  const c = {};
  const store = {
    get() { try { return localStorage.getItem('theme'); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem('theme', v); } catch (e) { /* 隐私模式等：忽略 */ } },
  };
  const system = () => (root.matchMedia && root.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

  function refresh() {
    const s = getComputedStyle(document.documentElement);
    for (const k in KEYS) c[k] = s.getPropertyValue(KEYS[k]).trim();
  }
  function apply(mode, persist) {
    document.documentElement.dataset.theme = mode;
    if (persist) store.set(mode);
    refresh();
    const b = document.getElementById('theme');
    if (b) {
      b.textContent = mode === 'dark' ? '☀' : '☾';
      b.title = mode === 'dark' ? '切换为浅色' : '切换为深色';
      b.setAttribute('aria-label', b.title);
    }
  }
  function current() { return document.documentElement.dataset.theme || 'dark'; }

  apply(store.get() || system(), false);
  const b = document.getElementById('theme');
  if (b) b.addEventListener('click', () => apply(current() === 'dark' ? 'light' : 'dark', true));
  if (root.matchMedia) {
    root.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (!store.get()) apply(system(), false); });
  }
  root.Theme = { c, apply, current };
})(window);
