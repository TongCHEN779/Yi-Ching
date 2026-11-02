/* 易经 · 连续卦象
 * 立方体模式：x[0..5] ∈ [0,1]，自下而上每爻的"阳度"。64 卦是 {0,1}^6 的顶点，
 *   任意点对各顶点的权重为 P(h) = ∏ x_i^{h_i} (1-x_i)^{1-h_i}（多线性插值）。
 * 环面模式：每爻一个四象相位 p[i]（少阳→老阳→少阴→老阴 的圆），
 *   由 p 得到本卦阳度 x 与之卦阳度 z，两个分布各自按上式给卦权重。
 */
(() => {
  const H = window.HEXAGRAMS;
  const D = window.Divination;
  const byBits = Object.fromEntries(H.map((h) => [h.bits, h]));
  // 先天八卦序；bits 自下而上
  const TRIS = [
    ['乾', '111', '☰'], ['兑', '110', '☱'], ['离', '101', '☲'], ['震', '100', '☳'],
    ['巽', '011', '☴'], ['坎', '010', '☵'], ['艮', '001', '☶'], ['坤', '000', '☷'],
  ];
  const LINE_NAMES = ['初', '二', '三', '四', '五', '上'];
  const glyph = (n) => String.fromCodePoint(0x4dc0 + n - 1);
  const $ = (s) => document.querySelector(s);
  const TH = () => window.Theme.c;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const state = {
    mode: 'cube',               // 'cube' | 'torus'
    x: Array(6).fill(0.5),      // 本卦阳度
    z: Array(6).fill(0.5),      // 之卦阳度（立方体模式下等于 x）
    p: Array(6).fill(0.375),    // 四象相位；0.375 恰为阴阳均衡
    cast: null,                 // { values:[], done, ben, zhi, moving }
    t: 0,
    busy: false,
    detached: false,            // 手动改动后，"变"滑块不再对应当前点
    castPhaseValid: false,      // 当前相位仍等于起卦结果
    flow: false,
  };
  const isTorus = () => state.mode === 'torus';
  const FLOW_RATE = [1.0, 0.82, 1.21, 0.9, 1.13, 0.76];   // 各爻节律不同，流转时卦象才会变化

  // 环面：由相位导出本卦 / 之卦阳度
  function deriveFromPhase() {
    state.p.forEach((p, i) => { const y = D.phaseYang(p); state.x[i] = y.yb; state.z[i] = y.yz; });
  }
  // 立方体 → 相位：纯顶点落在少阳/少阴，中间值落在老阳→少阴的过渡弧上
  function syncPhaseFromX() {
    state.x.forEach((x, i) => { state.p[i] = x === 1 ? 0 : x === 0 ? 0.5 : 0.25 + (1 - x) / 4; });
  }
  const quantCast = () => { const values = state.p.map(D.quant); return { values, done: true, ...D.resolve(values) }; };
  const getCast = () => (isTorus() ? quantCast() : state.cast);

  // ---------- 权重 ----------
  function weights(xs = state.x) {
    const w = {};
    for (const h of H) {
      let p = 1;
      for (let i = 0; i < 6; i++) p *= h.bits[i] === '1' ? xs[i] : 1 - xs[i];
      w[h.bits] = p;
    }
    return w;
  }
  function triWeight(offset, bits) {
    let p = 1;
    for (let i = 0; i < 3; i++) p *= bits[i] === '1' ? state.x[offset + i] : 1 - state.x[offset + i];
    return p;
  }

  // ---------- 爻线 ----------
  const yaoEl = [];
  function buildYao() {
    const root = $('#yao');
    for (let i = 5; i >= 0; i--) {
      const row = document.createElement('div');
      row.className = 'yao';
      row.innerHTML = `<span class="nm">${LINE_NAMES[i]}</span><div class="bar"><i class="l"></i><i class="r"></i></div><span class="mark"></span>`;
      const bar = row.querySelector('.bar');
      const set = (e) => {
        const r = bar.getBoundingClientRect();
        let v = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
        if (v < 0.04) v = 0; else if (v > 0.96) v = 1;
        state.x[i] = v;
        detach();
        render();
      };
      bar.addEventListener('pointerdown', (e) => { bar.setPointerCapture(e.pointerId); set(e); });
      bar.addEventListener('pointermove', (e) => { if (bar.hasPointerCapture(e.pointerId)) set(e); });
      root.appendChild(row);
      yaoEl[i] = row;
    }
  }
  // 手动改动后，"变"滑块不再对应当前点
  function detach() {
    state.detached = true; state.castPhaseValid = false;
    state.z = state.x.slice(); syncPhaseFromX();
  }

  function renderYao() {
    const c = getCast();
    $('#yao').classList.toggle('ro', isTorus());
    for (let i = 0; i < 6; i++) {
      const row = yaoEl[i];
      const x = state.x[i];
      const gap = (1 - x) * 34; // 阳度 1 → 实线，0 → 最大缺口
      row.querySelector('.l').style.width = `${(100 - gap) / 2}%`;
      row.querySelector('.r').style.width = `${(100 - gap) / 2}%`;
      const v = c && c.values[i];
      row.classList.toggle('moving', !!v && D.isMoving(v));
      row.classList.toggle('pending', !!c && !c.done && v === undefined);
      row.querySelector('.mark').textContent = v ? `${v}${v === 9 ? '○' : v === 6 ? '✕' : ''}` : `${Math.round(x * 100)}%`;
    }
  }

  // ---------- 立方体（2D 画布手写透视，无依赖）----------
  function makeCube(canvas, offset) {
    const ctx = canvas.getContext('2d');
    const view = { rx: -0.45, ry: 0.65, drag: null, moved: false };
    let verts = [];

    const project = (p) => {
      const cy = Math.cos(view.ry), sy = Math.sin(view.ry), cx = Math.cos(view.rx), sx = Math.sin(view.rx);
      let [x, y, z] = p;
      [x, z] = [x * cy + z * sy, -x * sy + z * cy];
      [y, z] = [y * cx - z * sx, y * sx + z * cx];
      const s = 3.6 / (3.6 + z * 0.35);
      return { x: x * s, y: -y * s, z, s };
    };

    function resize() {
      const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    }

    function draw() {
      if (!canvas.offsetParent) return;
      if (!view.drag) view.ry += 0.003;
      const W = canvas.width, Ht = canvas.height, dpr = window.devicePixelRatio || 1;
      const scale = Math.min(W, Ht) * 0.27;
      const T = (p) => ({ ...p, X: W / 2 + p.x * scale, Y: Ht / 2 + p.y * scale });
      ctx.clearRect(0, 0, W, Ht);
      ctx.font = `${13 * dpr}px "Songti SC", serif`;
      ctx.textAlign = 'center';

      verts = TRIS.map(([name, bits, sym]) => {
        const p = T(project([...bits].map((b) => (b === '1' ? 1 : -1))));
        return { name, bits, sym, ...p, w: triWeight(offset, bits) };
      });
      // 棱：汉明距离 1
      ctx.strokeStyle = `rgba(${TH().goldRgb},.35)`; ctx.lineWidth = dpr;
      for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) {
        const d = [...verts[a].bits].filter((c, i) => c !== verts[b].bits[i]).length;
        if (d === 1) { ctx.beginPath(); ctx.moveTo(verts[a].X, verts[a].Y); ctx.lineTo(verts[b].X, verts[b].Y); ctx.stroke(); }
      }
      // 当前点
      const pt = T(project([0, 1, 2].map((i) => (state.x[offset + i] - 0.5) * 2)));
      // 到各顶点的权重连线
      for (const v of verts) {
        if (v.w < 0.02) continue;
        ctx.strokeStyle = `rgba(${TH().redRgb},${Math.min(0.8, v.w * 1.2)})`; ctx.lineWidth = 2 * dpr * Math.sqrt(v.w);
        ctx.beginPath(); ctx.moveTo(pt.X, pt.Y); ctx.lineTo(v.X, v.Y); ctx.stroke();
      }
      // 顶点（远的先画）
      for (const v of [...verts].sort((a, b) => b.z - a.z)) {
        const r = (5 + 11 * Math.sqrt(v.w)) * dpr * v.s;
        ctx.beginPath(); ctx.arc(v.X, v.Y, r, 0, 7);
        ctx.fillStyle = `rgba(${TH().redRgb},${0.25 + 0.75 * Math.sqrt(v.w)})`; ctx.fill();
        ctx.strokeStyle = TH().gold; ctx.lineWidth = dpr; ctx.stroke();
        ctx.fillStyle = TH().ink;
        ctx.fillText(`${v.sym}${v.name}`, v.X, v.Y - r - 5 * dpr);
      }
      ctx.beginPath(); ctx.arc(pt.X, pt.Y, 6 * dpr, 0, 7);
      ctx.fillStyle = TH().dot; ctx.fill();
      ctx.strokeStyle = TH().red; ctx.lineWidth = 2 * dpr; ctx.stroke();
    }

    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      view.drag = { x: e.clientX, y: e.clientY }; view.moved = false;
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!view.drag) return;
      const dx = e.clientX - view.drag.x, dy = e.clientY - view.drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) view.moved = true;
      view.ry += dx * 0.01; view.rx = Math.max(-1.4, Math.min(1.4, view.rx + dy * 0.01));
      view.drag = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('pointercancel', () => { view.drag = null; });   // 触屏上浏览器接管纵向滚动
    canvas.addEventListener('pointerup', (e) => {
      const wasClick = !view.moved;
      view.drag = null;
      if (!wasClick) return;
      const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      const mx = (e.clientX - r.left) * dpr, my = (e.clientY - r.top) * dpr;
      let best = null, bd = (24 * dpr) ** 2;
      for (const v of verts) { const d = (v.X - mx) ** 2 + (v.Y - my) ** 2; if (d < bd) { bd = d; best = v; } }
      if (best) { for (let i = 0; i < 3; i++) state.x[offset + i] = +best.bits[i]; detach(); render(); }
    });
    window.addEventListener('resize', resize);
    resize();
    return { draw, resize };
  }

  // ---------- 伏羲方图 ----------
  const cellEl = {};
  function buildGrid() {
    const g = $('#grid');
    g.appendChild(document.createElement('span'));
    for (const [name, , sym] of TRIS) { const s = document.createElement('span'); s.className = 'hd'; s.textContent = sym; s.title = `上卦 ${name}`; g.appendChild(s); }
    for (const [lname, lbits, lsym] of TRIS) {
      const s = document.createElement('span'); s.className = 'hd'; s.textContent = lsym; s.title = `下卦 ${lname}`; g.appendChild(s);
      for (const [uname, ubits] of TRIS) {
        const h = byBits[lbits + ubits];
        const c = document.createElement('div');
        c.className = 'cell'; c.innerHTML = `<span>${glyph(h.n)}</span>`;
        c.title = `第${h.n}卦 ${h.name}（${lname}下${uname}上）`;
        c.addEventListener('click', () => { for (let i = 0; i < 6; i++) state.x[i] = +h.bits[i]; detach(); render(); });
        g.appendChild(c); cellEl[h.bits] = c;
      }
    }
  }
  const shade = (w, bits, max) => (max > 0.05 ? Math.sqrt(w[bits] / max) : w[bits] * 6).toFixed(3);
  function renderGrid(w, wz) {
    const max = Math.max(...Object.values(w));
    const maxz = wz ? Math.max(...Object.values(wz)) : 0;
    const c = getCast();
    for (const [bits, el] of Object.entries(cellEl)) {
      el.style.setProperty('--a', shade(w, bits, max));
      el.style.setProperty('--b', wz ? shade(wz, bits, maxz) : 0);
      el.classList.toggle('ben', !!(c && c.done && bits === c.ben));
      el.classList.toggle('zhi', !!(c && c.done && bits === c.zhi && c.zhi !== c.ben));
    }
  }

  // ---------- 卦辞卡片 ----------
  function cardsHTML(w, tagFor) {
    const list = H.map((h) => [h, w[h.bits]]).sort((a, b) => b[1] - a[1]).filter(([, p]) => p >= 0.04).slice(0, 4);
    if (!list.length) return '<p class="empty">当前是许多卦的均匀叠加，没有哪一卦占主导。起一卦，或把爻线拖向阴 / 阳的一端。</p>';
    const top = list[0][1];
    return list.map(([h, p]) => {
      const tags = tagFor(h);
      return `<article class="card" style="opacity:${(0.35 + 0.65 * p / top).toFixed(2)}">
        <h3><span class="g">${glyph(h.n)}</span>第${h.n}卦 ${h.name}${tags.map((t) => `<span class="tag">${t}</span>`).join('')}<span class="pct">${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%</span></h3>
        <p>${h.guaci}</p>
        <p class="gx">象曰：${h.daxiang}</p>
      </article>`;
    }).join('');
  }
  let lastCards = '';
  function renderCards(w, wz) {
    const c = getCast();
    const ben = (h) => (c && c.done && h.bits === c.ben ? ['本卦'] : []);
    const zhi = (h) => (c && c.done && h.bits === c.zhi && c.zhi !== c.ben ? ['之卦'] : []);
    let html;
    if (wz) {
      html = `<h4>本卦 <small>现状</small></h4>${cardsHTML(w, ben)}<h4>之卦 <small>趋势：老阳将阴，老阴将阳</small></h4>${cardsHTML(wz, zhi)}`;
    } else {
      html = cardsHTML(w, (h) => [...ben(h), ...zhi(h)]);
    }
    if (html !== lastCards) { $('#cards').innerHTML = html; lastCards = html; }
  }

  // ---------- 断语（朱熹《易学启蒙》变爻取辞法）----------
  function reading() {
    const c = getCast();
    if (!c || !c.done) return [];
    const ben = byBits[c.ben], zhi = byBits[c.zhi], m = c.moving, n = m.length;
    const yao = (h, i) => ({ h, text: h.yao[i], xiao: h.xiao[i] });
    const gua = (h) => ({ h, text: h.guaci });
    const stat = [0, 1, 2, 3, 4, 5].filter((i) => !m.includes(i));
    const lines = [];
    let rule;
    if (n === 0) { rule = '六爻皆不变，以本卦卦辞断。'; lines.push(gua(ben)); }
    else if (n === 1) { rule = '一爻变，以本卦变爻之辞断。'; lines.push(yao(ben, m[0])); }
    else if (n === 2) { rule = '二爻变，以本卦二变爻之辞断，以上爻为主。'; lines.push(yao(ben, m[1]), yao(ben, m[0])); }
    else if (n === 3) { rule = '三爻变，以本卦、之卦卦辞合断，本卦为贞，之卦为悔。'; lines.push(gua(ben), gua(zhi)); }
    else if (n === 4) { rule = '四爻变，以之卦二不变爻之辞断，以下爻为主。'; lines.push(yao(zhi, stat[0]), yao(zhi, stat[1])); }
    else if (n === 5) { rule = '五爻变，以之卦不变爻之辞断。'; lines.push(yao(zhi, stat[0])); }
    else if (ben.n === 1 || ben.n === 2) { rule = `六爻皆变，${ben.n === 1 ? '乾' : '坤'}卦以"${ben.n === 1 ? '用九' : '用六'}"断。`; lines.push({ h: ben, text: ben.extra[0] }); }
    else { rule = '六爻皆变，以之卦卦辞断。'; lines.push(gua(zhi)); }
    return { rule, lines, ben, zhi };
  }
  // 窄屏下卦辞排在空间视图之前，用一条吸顶的摘要告诉用户当前落在哪一卦
  function renderChip(w, wz) {
    const top = (ws) => { const [h, p] = H.map((h) => [h, ws[h.bits]]).sort((a, b) => b[1] - a[1])[0]; return `${glyph(h.n)} ${h.name} ${Math.round(p * 100)}%`; };
    const t = wz ? `${top(w)} → ${top(wz)}` : top(w);
    if ($('#chip').textContent !== t) $('#chip').textContent = t;
  }
  let lastReading = '';
  function renderReading() {
    const r = reading(), root = $('#reading');
    if (!r || !r.lines) { if (lastReading) root.innerHTML = ''; lastReading = ''; return; }
    const html = `<h2>断语</h2>
      <p class="route">${glyph(r.ben.n)} ${r.ben.name}<span class="arrow">${r.ben === r.zhi ? '' : '→'}</span>${r.ben === r.zhi ? '' : `${glyph(r.zhi.n)} ${r.zhi.name}`}</p>
      <small>${r.rule}</small>
      ${r.lines.map((l) => `<div class="pick"><small>${l.h.name}卦</small>${l.text}${l.xiao ? `<small>象曰：${l.xiao}</small>` : ''}</div>`).join('')}`;
    if (html !== lastReading) { root.innerHTML = html; lastReading = html; }
  }

  // ---------- 起卦流程 ----------
  function applyT() {
    const c = state.cast;
    for (let i = 0; i < 6; i++) state.x[i] = +c.ben[i] + (+c.zhi[i] - +c.ben[i]) * state.t;
  }
  function logLine(i, res) {
    const li = document.createElement('li');
    const v = res.value, name = `${LINE_NAMES[i]}爻`;
    let how;
    if (res.method === 'yarrow') {
      how = res.steps.map((s) => `${s.total}→分${s.left}/${s.right}·挂一·余${s.rl}+${s.rr}→去${s.removed}`).join('；');
    } else {
      how = res.faces.map((f) => (f === 3 ? '正' : '反')).join('');
    }
    li.innerHTML = `<b>${name}</b> <span class="v${v}">${v} ${D.NAMES[v]}</span><br><small>${how}</small>`;
    $('#log').prepend(li);
  }
  async function cast() {
    if (state.busy) return;
    state.busy = true; $('#cast').disabled = true; state.flow = false; $('#flow').textContent = '▶ 流转';
    const method = document.querySelector('input[name=method]:checked').value;
    state.cast = { values: [], done: false };
    state.detached = false; state.castPhaseValid = false;
    state.x.fill(0.5); state.z.fill(0.5); state.p.fill(0.375); state.t = 0; $('#t').value = 0;
    $('#log').innerHTML = '';
    updateControls(); render();
    if (method === 'yarrow') stalks.setSpeed(document.querySelector('input[name=speed]:checked').value);
    for (let i = 0; i < 6; i++) {
      let res;
      if (method === 'yarrow') { res = D.dayan(); await stalks.playLine(res.steps); await sleep(150); }
      else { await sleep(700); res = D.coins(); }
      state.cast.values.push(res.value);
      state.x[i] = D.isYang(res.value) ? 1 : 0; state.z[i] = state.x[i];
      state.p[i] = D.PHASE_OF[res.value];
      logLine(i, res);
      render();
    }
    Object.assign(state.cast, D.resolve(state.cast.values), { done: true });
    state.castPhaseValid = true;
    state.busy = false; $('#cast').disabled = false;
    updateControls(); render();
  }

  // ---------- 总渲染 ----------
  function updateControls() {
    const c = state.cast;
    $('#tcontrol').hidden = !(!isTorus() && c && c.done && c.moving.length && !state.detached);
    $('#view-cube').hidden = isTorus(); $('#view-torus').hidden = !isTorus();
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.mode === state.mode));
  }
  function render() {
    if (isTorus()) deriveFromPhase(); else state.z = state.x.slice();
    const w = weights(), wz = isTorus() ? weights(state.z) : null;
    updateControls(); renderYao(); renderGrid(w, wz); renderCards(w, wz); renderReading(); renderChip(w, wz);
  }

  function setMode(m) {
    if (m === state.mode || state.busy) return;
    state.mode = m;
    if (m === 'torus') {
      if (state.cast && state.cast.done && state.castPhaseValid) state.cast.values.forEach((v, i) => (state.p[i] = D.PHASE_OF[v]));
      else syncPhaseFromX();
    } else {
      state.flow = false; $('#flow').textContent = '▶ 流转';
      // 回到立方体：取本卦阳度，之卦信息留在环面里
      state.detached = true; state.castPhaseValid = false;
      state.x = state.x.slice();
    }
    updateControls(); render();
  }

  buildYao(); buildGrid();
  const cubes = [makeCube($('#cube-lo'), 0), makeCube($('#cube-up'), 3)];
  const stalks = window.Stalks.create($('#stalks'));
  const torus = window.TorusView.create({
    rings: $('#rings'), tori: $('#tori'), state,
    onChange: () => { state.detached = true; state.castPhaseValid = false; render(); },
    onGrab: () => { state.flow = false; $('#flow').textContent = '▶ 流转'; },
  });
  $('#cast').addEventListener('click', cast);
  $('#t').addEventListener('input', (e) => {
    state.t = +e.target.value; applyT();
    state.castPhaseValid = state.t === 0; state.z = state.x.slice();
    render();
  });
  document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  document.querySelectorAll('input[name=method]').forEach((r) => r.addEventListener('change', () => {
    $('#stalkbox').classList.toggle('off', document.querySelector('input[name=method]:checked').value !== 'yarrow');
  }));
  $('#flow').addEventListener('click', () => {
    state.flow = !state.flow; $('#flow').textContent = state.flow ? '⏸ 暂停' : '▶ 流转';
  });

  let last = performance.now(), acc = 0;
  (function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (isTorus() && state.flow) {
      state.p.forEach((p, i) => (state.p[i] = D.wrap(p + dt * 0.05 * FLOW_RATE[i])));
      state.castPhaseValid = false; state.detached = true;
      acc += dt; if (acc > 0.1) { acc = 0; render(); }
    }
    stalks.draw();
    if (isTorus()) torus.draw(); else cubes.forEach((c) => c.draw());
    requestAnimationFrame(loop);
  })(last);
  updateControls(); render();
})();
