/** Show local administrator counts and the five newest posts with shared mutations. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPosts, getUsers } from '../../utils/storage.js';
import { getSession } from '../../utils/auth.js';
import { formatPostDate } from '../../utils/dateFormat.js';
import { getAvatar } from '../../components/Avatar.jsx';
import { deletePost } from '../blog/postService.js';
import { StatCard } from './StatCard.jsx';

const focus = 'rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2';

/**
 * Load browser records and keep the overview unchanged on cancelled or failed writes.
 * Returns:
 *   Four prescribed statistics, recent post actions and administrator quick links.
 * Notes:
 *   The built-in admin is counted once, independently of stored account records.
 */
export default function AdminDashboard() {
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [session, setSession] = useState(getSession);
  const [message, setMessage] = useState('');

  useEffect(function loadOverview() {
    setPosts(getPosts());
    setUsers(getUsers());
    setSession(getSession());
  }, []);

  /** Require a fresh admin identity after confirmation, then use the shared post service. */
  function remove(id) {
    const confirmed = window.confirm('Delete this post? This cannot be undone.');
    const identity = getSession();
    setSession(identity);
    if (!confirmed) {
      setMessage('');
      return;
    }
    if (identity?.role !== 'admin') {
      setMessage('You are not allowed to delete this post.');
      return;
    }
    const result = deletePost(id, confirmed);
    if (result.ok) {
      setPosts(getPosts());
      setMessage('');
    } else {
      setMessage(result.message ?? 'The post could not be deleted. Please try again.');
    }
  }

  const accounts = users.filter((user) => user?.id !== 'admin' && user?.username !== 'admin');
  const adminCount = accounts.filter((user) => user?.role === 'admin').length + 1;
  const recentPosts = [...posts].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 5);
  const isAdmin = session?.role === 'admin';

  return (
    <main id="main-content" className="min-h-screen bg-slate-50 px-4 py-10 font-sans text-slate-800 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="rounded-lg bg-gradient-to-r from-violet-700 to-indigo-700 px-6 py-6 text-white">
          <h1 className="font-editorial text-3xl sm:text-4xl">Admin Dashboard</h1>
          <p className="mt-2 text-sm leading-relaxed">Your local WriteSpace overview. Manage posts and keep writing moving.</p>
        </header>
        <section aria-label="Dashboard statistics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Posts" value={posts.length} />
          <StatCard label="Total Users" value={accounts.length + 1} description="All local accounts, including the built-in admin." />
          <StatCard label="Total Admins" value={adminCount} description="Includes the built-in admin." />
          <StatCard label="Total users" value="—" description="Not defined in this demo" />
        </section>
        {isAdmin && (
          <nav aria-label="Quick actions" className="flex flex-wrap gap-3">
            <Link to="/write" className={`bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-700 ${focus}`}>
              Write New Post
            </Link>
            <Link to="/users" className={`border border-slate-300 bg-white px-4 py-3 font-medium hover:bg-slate-100 ${focus}`}>
              Manage Users
            </Link>
          </nav>
        )}
        <section aria-labelledby="recent-posts-heading">
          <h2 id="recent-posts-heading" className="text-xl font-semibold">Recent Posts</h2>
          <p className="mt-2 text-sm text-slate-600">The five newest posts in this browser profile.</p>
          {message && (
            <p role="alert" className="mt-4 text-sm text-red-700">{message}</p>
          )}
          {recentPosts.length === 0 ? (
            <p className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-slate-600">No posts yet.</p>
          ) : (
            <ul className="mt-6 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
              {recentPosts.map((post) => (
                <li key={post.id} className="flex min-w-0 flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    {getAvatar(post.authorId === 'admin' || accounts.some((user) => user?.id === post.authorId && user.role === 'admin')
                      ? 'admin' : 'user')}
                    <div className="min-w-0">
                      <Link to={`/blog/${post.id}`} className={`break-words font-medium hover:text-indigo-700 ${focus}`}>
                        {post.title}
                      </Link>
                      <p className="mt-1 break-words text-sm text-slate-600">{post.authorName}</p>
                      <time dateTime={Number.isNaN(Date.parse(post.createdAt)) ? undefined : post.createdAt} className="text-sm text-slate-500">
                        {formatPostDate(post.createdAt)}
                      </time>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex shrink-0 gap-2">
                      <Link to={`/edit/${post.id}`} className={`px-4 py-3 text-indigo-700 hover:bg-indigo-50 ${focus}`}>
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => remove(post.id)}
                        className={`px-4 py-3 text-red-700 hover:bg-red-50 ${focus}`}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

AdminDashboard.propTypes = {};
