// The words of the Help page (LOOK44), in one place: the parts of the job path, the three steps and the answers.
// English only. Each answer is one or two short sentences (content.md, Help words).
import type { JobPathGroup, JobPathPart } from '@crsp/ui';

export const PATH_GROUPS: readonly JobPathGroup[] = [
  { id: 'github', label: 'On GitHub' },
  { id: 'pool', label: 'In your pool' },
];

export const PATH_PARTS: readonly JobPathPart[] = [
  { id: 'repository', title: 'Repository', line: 'a GitHub project', group: 'github' },
  { id: 'run', title: 'Run', line: 'one start of a workflow', group: 'github' },
  { id: 'job', title: 'Job', line: 'asks for a runner', group: 'github' },
  { id: 'queue', title: 'Queue', line: 'waits for a slot', group: 'pool' },
  { id: 'slot', title: 'Slot', line: 'room for one job', group: 'pool' },
  { id: 'runner', title: 'Runner', line: 'does the work', group: 'pool' },
  { id: 'machine', title: 'Machine', line: 'your computer', group: 'pool' },
];

export interface HelpStep {
  name: string;
  /** The parts of the picture this step lights. */
  lit: readonly string[];
  lead: string;
}

export const STEPS: readonly HelpStep[] = [
  {
    name: 'On GitHub',
    lit: ['repository', 'run', 'job'],
    lead: 'Parts 1 to 3 happen on GitHub. A push starts a run, and each job of the run asks for a runner by its labels.',
  },
  {
    name: 'In your pool',
    lit: ['queue', 'slot', 'runner', 'machine'],
    lead: 'Parts 4 to 7 happen in your pool. crsp queues the job, waits for a free slot on a machine, and a runner there does the work.',
  },
  {
    name: 'Looking after the pool',
    lit: [],
    lead: 'The Doctor, the tray app and the images and caches keep the pool working.',
  },
];

/** A card of the Questions section. `step` is the index of the step it belongs to. */
export interface HelpCard {
  id: string;
  step: number;
  title: string;
  answer: string;
}

export const CARDS: readonly HelpCard[] = [
  {
    id: 'q-shared',
    step: 0,
    title: 'What does shared mean?',
    answer:
      'Every repository you turn the pool on for uses the same machines and runners.',
  },
  {
    id: 'q-run',
    step: 0,
    title: 'What are a run and a job?',
    answer:
      'A run is one start of a workflow, for example a push. A job is one part of a run.',
  },
  {
    id: 'q-labels',
    step: 0,
    title: 'What are labels?',
    answer:
      'Words on a job and on a runner. A job goes to a runner that has all of its labels.',
  },
  {
    id: 'q-elsewhere',
    step: 0,
    title: 'What does Run elsewhere mean?',
    answer:
      'Another runner runs the job, not your pool, for example a GitHub-hosted runner.',
  },
  {
    id: 'q-waiting',
    step: 1,
    title: 'Why is my job waiting?',
    answer:
      'A job waits for a reason: no free slot, over the load budget, or a limit. The Jobs page says which, in words.',
  },
  {
    id: 'q-slot',
    step: 1,
    title: 'What is a slot?',
    answer:
      'Room for one job at a time on a machine. Pool size makes slots: you set memory and CPUs on Pool size, and crsp turns that into slots, the number of jobs that run at once.',
  },
  {
    id: 'q-budget',
    step: 1,
    title: 'What is the load budget?',
    answer: 'The most memory and CPU a machine may use for jobs. Over it, new jobs wait.',
  },
  {
    id: 'q-queue',
    step: 1,
    title: 'What is the queue?',
    answer:
      'Jobs wait in a queue, one for each machine, until a slot is free. The first job takes it.',
  },
  {
    id: 'q-runner-type',
    step: 1,
    title: 'What is a runner type?',
    answer:
      'Persistent keeps its tools and caches. Ephemeral is fresh for every job. Linux or Windows is the system, not the type.',
  },
  {
    id: 'q-doctor',
    step: 2,
    title: 'What is the Doctor?',
    answer: 'It reads the whole pool and lists the problems it finds, each with one fix.',
  },
  {
    id: 'q-tray',
    step: 2,
    title: 'What is the tray app?',
    answer:
      'A small icon on the PC. From it you open the console, pause the pool or update crsp.',
  },
  {
    id: 'q-images',
    step: 2,
    title: 'What are images and caches?',
    answer:
      'Images are what a container runner starts from. Caches keep downloads, so the next job starts faster.',
  },
];

/** The terms that carry a ? in the console, with the answer shown in the popover. */
export const TERMS = {
  slot: {
    term: 'Slots',
    card: 'q-slot',
    answer: CARDS.find((c) => c.id === 'q-slot')!.answer,
  },
  budget: {
    term: 'Load budget',
    card: 'q-budget',
    answer: CARDS.find((c) => c.id === 'q-budget')!.answer,
  },
  queue: {
    term: 'Queue',
    card: 'q-queue',
    answer: CARDS.find((c) => c.id === 'q-queue')!.answer,
  },
  runnerType: {
    term: 'Runner type',
    card: 'q-runner-type',
    answer: CARDS.find((c) => c.id === 'q-runner-type')!.answer,
  },
  elsewhere: {
    term: 'Run elsewhere',
    card: 'q-elsewhere',
    answer: CARDS.find((c) => c.id === 'q-elsewhere')!.answer,
  },
} as const;

export type TermKey = keyof typeof TERMS;

/** The step a card belongs to: a link ending in `#q-slot` opens that step. */
export function stepOfCard(id: string): number | undefined {
  return CARDS.find((c) => c.id === id)?.step;
}
