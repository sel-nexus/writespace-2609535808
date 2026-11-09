/** Re-read local identity on every protected route render. */
import PropTypes from 'prop-types';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getSession } from '../utils/auth.js';
import { canAccessRoute } from '../utils/permissions.js';

/**
 * Redirect guests and disallowed roles using the current persisted session.
 * Args:
 *   children: Optional protected content; otherwise render nested routes.
 * Returns:
 *   Allowed content or a replacing role-correct redirect.
 */
export function ProtectedRoute({ children }) {
  const { pathname } = useLocation();
  const decision = canAccessRoute(getSession(), pathname);
  if (!decision.allow) return <Navigate to={decision.redirectTo} replace />;
  return children ?? <Outlet />;
}

ProtectedRoute.propTypes = { children: PropTypes.node };
