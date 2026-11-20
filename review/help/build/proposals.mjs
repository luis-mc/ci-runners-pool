// LOOK42: six Help proposals as DOM for <main>. Shared ds-* classes from the real UI package;
// the .hp-* styles below are the scoped sheet for the new visual parts only (diagram, panels).
import { T, byId, GROUPS, nm } from './terms.mjs';
import { fx } from './harness.mjs';

export const HP_CSS = `
/* LOOK42 proposal-only styles: new visual parts. Colours and sizes come from design tokens. */
.hp-svg{display:block;inline-size:100%;block-size:auto}
.hp-svg .n{fill:var(--ds-color-surface);stroke:var(--ds-color-border);stroke-width:2}
.hp-svg .n.pool{stroke:var(--ds-color-primary);stroke-width:3}
.hp-svg .t{fill:var(--ds-color-text);font-family:var(--ds-font-body);font-weight:700}
.hp-svg .m{fill:var(--ds-color-text-muted);font-family:var(--ds-font-body)}
.hp-svg .a{stroke:var(--ds-color-primary);stroke-width:2;fill:none}
.hp-svg .ah{fill:var(--ds-color-primary)}
.hp-svg .busy{fill:var(--ds-color-primary);stroke:var(--ds-color-primary)}
.hp-svg .free{fill:none;stroke:var(--ds-color-primary);stroke-width:2}
.hp-svg .wait{fill:var(--ds-color-needs-you-tint);stroke:var(--ds-color-needs-you);stroke-width:2}
.hp-svg .grp{fill:none;stroke:var(--ds-color-divider);stroke-width:2;stroke-dasharray:6 5}
.hp-svg .gl{fill:var(--ds-color-text-muted);font-family:var(--ds-font-body);letter-spacing:.04em}
.hp-svg .badge{fill:var(--ds-color-primary)}
.hp-svg .bt{fill:var(--ds-color-on-primary);font-family:var(--ds-font-body);font-weight:700}
.hp-svg .done{stroke:var(--ds-color-done);stroke-width:4;fill:none}
.hp-svg .line{stroke:var(--ds-color-border);stroke-width:2}
.hp-svg a{cursor:pointer;outline:none}
.hp-svg a:focus-visible .n,.hp-svg a:hover .n,.hp-svg a.on .n{stroke:var(--ds-color-primary);stroke-width:4;fill:var(--ds-color-selection)}
.hp-svg .tick{stroke:var(--ds-color-needs-you);stroke-width:3}
.hp-wide{display:block}.hp-tall{display:none}
@media (max-width:600px){.hp-wide{display:none}.hp-tall{display:block}}
.hp-chips{display:flex;flex-wrap:wrap;gap:var(--ds-space-2)}
.hp-note{color:var(--ds-color-text-muted)}
.hp-tag{display:inline-block;padding:0 var(--ds-space-2);border:var(--ds-border-thin) solid var(--ds-color-border);border-radius:var(--ds-radius-2)}
.hp-def{display:grid;gap:var(--ds-space-2)}
.hp-def b{font-weight:700}
.hp-rel{display:block}
.hp-ask{display:inline-grid;place-items:center;min-inline-size:44px;min-block-size:44px;box-sizing:border-box;padding:0;font:inherit}
.hp-row{display:flex;gap:var(--ds-space-3);align-items:center;flex-wrap:wrap;justify-content:space-between}
.hp-anchor{position:relative;display:inline-block}
.hp-anchor .ds-popover{inset-inline-start:0;inset-inline-end:auto;inline-size:min(22rem,80vw)}
.hp-step{display:inline-grid;place-items:center;inline-size:2rem;block-size:2rem;border-radius:var(--ds-radius-round);background:var(--ds-color-primary);color:var(--ds-color-on-primary);font-weight:700;margin-inline-end:var(--ds-space-2)}
.hp-cols{display:grid;grid-template-columns:1fr 3rem 2fr;gap:var(--ds-space-3);align-items:start}
.hp-arrow{display:grid;place-items:center;align-self:center;color:var(--ds-color-primary);text-align:center}
.hp-arrow svg{inline-size:2.4rem;block-size:2.4rem}
.hp-callout{display:inline-grid;place-items:center;inline-size:1.6rem;block-size:1.6rem;border-radius:var(--ds-radius-round);background:var(--ds-color-primary);color:var(--ds-color-on-primary);font-weight:700;font-size:.9em;flex:none}
.hp-slots{display:flex;gap:var(--ds-space-2);flex-wrap:wrap}
.hp-slot{inline-size:1.6rem;block-size:1.6rem;border:2px solid var(--ds-color-primary);box-sizing:border-box}
.hp-slot.b{background:var(--ds-color-primary)}
.hp-legend{display:grid;gap:var(--ds-space-3);margin:0;padding:0;list-style:none}
.hp-legend li{display:flex;gap:var(--ds-space-3);align-items:baseline}
@media (max-width:600px){.hp-anchor{position:static}.hp-anchor .ds-popover{position:fixed;inset-inline:0;inset-block-end:0;inline-size:auto;box-sizing:border-box;border-radius:var(--ds-radius-3) var(--ds-radius-3) 0 0;box-shadow:var(--ds-shadow-3)}.hp-cols{grid-template-columns:1fr}.hp-cols .hp-arrow{transform:rotate(90deg);block-size:2.4rem}}
`;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const header = (lead) =>
  `<header class="ds-page-header"><div class="ds-page-header__text"><h1 class="ds-h1">Help</h1><p class="ds-page-header__lead">${esc(lead)}</p></div></header>`;
