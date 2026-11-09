/** Introduce the local writing demo and preview its most recent posts. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSession } from '../../utils/auth.js';
import { getPosts } from '../../utils/storage.js';
import { formatPostDate } from '../../utils/dateFormat.js';
import { PublicNavbar } from './PublicNavbar.jsx';

const focus = 'rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 motion-safe:transition-colors motion-safe:duration-150';
const features = [
  { title: 'Write Freely', text: 'Plain-text, distraction-free writing. Let your thoughts take the lead.', path: 'm16 3 5 5-12 12H4v-5L16 3Z M14 5l5 5' },
  { title: 'Private & Local', text: 'Your data stays in this browser profile, not on a server. Local describes location, not confidentiality; do not use sensitive information.', path: 'M3 4h18v13H3V4Z M8 21h8 M12 17v4' },
  { title: 'Instant & Fast', text: 'No application server. Just open your space and start writing or reading.', path: 'm13 2-9 12h7l-1 8 10-12h-7l0-8Z' },
];
const footerLinks = [['Home', '/'], ['All Blogs', '/blogs'], ['Login', '/login'], ['Register', '/register']];

/**
 * Render public discovery with defensive local reads and role-aware links.
 * Returns:
 *   The light hero, feature cards, newest three previews or empty state, and footer.
 * Notes:
 *   Sorting copies the array and never rewrites browser records.
 */
export default function LandingPage() {
  const [session] = useState(getSession);
  const [posts, setPosts] = useState([]);
  useEffect(() => {
    setPosts([...getPosts()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 3));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <PublicNavbar session={session} />
      <main id="main-content">
        <section
          aria-labelledby="hero-heading"
          className="mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.3fr_1fr] lg:gap-20"
        >
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-slate-500">
              A little room for your ideas
            </p>
            <h1 id="hero-heading" className="mt-6 font-editorial text-5xl leading-tight tracking-tight sm:text-7xl">
              WriteSpace
            </h1>
            <p className="mt-6 max-w-lg text-2xl leading-relaxed sm:text-3xl">
              Your thoughts. Your space. Beautifully simple.
            </p>
            <p className="mt-6 max-w-prose leading-relaxed text-slate-600">
              A simple place to write what matters and discover something worth reading.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                to={session ? '/blogs' : '/login'}
                className={`border border-slate-300 bg-white px-6 py-3 text-center font-medium hover:bg-slate-100 ${focus}`}
              >
                Start Reading
              </Link>
              <Link
                to="/register"
                className={`bg-indigo-600 px-6 py-3 text-center font-medium text-white shadow-sm hover:bg-indigo-700 ${focus}`}
              >
                Get Started Free
              </Link>
            </div>
          </div>
          <div aria-hidden="true" className="mx-auto w-full max-w-sm rounded-lg border border-slate-200 bg-white motion-safe:animate-float">
            <div className="h-2 rounded-t-lg bg-gradient-to-r from-indigo-600 via-violet-600 to-pink-500" />
            <div className="p-8">
              <p className="text-xs uppercase tracking-widest text-slate-500">
                Your next story
              </p>
              <p className="mt-6 font-editorial text-3xl leading-snug">
                It starts with a thought.
              </p>
              <p className="mt-4 leading-relaxed text-slate-600">
                A quiet moment. A fresh perspective. A few words that become something more.
              </p>
              <div className="mt-8 h-px bg-slate-200" />
              <div className="mt-4 h-2 w-2/3 rounded bg-slate-100" />
              <div className="mt-3 h-2 w-1/2 rounded bg-slate-100" />
            </div>
          </div>
        </section>
        <section aria-label="Features" className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:px-6 lg:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.title} className="rounded-lg border border-slate-200 bg-white p-8">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-6 w-6 text-indigo-600"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={feature.path} />
              </svg>
              <h2 className="mt-6 text-xl font-semibold">
                {feature.title}
              </h2>
              <p className="mt-3 leading-relaxed text-slate-600">
                {feature.text}
              </p>
            </article>
          ))}
        </section>
        <section aria-labelledby="latest-heading" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 id="latest-heading" className="font-editorial text-3xl sm:text-4xl">
            Latest from the Blog
          </h2>
          {posts.length === 0 ? (
            <p className="mt-8 rounded-lg border border-dashed border-slate-300 p-8 text-slate-600">
              No posts yet — check back soon!
            </p>
          ) : (
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <article key={post.id} className="rounded-lg border border-slate-200 bg-white p-6">
                  <time dateTime={Number.isNaN(Date.parse(post.createdAt)) ? undefined : post.createdAt} className="text-sm text-slate-500">
                    {formatPostDate(post.createdAt)}
                  </time>
                  <h3 className="mt-4 break-words text-xl font-semibold">
                    <Link to={session ? `/blog/${post.id}` : '/login'} className={`text-slate-800 hover:text-indigo-600 ${focus}`}>
                      {post.title}
                    </Link>
                  </h3>
                  <p className="mt-3 break-words leading-relaxed text-slate-600">
                    {post.content.slice(0, 120)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
      <footer className="bg-slate-800 text-slate-100">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-center">
          <p className="text-sm">
            © {new Date().getFullYear()} WriteSpace
          </p>
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-6 gap-y-4 text-sm">
            {footerLinks.map(([label, path]) => (
              <Link key={path} to={path} className={`hover:text-white focus-visible:ring-offset-slate-800 ${focus}`}>
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
