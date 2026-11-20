// LOOK42: the term map every proposal uses. Words follow docs/design-system/v2/content.md.
// group: who (GitHub side) | pool (your side) | wait | care | more
export const GROUPS = {
  github: 'On GitHub',
  pool: 'In your pool',
  wait: 'Waiting',
  care: 'Looking after it',
};
export const T = [
  { id: 'account', group: 'github', name: 'GitHub account or organisation', short: 'Account', line: 'Owns repositories. You sign in with it.', ex: 'octo, acme', rel: ['repo'] },
  { id: 'repo', group: 'github', name: 'Repository', line: 'A GitHub project. It uses the pool once you choose it.', ex: 'octo/app', rel: ['workflow', 'pool', 'limit'] },
  { id: 'workflow', group: 'github', name: 'Workflow', line: 'A file in the repository that says what to run.', ex: 'ci.yml', rel: ['run', 'labels'] },
  { id: 'run', group: 'github', name: 'Run', line: 'One start of a workflow, for example a push.', ex: 'Run #8133', rel: ['workflow', 'job'] },
  { id: 'job', group: 'github', name: 'Job', line: 'One part of a run. It asks for a runner by label.', ex: 'e2e, lint, build', rel: ['run', 'labels', 'queue'] },
  { id: 'labels', group: 'github', name: 'Labels (runs-on)', line: 'Words on a job and on a runner. They must match.', ex: 'self-hosted, linux, x64', rel: ['job', 'runner'] },
  { id: 'pool', group: 'pool', name: 'Shared Pool', line: 'One pool of machines. Every repository you choose shares it.', ex: '3 repositories, 2 machines', rel: ['repo', 'machine'] },
  { id: 'machine', group: 'pool', name: 'Machine', line: 'A computer you add. It holds runners and does the work.', ex: 'build-1 (Linux), win-box (Windows)', rel: ['runner', 'slot', 'budget'] },
  { id: 'runner', group: 'pool', name: 'Runner', line: 'A GitHub self-hosted runner that crsp keeps on a machine.', ex: 'crsp-linux-1', rel: ['machine', 'rtype', 'slot'] },
  { id: 'rtype', group: 'pool', name: 'Runner type', line: 'Persistent keeps its tools. Ephemeral is fresh for every job.', ex: 'persistent, ephemeral', rel: ['runner', 'caches'] },
  { id: 'slot', group: 'pool', name: 'Slot', line: 'Room for one job at a time on a machine.', ex: 'Slots 2 of 4: two jobs run, two are free', rel: ['machine', 'budget', 'queue'] },
  { id: 'budget', group: 'pool', name: 'Load budget', line: 'How busy a machine may get: 85% memory, 60% CPU.', ex: 'Memory 62% of 85%', rel: ['slot', 'queue'] },
  { id: 'queue', group: 'wait', name: 'Queue', line: 'Jobs wait here, one queue per machine, until a slot is free.', ex: '2 queued jobs', rel: ['slot', 'why', 'limit'] },
  { id: 'why', group: 'wait', name: 'Why jobs wait', line: 'The first thing that holds a job, said in words.', ex: 'No free slot: 2 ahead in the queue.', rel: ['queue', 'limit', 'budget'] },
  { id: 'limit', group: 'wait', name: 'Parallel limit', line: 'Most jobs one repository may run at once in the pool.', ex: 'octo/app: 2 at a time', rel: ['repo', 'queue'] },
  { id: 'paused', group: 'wait', name: 'Not taking jobs', line: 'A machine that is paused, on battery or in quiet hours takes no new job.', ex: 'Paused, On battery, Quiet hours', rel: ['machine', 'why'] },
  { id: 'caches', group: 'care', name: 'Images and caches', line: 'Images are what a container runner starts from. Caches keep downloads.', ex: 'Ubuntu 24.04 image, 3.2 GB tool cache', rel: ['rtype'] },
  { id: 'doctor', group: 'care', name: 'Doctor', line: 'Reads the whole pool and lists problems, each with one fix.', ex: 'No machine is up for Windows', rel: ['machine', 'runner'] },
  { id: 'tray', group: 'care', name: 'Tray app', line: 'A small icon on the PC: open the console, pause, update.', ex: 'Pause for 1 hour', rel: ['paused'] },
  { id: 'elsewhere', group: 'wait', name: 'Run elsewhere', line: 'A job that a runner outside the pool runs.', ex: 'a GitHub-hosted runner', rel: ['job', 'pool'], note: 'Owner wording. Not in the docs yet.' },
  { id: 'insights', group: 'care', name: 'Run insights', line: 'Wait and run time of finished jobs, as numbers and charts.', ex: 'Median wait 12 s', rel: ['charts'], note: 'Owner wording. Not in the docs yet.' },
  { id: 'charts', group: 'care', name: 'Charts', line: 'The Jobs tab with run time, jobs per day and busiest hours.', ex: 'Busiest hours', rel: ['insights'] },
];
export const byId = Object.fromEntries(T.map((t) => [t.id, t]));
export const nm = (id) => byId[id].short ?? byId[id].name;
