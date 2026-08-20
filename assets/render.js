/* ==========================================================================
 * 金融科技树 · 渲染层（SVG）
 * ========================================================================== */
var TT = (globalThis.TT = globalThis.TT || {});

TT.render = (function () {
  const NS = 'http://www.w3.org/2000/svg';
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* 中英文混排的近似宽度测量，用于截断标题 */
  function textWidth(s, size) {
    let w = 0;
    for (const ch of String(s)) w += /[　-鿿＀-￯]/.test(ch) ? size : size * 0.55;
    return w;
  }
  function fit(s, maxW, size) {
    if (textWidth(s, size) <= maxW) return s;
    let out = '';
    for (const ch of String(s)) {
      if (textWidth(out + ch, size) > maxW - size * 0.8) break;
      out += ch;
    }
    return out + '…';
  }

  /* 卡片外形：主题 A 用切角六边形轮廓，主题 B 用圆角矩形 */
  function shapePath(x, y, w, h, hex) {
    if (!hex) { const r = 7; return roundRect(x, y, w, h, r); }
    const c = Math.min(13, h / 3);
    return `M${x + c},${y} L${x + w},${y} L${x + w},${y + h - c} L${x + w - c},${y + h} L${x},${y + h} L${x},${y + c} Z`;
  }
  function roundRect(x, y, w, h, r) {
    return `M${x + r},${y} H${x + w - r} A${r},${r} 0 0 1 ${x + w},${y + r} V${y + h - r}` +
           ` A${r},${r} 0 0 1 ${x + w - r},${y + h} H${x + r} A${r},${r} 0 0 1 ${x},${y + h - r}` +
           ` V${y + r} A${r},${r} 0 0 1 ${x + r},${y} Z`;
  }

  const hsl = (h, s, l, a) => `hsla(${h},${s}%,${l}%,${a})`;

  /* ---------------- 着色：由当前着色维度决定 ---------------- */
  function colorOf(u, st) {
    const m = TT.model, mode = st.colorMode;
    const techs = u.techs || [];
    if (mode === 'status') {
      if (st.orgId === 'benchmark') return colorOf(u, { ...st, colorMode: 'maturity' });
      if (u.kind === 'tech') return m.statusById.get(u.ref._status || 'unknown')?.color || '#64748b';
      const p = m.progressOf(techs).pct;
      return p >= .85 ? '#4ade80' : p >= .5 ? '#a3e635' : p >= .25 ? '#fbbf24' : p > 0 ? '#60a5fa' : '#64748b';
    }
    if (mode === 'maturity') {
      if (u.kind === 'tech') return m.maturityById.get(u.ref.maturity)?.color || '#64748b';
      const avg = m.maturityOf(techs).pct;
      return avg >= .88 ? '#4ade80' : avg >= .72 ? '#22d3ee' : avg >= .55 ? '#818cf8' : avg >= .38 ? '#c084fc' : '#f472b6';
    }
    if (mode === 'autonomy') {
      if (u.kind === 'tech') return m.autonomyById.get(u.ref.autonomy)?.color || '#64748b';
      const rank = { full: 3, partial: 2, dependent: 1, na: 3 };
      const avg = techs.length ? techs.reduce((s, t) => s + (rank[t.autonomy] || 2), 0) / techs.length : 2;
      return avg >= 2.7 ? '#4ade80' : avg >= 2.2 ? '#fbbf24' : '#f87171';
    }
    if (mode === 'value') {
      const v = u.kind === 'tech' ? (u.ref.value || 3)
        : (techs.length ? techs.reduce((s, t) => s + (t.value || 3), 0) / techs.length : 3);
      return v >= 4.6 ? '#f5c451' : v >= 4 ? '#fbbf24' : v >= 3.2 ? '#60a5fa' : '#64748b';
    }
    if (mode === 'award') {
      const n = techs.reduce((s, t) => s + (t._awards?.length || 0), 0);
      return n >= 4 ? '#f5c451' : n >= 2 ? '#d9a441' : n >= 1 ? '#8a7a4a' : '#4a5568';
    }
    if (mode === 'gap') {
      const v = st.gapMap?.get(u.id);
      if (u.kind === 'tech') {
        return v === 'ahead' ? '#f5c451' : v === 'behind' ? '#f87171' : v === 'even' ? '#7f8ea3' : '#3f4a5e';
      }
      let a = 0, b = 0, k = 0;
      techs.forEach(t => {
        const x = st.gapMap?.get(t.id);
        if (x === 'ahead') a++; else if (x === 'behind') b++; else if (x === 'even') k++;
      });
      return b > a ? '#f87171' : a > b ? '#f5c451' : (k ? '#7f8ea3' : '#3f4a5e');
    }
    return '#64748b';
  }

  /* ---------------- 主绘制 ---------------- */
  function draw(svg, L, st) {
    const m = TT.model, tx = m.tx;
    const hex = st.theme === 'A';
    const parts = [];

    /* --- defs --- */
    parts.push(`<defs>
      <marker id="arw" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M0,0 L8,4 L0,8 z" fill="currentColor"/>
      </marker>
    </defs>`);

    /* --- 泳道背景 --- */
    const bg = [];
    L.lanes.forEach(l => {
      bg.push(`<rect class="lane-bg ${l.band ? 'band' : ''}" x="0" y="${l.y}" width="${L.width}" height="${l.h}"/>`);
      bg.push(`<line class="lane-line" x1="0" y1="${l.y}" x2="${L.width}" y2="${l.y}"/>`);
      const cy = l.y + l.h / 2;
      bg.push(`<g transform="translate(${L.LEFT_W / 2},${cy})"><text class="lane-label" transform="rotate(-90)">` +
        `<tspan class="code">${l.code}</tspan> ${esc(l.name)}</text></g>`);
    });
    bg.push(`<line class="lane-line" x1="0" y1="${L.lanes.at(-1).y + L.lanes.at(-1).h}" x2="${L.width}" y2="${L.lanes.at(-1).y + L.lanes.at(-1).h}"/>`);

    /* --- 时代分栏 --- */
    L.cols.forEach((c, i) => {
      if (i % 2) bg.push(`<rect class="era-band" x="${c.x}" y="${L.HEAD_H}" width="${c.w}" height="${L.height - L.HEAD_H}"/>`);
      bg.push(`<line class="era-line" x1="${c.x}" y1="${L.HEAD_H}" x2="${c.x}" y2="${L.height}"/>`);
      const cx = c.x + c.w / 2;
      bg.push(`<text class="era-roman" x="${cx}" y="24">${c.era.roman}</text>`);
      bg.push(`<text class="era-title" x="${cx}" y="42">${esc(c.era.name)}</text>`);
      bg.push(`<text class="era-period" x="${cx}" y="56">${esc(c.era.period)}</text>`);
    });
    parts.push(`<g class="bg">${bg.join('')}</g>`);

    /* --- 跨 5A 宽卡片的背景带（如「人工智能与大模型」领域） --- */
    const spans = [];
    L.units.forEach(u => {
      if (u.kind === 'domain' && u.ref.spanArch?.length) {
        const top = L.lanes[0].y, bot = L.lanes.at(-1).y + L.lanes.at(-1).h;
        spans.push(`<rect class="spanband" x="${u.x - 16}" y="${top}" width="${u.w + 32}" height="${bot - top}" rx="10"/>`);
        spans.push(`<rect class="spanband-edge" x="${u.x - 16}" y="${top}" width="${u.w + 32}" height="${bot - top}" rx="10"/>`);
        spans.push(`<text class="spanband-tip" x="${u.x + u.w / 2}" y="${top + 16}" text-anchor="middle">横跨全部 5A 架构线</text>`);
      }
    });
    if (spans.length) parts.push(`<g class="spans">${spans.join('')}</g>`);

    /* --- 依赖连线 --- */
    const pos = new Map(L.units.map(u => [u.id, u]));
    const edges = [];
    st.edges.forEach(e => {
      const a = pos.get(e.from), b = pos.get(e.to);
      if (!a || !b) return;
      const w = Math.min(4.2, 1 + Math.log2(e.weight + 1) * 0.95);
      const cls = ['edge'];
      if (e.gate) cls.push('gate');
      if (st.lockedEdges?.has(e.from + '>' + e.to)) cls.push('locked');
      edges.push(`<path class="${cls.join(' ')}" d="${TT.layout.edgePath(a, b)}" stroke-width="${w.toFixed(2)}"` +
        ` data-from="${esc(e.from)}" data-to="${esc(e.to)}"/>`);
    });
    parts.push(`<g class="edges">${edges.join('')}</g>`);

    /* --- 节点 --- */
    const nodes = [];
    L.units.forEach(u => {
      const color = colorOf(u, st);
      const isTech = u.kind === 'tech';
      const locked = isTech && st.orgId !== 'benchmark' &&
        (u.ref._status === 'unknown' || u.ref._status === 'none');
      const titleSize = u.kind === 'domain' ? 14.5 : u.kind === 'cap' ? 13 : 12.5;
      const g = [];

      g.push(`<path class="shape" d="${shapePath(u.x, u.y, u.w, u.h, hex)}"` +
        ` fill="${color}22" stroke="${color}" style="color:${color}"/>`);

      const padX = 12;
      let ty = u.y + (isTech ? 21 : 24);
      const name = u.kind === 'tech' ? u.ref.name : u.ref.name;
      g.push(`<text class="title" x="${u.x + padX}" y="${ty}" font-size="${titleSize}">${esc(fit(name, u.w - padX * 2 - (isTech ? 16 : 34), titleSize))}</text>`);

      if (isTech) {
        const n = u.ref;
        const bits = [];
        if (st.orgId === 'benchmark') {
          bits.push(m.maturityById.get(n.maturity)?.name || '');
          bits.push(m.adoptionById.get(n.adoption)?.name || '');
        } else {
          bits.push(m.statusById.get(n._status || 'unknown')?.name || '');
          if (n.owner) bits.push(n.owner);
        }
        g.push(`<text class="meta" x="${u.x + padX}" y="${u.y + u.h - 12}">${esc(fit(bits.filter(Boolean).join(' · '), u.w - padX * 2 - 14, 10))}</text>`);
        if (n._awards.length) g.push(`<text class="award" x="${u.x + u.w - 17}" y="${u.y + u.h - 11}">🏆</text>`);
        if (n.frontier || n.maturity === 'experimental')
          g.push(`<circle class="pulse" cx="${u.x + u.w - 11}" cy="${u.y + 11}" r="4" fill="${color}"/>`);
        if (n._status === 'building')
          g.push(`<path class="building-ring" d="${shapePath(u.x - 3, u.y - 3, u.w + 6, u.h + 6, hex)}"/>`);
      } else {
        /* 聚合节点：进度环 + 子节点统计 */
        const prog = st.orgId === 'benchmark' ? m.maturityOf(u.techs) : m.progressOf(u.techs);
        const R = u.kind === 'domain' ? 17 : 13;
        const cx = u.x + u.w - R - 13, cy2 = u.y + u.h / 2;
        const C = 2 * Math.PI * R;
        g.push(`<circle class="ring-bg" cx="${cx}" cy="${cy2}" r="${R}"/>`);
        g.push(`<circle class="ring-fg" cx="${cx}" cy="${cy2}" r="${R}" stroke="${color}"` +
          ` stroke-dasharray="${(C * prog.pct).toFixed(1)} ${C.toFixed(1)}"` +
          ` style="transform-origin:${cx}px ${cy2}px"/>`);
        g.push(`<text class="cnt" x="${cx}" y="${cy2 + 4}" text-anchor="middle" font-size="${u.kind === 'domain' ? 11.5 : 10}">${Math.round(prog.pct * 100)}</text>`);

        const s = st.orgId === 'benchmark'
          ? `${u.techs.length} 项技术`
          : (() => {
              const c = m.progressOf(u.techs).stat;
              return `${u.techs.length} 项 · 建成 ${c.built || 0} · 在建 ${c.building || 0} · 未启 ${(c.none || 0) + (c.unknown || 0)}`;
            })();
        g.push(`<text class="meta" x="${u.x + padX}" y="${u.y + u.h - (u.kind === 'domain' ? 26 : 12)}">${esc(fit(s, u.w - padX - R * 2 - 22, 10))}</text>`);

        if (u.kind === 'domain') {
          const awards = u.techs.reduce((a, t) => a + (t._awards?.length || 0), 0);
          const extra = [];
          if (u.ref.spanArch?.length) extra.push('横跨 5A');
          if (awards) extra.push(`🏆 ${awards}`);
          extra.push('双击展开');
          g.push(`<text class="meta" x="${u.x + padX}" y="${u.y + u.h - 11}" opacity=".75">${esc(fit(extra.join(' · '), u.w - padX - R * 2 - 22, 10))}</text>`);
        }
      }

      const cls = ['node', 'k-' + u.kind];
      if (locked) cls.push('locked');
      nodes.push(`<g class="${cls.join(' ')}" data-id="${esc(u.id)}" data-kind="${u.kind}" style="color:${color}">${g.join('')}</g>`);
    });
    parts.push(`<g class="nodes">${nodes.join('')}</g>`);

    svg.innerHTML = parts.join('');
  }

  return { draw, colorOf, fit, esc, shapePath, textWidth };
})();
