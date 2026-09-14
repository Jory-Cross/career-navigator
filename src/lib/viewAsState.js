// Module-level View As (impersonation) state, shared outside React so
// base44.auth.me() can present the impersonated user everywhere.
let _viewAsUser = null;

export function getViewAsUser() {
  return _viewAsUser;
}

export function setViewAsUser(target) {
  _viewAsUser = target || null;
}

export function applyViewAs(user) {
  if (!user || !_viewAsUser) return user;
  return { ...user, ..._viewAsUser };
}