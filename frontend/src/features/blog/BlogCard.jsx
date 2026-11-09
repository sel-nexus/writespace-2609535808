/** Present a plain-text summary with local owner/admin editing affordances. */
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { getAvatar } from '../../components/Avatar.jsx';
import { formatPostDate } from '../../utils/dateFormat.js';
import { canMutatePost } from '../../utils/permissions.js';

const accents = ['border-t-indigo-500', 'border-t-violet-500', 'border-t-pink-500', 'border-t-teal-500'];
const focus = 'rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2';

/**
 * Render a navigable title, exact excerpt, attribution and permitted edit link.
 * Args:
 *   post: Complete stored plain-text post.
 *   index: Position in the sorted list, used for the repeating border accent.
 *   session: Current local reader identity, or null.
 * Returns:
 *   An accessible summary article, without mutation actions for other readers.
 */
export default function BlogCard({ post, index = 0, session = null }) {
  return (
    <article className={`min-w-0 rounded-lg border border-slate-200 border-t-4 bg-white p-6 ${accents[index % 4]}`}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 break-words text-xl font-semibold">
          <Link to={`/blog/${post.id}`} className={`hover:text-indigo-600 ${focus}`}>
            {post.title}
          </Link>
        </h2>
        {canMutatePost(session, post) && (
          <Link to={`/edit/${post.id}`} aria-label={`Edit ${post.title}`} className={`shrink-0 p-3 text-indigo-600 ${focus}`}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
              <path d="m16 3 5 5-12 12H4v-5L16 3Z M14 5l5 5" />
            </svg>
          </Link>
        )}
      </div>
      <p className="mt-4 break-words leading-relaxed text-slate-600">
        {post.content.slice(0, 120)}
      </p>
      <div className="mt-6 flex items-center gap-3">
        {getAvatar(post.authorId === 'admin' ? 'admin' : 'user')}
        <div className="min-w-0 text-sm">
          <p className="break-words font-medium">{post.authorName}</p>
          <time dateTime={Number.isNaN(Date.parse(post.createdAt)) ? undefined : post.createdAt} className="text-slate-500">
            {formatPostDate(post.createdAt)}
          </time>
        </div>
      </div>
    </article>
  );
}

BlogCard.propTypes = {
  post: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    createdAt: PropTypes.string.isRequired,
    authorId: PropTypes.string.isRequired,
    authorName: PropTypes.string.isRequired,
  }).isRequired,
  index: PropTypes.number,
  session: PropTypes.shape({ userId: PropTypes.string, role: PropTypes.string }),
};
