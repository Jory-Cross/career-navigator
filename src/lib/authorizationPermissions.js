/**
 * Client authorization permissions.
 *
 * Baseline rule (unchanged hierarchy): platform role or access level of
 * management / admin may add and edit client authorizations.
 *
 * Explicit grants: named staff who may manage authorizations without a role
 * change. This keeps the existing role hierarchy intact — the granted user
 * stays an employee/staff user everywhere else in the app.
 */
export const AUTHORIZATION_MANAGER_EMAILS = [
  "fparrish@enableutah.org", // Faith Parrish
];

export function canManageClientAuthorizations(user) {
  if (!user) return false;
  if (user.role === "admin" || user.role === "management") return true;
  if (user.access_level === "admin" || user.access_level === "management") return true;
  const email = String(user.email || "").trim().toLowerCase();
  return !!email && AUTHORIZATION_MANAGER_EMAILS.includes(email);
}