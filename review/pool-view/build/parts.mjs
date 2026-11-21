// LOOK51 proposal-only parts. Each says which shared part (packages/ui) it would become.
// Everything else is real ds-* markup from the shared UI package. Colours and sizes come from design tokens only.
import { T0, SPAN, NOW, hm, M, machines, jobs, J, runs, usage, usedNow, REASONS } from './model.mjs';

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const GL = { ok: '✓', waiting: '◷', failed: '✕', info: 'ⓘ', running: '▶', off: '○' };

export const CSS = `
/* LOOK51 proposal-only styles. Tokens only. */
.pv-note{color:var(--ds-color-text-muted);margin:0}
.pv-grid{display:grid;gap:var(--ds-space-4);grid-template-columns:repeat(auto-fit,minmax(min(100%,17rem),1fr))}
.pv-grid.two{grid-template-columns:repeat(auto-fit,minmax(min(100%,26rem),1fr))}
.pv-cols{display:grid;gap:var(--ds-space-4);grid-template-columns:minmax(0,1fr)}
@media (min-width:900px){.pv-cols.l3{grid-template-columns:15rem minmax(0,1fr)}.pv-cols.r3{grid-template-columns:minmax(0,1fr) 27rem}}
.pv-stack{display:grid;gap:var(--ds-space-3)}
.pv-row{display:flex;flex-wrap:wrap;gap:var(--ds-space-3);align-items:center;justify-content:space-between}
.pv-tags{display:flex;flex-wrap:wrap;gap:var(--ds-space-2)}
.pv-kpi{display:grid;gap:var(--ds-space-1)}.pv-kpi b{font-size:1.8rem;line-height:1}
.pv-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(8rem,1fr));gap:var(--ds-space-3)}
.pv-kpis>div{border:var(--ds-border-thin) solid var(--ds-color-border);padding:var(--ds-space-3);display:grid;gap:var(--ds-space-1)}
.pv-kpis>div[data-t=wait]{border-color:var(--ds-color-needs-you)}.pv-kpis>div[data-t=bad]{border-color:var(--ds-color-problem)}
.pv-btnrow{display:flex;flex-wrap:wrap;gap:var(--ds-space-3)}
.pv-btnrow .ds-button{min-block-size:44px}
.pv-mono{font-family:var(--ds-font-mono,monospace)}
/* --- Gantt: would become shared part TimelineChart (UX-41) --- */
.pv-g{display:grid;gap:0}
.pv-g-axis,.pv-g-row{display:grid;grid-template-columns:11.5rem minmax(0,1fr);gap:var(--ds-space-3);align-items:center}
.pv-g-row{padding-block:var(--ds-space-1);border-block-start:var(--ds-border-thin) solid var(--ds-color-divider)}
.pv-g-name{display:grid;gap:2px;min-inline-size:0}.pv-g-name b{overflow-wrap:anywhere}
.pv-g-track{position:relative;block-size:1.7rem;background:linear-gradient(to right,var(--ds-color-divider) 1px,transparent 1px) 0 0/calc(100%/6) 100%}
.pv-g-ticks{position:relative;block-size:1.4rem}.pv-g-ticks span{position:absolute;transform:translateX(-50%);font-size:.8rem;color:var(--ds-color-text-muted)}
.pv-g-ticks span:first-child{transform:none}
.pv-b{position:absolute;inset-block:3px;box-sizing:border-box;border:2px solid transparent;display:flex;align-items:center;padding-inline:3px;font-size:.75rem;overflow:hidden;white-space:nowrap}
.pv-b.run{color:var(--ds-color-on-primary);font-weight:700}
.pv-b.m1{background:var(--ds-color-primary);border-color:var(--ds-color-primary)}
.pv-b.m2{background:var(--ds-color-note);border-color:var(--ds-color-note);color:var(--ds-color-on-note)}
.pv-b.m3{background:var(--ds-color-text);border-color:var(--ds-color-text);color:var(--ds-color-page)}
.pv-b.m2.run{background-image:repeating-linear-gradient(135deg,transparent 0 5px,rgba(255,255,255,.25) 5px 8px)}
.pv-b.m3.run{background-image:radial-gradient(rgba(255,255,255,.35) 1.5px,transparent 1.6px);background-size:6px 6px}
.pv-b.fc{background:transparent!important;background-image:none!important;border-style:dashed;color:var(--ds-color-text)}
.pv-b.fc.m1{border-color:var(--ds-color-primary)}.pv-b.fc.m2{border-color:var(--ds-color-note)}.pv-b.fc.m3{border-color:var(--ds-color-text)}
.pv-b.wr{border-style:dashed;border-color:var(--ds-color-text-inactive);background:transparent}
.pv-b.wm{border-style:dashed;border-color:var(--ds-color-needs-you);background:var(--ds-color-needs-you-tint)}
.pv-b.nr{border-style:dashed;border-color:var(--ds-color-problem);background:var(--ds-color-problem-tint);color:var(--ds-color-on-problem-tint)}
.pv-b.gr{background:var(--ds-color-problem);border-color:var(--ds-color-problem)}
.pv-now{position:absolute;inset-block:-3px;inline-size:0;border-inline-start:2px solid var(--ds-color-text);z-index:2}
.pv-tick{position:absolute;inset-block:-3px;inline-size:0;border-inline-start:3px solid var(--ds-color-needs-you);z-index:1}
.pv-legend{display:flex;flex-wrap:wrap;gap:var(--ds-space-3) var(--ds-space-4);margin-block-start:var(--ds-space-3);color:var(--ds-color-text-muted);font-size:.9rem}
.pv-legend span{display:inline-flex;align-items:center;gap:var(--ds-space-2)}
.pv-sw.pv-b{position:static;inset:auto;display:inline-block;inline-size:1.6rem;block-size:.9rem;padding:0}
.pv-b.nr{overflow:visible;color:var(--ds-color-problem)}
.pv-g-ticks span:last-child{transform:translateX(-100%)}
.pv-sw{display:inline-block;inline-size:1.6rem;block-size:.9rem;box-sizing:border-box;border:2px solid transparent}
@media (max-width:700px){.pv-g-axis,.pv-g-row{grid-template-columns:minmax(0,1fr);gap:2px}.pv-g-axis>div:first-child{display:none}.pv-g-ticks span:nth-child(even){display:none}.pv-g-name{grid-auto-flow:column;justify-content:space-between;align-items:baseline}}
.pv-g.compact .pv-g-axis,.pv-g.compact .pv-g-row{grid-template-columns:minmax(0,1fr)}.pv-g.compact .pv-g-axis>div:first-child,.pv-g.compact .pv-g-name{display:none}.pv-g.compact .pv-g-ticks span:nth-child(even){display:none}
/* --- charts: would become shared part StepChart / LineChart (UX-41) --- */
.pv-svg{display:block;inline-size:100%;max-inline-size:34rem;block-size:auto}
.pv-svg text{fill:var(--ds-color-text-muted);font-family:var(--ds-font-body);font-size:11px}
.pv-svg .lbl{fill:var(--ds-color-text);font-weight:700}
.pv-svg .ax{stroke:var(--ds-color-divider);stroke-width:1}
.pv-svg .pool{stroke:var(--ds-color-text);stroke-width:1.5;stroke-dasharray:5 4;fill:none}
.pv-svg .need{stroke:var(--ds-color-needs-you);stroke-width:2;stroke-dasharray:6 4;fill:none}
.pv-svg .s1{stroke:var(--ds-color-primary);stroke-width:2.5;fill:var(--ds-color-selection)}
.pv-svg .s2{stroke:var(--ds-color-note);stroke-width:2.5;fill:var(--ds-color-note-tint)}
.pv-svg .fcast{fill:var(--ds-color-divider);opacity:.45}
.pv-svg .nowl{stroke:var(--ds-color-text);stroke-width:1.5}
.pv-svg .bad{stroke:var(--ds-color-problem);stroke-width:2.5;fill:none}
.pv-svg .good{stroke:var(--ds-color-primary);stroke-width:2.5;fill:none}
.pv-svg .dot{fill:var(--ds-color-primary)}.pv-svg .dotb{fill:var(--ds-color-problem)}
/* --- misc --- */
.pv-timer{display:grid;gap:var(--ds-space-1)}
.pv-grace{border:2px solid var(--ds-color-problem);padding:var(--ds-space-3);display:grid;gap:var(--ds-space-3)}
.pv-sheet{border:2px solid var(--ds-color-primary);box-shadow:var(--ds-shadow-3);background:var(--ds-color-surface);padding:var(--ds-space-4);display:grid;gap:var(--ds-space-4)}
.pv-sheet-h{display:flex;justify-content:space-between;gap:var(--ds-space-3);align-items:start}
@media (max-width:700px){.pv-sheet.side{position:relative}}
.pv-nav{display:grid;gap:var(--ds-space-1);list-style:none;margin:0;padding:0}
.pv-nav a{display:block;padding:var(--ds-space-2) var(--ds-space-3);min-block-size:44px;box-sizing:border-box;display:flex;align-items:center;gap:var(--ds-space-2);text-decoration:none;border-inline-start:3px solid transparent}
.pv-nav a[aria-current]{border-inline-color:var(--ds-color-primary);background:var(--ds-color-selection);font-weight:700}
.pv-flow{display:flex;flex-wrap:wrap;gap:var(--ds-space-2);align-items:stretch;list-style:none;margin:0;padding:0}
.pv-flow li{border:var(--ds-border-thin) solid var(--ds-color-border);padding:var(--ds-space-2) var(--ds-space-3);display:grid;gap:2px;flex:1 1 9rem}
.pv-flow li[data-on]{border-color:var(--ds-color-primary);background:var(--ds-color-selection)}
.pv-flow li[data-bad]{border-color:var(--ds-color-problem)}
.pv-num{display:inline-grid;place-items:center;inline-size:1.6rem;block-size:1.6rem;border-radius:var(--ds-radius-round);background:var(--ds-color-primary);color:var(--ds-color-on-primary);font-weight:700;font-size:.9rem;flex:none}
.pv-ask{margin-block-start:var(--ds-space-2)}
.pv-code{font-family:var(--ds-font-mono,monospace);overflow-wrap:anywhere}
.pv-rank{display:grid;gap:var(--ds-space-2)}
.pv-rank>div{display:grid;grid-template-columns:2rem minmax(0,1fr);gap:var(--ds-space-3);align-items:start;border-block-start:var(--ds-border-thin) solid var(--ds-color-divider);padding-block:var(--ds-space-3)}
`;