const pane = (title, body, { hint = '', level = 2, id = '' } = {}) =>
  `<section class="ds-pane" aria-label="${esc(title)}"${id ? ` id="${id}"` : ''}><h${level} class="ds-pane__title"><span class="ds-clamp" title="${esc(title)}">${esc(title)}</span></h${level}><div class="ds-pane__body">${hint ? `<p class="hp-note">${esc(hint)}</p>` : ''}${body}</div></section>`;
const chips = (ids) => `<span class="hp-rel">${ids.map((i) => `<a class="ds-link" href="#t-${i}" data-term="${i}">${esc(nm(i))}</a>`).join(' · ')}</span>`;
const tag = (s) => `<span class="ds-tag">${esc(s)}</span>`;
const page = (lead, ...parts) => `<div class="ds-page" data-frame="wide" data-layout-group="true">${header(lead)}${parts.join('')}</div>`;

// ---------- mini pictures (inline SVG, tokens only) ----------
const arrowDefs = ``;
const arrowH = (x1, y, x2) => `<path class="a" d="M${x1} ${y}H${x2 - 8}"/><path class="ah" d="M${x2} ${y}l-9 -6v12z"/>`;
const arrowV = (x, y1, y2) => `<path class="a" d="M${x} ${y1}V${y2 - 8}"/><path class="ah" d="M${x} ${y2}l-6 -9h12z"/>`;
const svg = (vb, body, label, cls = '') => `<svg class="hp-svg ${cls}" viewBox="${vb}" role="img" aria-label="${esc(label)}">${body}</svg>`;

