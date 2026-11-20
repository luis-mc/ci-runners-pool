// LOOK42 follow-up: five Help proposals G to K. Each keeps the A diagram pane ("How a job gets run") unchanged,
// merges the F question cards with the C story order, and uses the D "?" popover in the console.
// Shared ds-* classes only; the .hq-* sheet below is the scoped sheet for the few new visual parts (tokens only).
import { byId } from './terms.mjs';
import { fx } from './harness.mjs';
import { HP_CSS, chainWide, chainTall, mini, pane, page, esc, tag, svg } from './proposals.mjs';

export const HQ_CSS = `${HP_CSS}
/* LOOK42 G to K: scoped sheet */
.hq-badge{display:inline-grid;place-items:center;inline-size:1.6rem;block-size:1.6rem;border-radius:var(--ds-radius-round);background:var(--ds-color-primary);color:var(--ds-color-on-primary);font-weight:700;font-size:.9em;flex:none}
.hq-line{display:flex;gap:var(--ds-space-2);align-items:center;flex-wrap:wrap}
.hq-pic{max-inline-size:20rem}
.hq-two{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,4fr);gap:var(--ds-space-4);align-items:start}
.hq-two > *{min-inline-size:0}
.hq-pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--ds-space-4);row-gap:var(--ds-space-6)}
.hq-three{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--ds-space-4);row-gap:var(--ds-space-6)}
.hq-side{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,8fr);gap:var(--ds-space-4);align-items:start}
.hq-side > *{min-inline-size:0}
.hq-sticky{position:sticky;inset-block-start:var(--ds-space-3)}
.hq-side .hp-wide{display:none !important}.hq-side .hp-tall{display:block !important}
.hq-stack{display:grid;gap:var(--ds-space-4)}
.hq-actions{display:flex;gap:var(--ds-space-3);justify-content:space-between;flex-wrap:wrap}
.hq-strip{display:grid;gap:var(--ds-space-3)}
.hq-row{display:flex;gap:var(--ds-space-4);flex-wrap:wrap}
.hq-qs{display:grid;gap:var(--ds-space-2);margin:0;padding:0;list-style:none}
.hq-pop-row{display:flex;gap:var(--ds-space-2);align-items:center;flex-wrap:wrap}
.hq-bar{block-size:.9rem}
@media (max-width:900px){.hq-three{grid-template-columns:1fr 1fr}.hq-side{grid-template-columns:1fr}.hq-sticky{position:static}}
@media (max-width:600px){.hq-two,.hq-pair,.hq-three{grid-template-columns:1fr}}
`;

