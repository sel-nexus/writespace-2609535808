/** Re-read local identity on every protected route render. */
import PropTypes from 'prop-types';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getSession } from '../utils/auth.js';
import { canAccessRoute } from '../utils/permissions.js';

/**
 * Redirect guests and disallowed roles using the current persisted session.
 * Args:
 *   children: Optional protected content; otherwise render nested routes.
 *   requiredRole: Optional role restriction in addition to pathname access rules.
 * Returns:
 *   Allowed content or a replacing role-correct redirect.
 */
export function ProtectedRoute({ children, requiredRole }) {
  const { pathname } = useLocation();
  const session = getSession();
  const decision = canAccessRoute(session, pathname);
  if (!decision.allow) return <Navigate to={decision.redirectTo} replace />;
  if (requiredRole && session?.role !== requiredRole) {
    return <Navigate to={session ? '/blogs' : '/login'} replace />;
  }
  return children ?? <Outlet />;
}

ProtectedRoute.propTypes = {
  children: PropTypes.node,
  requiredRole: PropTypes.oneOf(['admin', 'user']),
};
