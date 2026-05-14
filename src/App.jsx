import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import EmployeePortal from './pages/EmployeePortal';
import Tasks from './pages/Tasks';
import Pricing from './pages/Pricing';
import OrgSignup from './pages/OrgSignup';
import OrgDashboard from './pages/OrgDashboard';
import DspdPortal from './pages/DspdPortal';
import PreEtsEmployerPortal from './pages/PreEtsEmployerPortal';
import Agents from './pages/Agents';
import AppAnalytics from './pages/AppAnalytics';
import FeaturePermissions from './pages/FeaturePermissions';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ViewAsProvider } from '@/lib/ViewAsContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AccessDenied from '@/components/AccessDenied';
import { classifyUserAccess } from '@/lib/AuthContext';
import { isAdmin } from '@/lib/utils';
import SmartLanding from '@/components/SmartLanding';


const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

// Admin-only gate for FeaturePermissions page
const FeaturePermissionsGated = () => {
  const { user } = useAuth();
  if (!isAdmin(user)) return <AccessDenied user={user} />;
  return <FeaturePermissions />;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, user } = useAuth();
  const _isAdmin = isAdmin(user);

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  // ── CRITICAL ACCESS GATE ──────────────────────────────────────────────────
  // Classify access BEFORE rendering any routes or layout.
  // This prevents the staff sidebar from ever flashing for portal/denied users.
  if (user) {
    const accessClass = classifyUserAccess(user);

    if (accessClass === 'denied') {
      return <AccessDenied user={user} />;
    }

    // Client portal users: render portal routes ONLY — never mount staff layout
    if (accessClass === 'client_portal') {
      const ClientPortal = Pages['ClientPortal'];
      return (
        <Routes>
          <Route path="*" element={ClientPortal ? <ClientPortal /> : null} />
        </Routes>
      );
    }

    // Pre-ETS Employer portal users: render portal only
    if (accessClass === 'pre_ets_employer_portal') {
      return (
        <Routes>
          <Route path="*" element={<PreEtsEmployerPortal />} />
        </Routes>
      );
    }

    // Staff/admin: only render routes once classification is confirmed as staff
    if (accessClass !== 'staff') {
      return (
        <div className="fixed inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
        </div>
      );
    }
  }

  // Render the main app (staff only reaches here)
  return (
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          {_isAdmin ? <MainPage /> : <SmartLanding user={user} />}
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="/EmployeePortal" element={<LayoutWrapper currentPageName="EmployeePortal"><EmployeePortal /></LayoutWrapper>} />
      <Route path="/DspdPortal" element={<LayoutWrapper currentPageName="DspdPortal"><DspdPortal /></LayoutWrapper>} />
      <Route path="/PreEtsEmployerPortal" element={<PreEtsEmployerPortal />} />
      <Route path="/Agents" element={<LayoutWrapper currentPageName="Agents"><Agents /></LayoutWrapper>} />
      <Route path="/AppAnalytics" element={<LayoutWrapper currentPageName="AppAnalytics"><AppAnalytics /></LayoutWrapper>} />
      <Route path="/Tasks" element={<LayoutWrapper currentPageName="Tasks"><Tasks /></LayoutWrapper>} />
      <Route path="/FeaturePermissions" element={<LayoutWrapper currentPageName="FeaturePermissions"><FeaturePermissionsGated /></LayoutWrapper>} />
      <Route path="/Pricing" element={<Pricing />} />
      <Route path="/OrgSignup" element={<OrgSignup />} />
      <Route path="/OrgDashboard" element={<LayoutWrapper currentPageName="OrgDashboard"><OrgDashboard /></LayoutWrapper>} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <ViewAsProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
      </ViewAsProvider>
    </AuthProvider>
  )
}

export default App