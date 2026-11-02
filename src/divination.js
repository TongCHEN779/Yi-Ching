/* 起卦模拟：大衍筮法（蓍草）与三钱法。纯函数，无 DOM 依赖。 */
(function (root) {
  const rnd = (n) => Math.floor(Math.random() * n);

  // 一"变"：分二、挂一、揲四、归奇。
  // 传统分析假设"左堆揲四余数 1–4 等概率"，据此采样余数，再在该余数类里随机取具体堆数，
  // 这样 6/7/8/9 的概率才是经典的 1/16、5/16、7/16、3/16。
  function bian(total) {
    const rl = 1 + rnd(4);                          // 左堆余数（整除记 4）
    const cands = [];
    for (let l = rl; l <= total - 2; l += 4) cands.push(l);
    const left = cands[rnd(cands.length)];
    const rightAfter = total - 1 - left;            // 挂一：从右堆取一策后
    const rr = rightAfter % 4 || 4;
    const removed = 1 + rl + rr;
    return { total, left, right: rightAfter + 1, rl, rr, removed, remain: total - removed };
  }

  // 一爻 = 三变；剩余策数 / 4 ∈ {6,7,8,9}
  function dayan() {
    let total = 49;
    const steps = [];
    for (let i = 0; i < 3; i++) {
      const s = bian(total);
      steps.push(s);
      total = s.remain;
    }
    return { value: total / 4, steps, method: 'yarrow' };
  }

  // 三钱法：正面 3、反面 2，三枚之和
  function coins() {
    const faces = [0, 0, 0].map(() => (Math.random() < 0.5 ? 3 : 2));
    return { value: faces[0] + faces[1] + faces[2], faces, method: 'coins' };
  }

  const isYang = (v) => v === 7 || v === 9;
  const isMoving = (v) => v === 6 || v === 9;
  const NAMES = { 6: '老阴', 7: '少阳', 8: '少阴', 9: '老阳' };

  // 由六爻（自下而上）得到本卦 / 之卦的 bits 与动爻
  function resolve(values) {
    const ben = values.map((v) => (isYang(v) ? '1' : '0')).join('');
    const zhi = values.map((v) => (isMoving(v) ? (isYang(v) ? '0' : '1') : (isYang(v) ? '1' : '0'))).join('');
    const moving = values.map((v, i) => (isMoving(v) ? i : -1)).filter((i) => i >= 0);
    return { ben, zhi, moving };
  }

  // ---- 四象环：每爻一个相位 p ∈ [0,1) ----
  // p = 0 少阳(7)，0.25 老阳(9)，0.5 少阴(8)，0.75 老阴(6)；顺时针循环 = 春夏秋冬。
  // 四个"帐篷函数"权重之和恒为 1，在四象中心处恰为 1，所以环面的离散格点 = 4096 个（本卦,之卦）状态。
  const CENTERS = [0, 0.25, 0.5, 0.75];
  const QVAL = [7, 9, 8, 6];
  const wrap = (p) => ((p % 1) + 1) % 1;
  function tent(p) { // [少阳, 老阳, 少阴, 老阴] 的权重
    return CENTERS.map((c) => {
      const d = Math.abs(wrap(p - c + 0.5) - 0.5);
      return Math.max(0, 1 - 4 * d);
    });
  }
  // 该爻在本卦、之卦中为阳的概率：老阳 本阳→之阴；老阴 本阴→之阳
  function phaseYang(p) { const w = tent(p); return { yb: w[0] + w[1], yz: w[0] + w[3] }; }
  const quant = (p) => QVAL[Math.round(wrap(p) * 4) % 4];
  const PHASE_OF = { 7: 0, 9: 0.25, 8: 0.5, 6: 0.75 };

  const api = { tent, phaseYang, quant, wrap, PHASE_OF, bian, dayan, coins, isYang, isMoving, resolve, NAMES };
  if (typeof module !== 'undefined') module.exports = api; else root.Divination = api;
})(typeof window !== 'undefined' ? window : globalThis);