/** The job path: Repository to Machine. Wide for desktop, tall for a phone. Boxes are links when `links` is set. */
const CHAIN = [
  { id: 'repo', t: 'Repository', s: 'octo/app', g: 0 },
  { id: 'run', t: 'Run', s: '#8133, a push', g: 0 },
  { id: 'job', t: 'Job', s: 'e2e + labels', g: 0 },
  { id: 'queue', t: 'Queue', s: '2 ahead', g: 1 },
  { id: 'slot', t: 'Slot', s: '1 job', g: 1 },
  { id: 'runner', t: 'Runner', s: 'crsp-linux-1', g: 1 },
  { id: 'machine', t: 'Machine', s: 'build-1', g: 1 },
];
const node = (n, x, y, w, h, i, links) => {
  const inner = `<rect class="n${n.g ? ' pool' : ''}" x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/><circle class="badge" cx="${x + 16}" cy="${y}" r="13"/><text class="bt" x="${x + 16}" y="${y + 5}" text-anchor="middle" font-size="14">${i + 1}</text><text class="t" x="${x + w / 2}" y="${y + h / 2 - 2}" text-anchor="middle" font-size="17">${esc(n.t)}</text><text class="m" x="${x + w / 2}" y="${y + h / 2 + 20}" text-anchor="middle" font-size="13">${esc(n.s)}</text>`;
  return links ? `<a href="#t-${n.id}" data-term="${n.id}" aria-label="${esc(n.t)}: ${esc(byId[n.id].line)}"><g>${inner}</g></a>` : `<g>${inner}</g>`;
};
export const chainWide = (links = true) => {
  const w = 138, gap = 39, y = 66, h = 84;
  let b = '';
  b += `<rect class="grp" x="-4" y="30" width="${3 * w + 2 * gap + 8 + gap / 2}" height="150" rx="8"/><text class="gl" x="8" y="22" font-size="14">ON GITHUB</text>`;
  const x4 = 3 * (w + gap) - gap / 2 + 4;
  b += `<rect class="grp" x="${x4}" y="30" width="${1204 - x4}" height="150" rx="8"/><text class="gl" x="${x4 + 12}" y="22" font-size="14">IN YOUR POOL (crsp)</text>`;
  CHAIN.forEach((n, i) => {
    const x = i * (w + gap) + 4;
    b += node(n, x, y, w, h, i, links);
    if (i < CHAIN.length - 1) b += arrowH(x + w + 2, y + h / 2, x + w + gap - 2);
  });
  return svg('-8 0 1220 190', b, 'How a job gets run: repository, run, job, queue, slot, runner, machine.', 'hp-wide');
};
export const chainTall = (links = true) => {
  const w = 300, h = 58, gap = 26;
  let b = '';
  const y0 = 28;
  const gy = (i) => y0 + i * (h + gap);
  b += `<rect class="grp" x="4" y="${gy(0) - 20}" width="352" height="${3 * h + 2 * gap + 38}" rx="8"/><text class="gl" x="14" y="${gy(0) - 6}" font-size="13">ON GITHUB</text>`;
  b += `<rect class="grp" x="4" y="${gy(3) - 20}" width="352" height="${4 * h + 3 * gap + 38}" rx="8"/><text class="gl" x="14" y="${gy(3) - 6}" font-size="13">IN YOUR POOL (crsp)</text>`;
  CHAIN.forEach((n, i) => {
    b += node(n, 30, gy(i) + 8, w, h, i, links).replace(/translate/, 'translate');
    if (i < CHAIN.length - 1) b += arrowV(180, gy(i) + 8 + h + 2, gy(i + 1) + 8 - 2);
  });
  return svg(`0 0 360 ${gy(6) + h + 36}`, b, 'How a job gets run: repository, run, job, queue, slot, runner, machine.', 'hp-tall');
};

