/** Present the role-aware writing shell and best-effort local logout. */
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { clearSession, getSession } from '../utils/auth.js';
import { getAvatar } from './Avatar.jsx';

const focus = 'rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2';

/**
 * Render desktop/mobile role links with keyboard-safe account and disclosure menus.
 * Returns:
 *   The current session's navigation, or nothing for a guest.
 * Notes:
 *   Failed removal returns to public discovery with a warning when identity remains readable.
 */
export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const session = getSession();

  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (accountOpen) document.getElementById('logout-action')?.focus();
    else if (mobileOpen) document.querySelector('#mobile-navigation a')?.focus();
  }, [accountOpen, mobileOpen]);

  /** Close overlays on Escape and return focus to the relevant trigger. */
  function escape(event) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    if (accountOpen) {
      setAccountOpen(false);
      document.getElementById('account-trigger')?.focus();
    } else if (mobileOpen) {
      setMobileOpen(false);
      document.getElementById('mobile-trigger')?.focus();
    }
  }

  /** Remove only the session and communicate any still-readable local identity. */
  function logout() {
    const result = clearSession();
    const warning = !result.ok && getSession()
      ? 'Logout could not clear your local session. You may still be signed in in this browser.' : null;
    navigate('/', { replace: true, state: { logoutWarning: warning } });
  }

  /** Close disclosures after keyboard focus leaves the navigation boundary. */
  function blur(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setAccountOpen(false);
      setMobileOpen(false);
    }
  }

  if (!session) return null;
  const links = [['/blogs', 'All Blogs'], ['/write', 'Write']];
  if (session.role === 'admin') links.push(['/admin', 'Dashboard'], ['/users', 'Users']);

  /** Render identical destination links for either responsive navigation group. */
  function navigationLinks() {
    return links.map(([to, label]) => (
      <NavLink key={to} to={to} className={'block px-3 py-2 text-sm hover:bg-slate-100 ' + focus}>
        {label}
      </NavLink>
    ));
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white text-slate-800" onKeyDown={escape} onBlur={blur}>
      <nav aria-label="Account navigation" className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link to="/" className={'text-xl font-semibold tracking-tight ' + focus}>WriteSpace</Link>
        <div aria-label="Desktop destinations" className="hidden items-center gap-2 md:flex">
          {navigationLinks()}
        </div>
        <div className="relative flex items-center gap-2">
          <button
            id="mobile-trigger"
            type="button"
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            className={'p-3 md:hidden ' + focus}
            onClick={() => { setMobileOpen(!mobileOpen); setAccountOpen(false); }}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button
            id="account-trigger"
            type="button"
            aria-label={'Account menu for ' + session.displayName}
            aria-expanded={accountOpen}
            aria-controls="account-menu"
            className={'flex items-center gap-2 p-1 ' + focus}
            onClick={() => { setAccountOpen(!accountOpen); setMobileOpen(false); }}
          >
            {getAvatar(session.role)}
            <span className="hidden max-w-48 break-words text-sm font-medium sm:block">{session.displayName}</span>
          </button>
          {accountOpen && (
            <div id="account-menu" className="absolute right-0 top-full mt-2 w-52 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
              <p className="break-words px-3 py-2 text-sm text-slate-600">{session.displayName} · {session.role}</p>
              <button id="logout-action" type="button" onClick={logout} className={'w-full px-3 py-3 text-left hover:bg-slate-100 ' + focus}>
                Logout
              </button>
            </div>
          )}
        </div>
      </nav>
      {mobileOpen && (
        <nav id="mobile-navigation" aria-label="Mobile navigation" className="border-t border-slate-200 px-4 py-3 md:hidden">
          {navigationLinks()}
        </nav>
      )}
    </header>
  );
}

Navbar.propTypes = {};
