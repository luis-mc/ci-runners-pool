// LOOK51: six options. Each returns screens: { key, nav, html }. nav: {tab} an existing tab, or {add} a new tab.
import * as P from './parts2.mjs';
import { jobs, J, machines, M, runners, labels, runs, NOW, hm, REASONS, usedNow, counts } from './model.mjs';
import { helpTabs, helpCards, helpReasons, helpLive, helpSection } from './help.mjs';
const { esc, pane, page, status, tag, code, level, table, facts, msg, btn, tabs, segmented, gantt, stepChart, capacity, timersOf, graceCard, labelTable, reasonStatus, mtag } = P;
const when = (j) => (j.state === 'norunner' ? '—' : ['running', 'grace'].includes(j.state) ? `since ${hm(j.start)}` : `about ${hm(j.start)}`);
const queued = jobs.filter((j) => ['reserved', 'room', 'behind', 'norunner'].includes(j.state));
const live = jobs.filter((j) => ['running', 'grace', 'starting'].includes(j.state));
const kpis = () => `<div class="pv-kpis"><div><span class="pv-note">Running</span><b>3</b><span>1 timer ran out</span></div><div><span class="pv-note">Starting</span><b>1</b><span>mac-sign, 0:50 of 2:00</span></div><div data-t="wait"><span class="pv-note">Queued</span><b>4</b><span>1 reserved, 2 for room</span></div><div data-t="bad"><span class="pv-note">No runner fits</span><b>1</b><span>vm needs xl</span></div></div>`;
const grace = () => msg('problem', `<b>rust</b> job timer ran out at 30:00; stopping in 20 s.`, 'Timer');
const planTable = () => table('Execution plan', ['#', 'Job', 'Why it waits', 'Expected start', 'Machine and runner'], queued.map((j, i) => [i + 1, `${code(j.id)} <span class="pv-note">${esc(j.repo)} ${esc(j.run)}</span>`, `${reasonStatus(j)}`, j.state === 'norunner' ? 'never, as it is' : `about ${hm(j.start)}`, j.m ? `${esc(M[j.m].name)} · ${code(j.runner)}` : 'none']));
const runTable = () => table('Running jobs', ['Job', 'Machine and runner', 'Size', 'Job timer', 'Run timer'], live.map((j) => {
  const r = runs.find((x) => x.id === j.run && x.repo === j.repo); const el = NOW - j.start;
  const jt = j.state === 'grace' ? `${status('failed', 'ran out 30:00')} stopping in 20 s` : j.state === 'starting' ? `${status('info', 'start-up')} 0:50 of 2:00` : `${Math.floor(el)}:${String(Math.floor((el % 1) * 60)).padStart(2, '0')} of 30:00`;
  const rel = NOW - r.start; return [`${code(j.id)} ${reasonStatus(j)}`, `${esc(M[j.m].name)} · ${code(j.runner)}`, `${tag(j.size)} ${j.cpu} / ${j.mem}`, jt, `${Math.floor(rel)}:${String(Math.floor((rel % 1) * 60)).padStart(2, '0')} of 45:00`];
}));
const machinePanes = () => `<div class="pv-grid">${machines.map((m) => pane(m.name, `<p class="pv-note">${m.note}</p>${capacity(m.id)}${stepChart(m.id, 'cpu')}`, { count: usedNow(m.id).jobs.length + ' jobs' })).join('')}</div>`;
const wait = (j) => `<span class="pv-note">${esc(REASONS[j.state].word)}</span>`;

