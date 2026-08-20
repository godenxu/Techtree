/* ==========================================================================
 * 金融科技树 · 证据层：中国人民银行「金融科技发展奖」
 * --------------------------------------------------------------------------
 * 用途：为节点的行业成熟度判断提供可核查的客观佐证，替代拍脑袋的普及率数字。
 *
 * ★ 重要说明（务必阅读）
 *   1. 获奖代表该机构在此方向具备一定成熟度；未获奖不代表该机构没有建设。
 *      本工具只把奖项当作加分证据，绝不做「未获奖 = 未建成」的反向推断。
 *   2. 本文件的条目来自公开检索。生成时人民银行官网 (pbc.gov.cn) 被所在
 *      网络环境的出口策略拦截，完整名单 PDF 未能直接获取，因此：
 *        · yearStats 各年度总数与等级分布：多来源交叉印证，可信度较高
 *        · projects 具体项目条目：部分来自检索结果标题片段（verified:'snippet'），
 *          部分来自二手报道的归纳（verified:'summary'），均需与官方 PDF 复核
 *   3. 补全方式见 docs/奖项数据导入指南.md，支持 CSV 批量导入。
 *      官方公示入口：中国人民银行官网 → 金融科技 → 金融科技发展奖公示
 *
 * 字段：year 评奖年度 / level 等级 / org 完成单位 / project 项目名称
 *       mappedNodes 映射到的技术节点 / source 来源 / url 链接
 *       verified 核实程度：official(官方名单) | snippet(检索标题片段) | summary(二手归纳)
 * ========================================================================== */
var TT = (globalThis.TT = globalThis.TT || {});

/* ---- 各年度总体情况（用于奖项热力图的基数与趋势） ---- */
TT.awardStats = [
  { year: 2021, total: null, note: '待补全',
    source: '中国人民银行金融科技发展奖公示' },
  { year: 2022, total: 193, levels: { 一等奖: 16, 二等奖: 70, 三等奖: 107 },
    source: '中国人民银行金融科技发展奖公示（多来源交叉印证）' },
  { year: 2023, total: 257, applied: 621, levels: { 一等奖: 18, 二等奖: 93, 三等奖: 136, 专项奖: 10 },
    note: '专项奖为「微创新奖」；据公开梳理，当年度含「大模型」相关获奖项目约 15 项（一等 1、二等 6、三等 8）',
    source: '中国人民银行 2023 年度金融科技发展奖获奖项目公示',
    url: 'http://www.pbc.gov.cn/rmyh/105208/5481403/index.html' },
  { year: 2024, total: 290, levels: { 特等奖: 1, 一等奖: 18, 二等奖: 103, 三等奖: 148, 专项奖: 20 },
    note: '公示期 2025-10-27 至 2025-11-09；据公开梳理，当年度涉及大模型的获奖项目大幅增加',
    source: '中国人民银行 2024 年度金融科技发展奖获奖项目公示',
    url: 'https://www.pbc.gov.cn/rmyh/105208/5878684/index.html' }
];