// ---------- the 8 question cards (F + C): story order, each tied to a box of the diagram ----------
const m1 = fx.machines[0];
const budgetPic = () => {
  const s = m1.settings; const l = m1.load; const W = 260;
  const bar = (y, name, v, b) => `<text class="m" x="6" y="${y}" font-size="12">${name} ${v}% of ${b}%</text><rect class="n" x="6" y="${y + 6}" width="${W}" height="14" rx="3"/><rect class="busy" x="6" y="${y + 6}" width="${W * v / 100}" height="14" rx="3"/><path class="tick" d="M${6 + W * b / 100} ${y + 2}V${y + 26}"/>`;
  const b = bar(14, 'Memory', l.memory_pct, s.budget_memory_pct) + bar(56, 'CPU', l.cpu_pct, s.budget_cpu_pct) + `<text class="m" x="6" y="98" font-size="12">${esc(m1.name)}'s budget. Over it, jobs wait.</text>`;
  return svg('0 0 280 106', b, `${m1.name}: memory ${m1.load.memory_pct}% of its ${s.budget_memory_pct}% budget, CPU ${m1.load.cpu_pct}% of its ${s.budget_cpu_pct}% budget.`);
};
const rtypePic = () => {
  const box = (x, t, s) => `<rect class="n" x="${x}" y="6" width="150" height="56" rx="4"/><text class="t" x="${x + 75}" y="28" text-anchor="middle" font-size="14">${t}</text><text class="m" x="${x + 75}" y="48" text-anchor="middle" font-size="11">${s}</text>`;
  return svg('0 0 320 92', `${box(4, 'Persistent', 'keeps its tools')}${box(166, 'Ephemeral', 'fresh every job')}<text class="m" x="4" y="84" font-size="12">Runner type. Linux or Windows is the OS.</text>`, 'Runner type: persistent keeps its tools, ephemeral is fresh for every job. Linux or Windows is the OS, a separate choice.');
};
const elsewherePic = () => svg('0 0 300 70', `<rect class="n pool" x="4" y="8" width="110" height="50" rx="4"/><text class="t" x="59" y="38" text-anchor="middle" font-size="14">your pool</text><rect class="n" x="176" y="8" width="120" height="50" rx="4"/><text class="t" x="236" y="30" text-anchor="middle" font-size="14">elsewhere</text><text class="m" x="236" y="48" text-anchor="middle" font-size="11">e.g. the old pool</text><path class="a" d="M118 33H166" stroke-dasharray="5 4"/><path class="ah" d="M172 33l-9 -6v12z"/>`, 'A job that another runner runs, for example the old pool, is listed apart from your pool.');
const trayPic = () => svg('0 0 260 70', `<rect class="n" x="4" y="8" width="252" height="40" rx="4"/><circle class="busy" cx="236" cy="28" r="9"/><text class="m" x="14" y="33" font-size="12">Open console · Pause · Update</text><text class="m" x="4" y="64" font-size="11">the tray icon, bottom right of the PC</text>`, 'The tray app: an icon with a menu to open the console, pause or update.');
const doctorPic = () => svg('0 0 260 70', `<rect class="n" x="4" y="6" width="250" height="52" rx="4"/><text class="t" x="14" y="28" font-size="13">✕ No machine is up for Windows</text><text class="m" x="14" y="46" font-size="11">Fix: start win-box</text>`, 'A Doctor finding with its one fix.');

export const Q = [
  { id: 'shared', box: 'repo', n: 1, q: 'What does shared mean?', a: 'Every repository you choose uses the same machines and runners.', pic: () => mini.shared(), term: 'pool' },
  { id: 'wait', box: 'queue', n: 4, q: 'Why is my job waiting?', a: 'The Jobs tab names the first blocker: no free slot, over the load budget, or a repository limit.', pic: () => mini.queue(), term: 'why' },
  { id: 'slot', box: 'slot', n: 5, q: 'What is a slot?', a: 'Room for one job at a time. A machine with 4 slots runs 4 jobs at once.', pic: () => mini.slots(), term: 'slot' },
  { id: 'budget', box: 'machine', n: 7, q: 'What is the load budget?', a: 'The most memory and CPU a machine may use for jobs. Each machine shows its own.', pic: budgetPic, term: 'budget' },
  { id: 'rtype', box: 'runner', n: 6, q: 'Persistent or ephemeral?', a: 'Persistent keeps its tools, ephemeral is fresh every job. That is the Runner type; Linux or Windows is the OS.', pic: rtypePic, term: 'rtype' },
  { id: 'else', box: 'job', n: 3, q: 'What does Run elsewhere mean?', a: 'Jobs that another runner runs, such as the old pool. They are listed apart and still feed Run insights, the Jobs tab with Do next.', pic: elsewherePic, term: 'elsewhere' },
  { id: 'tray', box: 'machine', n: 7, q: 'What does the tray app do?', a: 'A small icon on the PC. Open the console, pause jobs or update from it.', pic: trayPic, term: 'tray' },
  { id: 'doctor', box: 'machine', n: 7, q: 'What does Doctor do?', a: 'Reads the whole pool and lists each problem with one fix. It only reads.', pic: doctorPic, term: 'doctor' },
];
const byQ = Object.fromEntries(Q.map((x) => [x.id, x]));

