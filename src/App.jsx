import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import EmployeePortal from './pages/EmployeePortal';
import Tasks from './pages/Tasks';
import Pricing from './pages/Pricing';
import OrgSignup from './pages/OrgSignup';
import OrgDashboard from './pages/OrgDashboard';
import DspdPortal from './pages/DspdPortal';
import PreEtsEmployerPortal from './pages/PreEtsEmployerPortal';
import PreEtsPortal from './pages/PreEtsPortal';
import PreEtsTimeEntries from './pages/PreEtsTimeEntries';
import Agents from './pages/Agents';
import AppAnalytics from './pages/AppAnalytics';
import Cohorts from './pages/Cohorts';
import CohortDetail from './pages/CohortDetail';
import FeaturePermissions from './pages/FeaturePermissions';
import { AuthProvider, useAuth, classifyUserAccess } from '@/lib/AuthContext';
import { ViewAsProvider } from '@/lib/ViewAsContext';
import AccessDenied from '@/components/AccessDenied';
import InvitationRequired from '@/components/InvitationRequired';
import { isAdmin } from '@/lib/utils';
import SmartLanding from '@/components/SmartLanding';
import CETrainingPortal from './pages/CETrainingPortal';
import CETrainingNav from '@/components/ce-training/CETrainingNav';
import CEInstructorStudents from './pages/CEInstructorStudents';
import PlatformPricingManager from './pages/PlatformPricingManager';


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

const Spinner = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

const AuthenticatedApp = () => {
  const { authState, user, navigateToLogin } = useAuth();
  const _isAdmin = isAdmin(user);

  // ── Loading / invite check in progress ───────────────────────────────────
  if (authState === 'loading' || authState === 'checking_invite') {
    return <Spinner />;
  }

  // ── Not signed in → redirect to login ────────────────────────────────────
  if (authState === 'unauthenticated') {
    navigateToLogin();
    return null;
  }

  // ── Account deactivated by admin ─────────────────────────────────────────
  if (authState === 'deactivated') {
    return <AccessDenied user={user} deactivated />;
  }

  // ── Stale session after invite apply → prompt sign-out/in ────────────────
  if (authState === 'stale_session') {
    return <AccessDenied user={user} forceActivated />;
  }

  // ── No matching invite found ──────────────────────────────────────────────
  if (authState === 'no_invite') {
    return <InvitationRequired user={user} />;
  }

  // ── CRITICAL ACCESS GATE — classify confirmed user ────────────────────────
  if (user) {
    const accessClass = classifyUserAccess(user);

    // Still denied even after upgrade check (bad role/access combo)
    if (accessClass === 'denied') {
      return <AccessDenied user={user} />;
    }

    // CE Training users: render CE Training portal ONLY
    if (accessClass === 'ce_training') {
      return (
        <CETrainingNav user={user}>
          <Routes>
            <Route path="/" element={<CETrainingPortal />} />
            <Route path="/CETrainingPortal" element={<CETrainingPortal />} />
            <Route path="/Cohorts" element={<Cohorts />} />
            <Route path="/CohortDetail" element={<CohortDetail />} />
            <Route path="/CEInstructorStudents" element={<CEInstructorStudents />} />
            <Route path="*" element={<CETrainingPortal />} />
          </Routes>
        </CETrainingNav>
      );
    }

    // Client portal users: render portal routes ONLY — never mount staff layout
    if (accessClass === 'client_portal') {
      const ClientPortal = Pages['ClientPortal'];

      if (user?.role === 'pre_ets') {
        return (
          <Routes>
            <Route path="*" element={<PreEtsPortal />} />
          </Routes>
        );
      }

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

    // Shouldn't happen — belt-and-suspenders spinner
    if (accessClass !== 'staff') {
      return <Spinner />;
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
           {Object.entries(Pages)
        .filter(([path]) => path !== "PreEtsPortal")
        .map(([path, Page]) => (
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
      <Route path="/DspdPortal" element={<Navigate to="/Clients?type=dspd" replace />} />
      <Route path="/PreEtsEmployerPortal" element={<PreEtsEmployerPortal />} />

<Route
  path="/PreEtsTimeEntries"
  element={
    <LayoutWrapper currentPageName="PreEtsTimeEntries">
      <PreEtsTimeEntries />
    </LayoutWrapper>
  }
/>

<Route path="/Agents" element={<LayoutWrapper currentPageName="Agents"><Agents /></LayoutWrapper>} />
<Route path="/AppAnalytics" element={<LayoutWrapper currentPageName="AppAnalytics"><AppAnalytics /></LayoutWrapper>} />
<Route path="/Cohorts" element={<LayoutWrapper currentPageName="Cohorts"><Cohorts /></LayoutWrapper>} />
<Route path="/CohortDetail" element={<LayoutWrapper currentPageName="CohortDetail"><CohortDetail /></LayoutWrapper>} />
      <Route path="/Tasks" element={<LayoutWrapper currentPageName="Tasks"><Tasks /></LayoutWrapper>} />
          <Route path="/FeaturePermissions" element={<LayoutWrapper currentPageName="FeaturePermissions"><FeaturePermissionsGated /></LayoutWrapper>} />
      <Route path="/PlatformPricingManager" element={<LayoutWrapper currentPageName="PlatformPricingManager"><PlatformPricingManager /></LayoutWrapper>} />
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