export const status = (kind, word) => `<span class="ds-status" data-status="${kind}"><span aria-hidden="true" class="ds-status__glyph">${GL[kind]}</span> <span class="ds-status__word">${esc(word)}</span></span>`;
export const tag = (s) => `<span class="ds-tag">${esc(s)}</span>`;
export const code = (s) => `<code class="ds-code">${esc(s)}</code>`;
export const btn = (label, { kind = '', disabled = false, reason = '' } = {}) => `<span class="ds-button-wrap"><button type="button" class="ds-button"${kind ? ` data-kind="${kind}"` : ''}${kind === 'primary' ? ' data-primary' : ''}${disabled ? ' disabled' : ''}>${esc(label)}</button>${reason ? `<span class="ds-button-reason">${esc(reason)}</span>` : ''}</span>`;
export const msg = (tone, body, label) => `<div class="ds-message" data-tone="${tone}" role="status"><span class="ds-message__label"><span aria-hidden="true">${{ done: '✓', note: 'ⓘ', 'needs-you': '◷', problem: '✕' }[tone]}</span> ${label ?? { done: 'Done', note: 'Note', 'needs-you': 'Needs you', problem: 'Problem' }[tone]}</span><span class="ds-message__body">${body}</span></div>`;
export const level = (label, value, max, text) => `<div class="ds-level"><span class="ds-level__name">${esc(label)}</span><div class="ds-level__bar" role="meter" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${value}" aria-valuetext="${esc(text)}"><span class="ds-level__fill" style="inline-size:${Math.min(100, (value / max) * 100)}%"></span></div><span class="ds-level__text">${esc(text)}</span></div>`;
export const pane = (title, body, { count = '', id = '', actions = '', level: lv = 2 } = {}) => `<section class="ds-pane" aria-label="${esc(title)}"${id ? ` id="${id}"` : ''}><h${lv} class="ds-pane__title"><span class="ds-clamp">${esc(title)}</span>${count !== '' ? `<span class="ds-pane__count">${count}</span>` : ''}</h${lv}><div class="ds-pane__body">${body}</div>${actions ? `<div class="ds-pane__actions">${actions}</div>` : ''}</section>`;
export const header = (title, lead, action = '') => `<header class="ds-page-header"><div class="ds-page-header__text"><h1 class="ds-h1">${esc(title)}</h1><p class="ds-page-header__lead">${esc(lead)}</p></div>${action ? `<div class="ds-page-header__action">${action}</div>` : ''}</header>`;
export const page = (title, lead, ...parts) => `<div class="ds-page" data-frame="wide" data-layout-group="true">${header(title, lead)}${parts.join('')}</div>`;
export const tabs = (label, items, cur) => `<div class="ds-tabs" role="tablist" aria-label="${esc(label)}">${items.map(([id, t]) => `<button role="tab" type="button" class="ds-tab" aria-selected="${id === cur}" tabindex="${id === cur ? 0 : -1}">${esc(t)}</button>`).join('')}</div>`;
export const segmented = (label, items, cur) => `<div class="ds-segmented" role="group" aria-label="${esc(label)}">${items.map(([id, t]) => `<button type="button" class="ds-segmented__option" aria-pressed="${id === cur}">${esc(t)}</button>`).join('')}</div>`;
export const table = (caption, head, rows) => `<div class="ds-table-frame"><table class="ds-table"><caption class="ds-visually-hidden">${esc(caption)}</caption><thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
export const facts = (items) => `<dl class="ds-facts">${items.map(([n, v]) => `<div class="ds-facts__row"><dt>${n}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
export const reasonStatus = (j) => { const r = REASONS[j.state]; return status(r.kind, r.word); };
export const mtag = (id) => (id ? tag(`${id} ${M[id].name}`) : tag('no machine'));
export const mcls = (id) => (id ? id.toLowerCase() : '');

/** Gantt rows. Would become shared part TimelineChart: rows, segments by kind, a now line, markers. */
export function gantt(list, { names = (j) => `<b>${esc(j.id)}</b>${mtag(j.m)}`, runTick = true, from = 0, to = SPAN, extra = () => '', compact = false } = {}) {
  const pc = (t) => `${(Math.max(from, Math.min(to, t)) - from) / (to - from) * 100}%`;
  const w = (a, b) => `${Math.max(0.6, (Math.min(to, b) - Math.max(from, a)) / (to - from) * 100)}%`;
  const bar = (a, b, cls, text = '', title = '') => (b <= from || a >= to ? '' : `<span class="pv-b ${cls}" style="inset-inline-start:${pc(a)};inline-size:${w(a, b)}" title="${esc(title)}">${esc(text)}</span>`);
  const ticks = []; for (let t = Math.ceil(from / 10) * 10; t <= to; t += 10) ticks.push(`<span style="inset-inline-start:${pc(t)}">${hm(t)}</span>`);
  const rows = list.map((j) => {
    const m = mcls(j.m); let b = '';
    if (j.state === 'norunner') b += bar(j.q, NOW, 'nr', 'no runner of this size or OS', 'No runner of this size or OS');
    else {
      const adm = j.state === 'starting' ? j.wr : j.start;
      if (['running', 'grace', 'starting'].includes(j.state)) {
        if (j.wr !== undefined && j.wr > j.q) b += bar(j.q, j.wr, 'wr', '', 'Waiting for a runner');
        if (j.state === 'starting') { b += bar(j.wr, j.start, 'fc ' + m, '', 'Runner start-up'); b += bar(j.start, j.end, 'fc ' + m, '', 'Forecast'); }
        else { b += bar(j.start, Math.min(NOW, j.end), 'run ' + m, j.m, 'Running'); if (j.end > NOW) b += bar(NOW, j.end, 'fc ' + m, '', 'Forecast end'); }
        if (j.state === 'grace') b += bar(NOW - 0.3, NOW + 0.35, 'gr', '', 'Timer ran out; stopping');
      } else {
        const wait = j.state === 'reserved' ? 'wm' : 'wm';
        b += bar(j.q, Math.min(adm, NOW) > j.q ? Math.min(adm, NOW) : NOW, wait, j.state === 'reserved' ? 'R reserved' : '', 'Waiting for room in the pool');
        if (adm > NOW) b += bar(NOW, adm, 'wm', '', 'Waiting for room (forecast)');
        b += bar(adm, j.end, 'fc ' + m, j.m ?? '', 'Forecast run');
      }
    }
    const rt = runs.find((r) => r.repo === j.repo && r.id === j.run);
    const tick = runTick && rt && rt.ends < to && rt.ends > from && rt.id === '#8133' ? `<span class="pv-tick" style="inset-inline-start:${pc(rt.ends)}" title="Run ${rt.id} timer ends ${hm(rt.ends)}"></span>` : '';
    return `<div class="pv-g-row"><div class="pv-g-name">${names(j)}${extra(j)}</div><div class="pv-g-track" role="img" aria-label="${esc(j.id)}: ${esc(REASONS[j.state].word)}">${b}${tick}<span class="pv-now" style="inset-inline-start:${pc(NOW)}" title="Now ${hm(NOW)}"></span></div></div>`;
  }).join('');
  return `<div class="pv-g${compact ? ' compact' : ''}" role="group" aria-label="Job timeline"><div class="pv-g-axis"><div></div><div class="pv-g-ticks">${ticks.join('')}</div></div>${rows}</div>${compact ? '' : ganttLegend()}`;
}
export const ganttLegend = () => `<div class="pv-legend" aria-label="Legend"><span><i class="pv-sw pv-b m1 run"></i>M1 GameRoomPC</span><span><i class="pv-sw pv-b m2 run"></i>M2 BuildTower</span><span><i class="pv-sw pv-b m3 run"></i>M3 MacMini</span><span><i class="pv-sw pv-b wr"></i>waiting for a runner</span><span><i class="pv-sw pv-b wm"></i>waiting for room in the pool</span><span><i class="pv-sw pv-b fc m1"></i>forecast</span><span><i class="pv-sw pv-b nr"></i>no runner of this size or OS</span><span><i class="pv-sw pv-b gr"></i>timer ran out</span><span><i class="pv-sw" style="border-inline-start:3px solid var(--ds-color-needs-you)"></i>run timer ends</span><span><i class="pv-sw" style="border-inline-start:2px solid var(--ds-color-text)"></i>now 14:12</span></div>`;

/** Step chart of one machine, CPU or memory, against the pool size. Would become shared part StepChart. */
export function stepChart(mid, kind = 'cpu', { h = 130 } = {}) {
  const W = 300, L = 30, R = 6, T = 14, B = 22, pw = W - L - R, ph = h - T - B;
  const pool = kind === 'cpu' ? M[mid].cpu : M[mid].mem, unit = kind === 'cpu' ? 'CPU' : 'GiB';
  const x = (t) => L + (t / SPAN) * pw, y = (v) => T + ph - (v / pool) * ph;
  let d = `M${x(0)} ${y(0)}`;
  usage(mid).forEach((s) => { const v = kind === 'cpu' ? s.cpu : s.mem; d += ` L${x(s.t0)} ${y(v)} L${x(s.t1)} ${y(v)}`; });
  d += ` L${x(SPAN)} ${y(0)}`;
  const cls = kind === 'cpu' ? 's1' : 's2';
  const xt = [0, 20, 40, 60].map((t) => `<text x="${x(t)}" y="${h - 6}" text-anchor="${t === 0 ? 'start' : t === 60 ? 'end' : 'middle'}">${hm(t)}</text>`).join('');
  return `<svg class="pv-svg" viewBox="0 0 ${W} ${h}" role="img" aria-label="${M[mid].name} ${unit} in use over time against a pool of ${pool}. Now ${kind === 'cpu' ? usedNow(mid).cpu : usedNow(mid).mem} of ${pool}."><rect class="fcast" x="${x(NOW)}" y="${T}" width="${x(SPAN) - x(NOW)}" height="${ph}"/><path class="${cls}" d="${d}"/><line class="ax" x1="${L}" y1="${y(0)}" x2="${W - R}" y2="${y(0)}"/><line class="pool" x1="${L}" y1="${y(pool)}" x2="${W - R}" y2="${y(pool)}"/><text x="${L - 4}" y="${y(pool) + 4}" text-anchor="end">${pool}</text><text x="${L - 4}" y="${y(0)}" text-anchor="end">0</text><text x="${L + 3}" y="${T - 3}" class="lbl">${unit} · pool ${pool}</text><line class="nowl" x1="${x(NOW)}" y1="${T}" x2="${x(NOW)}" y2="${y(0)}"/>${xt}</svg>`;
}

/** Free CPU over time with the big job's need as a dashed line. Would become shared part LineChart. */
export function freeCpu(mode) {
  const W = 300, H = 170, L = 28, R = 10, T = 16, B = 28, pw = W - L - R, ph = H - T - B, X = (t) => L + (t / 20) * pw, Y = (v) => T + ph - (v / 10) * ph;
  const wob = [5, 3, 2, 4, 6, 3, 2, 5, 3, 2, 4, 3, 2, 4, 3, 2, 5, 3, 2, 4, 3];
  const pts = mode === 'bad' ? wob.map((v, t) => [t, v]) : [...wob.slice(0, 11).map((v, t) => [t, v]), [11, 6], [12, 8], [12.2, 0], [20, 0]];
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0])} ${Y(p[1])}`).join(' ');
  const ticks = [0, 5, 10, 15, 20].map((t) => `<text x="${X(t)}" y="${H - 12}" text-anchor="middle">${t}</text>`).join('');
  const extra = mode === 'bad'
    ? `<text x="${X(10)}" y="${Y(8) - 5}" text-anchor="middle" class="lbl">never reaches 8: waits for ever</text>`
    : `<line class="nowl" x1="${X(10)}" y1="${T}" x2="${X(10)}" y2="${Y(0)}"/><text x="${X(10) - 3}" y="${T + 9}" text-anchor="end">reserved</text><circle class="dot" cx="${X(12)}" cy="${Y(8)}" r="4"/><text x="${X(12) + 6}" y="${Y(8) - 6}" class="lbl">starts at 12</text>`;
  return `<svg class="pv-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${mode === 'bad' ? 'Without protection free CPU stays below the 8 CPU the big job needs.' : 'With a reservation from minute 10 free CPU rises to 8 and the big job starts at minute 12.'}"><line class="ax" x1="${L}" y1="${Y(0)}" x2="${W - R}" y2="${Y(0)}"/><line class="need" x1="${L}" y1="${Y(8)}" x2="${W - R}" y2="${Y(8)}"/><text x="${L - 4}" y="${Y(8) + 4}" text-anchor="end">8</text><text x="${L - 4}" y="${Y(0)}" text-anchor="end">0</text><text x="${L + 3}" y="${T - 4}" class="lbl">free CPU (dashed = what build needs)</text><path class="${mode === 'bad' ? 'bad' : 'good'}" d="${path}"/>${extra}${ticks}<text x="${X(10)}" y="${H - 1}" text-anchor="middle">minutes</text></svg>`;
}

