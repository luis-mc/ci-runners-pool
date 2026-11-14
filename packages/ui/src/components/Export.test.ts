// Component 29: the file name comes from the server's Content-Disposition (UX-39).
import { describe, expect, it } from 'vitest';
import { fileNameOf } from './Export';

describe('fileNameOf', () => {
  it('reads the quoted file name', () => {
    expect(fileNameOf('attachment; filename="crsp-jobs-2026-11-14-1005.csv"')).toBe(
      'crsp-jobs-2026-11-14-1005.csv',
    );
  });
  it('reads an unquoted and an encoded name', () => {
    expect(fileNameOf('attachment; filename=a.csv')).toBe('a.csv');
    expect(fileNameOf("attachment; filename*=UTF-8''a%20b.csv")).toBe('a b.csv');
  });
  it('gives nothing when the header has no name', () => {
    expect(fileNameOf(null)).toBeUndefined();
    expect(fileNameOf('attachment')).toBeUndefined();
  });
});
