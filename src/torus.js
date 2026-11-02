/* 环面视图：每爻一个四象相位 p，六爻 = T⁶。
 * T⁶ 画不出来，这里给两种直观：
 *  1) rings：六个四象环（T⁶ 的六个坐标），可拖动；
 *  2) tori：把"相应"的两爻（初-四、二-五、三-上）配成三个 T²，画成真正的三维环面。 */
(function (root) {
  const D = root.Divination;
  const LINE_NAMES = ['初', '二', '三', '四', '五', '上'];
  const NAMES = ['少阳', '老阳', '少阴', '老阴'];
  const VALS = [7, 9, 8, 6];
  const ARC_COL = ['#c2a15f', '#d1503a', '#4d4538', '#8a3a2c'];
  const PAIRS = [[0, 3], [1, 4], [2, 5]]; // 初应四、二应五、三应上
  // p → 画布角度：p=0 在左(少阳)，0.25 在上(老阳)，0.5 在右(少阴)，0.75 在下(老阴)，顺时针
  const ang = (p) => Math.PI + 2 * Math.PI * p;

  function fit(canvas) {
    const dpr = window.devicePixelRatio || 1, r = canvas.getBoundingClientRect();
    const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    return dpr;
  }

  function create({ rings, tori, state, onChange, onGrab }) {
    const rc = rings.getContext('2d'), tc = tori.getContext('2d');
    // 列 j 的两爻：上排 = PAIRS[j][1]（四五上），下排 = PAIRS[j][0]（初二三）
    const ringIndex = (col, row) => (row === 1 ? PAIRS[col][0] : PAIRS[col][1]);
    const gridIdx = (i) => { const col = PAIRS.findIndex((p) => p.includes(i)); return { col, row: PAIRS[col][0] === i ? 1 : 0 }; };
    const pos = (i) => {
      const { col, row } = gridIdx(i), w = rings.width / 3, h = rings.height / 2, R = Math.min(w, h) * 0.34;
      return { cx: w * (col + 0.5), cy: h * (row + 0.5), R, w, h };
    };

    function drawRings() {
      const dpr = fit(rings), ctx = rc;
      ctx.clearRect(0, 0, rings.width, rings.height);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = 0; i < 6; i++) {
        const { cx, cy, R } = pos(i), p = D.wrap(state.p[i]), v = D.quant(p), w = D.tent(p);
        for (let k = 0; k < 4; k++) {
          const a0 = ang(k / 4 - 0.125), a1 = ang(k / 4 + 0.125);
          ctx.beginPath(); ctx.arc(cx, cy, R, a0, a1);
          ctx.strokeStyle = ARC_COL[k]; ctx.lineWidth = (7 + 5 * w[k]) * dpr; ctx.lineCap = 'butt'; ctx.stroke();
          const am = ang(k / 4);
          ctx.fillStyle = '#e8dcc4'; ctx.font = `${11 * dpr}px "Songti SC", serif`;
          ctx.fillText(VALS[k], cx + Math.cos(am) * (R + 17 * dpr), cy + Math.sin(am) * (R + 17 * dpr));
        }
        const a = ang(p), px = cx + Math.cos(a) * R, py = cy + Math.sin(a) * R;
        ctx.beginPath(); ctx.arc(px, py, 6.5 * dpr, 0, 7);
        ctx.fillStyle = '#fff3d6'; ctx.fill(); ctx.strokeStyle = '#14110f'; ctx.lineWidth = 2 * dpr; ctx.stroke();
        ctx.fillStyle = '#e8dcc4'; ctx.font = `${15 * dpr}px "Songti SC", serif`;
        ctx.fillText(`${LINE_NAMES[i]}爻`, cx, cy - 8 * dpr);
        ctx.fillStyle = D.isMoving(v) ? '#d1503a' : '#8f8571'; ctx.font = `${12 * dpr}px "Songti SC", serif`;
        ctx.fillText(`${v} ${D.NAMES[v]}`, cx, cy + 10 * dpr);
      }
    }

    // ---- 三维环面 ----
    const view = { rx: -0.95, ry: 0.4, drag: null };
    const proj = (p3) => {
      const cy = Math.cos(view.ry), sy = Math.sin(view.ry), cx = Math.cos(view.rx), sx = Math.sin(view.rx);
      let [x, y, z] = p3;
      [x, z] = [x * cy + z * sy, -x * sy + z * cy];
      [y, z] = [y * cx - z * sx, y * sx + z * cx];
      const s = 5 / (5 + z * 0.5);
      return [x * s, -y * s];
    };
    const RM = 1, Rm = 0.42;
    const surf = (u, v) => [(RM + Rm * Math.cos(v)) * Math.cos(u), (RM + Rm * Math.cos(v)) * Math.sin(u), Rm * Math.sin(v)];

    function drawTori() {
      const dpr = fit(tori), ctx = tc, W = tori.width / 3, H = tori.height;
      ctx.clearRect(0, 0, tori.width, tori.height);
      if (!view.drag) view.ry += 0.004;
      PAIRS.forEach(([a, b], j) => {
        const ox = W * (j + 0.5), oy = H * 0.46, k = W * 0.2;
        const P = (u, v) => { const [x, y] = proj(surf(u, v)); return [ox + x * k, oy + y * k]; };
        ctx.lineWidth = dpr * 0.8; ctx.strokeStyle = 'rgba(194,161,95,.2)';
        for (let iu = 0; iu < 20; iu++) {
          ctx.beginPath();
          for (let s = 0; s <= 24; s++) { const [x, y] = P((iu / 20) * 2 * Math.PI, (s / 24) * 2 * Math.PI); s ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
          ctx.stroke();
        }
        for (let iv = 0; iv < 10; iv++) {
          ctx.beginPath();
          for (let s = 0; s <= 48; s++) { const [x, y] = P((s / 48) * 2 * Math.PI, (iv / 10) * 2 * Math.PI); s ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
          ctx.stroke();
        }
        // u ← 下爻相位(初二三)，v ← 上爻相位(四五上)；同样 p=0 起于"左"
        const u = ang(D.wrap(state.p[a])) , v = ang(D.wrap(state.p[b]));
        ctx.strokeStyle = 'rgba(209,80,58,.9)'; ctx.lineWidth = dpr * 1.6;
        ctx.beginPath(); for (let s = 0; s <= 48; s++) { const [x, y] = P(u, (s / 48) * 2 * Math.PI); s ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
        ctx.strokeStyle = 'rgba(232,220,196,.9)';
        ctx.beginPath(); for (let s = 0; s <= 48; s++) { const [x, y] = P((s / 48) * 2 * Math.PI, v); s ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
        const [px, py] = P(u, v);
        ctx.beginPath(); ctx.arc(px, py, 6 * dpr, 0, 7); ctx.fillStyle = '#fff3d6'; ctx.fill();
        ctx.strokeStyle = '#d1503a'; ctx.lineWidth = 2 * dpr; ctx.stroke();
        ctx.fillStyle = '#8f8571'; ctx.font = `${12 * dpr}px "Songti SC", serif`; ctx.textAlign = 'center';
        ctx.fillText(`${LINE_NAMES[a]} 应 ${LINE_NAMES[b]}`, ox, H - 8 * dpr);
      });
    }

    // ---- 交互：环上拖动 ----
    let grab = null;
    const setFrom = (i, e) => {
      const r = rings.getBoundingClientRect(), dpr = rings.width / r.width, g = pos(i);
      const dx = (e.clientX - r.left) * dpr - g.cx, dy = (e.clientY - r.top) * dpr - g.cy;
      state.p[i] = D.wrap((Math.atan2(dy, dx) - Math.PI) / (2 * Math.PI));
      onChange();
    };
    rings.addEventListener('pointerdown', (e) => {
      const r = rings.getBoundingClientRect(), dpr = rings.width / r.width;
      const mx = (e.clientX - r.left) * dpr, my = (e.clientY - r.top) * dpr;
      const col = Math.min(2, Math.floor(mx / (rings.width / 3))), row = my > rings.height / 2 ? 1 : 0;
      grab = ringIndex(col, row); rings.setPointerCapture(e.pointerId); onGrab(); setFrom(grab, e);
    });
    rings.addEventListener('pointermove', (e) => { if (grab !== null) setFrom(grab, e); });
    rings.addEventListener('pointerup', () => { grab = null; });

    tori.addEventListener('pointerdown', (e) => { tori.setPointerCapture(e.pointerId); view.drag = { x: e.clientX, y: e.clientY }; });
    tori.addEventListener('pointermove', (e) => {
      if (!view.drag) return;
      view.ry += (e.clientX - view.drag.x) * 0.01;
      view.rx = Math.max(-1.5, Math.min(0.2, view.rx + (e.clientY - view.drag.y) * 0.01));
      view.drag = { x: e.clientX, y: e.clientY };
    });
    tori.addEventListener('pointerup', () => { view.drag = null; });

    return { draw() { drawRings(); drawTori(); } };
  }
  root.TorusView = { create };
})(window);
