/** Load all browser posts into a newest-first reading grid. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPosts } from '../../utils/storage.js';
import { getSession } from '../../utils/auth.js';
import BlogCard from './BlogCard.jsx';

/**
 * Render the complete local reading list and its empty writing invitation.
 * Returns:
 *   A responsive grid sorted on a copy, never a storage rewrite.
 */
export default function Home() {
  const [posts, setPosts] = useState([]);
  const session = getSession();
  useEffect(() => {
    setPosts([...getPosts()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
  }, []);
  return (
    <main id="main-content" className="min-h-screen bg-slate-50 px-4 py-12 font-sans text-slate-800 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="font-editorial text-4xl">All Blogs</h1>
        {posts.length === 0 ? (
          <div className="mt-8 rounded-lg border border-dashed border-slate-300 p-8">
            <p className="text-slate-600">No blogs yet. Be the first to write one!</p>
            <Link
              to="/write"
              className="mt-6 inline-block rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-700
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              Write
            </Link>
          </div>
        ) : (
          <div aria-label="Blog posts" className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post, index) => (
              <BlogCard key={post.id} post={post} index={index} session={session} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

Home.propTypes = {};
