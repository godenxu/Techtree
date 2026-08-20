/* ==========================================================================
 * 单位档案模板 —— 复制本文件并改名后使用
 * --------------------------------------------------------------------------
 * 核心原则：只写你要覆盖的字段，没写的一律继承基准树。
 * 因此当基准树日后新增技术节点时，本文件一行都不用改，
 * 新节点会自动以「未评估」状态出现在本单位的视图中。
 * ========================================================================== */
var TT = (globalThis.TT = globalThis.TT || {});
TT.orgs = TT.orgs || [];

TT.orgs.push({
  orgId:   'your-org-id',          // 与 index.js 注册表中的 id 保持一致
  orgName: '你的单位名称',
  orgType: '股份制银行',            // 国有大行 / 股份制银行 / 城商行 / 农商行 / 子公司 / 分行
  updatedAt: '2026-08-20',
  editors: ['科技规划处'],
  brandColor: '',                   // 留空则用默认配色，例如 '#c8102e'

  /* 节点状态覆盖：键为节点 ID，值为要覆盖的字段
   * status:   built 已建成 | building 建设中 | planned 规划中 | none 未启动 | na 不适用
   * autonomy: full 已全栈适配 | partial 部分适配 | dependent 依赖国外 | na 不涉及
   * 其余可选字段：owner 责任部门 / start 启动时间 / target 目标时间
   *              actualEffort 实际投入人月 / note 备注 */
  overrides: {
    // 'T6013': { status:'built',    owner:'数据管理部', note:'2015 年投产' },
    // 'T7023': { status:'building', owner:'数据管理部', start:'2025-03', target:'2026-12',
    //            note:'一期标签体系已上线，二期实时能力建设中' },
    // 'T8021': { status:'planned',  owner:'人工智能中心', target:'2027-06' }
  },

  /* 本单位特有的自研平台或系统，会作为独立节点加入本单位视图。
   * 字段与 data/nodes.js 中的节点完全一致，deps 可引用基准树的节点 ID。 */
  customNodes: [
    // { id:'X001', name:'XX 自研平台', cap:'C403', era:'E4', deps:['T4015'],
    //   maturity:'mainstream', adoption:'leaders', confidence:'high', autonomy:'full', tags:[],
    //   effort:{manMonth:200,months:12}, value:4, risk:3,
    //   desc:'本行自研的 XX 能力平台。', unlocks:['…'], stack:['…'] }
  ]
});