/** Small pictures per term (D popovers, F answers, C panels). */
export const mini = {
  slots: (total = 4, busy = 2) => {
    let b = `<rect class="n" x="6" y="6" width="${total * 44 + 20}" height="58" rx="6"/>`;
    for (let i = 0; i < total; i++) b += `<rect class="${i < busy ? 'busy' : 'free'}" x="${16 + i * 44}" y="16" width="34" height="26"/>`;
    b += `<text class="m" x="16" y="58" font-size="12">${busy} of ${total} slots busy</text>`;
    return svg(`0 0 ${total * 44 + 32} 72`, b, `A machine with ${total} slots, ${busy} busy.`);
  },
  shared: () => {
    let b = '';
    ['octo/app', 'octo/site', 'octo/docs'].forEach((r, i) => { b += `<rect class="n" x="4" y="${6 + i * 36}" width="92" height="28" rx="4"/><text class="t" x="50" y="${25 + i * 36}" text-anchor="middle" font-size="12">${r}</text><path class="a" d="M98 ${20 + i * 36}L150 58"/>`; });
    b += `<rect class="n pool" x="152" y="22" width="150" height="74" rx="6"/><text class="t" x="227" y="52" text-anchor="middle" font-size="14">Shared Pool</text><text class="m" x="227" y="74" text-anchor="middle" font-size="12">2 machines</text>`;
    return svg('0 0 306 118', b, 'Three repositories use one shared pool of machines.');
  },
  budget: () => {
    let b = `<text class="m" x="6" y="16" font-size="12">Memory 62% of 85%</text><rect class="n" x="6" y="24" width="280" height="16" rx="3"/><rect class="busy" x="6" y="24" width="${280 * 0.62}" height="16" rx="3"/><path class="tick" d="M${6 + 280 * 0.85} 18V46"/><text class="m" x="${6 + 280 * 0.85}" y="60" text-anchor="middle" font-size="12">budget 85%</text>`;
    b += `<text class="m" x="6" y="82" font-size="12">Over the line: new jobs wait.</text>`;
    return svg('0 0 300 92', b, 'A load bar at 62 percent with the budget line at 85 percent.');
  },
  queue: () => {
    let b = '';
    for (let i = 0; i < 3; i++) b += `<rect class="${i === 0 ? 'wait' : 'n'}" x="${6 + i * 56}" y="10" width="48" height="34" rx="4"/><text class="t" x="${30 + i * 56}" y="32" text-anchor="middle" font-size="12">job ${i + 1}</text>`;
    b += arrowH(176, 27, 214) + `<rect class="free" x="218" y="10" width="34" height="34"/><text class="m" x="6" y="68" font-size="12">first one takes the free slot</text>`;
    return svg('0 0 270 78', b, 'Three jobs in a queue; the first takes the next free slot.');
  },
  labels: () => {
    let b = `<rect class="n" x="4" y="8" width="104" height="48" rx="4"/><text class="t" x="56" y="28" text-anchor="middle" font-size="14">Job</text><text class="m" x="56" y="46" text-anchor="middle" font-size="11">self-hosted linux</text>`;
    b += `<path class="a" d="M112 32H168"/><text class="t" x="140" y="26" text-anchor="middle" font-size="16">=</text>`;
    b += `<rect class="n pool" x="172" y="8" width="104" height="48" rx="4"/><text class="t" x="224" y="28" text-anchor="middle" font-size="14">Runner</text><text class="m" x="224" y="46" text-anchor="middle" font-size="11">self-hosted linux</text>`;
    return svg('0 0 282 66', b, 'A job and a runner with the same labels match.');
  },
  runnerType: () => {
    let b = `<rect class="n" x="4" y="6" width="150" height="62" rx="4"/><text class="t" x="79" y="28" text-anchor="middle" font-size="14">Persistent</text><text class="m" x="79" y="48" text-anchor="middle" font-size="11">keeps its tools</text>`;
    b += `<rect class="n" x="166" y="6" width="150" height="62" rx="4"/><text class="t" x="241" y="28" text-anchor="middle" font-size="14">Ephemeral</text><text class="m" x="241" y="48" text-anchor="middle" font-size="11">fresh every job</text>`;
    return svg('0 0 320 76', b, 'Persistent runners keep tools and caches. Ephemeral runners start fresh for every job.');
  },
  hosted: () => {
    let b = `<rect class="n pool" x="4" y="8" width="120" height="50" rx="4"/><text class="t" x="64" y="38" text-anchor="middle" font-size="14">your pool</text>`;
    b += `<rect class="n" x="160" y="8" width="120" height="50" rx="4"/><text class="t" x="220" y="30" text-anchor="middle" font-size="14">elsewhere</text><text class="m" x="220" y="48" text-anchor="middle" font-size="11">another runner</text>`;
    b += `${arrowH(128, 33, 158)}`;
    return svg('0 0 286 66', b, 'A job can run on your pool or elsewhere, on another runner.');
  },
  doctor: () => {
    let b = `<rect class="n" x="4" y="6" width="190" height="52" rx="4"/><text class="t" x="14" y="28" font-size="13">✕ No machine up for Windows</text><text class="m" x="14" y="48" font-size="11">Fix: start win-box</text>`;
    return svg('0 0 200 66', b, 'A Doctor finding with its fix.');
  },
};
const miniFor = {
  slot: () => mini.slots(), pool: () => mini.shared(), budget: () => mini.budget(), queue: () => mini.queue(), labels: () => mini.labels(),
  rtype: () => mini.runnerType(), elsewhere: () => mini.hosted(), doctor: () => mini.doctor(),
};
const pic = (id) => (miniFor[id] ? `<div style="max-inline-size:20rem">${miniFor[id]()}</div>` : '');

