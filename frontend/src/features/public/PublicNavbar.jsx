/** Present public entry actions appropriate to the current local session. */
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { getAvatar } from '../../components/Avatar.jsx';

const focus = 'rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 motion-safe:transition-colors motion-safe:duration-150';

/**
 * Render a sticky public navbar with guest or role-aware account links.
 * Args:
 *   session: Validated local session, or null for a guest.
 * Returns:
 *   Public navigation with a home brand link and accessible entry actions.
 */
export function PublicNavbar({ session = null }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white shadow-sm">
      <nav aria-label="Public navigation" className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link to="/" className={`text-xl font-semibold tracking-tight text-slate-800 ${focus}`}>
          WriteSpace
        </Link>
        {session ? (
          <div className="flex flex-wrap items-center gap-3">
            {getAvatar(session.role)}
            <span className="max-w-40 break-words text-sm font-medium text-slate-800 sm:max-w-64">
              {session.displayName}
            </span>
            <Link to={session.role === 'admin' ? '/admin' : '/blogs'} className={`px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 ${focus}`}>
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-2 sm:gap-4">
            <Link to="/login" className={`px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 ${focus}`}>
              Login
            </Link>
            <Link to="/register" className={`bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 ${focus}`}>
              Get Started
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}

PublicNavbar.propTypes = {
  session: PropTypes.shape({
    userId: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    role: PropTypes.oneOf(['admin', 'user']).isRequired,
  }),
};
