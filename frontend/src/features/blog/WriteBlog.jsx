/** Publish and revise local plain-text posts without losing failed-save input. */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getPosts } from '../../utils/storage.js';
import { getSession } from '../../utils/auth.js';
import { canMutatePost } from '../../utils/permissions.js';
import { getAvatar } from '../../components/Avatar.jsx';
import { createPost, editPost } from './postService.js';

const focus = 'rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2';
const inputStyle = 'w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500';

/**
 * Preload an eligible edit or present an empty create form.
 * Returns:
 *   Labeled fields with adjacent errors, live counter and safe persistence feedback.
 * Notes:
 *   Services recheck session and ownership at action time, independent of preload.
 */
export default function WriteBlog() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [fields, setFields] = useState({});
  const [message, setMessage] = useState('');
  const [missing, setMissing] = useState(false);
  const [session, setSession] = useState(getSession);

  /** Load fresh text on route changes and reject another author's edit entry. */
  useEffect(function preload() {
    const identity = getSession();
    const post = id ? getPosts().find((entry) => entry?.id === id) : null;
    setSession(identity);
    setMissing(Boolean(id && !post));
    setFields({});
    setMessage('');
    if (post && !canMutatePost(identity, post)) {
      navigate('/blogs', { replace: true });
      return;
    }
    setTitle(typeof post?.title === 'string' ? post.title : '');
    setContent(typeof post?.content === 'string' ? post.content : '');
  }, [id, navigate]);

  /** Validate and navigate only after the posts key has been committed. */
  function submit(event) {
    event.preventDefault();
    const result = id ? editPost(id, { title, content }) : createPost({ title, content });
    setFields(result.fields ?? {});
    setMessage('');
    if (result.ok) navigate(result.nextRoute, { replace: true });
    else if (result.reason === 'missing') setMissing(true);
    else if (result.reason === 'denied' && id) navigate('/blogs', { replace: true });
    else setMessage(result.message ?? '');
  }

  /** Leave unsaved text behind and choose the current detail or list fallback. */
  function cancel() {
    const exists = id && getPosts().some((entry) => entry?.id === id);
    navigate(exists ? `/blog/${id}` : '/blogs');
  }

  return (
    <main id="main-content" className="min-h-screen bg-slate-50 px-4 py-12 font-sans text-slate-800 sm:px-6">
      <div className="mx-auto max-w-3xl">
        {missing ? (
          <>
            <Link to="/blogs" className={`inline-block px-3 py-3 text-indigo-600 hover:bg-indigo-50 ${focus}`}>
              Back to All Posts
            </Link>
            <h1 className="mt-8 font-editorial text-4xl">Post not found</h1>
          </>
        ) : (
          <>
            <h1 className="font-editorial text-4xl">{id ? 'Edit Post' : 'Write a Post'}</h1>
            {session && (
              <div className="mt-6 flex items-center gap-3">
                {getAvatar(session.role)}
                <p className="break-words text-sm text-slate-600">Signed in as {session.displayName}</p>
              </div>
            )}
            <form noValidate onSubmit={submit} className="mt-8 space-y-6">
              <div>
                <label htmlFor="post-title" className="mb-2 block font-medium">Title</label>
                <input
                  id="post-title"
                  required
                  aria-required="true"
                  aria-invalid={Boolean(fields.title)}
                  aria-describedby={fields.title ? 'title-error' : undefined}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className={inputStyle}
                />
                {fields.title && (
                  <p id="title-error" role="alert" className="mt-2 text-sm text-red-700">{fields.title}</p>
                )}
              </div>
              <div>
                <label htmlFor="post-content" className="mb-2 block font-medium">Content</label>
                <textarea
                  id="post-content"
                  required
                  aria-required="true"
                  aria-invalid={Boolean(fields.content)}
                  aria-describedby={fields.content ? 'content-error content-counter' : 'content-counter'}
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  className={`min-h-64 resize-y ${inputStyle}`}
                />
                {fields.content && (
                  <p id="content-error" role="alert" className="mt-2 text-sm text-red-700">{fields.content}</p>
                )}
                <p id="content-counter" role="status" className="mt-2 text-right text-sm tabular-nums text-slate-500">
                  {content.length} characters
                </p>
              </div>
              {message && (
                <p role="alert" className="text-red-700">{message}</p>
              )}
              <div className="flex flex-wrap gap-3">
                <button type="submit" className={`bg-indigo-600 px-5 py-3 font-medium text-white hover:bg-indigo-700 ${focus}`}>
                  {id ? 'Save Changes' : 'Publish Post'}
                </button>
                <button type="button" onClick={cancel} className={`border border-slate-300 px-5 py-3 hover:bg-slate-100 ${focus}`}>
                  Cancel
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

WriteBlog.propTypes = {};
