/** Verify English UTC date rendering and safe invalid input handling. */
import { describe, expect, it } from 'vitest';
import { formatPostDate } from './dateFormat.js';

describe('formatPostDate', () => {
  it.each([
    ['2026-03-04T12:00:00.000Z', 'Mar 04, 2026'],
    ['2024-02-29T23:59:59Z', 'Feb 29, 2024'],
    ['2026-01-01T00:30:00+02:00', 'Dec 31, 2025'],
    ['2026-12-31T23:30:00-02:00', 'Jan 01, 2027'],
  ])('formats %s as %s', (input, output) => {
    expect(formatPostDate(input)).toBe(output);
  });

  it.each(['not-a-date', '', '  ', undefined, null, 0, {}, [], '2026-99-99'])('returns a safe label for invalid input %s', (input) => {
    expect(formatPostDate(input)).toBe('Date unavailable');
  });
});
