/* ==========================================================================
 * 金融科技树 · 主程序：状态、渲染循环、交互
 * ========================================================================== */
(function () {
  const $ = s => document.querySelector(s);
  const M = () => TT.model;

  /* ---------------- 全局状态 ---------------- */
  const S = {
    orgId: 'benchmark',
    compareWith: 'benchmark',
    level: 'domain',
    expanded: new Set(),
    theme: 'A',
    colorMode: 'maturity',
    tagFilter: '',
    archFilter: new Set(),
    eraFilter: new Set(),
    legendOff: false,
    compact: false,
    search: '',
    selected: null,
    hover: null,
    planMode: false,
    planTargets: new Set(),
    maintain: false,
    presenting: false,
    presentEra: 0,
    view: { k: 1, x: 0, y: 0 },
    nodes: [], byId: new Map(), h: null, units: [], edges: [], L: null,
    gapMap: new Map(), lockedEdges: new Set()
  };
  TT.S = S;

  /* ---------------- 启动：动态加载单位档案 ---------------- */
  function loadOrgFiles(cb) {
    const reg = TT.orgRegistry || [];
    /* 单文件打包版里档案已经内联好了，这里会直接跳过 */
    const have = new Set((TT.orgs || []).map(o => o.orgId));
    const todo = reg.filter(o => !have.has(o.id));
    let left = todo.length;
    if (!left) return cb();
    todo.forEach(o => {
      const s = document.createElement('script');
      s.src = o.file;
      s.onload = s.onerror = () => { if (--left === 0) cb(); };
      document.head.appendChild(s);
    });
  }

  /* ---------------- 过滤与可见性 ---------------- */
  function techVisible(n) {
    if (S.tagFilter && !(n.tags || []).includes(S.tagFilter)) return false;
    return true;
  }

  /* 专题视图下把被隐藏的节点"穿透"掉：A→(隐藏)→B 收缩为 A→B，依赖链不断裂 */
  function contractedPairs() {
    const pairs = [];
    const visible = new Set(S.nodes.filter(techVisible).map(n => n.id));
    const memo = new Map();
    function nearest(id, seen) {
      if (visible.has(id)) return [id];
      if (memo.has(id)) return memo.get(id);
      if (seen.has(id)) return [];
      seen.add(id);
      const n = S.byId.get(id);
      const out = [];
      (n?.deps || []).forEach(d => nearest(d, seen).forEach(x => { if (!out.includes(x)) out.push(x); }));
      memo.set(id, out);
      return out;
    }
    S.nodes.forEach(n => {
      if (!visible.has(n.id)) return;
      (n.deps || []).forEach(d => nearest(d, new Set()).forEach(src => {
        if (src !== n.id) pairs.push([src, n.id]);
      }));
    });
    return pairs;
  }

  /* ---------------- 重建：数据 → 单元 → 边 → 布局 → 渲染 ---------------- */
  function rebuild() {
    const m = M();
    S.nodes = m.resolve(S.orgId);
    S.byId = new Map(S.nodes.map(n => [n.id, n]));
    S.h = m.hierarchy(S.nodes);

    /* 差距着色所需的对照 */
    if (S.colorMode === 'gap') {
      const res = S.orgId === 'benchmark'
        ? []
        : (S.compareWith === 'benchmark'
            ? m.gapVsBenchmark(S.nodes)
            : m.compare(S.nodes, m.resolve(S.compareWith)));
      S.gapMap = new Map(res.map(r => [r.id, r.verdict]));
    }

    /* 可见单元 */
    let units = m.visibleUnits(S.nodes, S.expanded, S.h);
    if (S.eraFilter.size) units = units.filter(u => S.eraFilter.has(u.era));
    if (S.archFilter.size) {
      units = units.filter(u => {
        const arch = u.kind === 'tech' ? u.ref._arch
          : (u.kind === 'domain' ? u.ref.arch : m.archOfCap(u.base));
        return S.archFilter.has(arch);
      });
    }
    if (S.tagFilter) {
      units = units.filter(u => {
        if (u.kind === 'tech') return techVisible(u.ref);
        return m.descendants(u.id, S.nodes, S.h).some(techVisible);
      });
    }

    /* 边聚合（含专题穿透） */
    const visibleUnitIds = new Set(units.map(u => u.id));
    const carrier = id => {
      const n = S.byId.get(id); if (!n) return null;
      const cand = m.carrierOf(n, S.expanded);
      return visibleUnitIds.has(cand) ? cand : null;
    };
    const pairs = S.tagFilter ? contractedPairs()
      : S.nodes.flatMap(n => (n.deps || []).filter(d => S.byId.has(d)).map(d => [d, n.id]));
    const emap = new Map();
    pairs.forEach(([d, nid]) => {
      const A = carrier(d), B = carrier(nid);
      if (!A || !B || A === B) return;
      const key = A + '>' + B;
      const e = emap.get(key) || { from: A, to: B, weight: 0, gate: false, pairs: [] };
      e.weight++; e.pairs.push([d, nid]);
      if (S.byId.get(d)._arch === 'A5' && S.byId.get(nid)._arch !== 'A5') e.gate = true;
      emap.set(key, e);
    });
    S.edges = [...emap.values()];
    /* 聚合层会出现「两个领域在同一时代互为前置」的双向依赖 ——
     * 这是真实业务事实（微服务 ⇄ DevOps、数据平台 ⇄ 云平台），
     * 无论怎么排都有一条方向是反的，所以显式标出来而不是藏起来。 */
    const has = new Set(S.edges.map(e => e.from + '>' + e.to));
    S.edges.forEach(e => {
      if (has.has(e.to + '>' + e.from)) {
        e.bidir = true;
        e.primary = e.from < e.to;      /* 一对里只画一条，另一条跳过 */
      }
    });

    /* 未打通的依赖（前置未建成）画成暗色虚线 */
    S.lockedEdges = new Set();
    if (S.orgId !== 'benchmark') {
      S.edges.forEach(e => {
        const allBuilt = e.pairs.every(([d]) => S.byId.get(d)?._status === 'built');
        if (!allBuilt) S.lockedEdges.add(e.from + '>' + e.to);
      });
    }

    /* 聚合格的标题用里程碑名，先算好挂到单元上 */
    units.forEach(u => { if (u.kind !== 'tech') u._milestone = m.milestoneOf(u.id, S.nodes, S.h); });

    S.L = TT.layout.compute(units, S.nodes, S.h, S.edges, { compact: S.compact });
    S.units = S.L.units;

    /* 排完位再回头看：还有哪些边被画成了反向。
     * 双向对已经单独标过；剩下的是多点环路里被迫牺牲的那一条（领域层通常 1 条）。
     * 一律改画成弧线并保留箭头方向，不让它伪装成一条普通的依赖线。 */
    const posMap = new Map(S.units.map(u => [u.id, u]));
    S.edges.forEach(e => {
      if (e.bidir) return;
      const a = posMap.get(e.from), b = posMap.get(e.to);
      e.reverse = !!(a && b && b.x <= a.x + a.w - 1);
    });

    /* 渲染前先把即将消失的格子克隆成幽灵，渲染后让它们收回父格 */
    const prev = S.prevPos || new Map();
    const keep = new Set(S.units.map(u => u.id));
    const ghosts = [];
    if (!S.noAnim) {
      $('#canvas').querySelectorAll('.node').forEach(g => {
        const id = g.dataset.id;
        if (keep.has(id) || !prev.has(id)) return;
        ghosts.push({ id, el: g.cloneNode(true), pos: prev.get(id) });
      });
    }
    TT.render.draw($('#canvas'), S.L, S);
    animateTransition(prev, ghosts);
    S.prevPos = new Map(S.units.map(u => [u.id, { x: u.x, y: u.y, cx: u.cx, cy: u.cy }]));
    applyTransform();
    paintBreadcrumb();
    paintLegend();
    applyHighlight();
    if (S.planMode) markPlanTargets();
  }
  TT.rebuild = rebuild;

  /* 展开 / 收拢的过渡动画。
   * 关键不是「出现和消失」，而是让人看清 **一个格子变成了三个**：
   * 新出现的子格从父格的旧位置放大出来，收拢时子格反向收回父格的新位置。 */
  function ancestorsOf(unitId) {
    const m = M(), { base, era } = m.splitUnitId(unitId);
    const out = [];
    const n = S.byId.get(base);
    if (n) { out.push(n.cap + '@' + n.era, n._domain + '@' + n.era); return out; }
    const cap = m.capById.get(base);
    if (cap && era) out.push(cap.domain + '@' + era);
    return out;
  }
  /* 收拢时，一个即将消失的格子会被谁接管 */
  function successorOf(unitId, newIds) {
    const m = M(), { base, era } = m.splitUnitId(unitId);
    const n = S.byId.get(base);
    const cands = n ? [n.cap + '@' + n.era, n._domain + '@' + n.era]
      : (m.capById.get(base) && era ? [m.capById.get(base).domain + '@' + era] : []);
    return cands.find(c => newIds.has(c)) || null;
  }

  function animateTransition(prevPos, ghosts) {
    if (S.noAnim) return;
    const svg = $('#canvas');
    const vp = svg.querySelector('.viewport') || svg;
    const newIds = new Set(S.units.map(u => u.id));
    const EASE = 'transform .46s cubic-bezier(.22,.9,.3,1), opacity .38s ease';

    /* ① 留下来的格子：FLIP 平移；② 新出现的格子：从父格旧位置放大出来 */
    svg.querySelectorAll('.node').forEach(g => {
      const id = g.dataset.id;
      const now = S.units.find(u => u.id === id); if (!now) return;
      const old = prevPos.get(id);
      if (old) {
        const dx = old.x - now.x, dy = old.y - now.y;
        if (Math.abs(dx) < .5 && Math.abs(dy) < .5) return;
        g.style.transition = 'none';
        g.style.transform = `translate(${dx}px,${dy}px)`;
      } else {
        const from = ancestorsOf(id).map(a => prevPos.get(a)).find(Boolean);
        g.style.transition = 'none';
        g.style.transformOrigin = `${now.cx}px ${now.cy}px`;
        if (from) {
          g.style.transform =
            `translate(${from.cx - now.cx}px,${from.cy - now.cy}px) scale(.42)`;
          g.style.opacity = '.15';
        } else {
          g.style.transform = 'scale(.82)';
          g.style.opacity = '0';
        }
      }
    });

    /* ③ 消失的格子：做成幽灵，收回接管它的父格，让「三变一」看得见 */
    if (ghosts.length) {
      const layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      layer.setAttribute('class', 'ghosts');
      ghosts.forEach(({ id, el, pos }) => {
        const to = successorOf(id, newIds);
        const t = to && S.units.find(u => u.id === to);
        el.style.transformOrigin = `${pos.cx}px ${pos.cy}px`;
        el.style.transition = EASE;
        el.style.pointerEvents = 'none';
        layer.appendChild(el);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          el.style.transform = t
            ? `translate(${t.cx - pos.cx}px,${t.cy - pos.cy}px) scale(.42)`
            : 'scale(.7)';
          el.style.opacity = '0';
        }));
      });
      vp.appendChild(layer);
      setTimeout(() => layer.remove(), 500);
    }

    requestAnimationFrame(() => requestAnimationFrame(() => {
      svg.querySelectorAll('.node').forEach(g => {
        g.style.transition = EASE;
        g.style.transform = 'translate(0,0)';
        g.style.opacity = '';
      });
    }));
  }

  /* ---------------- 视图变换 ---------------- */
  /* 冻结表头：时代标签横向跟随、架构标签纵向跟随，字号不随缩放变化。
   * 用 DOM 覆盖层而不是 SVG 内的元素，这样文字任何缩放下都清晰。 */
  function paintSticky() {
    if (!S.L) return;
    const k = S.view.k, W = $('#stage').clientWidth, H = $('#stage').clientHeight;
    const eraBox = $('#eraBar'), laneBox = $('#laneBar');

    /* 时代标签有两种排布：
     *   无筛选 —— 跟着时代列走，标签就是列头
     *   有筛选 —— 布局里只剩被选中的那一列，其余时代没有列可依附，
     *             所以整条改成居中的步进器：当前高亮，相邻半透明可点，
     *             一眼看到"上一个 / 下一个去哪"，也就不用在画布里另做导航按钮。 */
    const eras = M().tx.eras;
    const filtering = S.eraFilter.size === 1;
    const curIdx = filtering ? eras.findIndex(e => S.eraFilter.has(e.id)) : -1;

    const chip = (era, left, cls, tip) => {
      const hue = era.hue ?? 210;
      const col = S.theme === 'B' ? `hsl(${hue},55%,42%)` : `hsl(${hue},72%,64%)`;
      return `<div class="era-chip ${cls}" data-era="${era.id}" style="left:${left}px" title="${tip}">
        <div class="rm" style="color:${col}">${era.roman}</div>
        <div class="nm">${era.name}</div>
        <div class="pd">${era.period}</div>
        <div class="ul" style="background:${col}"></div>
      </div>`;
    };

    if (filtering) {
      const step = Math.min(190, (W - 160) / eras.length);
      const x0 = W / 2 - (eras.length - 1) * step / 2;
      eraBox.innerHTML = eras.map((e, i) => {
        const d = i - curIdx;
        const cls = d === 0 ? 'on' : (Math.abs(d) === 1 ? 'adjacent ' + (d < 0 ? 'prev' : 'next') : 'dim');
        const tip = d === 0 ? '取消只看 ' + e.name
          : (Math.abs(d) === 1 ? (d < 0 ? '上一个时代：' : '下一个时代：') + e.name : '切换到 ' + e.name);
        return chip(e, x0 + i * step, cls, tip);
      }).join('');
    } else {
      eraBox.innerHTML = S.L.cols.map(c => {
        const x0 = c.x * k + S.view.x, x1 = (c.x + c.w) * k + S.view.x;
        if (x1 < 46 || x0 > W) return '';
        const cx = Math.min(Math.max((x0 + x1) / 2, Math.max(x0, 64) + 46), Math.min(x1, W) - 46);
        return chip(c.era, cx, '', '只看 ' + c.era.name);
      }).join('');
    }

    /* 单选语义：点未选中的时代 = 直接切换过去；点已选中的 = 取消筛选 */
    eraBox.querySelectorAll('.era-chip').forEach(c => c.onclick = () => {
      const e = c.dataset.era;
      S.eraFilter = (S.eraFilter.size === 1 && S.eraFilter.has(e)) ? new Set() : new Set([e]);
      rebuild(); fit();
    });

    const m = M(), benchmark = S.orgId === 'benchmark';
    laneBox.innerHTML = S.L.lanes.map(l => {
      const y0 = l.y * k + S.view.y, y1 = (l.y + l.h) * k + S.view.y;
      if (y1 < 0 || y0 > H) return '';
      const span = Math.min(y1, H) - Math.max(y0, 0);
      if (span < 64) return '';            /* 泳道露出太少就不贴标签，免得压到相邻泳道 */
      const w = Math.max(64, Math.min(span - 14, 250));
      /* 泳道只露出一小截时，标签贴着可见区居中，保证始终看得到完整的架构名 */
      const lo = Math.max(y0, 0) + w / 2 + 6, hi = Math.min(y1, H) - w / 2 - 6;
      const cy = lo > hi ? (Math.max(y0, 0) + Math.min(y1, H)) / 2
                        : Math.min(Math.max((y0 + y1) / 2, lo), hi);
      const col = S.theme === 'B' ? `hsl(${l.hue},58%,44%)` : `hsl(${l.hue},70%,60%)`;
      const techs = S.nodes.filter(n => n._arch === l.id);
      const p = benchmark ? m.maturityOf(techs) : m.progressOf(techs);
      const pct = Math.round(p.pct * 100);
      const on = S.archFilter.has(l.id);
      const off = S.archFilter.size && !on;
      return `<div class="lane-chip ${off ? 'dim' : ''} ${on ? 'on' : ''}" data-arch="${l.id}"
                   style="top:${cy}px;width:${w}px" title="${on ? '取消只看' : '只看'} ${l.code} ${l.name}">
        <div class="lc-txt"><span class="cd" style="color:${col}">${l.code}</span> ${l.name}
          <b style="color:${col}">${pct}%</b></div>
        <div class="lc-bar"><i style="width:${pct}%;background:${col}"></i></div>
      </div>`;
    }).join('');
    laneBox.querySelectorAll('.lane-chip').forEach(c => c.onclick = () => {
      const a = c.dataset.arch;
      S.archFilter.has(a) ? S.archFilter.delete(a) : S.archFilter.add(a);
      if (S.archFilter.size === M().tx.arch.length) S.archFilter.clear();
      rebuild(); fit();
    });
  }

  function applyTransform() {
    const svg = $('#canvas');
    svg.setAttribute('viewBox', `0 0 ${$('#stage').clientWidth} ${$('#stage').clientHeight}`);
    let g = svg.querySelector('.viewport');
    if (!g) {
      g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'viewport');
      while (svg.firstChild) g.appendChild(svg.firstChild);
      svg.appendChild(g);
    }
    g.setAttribute('transform', `translate(${S.view.x},${S.view.y}) scale(${S.view.k})`);
    paintSticky();
  }
  /* 放开子列上限之后画布可能很宽（领域层约 5000px）。
   * 硬要一屏塞下就会把卡片缩到看不清字，所以分两种取景：
   *   overview 全览 —— 整张图塞进窗口，用于看全貌
   *   read     可读 —— 纵向适应、左对齐，卡片保持能读，靠时代导航往右走
   * 打开时按画布宽度自动选，⤢ 按钮在两者之间切换。 */
  const READABLE_K = 0.45;
  function fit(mode) {
    const st = $('#stage');
    const padT = 66, padL = 66, padR = 24;
    const padB = S.presenting ? 210 : (S.legendOff ? 40 : 78);
    const w = st.clientWidth - padL - padR, h = st.clientHeight - padT - padB;
    const kw = w / S.L.width, kh = h / S.L.height;

    if (!mode) mode = (Math.min(kw, kh) < READABLE_K && !S.presenting) ? 'read' : 'overview';
    S.fitMode = mode;

    if (mode === 'read') {
      S.view.k = Math.min(kh, 1.0);
      S.view.x = padL;                       /* 从第 Ⅰ 时代开始看 */
      S.view.y = padT + (h - S.L.height * S.view.k) / 2;
    } else {
      S.view.k = Math.min(kw, kh, 1.6);
      S.view.x = padL + (w - S.L.width * S.view.k) / 2;
      S.view.y = padT + (h - S.L.height * S.view.k) / 2;
    }
    applyTransform();
  }
  function centerOn(id, zoom) {
    const u = S.units.find(x => x.id === id); if (!u) return;
    const st = $('#stage');
    if (zoom) S.view.k = Math.max(S.view.k, .85);
    /* 抽屉打开时把可视中心左移，否则聚焦的节点正好被详情框盖住 */
    const drawerW = $('#drawer').classList.contains('open') ? $('#drawer').offsetWidth : 0;
    S.view.x = (st.clientWidth - drawerW) / 2 - u.cx * S.view.k;
    S.view.y = st.clientHeight / 2 - u.cy * S.view.k;
    applyTransform();
  }
  function panToX(worldX) {
    const st = $('#stage');
    S.view.x = st.clientWidth / 2 - worldX * S.view.k;
    applyTransform();
  }

  /* ---------------- 悬停高亮：上游祖先链 + 下游后继链 ---------------- */
  function applyHighlight() {
    const svg = $('#canvas');
    const id = S.hover || S.selected;
    const nodes = svg.querySelectorAll('.node'), edges = svg.querySelectorAll('.edge');
    nodes.forEach(n => n.classList.remove('faded', 'hi', 'sel'));
    edges.forEach(e => e.classList.remove('faded', 'up', 'down'));
    if (S.selected) svg.querySelector(`.node[data-id="${CSS.escape(S.selected)}"]`)?.classList.add('sel');
    if (!id) return;

    /* 在单元级图上做可达性计算 */
    const up = new Map(), down = new Map();
    S.edges.forEach(e => {
      if (!up.has(e.to)) up.set(e.to, []);
      up.get(e.to).push(e.from);
      if (!down.has(e.from)) down.set(e.from, []);
      down.get(e.from).push(e.to);
    });
    const anc = M().reach([id], up), des = M().reach([id], down);

    nodes.forEach(n => {
      const nid = n.dataset.id;
      if (nid === id) n.classList.add('hi');
      else if (anc.has(nid) || des.has(nid)) n.classList.add('hi');
      else n.classList.add('faded');
    });
    edges.forEach(e => {
      const f = e.dataset.from, t = e.dataset.to;
      const onUp = (anc.has(f) || f === id) && (anc.has(t) || t === id);
      const onDown = (des.has(f) || f === id) && (des.has(t) || t === id);
      if (onUp) e.classList.add('up');
      else if (onDown) e.classList.add('down');
      else e.classList.add('faded');
    });
  }

  /* ---------------- 面包屑 ---------------- */
  function paintBreadcrumb() {
    const m = M(), open = [...S.expanded];
    const domsOpen = open.filter(x => m.domById.has(x));
    const capsOpen = open.filter(x => m.capById.has(x));
    const bits = [`<span class="crumb" data-act="root">全景</span>`];
    if (domsOpen.length === 1) {
      bits.push(`<span class="sep">›</span><span class="crumb ${capsOpen.length ? '' : 'cur'}" data-act="dom" data-id="${domsOpen[0]}">${m.domById.get(domsOpen[0]).name}</span>`);
      if (capsOpen.length === 1)
        bits.push(`<span class="sep">›</span><span class="crumb cur">${m.capById.get(capsOpen[0]).name}</span>`);
      else if (capsOpen.length > 1)
        bits.push(`<span class="sep">›</span><span class="crumb cur">${capsOpen.length} 个能力已展开</span>`);
    } else if (domsOpen.length > 1) {
      bits.push(`<span class="sep">›</span><span class="crumb cur">${domsOpen.length} 个领域已展开${capsOpen.length ? ` · ${capsOpen.length} 个能力` : ''}</span>`);
    }
    const el = $('#breadcrumb');
    el.innerHTML = bits.join('');
    el.querySelectorAll('.crumb').forEach(c => c.onclick = () => {
      if (c.dataset.act === 'root') { S.expanded.clear(); S.level = 'domain'; syncLevelBtns(); rebuild(); fit(); }
      else if (c.dataset.act === 'dom') {
        [...S.expanded].filter(x => m.capById.has(x)).forEach(x => S.expanded.delete(x));
        rebuild();
      }
    });
  }

  /* ---------------- 图例 ---------------- */
  function paintLegend() {
    const m = M(), mode = S.colorMode, rows = [];
    let title = '', note = '';
    const tone = c => TT.render.toneFor(c, S.theme);
    if (mode === 'status' && S.orgId !== 'benchmark') {
      title = '本单位建设状态';
      m.tx.status.forEach(s => rows.push([s.color, s.name]));
      note = '虚线连线 = 前置尚未建成的依赖；实线 = 依赖已打通；' +
        '<span style="color:var(--accent-2)">紫色双箭头弧线</span> = 双向依赖（互为前置）；' +
        '<span style="color:#f0a05a">橙色虚弧线</span> = 环路中被迫回折的边，下钻到技术层即消失';
    } else if (mode === 'status' || mode === 'maturity') {
      title = '技术成熟度（行业整体）';
      m.tx.maturity.forEach(s => rows.push([s.color, s.name]));
      note = '默认视图为世界金融科技基准，不代表任何一家机构的现状';
    } else if (mode === 'lifecycle') {
      title = '技术生命周期';
      m.tx.lifecycle.forEach(l => rows.push([l.color, l.name]));
      note = '斜纹底 = 已被替代或正在退役。<b>成熟度高不等于还该投入</b>——集中式核心就是成熟期 + 退役中';
    } else if (mode === 'autonomy') {
      title = '信创自主可控';
      m.tx.autonomy.forEach(s => rows.push([s.color, s.name]));
    } else if (mode === 'value') {
      title = '业务价值';
      rows.push(['#f5c451', '极高'], ['#fbbf24', '高'], ['#60a5fa', '中'], ['#64748b', '一般']);
    } else if (mode === 'award') {
      title = '金融科技发展奖关联度';
      rows.push(['#f5c451', '4 项以上'], ['#d9a441', '2–3 项'], ['#8a7a4a', '1 项'], ['#4a5568', '暂无关联']);
      note = '获奖代表该方向已有成熟实践；<b>未获奖不代表机构未建设</b>，仅作加分证据';
    } else if (mode === 'gap') {
      title = '与基准的差距';
      rows.push(['#f5c451', '领先'], ['#7f8ea3', '持平'], ['#f87171', '落后'], ['#3f4a5e', '未评估']);
      note = S.orgId === 'benchmark' ? '请先在左上角切换到一个具体单位' : '';
    }
    if (S.legendOff) {
      $('#legend').innerHTML = `<div class="lg-title" style="margin:0;cursor:pointer">图例 ▸</div>`;
      $('#legend').onclick = () => { S.legendOff = false; paintLegend(); };
      return;
    }
    $('#legend').onclick = e => {
      if (e.target.classList.contains('lg-title')) { S.legendOff = true; paintLegend(); }
    };
    $('#legend').innerHTML = `<div class="lg-title" style="cursor:pointer">${title} ▾</div>` +
      rows.map(([c, n]) => `<div class="lg-row"><span class="sw" style="background:${tone(c)}"></span>${n}</div>`).join('') +
      (note ? `<div class="lg-note">${note}</div>` : '');
  }

  /* ---------------- 规划模式 ---------------- */
  function markPlanTargets() {
    $('#canvas').querySelectorAll('.node').forEach(n => {
      n.querySelector('.shape')?.setAttribute('stroke-dasharray',
        S.planTargets.has(n.dataset.id) ? '6 3' : '');
    });
  }
  function togglePlanTarget(id) {
    const u = S.units.find(x => x.id === id);
    if (!u) return;
    /* 聚合节点的目标 = 其覆盖的全部技术节点 */
    const ids = u.kind === 'tech' ? [id] : M().descendants(id, S.nodes, S.h).map(t => t.id);
    const allIn = ids.every(x => S.planTargets.has(x));
    ids.forEach(x => allIn ? S.planTargets.delete(x) : S.planTargets.add(x));
    S.planTargets.has(id) || allIn ? S.planTargets.delete(id) : S.planTargets.add(id);
    if (u.kind !== 'tech') S.planTargets.delete(id);
    markPlanTargets();
    TT.ui.updatePlanBar();
  }

  /* ---------------- 交互绑定 ---------------- */
  function bindCanvas() {
    const stage = $('#stage'), svg = $('#canvas');
    let drag = null;

    stage.addEventListener('wheel', e => {
      e.preventDefault();
      const r = stage.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const k2 = Math.min(3.2, Math.max(.14, S.view.k * f));
      S.view.x = mx - (mx - S.view.x) * (k2 / S.view.k);
      S.view.y = my - (my - S.view.y) * (k2 / S.view.k);
      S.view.k = k2;
      applyTransform();
    }, { passive: false });

    svg.addEventListener('mousedown', e => {
      drag = { x: e.clientX, y: e.clientY, vx: S.view.x, vy: S.view.y, moved: false };
      svg.classList.add('dragging');
    });
    window.addEventListener('mousemove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      S.view.x = drag.vx + dx; S.view.y = drag.vy + dy;
      applyTransform();
    });
    window.addEventListener('mouseup', () => { drag = null; svg.classList.remove('dragging'); });

    svg.addEventListener('mouseover', e => {
      const g = e.target.closest('.node'); if (!g) return;
      S.hover = g.dataset.id; applyHighlight();
    });
    svg.addEventListener('mouseout', e => {
      if (!e.target.closest('.node')) return;
      S.hover = null; applyHighlight();
    });

    /* 单击语义按节点类型分开，彻底避开「双击必然先触发单击」的冲突：
     *   聚合格   单击 = 下钻展开；单击右上角 ⓘ = 看详情
     *   技术节点 单击 = 看详情（它本来就没有下钻）
     *   任意节点 双击 = 收拢一级
     * 这样展开与看详情永远不会落在同一个手势上。 */
    svg.addEventListener('click', e => {
      if (drag && drag.moved) return;
      const g = e.target.closest('.node');
      if (!g) { S.selected = null; TT.ui.closeDrawer(); applyHighlight(); return; }
      const id = g.dataset.id, kind = g.dataset.kind;
      if (S.planMode) return togglePlanTarget(id);
      const wantInfo = kind === 'tech' || !!e.target.closest('.info-dot');
      if (wantInfo) {
        S.selected = id;
        TT.ui.openDrawer(id);
        applyHighlight();
      } else {
        toggleUnit(id, kind, 'expand');
      }
    });

    svg.addEventListener('dblclick', e => {
      const g = e.target.closest('.node'); if (!g) return;
      e.preventDefault();
      toggleUnit(g.dataset.id, g.dataset.kind, 'collapse');
    });

    window.addEventListener('resize', () => { applyTransform(); drawStars(); });
  }

  /* 展开 / 收拢同一个入口：
   * 领域格 → 展开为能力格；能力格 → 展开为技术节点；
   * 技术节点 → 收拢回它所属的能力格（再双击一次收回领域格）。 */
  function toggleUnit(unitId, kind, intent) {
    const m = M();
    const { base } = m.splitUnitId(unitId);
    let focus = base;

    if (kind === 'tech' || intent === 'collapse') {
      const n = kind === 'tech' ? S.byId.get(base) : null;
      if (n) {
        if (S.expanded.has(n.cap)) { S.expanded.delete(n.cap); focus = n.cap; }
        else { S.expanded.delete(n._domain); focus = n._domain; }
      } else if (S.expanded.has(base)) {
        S.expanded.delete(base);
        if (m.domById.has(base))
          m.tx.capabilities.filter(c => c.domain === base).forEach(c => S.expanded.delete(c.id));
      } else if (m.capById.has(base)) {
        S.expanded.delete(m.capById.get(base).domain);
        focus = m.capById.get(base).domain;
      } else return;
    } else {
      if (S.expanded.has(base)) return;   /* 已展开的格子不会再出现，无需处理 */
      S.expanded.add(base);
    }

    /* 双击前的那次单击会留下选中态，不清掉会让展开后整图被淡化 */
    S.selected = null; S.hover = null; TT.ui.closeDrawer();
    S.level = 'custom'; syncLevelBtns();
    rebuild();

    /* 焦点落到焦点主体在当前视图里的第一个格子上 */
    const target = S.units.find(u => u.base === focus) || S.units.find(u => u.id.startsWith(focus));
    if (target) requestAnimationFrame(() => centerOn(target.id, true));
  }

  function syncLevelBtns() {
    document.querySelectorAll('#levelSeg .btn').forEach(b =>
      b.classList.toggle('on', b.dataset.level === S.level));
  }
  function setLevel(lv) {
    const m = M();
    S.level = lv; S.expanded.clear();
    S.selected = null; S.hover = null; TT.ui.closeDrawer();
    if (lv === 'cap' || lv === 'tech') m.tx.domains.forEach(d => S.expanded.add(d.id));
    if (lv === 'tech') m.tx.capabilities.forEach(c => S.expanded.add(c.id));
    syncLevelBtns(); rebuild(); fit();
  }
  TT.setLevel = setLevel;

  /* ---------------- 星尘背景 ---------------- */
  function drawStars() {
    const c = $('#stars'), st = $('#stage');
    c.width = st.clientWidth; c.height = st.clientHeight;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    if (S.theme !== 'A') return;
    let seed = 20260820;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < 220; i++) {
      const x = rnd() * c.width, y = rnd() * c.height, r = rnd() * 1.1 + .2;
      ctx.globalAlpha = .10 + rnd() * .34;
      ctx.fillStyle = rnd() > .82 ? '#8fd0ff' : '#c9d8f0';
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------- 顶栏事件 ---------------- */
  function bindToolbar() {
    const m = M();
    const orgSel = $('#orgSel');
    orgSel.innerHTML = m.orgList().map(o =>
      `<option value="${o.orgId}">${o.orgId === 'benchmark' ? '🌍 ' : ''}${o.orgName}</option>`).join('');
    orgSel.value = S.orgId;
    orgSel.onchange = () => {
      S.orgId = orgSel.value;
      S.selected = null; S.hover = null; TT.ui.closeDrawer();
      syncColorOptions();
      rebuild();
    };

    $('#tagSel').innerHTML = '<option value="">全部节点</option>' +
      m.tx.tags.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    $('#tagSel').onchange = e => { S.tagFilter = e.target.value; rebuild(); fit(); };

    $('#colorSel').onchange = e => { S.colorMode = e.target.value; rebuild(); };

    /* 「本单位建设状态」和「与基准的差距」在基准视图下没有意义 ——
     * 基准树描述的是行业整体成熟度，没有"建成/未建成"这回事。
     * 所以在基准视图下禁用这两项，避免它们和「技术成熟度」显示出同样的颜色。 */
    function syncColorOptions() {
      const sel = $('#colorSel');
      const benchmark = S.orgId === 'benchmark';
      sel.querySelector('[value="status"]').disabled = benchmark;
      sel.querySelector('[value="gap"]').disabled = benchmark;
      sel.querySelector('[value="status"]').textContent = benchmark ? '本单位建设状态（需先选单位）' : '本单位建设状态';
      sel.querySelector('[value="gap"]').textContent = benchmark ? '与行业基准的差距（需先选单位）' : '与行业基准的差距';
      if (benchmark && (S.colorMode === 'status' || S.colorMode === 'gap')) S.colorMode = 'maturity';
      else if (!benchmark && S.colorMode === 'maturity') S.colorMode = 'status';
      sel.value = S.colorMode;
    }
    syncColorOptions();

    document.querySelectorAll('#levelSeg .btn').forEach(b => b.onclick = () => setLevel(b.dataset.level));

    $('#search').oninput = e => {
      const q = e.target.value.trim().toLowerCase();
      if (!q) { S.selected = null; applyHighlight(); return; }
      const hit = S.nodes.find(n =>
        n.id.toLowerCase() === q || n.name.toLowerCase().includes(q) ||
        (n.en || '').toLowerCase().includes(q));
      if (!hit) return;
      /* 自动展开到该节点所在层级 */
      S.expanded.add(hit._domain); S.expanded.add(hit.cap);
      S.level = 'custom'; syncLevelBtns(); rebuild();
      S.selected = hit.id; applyHighlight(); centerOn(hit.id, true);
      TT.ui.openDrawer(hit.id);
    };

    const cbtn = $('#btnCompact');
    cbtn.classList.toggle('on', S.compact);
    cbtn.onclick = () => {
      S.compact = !S.compact;
      cbtn.classList.toggle('on', S.compact);
      localStorage.setItem('tt-compact', S.compact ? '1' : '');
      TT.ui.toast(S.compact ? '紧凑模式：图收进一屏，同代依赖会画成竖线' : '已关闭紧凑模式：有先后关系的节点一律左→右排开');
      rebuild(); fit();
    };
    $('#btnTheme').onclick = () => {
      S.theme = S.theme === 'A' ? 'B' : 'A';
      document.documentElement.dataset.theme = S.theme;
      $('#btnTheme').textContent = '主题 ' + S.theme;
      localStorage.setItem('tt-theme', S.theme);
      drawStars(); rebuild();
    };
    $('#btnPlan').onclick = () => {
      S.planMode = !S.planMode;
      $('#btnPlan').classList.toggle('on', S.planMode);
      TT.ui.togglePlanBar(S.planMode);
      if (!S.planMode) { S.planTargets.clear(); markPlanTargets(); }
    };
    $('#btnHeat').onclick = () => TT.ui.awardHeatmap();
    $('#btnExport').onclick = e => TT.ui.exportMenu(e.currentTarget);
    $('#btnMaintain').onclick = () => {
      S.maintain = !S.maintain;
      $('#btnMaintain').classList.toggle('on', S.maintain);
      TT.ui.toast(S.maintain ? '维护模式已开启：点节点可直接编辑，改完记得导出数据文件' : '维护模式已关闭');
      if (S.selected) TT.ui.openDrawer(S.selected);
    };
    $('#btnHelp').onclick = () => TT.ui.help();
    $('#btnPresent').onclick = () => TT.ui.startPresent();
    $('#zIn').onclick = () => { S.view.k = Math.min(3.2, S.view.k * 1.25); applyTransform(); };
    $('#zOut').onclick = () => { S.view.k = Math.max(.14, S.view.k / 1.25); applyTransform(); };
    $('#zFit').onclick = () => {
      fit(S.fitMode === 'overview' ? 'read' : 'overview');
      TT.ui.toast(S.fitMode === 'overview' ? '全览：整张图塞进窗口' : '可读：卡片保持能读，用左右的时代按钮往前走');
    };
    $('#dwClose').onclick = () => { TT.ui.closeDrawer(); S.selected = null; applyHighlight(); };

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (S.presenting) return TT.ui.exitPresent();
        if ($('#modals').children.length) return TT.ui.closeModal();
        if ($('#drawer').classList.contains('open')) { TT.ui.closeDrawer(); S.selected = null; return applyHighlight(); }
        const caps = [...S.expanded].filter(x => M().capById.has(x));
        if (caps.length) { caps.forEach(c => S.expanded.delete(c)); return rebuild(); }
        if (S.expanded.size) { S.expanded.clear(); S.level = 'domain'; syncLevelBtns(); rebuild(); return fit(); }
      }
      if (S.presenting) {
        if (e.key === 'ArrowRight' || e.key === ' ') TT.ui.presentStep(1);
        if (e.key === 'ArrowLeft') TT.ui.presentStep(-1);
      }
      if (e.key === 'f' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); $('#search').focus(); }
    });
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    S.theme = localStorage.getItem('tt-theme') || 'A';
    S.compact = !!localStorage.getItem('tt-compact');
    document.documentElement.dataset.theme = S.theme;
    $('#btnTheme').textContent = '主题 ' + S.theme;

    const v = TT.validate();
    const badge = $('#validBadge');
    if (v.errors.length) {
      badge.innerHTML = `<span class="badge-err">✖ 数据错误 ${v.errors.length}</span>`;
      badge.onclick = () => TT.ui.showIssues(v);
    } else if (v.warns.length) {
      badge.innerHTML = `<span class="badge-warn">⚠ ${v.warns.length}</span>`;
      badge.onclick = () => TT.ui.showIssues(v);
    }
    TT.issues = v;

    bindToolbar();
    bindCanvas();
    TT.ui.init(S, { rebuild, fit, centerOn, panToX, applyHighlight, setLevel, drawStars });
    syncLevelBtns();
    drawStars();
    rebuild();
    fit();
    setTimeout(() => { const h = $('#hint'); if (h) h.style.opacity = 0; }, 7000);
  }

  document.addEventListener('DOMContentLoaded', () => loadOrgFiles(init));
})();
