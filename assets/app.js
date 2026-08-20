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
    colorMode: 'status',
    tagFilter: '',
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
      const cand = (S.expanded.has(n._domain) && S.expanded.has(n.cap)) ? n.id
        : (S.expanded.has(n._domain) ? n.cap : n._domain);
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

    /* 未打通的依赖（前置未建成）画成暗色虚线 */
    S.lockedEdges = new Set();
    if (S.orgId !== 'benchmark') {
      S.edges.forEach(e => {
        const allBuilt = e.pairs.every(([d]) => S.byId.get(d)?._status === 'built');
        if (!allBuilt) S.lockedEdges.add(e.from + '>' + e.to);
      });
    }

    S.L = TT.layout.compute(units, S.nodes, S.h);
    S.units = S.L.units;

    TT.render.draw($('#canvas'), S.L, S);
    applyTransform();
    paintProgress();
    paintBreadcrumb();
    paintLegend();
    applyHighlight();
    if (S.planMode) markPlanTargets();
  }
  TT.rebuild = rebuild;

  /* ---------------- 视图变换 ---------------- */
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
  }
  function fit() {
    const st = $('#stage'), pad = 34;
    const k = Math.min((st.clientWidth - pad * 2) / S.L.width,
                       (st.clientHeight - pad * 2) / S.L.height, 1.6);
    S.view.k = k;
    S.view.x = (st.clientWidth - S.L.width * k) / 2;
    S.view.y = (st.clientHeight - S.L.height * k) / 2;
    applyTransform();
  }
  function centerOn(id, zoom) {
    const u = S.units.find(x => x.id === id); if (!u) return;
    const st = $('#stage');
    if (zoom) S.view.k = Math.max(S.view.k, .85);
    S.view.x = st.clientWidth / 2 - u.cx * S.view.k;
    S.view.y = st.clientHeight / 2 - u.cy * S.view.k;
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

  /* ---------------- 顶部 5A 进度条 ---------------- */
  function paintProgress() {
    const m = M(), box = $('#progressbar');
    const benchmark = S.orgId === 'benchmark';
    box.innerHTML = m.tx.arch.map(a => {
      const techs = S.nodes.filter(n => n._arch === a.id);
      const p = benchmark ? m.maturityOf(techs) : m.progressOf(techs);
      const color = `hsl(${a.hue},70%,58%)`;
      const sub = benchmark
        ? `${techs.length} 项 · 平均成熟度`
        : `${p.stat?.built || 0}/${techs.length} 已建成`;
      return `<div class="pb-cell" data-arch="${a.id}" title="${a.desc}">
        <div class="pb-top"><span class="pb-name">${a.code} ${a.name}</span>
          <span class="pb-pct">${Math.round(p.pct * 100)}%</span></div>
        <div class="pb-track"><div class="pb-fill" style="width:${(p.pct * 100).toFixed(1)}%;background:${color}"></div></div>
        <div class="pb-name" style="font-size:10.5px;opacity:.65">${sub}</div>
      </div>`;
    }).join('');
    box.querySelectorAll('.pb-cell').forEach(c => c.onclick = () => {
      const arch = c.dataset.arch;
      const doms = m.tx.domains.filter(d => d.arch === arch);
      const allOpen = doms.every(d => S.expanded.has(d.id));
      doms.forEach(d => allOpen ? S.expanded.delete(d.id) : S.expanded.add(d.id));
      rebuild();
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
    if (mode === 'status' && S.orgId !== 'benchmark') {
      title = '建设状态';
      m.tx.status.forEach(s => rows.push([s.color, s.name]));
      note = '虚线连线 = 前置尚未建成的依赖；<span style="color:#e05a5a">红色虚线</span> = 安全架构的合规闸门';
    } else if (mode === 'status' || mode === 'maturity') {
      title = '技术成熟度（行业整体）';
      m.tx.maturity.forEach(s => rows.push([s.color, s.name]));
      note = '默认视图为世界金融科技基准，不代表任何一家机构的现状';
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
    $('#legend').innerHTML = `<div class="lg-title">${title}</div>` +
      rows.map(([c, n]) => `<div class="lg-row"><span class="sw" style="background:${c}"></span>${n}</div>`).join('') +
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

    svg.addEventListener('click', e => {
      if (drag && drag.moved) return;
      const g = e.target.closest('.node');
      if (!g) { S.selected = null; TT.ui.closeDrawer(); applyHighlight(); return; }
      const id = g.dataset.id;
      if (S.planMode) return togglePlanTarget(id);
      S.selected = id;
      TT.ui.openDrawer(id);
      applyHighlight();
    });

    svg.addEventListener('dblclick', e => {
      const g = e.target.closest('.node'); if (!g) return;
      const id = g.dataset.id, kind = g.dataset.kind;
      if (kind === 'tech') return;
      S.expanded.has(id) ? S.expanded.delete(id) : S.expanded.add(id);
      if (M().domById.has(id) && !S.expanded.has(id))
        (M().tx.capabilities.filter(c => c.domain === id)).forEach(c => S.expanded.delete(c.id));
      S.level = 'custom'; syncLevelBtns();
      rebuild();
      requestAnimationFrame(() => centerOn(id, true));
    });

    window.addEventListener('resize', () => { applyTransform(); drawStars(); });
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
      if (S.orgId === 'benchmark' && S.colorMode === 'gap') { S.colorMode = 'status'; $('#colorSel').value = 'status'; }
      rebuild();
    };

    $('#tagSel').innerHTML = '<option value="">全部节点</option>' +
      m.tx.tags.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    $('#tagSel').onchange = e => { S.tagFilter = e.target.value; rebuild(); fit(); };

    $('#colorSel').onchange = e => {
      S.colorMode = e.target.value;
      if (S.colorMode === 'gap' && S.orgId === 'benchmark') TT.ui.toast('差距视图需要先选择一个具体单位');
      rebuild();
    };

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
    $('#zFit').onclick = fit;
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
    TT.ui.init(S, { rebuild, fit, centerOn, applyHighlight, setLevel, drawStars });
    syncLevelBtns();
    drawStars();
    rebuild();
    fit();
    setTimeout(() => { const h = $('#hint'); if (h) h.style.opacity = 0; }, 7000);
  }

  document.addEventListener('DOMContentLoaded', () => loadOrgFiles(init));
})();
