/* ==========================================================================
 * 金融科技树 · 界面层：详情抽屉、规划路线图、奖项热力图、导出、演示、维护
 * ========================================================================== */
var TT = (globalThis.TT = globalThis.TT || {});

TT.ui = (function () {
  const $ = s => document.querySelector(s);
  const M = () => TT.model;
  const esc = s => TT.render.esc(s);
  let S, api;

  function init(state, apis) { S = state; api = apis; }

  /* ---------------- 通用 ---------------- */
  function toast(msg, ms) {
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms || 2600);
  }
  function modal(title, sub, bodyHTML, footHTML) {
    closeModal();
    const wrap = document.createElement('div');
    wrap.className = 'modal-mask';
    wrap.innerHTML = `<div class="modal">
      <div class="modal-head">
        <div><h2>${title}</h2>${sub ? `<div class="sub">${sub}</div>` : ''}</div>
        <button class="btn sm ghost" data-close>✕</button>
      </div>
      <div class="modal-body">${bodyHTML}</div>
      ${footHTML ? `<div class="modal-foot">${footHTML}</div>` : ''}
    </div>`;
    wrap.addEventListener('click', e => {
      if (e.target === wrap || e.target.hasAttribute('data-close')) closeModal();
    });
    $('#modals').appendChild(wrap);
    return wrap;
  }
  const closeModal = () => { $('#modals').innerHTML = ''; };

  function download(name, content, mime) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  /* ---------------- 详情抽屉 ---------------- */
  function closeDrawer() { $('#drawer').classList.remove('open'); }

  function openDrawer(id) {
    const m = M();
    const { base, era } = m.splitUnitId(id);
    $('#drawer').classList.add('open');
    if (S.byId.has(base)) return drawTech(S.byId.get(base));
    const cap = m.capById.get(base), dom = m.domById.get(base);
    if (cap) return drawAggregate(cap, 'cap', id, era);
    if (dom) return drawAggregate(dom, 'domain', id, era);
  }

  function archChip(archId) {
    const a = M().archById.get(archId);
    return a ? `<span class="tag" style="border-color:hsl(${a.hue},60%,50%);color:hsl(${a.hue},70%,70%)">${a.code} ${a.name}</span>` : '';
  }

  function drawTech(n) {
    const m = M();
    const era = m.tx.eras.find(e => e.id === n.era);
    const cap = m.capById.get(n.cap), dom = m.domById.get(cap.domain);
    $('#dwTitle').textContent = n.name;
    $('#dwEn').textContent = `${n.en || ''}　·　${n.id}`;
    $('#dwTags').innerHTML = [
      `<span class="tag">${era.roman} ${era.name}</span>`,
      archChip(n._arch),
      `<span class="tag">${dom.name} › ${cap.name}</span>`,
      ...(n.tags || []).map(t => {
        const tg = m.tagById.get(t);
        return `<span class="tag" style="border-color:${tg.color};color:${tg.color}">${tg.name.replace('视图', '')}</span>`;
      }),
      n._custom ? `<span class="tag" style="border-color:#4ade80;color:#4ade80">本单位自建</span>` : ''
    ].filter(Boolean).join('');

    const deps = (n.deps || []).map(d => S.byId.get(d)).filter(Boolean);
    const nexts = S.nodes.filter(x => (x.deps || []).includes(n.id));
    const gate = deps.filter(d => d._arch === 'A5' && n._arch !== 'A5');
    const benchmark = S.orgId === 'benchmark';

    const sections = [];

    sections.push(`<div class="dw-sec"><p>${esc(n.desc)}</p></div>`);

    if (n.pitfall) sections.push(`<div class="dw-sec"><div class="callout">⚠ ${esc(n.pitfall)}</div></div>`);
    const lc = m.tx.lifecycle.find(l => l.id === (n.lifecycle || 'active'));
    if (n.lifecycle && n.lifecycle !== 'active') {
      const rep = (n.supersededBy || []).map(x => S.byId.get(x)).filter(Boolean);
      sections.push(`<div class="dw-sec"><div class="callout" style="border-color:${lc.color};background:${lc.color}14;color:${lc.color}">
        <b>${lc.name}</b> · ${esc(lc.desc)}<br>${esc(n.sunsetNote || '')}
        ${rep.length ? `<div style="margin-top:6px">替代方向：${rep.map(r => `<span class="chip" data-go="${r.id}">${esc(r.name)}</span>`).join(' ')}</div>` : ''}
      </div></div>`);
    }
    if (gate.length) sections.push(`<div class="dw-sec"><div class="callout gate">🔒 合规闸门：本节点受安全架构约束，前置为 ${gate.map(g => esc(g.name)).join('、')}</div></div>`);

    /* 维护模式：编辑基准节点本身（任何视图下都可用，改的是 data/nodes.js 的内容） */
    if (S.maintain) {
      const opt = (list, cur) => list.map(o => `<option value="${o.id}" ${o.id === cur ? 'selected' : ''}>${o.name}</option>`).join('');
      sections.push(`<div class="dw-sec"><h3>基准节点编辑（维护模式）</h3>
        <div class="editrow"><label>名称</label><input id="bName" value="${esc(n.name)}"></div>
        <div class="editrow"><label>英文名</label><input id="bEn" value="${esc(n.en || '')}"></div>
        <div class="editrow"><label>时代</label><select id="bEra">${opt(m.tx.eras.map(e => ({ id: e.id, name: e.roman + ' ' + e.name })), n.era)}</select></div>
        <div class="editrow"><label>所属能力</label><select id="bCap">${opt(m.tx.capabilities.map(c => ({ id: c.id, name: m.domById.get(c.domain).name + ' › ' + c.name })), n.cap)}</select></div>
        <div class="editrow"><label>成熟度</label><select id="bMat">${opt(m.tx.maturity, n.maturity)}</select></div>
        <div class="editrow"><label>普及度</label><select id="bAdo">${opt(m.tx.adoption, n.adoption)}</select></div>
        <div class="editrow"><label>置信度</label><select id="bConf">${opt(m.tx.confidence, n.confidence)}</select></div>
        <div class="editrow"><label>信创</label><select id="bAuto">${opt(m.tx.autonomy, n.autonomy)}</select></div>
        <div class="editrow"><label>人月 / 月</label><input id="bEff" value="${n.effort?.manMonth || 0} / ${n.effort?.months || 0}"></div>
        <div class="editrow"><label>价值 / 风险</label><input id="bVR" value="${n.value} / ${n.risk}"></div>
        <div class="editrow"><label>前置 ID</label><input id="bDeps" value="${(n.deps || []).join(',')}" placeholder="逗号分隔，如 T6013,T9026"></div>
        <div class="editrow"><label>定位</label><textarea id="bDesc">${esc(n.desc || '')}</textarea></div>
        <div class="editrow"><label>常见坑</label><textarea id="bPit">${esc(n.pitfall || '')}</textarea></div>
        <button class="btn sm" id="bSave">应用到基准树</button>
        <button class="btn sm ghost" id="bExport">导出 nodes.js</button>
        <p style="color:var(--text-faint);font-size:11.5px;margin-top:7px">
          改动先落在内存里，导出 nodes.js 覆盖 data/nodes.js 才会持久化。</p></div>`);
    }

    /* 单位状态 / 维护编辑 */
    if (!benchmark) {
      if (S.maintain) {
        sections.push(`<div class="dw-sec"><h3>本单位状态（维护模式）</h3>
          <div class="editrow"><label>状态</label><select id="edStatus">${m.tx.status.map(s => `<option value="${s.id}" ${n._status === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}</select></div>
          <div class="editrow"><label>信创</label><select id="edAuto">${m.tx.autonomy.map(s => `<option value="${s.id}" ${n.autonomy === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}</select></div>
          <div class="editrow"><label>责任部门</label><input id="edOwner" value="${esc(n.owner || '')}"></div>
          <div class="editrow"><label>启动</label><input id="edStart" placeholder="2025-06" value="${esc(n.start || '')}"></div>
          <div class="editrow"><label>目标</label><input id="edTarget" placeholder="2027-12" value="${esc(n.target || '')}"></div>
          <div class="editrow"><label>备注</label><textarea id="edNote">${esc(n.note || '')}</textarea></div>
          <button class="btn sm" id="edSave">保存到本单位档案</button></div>`);
      } else {
        const st = m.statusById.get(n._status || 'unknown');
        sections.push(`<div class="dw-sec"><h3>本单位状态</h3>
          <div class="status-picker">${m.tx.status.map(s =>
            `<button class="chip" data-status="${s.id}" style="${s.id === n._status ? `border-color:${s.color};color:${s.color}` : ''}">${s.name}</button>`).join('')}</div>
          <dl class="kv" style="margin-top:9px">
            ${n.owner ? `<dt>责任部门</dt><dd>${esc(n.owner)}</dd>` : ''}
            ${n.start ? `<dt>启动</dt><dd>${esc(n.start)}</dd>` : ''}
            ${n.target ? `<dt>目标</dt><dd>${esc(n.target)}</dd>` : ''}
          </dl>
          ${n.note ? `<p style="margin-top:7px">${esc(n.note)}</p>` : ''}</div>`);
      }
    }

    /* 行业判断 */
    sections.push(`<div class="dw-sec"><h3>行业判断</h3><dl class="kv">
      <dt>生命周期</dt><dd style="color:${lc.color}">${lc.name}　<span style="color:var(--text-faint)">${lc.desc}</span></dd>
      <dt>技术成熟度</dt><dd>${m.maturityById.get(n.maturity)?.name || '—'}　<span style="color:var(--text-faint)">${m.maturityById.get(n.maturity)?.desc || ''}</span></dd>
      <dt>行业普及度</dt><dd>${m.adoptionById.get(n.adoption)?.name || '—'}</dd>
      <dt>自主可控</dt><dd>${m.autonomyById.get(n.autonomy)?.name || '—'}</dd>
      <dt>业务价值</dt><dd>${'★'.repeat(n.value || 0)}${'☆'.repeat(5 - (n.value || 0))}</dd>
      <dt>实施风险</dt><dd>${'●'.repeat(n.risk || 0)}${'○'.repeat(5 - (n.risk || 0))}</dd>
      <dt>基准投入</dt><dd>${n.effort?.manMonth || '—'} 人月 · 约 ${n.effort?.months || '—'} 个月</dd>
    </dl></div>`);

    if (n.unlocks?.length)
      sections.push(`<div class="dw-sec"><h3>解锁能力</h3><ul class="tight">${n.unlocks.map(u => `<li>${esc(u)}</li>`).join('')}</ul></div>`);

    sections.push(`<div class="dw-sec"><h3>前置技术 ${deps.length}</h3>${deps.length
      ? `<div class="chips">${deps.map(d => `<span class="chip" data-go="${d.id}">${esc(d.name)}</span>`).join('')}</div>`
      : '<p style="color:var(--text-faint)">无前置，是本条线的起点</p>'}</div>`);

    sections.push(`<div class="dw-sec"><h3>后继技术 ${nexts.length}</h3>${nexts.length
      ? `<div class="chips">${nexts.map(d => `<span class="chip" data-go="${d.id}">${esc(d.name)}</span>`).join('')}</div>`
      : '<p style="color:var(--text-faint)">暂无后继节点</p>'}</div>`);

    if (n.stack?.length)
      sections.push(`<div class="dw-sec"><h3>技术选型参考</h3><div class="chips">${n.stack.map(s => `<span class="chip static">${esc(s)}</span>`).join('')}</div></div>`);

    /* 判断依据 —— 明确区分「有证据」与「未经核实」 */
    const conf = m.confidence?.get ? null : M().tx.confidence.find(c => c.id === n.confidence);
    const evRows = (n._awards || []).map(a => `<div class="ev-row">
      <div>🏆 ${esc(a.year)} 年度 ${esc(a.level)} · ${esc(a.org)}</div>
      <div style="color:var(--text-dim)">${esc(a.project)}</div>
      <div class="ev-meta">${esc(a.source || '')}${a.verified ? ` · 核实程度：${a.verified === 'official' ? '官方名单' : a.verified === 'snippet' ? '检索片段（待与官方 PDF 复核）' : '二手归纳（待复核）'}` : ''}
        ${a.url ? ` · <a href="${esc(a.url)}" target="_blank" rel="noopener">来源链接</a>` : ''}</div></div>`).join('');

    sections.push(`<div class="dw-sec"><h3>判断依据</h3><div class="evidence">
      <div class="ev-row"><div>成熟度与普及度判断置信度：<b>${conf?.name || '—'}</b></div>
        <div class="ev-meta">${conf ? esc(conf.desc) : ''}</div></div>
      ${evRows || `<div class="ev-row unverified">暂无关联的金融科技发展奖记录。注意：未获奖不代表机构未建设，本工具不做反向推断。</div>`}
      ${n.confidence === 'low' ? `<div class="ev-row unverified">本节点判断以推断为主，建议结合行内调研与官方名单核实后修正。</div>` : ''}
    </div></div>`);

    $('#dwBody').innerHTML = sections.join('');
    bindDrawerEvents(n);
  }

  function bindDrawerEvents(n) {
    $('#dwBody').querySelectorAll('[data-go]').forEach(c => c.onclick = () => {
      const id = c.dataset.go;
      const t = S.byId.get(id);
      if (t) { S.expanded.add(t._domain); S.expanded.add(t.cap); TT.rebuild(); }
      S.selected = id; openDrawer(id); api.applyHighlight(); api.centerOn(id, true);
    });
    $('#dwBody').querySelectorAll('[data-status]').forEach(b => b.onclick = () => {
      setOverride(n.id, { status: b.dataset.status });
      TT.rebuild(); openDrawer(n.id);
    });
    const bSave = $('#bSave');
    if (bSave) bSave.onclick = () => {
      const raw = TT.nodes.find(x => x.id === n.id);
      if (!raw) return toast('本单位自建节点请在单位档案里维护');
      const [mm, mo] = $('#bEff').value.split('/').map(x => parseInt(x.trim(), 10) || 0);
      const [va, ri] = $('#bVR').value.split('/').map(x => parseInt(x.trim(), 10) || 3);
      const deps = $('#bDeps').value.split(',').map(x => x.trim()).filter(Boolean);
      const missing = deps.filter(d => !TT.nodes.some(x => x.id === d));
      if (missing.length) return toast('这些前置 ID 不存在：' + missing.join('、'));
      if (deps.includes(n.id)) return toast('节点不能依赖自己');
      Object.assign(raw, {
        name: $('#bName').value.trim() || raw.name, en: $('#bEn').value.trim(),
        era: $('#bEra').value, cap: $('#bCap').value,
        maturity: $('#bMat').value, adoption: $('#bAdo').value,
        confidence: $('#bConf').value, autonomy: $('#bAuto').value,
        effort: { manMonth: mm, months: mo },
        value: Math.min(5, Math.max(1, va)), risk: Math.min(5, Math.max(1, ri)),
        deps, desc: $('#bDesc').value.trim(), pitfall: $('#bPit').value.trim() || undefined
      });
      const v = TT.validate();
      TT.rebuild();
      openDrawer(n.id);
      toast(v.errors.length ? `已应用，但数据校验有 ${v.errors.length} 条错误，请点顶栏角标查看` : '已应用到基准树，记得导出 nodes.js');
    };
    const bExport = $('#bExport');
    if (bExport) bExport.onclick = () => nodesExport();

    const save = $('#edSave');
    if (save) save.onclick = () => {
      setOverride(n.id, {
        status: $('#edStatus').value, autonomy: $('#edAuto').value,
        owner: $('#edOwner').value.trim(), start: $('#edStart').value.trim(),
        target: $('#edTarget').value.trim(), note: $('#edNote').value.trim()
      });
      TT.rebuild(); openDrawer(n.id); toast('已保存到内存中的单位档案，记得导出档案文件');
    };
  }

  function setOverride(id, patch) {
    const org = M().orgById(S.orgId);
    if (!org || org.readonly) return toast('世界金融科技基准为只读视图，请先切换到具体单位');
    org.overrides = org.overrides || {};
    const cur = org.overrides[id] || {};
    Object.entries(patch).forEach(([k, v]) => { if (v === '') delete cur[k]; else cur[k] = v; });
    org.overrides[id] = cur;
    org.updatedAt = new Date().toISOString().slice(0, 10);
  }

  /* 聚合节点（领域 / 能力）的抽屉 */
  function drawAggregate(ref, kind, unitId, era) {
    const m = M();
    const eraObj = m.tx.eras.find(e => e.id === era);
    const techs = m.descendants(unitId || ref.id, S.nodes, S.h);
    const allTechs = m.descendants(ref.id, S.nodes, S.h);
    const benchmark = S.orgId === 'benchmark';
    const prog = benchmark ? m.maturityOf(techs) : m.progressOf(techs);
    const arch = kind === 'domain' ? ref.arch : m.archOfCap(ref.id);

    $('#dwTitle').textContent = ref.name;
    $('#dwEn').textContent = `${kind === 'domain' ? 'L0 领域' : 'L1 能力'} · ${ref.id}` +
      (eraObj ? ` · 本时代 ${techs.length} 项 / 全时代共 ${allTechs.length} 项` : ` · 覆盖 ${techs.length} 项技术`);
    $('#dwTags').innerHTML = [
      eraObj ? `<span class="tag">${eraObj.roman} ${eraObj.name}</span>` : '',
      archChip(arch),
      ref.spanArch?.length ? `<span class="tag" style="border-color:var(--accent-2);color:var(--accent-2)">横跨 5A</span>` : ''
    ].filter(Boolean).join('');

    const sec = [];
    if (ref.note) sec.push(`<div class="dw-sec"><div class="callout">${esc(ref.note)}</div></div>`);

    sec.push(`<div class="dw-sec"><h3>${benchmark ? '平均成熟度' : '建设完成度'}</h3>
      <div style="font-size:30px;font-weight:600;line-height:1.2">${Math.round(prog.pct * 100)}%</div>
      <div class="pb-track" style="margin:7px 0 9px"><div class="pb-fill" style="width:${prog.pct * 100}%;background:${TT.render.colorOf({ kind, id: unitId || ref.id, base: ref.id, ref, techs }, S)}"></div></div>
      ${benchmark ? `<p style="color:var(--text-faint);font-size:12px">按行业整体成熟度加权，非某家机构现状</p>`
        : `<dl class="kv">${m.tx.status.map(s => prog.stat[s.id] ? `<dt>${s.name}</dt><dd>${prog.stat[s.id]} 项</dd>` : '').join('')}</dl>`}
      </div>`);

    /* 瓶颈提示：本域内被下游依赖最多但尚未建成的节点 */
    if (!benchmark) {
      const cnt = new Map();
      S.nodes.forEach(x => (x.deps || []).forEach(d => cnt.set(d, (cnt.get(d) || 0) + 1)));
      const blockers = techs.filter(t => t._status !== 'built')
        .sort((a, b) => (cnt.get(b.id) || 0) - (cnt.get(a.id) || 0)).slice(0, 4);
      if (blockers.length) sec.push(`<div class="dw-sec"><h3>关键瓶颈（下游依赖最多且未建成）</h3>
        <div class="chips">${blockers.map(b => `<span class="chip" data-go="${b.id}">${esc(b.name)} · ${cnt.get(b.id) || 0} 个下游</span>`).join('')}</div></div>`);
    }

    if (eraObj) {
      const spread = m.tx.eras.map(e => {
        const cnt = allTechs.filter(t => t.era === e.id).length;
        return cnt ? `<span class="chip static" style="${e.id === era ? 'border-color:var(--accent);color:var(--text)' : ''}">${e.roman} ${cnt} 项</span>` : '';
      }).filter(Boolean).join('');
      sec.push(`<div class="dw-sec"><h3>本${kind === 'domain' ? '领域' : '能力'}在各时代的分布</h3>
        <div class="chips">${spread}</div>
        <p style="color:var(--text-faint);font-size:12px;margin-top:6px">
          聚合视图按「主体 × 时代」切分，同一个${kind === 'domain' ? '领域' : '能力'}会在多个时代列各出现一格。</p></div>`);
    }

    if (kind === 'domain') {
      const caps = m.tx.capabilities.filter(c => c.domain === ref.id);
      sec.push(`<div class="dw-sec"><h3>包含能力 ${caps.length}</h3><div class="chips">${caps.map(c =>
        `<span class="chip" data-open="${c.id}">${esc(c.name)}</span>`).join('')}</div></div>`);
    }

    sec.push(`<div class="dw-sec"><h3>包含技术 ${techs.length}</h3><div class="chips">${techs.map(t =>
      `<span class="chip" data-go="${t.id}">${esc(t.name)}</span>`).join('')}</div></div>`);

    const awards = techs.flatMap(t => t._awards || []);
    if (awards.length) {
      const uniq = [...new Map(awards.map(a => [a.year + a.org + a.project, a])).values()];
      sec.push(`<div class="dw-sec"><h3>关联金融科技发展奖 ${uniq.length}</h3><div class="evidence">${uniq.map(a =>
        `<div class="ev-row"><div>🏆 ${a.year} ${esc(a.level)} · ${esc(a.org)}</div>
         <div style="color:var(--text-dim)">${esc(a.project)}</div></div>`).join('')}</div></div>`);
    }

    /* 由底层技术边聚合出本格的前置与后继，缺了这两栏会让人误以为它没有前置 */
    const inc = new Map(), outg = new Map();
    S.nodes.forEach(n => (n.deps || []).forEach(d => {
      const dn = S.byId.get(d); if (!dn) return;
      const A = m.carrierOf(dn, S.expanded), B = m.carrierOf(n, S.expanded);
      const self = unitId || ref.id;
      if (B === self && A !== self) (inc.get(A) || inc.set(A, []).get(A)).push(`${dn.name} → ${n.name}`);
      if (A === self && B !== self) (outg.get(B) || outg.set(B, []).get(B)).push(`${dn.name} → ${n.name}`);
    }));
    const unitName = uid => {
      const { base, era } = m.splitUnitId(uid);
      const e = m.tx.eras.find(x => x.id === era);
      const r = m.capById.get(base) || m.domById.get(base) || S.byId.get(base);
      return (r ? r.name : uid) + (e ? ` · ${e.roman}` : '');
    };
    const listBox = (map, empty) => map.size
      ? `<div class="chips">${[...map].map(([uid, why]) =>
          `<span class="chip" data-go="${uid}" title="${esc(why.slice(0, 4).join('\n'))}">${esc(unitName(uid))} <b>${why.length}</b></span>`).join('')}</div>`
      : `<p style="color:var(--text-faint)">${empty}</p>`;

    sec.push(`<div class="dw-sec"><h3>前置 ${inc.size}</h3>${listBox(inc, '无前置，是本条线的起点')}
      <p style="color:var(--text-faint);font-size:11.5px;margin-top:6px">数字为底层技术依赖的条数，悬停可看具体是哪几条</p></div>`);
    sec.push(`<div class="dw-sec"><h3>后继 ${outg.size}</h3>${listBox(outg, '暂无后继，该方向不再被依赖')}</div>`);

    sec.push(`<div class="dw-sec"><button class="btn sm" id="dwExpand">在图上展开本${kind === 'domain' ? '领域' : '能力'}</button></div>`);

    $('#dwBody').innerHTML = sec.join('');
    $('#dwBody').querySelectorAll('[data-go]').forEach(c => c.onclick = () => {
      const id = c.dataset.go;
      const t = S.byId.get(M().splitUnitId(id).base);
      if (t) { S.expanded.add(t._domain); S.expanded.add(t.cap); TT.rebuild(); }
      S.selected = id; openDrawer(id); api.applyHighlight(); api.centerOn(id, true);
    });
    $('#dwBody').querySelectorAll('[data-open]').forEach(c => c.onclick = () => {
      S.expanded.add(ref.id); S.expanded.add(c.dataset.open);
      TT.rebuild(); api.centerOn(c.dataset.open, true); openDrawer(c.dataset.open);
    });
    $('#dwExpand').onclick = () => {
      S.expanded.add(ref.id); TT.rebuild(); api.centerOn(ref.id, true);
    };
  }

  /* ---------------- 规划模式：目标选择条 + 路线图 ---------------- */
  function togglePlanBar(on) {
    let bar = $('#planbar');
    if (!on) { bar?.remove(); return; }
    if (bar) return;
    bar = document.createElement('div');
    bar.id = 'planbar';
    bar.style.cssText = 'position:absolute;top:10px;left:50%;transform:translateX(-50%);z-index:14;' +
      'background:var(--panel);border:1px solid var(--accent);border-radius:9px;padding:9px 14px;' +
      'display:flex;gap:11px;align-items:center;backdrop-filter:blur(8px);box-shadow:var(--shadow)';
    bar.innerHTML = `<span style="font-size:12.5px;color:var(--text-dim)">规划模式：点击节点选为目标</span>
      <span id="planCount" style="font-size:12.5px;color:var(--accent);font-weight:600">已选 0 项</span>
      <label style="font-size:12px;color:var(--text-faint)">年产能
        <input id="planCap" class="btn sm" type="number" value="1200" step="100" min="100" style="width:78px;margin-left:4px"> 人月</label>
      <button class="btn sm" id="planGo">生成路线图</button>
      <button class="btn sm ghost" id="planClear">清空</button>`;
    $('#stage').appendChild(bar);
    $('#planGo').onclick = roadmap;
    $('#planClear').onclick = () => { S.planTargets.clear(); updatePlanBar(); TT.rebuild(); };
  }
  function updatePlanBar() {
    const el = $('#planCount');
    if (el) el.textContent = `已选 ${S.planTargets.size} 项`;
  }

  function roadmap() {
    const m = M();
    if (!S.planTargets.size) return toast('请先在图上点选至少一个目标技术');
    const isBuilt = n => S.orgId !== 'benchmark' && n._status === 'built';
    const need = m.planClosure([...S.planTargets], S.byId, isBuilt);
    const cap = Math.max(100, +$('#planCap').value || 1200);
    const startYear = new Date().getFullYear();
    const plan = m.schedule(need, S.byId, cap, startYear, isBuilt);

    const totalMM = [...need].reduce((s, id) => s + (S.byId.get(id).effort?.manMonth || 0), 0);
    const years = plan.map(p => p.year);
    const maxE = Math.max(...plan.map(p => p.effort), 1);

    const rows = plan.map((p, pi) => {
      const items = p.ids.map(id => {
        const n = S.byId.get(id);
        const color = TT.render.colorOf({ kind: 'tech', id, ref: n, techs: [n] }, S);
        const isTarget = S.planTargets.has(id);
        const w = Math.max(8, (n.effort?.manMonth || 0) / cap * 100);
        return `<div class="gantt-row">
          <div class="gantt-name" title="${esc(n.name)}">${isTarget ? '🎯 ' : ''}${esc(n.name)}
            <span style="color:var(--text-faint)">· ${m.archById.get(n._arch)?.code}</span></div>
          <div class="gantt-track"><div class="gantt-bar" style="left:0;width:${Math.min(100, w)}%;background:${color}">
            ${n.effort?.manMonth || 0} 人月</div></div></div>`;
      }).join('');
      return `<div class="phase-head"><div class="phase-title">第 ${pi + 1} 阶段 · ${p.year} 年</div>
        <div style="font-size:11.5px;color:var(--text-faint)">${p.ids.length} 项 · 合计 ${p.effort} 人月（产能 ${cap}）</div></div>${items}`;
    }).join('');

    const curve = plan.map(p => `<div style="flex:1;text-align:center">
        <div style="height:${(p.effort / maxE * 80).toFixed(0)}px;background:linear-gradient(to top,var(--accent),transparent);
          margin:0 5px;border-radius:3px 3px 0 0"></div>
        <div style="font-size:11px;color:var(--text-faint);margin-top:4px">${p.year}</div>
        <div style="font-size:11px;color:var(--text-dim)">${p.effort}</div></div>`).join('');

    const targets = [...S.planTargets].map(id => esc(S.byId.get(id)?.name || id)).join('、');
    modal('规划路线图',
      `目标：${targets}　·　最小依赖闭包 ${need.size} 项　·　总投入约 ${totalMM} 人月　·　跨 ${plan.length} 年`,
      `<div style="display:flex;align-items:flex-end;height:120px;margin-bottom:18px;
          border-bottom:1px solid var(--border);padding-bottom:6px">${curve}</div>${rows}`,
      `<button class="btn" id="rmMd">导出 Markdown</button>
       <button class="btn" id="rmHi">在图上高亮路线</button>
       <button class="btn" data-close>关闭</button>`);

    $('#rmMd').onclick = () => {
      const lines = [`# 技术路线图`, ``,
        `- 生成时间：${new Date().toISOString().slice(0, 10)}`,
        `- 视角单位：${m.orgById(S.orgId)?.orgName}`,
        `- 规划目标：${[...S.planTargets].map(id => S.byId.get(id)?.name).join('、')}`,
        `- 最小依赖闭包：${need.size} 项技术`,
        `- 总投入估算：约 ${totalMM} 人月`,
        `- 年度产能约束：${cap} 人月`, ``];
      plan.forEach((p, i) => {
        lines.push(`## 第 ${i + 1} 阶段 · ${p.year} 年（${p.ids.length} 项 · ${p.effort} 人月）`, '');
        lines.push('| 技术 | 架构线 | 时代 | 投入(人月) | 周期(月) | 价值 | 风险 |');
        lines.push('|---|---|---|---|---|---|---|');
        p.ids.forEach(id => {
          const n = S.byId.get(id);
          lines.push(`| ${S.planTargets.has(id) ? '🎯 ' : ''}${n.name} | ${m.archById.get(n._arch)?.code} ${m.archById.get(n._arch)?.name} | ${n.era} | ${n.effort?.manMonth || ''} | ${n.effort?.months || ''} | ${n.value} | ${n.risk} |`);
        });
        lines.push('');
      });
      lines.push('---', '', '> 投入估算为行业基准参考值，需结合本单位实际人力与外包策略调整。');
      download('技术路线图.md', lines.join('\n'), 'text/markdown;charset=utf-8');
    };
    $('#rmHi').onclick = () => {
      closeModal();
      const svg = $('#canvas');
      svg.querySelectorAll('.node').forEach(g => {
        const ids = g.dataset.kind === 'tech' ? [g.dataset.id]
          : m.descendants(g.dataset.id, S.nodes, S.h).map(t => t.id);
        g.classList.toggle('faded', !ids.some(i => need.has(i)));
      });
      svg.querySelectorAll('.edge').forEach(e => e.classList.add('faded'));
      toast(`已高亮 ${need.size} 项路线节点，点击空白处恢复`);
    };
  }

  /* ---------------- 奖项热力图 ---------------- */
  function awardHeatmap() {
    const m = M();
    const years = [...new Set((TT.awards || []).map(a => a.year))].sort();
    const doms = m.tx.domains;
    const grid = new Map();
    (TT.awards || []).forEach(a => (a.mappedNodes || []).forEach(id => {
      const n = TT.nodes.find(x => x.id === id); if (!n) return;
      const d = m.domainOfCap(n.cap);
      const k = a.year + '|' + d;
      grid.set(k, (grid.get(k) || 0) + 1);
    }));
    const max = Math.max(1, ...grid.values());

    const head = `<div class="heat-grid" style="grid-template-columns:180px repeat(${years.length},1fr)">
      <div></div>${years.map(y => `<div class="heat-head">${y}</div>`).join('')}
      ${doms.map(d => `<div class="heat-label">${m.archById.get(d.arch)?.code} ${d.name}</div>` +
        years.map(y => {
          const v = grid.get(y + '|' + d.id) || 0;
          const a = v / max;
          return `<div class="heat-cell" style="background:rgba(245,196,81,${(a * .82 + (v ? .1 : .02)).toFixed(2)})"
            title="${d.name} · ${y} 年 · ${v} 个关联获奖项目">${v || ''}</div>`;
        }).join('')).join('')}
    </div>`;

    const stats = (TT.awardStats || []).map(s => `<tr>
      <td>${s.year}</td><td class="num">${s.total ?? '—'}</td>
      <td>${s.levels ? Object.entries(s.levels).map(([k, v]) => `${k} ${v}`).join(' · ') : '—'}</td>
      <td style="font-size:11.5px;color:var(--text-faint)">${esc(s.note || '')}</td></tr>`).join('');

    modal('金融科技发展奖 · 领域热力图',
      '中国人民银行金融科技发展奖是金融业唯一部级科技类奖项，可作为行业成熟度的客观佐证',
      `${head}
       <p style="margin:18px 0 8px;color:var(--text-faint);font-size:12px">
         格子数字为该领域在当年关联到的获奖项目数（基于本工具已录入的条目，非官方完整统计）。</p>
       <h3 style="font-size:12px;color:var(--text-faint);letter-spacing:1.4px;margin:18px 0 7px">历年评奖总体情况</h3>
       <table class="grid"><thead><tr><th>年度</th><th class="num">获奖总数</th><th>等级分布</th><th>说明</th></tr></thead>
       <tbody>${stats}</tbody></table>
       <div class="callout" style="margin-top:16px">
         获奖代表该机构在此方向具备一定成熟度；<b>未获奖不代表该机构没有建设</b>。
         本工具只把奖项当作加分证据，不做反向推断。<br>
         当前已录入 ${(TT.awards || []).length} 条项目条目，多数标注为「待与官方 PDF 复核」，
         完整名单请从人民银行官网公示补全（见 docs/奖项数据导入指南.md）。
       </div>`,
      `<button class="btn" id="awCsv">导出奖项 CSV 模板</button><button class="btn" data-close>关闭</button>`);

    $('#awCsv').onclick = () => {
      const rows = [['year', 'level', 'org', 'project', 'mappedNodes', 'source', 'url', 'verified']];
      (TT.awards || []).forEach(a => rows.push([a.year, a.level, a.org, a.project,
        (a.mappedNodes || []).join('|'), a.source || '', a.url || '', a.verified || '']));
      download('金融科技发展奖_导入模板.csv', '﻿' + rows.map(r =>
        r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv;charset=utf-8');
    };
  }

  /* ---------------- 导出 ---------------- */
  function exportMenu(anchor) {
    const r = anchor.getBoundingClientRect();
    const old = $('#expMenu'); if (old) { old.remove(); return; }
    const menu = document.createElement('div');
    menu.id = 'expMenu';
    menu.style.cssText = `position:fixed;top:${r.bottom + 6}px;left:${Math.max(8, r.left - 90)}px;z-index:70;
      background:var(--panel-solid);border:1px solid var(--border-strong);border-radius:8px;
      padding:5px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:2px;min-width:210px`;
    const items = [
      ['当前视图 PNG 图片', pngExport],
      ['本单位档案 JSON', orgExport],
      ['节点清单 CSV（Excel 可开）', csvExport],
      ['节点数据文件 nodes.js', nodesExport],
      ['科技树全量说明 Markdown', mdExport]
    ];
    items.forEach(([label, fn]) => {
      const b = document.createElement('button');
      b.className = 'btn ghost'; b.textContent = label;
      b.style.textAlign = 'left';
      b.onclick = () => { menu.remove(); fn(); };
      menu.appendChild(b);
    });
    document.body.appendChild(menu);
    setTimeout(() => document.addEventListener('click', function h(e) {
      if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', h); }
    }), 0);
  }

  function pngExport() {
    const svg = $('#canvas').cloneNode(true);
    const L = S.L;
    svg.setAttribute('viewBox', `0 0 ${L.width} ${L.height}`);
    svg.setAttribute('width', L.width); svg.setAttribute('height', L.height);
    svg.querySelector('.viewport')?.setAttribute('transform', '');
    const css = document.querySelector('link[href*="styles.css"]');
    /* 把当前主题的计算色写死进去，保证导出图不依赖外部 CSS */
    const cs = getComputedStyle(document.documentElement);
    const vars = ['--text', '--text-dim', '--text-faint', '--accent', '--accent-2', '--gold',
      '--edge', '--edge-locked', '--grid', '--bg-0', '--lane-a5'];
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = `
      text{font-family:${cs.fontFamily || 'sans-serif'}}
      .lane-label{fill:${cs.getPropertyValue('--text-faint')};font-size:12px;font-weight:600;letter-spacing:2px;text-anchor:middle}
      .lane-label .code{fill:${cs.getPropertyValue('--accent')}}
      .lane-line,.era-line{stroke:${cs.getPropertyValue('--grid')};stroke-width:1}
      .lane-bg{fill:transparent}.lane-bg.band{fill:${cs.getPropertyValue('--lane-a5')}}
      .era-band{fill:${cs.getPropertyValue('--era-band')}}
      .era-title{fill:${cs.getPropertyValue('--text-faint')};font-size:12px;font-weight:600;text-anchor:middle}
      .era-roman{fill:${cs.getPropertyValue('--accent')};font-size:17px;font-weight:700;text-anchor:middle;opacity:.55}
      .era-period{fill:${cs.getPropertyValue('--text-faint')};font-size:10px;text-anchor:middle;opacity:.7}
      .edge{fill:none;stroke:${cs.getPropertyValue('--edge')};stroke-linecap:round}
      .edge.locked{stroke:${cs.getPropertyValue('--edge-locked')};stroke-dasharray:4 5}
      .edge.gate{stroke:rgba(230,90,90,.5);stroke-dasharray:6 4}
      .node .title{fill:${cs.getPropertyValue('--text')};font-size:12.5px;font-weight:500}
      .node .meta{fill:${cs.getPropertyValue('--text-faint')};font-size:10px}
      .node .cnt{fill:${cs.getPropertyValue('--text-dim')};font-size:10.5px}
      .node.locked .shape{opacity:.42}.node.locked .title{fill:${cs.getPropertyValue('--text-faint')}}
      .node .shape{stroke-width:1.4}
      .ring-bg{fill:none;stroke:${cs.getPropertyValue('--ring-bg')};stroke-width:3}
      .ring-fg{fill:none;stroke-width:3;stroke-linecap:round}
      .spanband{fill:${cs.getPropertyValue('--accent-2')};opacity:.05}
      .building-ring{fill:none;stroke:#fbbf24;stroke-width:1.6;stroke-dasharray:7 4}
      .pulse{opacity:.7}`;
    svg.insertBefore(style, svg.firstChild);
    const bgr = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgr.setAttribute('width', L.width); bgr.setAttribute('height', L.height);
    bgr.setAttribute('fill', cs.getPropertyValue('--bg-0').trim() || '#05070f');
    svg.insertBefore(bgr, style.nextSibling);

    const data = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    const scale = Math.min(2, 4000 / L.width);
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = L.width * scale; c.height = L.height * scale;
      const ctx = c.getContext('2d');
      ctx.fillStyle = cs.getPropertyValue('--bg-0').trim() || '#05070f';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => download('金融科技树.png', b), 'image/png');
    };
    img.onerror = () => toast('图片导出失败，可改用系统截图');
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(data);
    toast('正在生成 PNG…');
  }

  function orgExport() {
    const org = M().orgById(S.orgId);
    if (!org || org.readonly) return toast('世界金融科技基准为只读视图，无档案可导出');
    const body = JSON.stringify({
      orgId: org.orgId, orgName: org.orgName, orgType: org.orgType || '',
      updatedAt: new Date().toISOString().slice(0, 10),
      editors: org.editors || [], brandColor: org.brandColor || '',
      overrides: org.overrides || {}, customNodes: org.customNodes || []
    }, null, 2);
    const js = `/* 单位档案 · ${org.orgName} · 导出于 ${new Date().toLocaleString('zh-CN')}
 * 用法：覆盖 data/orgs/${org.orgId}.js 即可生效。 */
var TT = (globalThis.TT = globalThis.TT || {});
TT.orgs = TT.orgs || [];
TT.orgs.push(${body});
`;
    download(`${org.orgId}.js`, js, 'text/javascript;charset=utf-8');
    toast(`已导出，覆盖 data/orgs/${org.orgId}.js 即可`);
  }

  function csvExport() {
    const m = M();
    const head = ['id', 'name', 'en', 'domain', 'capability', 'arch', 'era', 'deps',
      'maturity', 'adoption', 'confidence', 'autonomy', 'tags',
      'manMonth', 'months', 'value', 'risk', 'status', 'owner', 'target', 'note', 'desc'];
    const rows = [head];
    S.nodes.forEach(n => {
      const cap = m.capById.get(n.cap), dom = m.domById.get(cap?.domain);
      rows.push([n.id, n.name, n.en || '', dom?.name || '', cap?.name || '',
        m.archById.get(n._arch)?.code || '', n.era, (n.deps || []).join('|'),
        n.maturity, n.adoption, n.confidence, n.autonomy, (n.tags || []).join('|'),
        n.effort?.manMonth ?? '', n.effort?.months ?? '', n.value, n.risk,
        S.orgId === 'benchmark' ? '' : (n._status || ''), n.owner || '', n.target || '',
        (n.note || '').replace(/\n/g, ' '), n.desc]);
    });
    download('金融科技树_节点清单.csv', '﻿' + rows.map(r =>
      r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'),
      'text/csv;charset=utf-8');
  }

  /* 把内存中的节点重新序列化为 data/nodes.js，供维护模式改完后落盘 */
  function nodesExport() {
    const q = s => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ')}'`;
    const arr = q => '[' + q.join(', ') + ']';
    const body = TT.nodes.map(n => {
      const L = [];
      L.push(`  { id:${q(n.id)}, name:${q(n.name)}, en:${q(n.en || '')}, cap:${q(n.cap)}, era:${q(n.era)}, deps:${arr((n.deps || []).map(q))},`);
      L.push(`    maturity:${q(n.maturity)}, adoption:${q(n.adoption)}, confidence:${q(n.confidence)}, autonomy:${q(n.autonomy)}, tags:${arr((n.tags || []).map(q))},`);
      L.push(`    effort:{manMonth:${n.effort?.manMonth || 0},months:${n.effort?.months || 0}}, value:${n.value}, risk:${n.risk},`);
      L.push(`    desc:${q(n.desc)},`);
      if (n.unlocks?.length) L.push(`    unlocks:${arr(n.unlocks.map(q))},`);
      if (n.stack?.length) L.push(`    stack:${arr(n.stack.map(q))}${n.pitfall ? ',' : ' }'}`);
      if (n.pitfall) L.push(`    pitfall:${q(n.pitfall)} }`);
      else if (!n.stack?.length) L[L.length - 1] = L[L.length - 1].replace(/,$/, ' }');
      return L.join('\n');
    }).join(',\n\n');
    const out = `/* 金融科技树 · 技术节点字典（由页面维护模式导出于 ${new Date().toLocaleString('zh-CN')}）
 * 覆盖 data/nodes.js 即可生效。字段说明见 docs/维护手册.md。 */
var TT = (globalThis.TT = globalThis.TT || {});

TT.nodes = [

${body}

];
`;
    download('nodes.js', out, 'text/javascript;charset=utf-8');
    toast('已导出 nodes.js，覆盖 data/nodes.js 即可');
  }

  function mdExport() {
    const m = M();
    const L = ['# 金融科技树 · 节点释义', '',
      `生成时间：${new Date().toISOString().slice(0, 10)}　视角：${m.orgById(S.orgId)?.orgName}`, ''];
    m.tx.domains.forEach(d => {
      L.push(`## ${m.archById.get(d.arch)?.code} ${d.name}`, '');
      m.tx.capabilities.filter(c => c.domain === d.id).forEach(c => {
        L.push(`### ${c.name}`, '');
        S.nodes.filter(n => n.cap === c.id)
          .sort((a, b) => m.eraIdx.get(a.era) - m.eraIdx.get(b.era))
          .forEach(n => {
            L.push(`**${n.name}**（${n.id} · ${n.era} · ${m.maturityById.get(n.maturity)?.name}）`);
            L.push('');
            L.push(n.desc);
            if (n.deps?.length) L.push(`- 前置：${n.deps.map(x => S.byId.get(x)?.name || x).join('、')}`);
            if (n.unlocks?.length) L.push(`- 解锁：${n.unlocks.join('；')}`);
            if (n.pitfall) L.push(`- ⚠ ${n.pitfall}`);
            L.push('');
          });
      });
    });
    download('金融科技树_节点释义.md', L.join('\n'), 'text/markdown;charset=utf-8');
  }

  /* ---------------- 校验问题 ---------------- */
  function showIssues(v) {
    modal('数据校验结果', `错误 ${v.errors.length} 条 · 警告 ${v.warns.length} 条`,
      `${v.errors.length ? `<h3 style="color:#f87171;font-size:13px">错误（会影响图的正确性，必须修）</h3>
        <ul class="tight">${v.errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
       ${v.warns.length ? `<h3 style="color:#fbbf24;font-size:13px;margin-top:14px">警告（不影响运行，确认是否符合预期）</h3>
        <ul class="tight">${v.warns.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
       ${!v.errors.length && !v.warns.length ? '<p>数据完全正常。</p>' : ''}
       <div class="callout" style="margin-top:16px">同样的校验也可以在命令行跑：<code>node tools/validate.mjs</code></div>`,
      `<button class="btn" data-close>关闭</button>`);
  }

  /* ---------------- 帮助 ---------------- */
  function help() {
    modal('使用说明', '金融科技树 · 5A 企业级架构视角',
      `<div style="display:grid;grid-template-columns:1fr 1fr;gap:22px">
      <div>
        <h3 style="font-size:12px;color:var(--text-faint);letter-spacing:1.4px">三层颗粒度</h3>
        <ul class="tight">
          <li><b>领域</b>（12 个）给行领导看，一屏看全貌</li>
          <li><b>能力</b>（35 个）给科技条线领导与规划部门看</li>
          <li><b>技术</b>（151 个）给架构师与项目经理看</li>
          <li>依赖只在技术层定义一次，上两层的连线与进度<b>全部自动推导</b>，不会出现改了细节汇报图没同步的情况</li>
        </ul>
        <h3 style="font-size:12px;color:var(--text-faint);letter-spacing:1.4px;margin-top:14px">操作</h3>
        <ul class="tight">
          <li>滚轮缩放 / 拖拽平移 / <b>双击大节点原地展开</b></li>
          <li>悬停节点：上游祖先链亮金色，下游后继链亮青色</li>
          <li>点击节点看详情，Esc 逐级收起</li>
          <li>Ctrl/⌘+F 定位技术</li>
        </ul>
      </div>
      <div>
        <h3 style="font-size:12px;color:var(--text-faint);letter-spacing:1.4px">5A 与安全架构</h3>
        <ul class="tight">
          <li>四条泳道自上而下：业务 → 应用 → 数据 → 技术</li>
          <li><b>A5 安全架构</b>是横切关注点，做成底部贯穿带；它指向其他线的依赖画成<span style="color:#e05a5a">红色虚线</span>，表示合规闸门而非能力前置</li>
          <li><b>人工智能</b>不单列泳道（它横跨全部 5A），而是打 <code>ai</code> 标签；顶栏「专题」切到 AI 视图即可抽取为独立的 AI 技术树</li>
        </ul>
        <h3 style="font-size:12px;color:var(--text-faint);letter-spacing:1.4px;margin-top:14px">规划与证据</h3>
        <ul class="tight">
          <li><b>规划模式</b>：点选目标技术 → 自动反推最小依赖闭包 → 按年产能装箱分阶段 → 导出 Markdown</li>
          <li><b>奖项热力</b>：以人民银行金融科技发展奖作为行业成熟度的可核查佐证</li>
          <li>详情面板底部固定有「判断依据」区，明确区分有证据与未经核实的判断</li>
        </ul>
      </div></div>
      <div class="callout" style="margin-top:18px">
        默认视图是<b>世界金融科技基准</b>，反映行业整体成熟度，不代表任何一家机构的现状。
        切换到具体单位后才会显示建设状态。新增单位见 <code>docs/维护手册.md</code>。
      </div>`,
      `<button class="btn" data-close>知道了</button>`);
  }

  /* ---------------- 演示模式 ---------------- */
  function startPresent() {
    S.presenting = true; S.presentEra = 0;
    document.body.classList.add('presenting');
    S.expanded.clear(); S.level = 'domain';
    TT.rebuild(); api.fit();
    renderPresent();
    $('#pPrev').onclick = () => presentStep(-1);
    $('#pNext').onclick = () => presentStep(1);
    $('#pExit').onclick = exitPresent;
  }
  function exitPresent() {
    S.presenting = false;
    document.body.classList.remove('presenting');
    $('#canvas').querySelectorAll('.node,.edge').forEach(e => e.classList.remove('faded'));
    TT.rebuild();
  }
  function presentStep(d) {
    S.presentEra = Math.max(0, Math.min(M().tx.eras.length - 1, S.presentEra + d));
    renderPresent();
  }
  function renderPresent() {
    const m = M(), eras = m.tx.eras, i = S.presentEra, era = eras[i];
    const upto = new Set(eras.slice(0, i + 1).map(e => e.id));
    $('#canvas').querySelectorAll('.node').forEach(g => {
      const u = S.units.find(x => x.id === g.dataset.id);
      g.classList.toggle('faded', !(u && upto.has(u.era)));
      g.classList.toggle('hi', !!(u && u.era === era.id));
    });
    $('#canvas').querySelectorAll('.edge').forEach(e => e.classList.remove('faded'));
    /* 镜头推到当前时代那一列，让讲述有节奏 */
    const col = S.L?.cols.find(c => c.era.id === era.id);
    if (col) api.panToX(col.x + col.w / 2);

    const newTechs = S.nodes.filter(n => n.era === era.id);
    const byDom = {};
    newTechs.forEach(n => { const d = m.domById.get(n._domain).name; (byDom[d] = byDom[d] || []).push(n.name); });
    const top = Object.entries(byDom).sort((a, b) => b[1].length - a[1].length).slice(0, 5);

    $('#pDots').innerHTML = eras.map((e, k) => `<span class="p-dot ${k <= i ? 'on' : ''}"></span>`).join('');
    $('#pTitle').innerHTML = `<span class="roman">${era.roman}</span>${era.name}`;
    $('#pSub').textContent = `${era.period}　·　${era.theme}　·　本时代新增 ${newTechs.length} 项技术`;
    $('#pBody').innerHTML = top.map(([d, list]) =>
      `<div style="margin:3px 0"><b style="color:var(--text)">${esc(d)}</b>　${esc(list.slice(0, 6).join('、'))}${list.length > 6 ? ` 等 ${list.length} 项` : ''}</div>`).join('');
  }

  return {
    init, toast, modal, closeModal, openDrawer, closeDrawer, exportMenu,
    togglePlanBar, updatePlanBar, awardHeatmap, showIssues, help,
    startPresent, exitPresent, presentStep, download
  };
})();
