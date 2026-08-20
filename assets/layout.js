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
    domain: { w: 220, h: 70 },
    cap:    { w: 204, h: 62 },
    tech:   { w: 182, h: 54 }
  };
  const SUB_GAP = 16;      /* 子列间距 */
  const COL_PAD = 46;      /* 时代列左右留白 */
  const LANE_PAD = 28, ROW_GAP = 14;
  const HEAD_H = 66, LEFT_W = 74;
  const TARGET_ROWS = 10;  /* 单格超过这么多节点才再细分子列 */
  /* 同代依赖深度上限。技术层放宽以换取几乎全部左→右的流向；
   * 聚合层收紧，因为领域视图要「一屏讲给领导」，宽度比流向更重要。 */
  const MAX_DEPTH_TECH = 5, MAX_DEPTH_AGG = 1;

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

  /* ───────────── 矩阵布局（聚合视图专用）─────────────
   * 一个领域 / 能力占一整行，横跨它有技术的所有时代，用一条带连起来；
   * 名称只在左侧冻结列出现一次，格子里只放数量与完成度。
   * 这样就不会出现「同一个领域在图上冒出来好几次」的困惑。 */
  const MX = { cellW: 172, cellH: 46, rowGap: 9, colPad: 22, leftW: 228, labelX: 78 };

  function computeMatrix(units, nodes, h) {
    const m = M(), tx = m.tx;

    const eraUsed = tx.eras.filter(e => units.some(u => u.era === e.id));
    const colIdx = new Map(eraUsed.map((e, i) => [e.id, i]));
    const colW = MX.cellW + MX.colPad * 2;
    const cols = eraUsed.map((e, i) => ({ era: e, i, subs: 1, x: MX.leftW + i * colW, w: colW }));
    const width = MX.leftW + eraUsed.length * colW + 16;

    /* 行的顺序：先按泳道，再按分类体系里的既有顺序 */
    const order = [];
    tx.domains.forEach(d => {
      if (units.some(u => u.base === d.id)) order.push({ base: d.id, kind: 'domain', ref: d, arch: d.arch });
      tx.capabilities.filter(c => c.domain === d.id).forEach(c => {
        if (units.some(u => u.base === c.id)) order.push({ base: c.id, kind: 'cap', ref: c, arch: d.arch });
      });
    });

    const lanes = tx.arch.filter(a => order.some(r => r.arch === a.id))
      .map(a => ({ ...a })).sort((a, b) => a.lane - b.lane);
    const rowH = MX.cellH + MX.rowGap;
    let y = HEAD_H;
    lanes.forEach(l => {
      const rows = order.filter(r => r.arch === l.id);
      l.h = Math.max(rows.length * rowH, rowH) + LANE_PAD * 2;
      l.y = y; y += l.h;
      rows.forEach((r, i) => { r.lane = l.lane; r.y = l.y + LANE_PAD + i * rowH; r.h = MX.cellH; });
    });
    const height = y + 24;

    const placed = units.map(u => {
      const row = order.find(r => r.base === u.base);
      const c = cols[colIdx.get(u.era)];
      const x = c.x + MX.colPad;
      return {
        ...u, kind: u.kind, lane: row.lane, arch: row.arch, row: row.base,
        techs: m.descendants(u.id, nodes, h),
        w: MX.cellW, h: MX.cellH, col: colIdx.get(u.era),
        x, y: row.y, cx: x + MX.cellW / 2, cy: row.y + MX.cellH / 2
      };
    });

    /* 每行的带：从该行最左的格子延伸到最右 */
    order.forEach(r => {
      const mine = placed.filter(p => p.row === r.base);
      r.x0 = Math.min(...mine.map(p => p.x));
      r.x1 = Math.max(...mine.map(p => p.x + p.w));
      r.count = mine.reduce((s, p) => s + p.techs.length, 0);
    });

    return { units: placed, lanes, cols, rows: order, width, height,
             LEFT_W: MX.leftW, LABEL_X: MX.labelX, HEAD_H, matrix: true };
  }

  function compute(units, nodes, h, edges) {
    const m = M(), tx = m.tx;

    /* 全是聚合单元时走矩阵布局；一旦混入技术节点就回到自由 DAG 布局，
     * 因为技术层按行铺会变成一张极高极窄的图，反而看不清。 */
    if (units.length && units.every(u => u.kind !== 'tech')) return computeMatrix(units, nodes, h);

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
    const techRatio = placed.filter(p => p.kind === 'tech').length / Math.max(1, placed.length);
    const maxDepth = techRatio > .6 ? MAX_DEPTH_TECH : MAX_DEPTH_AGG;
    const depth = localDepth(placed, edges, maxDepth);
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

    return { units: placed, lanes, cols, width, height, LEFT_W, HEAD_H, matrix: false };
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
