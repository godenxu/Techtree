/* ==========================================================================
 * 金融科技树 · 浏览器内数据校验
 * 页面加载时自动运行；发现问题在顶栏显示角标，点开可看到具体节点 ID。
 * 与 tools/validate.mjs 的规则保持一致。
 * ========================================================================== */
var TT = (globalThis.TT = globalThis.TT || {});

TT.validate = function () {
  const tx = TT.taxonomy, nodes = TT.nodes || [], awards = TT.awards || [], orgs = TT.orgs || [];
  const errors = [], warns = [];
  const E = m => errors.push(m), W = m => warns.push(m);

  const eraIdx = Object.fromEntries(tx.eras.map((e, i) => [e.id, i]));
  const capIds = new Set(tx.capabilities.map(c => c.id));
  const domIds = new Set(tx.domains.map(d => d.id));
  const archIds = new Set(tx.arch.map(a => a.id));
  const tagIds = new Set(tx.tags.map(t => t.id));
  const statusIds = new Set(tx.status.map(s => s.id));
  const enums = {
    maturity: new Set(tx.maturity.map(m => m.id)),
    adoption: new Set(tx.adoption.map(a => a.id)),
    confidence: new Set(tx.confidence.map(c => c.id)),
    autonomy: new Set(tx.autonomy.map(a => a.id))
  };

  tx.capabilities.forEach(c => { if (!domIds.has(c.domain)) E(`能力 ${c.id} 指向不存在的领域 ${c.domain}`); });
  tx.domains.forEach(d => { if (!archIds.has(d.arch)) E(`领域 ${d.id} 指向不存在的架构线 ${d.arch}`); });

  const byId = new Map();
  nodes.forEach(n => {
    if (byId.has(n.id)) E(`节点 ID 重复：${n.id}`);
    byId.set(n.id, n);
    if (!capIds.has(n.cap)) E(`${n.id} 归属的能力 ${n.cap} 不存在`);
    if (!(n.era in eraIdx)) E(`${n.id} 的时代 ${n.era} 不合法`);
    for (const k of ['maturity', 'adoption', 'confidence', 'autonomy'])
      if (n[k] && !enums[k].has(n[k])) E(`${n.id} 的 ${k}="${n[k]}" 不是合法取值`);
    (n.tags || []).forEach(t => { if (!tagIds.has(t)) E(`${n.id} 含未定义的标签 ${t}`); });
    if (!n.name || !n.desc) E(`${n.id} 缺少 name 或 desc`);
  });

  nodes.forEach(n => (n.deps || []).forEach(d => {
    const dep = byId.get(d);
    if (!dep) return E(`${n.id} 依赖了不存在的节点 ${d}`);
    if (d === n.id) return E(`${n.id} 依赖了自己`);
    const gap = eraIdx[n.era] - eraIdx[dep.era];
    if (gap < 0) E(`时代倒挂：${n.id}(${n.era}) 依赖了更晚的 ${d}(${dep.era})`);
    else if (gap >= 3) W(`跨代较远：${n.id} 依赖 ${d}，相隔 ${gap} 个时代`);
  }));

  const color = new Map(), stack = [];
  (function () {
    function dfs(id) {
      if (color.get(id) === 2) return;
      if (color.get(id) === 1) {
        const at = stack.indexOf(id);
        return E(`存在循环依赖：${stack.slice(at).concat(id).join(' → ')}`);
      }
      color.set(id, 1); stack.push(id);
      (byId.get(id)?.deps || []).forEach(d => { if (byId.has(d)) dfs(d); });
      stack.pop(); color.set(id, 2);
    }
    nodes.forEach(n => dfs(n.id));
  })();

  /* 除了每条线真正的起点，其他节点都应该有前置 —— 没有前置说明依赖漏填了 */
  const roots = nodes.filter(n => !(n.deps || []).length);
  roots.forEach(r => {
    if (eraIdx[r.era] > 0) E(`${r.id} ${r.name}（${r.era}）没有任何前置，只有第 Ⅰ 时代的起点技术才允许无前置`);
  });
  if (roots.length > 1) W(`根节点有 ${roots.length} 个：${roots.map(r => r.id + ' ' + r.name).join('、')}，确认是否都是真正的起点`);
  /* 生命周期字段自洽性 */
  nodes.forEach(n => {
    if (n.lifecycle && !['active', 'legacy', 'sunset'].includes(n.lifecycle))
      E(`${n.id} 的 lifecycle="${n.lifecycle}" 不合法`);
    (n.supersededBy || []).forEach(x => {
      if (!byId.has(x)) E(`${n.id} 的 supersededBy 指向不存在的节点 ${x}`);
      else if (eraIdx[byId.get(x).era] < eraIdx[n.era]) W(`${n.id} 被更早时代的 ${x} 替代，确认是否写反`);
    });
    if (n.lifecycle && n.lifecycle !== 'active' && !(n.supersededBy || []).length)
      W(`${n.id} 标记为${n.lifecycle === 'sunset' ? '退役中' : '存量维持'}但没写替代方向 supersededBy`);
  });

  tx.capabilities.forEach(c => {
    if (!nodes.some(n => n.cap === c.id)) W(`能力 ${c.id} ${c.name} 下没有任何技术节点`);
  });
  awards.forEach((a, i) => (a.mappedNodes || []).forEach(mn => {
    if (!byId.has(mn)) E(`奖项「${a.project || '#' + (i + 1)}」映射到不存在的节点 ${mn}`);
  }));
  orgs.forEach(o => Object.entries(o.overrides || {}).forEach(([id, ov]) => {
    if (!byId.has(id)) E(`单位「${o.orgName}」覆盖了不存在的节点 ${id}`);
    if (ov.status && !statusIds.has(ov.status)) E(`单位「${o.orgName}」的 ${id} 状态 "${ov.status}" 不合法`);
  }));

  return { errors, warns };
};
