/** Provide static role avatars without uploads or emoji-dependent rendering. */
import PropTypes from 'prop-types';

const roles = {
  admin: { label: 'Admin avatar', color: 'bg-violet-600', path: 'm2 8 5 4 5-8 5 8 5-4-3 12H5L2 8Z M5 17h14' },
  user: { label: 'User avatar', color: 'bg-indigo-500', path: 'M12 6v15 M12 6C9 3 5 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 2Z' },
};

/**
 * Render an accessible circular crown or book avatar, defaulting to user.
 * Args:
 *   role: Local account role; unsupported or missing values use the book.
 * Returns:
 *   A labeled avatar containing a decorative inline SVG.
 */
export function Avatar({ role = 'user' }) {
  const style = Object.hasOwn(roles, role) ? roles[role] : roles.user;
  return (
    <span role="img" aria-label={style.label} className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${style.color}`}>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d={style.path} />
      </svg>
    </span>
  );
}

Avatar.propTypes = { role: PropTypes.string };

/**
 * Supply the reusable role avatar for author and account surfaces.
 * Args:
 *   role: Local account role, with unsupported values defaulting to user.
 * Returns:
 *   A static Avatar element.
 */
export function getAvatar(role) {
  return <Avatar role={role} />;
}
