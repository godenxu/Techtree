/* ==========================================================================
 * 单位注册表
 * --------------------------------------------------------------------------
 * ★ 新增一个单位只需三步（详见 docs/维护手册.md）：
 *   1. 复制 data/orgs/_template.js 为 data/orgs/<你的单位ID>.js
 *   2. 在文件里填 orgId / orgName / overrides
 *   3. 在下面的数组里加一行注册
 * 不需要改动 techtree.html 或任何代码文件。
 *
 * 说明：id 为 'benchmark' 的「世界金融科技基准」是内置只读视图，
 *      它不是某家机构的现状，而是行业整体成熟度，不需要也不能在此注册。
 * ========================================================================== */
var TT = (globalThis.TT = globalThis.TT || {});

TT.orgRegistry = [
  { id: 'my-bank',  name: '我行',       file: 'data/orgs/my-bank.js' },
  { id: 'demo-org', name: '示例股份行', file: 'data/orgs/demo-org.js' }
];
