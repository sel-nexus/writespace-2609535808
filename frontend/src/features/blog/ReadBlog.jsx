/** Render escaped post text and persist only explicitly approved deletions. */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getPosts } from '../../utils/storage.js';
import { getSession } from '../../utils/auth.js';
import { canMutatePost } from '../../utils/permissions.js';
import { getAvatar } from '../../components/Avatar.jsx';
import { formatPostDate } from '../../utils/dateFormat.js';
import { deletePost } from './postService.js';

const focus = 'rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2';

/**
 * Resolve the current route and expose controls only to the owner or administrator.
 * Returns:
 *   Complete whitespace-preserved text or a not-found view, with safe action errors.
 */
export default function ReadBlog() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [message, setMessage] = useState('');
  const [session, setSession] = useState(getSession);
  useEffect(() => {
    setPost(getPosts().find((entry) => entry?.id === id) ?? null);
    setSession(getSession());
    setMessage('');
  }, [id]);

  /** Revalidate after the native dialog and refresh the view on every non-success. */
  function remove() {
    const result = deletePost(id, window.confirm('Delete this post? This cannot be undone.'));
    if (result.ok) {
      navigate(result.nextRoute, { replace: true });
      return;
    }
    setPost(getPosts().find((entry) => entry?.id === id) ?? null);
    setSession(getSession());
    setMessage(result.reason === 'cancelled' ? '' : result.message);
  }

  return (
    <main id="main-content" className="min-h-screen bg-slate-50 px-4 py-12 font-sans text-slate-800 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link to="/blogs" className={`inline-block px-3 py-3 text-indigo-600 hover:bg-indigo-50 ${focus}`}>
          Back to All Posts
        </Link>
        {message && (
          <p role="alert" className="mt-6 text-red-700">{message}</p>
        )}
        {!post ? (
          <h1 className="mt-8 font-editorial text-4xl">Post not found</h1>
        ) : (
          <article className="mt-8 min-w-0">
            <h1 className="break-words font-editorial text-4xl leading-tight">{post.title}</h1>
            <div className="mt-6 flex items-center gap-3">
              {getAvatar(post.authorId === 'admin' ? 'admin' : 'user')}
              <div className="min-w-0">
                <p className="break-words font-medium">{post.authorName}</p>
                <time dateTime={Number.isNaN(Date.parse(post.createdAt)) ? undefined : post.createdAt} className="text-sm text-slate-500">
                  {formatPostDate(post.createdAt)}
                </time>
              </div>
            </div>
            <p className="mt-10 whitespace-pre-wrap break-words text-lg leading-relaxed">{post.content}</p>
            {canMutatePost(session, post) && (
              <div className="mt-10 flex flex-wrap gap-3">
                <Link to={`/edit/${post.id}`} className={`border border-indigo-200 bg-white px-4 py-3 text-indigo-600 ${focus}`}>
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={remove}
                  className={`border border-red-200 bg-red-50 px-4 py-3 font-medium text-red-700 hover:bg-red-100 ${focus}`}
                >
                  Delete
                </button>
              </div>
            )}
          </article>
        )}
      </div>
    </main>
  );
}

ReadBlog.propTypes = {};
