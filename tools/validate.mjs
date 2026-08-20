/* 金融科技树 · 数据校验器（命令行版）
 * 用法: node tools/validate.mjs
 * 浏览器内同样的校验逻辑见 assets/validator.js，页面加载时自动运行。 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
globalThis.window = globalThis;
const load = (f) => {
  try { new Function(readFileSync(join(root, f), 'utf8'))(); } catch (e) {
    if (e.code !== 'ENOENT') console.error(`[加载失败] ${f}: ${e.message}`);
  }
};
['data/taxonomy.js', 'data/nodes.js', 'data/awards.js', 'data/orgs/index.js'].forEach(load);
(globalThis.TT.orgRegistry || []).forEach(o => load(o.file));
const { taxonomy: tx, nodes, awards = [], orgs = [] } = globalThis.TT;

const errors = [], warns = [];
const E = (m) => errors.push(m), W = (m) => warns.push(m);

const eraIdx = Object.fromEntries(tx.eras.map((e, i) => [e.id, i]));
const capIds = new Set(tx.capabilities.map(c => c.id));
const domIds = new Set(tx.domains.map(d => d.id));
const archIds = new Set(tx.arch.map(a => a.id));
const tagIds = new Set(tx.tags.map(t => t.id));
const enums = {
  maturity: new Set(tx.maturity.map(m => m.id)),
  adoption: new Set(tx.adoption.map(a => a.id)),
  confidence: new Set(tx.confidence.map(c => c.id)),
  autonomy: new Set(tx.autonomy.map(a => a.id))
};

/* --- 分类体系自身 --- */
tx.capabilities.forEach(c => { if (!domIds.has(c.domain)) E(`能力 ${c.id} 指向不存在的领域 ${c.domain}`); });
tx.domains.forEach(d => {
  if (!archIds.has(d.arch)) E(`领域 ${d.id} 指向不存在的架构线 ${d.arch}`);
  (d.spanArch || []).forEach(a => { if (!archIds.has(a)) E(`领域 ${d.id} 的 spanArch 含未知架构线 ${a}`); });
});

/* --- 节点字段 --- */
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
  if (!n.effort || typeof n.effort.manMonth !== 'number') E(`${n.id} 缺少 effort.manMonth`);
  for (const k of ['value', 'risk'])
    if (!(n[k] >= 1 && n[k] <= 5)) E(`${n.id} 的 ${k} 应在 1–5 之间`);
});

/* --- 依赖引用与时代顺序 --- */
nodes.forEach(n => {
  (n.deps || []).forEach(d => {
    const dep = byId.get(d);
    if (!dep) return E(`${n.id} 依赖了不存在的节点 ${d}`);
    if (d === n.id) return E(`${n.id} 依赖了自己`);
    const gap = eraIdx[n.era] - eraIdx[dep.era];
    if (gap < 0) E(`时代倒挂：${n.id}(${n.era}) 依赖了更晚的 ${d}(${dep.era})`);
    else if (gap >= 3) W(`跨代较远：${n.id}(${n.era}) 依赖 ${d}(${dep.era})，相隔 ${gap} 个时代`);
  });
});

/* --- 环检测（DFS 三色标记） --- */
const color = new Map();
const stack = [];
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

/* --- 孤儿与覆盖度 --- */
const referenced = new Set(nodes.flatMap(n => n.deps || []));
const roots = nodes.filter(n => !(n.deps || []).length);
if (roots.length > 3) W(`根节点偏多（${roots.length} 个）：${roots.map(r => r.id).join(', ')}，确认是否遗漏了依赖`);
nodes.forEach(n => {
  if (!referenced.has(n.id) && !(n.deps || []).length) W(`${n.id} 既无前置也无后继，可能是孤立节点`);
});
const emptyCaps = tx.capabilities.filter(c => !nodes.some(n => n.cap === c.id));
emptyCaps.forEach(c => W(`能力 ${c.id} ${c.name} 下没有任何技术节点`));

/* --- 奖项映射 --- */
awards.forEach((a, i) => (a.mappedNodes || []).forEach(m => {
  if (!byId.has(m)) E(`奖项条目 #${i + 1}（${a.project || '未命名'}）映射到不存在的节点 ${m}`);
}));

/* --- 单位档案 --- */
const statusIds = new Set(tx.status.map(s => s.id));
orgs.forEach(o => {
  Object.entries(o.overrides || {}).forEach(([id, ov]) => {
    if (!byId.has(id)) E(`单位 ${o.orgId} 覆盖了不存在的节点 ${id}`);
    if (ov.status && !statusIds.has(ov.status)) E(`单位 ${o.orgId} 的 ${id} 状态 "${ov.status}" 不合法`);
  });
});

/* --- 输出 --- */
const stat = {};
nodes.forEach(n => { stat[n.era] = (stat[n.era] || 0) + 1; });
console.log(`\n节点 ${nodes.length} 个 · 依赖边 ${nodes.reduce((s, n) => s + (n.deps || []).length, 0)} 条 · 奖项 ${awards.length} 条 · 单位 ${orgs.length} 个`);
console.log('各时代分布：' + tx.eras.map(e => `${e.roman}${stat[e.id] || 0}`).join('  '));
const crossArch = nodes.reduce((s, n) => {
  const a = tx.capabilities.find(c => c.id === n.cap);
  const da = tx.domains.find(d => d.id === a?.domain)?.arch;
  return s + (n.deps || []).filter(d => {
    const dn = byId.get(d); if (!dn) return false;
    const ca = tx.capabilities.find(c => c.id === dn.cap);
    return tx.domains.find(x => x.id === ca?.domain)?.arch !== da;
  }).length;
}, 0);
console.log(`跨 5A 架构线的依赖边：${crossArch} 条`);
if (warns.length) console.log('\n⚠  警告 ' + warns.length + ' 条：\n' + warns.map(w => '   · ' + w).join('\n'));
if (errors.length) { console.log('\n✖  错误 ' + errors.length + ' 条：\n' + errors.map(e => '   · ' + e).join('\n')); process.exit(1); }
console.log('\n✔  校验通过，未发现结构性错误。\n');