// ---------- A: a new Pool tab, live view ----------
const A = {
  id: 'A', title: 'Pool tab: one live view', screens: [
    { key: 'live', nav: { add: 'Pool' }, html: page('Pool', 'What is queued, what is running, and where.', tabs('Pool views', [['live', 'Live'], ['plan', 'Plan'], ['labels', 'Labels'], ['timers', 'Timers']], 'live'), kpis(), grace(), pane('Jobs over time', `<p class="pv-note">Each row is a job. Colour is the machine. Dashed means waiting. Forecast ends are dashed outlines.</p>${gantt(jobs)}`, { count: '9 jobs' }), machinePanes()) },
    { key: 'plan', nav: { add: 'Pool' }, html: page('Pool', 'What is queued, what is running, and where.', tabs('Pool views', [['live', 'Live'], ['plan', 'Plan'], ['labels', 'Labels'], ['timers', 'Timers']], 'plan'), pane('Execution plan', `<p class="pv-note">Forecast from each running job's size and measured length. Updated every few seconds.</p>${planTable()}`, { count: '4 queued' }), pane('Reservation', `<p class="ds-text"><b>build</b> was passed 3 times, so it is reserved on BuildTower since 14:09. The pool drains for it. Later jobs start only if forecast to end before 14:16.</p>${level('Free CPU on BuildTower', 4.5, 8, '4.5 of 8 needed')}`)) },
    { key: 'labels', nav: { add: 'Pool' }, html: page('Pool', 'What is queued, what is running, and where.', tabs('Pool views', [['live', 'Live'], ['plan', 'Plan'], ['labels', 'Labels'], ['timers', 'Timers']], 'labels'), pane('Routing labels', `<p class="pv-note">A workflow's runs-on reads the repo variable and falls back to RUNS_ON_&lt;OS&gt;. Only runners crsp chose carry the label.</p>${labelTable()}`, { count: '7' })) },
    { key: 'timers', nav: { add: 'Pool' }, html: page('Pool', 'What is queued, what is running, and where.', tabs('Pool views', [['live', 'Live'], ['plan', 'Plan'], ['labels', 'Labels'], ['timers', 'Timers']], 'timers'), grace(), pane('Running jobs and their timers', runTable(), { count: '4' }), pane('rust', graceCard(J.rust))) },
  ], help: () => helpTabs('admission'),
};

// ---------- B: capacity strip on Machines + queue plan on Jobs ----------
const B = {
  id: 'B', title: 'Machines strip + Jobs queue plan', screens: [
    { key: 'machines', nav: { tab: 'Machines' }, html: page('Machines', 'Each machine, its pool and its runners.', `<div class="pv-stack">${machines.map((m) => pane(m.name, `<div class="pv-grid two"><div class="pv-stack"><p class="pv-note">${m.note}. Budget: memory 85%, CPU 60%.</p>${capacity(m.id)}${table('Runners on ' + m.name, ['Runner', 'Type', 'Size', 'Label now'], runners.filter((r) => r.m === m.id).map((r) => [code(r.name), tag(r.type), tag(r.size), `<span class="pv-code">${esc(r.label)}</span>`]))}</div><div class="pv-grid two">${stepChart(m.id, 'cpu')}${stepChart(m.id, 'mem')}</div></div>`, { count: usedNow(m.id).jobs.length + ' running' })).join('')}</div>`) },
    { key: 'jobs', nav: { tab: 'Jobs' }, html: page('Jobs', 'Queue plan first, then running jobs.', pane('Queue plan', `<p class="pv-note">In the order crsp will start them.</p>${planTable()}`, { count: '4 queued' }), pane('Running', runTable(), { count: '4' }), pane('Routing labels in use', labelTable())) },
  ], help: () => helpCards('labels'),
};

