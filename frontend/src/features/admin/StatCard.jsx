/** Present a dashboard metric with an optional explanation of its meaning. */
import PropTypes from 'prop-types';

/**
 * Pair a prescribed label with its value using definition-list semantics.
 * Args:
 *   label: Exact dashboard statistic label.
 *   value: Count or explicit undefined marker.
 *   description: Optional visible explanation, never an inferred formula.
 * Returns:
 *   A flat, accessible statistic card.
 */
export function StatCard({ label, value, description = '' }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-6">
      <dl>
        <dt className="text-sm font-medium text-slate-600">{label}</dt>
        <dd className="mt-3 text-3xl font-semibold tabular-nums text-slate-800">{value}</dd>
      </dl>
      {description && (
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{description}</p>
      )}
    </div>
  );
}

StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  description: PropTypes.string,
};