const defPane = (id) => {
  const t = byId[id];
  return pane(t.name, `<div class="hp-def"><p><b>${esc(t.line)}</b></p><p>Example: ${tag(t.ex)}</p>${pic(id)}<p>Related: ${chips(t.rel)}</p>${t.note ? `<p class="hp-note">${esc(t.note)}</p>` : ''}</div>`, { id: 'def', level: 3 });
};
const termTable = (ids) => {
  const rows = ids.map((id) => byId[id]).map((t) => `<tr data-lead><td data-label="Term" data-lead="true"><span class="ds-table__value"><a class="ds-link" id="t-${t.id}" href="#t-${t.id}" data-term="${t.id}">${esc(t.name)}</a></span></td><td data-label="Means"><span class="ds-table__value">${esc(t.line)}</span></td><td data-label="Example"><span class="ds-table__value">${esc(t.ex)}</span></td></tr>`).join('');
  return `<div class="ds-table-frame"><table class="ds-table"><caption class="ds-visually-hidden">Terms</caption><thead><tr><th scope="col">Term</th><th scope="col">Means</th><th scope="col">Example</th></tr></thead><tbody>${rows}</tbody></table></div>`;
};

// ---------- A: picture first ----------
export function A() {
  return page(
    'How a job gets run, in one picture. Press a box to see what it is.',
    pane('How a job gets run', chainWide() + chainTall() + `<p class="hp-note">1 to 3 happen on GitHub. 4 to 7 happen in your pool.</p>`),
    defPane('slot'),
    pane('Terms', termTable(['repo', 'workflow', 'run', 'job', 'labels', 'pool', 'machine', 'runner', 'rtype', 'slot', 'budget', 'queue', 'limit', 'why', 'elsewhere', 'doctor']), { hint: 'One line each. Press a name to see it with a picture.' }),
  );
}

// ---------- B: glossary first ----------
export function B() {
  const card = (t) => `<section class="ds-pane" aria-label="${esc(t.name)}" id="t-${t.id}"><h3 class="ds-pane__title"><span class="ds-clamp" title="${esc(t.name)}">${esc(t.name)}</span></h3><div class="ds-pane__body"><div class="hp-def"><span>${esc(t.line)}</span><span>${tag(t.ex)}</span><span class="hp-rel"><span class="hp-note">Related:</span> ${chips(t.rel)}</span></div></div></section>`;
  const picked = T.filter((t) => ['repo', 'job', 'labels', 'pool', 'machine', 'runner', 'slot', 'budget', 'queue', 'limit', 'rtype', 'caches', 'doctor', 'elsewhere'].includes(t.id));
  const search = `<div class="ds-search" role="search"><input class="ds-input" type="text" aria-label="Find a term" placeholder="Find a term" value=""></div>`;
  const filters = `<div class="ds-chips" role="group" aria-label="Group">${['All', ...Object.values(GROUPS)].map((g, i) => `<button type="button" class="ds-chip" aria-pressed="${i === 0}">${g}</button>`).join('')}</div>`;
  return page(
    'Every term in one place. Search it, or pick a group.',
    `<div class="ds-stack" data-gap="tight">${search}${filters}<p class="hp-note">14 of 21 terms. Related terms link to each other.</p></div>`,
    `<div class="ds-card-grid" data-layout-group="true">${picked.map(card).join('')}</div>`,
  );
}