/** One machine capacity block: shared ds-level bars plus runners. Would extend shared part Level with a pool marker. */
export function capacity(mid, { withChart = false } = {}) {
  const m = M[mid], u = usedNow(mid);
  const b = level('CPU', u.cpu, m.cpu, `${u.cpu} of ${m.cpu}`) + level('Memory', u.mem, m.mem, `${u.mem} of ${m.mem} GiB`);
  return b + (withChart ? `<div class="pv-grid two">${stepChart(mid, 'cpu')}${stepChart(mid, 'mem')}</div>` : '');
}

/** A timer row: elapsed of max. Shared Progress / Level part. */
export const timer = (label, el, max, text) => `<div class="pv-timer">${level(label, el, max, text)}</div>`;
export const timersOf = (j) => {
  const run = runs.find((r) => r.id === j.run && r.repo === j.repo);
  const hm2 = (v) => `${Math.floor(v)}:${String(Math.round((v % 1) * 60)).padStart(2, '0')}`;
  if (j.state === 'grace') return timer('Job timer', 30, 30, 'ran out at 30:00') + timer('Run timer', NOW - run.start, 45, `${hm2(NOW - run.start)} of 45:00`);
  if (j.state === 'running') return timer('Job timer', NOW - j.start, 30, `${hm2(NOW - j.start)} of 30:00`) + timer('Run timer', NOW - run.start, 45, `${hm2(NOW - run.start)} of 45:00`);
  if (j.state === 'starting') return timer('Runner start-up', NOW - j.wr, 2, `${hm2(NOW - j.wr)} of 2:00`) + timer('Queued on GitHub', j.wr - j.q, 10, `waited ${hm2(j.wr - j.q)} before a runner was chosen`);
  if (j.state === 'norunner') return timer('Queued on GitHub', NOW - j.q, 24 * 60, `${hm2(NOW - j.q)}. GitHub cancels after 24 h`);
  return timer('Queued on GitHub', NOW - j.q, 60, `${hm2(NOW - j.q)} (the clock has not started)`);
};
export const graceCard = (j, { buttons = true } = {}) => `<div class="pv-grace" role="alert"><div>${status('failed', 'Job timer ran out')} <b>${esc(j.id)}</b> on ${esc(j.runner)}</div><p class="ds-text">Job timer ran out at 30:00; stopping in 20 s.</p>${level('Grace', 10, 30, '20 s left of 30 s')}${buttons ? `<div class="pv-btnrow">${btn('Stop now', { kind: 'stop' })}${btn('Extend 10 min')}</div>` : `<p class="pv-note">Stop now and Extend 10 min are on the job page.</p>`}</div>`;
