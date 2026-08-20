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
    domain: { w: 268, h: 92 },
    cap:    { w: 218, h: 66 },
    tech:   { w: 182, h: 54 }
  };
  const SUB_GAP = 16;      /* 子列间距 */
  const COL_PAD = 46;      /* 时代列左右留白 */
  const LANE_PAD = 28, ROW_GAP = 14;
  const HEAD_H = 66, LEFT_W = 74;
  const TARGET_ROWS = 7;   /* 单个格子内超过这么多节点就分裂子列 */

  function medianEra(techs) {
    if (!techs.length) return 0;
    const idx = techs.map(t => M().eraIdx.get(t.era)).sort((a, b) => a - b);
    return idx[Math.floor(idx.length / 2)];
  }

  function compute(units, nodes, h) {
    const m = M(), tx = m.tx;

    /* --- 归位：每个单元的时代列与泳道 --- */
    const placed = units.map(u => {
      let col, arch, techs;
      if (u.kind === 'tech') {
        techs = [u.ref];
        col = m.eraIdx.get(u.ref.era);
        arch = u.ref._arch;
      } else {
        techs = m.descendants(u.id, nodes, h);
        col = medianEra(techs);
        arch = u.kind === 'domain' ? u.ref.arch : m.archOfCap(u.id);
      }
      const lane = tx.arch.find(a => a.id === arch)?.lane ?? 0;
      return { ...u, col, lane, arch, techs, ...SIZE[u.kind] };
    });

    /* --- 分格 --- */
    const cells = new Map();
    placed.forEach(p => {
      const k = p.lane + ':' + p.col;
      if (!cells.has(k)) cells.set(k, []);
      cells.get(k).push(p);
    });
    /* 同格内按领域聚拢，保证顺序稳定、同域节点相邻 */
    cells.forEach(list => list.sort((a, b) => {
      const key = x => (x.kind === 'tech' ? x.ref._domain + x.cap : x.kind === 'cap' ? x.ref.domain + x.id : x.id);
      return key(a) === key(b) ? String(a.id).localeCompare(String(b.id)) : key(a).localeCompare(key(b));
    }));

    /* --- 只保留真正有节点的时代列 ---
     * 聚合视图（领域 / 能力）中，很多早期时代不会成为任何单元的重心，
     * 保留空列会让整张图被挤到右半边。                            */
    const used = tx.eras.map((_, ci) => [...cells.keys()].some(k => +k.split(':')[1] === ci));
    const colOf = new Map();
    tx.eras.forEach((_, ci) => { if (used[ci]) colOf.set(ci, colOf.size); });
    placed.forEach(p => { p.colRaw = p.col; p.col = colOf.get(p.col); });
    const cells2 = new Map();
    cells.forEach((list, k) => {
      const [lane, ci] = k.split(':').map(Number);
      cells2.set(lane + ':' + colOf.get(ci), list);
    });
    cells.clear(); cells2.forEach((v, k) => cells.set(k, v));

    /* --- 每个时代列需要几个子列 --- */
    const eraList = tx.eras.filter((_, ci) => used[ci]);
    const subCount = eraList.map((_, ci) => {
      let maxStack = 0;
      cells.forEach((list, k) => { if (+k.split(':')[1] === ci) maxStack = Math.max(maxStack, list.length); });
      return Math.max(1, Math.ceil(maxStack / TARGET_ROWS));
    });

    /* --- 列宽与列起点 --- */
    const nodeW = Math.max(...placed.map(p => p.w), SIZE.tech.w);
    const cols = eraList.map((e, i) => ({
      era: e, i, subs: subCount[i],
      w: subCount[i] * nodeW + (subCount[i] - 1) * SUB_GAP + COL_PAD * 2
    }));
    let cx = LEFT_W;
    cols.forEach(c => { c.x = cx; cx += c.w; });
    const width = cx + 20;

    /* --- 泳道高度：取该泳道中最拥挤格子分列后的行数 --- */
    const laneNeed = new Map();
    cells.forEach((list, k) => {
      const [lane, ci] = k.split(':').map(Number);
      const rows = Math.ceil(list.length / cols[ci].subs);
      const hh = list.slice(0, rows).reduce((s, p) => s + p.h + ROW_GAP, 0) - ROW_GAP;
      laneNeed.set(lane, Math.max(laneNeed.get(lane) || 0, hh));
    });

    const lanes = tx.arch.map(a => ({ ...a })).sort((a, b) => a.lane - b.lane);
    let y = HEAD_H;
    lanes.forEach(l => {
      l.h = Math.max(laneNeed.get(l.lane) || 0, 92) + LANE_PAD * 2;
      l.y = y; y += l.h;
    });
    const height = y + 28;

    /* --- 落位：格子内按「先填满一列再换下一列」排布 --- */
    cells.forEach((list, k) => {
      const [lane, ci] = k.split(':').map(Number);
      const L = lanes.find(l => l.lane === lane), C = cols[ci];
      const rows = Math.ceil(list.length / C.subs);
      list.forEach((p, idx) => {
        const sub = Math.floor(idx / rows), row = idx % rows;
        const colItems = list.slice(sub * rows, sub * rows + rows);
        const total = colItems.reduce((s, q) => s + q.h + ROW_GAP, 0) - ROW_GAP;
        const top = L.y + (L.h - total) / 2;
        p.x = C.x + COL_PAD + sub * (nodeW + SUB_GAP) + (nodeW - p.w) / 2;
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
