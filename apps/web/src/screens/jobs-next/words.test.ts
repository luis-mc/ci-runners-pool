import { describe, expect, it } from 'vitest';
import type { Forecast } from './model';
import {
  baseJobName,
  forecastOne,
  forecastWords,
  oneNumber,
  ordinal,
  startsWords,
  taskIdOf,
} from './words';

const f = (basis: Forecast['basis']): Forecast => ({
  p50: 420,
  lo: 360,
  hi: 540,
  basis,
  samples: 20,
});

describe('words of the Jobs section', () => {
  it('says one number in a table and a range on a page', () => {
    expect(forecastOne(f('job_key'))).toBe('about 7 min');
    expect(forecastWords(f('job_key'))).toBe('about 6 to 9 min');
  });
  it('labels the typical time under 5 runs of the job', () => {
    expect(forecastOne(f('workflow'))).toBe(
      'not enough history yet (workflow typical about 7 min)',
    );
    expect(forecastWords(f('repository'))).toContain("the repository's typical time");
    expect(forecastOne(f('not_enough_history'))).toBe('not enough history yet');
  });
  it('rounds one number for reading', () => {
    expect(oneNumber(41)).toBe('about 40 s');
    expect(oneNumber(66)).toBe('about 70 s');
    expect(oneNumber(3900)).toBe('about 1 h 5 min');
  });
  it('says the place in line and the start range', () => {
    expect(ordinal(3)).toBe('3rd');
    expect(ordinal(12)).toBe('12th');
    expect(startsWords({ p50: 300, lo: 240, hi: 420 }, 3)).toBe(
      'starts in about 4 to 7 min, 3rd in line',
    );
  });
  it('finds a task id at the start of a branch and a job name without matrix values', () => {
    expect(taskIdOf('RES15-jobs-section')).toBe('RES15');
    expect(taskIdOf('main')).toBeUndefined();
    expect(taskIdOf('feature/series-grouping')).toBeUndefined();
    expect(baseJobName('test [ubuntu, 22]')).toBe('test');
  });
});