// ---------- the A diagram pane, unchanged. `hl` marks one box (the box a question points at). ----------
export const diagram = (hl = '') => {
  let w = chainWide() + chainTall();
  if (hl) w = w.split(`data-term="${hl}"`).join(`data-term="${hl}" class="on"`);
  return pane('How a job gets run', w + `<p class="hp-note">1 to 3 happen on GitHub. 4 to 7 happen in your pool.</p>`);
};

const step = (x) => `<span class="hq-line"><span class="hq-badge" aria-hidden="true">${x.n}</span><span class="hp-note">Box ${x.n}: ${esc(byId[x.box].name)}</span></span>`;
/** One question card: the question as title, a two-sentence answer, one picture, the diagram box it points at. */
const card = (x, { level = 3 } = {}) =>
  pane(x.q, `<div class="hp-def">${step(x)}<p>${esc(x.a)}</p><div class="hq-pic">${x.pic()}</div></div>`, { level, id: `q-${x.id}` });
const grid = (items) => `<div class="ds-card-grid" data-layout-group="true">${items.join('')}</div>`;
const btn = (label, { primary = false, disabled = false } = {}) => `<button type="button" class="ds-button"${primary ? ' data-part="primary"' : ''}${disabled ? ' disabled' : ''}>${esc(label)}</button>`;

// ---------- G: diagram on top, then the question cards in story order ----------
export function G() {
  return page('One picture, then the questions people ask. Each card names its box.', diagram(), `<h2 class="ds-h2">Questions, in the order a job meets them</h2>`, grid(Q.map((x) => card(x))));
}

// ---------- H: cards arranged along the diagram: GitHub side left, pool side right, care below ----------
export function H() {
  const side = (ids) => ids.map((i) => card(byQ[i])).join('');
  return page(
    'The cards sit under the part of the picture they explain.',
    diagram(),
    `<div class="hq-two"><div class="hq-stack"><h2 class="ds-h2">On GitHub (1 to 3)</h2>${side(['shared', 'else'])}</div><div class="hq-stack"><h2 class="ds-h2">In your pool (4 to 7)</h2><div class="hq-pair">${side(['wait', 'slot', 'rtype', 'budget'])}</div></div></div>`,
    `<h2 class="ds-h2">Looking after the pool (7)</h2><div class="hq-pair">${side(['tray', 'doctor'])}</div>`,
  );
}

// ---------- I: a stepper walks the diagram; one card per step ----------
const STEPS = [['Shared', ['shared']], ['Waiting', ['wait']], ['Slot', ['slot']], ['Budget', ['budget']], ['Runner type', ['rtype']], ['Elsewhere', ['else']], ['Care', ['tray', 'doctor']]];
export function I(cur = 1) {
  const items = STEPS.map(([n], i) => {
    const st = i < cur ? 'done' : i === cur ? 'now' : 'later';
    return `<li class="ds-steps__item" data-standing="${st}"><button type="button" class="ds-steps__button" ${st === 'now' ? 'aria-current="step"' : ''} ${st === 'later' ? 'disabled' : ''}><span class="ds-steps__n" aria-hidden="true">${st === 'done' ? '✓' : i + 1}</span> ${esc(n)}</button></li>`;
  }).join('');
  const ids = STEPS[cur][1];
  const body = ids.length > 1 ? `<div class="hq-pair">${ids.map((i) => card(byQ[i])).join('')}</div>` : card(byQ[ids[0]]);
  const wiz = `<div class="ds-wizard" role="group" aria-label="Tour of how a job gets run"><ol class="ds-steps" aria-label="Steps" data-layout-group>${items}</ol><div class="ds-wizard__body" data-layout-group><p class="ds-text" role="status">Step ${cur + 1} of ${STEPS.length}. The box it is about is marked in the picture.</p>${diagram(byQ[ids[0]].box)}${body}<div class="hq-actions">${btn('Back')}${btn(`Next: ${STEPS[cur + 1][0]}`, { primary: true })}</div></div></div>`;
  return page('Walk through it one step at a time. Or jump to any step you have seen.', wiz);
}

