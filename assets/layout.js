/* ==========================================================================
 * 金融科技树 · 布局层
 * 确定性网格布局：X 轴 = 时代，Y 轴 = 5A 架构泳道。
 * 不使用力导向图 —— 银行科技树需要稳定可预期的版面，每次打开位置一致。
 * 拥挤的时代列会自动分裂为多个子列，避免图形被拉得过高。
 * ========================================================================== */
var TT = (globalThis.TT = globalThis.TT || {});

TT.layout = (function () {
  const M = () => TT.model;

  const SIZE = {
    domain: { w: 208, h: 66 },
    cap:    { w: 198, h: 62 },
    tech:   { w: 182, h: 54 }
  };
  const SUB_GAP = 16;      /* 子列间距 */
  const COL_PAD = 46;      /* 时代列左右留白 */
  const LANE_PAD = 28, ROW_GAP = 14;
  const HEAD_H = 66, LEFT_W = 74;
  const TARGET_ROWS = 10;  /* 单格超过这么多节点才再细分子列 */
  /* 同代依赖深度不设业务上限 —— 有先后关系的节点绝不能画成垂直线，
   * 画布该多宽就多宽。20 只是防御异常数据的死循环保险丝。
   * 「紧凑模式」下才收紧到 1，用于必须一屏投影的场合。 */
  const MAX_DEPTH_FULL = 20, MAX_DEPTH_COMPACT = 1;

  /* 同一时代列内部的依赖深度 —— 让「手机银行 → 智能柜台」这类同代依赖
   * 也能左→右流动，而不是画成难看的回环。
   *
   * 技术层的依赖图是严格 DAG，可以直接排。但聚合视图（领域 / 能力）的
   * 单元级边会成环：领域 A 的某些技术依赖领域 B，同时 B 的另一些技术又
   * 依赖 A。所以先做一次贪心破环（按边权从大到小保留，成环就丢弃），
   * 在保留下来的无环子集上再算深度——保证主干依赖方向一致，
   * 少数被丢弃的弱边仍会画成回环，这是无法同时满足的部分。 */
  function localDepth(placed, edges, MAXD) {
    const col = new Map(placed.map(p => [p.id, p.col]));
    const intra = (edges || [])
      .filter(e => col.has(e.from) && col.has(e.to) && col.get(e.from) === col.get(e.to))
      .sort((x, y) => (y.weight || 1) - (x.weight || 1));

    /* 贪心破环：加入前先看反向是否已可达 */
    const adj = new Map();
    const reaches = (from, target) => {
      const seen = new Set(), st = [from];
      while (st.length) {
        const c = st.pop();
        if (c === target) return true;
        for (const n of (adj.get(c) || [])) if (!seen.has(n)) { seen.add(n); st.push(n); }
      }
      return false;
    };
    const kept = [];
    intra.forEach(e => {
      if (e.from === e.to || reaches(e.to, e.from)) return;   /* 会成环，丢弃 */
      if (!adj.has(e.from)) adj.set(e.from, []);
      adj.get(e.from).push(e.to);
      kept.push(e);
    });

    const depth = new Map(placed.map(p => [p.id, 0]));
    for (let i = 0; i <= MAXD && kept.length; i++) {
      let changed = false;
      kept.forEach(e => {
        const d = Math.min(depth.get(e.from) + 1, MAXD);
        if (depth.get(e.to) < d) { depth.set(e.to, d); changed = true; }
      });
      if (!changed) break;
    }
    return depth;
  }

  function compute(units, nodes, h, edges, opts) {
    opts = opts || {};
    const m = M(), tx = m.tx;

    /* --- 归位：每个单元的时代列与泳道 --- */
    const placed = units.map(u => {
      let col, arch, techs;
      if (u.kind === 'tech') {
        techs = [u.ref];
        arch = u.ref._arch;
      } else {
        techs = m.descendants(u.id, nodes, h);
        arch = u.kind === 'domain' ? u.ref.arch : m.archOfCap(u.base);
      }
      col = m.eraIdx.get(u.era);   /* 聚合单元也有确切的时代，不再取中位数 */
      const lane = tx.arch.find(a => a.id === arch)?.lane ?? 0;
      return { ...u, col, lane, arch, techs, ...SIZE[u.kind] };
    });

    /* --- 只保留真正有节点的时代列 ---
     * 聚合视图中很多早期时代不会成为任何单元的重心，
     * 保留空列会让整张图被挤到右半边。 */
    const used = tx.eras.map((_, ci) => placed.some(p => p.col === ci));
    const colOf = new Map();
    tx.eras.forEach((_, ci) => { if (used[ci]) colOf.set(ci, colOf.size); });
    placed.forEach(p => { p.col = colOf.get(p.col); });
    const eraList = tx.eras.filter((_, ci) => used[ci]);

    /* --- 同代依赖深度 → 子列序号 --- */
    const depth = localDepth(placed, edges, opts.compact ? MAX_DEPTH_COMPACT : MAX_DEPTH_FULL);
    placed.forEach(p => { p.depth = depth.get(p.id) || 0; });

    /* --- 子列规划：先按依赖深度分级，再按拥挤度在级内细分 --- */
    const plan = eraList.map((_, ci) => {
      const inCol = placed.filter(p => p.col === ci);
      const maxD = Math.max(0, ...inCol.map(p => p.depth));
      const levels = [];
      let offset = 0;
      for (let d = 0; d <= maxD; d++) {
        let worst = 0;
        tx.arch.forEach(a => {
          worst = Math.max(worst, inCol.filter(p => p.depth === d && p.lane === a.lane).length);
        });
        const width = Math.max(1, Math.ceil(worst / TARGET_ROWS));
        levels.push({ depth: d, offset, width });
        offset += width;
      }
      return { levels, subs: Math.max(1, offset) };
    });

    /* --- 列宽与列起点 --- */
    const nodeW = Math.max(...placed.map(p => p.w), SIZE.tech.w);
    const cols = eraList.map((e, i) => ({
      era: e, i, subs: plan[i].subs,
      w: plan[i].subs * nodeW + (plan[i].subs - 1) * SUB_GAP + COL_PAD * 2
    }));
    let cx = LEFT_W;
    cols.forEach(c => { c.x = cx; cx += c.w; });
    const width = cx + 20;

    /* --- 分格到（泳道, 时代列, 深度级） --- */
    const cells = new Map();
    placed.forEach(p => {
      p._lv = plan[p.col].levels.find(l => l.depth === p.depth) || { offset: 0, width: 1 };
      const k = p.lane + ':' + p.col + ':' + p._lv.offset;
      if (!cells.has(k)) cells.set(k, []);
      cells.get(k).push(p);
    });
    cells.forEach(list => list.sort((a, b) => {
      const key = x => (x.kind === 'tech' ? x.ref._domain + x.cap : x.kind === 'cap' ? x.ref.domain + x.id : x.id);
      return key(a) === key(b) ? String(a.id).localeCompare(String(b.id)) : key(a).localeCompare(key(b));
    }));

    /* --- 泳道高度：取该泳道中最高的一摞 --- */
    const laneNeed = new Map();
    cells.forEach((list, k) => {
      const lane = +k.split(':')[0];
      const rows = Math.ceil(list.length / list[0]._lv.width);
      const hh = list.slice(0, rows).reduce((s, p) => s + p.h + ROW_GAP, 0) - ROW_GAP;
      laneNeed.set(lane, Math.max(laneNeed.get(lane) || 0, hh));
    });

    /* 只保留有节点的泳道 —— 按架构线筛选时，空泳道不该占版面 */
    const lanes = tx.arch.filter(a => placed.some(p => p.lane === a.lane))
      .map(a => ({ ...a })).sort((a, b) => a.lane - b.lane);
    let y = HEAD_H;
    lanes.forEach(l => {
      l.h = Math.max(laneNeed.get(l.lane) || 0, 92) + LANE_PAD * 2;
      l.y = y; y += l.h;
    });
    const height = y + 28;

    /* --- 落位 --- */
    cells.forEach(list => {
      const p0 = list[0];
      const L = lanes.find(l => l.lane === p0.lane), C = cols[p0.col];
      const rows = Math.ceil(list.length / p0._lv.width);
      list.forEach((p, idx) => {
        const bucket = Math.floor(idx / rows), row = idx % rows;
        const colItems = list.slice(bucket * rows, bucket * rows + rows);
        const total = colItems.reduce((s, q) => s + q.h + ROW_GAP, 0) - ROW_GAP;
        const top = L.y + (L.h - total) / 2;
        p.sub = p0._lv.offset + bucket;
        p.x = C.x + COL_PAD + p.sub * (nodeW + SUB_GAP) + (nodeW - p.w) / 2;
        p.y = top + colItems.slice(0, row).reduce((s, q) => s + q.h + ROW_GAP, 0);
        p.cx = p.x + p.w / 2;
        p.cy = p.y + p.h / 2;
      });
    });

    return { units: placed, lanes, cols, width, height, LEFT_W, HEAD_H };
  }

  /* 依赖连线：左出右进的三次贝塞尔；逆向或同列时从下方绕行 */
  function edgePath(a, b) {
    const x1 = a.x + a.w, y1 = a.cy, x2 = b.x, y2 = b.cy;
    if (x2 - x1 > 22) {
      const dx = Math.max(36, (x2 - x1) * 0.45);
      return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
    }
    const sx = a.cx, sy = a.y + a.h, ex = b.cx, ey = b.y + b.h;
    const drop = 32 + Math.abs(sy - ey) * .18;
    return `M${sx},${sy} C${sx},${sy + drop} ${ex},${ey + drop} ${ex},${ey}`;
  }

  return { compute, edgePath, SIZE };
})();