// ---------- C: Execution plan built around reason codes ----------
const reasonCard = (j) => `<div class="pv-rank"><div><span class="pv-num">${queued.indexOf(j) + 1}</span><div class="pv-stack"><div class="pv-row"><span><b>${esc(j.id)}</b> <span class="pv-note">${esc(j.repo)} ${esc(j.run)}</span></span>${status(REASONS[j.state].kind, REASONS[j.state].word)} ${tag(REASONS[j.state].code)}</div>${level('CPU needed', j.cpu, 16, `${j.cpu} (free where it could go: ${j.id === 'vm' ? 'none, largest pool 8' : j.m === 'M1' ? '1' : '4.5'})`)}${level('Memory needed', j.mem, 32, `${j.mem} GiB (free: ${j.id === 'vm' ? 'none' : j.m === 'M1' ? '0 on GameRoomPC' : '11 on BuildTower'})`)}<p class="ds-text">${esc(REASONS[j.state].fix)}</p><div class="pv-tags">${tag('size ' + j.size + ' from ' + j.src)}${tag(j.label)}${j.m ? tag('plan: ' + M[j.m].name + ' ' + hm(j.start)) : ''}</div>${j.risk ? msg('needs-you', esc(j.risk) + ' Extend the run timer or split the job.', 'At risk') : ''}</div></div></div>`;
const C = {
  id: 'C', title: 'Execution plan around reason codes', screens: [
    { key: 'plan', nav: { add: 'Plan' }, html: page('Plan', 'Why each queued job waits, and when it should start.', segmented('Filter by reason', [['all', 'All 4'], ['room', 'Waiting for room 2'], ['res', 'Reserved 1'], ['nr', 'No runner fits 1']], 'all'), pane('Queue, in start order', queued.map(reasonCard).join(''), { count: '4' }), `<div class="pv-grid two">${pane('Reservation', `<p class="ds-text"><b>build</b> reserved since 14:09 after 3 passes. Drains BuildTower. Backfill: later jobs start only if forecast to end before 14:16.</p>${freeChart()}`)}${pane('Where running jobs are going', runTable())}</div>`) },
    { key: 'norunner', nav: { add: 'Plan' }, html: page('Plan', 'Why each queued job waits, and when it should start.', segmented('Filter by reason', [['all', 'All 4'], ['room', 'Waiting for room 2'], ['res', 'Reserved 1'], ['nr', 'No runner fits 1']], 'nr'), pane('Queue, in start order', reasonCard(J.vm), { count: '1' }), msg('needs-you', 'vm will not start by itself. Lower its size to large in the console, or add a machine with 16 CPU and 32 GiB.', 'Needs you')) },
  ], help: () => helpReasons(),
};
function freeChart() { return `<div class="pv-grid two"><div>${P.freeCpu('bad')}<p class="pv-note">Without protection</p></div><div>${P.freeCpu('good')}<p class="pv-note">Reserved from minute 10</p></div></div>`; }

// ---------- D: Overview redesign ----------
const D = {
  id: 'D', title: 'Overview redesign', screens: [
    { key: 'overview', nav: { tab: 'Overview' }, html: page('Overview', 'The pool at a glance. Open a card for the detail.', kpis(), `<div class="ds-message" data-tone="problem" role="alert"><span class="ds-message__label">✕ Timer</span><span class="ds-message__body"><b>rust</b> job timer ran out at 30:00; stopping in 20 s. <a class="ds-link" href="#">Open rust</a></span></div>`, `<div class="pv-grid">${machines.map((m) => pane(m.name, capacity(m.id) + `<p class="pv-note">${usedNow(m.id).jobs.map((j) => j.id).join(', ') || 'idle'}</p>`, { count: m.note.replace('pool ', '') })).join('')}</div>`, `<div class="pv-grid two">${pane('Next to start', queued.slice(0, 3).map((j) => `<div class="pv-row"><span>${code(j.id)} ${reasonStatus(j)}</span><span class="pv-note">${j.state === 'norunner' ? 'no runner' : 'about ' + hm(j.start)}</span></div>`).join('') + `<p><a class="ds-link" href="#">See the whole plan (4)</a></p>`, { count: '4' })}${pane('Routing labels', `<div class="pv-tags">${labels.slice(0, 5).map((l) => tag(l.label)).join('')}</div><p><a class="ds-link" href="#">See all 7 labels</a></p>`)}</div>`, pane('Jobs over the next 30 minutes', gantt(jobs.filter((j) => j.state !== 'norunner'), { from: 24, to: 54 }) + `<p><a class="ds-link" href="#">Open the full timeline</a></p>`)) },
  ], help: () => helpTabs('pool'),
};

