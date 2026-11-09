/** Compose the single browser router and implemented local account routes. */
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import LandingPage from './features/public/LandingPage.jsx';
import LoginPage from './features/auth/LoginPage.jsx';
import RegisterPage from './features/auth/RegisterPage.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { Navbar } from './components/Navbar.jsx';

/** Render public discovery with any best-effort logout warning carried by navigation. */
function PublicEntry() {
  const { state } = useLocation();
  return (
    <>
      {state?.logoutWarning && (
        <p role="alert" className="bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">{state.logoutWarning}</p>
      )}
      <LandingPage />
    </>
  );
}

/**
 * Own the only browser router and preserve unknown-route public fallback.
 * Returns:
 *   Implemented public/auth pages and access checks without future-page stubs.
 * Notes:
 *   Final role-home destinations are wired by their respective feature slices.
 */
export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<PublicEntry />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={
          <ProtectedRoute>
            <>
              <Navbar />
              <Navigate to="/" replace />
            </>
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

App.propTypes = {};
