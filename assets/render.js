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

  /* 亮色主题下把调色板压暗、提饱和：同一套语义色，两种底色都能读 */
  function toneFor(hex, theme) {
    if (theme !== 'B' || typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l0 = (mx + mn) / 2, d = mx - mn;
    let h = 0, sat = 0;
    if (d) {
      sat = l0 > .5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h /= 6;
    }
    const L = Math.min(l0 * 0.66, 0.40);          /* 压暗 */
    const S = Math.min(sat * 1.18 + .06, 0.88);   /* 提饱和 */
    const q = L < .5 ? L * (1 + S) : L + S - L * S, pp = 2 * L - q;
    const f = t => {
      t = (t + 1) % 1;
      return t < 1 / 6 ? pp + (q - pp) * 6 * t : t < 1 / 2 ? q
           : t < 2 / 3 ? pp + (q - pp) * (2 / 3 - t) * 6 : pp;
    };
    const to = v => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
    return '#' + to(f(h + 1 / 3)) + to(f(h)) + to(f(h - 1 / 3));
  }

  /* ---------------- 着色：由当前着色维度决定 ---------------- */
  function colorOf(u, st) {
    return toneFor(colorRaw(u, st), st.theme);
  }

  function colorRaw(u, st) {
    const m = TT.model, mode = st.colorMode;
    const techs = u.techs || [];
    if (mode === 'status') {
      if (st.orgId === 'benchmark') return colorRaw(u, { ...st, colorMode: 'maturity' });
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
    if (mode === 'lifecycle') {
      if (u.kind === 'tech') return (m.tx.lifecycle.find(l => l.id === (u.ref.lifecycle || 'active')) || {}).color;
      const bad = techs.filter(t => t.lifecycle && t.lifecycle !== 'active').length;
      const r = techs.length ? bad / techs.length : 0;
      return r >= .5 ? '#f87171' : r > 0 ? '#94a3b8' : '#4ade80';
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
    const hatchCol = st.theme === 'B' ? 'rgba(30,45,70,.30)' : 'rgba(220,232,250,.26)';
    parts.push(`<defs>
      <marker id="arw" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M0,0 L8,4 L0,8 z" fill="currentColor"/>
      </marker>
      <pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="7" stroke="${hatchCol}" stroke-width="2.2"/>
      </pattern>
    </defs>`);

    /* --- 背景：泳道走色相，时代走明度 + 彩虹色带 ---
     * 两个维度刻意走不同的视觉通道，避免和节点的语义着色打架。
     * 所有颜色用行内属性而非 class，保证导出 PNG 时不依赖外部 CSS。 */
    const light = st.theme === 'B';
    /* 五条泳道一视同仁：安全架构不再用更重的底色特殊突出，
     * 它的横切性质由「贯穿」标签和位置表达，不靠颜色喊。 */
    /* 泳道只留很淡的底色，身份主要靠左侧色条和冻结列的色标表达；
     * 时代是主背景层，明度差拉开，画在泳道之上才不会被盖住。 */
    const laneTint = hue => light ? `hsla(${hue},58%,46%,.045)` : `hsla(${hue},68%,58%,.045)`;
    const laneBar  = hue => light ? `hsl(${hue},58%,44%)` : `hsl(${hue},70%,60%)`;
    const eraTint = i => {
      const t = tx.eras.length > 1 ? i / (tx.eras.length - 1) : 0;
      return light ? `rgba(22,44,80,${(0.022 + t * 0.072).toFixed(3)})`
                   : `rgba(200,224,255,${(0.018 + t * 0.068).toFixed(3)})`;
    };
    const eraBar = hue => light ? `hsl(${hue},55%,46%)` : `hsl(${hue},72%,64%)`;

    const bg = [];
    const bodyTop = L.HEAD_H, bodyH = L.height - L.HEAD_H;

    /* ① 泳道底色与左侧色条（很淡，只做归属提示） */
    L.lanes.forEach(l => {
      bg.push(`<rect x="0" y="${l.y}" width="${L.width}" height="${l.h}" fill="${laneTint(l.hue)}"/>`);
      bg.push(`<rect x="0" y="${l.y + 3}" width="6" height="${l.h - 6}" rx="3" fill="${laneBar(l.hue)}" opacity=".9"/>`);
    });

    /* ② 时代列：主背景层，画在泳道之上 */
    L.cols.forEach(c => {
      const i = tx.eras.indexOf(c.era), hue = c.era.hue ?? 210, cx = c.x + c.w / 2;
      bg.push(`<rect x="${c.x}" y="${bodyTop}" width="${c.w}" height="${bodyH}" fill="${eraTint(i)}"/>`);
      bg.push(`<text x="${cx}" y="${L.height - 22}" text-anchor="middle" font-size="150" font-weight="700"
        fill="${eraBar(hue)}" opacity="${light ? .05 : .055}" pointer-events="none">${c.era.roman}</text>`);
      bg.push(`<rect x="${c.x + 8}" y="${bodyTop - 8}" width="${c.w - 16}" height="4" rx="2" fill="${eraBar(hue)}" opacity=".8"/>`);
      bg.push(`<line x1="${c.x}" y1="${bodyTop - 8}" x2="${c.x}" y2="${L.height}" stroke="${eraBar(hue)}" stroke-opacity="${light ? .22 : .26}" stroke-width="1"/>`);
    });
    bg.push(`<line x1="${L.width}" y1="${bodyTop - 8}" x2="${L.width}" y2="${L.height}" stroke="var(--grid)" stroke-width="1"/>`);

    /* ③ 泳道分隔线画在最上层，保证行的边界清楚 */
    L.lanes.forEach(l => bg.push(`<line class="lane-line" x1="0" y1="${l.y}" x2="${L.width}" y2="${l.y}"/>`));
    const lastLane = L.lanes.at(-1);
    bg.push(`<line class="lane-line" x1="0" y1="${lastLane.y + lastLane.h}" x2="${L.width}" y2="${lastLane.y + lastLane.h}"/>`);

    /* ④ 矩阵视图：每行一条横跨时代的带 + 左侧行名（行名画进 SVG，导出 PNG 才带得上） */
    if (L.matrix) {
      L.rows.forEach(r => {
        const laneR = L.lanes.find(l => l.lane === r.lane);
        bg.push(`<text class="row-label" x="${L.LABEL_X}" y="${r.y + r.h / 2 - 3}">` +
          `${esc(fit(r.ref.name, L.LEFT_W - L.LABEL_X - 12, 12))}</text>`);
        bg.push(`<text class="row-sub" x="${L.LABEL_X}" y="${r.y + r.h / 2 + 11}">` +
          `全时代共 ${r.count} 项</text>`);
        const col = laneBar(laneR.hue);
        bg.push(`<rect x="${r.x0 - 12}" y="${r.y - 5}" width="${r.x1 - r.x0 + 24}" height="${r.h + 10}"
          rx="${(r.h + 10) / 2}" fill="${col}" opacity="${light ? .10 : .085}"/>`);
        bg.push(`<rect x="${r.x0 - 12}" y="${r.y - 5}" width="${r.x1 - r.x0 + 24}" height="${r.h + 10}"
          rx="${(r.h + 10) / 2}" fill="none" stroke="${col}" stroke-opacity=".45" stroke-width="1"/>`);
        bg.push(`<line x1="${r.x0}" y1="${r.y + r.h / 2}" x2="${r.x1}" y2="${r.y + r.h / 2}"
          stroke="${col}" stroke-opacity=".34" stroke-width="1.4" stroke-dasharray="2 4"/>`);
      });
    }

    parts.push(`<g class="bg">${bg.join('')}</g>`);

    /* --- 跨 5A 宽卡片的背景带（如「人工智能与大模型」领域） --- */
    const spans = [];
    const spanGroups = new Map();
    if (!L.matrix) L.units.forEach(u => {
      if (u.kind === 'domain' && u.ref.spanArch?.length) {
        const g = spanGroups.get(u.base) || { x0: Infinity, x1: -Infinity };
        g.x0 = Math.min(g.x0, u.x); g.x1 = Math.max(g.x1, u.x + u.w);
        spanGroups.set(u.base, g);
      }
    });
    spanGroups.forEach(g => {
      const top = L.lanes[0].y, bot = L.lanes.at(-1).y + L.lanes.at(-1).h;
      const x = g.x0 - 16, w = g.x1 - g.x0 + 32;
      spans.push(`<rect class="spanband" x="${x}" y="${top}" width="${w}" height="${bot - top}" rx="10"/>`);
      spans.push(`<rect class="spanband-edge" x="${x}" y="${top}" width="${w}" height="${bot - top}" rx="10"/>`);
      spans.push(`<text class="spanband-tip" x="${x + w / 2}" y="${top + 16}" text-anchor="middle">横跨全部 5A 架构线</text>`);
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
      let ty = u.y + (isTech ? 21 : 22);
      if (isTech || !L.matrix) {
        g.push(`<text class="title" x="${u.x + padX}" y="${ty}" font-size="${titleSize}">` +
          `${esc(fit(u.ref.name, u.w - padX * 2 - (isTech ? 16 : 34), titleSize))}</text>`);
      }

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
      } else if (L.matrix) {
        /* 矩阵格：名称已经在行名里，格子里只放数量与完成度 */
        const prog = st.orgId === 'benchmark' ? m.maturityOf(u.techs) : m.progressOf(u.techs);
        const R = 14, cx = u.x + u.w - R - 12, cy2 = u.y + u.h / 2, C = 2 * Math.PI * R;
        g.push(`<circle class="ring-bg" cx="${cx}" cy="${cy2}" r="${R}"/>`);
        g.push(`<circle class="ring-fg" cx="${cx}" cy="${cy2}" r="${R}" stroke="${color}"` +
          ` stroke-dasharray="${(C * prog.pct).toFixed(1)} ${C.toFixed(1)}"` +
          ` style="transform-origin:${cx}px ${cy2}px"/>`);
        g.push(`<text class="cnt" x="${cx}" y="${cy2 + 4}" text-anchor="middle" font-size="10.5">${Math.round(prog.pct * 100)}</text>`);
        g.push(`<text class="title" x="${u.x + 12}" y="${u.y + 20}" font-size="13">${u.techs.length} 项</text>`);
        const sub = st.orgId === 'benchmark'
          ? (m.maturityById.get([...u.techs].sort((a, b) =>
              (m.maturityById.get(b.maturity)?.order || 0) - (m.maturityById.get(a.maturity)?.order || 0))[0]?.maturity)?.name || '')
          : (() => { const c = m.progressOf(u.techs).stat;
              return `建成 ${c.built || 0} · 在建 ${c.building || 0}`; })();
        g.push(`<text class="meta" x="${u.x + 12}" y="${u.y + u.h - 10}">${esc(fit(sub, u.w - 24 - R * 2, 10))}</text>`);
        const aw = u.techs.reduce((a, t) => a + (t._awards?.length || 0), 0);
        if (aw) g.push(`<text class="award" x="${u.x + u.w - R * 2 - 22}" y="${u.y + 19}">🏆</text>`);
      } else {
        /* 自由布局下的聚合节点：进度环 + 子节点统计 */
        const prog = st.orgId === 'benchmark' ? m.maturityOf(u.techs) : m.progressOf(u.techs);
        const R = u.kind === 'domain' ? 15 : 12;
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
        g.push(`<text class="meta" x="${u.x + padX}" y="${u.y + u.h - (u.kind === 'domain' ? 22 : 11)}">${esc(fit(s, u.w - padX - R * 2 - 22, 10))}</text>`);

        if (u.kind === 'domain') {
          const awards = u.techs.reduce((a, t) => a + (t._awards?.length || 0), 0);
          const extra = [];
          if (u.ref.spanArch?.length) extra.push('横跨 5A');
          if (awards) extra.push(`🏆 ${awards}`);
          extra.push('双击展开');
          g.push(`<text class="meta" x="${u.x + padX}" y="${u.y + u.h - 11}" opacity=".75">${esc(fit(extra.join(' · '), u.w - padX - R * 2 - 22, 10))}</text>`);
        }
      }

      /* 退役 / 存量维持的技术叠一层斜纹 + 角标，
       * 任何着色维度下都能看见 —— 不用置灰是因为置灰在状态维度里已表示「未建成」 */
      const dead = isTech ? 0 : u.techs.filter(t => t.lifecycle && t.lifecycle !== 'active').length;
      const lc = isTech ? (u.ref.lifecycle || 'active')
        : (dead * 2 < u.techs.length ? 'active'
          : u.techs.some(t => t.lifecycle === 'sunset') ? 'sunset' : 'legacy');
      if (lc !== 'active') {
        g.push(`<path d="${shapePath(u.x, u.y, u.w, u.h, hex)}" fill="url(#hatch)"
          opacity="${isTech ? 1 : .55}" pointer-events="none"/>`);
        if (isTech) g.push(`<text class="badge-txt" x="${u.x + u.w - 8}" y="${u.y + 13}" text-anchor="end"
          fill="${lc === 'sunset' ? '#f87171' : '#94a3b8'}">${lc === 'sunset' ? '退役 ↓' : '存量'}</text>`);
      }

      if (!isTech) {
        const ix = u.x + u.w - 11, iy = u.y + 11;
        g.push(`<circle class="info-dot" cx="${ix}" cy="${iy}" r="8.5"/>`);
        g.push(`<text class="info-i" x="${ix}" y="${iy + 3.6}" text-anchor="middle">i</text>`);
      }

      const cls = ['node', 'k-' + u.kind, 'lc-' + lc];
      if (locked) cls.push('locked');
      nodes.push(`<g class="${cls.join(' ')}" data-id="${esc(u.id)}" data-kind="${u.kind}" style="color:${color}">${g.join('')}</g>`);
    });
    parts.push(`<g class="nodes">${nodes.join('')}</g>`);

    svg.innerHTML = parts.join('');
  }

  return { draw, colorOf, toneFor, fit, esc, shapePath, textWidth };
})();