// ---------- E: why-waiting inspector ----------
const row = (j) => `<tr><td>${code(j.id)}<br><span class="pv-note">${esc(j.repo)} ${esc(j.run)}</span></td><td>${reasonStatus(j)}</td><td>${j.m ? esc(M[j.m].name) : '—'}</td><td>${j.state === 'norunner' ? '—' : when(j)}</td></tr>`;
const jobsList = (sel) => `<div class="ds-table-frame"><table class="ds-table"><caption class="ds-visually-hidden">Jobs</caption><thead><tr><th scope="col">Job</th><th scope="col">Status</th><th scope="col">Machine</th><th scope="col">Start</th></tr></thead><tbody>${jobs.map((j) => row(j).replace('<tr>', `<tr${j.id === sel ? ' aria-selected="true" style="background:var(--ds-color-selection)"' : ''}>`)).join('')}</tbody></table></div>`;
const why = (j) => { const cand = machines.map((m) => { let r; if (j.os === 'macOS' ? m.id !== 'M3' : j.os === 'Windows' ? m.id !== 'M1' : m.id === 'M3') r = status('off', 'wrong OS'); else if (j.id === 'vm') r = status('failed', `pool ${m.cpu}/${m.mem} is smaller than 16/32`); else if (m.id === 'M2' && j.state !== 'reserved' && j.state !== 'running') r = status('waiting', 'reserved for build, 14:16'); else if (m.id === 'M1' && j.state !== 'running') r = status('waiting', 'memory: 0 of 6 GiB free'); else r = status('ok', 'fits'); return [esc(m.name), r]; }); return table('Why not each machine', ['Machine', 'Result'], cand); };
const inspector = (j, { side = true } = {}) => `<aside class="pv-sheet ${side ? 'side' : ''}" aria-label="Why ${esc(j.id)} is ${esc(REASONS[j.state].word.toLowerCase())}"><div class="pv-sheet-h"><div><h2 class="ds-h2">${esc(j.id)}: ${esc(REASONS[j.state].word)}</h2><p class="pv-note">${esc(j.repo)} ${esc(j.run)} · ${tag(REASONS[j.state].code)}</p></div>${btn('Close')}</div><p class="ds-text">${esc(REASONS[j.state].fix)}</p>${j.state === 'grace' ? graceCard(j) : ''}${j.id === 'vm' || j.state === 'grace' || j.state === 'running' || j.state === 'starting' ? '' : why(j)}${j.id === 'vm' ? why(j) : ''}${facts([['Needs', `${j.cpu} CPU / ${j.mem} GiB (${tag(j.size)})`], ['Size from', `${tag(j.src)} ${esc(j.srcNote)}`], ['Label', `<span class="pv-code">${esc(j.label)}</span>`], ['Plan', j.m ? `${esc(M[j.m].name)} · ${code(j.runner)} · ${hm(j.start)}` : 'none']])}${`<p class="pv-note">This job on the timeline</p>` + gantt([j], { runTick: false, from: 15, to: 50, compact: true })}${timersOf(j)}<p><a class="ds-link" href="#">Learn: ${j.state === 'norunner' ? 'size classes' : j.state === 'reserved' ? 'reservation and backfill' : j.state === 'grace' ? 'timers' : 'admission and passing'}</a></p></aside>`;
const jobsScreen = (j, wide = true) => page('Jobs', 'Open a job to see why it waits.', `<div class="pv-cols r3"><div class="pv-stack">${jobsList(j.id)}</div>${inspector(j)}</div>`);
const E = {
  id: 'E', title: 'Slide-over inspector on every job row', screens: [
    { key: 'room', nav: { tab: 'Jobs' }, html: jobsScreen(J['e2e-1']) },
    { key: 'reserved', nav: { tab: 'Jobs' }, html: jobsScreen(J.build) },
    { key: 'norunner', nav: { tab: 'Jobs' }, html: jobsScreen(J.vm) },
    { key: 'grace', nav: { tab: 'Jobs' }, html: jobsScreen(J.rust) },
  ], help: () => helpTabs('reasons'),
};

// ---------- F: Help as a guide with live diagrams ----------
const F = {
  id: 'F', title: 'Help as a live guide', screens: [
    { key: 'admission', nav: { tab: 'Help' }, html: helpLive('admission') },
    { key: 'reservation', nav: { tab: 'Help' }, html: helpLive('reservation') },
    { key: 'labels', nav: { tab: 'Help' }, html: helpLive('labels') },
    { key: 'timers', nav: { tab: 'Help' }, html: helpLive('timers') },
  ], help: () => helpLive('pool'),
};
export const OPTIONS = [A, B, C, D, E, F];
