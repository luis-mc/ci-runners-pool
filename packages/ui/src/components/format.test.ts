// R5.32: every date, time, number, size and percent comes from the one formatter (content.md, component 28).
import { describe, expect, it } from 'vitest';
import {
  formatAgo,
  formatCount,
  formatDate,
  formatDateTime,
  formatDuration,
  formatFileStamp,
  formatNumber,
  formatPast,
  formatPercent,
  formatSize,
  formatTime,
  formatTimeLeft,
} from './format';

const d = new Date(2026, 10, 2, 14, 30, 5);

describe('format (content.md)', () => {
  it('writes dates year-month-day and times in 24 hours', () => {
    expect(formatDate(d)).toBe('2026-11-02');
    expect(formatTime(d)).toBe('14:30');
    expect(formatDateTime(d)).toBe('2026-11-02 14:30');
    expect(formatFileStamp(d)).toBe('2026-11-02_14-30-05');
  });

  it('writes numbers with a space for thousands and a dot for decimals', () => {
    expect(formatNumber(12345.5, 1)).toBe('12 345.5');
    expect(formatNumber(7)).toBe('7');
    expect(formatNumber(-1234)).toBe('-1 234');
  });

  it('puts the count before a noun that agrees with it', () => {
    expect(formatCount(1, 'item')).toBe('1 item');
    expect(formatCount(3, 'item')).toBe('3 items');
    expect(formatCount(2, 'repository', 'repositories')).toBe('2 repositories');
  });

  it('writes sizes with a unit and a space, and percents without one', () => {
    expect(formatSize(4_200_000)).toBe('4.2 MB');
    expect(formatSize(512)).toBe('512 B');
    expect(formatPercent(44.6)).toBe('45%');
  });

  it('writes past moments with the exact time first, and never seconds', () => {
    const at = new Date(2026, 10, 2, 14, 30);
    const now = new Date(2026, 10, 2, 14, 35).getTime();
    expect(formatAgo(at, now)).toBe('5 min ago');
    expect(formatPast(at, now)).toBe('2026-11-02 14:30 (5 min ago)');
    expect(formatAgo(at, at.getTime())).toBe('just now');
    expect(formatAgo(at, new Date(2026, 10, 2, 19, 30).getTime())).toBe('5 h ago');
    expect(formatTimeLeft(90_000)).toBe('about 2 min left');
    expect(formatTimeLeft(20_000)).toBe('less than 1 min left');
  });

  it('writes a length of time in short words, never negative', () => {
    expect(formatDuration(0)).toBe('0 s');
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(252)).toBe('4 min 12 s');
    expect(formatDuration(300)).toBe('5 min');
    expect(formatDuration(3900)).toBe('1 h 5 min');
    expect(formatDuration(7200)).toBe('2 h');
    expect(formatDuration(-5)).toBe('0 s');
  });
});
