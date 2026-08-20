/* ==========================================================================
 * 金融科技树 · 模型层
 * 负责：索引、层级归并、依赖图运算、单位档案叠加、进度汇总、路线图排程。
 * 关键约定：依赖关系只在 L2 技术层定义一次；
 *          L1 能力层与 L0 领域层的连线与进度全部由此文件自动推导。
 * ========================================================================== */
var TT = (globalThis.TT = globalThis.TT || {});

TT.model = (function () {
  const tx = TT.taxonomy;

  /* ---------------- 基础索引 ---------------- */
  const capById = new Map(tx.capabilities.map(c => [c.id, c]));
  const domById = new Map(tx.domains.map(d => [d.id, d]));
  const archById = new Map(tx.arch.map(a => [a.id, a]));
  const eraIdx = new Map(tx.eras.map((e, i) => [e.id, i]));
  const statusById = new Map(tx.status.map(s => [s.id, s]));
  const maturityById = new Map(tx.maturity.map(m => [m.id, m]));
  const adoptionById = new Map(tx.adoption.map(a => [a.id, a]));
  const autonomyById = new Map(tx.autonomy.map(a => [a.id, a]));
  const tagById = new Map(tx.tags.map(t => [t.id, t]));

  const archOfCap = capId => domById.get(capById.get(capId)?.domain)?.arch;
  const domainOfCap = capId => capById.get(capId)?.domain;

  /* ---------------- 奖项索引 ---------------- */
  const awardsByNode = new Map();
  (TT.awards || []).forEach(a => (a.mappedNodes || []).forEach(id => {
    if (!awardsByNode.has(id)) awardsByNode.set(id, []);
    awardsByNode.get(id).push(a);
  }));

  /* ---------------- 单位档案 ---------------- */
  function orgList() {
    const list = [{ orgId: 'benchmark', orgName: '世界金融科技基准', orgType: '行业整体', readonly: true }];
    (TT.orgs || []).forEach(o => list.push(o));
    return list;
  }
  const orgById = id => orgList().find(o => o.orgId === id);

  /* 叠加单位档案，产出本次渲染使用的技术节点全集 */
  function resolve(orgId) {
    const org = orgById(orgId);
    const base = TT.nodes.concat((org && org.customNodes) || []);
    const ov = (org && org.overrides) || {};
    return base.map(n => {
      const o = ov[n.id] || {};
      return Object.assign({}, n, o, {
        _status: orgId === 'benchmark' ? null : (o.status || 'unknown'),
        _arch: archOfCap(n.cap),
        _domain: domainOfCap(n.cap),
        _awards: awardsByNode.get(n.id) || [],
        _custom: !!n.custom || !!(org && (org.customNodes || []).some(c => c.id === n.id))
      });
    });
  }

  /* ---------------- 层级：L2 → L1 → L0 ---------------- */
  function hierarchy(nodes) {
    const techByCap = new Map(), capsByDom = new Map();
    nodes.forEach(n => {
      if (!techByCap.has(n.cap)) techByCap.set(n.cap, []);
      techByCap.get(n.cap).push(n);
    });
    tx.capabilities.forEach(c => {
      if (!capsByDom.has(c.domain)) capsByDom.set(c.domain, []);
      capsByDom.get(c.domain).push(c);
    });
    return { techByCap, capsByDom };
  }

  /* 某个聚合单元覆盖的技术节点。
   * 聚合单元的 ID 形如 `D06@E4`（领域 × 时代）或 `C601@E4`（能力 × 时代）——
   * 一个领域横跨多个时代，硬压成一个格子会让早期和末期的时代整列消失，
   * 讲演进路径时直接断代。所以聚合层按「主体 × 时代」切分。 */
  function splitUnitId(id) {
    const at = String(id).indexOf('@');
    return at < 0 ? { base: id, era: null } : { base: id.slice(0, at), era: id.slice(at + 1) };
  }

  function descendants(id, nodes, h) {
    const { base, era } = splitUnitId(id);
    let list;
    if (capById.has(base)) list = h.techByCap.get(base) || [];
    else if (domById.has(base)) list = (h.capsByDom.get(base) || []).flatMap(c => h.techByCap.get(c.id) || []);
    else return nodes.filter(n => n.id === base);
    return era ? list.filter(t => t.era === era) : list;
  }

  /* 某个主体（领域 / 能力）在哪些时代里有技术节点，按时代先后返回 */
  function erasOf(baseId, nodes, h) {
    const set = new Set(descendants(baseId, nodes, h).map(t => t.era));
    return tx.eras.filter(e => set.has(e.id)).map(e => e.id);
  }

  /* ---------------- 可见单元集：三档全局粒度 + 单点混合展开 ----------------
   * expanded 是一个 Set，含被展开的领域 / 能力 ID（不带 @时代 后缀）。 */
  function visibleUnits(nodes, expanded, h) {
    const out = [];
    tx.domains.forEach(d => {
      if (!expanded.has(d.id)) {
        erasOf(d.id, nodes, h).forEach(era =>
          out.push({ kind: 'domain', id: d.id + '@' + era, base: d.id, era, ref: d }));
        return;
      }
      (h.capsByDom.get(d.id) || []).forEach(c => {
        if (!expanded.has(c.id)) {
          erasOf(c.id, nodes, h).forEach(era =>
            out.push({ kind: 'cap', id: c.id + '@' + era, base: c.id, era, ref: c }));
          return;
        }
        (h.techByCap.get(c.id) || []).forEach(t =>
          out.push({ kind: 'tech', id: t.id, base: t.id, era: t.era, ref: t }));
      });
    });
    return out;
  }

  /* 把任意技术节点映射到它当前可见的承载单元 */
  function carrierOf(n, expanded) {
    if (expanded.has(n._domain) && expanded.has(n.cap)) return n.id;
    if (expanded.has(n._domain)) return n.cap + '@' + n.era;
    return n._domain + '@' + n.era;
  }

  /* ---------------- 进度汇总：L1/L0 的完成度由子节点加权得出 ---------------- */
  function progressOf(techNodes) {
    let sum = 0, cnt = 0, stat = {};
    techNodes.forEach(n => {
      const s = n._status || 'unknown';
      stat[s] = (stat[s] || 0) + 1;
      const w = statusById.get(s)?.weight;
      if (w !== null && w !== undefined) { sum += w; cnt++; }
    });
    return { pct: cnt ? sum / cnt : 0, counted: cnt, total: techNodes.length, stat };
  }

  /* 基准视图下用成熟度代替完成度，让基准树本身也有"进度"语义 */
  function maturityOf(techNodes) {
    if (!techNodes.length) return { pct: 0, total: 0 };
    const sum = techNodes.reduce((s, n) => s + ((maturityById.get(n.maturity)?.order || 0) / 5), 0);
    return { pct: sum / techNodes.length, total: techNodes.length };
  }

  /* ---------------- 依赖图：祖先链与后继链 ---------------- */
  function buildGraph(nodes) {
    const up = new Map(), down = new Map();
    nodes.forEach(n => { up.set(n.id, n.deps || []); if (!down.has(n.id)) down.set(n.id, []); });
    nodes.forEach(n => (n.deps || []).forEach(d => {
      if (!down.has(d)) down.set(d, []);
      down.get(d).push(n.id);
    }));
    return { up, down };
  }
  function reach(startIds, adj) {
    const seen = new Set(), stack = [...startIds];
    while (stack.length) {
      const id = stack.pop();
      (adj.get(id) || []).forEach(x => { if (!seen.has(x)) { seen.add(x); stack.push(x); } });
    }
    return seen;
  }

  /* ---------------- 规划模式：目标节点的最小依赖闭包 ----------------
   * 已建成的节点视为已满足，不再纳入路线；其余全部纳入。          */
  function planClosure(targetIds, byId, isBuilt) {
    const need = new Set(), stack = [...targetIds];
    while (stack.length) {
      const id = stack.pop();
      const n = byId.get(id); if (!n || need.has(id)) continue;
      if (isBuilt(n) && !targetIds.includes(id)) continue;
      need.add(id);
      (n.deps || []).forEach(d => { if (!need.has(d)) stack.push(d); });
    }
    return need;
  }

  /* 拓扑分层 + 年度产能约束的装箱排程 */
  function schedule(needSet, byId, capacityPerYear, startYear, isBuilt) {
    const ids = [...needSet];
    const indeg = new Map(), pending = new Map();
    ids.forEach(id => {
      const deps = (byId.get(id).deps || []).filter(d => needSet.has(d));
      pending.set(id, new Set(deps));
      indeg.set(id, deps.length);
    });
    const done = new Set(), plan = [];
    let year = startYear, guard = 0;
    while (done.size < ids.length && guard++ < 60) {
      const ready = ids.filter(id => !done.has(id) && pending.get(id).size === 0);
      if (!ready.length) {                       /* 兜底：避免异常数据导致死循环 */
        ids.filter(id => !done.has(id)).forEach(id => pending.get(id).clear());
        continue;
      }
      /* 同一批内优先做业务价值高、下游依赖多的 */
      ready.sort((a, b) => {
        const na = byId.get(a), nb = byId.get(b);
        return (nb.value || 0) - (na.value || 0) || (na.effort?.manMonth || 0) - (nb.effort?.manMonth || 0);
      });
      let used = 0; const batch = [];
      for (const id of ready) {
        const mm = byId.get(id).effort?.manMonth || 0;
        if (used > 0 && used + mm > capacityPerYear) continue;
        batch.push(id); used += mm;
        if (used >= capacityPerYear) break;
      }
      if (!batch.length) { batch.push(ready[0]); used = byId.get(ready[0]).effort?.manMonth || 0; }
      plan.push({ year, ids: batch, effort: used });
      batch.forEach(id => {
        done.add(id);
        ids.forEach(o => pending.get(o).delete(id));
      });
      year++;
    }
    return plan;
  }

  /* ---------------- 对比模式：单位 vs 另一单位（或基准） ---------------- */
  function compare(nodesA, nodesB) {
    const bById = new Map(nodesB.map(n => [n.id, n]));
    const score = n => {
      const w = statusById.get(n._status || 'unknown')?.weight;
      return w === null || w === undefined ? null : w;
    };
    return nodesA.map(a => {
      const b = bById.get(a.id);
      const sa = score(a), sb = b ? score(b) : null;
      let verdict = 'unknown';
      if (sa !== null && sb !== null) verdict = sa > sb + .01 ? 'ahead' : (sa < sb - .01 ? 'behind' : 'even');
      else if (sa !== null && sb === null) verdict = 'ahead';
      return { id: a.id, verdict, gap: (sa ?? 0) - (sb ?? 0) };
    });
  }

  /* 基准视图下的"落后"判定：拿单位状态与行业普及度对照 */
  function gapVsBenchmark(nodes) {
    const expect = { universal: 1.0, majority: 0.6, leaders: 0.3, pilot: 0.1, none: 0 };
    return nodes.map(n => {
      const w = statusById.get(n._status || 'unknown')?.weight;
      if (w === null || w === undefined) return { id: n.id, verdict: 'unknown', gap: 0 };
      const e = expect[n.adoption] ?? 0.3;
      const gap = w - e;
      return { id: n.id, verdict: gap > .12 ? 'ahead' : (gap < -.12 ? 'behind' : 'even'), gap };
    });
  }

  return {
    tx, capById, domById, archById, eraIdx, statusById, maturityById,
    adoptionById, autonomyById, tagById, awardsByNode,
    archOfCap, domainOfCap, orgList, orgById, resolve, hierarchy, descendants,
    visibleUnits, carrierOf, splitUnitId, erasOf, progressOf, maturityOf,
    buildGraph, reach, planClosure, schedule, compare, gapVsBenchmark
  };
})();