// ---------- C: walkthrough ----------
export function C() {
  const p = (n, title, line, body) => pane(`${n}  ${title}`, `<div class="hp-def">${body}<p>${esc(line)}</p></div>`, { level: 3 });
  const s1 = svg('0 0 260 90', `<rect class="n" x="6" y="14" width="110" height="60" rx="6"/><text class="t" x="61" y="40" text-anchor="middle" font-size="15">octo/app</text><text class="m" x="61" y="60" text-anchor="middle" font-size="12">git push</text>${arrowH(124, 44, 196)}<circle class="busy" cx="222" cy="44" r="26"/><text class="bt" x="222" y="49" text-anchor="middle" font-size="13">#8133</text>`, 'A push to octo/app starts run 8133.');
  const s2 = svg('0 0 260 90', `<rect class="n" x="6" y="8" width="196" height="74" rx="6"/><text class="t" x="104" y="32" text-anchor="middle" font-size="15">Job: e2e</text><text class="m" x="104" y="52" text-anchor="middle" font-size="12">needs labels:</text><text class="m" x="104" y="70" text-anchor="middle" font-size="12">self-hosted linux x64</text><text class="t" x="226" y="52" font-size="36">?</text>`, 'A job asks for a runner with labels.');
  const s3 = svg('0 0 260 90', `<rect class="wait" x="6" y="22" width="56" height="44" rx="4"/><text class="t" x="34" y="49" text-anchor="middle" font-size="13">e2e</text><rect class="n" x="70" y="22" width="56" height="44" rx="4"/><text class="t" x="98" y="49" text-anchor="middle" font-size="13">lint</text><rect class="n" x="134" y="22" width="56" height="44" rx="4"/><text class="t" x="162" y="49" text-anchor="middle" font-size="13">docs</text><text class="m" x="6" y="84" font-size="12">queue on build-1</text>`, 'The job joins the queue of a matching machine.');
  const s4 = mini.slots(4, 2).replace('class="hp-svg "', 'class="hp-svg"');
  const s5 = svg('0 0 260 90', `<rect class="n pool" x="6" y="8" width="170" height="74" rx="6"/><text class="t" x="91" y="32" text-anchor="middle" font-size="14">crsp-linux-1</text><rect class="n" x="20" y="46" width="142" height="14" rx="3"/><rect class="busy" x="20" y="46" width="88" height="14" rx="3"/><text class="m" x="91" y="76" text-anchor="middle" font-size="12">e2e running</text>`, 'The runner runs the job and shows progress.');
  const s6 = svg('0 0 260 90', `<rect class="n" x="6" y="14" width="110" height="60" rx="6"/><text class="t" x="61" y="40" text-anchor="middle" font-size="15">build-1</text><text class="m" x="61" y="60" text-anchor="middle" font-size="12">slot freed</text>${arrowH(124, 44, 190)}<rect class="n" x="196" y="14" width="56" height="60" rx="6"/><path class="done" d="M208 46l10 10 22 -24"/>`, 'The result goes back to GitHub and the slot is free again.');
  return page(
    'Six steps from a push to a result.',
    `<div class="ds-card-grid" data-layout-group="true">${[
      p(1, 'You push code', 'A push to a repository that uses the pool starts a run.', s1),
      p(2, 'A job is made', 'Each job asks for a runner by its labels.', s2),
      p(3, 'crsp queues it', 'The job joins the queue of a machine that matches.', s3),
      p(4, 'A free slot', 'A machine runs as many jobs at once as it has slots.', s4),
      p(5, 'A runner runs it', 'The runner on that machine does the work.', s5),
      p(6, 'Done', 'The result goes to GitHub. The next job takes the slot.', s6),
    ].join('')}</div>`,
    pane('Job not starting?', `<p>It waits for a reason. <a class="ds-link" href="#">Why jobs wait</a> names it in words.</p>`, { level: 3 }),
  );
}

