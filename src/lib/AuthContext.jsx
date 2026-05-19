import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const AuthContext = createContext();

// ─── Access Classification ────────────────────────────────────────────────────
// Returns one of: 'staff' | 'client_portal' | 'pre_ets_employer_portal' | 'denied'
// STRICT: any blank/invalid role or access_level → denied
export const classifyUserAccess = (user) => {
  if (!user) return 'denied';

  // Explicitly deactivated users are blocked regardless of role/access
  if (user.is_active === false) return 'deactivated';

  const role = user.role;
  const access = user.access_level ?? user.data?.access_level;

  if (['admin', 'management', 'employee'].includes(role) && ['staff', 'admin'].includes(access)) {
    return 'staff';
  }

  if (['client', 'pre_ets', 'dspd'].includes(role) && access === 'client_portal') {
    return 'client_portal';
  }

  if (role === 'pre_ets_employer' && access === 'pre_ets_employer_portal') {
    return 'pre_ets_employer_portal';
  }

  return 'denied';
};

// ─── Auth states ──────────────────────────────────────────────────────────────
// 'loading'          — initial check in progress
// 'unauthenticated'  — no session / base44.auth.me() returned null
// 'checking_invite'  — authenticated but no role yet; running applyPendingRoleIfNeeded
// 'no_invite'        — authenticated, no matching PendingRoleAssignment
// 'ready'            — authenticated + classified access granted
// 'denied'           — authenticated, has a role, but classifyUserAccess returned denied

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authState, setAuthState] = useState('loading'); // see states above
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  // Keep these for compatibility with App.jsx consumers
  const [isLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    initAuth();
  }, []);

  const initAuth = async () => {
    setAuthState('loading');
    setIsLoadingAuth(true);

    try {
      const currentUser = await base44.auth.me();

      if (!currentUser) {
        // Not signed in at all — show sign-in screen
        setUser(null);
        setAuthState('unauthenticated');
        setIsLoadingAuth(false);
        return;
      }

      const accessClass = classifyUserAccess(currentUser);
      console.log(`[Auth] user=${currentUser.email} role=${currentUser.role} access_level=${currentUser.access_level} → ${accessClass}`);

      if (accessClass === 'deactivated') {
        // Explicitly deactivated by an admin — block immediately, no invite check
        setUser(currentUser);
        setAuthState('deactivated');
        setIsLoadingAuth(false);
        return;
      }

      if (accessClass !== 'denied') {
        // User has valid role/access — let them in
        setUser(currentUser);
        setAuthState('ready');
        setIsLoadingAuth(false);
        return;
      }

      // ── Denied: check if they have a pending invite ───────────────────────
      setAuthState('checking_invite');

      try {
        const result = await base44.functions.invoke('applyPendingRoleIfNeeded', {});
        const data = result?.data;

        if (data?.reason === 'deactivated') {
          // applyPendingRoleIfNeeded confirmed this user is deactivated
          setUser(currentUser);
          setAuthState('deactivated');
          setIsLoadingAuth(false);
          return;
        }

        if (data?.upgraded) {
          // Role was applied — need a hard reload to refresh session claims
          console.log('[Auth] Pending role applied — reloading...');
          window.location.reload();
          return;
        }

        if (data?.reason === 'already_assigned') {
          // DB already updated but session claims stale — need sign-out/in
          // Treat as "activated but stale" — re-fetch user to see if it works
          const refreshed = await base44.auth.me();
          const refreshedClass = classifyUserAccess(refreshed);
          if (refreshedClass !== 'denied') {
            setUser(refreshed);
            setAuthState('ready');
            setIsLoadingAuth(false);
            return;
          }
          // Still denied after refresh — need to re-login
          setUser(currentUser);
          setAuthState('stale_session');
          setIsLoadingAuth(false);
          return;
        }

        // No valid pending assignment
        setUser(currentUser);
        setAuthState('no_invite');
        setIsLoadingAuth(false);

      } catch (upgradeErr) {
        console.warn('[Auth] applyPendingRoleIfNeeded failed:', upgradeErr?.message);
        setUser(currentUser);
        setAuthState('no_invite');
        setIsLoadingAuth(false);
      }

    } catch (error) {
      console.error('[Auth] initAuth error:', error);
      // Any error fetching the user — treat as unauthenticated
      setUser(null);
      setAuthState('unauthenticated');
      setIsLoadingAuth(false);
      setAuthError({ type: 'unknown', message: error.message });
    }
  };

  const logout = () => {
    setUser(null);
    setAuthState('unauthenticated');
    base44.auth.logout(window.location.href);
  };

  const navigateToLogin = () => {
    base44.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider value={{
      user,
      authState,
      isAuthenticated: authState === 'ready',
      isLoadingAuth,
      isLoadingPublicSettings, // always false — public app, no gate
      authError,
      appPublicSettings: null,
      logout,
      navigateToLogin,
      checkAppState: initAuth,
      accessClass: user ? classifyUserAccess(user) : null,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};