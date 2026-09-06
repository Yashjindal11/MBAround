import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { ConfigBanner, Footer, Header } from './components/Layout';
import { AuthProvider } from './lib/auth';
import { ToastProvider } from './components/admin/AdminUI';
import HomePage from './pages/HomePage';
import DeadlinesPage from './pages/DeadlinesPage';
import SchoolsPage from './pages/SchoolsPage';
import SchoolDetailPage from './pages/SchoolDetailPage';
import SuggestPage from './pages/SuggestPage';
import ComparePage from './pages/ComparePage';
import TimelinePage from './pages/TimelinePage';
import { AboutPage, DataSourcesPage, PrivacyPage, TermsPage } from './pages/StaticPages';
import ComingSoonPage from './pages/ComingSoonPage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminSchools from './pages/admin/AdminSchools';
import AdminPrograms from './pages/admin/AdminPrograms';
import AdminCycles from './pages/admin/AdminCycles';
import AdminRounds from './pages/admin/AdminRounds';
import AdminSuggestions from './pages/admin/AdminSuggestions';
import AdminAudit from './pages/admin/AdminAudit';

function ScrollToTop() {
  const { pathname } = useLocation();
  // A block body is required: a concise arrow would return the result of
  // `window.scrollTo`, which React would then treat as a cleanup function.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/** Public chrome. The admin area has its own shell, so it opts out of this. */
function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <ConfigBanner />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ScrollToTop />
          <Routes>
            {/* Admin CMS — authentication + database-enforced authorisation */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="schools" element={<AdminSchools />} />
              <Route path="programs" element={<AdminPrograms />} />
              <Route path="cycles" element={<AdminCycles />} />
              <Route path="rounds" element={<AdminRounds />} />
              <Route path="suggestions" element={<AdminSuggestions />} />
              <Route path="audit" element={<AdminAudit />} />
            </Route>

            {/* Public site */}
            <Route
              path="*"
              element={
                <PublicShell>
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/deadlines" element={<DeadlinesPage />} />
                    <Route path="/schools" element={<SchoolsPage />} />
                    <Route path="/schools/:slug" element={<SchoolDetailPage />} />
                    <Route path="/compare" element={<ComparePage />} />
                    <Route path="/timeline" element={<TimelinePage />} />
                    <Route path="/suggest" element={<SuggestPage />} />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/data-sources" element={<DataSourcesPage />} />
                    <Route path="/privacy" element={<PrivacyPage />} />
                    <Route path="/terms" element={<TermsPage />} />
                    <Route
                      path="*"
                      element={
                        <ComingSoonPage
                          title="Page not found"
                          description="That page doesn't exist."
                        />
                      }
                    />
                  </Routes>
                </PublicShell>
              }
            />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
