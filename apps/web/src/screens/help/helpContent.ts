// The words of the Help page (LOOK44, LOOK47), in one place: the parts of the job path and the answers.
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

/** The card a part of the picture scrolls to when it is pressed (LOOK47). Nothing is ever locked. */
export const PART_CARD: Readonly<Record<string, string>> = {
  repository: 'q-shared',
  run: 'q-run',
  job: 'q-labels',
  queue: 'q-queue',
  slot: 'q-slot',
  runner: 'q-runner-type',
  machine: 'q-budget',
};

/** A card of the Questions section. All cards show at once, in the order of the story. */
export interface HelpCard {
  id: string;
  title: string;
  answer: string;
}

export const CARDS: readonly HelpCard[] = [
  {
    id: 'q-shared',
    title: 'What does shared mean?',
    answer:
      'Every repository you turn the pool on for uses the same machines and runners.',
  },
  {
    id: 'q-run',
    title: 'What are a run and a job?',
    answer:
      'A run is one start of a workflow, for example a push. A job is one part of a run.',
  },
  {
    id: 'q-labels',
    title: 'What are labels?',
    answer:
      'Words on a job and on a runner. A job goes to a runner that has all of its labels.',
  },
  {
    id: 'q-elsewhere',
    title: 'What does Run elsewhere mean?',
    answer:
      'Another runner runs the job, not your pool, for example a GitHub-hosted runner.',
  },
  {
    id: 'q-waiting',
    title: 'Why is my job waiting?',
    answer:
      'A job waits for a reason: no free slot, over the load budget, or a limit. The Jobs page says which, in words.',
  },
  {
    id: 'q-slot',
    title: 'What is a slot?',
    answer:
      'Room for one job at a time on a machine. Pool size makes slots: you set memory and CPUs on Pool size, and crsp turns that into slots, the number of jobs that run at once.',
  },
  {
    id: 'q-budget',
    title: 'What is the load budget?',
    answer: 'The most memory and CPU a machine may use for jobs. Over it, new jobs wait.',
  },
  {
    id: 'q-queue',
    title: 'What is the queue?',
    answer:
      'Jobs wait in a queue, one for each machine, until a slot is free. The first job takes it.',
  },
  {
    id: 'q-runner-type',
    title: 'What is a runner type?',
    answer:
      'Persistent keeps its tools and caches. Ephemeral is fresh for every job. Linux or Windows is the system, not the type.',
  },
  {
    id: 'q-doctor',
    title: 'What is the Doctor?',
    answer: 'It reads the whole pool and lists the problems it finds, each with one fix.',
  },
  {
    id: 'q-tray',
    title: 'What is the tray app?',
    answer:
      'A small icon on the PC. From it you open the console, pause the pool or update crsp.',
  },
  {
    id: 'q-images',
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
