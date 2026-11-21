// LOOK51: the one example every option draws. 3 machines, 9 jobs, live states. "Now" is 2026-11-21 14:12:10 (owner zone).
export const T0 = 13 * 60 + 40; // axis starts 13:40
export const SPAN = 60; // minutes shown: 13:40 to 14:40
const tm = (s) => { const [h, m, sec = 0] = s.split(':').map(Number); return h * 60 + m + sec / 60 - T0; };
export const hm = (t) => { const a = Math.round(t + T0); return String(Math.floor(a / 60)).padStart(2, '0') + ':' + String(a % 60).padStart(2, '0'); };
export const NOW = tm('14:12:10');
export const SIZES = { small: [2, 4], medium: [4, 8], large: [8, 16], xl: [16, 32] };
export const CAP = { memPct: 85, cpuPct: 60 };

export const machines = [
  { id: 'M1', name: 'GameRoomPC', os: 'Linux + Windows', cpu: 6, mem: 9, note: 'pool 6 CPU / 9 GiB' },
  { id: 'M2', name: 'BuildTower', os: 'Linux', cpu: 8, mem: 16, note: 'pool 8 CPU / 16 GiB' },
  { id: 'M3', name: 'MacMini', os: 'macOS', cpu: 4, mem: 8, note: 'pool 4 CPU / 8 GiB' },
];
export const M = Object.fromEntries(machines.map((m) => [m.id, m]));

// type: persistent (gated) or ephemeral (JIT). listener only matters for persistent runners.
export const runners = [
  { name: 'gameroom-med-1', m: 'M1', os: 'Linux', size: 'medium', type: 'persistent', state: 'busy', job: 'rust', label: 'crsp-rust-9e02', listener: 'on (admitted rust, 13:42)' },
  { name: 'gameroom-win-1', m: 'M1', os: 'Windows', size: 'small', type: 'persistent', state: 'busy', job: 'win-inst', label: 'crsp-win-inst-88f1', listener: 'on (admitted win-inst, 14:07)' },
  { name: 'tower-small-1', m: 'M2', os: 'Linux', size: 'small', type: 'ephemeral', state: 'busy', job: 'lint', label: 'crsp-small-4c1d', listener: 'JIT, one job' },
  { name: 'tower-small-2', m: 'M2', os: 'Linux', size: 'small', type: 'ephemeral', state: 'busy', job: 'unit', label: 'crsp-small-4c1d', listener: 'JIT, one job' },
  { name: 'tower-large-1', m: 'M2', os: 'Linux', size: 'large', type: 'ephemeral', state: 'planned 14:16', job: 'build', label: 'none yet', listener: 'JIT, made at 14:16' },
  { name: 'macmini-small-1', m: 'M3', os: 'macOS', size: 'small', type: 'persistent', state: 'starting', job: 'mac-sign', label: 'crsp-mac-sign-2d6e', listener: 'on (admitted mac-sign, 14:11)' },
];

