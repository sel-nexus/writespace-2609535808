/** Present password-free account information in a table row or mobile card. */
import PropTypes from 'prop-types';
import { getAvatar } from '../../components/Avatar.jsx';
import { formatPostDate } from '../../utils/dateFormat.js';
import { canDeleteUser } from '../../utils/permissions.js';

const badges = { admin: 'bg-violet-100 text-violet-800', user: 'bg-indigo-100 text-indigo-800' };

/**
 * Render account identity and an explained, permission-aware delete control.
 * Args:
 *   user: Password-free account display record.
 *   session: Current local administrator snapshot.
 *   onDelete: Handler that rechecks access at mutation time.
 *   mobile: Whether to use semantic card markup rather than a table row.
 * Returns:
 *   A desktop row or mobile list item with no credential rendering.
 */
export default function UserRow({ user, session, onDelete, mobile = false }) {
  const builtIn = user.id === 'admin' || user.username === 'admin';
  const self = user.id === session?.userId;
  const explanation = builtIn ? 'Default admin cannot be deleted'
    : self ? 'You cannot delete your own administrator account.'
      : session?.role !== 'admin' ? 'Only administrators can delete accounts.' : '';
  const descriptionId = `delete-${mobile ? 'card' : 'row'}-${user.id}`;
  const identity = (
    <div className="flex min-w-0 items-center gap-3">
      {getAvatar(user.role)}
      <span className="min-w-0 break-all font-medium">{user.displayName}</span>
    </div>
  );
  const badge = (
    <span role="status" className={`inline-block rounded px-2 py-1 text-xs font-medium ${badges[user.role]}`}>
      {user.role === 'admin' ? 'Admin' : 'user'}
    </span>
  );
  const date = builtIn ? 'Built-in account' : (
    <time dateTime={Number.isNaN(Date.parse(user.createdAt)) ? undefined : user.createdAt}>
      {formatPostDate(user.createdAt)}
    </time>
  );
  const action = (
    <>
      <button
        type="button"
        disabled={!canDeleteUser(session, user)}
        title={explanation || undefined}
        aria-describedby={explanation ? descriptionId : undefined}
        onClick={() => onDelete(user.id)}
        className={'rounded-lg px-3 py-3 text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-500 '
          + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2'}
      >
        Delete
      </button>
      {explanation && (
        <p id={descriptionId} className="mt-1 text-xs text-slate-600">{explanation}</p>
      )}
    </>
  );
  if (mobile) {
    return (
      <li className="min-w-0 space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        {identity}
        <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          <dt className="text-slate-600">Username</dt>
          <dd className="break-all">{user.username}</dd>
          <dt className="text-slate-600">Role</dt>
          <dd>{badge}</dd>
          <dt className="text-slate-600">Created</dt>
          <dd>{date}</dd>
        </dl>
        <div>{action}</div>
      </li>
    );
  }
  return (
    <tr className="border-t border-slate-200 align-top">
      <th scope="row" className="p-4 text-left">{identity}</th>
      <td className="break-all p-4">{user.username}</td>
      <td className="p-4">{badge}</td>
      <td className="p-4 text-sm text-slate-600">{date}</td>
      <td className="p-4">{action}</td>
    </tr>
  );
}

UserRow.propTypes = {
  user: PropTypes.shape({ id: PropTypes.string.isRequired, displayName: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired, role: PropTypes.oneOf(['admin', 'user']).isRequired, createdAt: PropTypes.string }).isRequired,
  session: PropTypes.shape({ userId: PropTypes.string, role: PropTypes.string }),
  onDelete: PropTypes.func.isRequired,
  mobile: PropTypes.bool,
};
