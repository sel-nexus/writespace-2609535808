/** Format browser post timestamps consistently without depending on local settings. */
const formatter = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC',
});

/**
 * Display a timestamp in English UTC, or a safe label when it is invalid.
 * Args:
 *   iso: Stored timestamp string.
 * Returns:
 *   A date such as Mar 04, 2026, or Date unavailable.
 */
export function formatPostDate(iso) {
  if (typeof iso !== 'string' || iso.trim() === '') return 'Date unavailable';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : formatter.format(date);
}
