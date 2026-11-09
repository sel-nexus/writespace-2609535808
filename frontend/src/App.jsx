/** Compose the single browser router and public discovery entry. */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import LandingPage from './features/public/LandingPage.jsx';

/**
 * Own the only browser router and route unknown URLs back to public discovery.
 * Returns:
 *   The implemented landing route, with no missing-feature stubs.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