/* ---- 具体获奖项目条目 ---- */
TT.awards = [

  /* ===== 2022 年度 ===== */
  { year: 2022, level: '一等奖', org: '中国邮政储蓄银行',
    project: '基于业务建模的大型银行分布式核心系统建设项目',
    mappedNodes: ['T4021', 'T4022', 'T9033', 'T6014'],
    source: '2022 年度金融科技发展奖获奖项目名单', verified: 'snippet',
    url: 'https://www.pbc.gov.cn/' },

  /* ===== 2023 年度 ===== */
  { year: 2023, level: '一等奖', org: '中国建设银行',
    project: '金融行业云建设与应用实践',
    mappedNodes: ['T9022', 'T9023', 'T9024'],
    source: '2023 年度金融科技发展奖获奖项目名单', verified: 'snippet',
    url: 'http://www.pbc.gov.cn/rmyh/105208/5481403/index.html' },

  { year: 2023, level: '一等奖', org: '中国工商银行',
    project: '金融行业千亿级大模型建设和应用项目',
    mappedNodes: ['T8021', 'T8023', 'T10011', 'T10012'],
    note: '据公开报道，该项目建成千卡级算力集群与千亿参数金融大模型',
    source: '公开梳理报道（移动支付网等）', verified: 'summary',
    url: 'https://m.mpaypass.com.cn/news/202410/25145557.html' },

  { year: 2023, level: '一等奖', org: '中国银行',
    project: '适应国际新形势的全球一体化合规管控平台',
    mappedNodes: ['T12021', 'T12024', 'T2024'],
    source: '公开梳理报道', verified: 'summary',
    url: 'http://www.pbc.gov.cn/rmyh/105208/5481403/index.html' },

  { year: 2023, level: '二等奖', org: '中国建设银行',
    project: '金融大模型平台建设与应用',
    mappedNodes: ['T8021', 'T8022'],
    source: '公开梳理报道（移动支付网等）', verified: 'summary',
    url: 'https://m.mpaypass.com.cn/news/202410/25145557.html' },

  { year: 2023, level: '三等奖', org: '中国民生银行',
    project: '大模型安全管理及应用评估能力体系建设',
    mappedNodes: ['T12031', 'T12032'],
    source: '公开梳理报道（移动支付网等）', verified: 'summary',
    url: 'https://m.mpaypass.com.cn/news/202410/25145557.html' },

  { year: 2023, level: '三等奖', org: '华夏银行',
    project: '大模型金融服务平台',
    mappedNodes: ['T8021', 'T8033'],
    source: '公开梳理报道（移动支付网等）', verified: 'summary',
    url: 'https://m.mpaypass.com.cn/news/202410/25145557.html' },

  /* ===== 2024 年度 ===== */
  { year: 2024, level: '特等奖', org: '中钞印制技术研究院等',
    project: '多功能激光雕刻钞券制版系统研制',
    mappedNodes: [],
    note: '印制技术方向，与银行 IT 科技树无直接映射，保留作年度基准参照',
    source: '2024 年度金融科技发展奖获奖项目名单', verified: 'snippet',
    url: 'https://www.pbc.gov.cn/rmyh/105208/5878684/index.html' },

  { year: 2024, level: '一等奖', org: '中国农业银行',
    project: '数智驱动的企业级业务架构建设实践',
    mappedNodes: ['T4031', 'T6021', 'T4015'],
    source: '公开梳理报道', verified: 'summary',
    url: 'https://finance.sina.com.cn/cj/2025-10-27/doc-infvkcqc4873889.shtml' },

  { year: 2024, level: '一等奖', org: '中信银行',
    project: '基于云原生的金融级技术中台体系建设（苍穹工程）',
    mappedNodes: ['T4032', 'T9023', 'T4015'],
    source: '公开梳理报道', verified: 'summary',
    url: 'https://finance.sina.com.cn/cj/2025-10-27/doc-infvkcqc4873889.shtml' },

  { year: 2024, level: '一等奖', org: '中国建设银行',
    project: '主机核心银行系统全面下移工程',
    mappedNodes: ['T4023', 'T4021', 'T10024'],
    source: '公开梳理报道', verified: 'summary',
    url: 'https://finance.sina.com.cn/cj/2025-10-27/doc-infvkcqc4873889.shtml' },

  { year: 2024, level: '一等奖', org: '中国银行',
    project: 'IT 架构全面转型战略工程项目',
    mappedNodes: ['T4015', 'T4021', 'T9022'],
    source: '公开梳理报道', verified: 'summary',
    url: 'https://finance.sina.com.cn/cj/2025-10-27/doc-infvkcqc4873889.shtml' },

  { year: 2024, level: '一等奖', org: '中国人保财险',
    project: '基于可信开放协作体系的航运保险数字化平台',
    mappedNodes: ['T3031', 'T3012'],
    source: '公开梳理报道', verified: 'summary',
    url: 'https://finance.sina.com.cn/cj/2025-10-27/doc-infvkcqc4873889.shtml' }

];