// ---------- D: in-context ? ----------
export function D() {
  const ask = (t) => `<button type="button" class="ds-button hp-ask" aria-label="What is ${esc(t)}?" aria-expanded="false">?</button>`;
  const fact = (name, val, term, pop = '') => `<div class="ds-facts__row" style="align-items:center"><dt class="hp-row" style="justify-content:flex-start;gap:var(--ds-space-2)">${esc(name)} <span class="hp-anchor">${ask(name)}${pop}</span></dt><dd>${esc(val)}</dd></div>`;
  const t = byId.slot;
  const pop = `<div class="ds-popover" role="dialog" aria-label="Slot" aria-modal="false"><div class="hp-def"><b>${esc(t.name)}</b><span>${esc(t.line)}</span><span>${tag(t.ex)}</span>${mini.slots()}<a class="ds-link" href="#">More about slots in Help</a></div></div>`;
  const sample = pane('build-1', `<span class="ds-status" data-status="ok"><span aria-hidden="true" class="ds-status__glyph">✓</span> <span class="ds-status__word">online</span></span><dl class="ds-facts">${fact('Slots', '2 of 4', 'slot', pop)}${fact('Memory budget', '62% of 85%', 'budget')}${fact('Queued jobs', '2', 'queue')}${fact('Runner type', 'persistent', 'rtype')}</dl><div style="min-block-size:15rem"></div>`, { level: 3 });
  const rows = [['slot', 'Machines, Overview, Machine page'], ['budget', 'Machines, Settings, Pool size'], ['queue', 'Overview, Jobs'], ['why', 'Jobs: Why it waits'], ['limit', 'Repositories'], ['rtype', 'Runners, Add runners'], ['labels', 'Repositories, Doctor'], ['elsewhere', 'Jobs'], ['doctor', 'Doctor']];
  const table = `<div class="ds-table-frame"><table class="ds-table"><caption class="ds-visually-hidden">Terms with a question mark</caption><thead><tr><th scope="col">Term</th><th scope="col">Where you see ?</th><th scope="col">One line</th></tr></thead><tbody>${rows.map(([id, w]) => `<tr><td data-label="Term" data-lead="true"><span class="ds-table__value"><a class="ds-link" href="#">${esc(byId[id].name)}</a></span></td><td data-label="Where you see ?"><span class="ds-table__value">${esc(w)}</span></td><td data-label="One line"><span class="ds-table__value">${esc(byId[id].line)}</span></td></tr>`).join('')}</tbody></table></div>`;
  return page(
    'A ? sits next to every term. Press it for a short answer. This page lists them all.',
    pane('In the console', `<p class="hp-note">Press ? next to a word to see what it means.</p>${sample}`, { hint: '' }),
    pane('Every ? in the console', table),
  );
}

