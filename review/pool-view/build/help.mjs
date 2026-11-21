// LOOK51: Help as sub-sections. Same content, four layouts (tabs, cards, reasons-first, live). New words go to `content`.
import { esc, pane, page, status, tag, code, level, table, facts, msg, stepChart, freeCpu, capacity, tabs, labelTable } from './parts2.mjs';
import { machines, M, J, jobs, SIZES, REASONS, runners, labels, usedNow } from './model.mjs';

const chips = (a) => `<div class="pv-tags">${a.map(tag).join('')}</div>`;
const live = (html) => `<div class="pv-stack"><p class="pv-note"><b>In your pool right now</b></p>${html}</div>`;

export const SECTIONS = [
  { id: 'pool', t: 'Pool and load budget', q: 'How much of a machine can jobs use?',
    s: 'Each machine offers a pool of CPU and memory. The pool sits inside the load budget: at most 85% of memory and 60% of CPU. Runners do not own CPUs; they share the pool.',
    pts: ['The pool is what is left after the budget.', 'Jobs use the pool while they run and give it back when they end.', 'You set the budget per machine in Machines.'],
    d: () => live(machines.map((m) => `<div class="pv-stack"><b>${esc(m.name)}</b>${capacity(m.id)}</div>`).join('')) },
  { id: 'types', t: 'Runner types', q: 'What is persistent and what is ephemeral?',
    s: 'A persistent runner stays on the machine and keeps its files. An ephemeral runner is made for one job and removed after it.',
    pts: ['Persistent: keeps caches, listener is gated by crsp.', 'Ephemeral (JIT): made only when there is room.', '"Runner type" is the word in the console.'],
    d: () => table('Runner types', ['Runner', 'Machine', 'Type', 'Size'], runners.map((r) => [code(r.name), esc(M[r.m].name), tag(r.type), tag(r.size)])) },
  { id: 'sizes', t: 'Size classes', q: 'What do small, medium, large and xl mean?',
    s: 'A size class is a ceiling for one job: CPU and memory. Defaults are 2/4, 4/8, 8/16 and 16/32 (CPU / GiB). Presets: Standard, Compact, Memory-heavy, or Custom.',
    pts: ['A job is admitted only if it fits its class ceiling and the free pool.', 'A hard memory cap applies to each job.', 'Edit classes in Size and backends.'],
    d: () => table('Size classes', ['Class', 'CPU', 'Memory', 'Fits on'], Object.entries(SIZES).map(([k, [c, g]]) => [tag(k), c, `${g} GiB`, machines.filter((m) => m.cpu >= c && m.mem >= g).map((m) => esc(m.name)).join(', ') || status('failed', 'no machine')])) },
  { id: 'admission', t: 'Admission and passing', q: 'When does a job start, and why did a later one go first?',
    s: 'A job is admitted when its CPU and memory fit the free pool and the class ceiling. Lighter jobs may pass a big one that does not fit yet.',
    pts: ['Check 1: class ceiling. Check 2: free CPU. Check 3: free memory.', 'A big job can be passed up to 3 times, or for 10 min.', 'Then it is reserved (see Reservation).'],
    d: () => live(`<ul class="pv-flow"><li data-on><b>e2e-1 needs</b><span>3 CPU / 6 GiB (medium ✓)</span></li><li data-bad><b>GameRoomPC</b><span>free 1 CPU / 0 GiB: memory short</span></li><li data-bad><b>BuildTower</b><span>free 4.5 / 11, but reserved for build</span></li><li><b>Result</b><span>${status('waiting', 'Waiting for room')} about 14:13</span></li></ul>`) },
  { id: 'reservation', t: 'Reservation and backfill', q: 'Why is a big job not starved?',
    s: 'After 3 passes or 10 min a big job is reserved and the pool drains for it. While it is reserved, a later job starts only if it is forecast to end before the big job starts (backfill).',
    pts: ['Without protection small jobs can keep a big job waiting for ever.', 'With a reservation it starts when the running jobs end.', 'build: reserved 14:09, starts about 14:16.'],
    d: () => `<div class="pv-grid two"><div>${freeCpu('bad')}<p class="pv-note">Without protection</p></div><div>${freeCpu('good')}<p class="pv-note">With reservation from minute 10: build starts at 12</p></div></div>` },
  { id: 'size-source', t: 'Where a job size comes from', q: 'How does crsp know what a job needs?',
    s: 'First a guess from a scan of the workflow and tests (counts, workers, shards, services). After about 5 runs it uses measured peaks. An override in the console or .crsp.yml always wins.',
    pts: ['Order: override, measured, scan, default.', 'The console always says which one it used.', 'Fix a wrong guess with an override.'],
    d: () => live(table('Job sizes', ['Job', 'Size', 'Needs', 'Source'], jobs.map((j) => [code(j.id), tag(j.size), `${j.cpu} CPU / ${j.mem} GiB`, `${tag(j.src)} <span class="pv-note">${esc(j.srcNote)}</span>`]))) },
  { id: 'before', t: 'Before a job is assigned', q: 'What happens while a job is queued?',
    s: 'Until a runner is assigned the job waits queued on GitHub, and no job clock runs. crsp makes ephemeral (JIT) runners only when there is room, with one warm runner per busy label set.',
    pts: ['Queued on GitHub: waiting for admission.', 'Hold in the hook: up to 2 min.', 'Runner start-up: up to 2 min.'],
    d: () => `<ul class="pv-flow"><li><b>1 Queued on GitHub</b><span>no clock</span></li><li><b>2 Admitted</b><span>room found</span></li><li><b>3 Hold in hook</b><span>max 2 min</span></li><li><b>4 Runner start-up</b><span>2 min</span></li><li data-on><b>5 Job</b><span>30 min from first real step</span></li></ul>` },
  { id: 'gating', t: 'Gated persistent runners', q: 'Why is my own machine runner idle?',
    s: 'A persistent runner on the machine is gated: its listener is on only while crsp admits a job. Off means it is not broken; it is waiting for crsp to admit.',
    pts: ['Listener on: job admitted.', 'Listener off: nothing admitted.', 'GitHub never offers a job to an off listener.'],
    d: () => live(table('Gated runners', ['Runner', 'Listener'], runners.filter((r) => r.type === 'persistent').map((r) => [code(r.name), esc(r.listener)]))) },
  { id: 'labels', t: 'Routing labels', q: 'How does a job find its runner?',
    s: 'crsp makes a label per job name, like crsp-e2e-7f3a, and writes it to a repo variable that runs-on reads, with a fallback to RUNS_ON_<OS>. Only runners crsp chose carry it. Over the label cap, same-size job names share a label.',
    pts: ['One label per job name.', 'The fallback keeps jobs running if crsp is off.', 'A shared label looks like crsp-large-4c1d.'],
    d: () => live(labelTable()) },
  { id: 'timers', t: 'Timers', q: 'Why was my job stopped?',
    s: 'crsp owns six timers. When one runs out there is a 30 s grace with a countdown, then the runner stops (job timer) or the run is cancelled (run timer).',
    pts: ['Queued on GitHub: no limit from crsp.', 'Hold 2 min, start-up 2 min, job 30 min, run 45 min.', 'GitHub timeout-minutes (60) is the safety net.'],
    d: () => table('Timers', ['Timer', 'Limit', 'Starts when', 'Then'], [['Queued on GitHub', '—', 'job is queued', 'waits for admission'], ['Hold in the hook', '2 min', 'runner picks the job', 'job starts or is released'], ['Runner start-up', '2 min', 'runner is made', 'runner is removed'], ['Job', '30 min', 'first real step', 'grace 30 s, then runner stops'], ['Run', '45 min', 'first job real start', 'grace 30 s, then run cancelled'], ['GitHub timeout-minutes', '60 min', 'job start', 'safety net']]) + `<div class="pv-stack" style="margin-block-start:var(--ds-space-3)">${msg('problem', 'Job timer ran out at 30:00; stopping in 30 s. <b>Stop now</b> or <b>Extend 10 min</b>.', 'rust')}</div>` },
  { id: 'reasons', t: 'Reading the plan', q: 'What does a waiting reason mean?',
    s: 'Every queued job has one reason in plain words, a short code for support, and what would change it.',
    pts: ['Waiting for room: pool is full right now.', 'Reserved: pool drains for it.', 'No runner fits: size or OS has no runner.'],
    d: () => table('Reasons', ['Reason', 'Code', 'What would change it'], Object.entries(REASONS).filter(([k]) => k !== 'running').map(([k, r]) => [status(r.kind, r.word), code(r.code), esc(r.fix)])) },
];
const sec = (id) => SECTIONS.find((s) => s.id === id);
const body = (s, { diagram = true } = {}) => `<div class="pv-stack"><p class="ds-text">${esc(s.s)}</p><ul class="ds-list">${s.pts.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>${diagram ? s.d() : ''}</div>`;
const SUB = [['pool', 'Pool'], ['types', 'Runner types'], ['sizes', 'Size classes'], ['admission', 'Admission'], ['reservation', 'Reservation'], ['size-source', 'Job size'], ['before', 'Before assignment'], ['gating', 'Gating'], ['labels', 'Routing labels'], ['timers', 'Timers'], ['reasons', 'Reading the plan']];

