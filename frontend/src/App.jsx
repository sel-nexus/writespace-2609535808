/** Compose the single router and a read-only local browser demo welcome. */
import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { getPosts, getUsers } from './utils/storage.js';
import { getSession } from './utils/auth.js';

/** Read a transient display snapshot without modifying persisted records. */
function readSnapshot() {
  return { posts: getPosts().length, users: getUsers().length, session: getSession() };
}

/** Render a complete read-only welcome and an explicit browser-storage boundary. */
function LocalWelcome() {
  const [snapshot, setSnapshot] = useState(readSnapshot);
  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <header className="border-b border-gray-200 bg-white px-6 py-5">
        <p className="mx-auto max-w-3xl text-lg font-semibold">WriteSpace</p>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <p className="text-sm font-medium uppercase tracking-wider text-gray-600">Local browser demo</p>
        <h1 className="mt-4 font-editorial text-4xl leading-tight sm:text-5xl">Welcome to WriteSpace.</h1>
        <p className="mt-6 max-w-prose text-lg leading-relaxed text-gray-700">
          This demo uses browser-only storage. Records stay in this browser profile, with no application server, database, or cross-device synchronization.
        </p>
        <section className="mt-12 border-t border-gray-200 pt-8" aria-labelledby="storage-heading">
          <h2 id="storage-heading" className="text-xl font-semibold">Your local storage</h2>
          <p className="mt-3 leading-relaxed text-gray-700">
            Missing, invalid, or inaccessible records are displayed as empty. Reading never repairs or deletes stored data.
          </p>
          <div className="mt-6" role="status" aria-live="polite" aria-atomic="true">
            <p>Stored posts: {snapshot.posts}</p>
            <p className="mt-2">Stored users: {snapshot.users}</p>
            <p className="mt-2">Local session: {snapshot.session ? `${snapshot.session.displayName} (${snapshot.session.role})` : 'None'}</p>
          </div>
          <button
            type="button"
            onClick={() => setSnapshot(readSnapshot())}
            className="mt-6 rounded-md bg-indigo-600 px-5 py-3 font-medium text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 motion-safe:transition-colors motion-safe:duration-150"
          >
            Refresh storage summary
          </button>
        </section>
        <aside className="mt-12 border-t border-gray-200 pt-8">
          <h2 className="text-xl font-semibold">Demo limitations</h2>
          <p className="mt-3 leading-relaxed text-gray-700">
            Do not use real passwords or sensitive information. Local credentials are plaintext, sessions can be edited in the browser, and client-side checks are not security controls. Clearing browser data removes local records.
          </p>
        </aside>
      </main>
      <footer className="mx-auto max-w-3xl px-6 pb-8 text-sm text-gray-600">WriteSpace · Browser-profile data only</footer>
    </div>
  );
}

/**
 * Own the only browser router and route unknown URLs back to the demo welcome.
 * Returns:
 *   The currently implemented local welcome route, with no missing-feature stubs.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LocalWelcome />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
