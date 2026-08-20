/* ==========================================================================
 * 金融科技树 · 分类体系定义 (taxonomy)
 * --------------------------------------------------------------------------
 * 本文件定义科技树的"坐标系"：时代、5A 架构分层、L0 领域、L1 能力、
 * 状态枚举、成熟度枚举、专题标签。
 * 一般情况下不需要修改本文件；新增技术节点请改 data/nodes.js。
 * ========================================================================== */
var TT = (globalThis.TT = globalThis.TT || {});

TT.taxonomy = {

  /* ---------------- 时代：图的横轴，从左到右 ---------------- */
  eras: [
    { id: 'E1', roman: 'Ⅰ', name: '电子化时代',   period: '~2000 前',   theme: '账务电子化，主机集中处理' },
    { id: 'E2', roman: 'Ⅱ', name: '网络化时代',   period: '2000–2010',  theme: '联机互通，电子渠道诞生' },
    { id: 'E3', roman: 'Ⅲ', name: '数据化时代',   period: '2010–2016',  theme: '数据资产化，决策依赖分析' },
    { id: 'E4', roman: 'Ⅳ', name: '平台化时代',   period: '2016–2023',  theme: '云原生 + 分布式 + 中台' },
    { id: 'E5', roman: 'Ⅴ', name: '智能化时代',   period: '2023–2028',  theme: 'AI 原生，实时决策' },
    { id: 'E6', roman: 'Ⅵ', name: '自主进化时代', period: '2028+',      theme: '智能体驱动，自适应银行' }
  ],

  /* ---------------- 5A 企业级架构：图的纵轴泳道 ----------------
   * A5 安全架构是横切关注点，用贯穿带渲染而非并列泳道。          */
  arch: [
    { id: 'A1', code: 'A1', name: '业务架构', en: 'Business',    lane: 0, band: false, hue: 38,  desc: '价值出口，所有技术投入的兑现处' },
    { id: 'A2', code: 'A2', name: '应用架构', en: 'Application', lane: 1, band: false, hue: 150, desc: '能力的组织形态' },
    { id: 'A3', code: 'A3', name: '数据架构', en: 'Data',        lane: 2, band: false, hue: 275, desc: '能力的燃料' },
    { id: 'A4', code: 'A4', name: '技术架构', en: 'Technology',  lane: 3, band: false, hue: 195, desc: '物理地基' },
    { id: 'A5', code: 'A5', name: '安全架构', en: 'Security',    lane: 4, band: true,  hue: 5,   desc: '横切约束，压在其余四层上的合规闸门' }
  ],

  /* ---------------- L0 领域层：给行领导看的 12 个大节点 ----------------
   * spanArch 非空时，该领域在领域视图中渲染为跨泳道宽卡片。        */
  domains: [
    { id: 'D01', name: '渠道与客户触达',   arch: 'A1', icon: '◈' },
    { id: 'D02', name: '产品与交易能力',   arch: 'A1', icon: '◆' },
    { id: 'D03', name: '生态与开放银行',   arch: 'A1', icon: '◇' },
    { id: 'D04', name: '核心系统与应用架构', arch: 'A2', icon: '▣' },
    { id: 'D05', name: '研发效能与交付',   arch: 'A2', icon: '▤' },
    { id: 'D06', name: '数据基础与治理',   arch: 'A3', icon: '▦' },
    { id: 'D07', name: '数据应用与客户洞察', arch: 'A3', icon: '▩' },
    { id: 'D08', name: '人工智能与大模型', arch: 'A3', icon: '✦',
      spanArch: ['A1','A2','A3','A4','A5'],
      note: 'AI 横跨全部 5A：算力在技术架构、平台在数据架构、智能体在应用架构、AI 服务在业务架构、模型风险在安全架构。因此在领域视图中渲染为跨泳道宽卡片，并可通过「AI 视图」抽取为独立专题树。' },
    { id: 'D09', name: '基础设施与云',     arch: 'A4', icon: '▥' },
    { id: 'D10', name: '算力与自主可控',   arch: 'A4', icon: '▧' },
    { id: 'D11', name: '网络与数据安全',   arch: 'A5', icon: '⬢' },
    { id: 'D12', name: '智能风控与合规',   arch: 'A5', icon: '⬣' }
  ],

  /* ---------------- L1 能力层：给科技条线领导看的 35 个能力 ---------------- */
  capabilities: [
    { id: 'C101', domain: 'D01', name: '物理渠道' },
    { id: 'C102', domain: 'D01', name: '电子与移动渠道' },
    { id: 'C103', domain: 'D01', name: '远程与全渠道协同' },

    { id: 'C201', domain: 'D02', name: '核心账务与产品' },
    { id: 'C202', domain: 'D02', name: '支付清算' },
    { id: 'C203', domain: 'D02', name: '信贷与财富产品' },

    { id: 'C301', domain: 'D03', name: '开放银行与 API 生态' },
    { id: 'C302', domain: 'D03', name: '场景金融与嵌入式金融' },
    { id: 'C303', domain: 'D03', name: '数字货币与分布式账本' },

    { id: 'C401', domain: 'D04', name: '应用架构演进' },
    { id: 'C402', domain: 'D04', name: '分布式核心' },
    { id: 'C403', domain: 'D04', name: '中台与平台工程' },

    { id: 'C501', domain: 'D05', name: '研发协同与持续交付' },
    { id: 'C502', domain: 'D05', name: '测试与质量保障' },
    { id: 'C503', domain: 'D05', name: '运维与可观测性' },

    { id: 'C601', domain: 'D06', name: '数据平台与湖仓' },
    { id: 'C602', domain: 'D06', name: '数据治理与主数据' },
    { id: 'C603', domain: 'D06', name: '实时数据与流计算' },

    { id: 'C701', domain: 'D07', name: '分析与决策支持' },
    { id: 'C702', domain: 'D07', name: '客户数据与标签' },
    { id: 'C703', domain: 'D07', name: '数据服务与资产运营' },

    { id: 'C801', domain: 'D08', name: '机器学习与 MLOps' },
    { id: 'C802', domain: 'D08', name: '大模型平台与知识工程' },
    { id: 'C803', domain: 'D08', name: '智能体与 AI 原生应用' },

    { id: 'C901', domain: 'D09', name: '数据中心与网络' },
    { id: 'C902', domain: 'D09', name: '云平台与容器' },
    { id: 'C903', domain: 'D09', name: '高可用与多活' },

    { id: 'C1001', domain: 'D10', name: '智能算力' },
    { id: 'C1002', domain: 'D10', name: '信创与自主可控' },

    { id: 'C1101', domain: 'D11', name: '基础安全与身份' },
    { id: 'C1102', domain: 'D11', name: '数据安全与隐私计算' },
    { id: 'C1103', domain: 'D11', name: '安全运营与前沿密码' },

    { id: 'C1201', domain: 'D12', name: '风控与反欺诈' },
    { id: 'C1202', domain: 'D12', name: '合规与监管科技' },
    { id: 'C1203', domain: 'D12', name: 'AI 治理与模型风险' }
  ],

  /* ---------------- 单位视图下的建设状态 ---------------- */
  status: [
    { id: 'built',     name: '已建成',   weight: 1.0,  color: '#4ade80' },
    { id: 'building',  name: '建设中',   weight: 0.5,  color: '#fbbf24' },
    { id: 'planned',   name: '规划中',   weight: 0.15, color: '#60a5fa' },
    { id: 'none',      name: '未启动',   weight: 0.0,  color: '#64748b' },
    { id: 'na',        name: '不适用',   weight: null, color: '#475569' },
    { id: 'unknown',   name: '未评估',   weight: null, color: '#3f4a5e' }
  ],

  /* ---------------- 基准视图下的技术成熟度 ---------------- */
  maturity: [
    { id: 'mature',    name: '成熟期',     order: 5, color: '#4ade80', desc: '行业标准配置，方案与人才供给充分' },
    { id: 'mainstream',name: '主流期',     order: 4, color: '#22d3ee', desc: '主流机构已规模化应用' },
    { id: 'early',     name: '早期采用',   order: 3, color: '#818cf8', desc: '领先机构已投产，方案仍在收敛' },
    { id: 'emerging',  name: '萌芽期',     order: 2, color: '#c084fc', desc: '少量试点，标准与生态未定型' },
    { id: 'experimental', name: '实验期',  order: 1, color: '#f472b6', desc: '研究与概念验证阶段' }
  ],

  /* ---------------- 行业普及度分档（刻意不使用百分比，见 docs/设计说明.md） ---------------- */
  adoption: [
    { id: 'universal', name: '普遍具备',       order: 5 },
    { id: 'majority',  name: '多数在建或已建', order: 4 },
    { id: 'leaders',   name: '领先机构具备',   order: 3 },
    { id: 'pilot',     name: '个别试点',       order: 2 },
    { id: 'none',      name: '尚无规模落地',   order: 1 }
  ],

  /* ---------------- 判断置信度：低置信度字段在界面上标灰并提示"待核实" ---------------- */
  confidence: [
    { id: 'high',   name: '高', desc: '有公开证据或属行业共识' },
    { id: 'medium', name: '中', desc: '基于通用行业认知，部分可佐证' },
    { id: 'low',    name: '低', desc: '主要为推断，未经核实' }
  ],

  /* ---------------- 自主可控（信创）适配度 ---------------- */
  autonomy: [
    { id: 'full',      name: '已全栈适配', color: '#4ade80' },
    { id: 'partial',   name: '部分适配',   color: '#fbbf24' },
    { id: 'dependent', name: '依赖国外',   color: '#f87171' },
    { id: 'na',        name: '不涉及',     color: '#64748b' }
  ],

  /* ---------------- 专题标签：与 5A 结构维度正交，用于抽取专题视图 ----------------
   * 结构维度只能有一个（5A），标签维度可以有任意多个。            */
  tags: [
    { id: 'ai',        name: 'AI 视图',       color: '#c084fc', desc: '人工智能相关节点，抽取后形成独立的 AI 技术树' },
    { id: 'xinchuang', name: '信创视图',      color: '#fbbf24', desc: '自主可控替代相关节点' },
    { id: 'risk',      name: '风控视图',      color: '#f87171', desc: '风险与反欺诈相关节点' },
    { id: 'open',      name: '开放银行视图',  color: '#4ade80', desc: '开放银行与生态相关节点' },
    { id: 'realtime',  name: '实时化视图',    color: '#22d3ee', desc: '实时数据与实时决策相关节点' }
  ]
};
