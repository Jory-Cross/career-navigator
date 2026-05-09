import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';

const AuthContext = createContext();

// ─── Access Classification ────────────────────────────────────────────────────
// Returns one of: 'staff' | 'client_portal' | 'pre_ets_employer_portal' | 'denied'
// STRICT: any blank/invalid role or access_level → denied
export const classifyUserAccess = (user) => {
  if (!user) return 'denied';

  const role = user.role;
  // access_level may be top-level or nested under user.data (view-as mode)
  const access = user.access_level ?? user.data?.access_level;

  // Staff CRM access: explicit staff roles + matching access_level
  if (['admin', 'management', 'employee'].includes(role) && ['staff', 'admin'].includes(access)) {
    return 'staff';
  }

  // Client portal access: client roles + client_portal access_level
  if (['client', 'pre_ets', 'dspd'].includes(role) && access === 'client_portal') {
    return 'client_portal';
  }

  // Pre-ETS Employer portal: restricted to weekly form only
  if (role === 'pre_ets_employer' && access === 'pre_ets_employer_portal') {
    return 'pre_ets_employer_portal';
  }

  // Everything else (role="user", blank access_level, mismatches) → denied
  return 'denied';
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      
      // First, check app public settings (with token if available)
      // This will tell us if auth is required, user not registered, etc.
      const appClient = createAxiosClient({
        baseURL: `/api/apps/public`,
        headers: {
          'X-App-Id': appParams.appId
        },
        token: appParams.token, // Include token if available
        interceptResponses: true
      });
      
      try {
        const publicSettings = await appClient.get(`/prod/public-settings/by-id/${appParams.appId}`);
        setAppPublicSettings(publicSettings);
        
        // If we got the app public settings successfully, check if user is authenticated
        if (appParams.token) {
          await checkUserAuth();
        } else {
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
        }
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.error('App state check failed:', appError);
        
        // Handle app-level errors
        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;
          if (reason === 'auth_required') {
            setAuthError({
              type: 'auth_required',
              message: 'Authentication required'
            });
          } else if (reason === 'user_not_registered') {
            setAuthError({
              type: 'user_not_registered',
              message: 'User not registered for this app'
            });
          } else {
            setAuthError({
              type: reason,
              message: appError.message
            });
          }
        } else {
          setAuthError({
            type: 'unknown',
            message: appError.message || 'Failed to load app'
          });
        }
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      // Now check if the user is authenticated
      setIsLoadingAuth(true);
      let currentUser = await base44.auth.me();

      // ── Invite upgrade path ──────────────────────────────────────────────
      // If this user has no role/access_level yet (e.g. existed before invite),
      // attempt to apply any pending role assignment, then re-fetch the user.
      const needsUpgrade = !currentUser?.role || currentUser.role === 'user' || !currentUser?.access_level;
      if (needsUpgrade) {
        try {
          const result = await base44.functions.invoke('applyPendingRoleIfNeeded', {});
          if (result?.data?.upgraded) {
            console.log('[Auth] Pending role applied, re-fetching user...');
            currentUser = await base44.auth.me();
          }
        } catch (upgradeErr) {
          // Non-fatal — if upgrade fails, user stays denied which is correct
          console.warn('[Auth] applyPendingRoleIfNeeded failed:', upgradeErr?.message);
        }
      }
      // ────────────────────────────────────────────────────────────────────

      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      console.log(`[Auth] user=${currentUser?.email} role=${currentUser?.role} access_level=${currentUser?.access_level} → ${classifyUserAccess(currentUser)}`);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      
      // If user auth fails, it might be an expired token
      if (error.status === 401 || error.status === 403) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
      }
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    
    if (shouldRedirect) {
      // Use the SDK's logout method which handles token cleanup and redirect
      base44.auth.logout(window.location.href);
    } else {
      // Just remove the token without redirect
      base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    // Use the SDK's redirectToLogin method
    base44.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState,
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