// ---------- E: your pool right now ----------
export function E() {
  const { machines, runners, repos } = fx;
  const num = (n) => `<span class="hp-callout" aria-label="Part ${n}">${n}</span>`;
  const repoCard = pane('Repositories', `<ul class="hp-legend">${repos.map((r) => `<li>${r.pool_on ? '✓' : '○'} ${esc(r.full_name)} ${r.pool_on ? tag('uses the pool') : tag('pool off')}</li>`).join('')}</ul>`, { level: 3 }).replace('<h3 class="ds-pane__title">', `<h3 class="ds-pane__title">`);
  const mach = machines.map((m) => {
    const rs = runners.filter((r) => r.machine_id === m.id);
    const slots = `<div class="hp-slots" role="img" aria-label="${m.slots_used} of ${m.settings.job_slots} slots busy">${Array.from({ length: m.settings.job_slots }, (_, i) => `<span class="hp-slot${i < m.slots_used ? ' b' : ''}"></span>`).join('')}</div>`;
    const lvl = (name, v, max) => `<div class="ds-level"><span class="ds-level__name">${name}</span><div class="ds-level__bar" role="meter" aria-label="${name}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${v}" aria-valuetext="${v}% of ${max}%"><span class="ds-level__fill" style="inline-size:${(v / max) * 100}%"></span></div><span class="ds-level__text">${v}% of ${max}%</span></div>`;
    return pane(m.name, `<div class="hp-def"><span>${num(2)} ${esc(m.os === 'linux' ? 'Linux' : 'Windows')} machine</span><span>${num(3)} Runners: ${rs.map((r) => tag(r.name + ' (' + r.kind + ')')).join(' ')}</span><span>${num(4)} Slots ${m.slots_used} of ${m.settings.job_slots}</span>${slots}<span>${num(5)} Load budget</span>${lvl('Memory', m.load.memory_pct, m.settings.budget_memory_pct)}${lvl('CPU', m.load.cpu_pct, m.settings.budget_cpu_pct)}</div>`, { level: 3 });
  }).join('');
  const arrow = `<div class="hp-arrow" aria-hidden="true"><svg viewBox="0 0 40 40"><path class="a" d="M4 20H30" stroke="currentColor" stroke-width="3" fill="none"/><path d="M36 20l-10 -7v14z" fill="currentColor"/></svg><span>use</span></div>`;
  const legend = [
    [1, 'Repositories use the pool. They all share it.'],
    [2, 'A machine is a computer you added.'],
    [3, 'Runners live on a machine. One job at a time each.'],
    [4, 'Slots: how many jobs a machine runs at once. Filled = busy.'],
    [5, 'Load budget: the machine stops taking jobs above it.'],
    [6, 'Queued jobs wait for a free slot.'],
  ];
  return page(
    'Your pool right now, with each part named. The numbers are yours.',
    pane('Your pool', `<div class="hp-cols"><div><p>${num(1)}</p>${repoCard}</div>${arrow}<div class="ds-card-grid" data-layout-group="true">${mach}</div></div><p>${num(6)} 2 jobs queued, 0 waiting for a reason you need to fix.</p>`),
    pane('What each number is', `<ol class="hp-legend">${legend.map(([n, s]) => `<li>${num(n)}<span>${esc(s)}</span></li>`).join('')}</ol>`, { level: 3 }),
  );
}

// ---------- F: FAQ ----------
export function F() {
  const q = (title, answer, picture) => pane(title, `<div class="hp-def"><p>${esc(answer)}</p>${picture ? `<div style="max-inline-size:20rem">${picture}</div>` : ''}</div>`, { level: 3 });
  return page(
    'Short answers to the questions people ask.',
    `<div class="ds-card-grid" data-layout-group="true">${[
      q('Why is my job waiting?', 'The Jobs page says why: no free slot, over the load budget, or a limit.', mini.queue()),
      q('What is a slot?', 'Room for one job at a time. A machine with 4 slots runs 4 jobs at once.', mini.slots()),
      q('What does shared mean?', 'Every repository you choose uses the same machines and runners.', mini.shared()),
      q('What is the load budget?', 'The most memory and CPU a machine may use for jobs: 85% and 60%.', mini.budget()),
      q('Persistent or ephemeral?', 'Persistent keeps tools and is faster. Ephemeral is fresh every job.', mini.runnerType()),
      q('What does Run elsewhere mean?', 'Another runner runs the job, not your pool.', mini.hosted()),
    ].join('')}</div>`,
  );
}

export const PROPOSALS = {
  A: { name: 'A. Picture first', fn: A },
  B: { name: 'B. Glossary first', fn: B },
  C: { name: 'C. Step by step', fn: C },
  D: { name: 'D. A ? next to every term', fn: D },
  E: { name: 'E. Your pool right now', fn: E },
  F: { name: 'F. Questions and answers', fn: F },
};