// state: running | grace | starting | reserved | room | behind | norunner
export const jobs = [
  { id: 'rust', run: '#8133', repo: 'octo/app', os: 'Linux', size: 'medium', cpu: 3, mem: 6, src: 'measured', srcNote: '6 runs, peak 2.8 CPU / 5.6 GiB', m: 'M1', runner: 'gameroom-med-1', label: 'crsp-rust-9e02', state: 'grace', q: tm('13:41:00'), start: tm('13:42:00'), end: tm('14:12:30'), est: 'about 30 min' },
  { id: 'lint', run: '#8133', repo: 'octo/app', os: 'Linux', size: 'small', cpu: 1.5, mem: 2, src: 'measured', srcNote: '7 runs, peak 1.4 CPU / 1.8 GiB', m: 'M2', runner: 'tower-small-1', label: 'crsp-small-4c1d', state: 'running', q: tm('14:08:20'), wr: tm('14:09:00'), start: tm('14:09:00'), end: tm('14:14:00'), est: 'about 5 min' },
  { id: 'unit', run: '#8133', repo: 'octo/app', os: 'Linux', size: 'small', cpu: 2, mem: 3, src: 'measured', srcNote: '12 runs, peak 1.9 CPU / 2.8 GiB', m: 'M2', runner: 'tower-small-2', label: 'crsp-small-4c1d', state: 'running', q: tm('14:04:20'), wr: tm('14:05:00'), start: tm('14:05:00'), end: tm('14:16:00'), est: 'about 11 min' },
  { id: 'build', run: '#8133', repo: 'octo/app', os: 'Linux', size: 'large', cpu: 8, mem: 16, src: 'override', srcNote: '.crsp.yml says large', m: 'M2', runner: 'tower-large-1', label: 'crsp-build-c4a7', state: 'reserved', q: tm('14:00:00'), start: tm('14:16:00'), end: tm('14:25:00'), est: 'about 9 min', reservedAt: tm('14:09:00'), passes: 3 },
  { id: 'e2e-1', run: '#8133', repo: 'octo/app', os: 'Linux', size: 'medium', cpu: 3, mem: 6, src: 'scan', srcNote: '2 workers, 1 service (no runs yet)', m: 'M1', runner: 'gameroom-med-1', label: 'crsp-e2e-7f3a', state: 'room', q: tm('14:02:00'), start: tm('14:13:00'), end: tm('14:21:00'), est: 'about 8 min' },
  { id: 'e2e-2', run: '#8133', repo: 'octo/app', os: 'Linux', size: 'medium', cpu: 3, mem: 6, src: 'scan', srcNote: '2 workers, 1 service (no runs yet)', m: 'M1', runner: 'gameroom-med-1', label: 'crsp-e2e-7f3a', state: 'behind', q: tm('14:02:10'), start: tm('14:21:00'), end: tm('14:29:00'), est: 'about 8 min', risk: 'Expected end 14:29 is after the run timer (14:27).' },
  { id: 'win-inst', run: '#412', repo: 'octo/desktop', os: 'Windows', size: 'small', cpu: 2, mem: 3, src: 'default', srcNote: 'no scan result, class default', m: 'M1', runner: 'gameroom-win-1', label: 'crsp-win-inst-88f1', state: 'running', q: tm('14:06:00'), wr: tm('14:07:00'), start: tm('14:07:00'), end: tm('14:22:00'), est: 'about 15 min' },
  { id: 'mac-sign', run: '#412', repo: 'octo/desktop', os: 'macOS', size: 'small', cpu: 1, mem: 2, src: 'scan', srcNote: '1 step group, no tests', m: 'M3', runner: 'macmini-small-1', label: 'crsp-mac-sign-2d6e', state: 'starting', q: tm('14:09:00'), wr: tm('14:11:12'), start: tm('14:12:40'), end: tm('14:19:00'), est: 'about 6 min' },
  { id: 'vm', run: '#412', repo: 'octo/desktop', os: 'Linux', size: 'xl', cpu: 16, mem: 32, src: 'override', srcNote: 'console override: xl', m: null, runner: null, label: 'crsp-vm-0b1c', state: 'norunner', q: tm('14:05:00'), est: 'about 20 min' },
];
export const J = Object.fromEntries(jobs.map((j) => [j.id, j]));

export const runs = [
  { id: '#8133', repo: 'octo/app', start: tm('13:42:00'), timer: 45, ends: tm('14:27:00') },
  { id: '#412', repo: 'octo/desktop', start: tm('14:07:00'), timer: 45, ends: tm('14:52:00') },
];