// ---------- J: two columns: the diagram stays in view, the answer changes ----------
export function J(sel = 'wait') {
  const x = byQ[sel];
  const tabs = `<div class="ds-tabs" role="tablist" aria-label="Questions" data-layout-group>${Q.map((y) => `<button role="tab" type="button" class="ds-tab" aria-selected="${y.id === sel}" tabindex="${y.id === sel ? 0 : -1}">${esc(y.q)}</button>`).join('')}</div>`;
  return page(
    'Pick a question. The answer opens beside the picture, and its box lights up.',
    `<div class="hq-side"><div class="hq-sticky">${diagram(x.box)}</div><div class="hq-stack">${pane('Questions', tabs, { level: 2 })}${card(x, { level: 2 })}</div></div>`,
  );
}

// ---------- K: question first; the picture comes last as "the whole story" ----------
export function K(open = 'wait') {
  const search = `<div class="ds-search" role="search"><input class="ds-input" type="text" aria-label="Find a question" placeholder="Find a question" value=""></div>`;
  const rows = Q.map((x) => `<details class="ds-details ds-disclosure"${x.id === open ? ' open' : ''}><summary>${esc(x.q)}</summary><div class="ds-disclosure__body"><div class="hp-def">${step(x)}<p>${esc(x.a)}</p><div class="hq-pic">${x.pic()}</div></div></div></details>`).join('');
  return page(
    'Start with your question. The whole picture is at the end.',
    `<div class="ds-stack" data-gap="tight">${search}<p class="hp-note">8 questions. One is open at a time on a phone.</p></div>`,
    pane('Questions', rows),
    diagram(byQ[open].box),
  );
}

// ---------- the first-run strip (replaces "How crsp works" on the Overview of a new pool) ----------
const helpBtn = (label = 'Open Help') => btn(label, { primary: true });
export const STRIPS = {
  G: () => `<div class="hq-strip">${chainWide()}${chainTall()}<span>${helpBtn('Open Help')}</span></div>`,
  H: () => `<div class="hq-strip"><span class="hq-row">${['Repository', 'Run', 'Job', 'Queue', 'Slot', 'Runner', 'Machine'].map((t, i) => `<span class="hq-line"><span class="hq-badge">${i + 1}</span> ${t}</span>`).join('')}</span><span>${helpBtn('Open Help')}</span></div>`,
  I: () => `<div class="hq-strip">${chainWide()}${chainTall()}<span class="hp-note">A 7-step tour explains each box.</span><span>${helpBtn('Start the tour')}</span></div>`,
  J: () => `<div class="hq-strip">${chainWide()}${chainTall()}<span class="hq-line"><a class="ds-link" href="#">Why is my job waiting?</a> <a class="ds-link" href="#">What is a slot?</a> <a class="ds-link" href="#">What does shared mean?</a></span><span>${helpBtn()}</span></div>`,
  K: () => `<div class="hq-strip"><span class="hq-qs"><a class="ds-link" href="#">Why is my job waiting?</a><a class="ds-link" href="#">What is a slot?</a><a class="ds-link" href="#">What does shared mean?</a><a class="ds-link" href="#">What is the load budget?</a></span><span>${helpBtn('See all questions')}</span></div>`,
};

// ---------- D: the ? popover next to Slots on the Overview machine card ----------
const POP_LINK = { G: 'More about slots: the card in Help', H: 'See slots at box 5 in Help', I: 'Walk through step 3 in Help', J: 'Show the Slot box in Help', K: 'Read this question in Help' };
export const popHtml = (k) => {
  const used = m1.slots_used; const total = m1.settings.job_slots;
  return `<span class="hp-anchor"><button type="button" class="ds-button hp-ask" aria-label="What is a slot?" aria-expanded="true" aria-haspopup="dialog">?</button><div class="ds-popover" role="dialog" aria-label="Slot" aria-modal="false"><div class="hp-def"><b>Slot</b><span>Room for one job at a time. ${esc(m1.name)} has ${total}: ${used} busy, ${total - used} free.</span>${mini.slots(total, used)}<div class="hq-actions"><a class="ds-link" href="#">${esc(POP_LINK[k])}</a>${btn('Close')}</div></div></div></span>`;
};
