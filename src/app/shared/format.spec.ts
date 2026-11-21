import { initials, niceScale, timeAgo } from './format';

describe('format helpers', () => {
  const now = Date.parse('2026-11-21T12:00:00Z');
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it.each([
    [10_000, 'just now'],
    [5 * 60_000, '5 min ago'],
    [3 * 3_600_000, '3 h ago'],
    [26 * 3_600_000, 'yesterday'],
    [5 * 86_400_000, '5 days ago'],
  ])('timeAgo(%i ms) → %s', (ms, expected) => {
    expect(timeAgo(ago(ms), now)).toBe(expected);
  });

  it('timeAgo falls back to a short date after a month', () => {
    expect(timeAgo(ago(60 * 86_400_000), now)).not.toContain('ago');
  });

  it.each([
    [7, { max: 8, step: 2 }],
    [3, { max: 3, step: 1 }],
    [45, { max: 60, step: 20 }],
    [0, { max: 4, step: 1 }],
  ])('niceScale(%i) gives round ticks', (max, expected) => {
    expect(niceScale(max)).toEqual(expected);
  });

  it('initials uses up to two words', () => {
    expect(initials('Riya Reviewer')).toBe('RR');
    expect(initials('Ada')).toBe('A');
    expect(initials(undefined)).toBe('');
  });
});