// Labels: repo variable per job name; same-size names share one label when over the cap.
export const LABEL_CAP = 4;
export const labels = [
  { label: 'crsp-small-4c1d', jobs: ['lint', 'unit'], repo: 'octo/app', shared: true, carriers: ['tower-small-1', 'tower-small-2'], fallback: 'RUNS_ON_LINUX' },
  { label: 'crsp-rust-9e02', jobs: ['rust'], repo: 'octo/app', carriers: ['gameroom-med-1'], fallback: 'RUNS_ON_LINUX' },
  { label: 'crsp-build-c4a7', jobs: ['build'], repo: 'octo/app', carriers: [], planned: 'tower-large-1 at 14:16', fallback: 'RUNS_ON_LINUX' },
  { label: 'crsp-e2e-7f3a', jobs: ['e2e-1', 'e2e-2'], repo: 'octo/app', carriers: [], planned: 'gameroom-med-1 at 14:13', fallback: 'RUNS_ON_LINUX' },
  { label: 'crsp-win-inst-88f1', jobs: ['win-inst'], repo: 'octo/desktop', carriers: ['gameroom-win-1'], fallback: 'RUNS_ON_WINDOWS' },
  { label: 'crsp-mac-sign-2d6e', jobs: ['mac-sign'], repo: 'octo/desktop', carriers: ['macmini-small-1'], fallback: 'RUNS_ON_MACOS' },
  { label: 'crsp-vm-0b1c', jobs: ['vm'], repo: 'octo/desktop', carriers: [], planned: 'no runner of size xl', fallback: 'RUNS_ON_LINUX' },
];

// Reason codes (the word the user reads, a short code for support, a one-line "what would change it").
export const REASONS = {
  grace: { word: 'Timer ran out', code: 'TIMER_GRACE', kind: 'failed', fix: 'Stop now, or Extend 10 min. It stops by itself at 14:12:30.' },
  running: { word: 'Running', code: 'RUNNING', kind: 'running', fix: '' },
  starting: { word: 'Runner starting', code: 'STARTING', kind: 'info', fix: 'Start-up allows 2 min. Nothing to do.' },
  reserved: { word: 'Reserved', code: 'RESERVED', kind: 'waiting', fix: 'Pool drains for it. Starts about 14:16 when unit ends.' },
  room: { word: 'Waiting for room', code: 'WAIT_ROOM', kind: 'waiting', fix: 'Starts about 14:13 when rust stops and frees 3 CPU / 6 GiB on GameRoomPC.' },
  behind: { word: 'Behind another job', code: 'BEHIND', kind: 'waiting', fix: 'Same label as e2e-1. Starts about 14:21 when e2e-1 ends.' },
  norunner: { word: 'No runner fits', code: 'NO_RUNNER', kind: 'failed', fix: 'Largest Linux pool is 8 CPU / 16 GiB. Lower the size to large, or add a bigger machine.' },
};

const adm = (j) => (j.state === 'starting' ? j.wr : j.start);
/** Per-machine step series of CPU and memory in use, from the job intervals (running now + forecast). */
export function usage(mid) {
  const ev = new Set([0, SPAN]);
  const mine = jobs.filter((j) => j.m === mid && j.start !== undefined);
  mine.forEach((j) => { ev.add(Math.max(0, adm(j))); ev.add(Math.min(SPAN, j.end)); });
  const ts = [...ev].sort((a, b) => a - b);
  return ts.slice(0, -1).map((t, i) => {
    const mid2 = (t + ts[i + 1]) / 2;
    const on = mine.filter((j) => adm(j) <= mid2 && mid2 < j.end);
    return { t0: t, t1: ts[i + 1], cpu: on.reduce((s, j) => s + j.cpu, 0), mem: on.reduce((s, j) => s + j.mem, 0) };
  });
}
export const usedNow = (mid) => { const on = jobs.filter((j) => j.m === mid && j.start !== undefined && adm(j) <= NOW && NOW < j.end + (j.state === 'grace' ? 1 : 0) && !['reserved', 'room', 'behind'].includes(j.state)); return { cpu: on.reduce((s, j) => s + j.cpu, 0), mem: on.reduce((s, j) => s + j.mem, 0), jobs: on }; };

export const counts = () => ({ running: jobs.filter((j) => ['running', 'grace'].includes(j.state)).length, starting: 1, queued: jobs.filter((j) => ['reserved', 'room', 'behind', 'norunner'].includes(j.state)).length });
