/* 把"所问之事 + 卦象 + 卦辞爻辞 + 取辞法"整理成一段可直接贴给 AI 助手的提示词。纯函数，无 DOM 依赖。 */
(function (root) {
  const LINE_NAMES = ['初', '二', '三', '四', '五', '上'];
  const METHODS = { yarrow: '大衍筮法', coins: '三钱法' };

  function hexBlock(label, h) {
    return `${label}：第${h.n}卦「${h.name}」（${h.lower}下${h.upper}上）\n　卦辞：${h.guaci}\n　大象：${h.daxiang}`;
  }

  // question: 用户所问；method: 'yarrow'|'coins'|null；cast: { values, moving, ben, zhi }；
  // reading: { rule, lines:[{h,text,xiao}], ben, zhi }；names: Divination.NAMES
  function build({ question, method, cast, reading, names }) {
    const { ben, zhi } = reading;
    const q = (question || '').trim();
    const out = [];
    out.push('你是一位熟悉《周易》的解读者。请结合我的问题，对下面这次占卦的结果做一次解读。');
    out.push('');
    out.push('【我的问题】');
    out.push(q || '（我没有写具体问题。请先做一般性的提示，并告诉我补充怎样的信息可以让解读更具体。）');
    out.push('');
    out.push('【起卦结果】' + (METHODS[method] ? `（${METHODS[method]}）` : ''));
    out.push('六爻（自下而上）：' + cast.values.map((v, i) => `${LINE_NAMES[i]}爻 ${v}${names[v]}`).join('，'));
    out.push(hexBlock('本卦', ben));
    if (cast.moving.length) {
      out.push('动爻：' + cast.moving.map((i) => `${LINE_NAMES[i]}爻`).join('、'));
      for (const i of cast.moving) out.push(`　${ben.yao[i]}（小象：${ben.xiao[i]}）`);
      if (cast.moving.length === 6 && ben.extra[0]) out.push(`　${ben.extra[0]}`);
      if (zhi !== ben) out.push(hexBlock('之卦', zhi));
    } else {
      out.push('动爻：无，六爻皆不变。');
    }
    out.push('');
    out.push('【传统取辞法】' + reading.rule);
    for (const l of reading.lines) out.push(`　取辞（${l.h.name}卦）：${l.text}${l.xiao ? `（小象：${l.xiao}）` : ''}`);
    out.push('');
    out.push('【解读要求】');
    out.push('1. 先用白话概述本卦（有之卦的话一并说明）的整体意象，讲清卦辞与大象在说什么。');
    out.push('2. 再逐条解释"取辞"中的卦辞或爻辞，指出其中的关键意象。');
    out.push('3. 把这些意象和我的问题一一对应：现状如何、变化趋势如何（本卦到之卦）、需要留意什么、可以怎么做。');
    out.push('4. 把它当作帮助我整理思路的提示，不要预言吉凶或下定论；若问题涉及医疗、法律、财务等重大决定，请提醒我不要只依赖占卜，应咨询专业人士。');
    out.push('5. 篇幅控制在 600 字以内，结尾用一两句话总结。');
    return out.join('\n');
  }

  const api = { build };
  if (typeof module !== 'undefined') module.exports = api; else root.Prompt = api;
})(typeof window !== 'undefined' ? window : globalThis);
