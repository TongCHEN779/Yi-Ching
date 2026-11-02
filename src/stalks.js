/* 蓍草分堆动画：49 策，一爻三变，每变 分二 → 挂一 → 揲四 → 归奇 → 合策。
 * 输入是 Divination.dayan() 给出的 steps，动画只负责呈现，不再产生随机数。 */
(function (root) {
  const LW = 400, LH = 150;        // 逻辑坐标，画布按此缩放
  const S = 5.6, GAP = 5, M = 12;  // 策距、组间隙、边距
  const Y_MAIN = 118, Y_HANG = 72, Y_PILE = 28;
  const COL = { base: '#e8dcc4', hang: '#c2a15f', rem: '#d1503a', pile: '#7d7360' };
  const SPEEDS = { slow: { t: 1.0, rate: 0.12 }, fast: { t: 0.3, rate: 0.3 }, instant: { t: 0, rate: 1 } };

  function create(canvas) {
    const ctx = canvas.getContext('2d');
    const st = Array.from({ length: 49 }, () => ({ x: LW / 2, y: Y_MAIN, tx: LW / 2, ty: Y_MAIN, c: COL.base }));
    let speed = SPEEDS.fast, title = '', label = '', pileCount = 0;

    const sleep = (ms) => new Promise((r) => setTimeout(r, speed.t ? ms * speed.t : 12));
    const place = (id, x, y, c) => { const s = st[id]; s.tx = x; s.ty = y; if (c) s.c = c; };
    const bundle = (ids) => ids.forEach((id, j) => place(id, LW / 2 + (j - (ids.length - 1) / 2) * S, Y_MAIN, COL.base));
    const snapAll = () => st.forEach((s) => { s.x = s.tx; s.y = s.ty; });

    // 把一堆按"组"排开：sizes 从外侧（含余数组）向内；side = 'L' 靠左外侧起排，'R' 靠右外侧起排
    function groups(ids, sizes, side, remColor) {
      let cur = side === 'L' ? M : LW - M, k = side === 'L' ? 0 : ids.length - 1;
      sizes.forEach((n, gi) => {
        for (let j = 0; j < n; j++) {
          place(ids[k], cur, Y_MAIN, gi === 0 ? remColor : COL.base);
          k += side === 'L' ? 1 : -1;
          cur += side === 'L' ? S : -S;
        }
        cur += side === 'L' ? GAP : -GAP;
      });
    }
    const plain = (L, R) => {
      L.forEach((id, j) => place(id, M + j * S, Y_MAIN, COL.base));
      R.forEach((id, j) => place(id, LW - M - (R.length - 1 - j) * S, Y_MAIN, COL.base));
    };

    async function playLine(steps) {
      let all = [...Array(49).keys()];
      st.forEach((s) => (s.c = COL.base));
      title = '合策'; label = '四十九策'; pileCount = 0;
      bundle(all); if (speed.t === 0) snapAll(); await sleep(500);
      let live = all, pile = [];
      for (let k = 0; k < steps.length; k++) {
        const s = steps[k];
        if (live.length !== s.total) throw new Error('stalk count mismatch');
        title = `第${'一二三'[k]}变`;
        // 分二
        label = `分二 · 左 ${s.left} 右 ${s.right}`;
        const L = live.slice(0, s.left), R0 = live.slice(s.left);
        plain(L, R0); if (speed.t === 0) snapAll(); await sleep(750);
        // 挂一
        label = '挂一 · 取右堆一策';
        const hung = R0[0], R = R0.slice(1);
        place(hung, LW / 2, Y_HANG, COL.hang);
        if (speed.t === 0) snapAll(); await sleep(600);
        // 揲四（左）
        const lg = [s.rl, ...Array((L.length - s.rl) / 4).fill(4)];
        label = `揲四左堆 · 余 ${s.rl}`;
        groups(L, lg, 'L', COL.rem); if (speed.t === 0) snapAll(); await sleep(750);
        // 揲四（右）
        const rg = [s.rr, ...Array((R.length - s.rr) / 4).fill(4)];
        label = `揲四右堆 · 余 ${s.rr}`;
        groups(R, rg, 'R', COL.rem); if (speed.t === 0) snapAll(); await sleep(750);
        // 归奇：挂一 + 左余 + 右余 → 置于一旁
        const remL = L.slice(0, s.rl), remR = R.slice(R.length - s.rr);
        const out = [hung, ...remL, ...remR];
        label = `归奇 · 去 ${s.removed} 策（1+${s.rl}+${s.rr}）`;
        out.forEach((id, j) => place(id, LW - M - (pile.length + j) * S, Y_PILE, COL.pile));
        pile = pile.concat(out); pileCount = pile.length;
        if (speed.t === 0) snapAll(); await sleep(800);
        // 合策
        live = [...L.slice(s.rl), ...R.slice(0, R.length - s.rr)];
        label = `余 ${s.remain} 策`;
        bundle(live); if (speed.t === 0) snapAll(); await sleep(650);
      }
      const v = live.length / 4;
      title = '三变毕'; label = `${live.length} 策 ÷ 4 = ${v}`;
      await sleep(500);
    }

    function draw() {
      const dpr = window.devicePixelRatio || 1, r = canvas.getBoundingClientRect();
      const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      const k = canvas.width / LW;
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.clearRect(0, 0, LW, LH);
      for (const s of st) {
        s.x += (s.tx - s.x) * speed.rate; s.y += (s.ty - s.y) * speed.rate;
        if (Math.abs(s.tx - s.x) < 0.05) s.x = s.tx;
        if (Math.abs(s.ty - s.y) < 0.05) s.y = s.ty;
      }
      ctx.lineCap = 'round'; ctx.lineWidth = 1.7;
      for (const s of st) {
        const half = s.ty < 50 ? 10 : 16;
        ctx.strokeStyle = s.c;
        ctx.beginPath(); ctx.moveTo(s.x, s.y - half); ctx.lineTo(s.x, s.y + half); ctx.stroke();
      }
      ctx.font = '12px "Songti SC", serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillStyle = '#c2a15f'; ctx.fillText(title, M, 8);
      ctx.fillStyle = '#e8dcc4'; ctx.fillText(label, M, 26);
      if (pileCount) { ctx.textAlign = 'right'; ctx.fillStyle = '#7d7360'; ctx.fillText(`掛扐 ${pileCount}`, LW - M, 44); }
    }

    bundle([...Array(49).keys()]); snapAll();
    return { playLine, draw, setSpeed: (n) => { speed = SPEEDS[n] || SPEEDS.fast; } };
  }
  root.Stalks = { create };
})(window);