/** Layout 'tabs': sub-sections as a tab row on the existing Help page; static pictures; "See it live" link. */
export const helpTabs = (cur = 'admission') => page('Help', 'How crsp runs your jobs, in short sections.', tabs('Help sections', SUB, cur), pane(sec(cur).t, body(sec(cur)) + `<p><a class="ds-link" href="#">See it live in Pool</a></p>`));
/** Layout 'cards': the question cards of today, each opening a section; shown open at one section. */
export const helpCards = (cur = 'labels') => page('Help', 'Pick a question.', `<div class="ds-card-grid">${SECTIONS.map((s) => `<section class="ds-pane" aria-label="${esc(s.t)}"><h2 class="ds-pane__title"><span class="ds-clamp">${esc(s.q)}</span></h2><div class="ds-pane__body"><p class="ds-text">${esc(s.s.split('. ')[0])}.</p></div><div class="ds-pane__actions">${btn2(s.id === cur ? 'Open (shown below)' : 'Open')}</div></section>`).join('')}</div>`, pane(sec(cur).t, body(sec(cur))));
const btn2 = (l) => `<span class="ds-button-wrap"><button type="button" class="ds-button">${esc(l)}</button></span>`;
/** Layout 'reasons': starts from "why is my job waiting" (reason codes), then the concepts behind each reason. */
export const helpReasons = () => page('Help', 'Start from what you see.', pane('Why is my job waiting?', sec('reasons').d()), `<div class="pv-grid two">${['admission', 'reservation', 'labels', 'timers'].map((id) => pane(sec(id).t, `<p class="ds-text">${esc(sec(id).s)}</p><p><a class="ds-link" href="#">Read more</a></p>`)).join('')}</div>`);
/** Layout 'live': a section list on the left, the section on the right, every picture drawn from the user's own pool. */
export const helpLive = (cur = 'admission') => page('Help', 'How crsp runs jobs. Pictures use your own pool.', `<div class="pv-cols l3"><nav aria-label="Help sections"><ul class="pv-nav">${SUB.map(([id, t], i) => `<li><a href="#"${id === cur ? ' aria-current="page"' : ''}><span class="pv-num">${i + 1}</span>${esc(t)}</a></li>`).join('')}</ul></nav><div class="pv-stack">${pane(sec(cur).t, body(sec(cur)))}<p class="pv-note">Next: <a class="ds-link" href="#">${esc(sec(SUB[(SUB.findIndex((x) => x[0] === cur) + 1) % SUB.length][0]).t)}</a></p></div></div>`);
export const helpSection = (id) => pane(sec(id).t, body(sec(id)));
