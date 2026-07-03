# Career Navigator / Ability4Hire — Agent Rules

## Security Remediation Freeze
Only work directly related to the active security remediation plan is allowed.
Do not implement unrelated UI, UX, CE features, pricing, integrations, migrations, or ordinary bug fixes.
Record unrelated work as backlog only.

## Git Workflow
- Never push directly to main.
- Create one focused branch and pull request per task.
- Never merge pull requests.
- Never force-push.
- Do not modify files outside the stated task scope.
- Do not delete historical records, invitations, billing records, enrollments, or audit data.

## Security Requirements
- Never trust caller-supplied user IDs, organization IDs, client IDs, roles, manager IDs, cohort IDs, billing IDs, or email identity.
- Resolve the authenticated user, then re-fetch the canonical User record server-side.
- Enforce organization scope server-side on every read and write.
- Do not expose raw HTTP status codes or internal errors in user-facing responses.
- Never reveal, add, rotate, log, or request secrets, tokens, API keys, Stripe keys, or Resend credentials.
- PendingRoleAssignment is invitation and audit data, not standing authorization.
- CE role activation and CE cohort membership may occur only through the secure authenticated applyPendingRoleIfNeeded workflow.
- Stripe checkout and webhook processing may settle billing and enrollment state but must not directly assign User roles, accept PendingRoleAssignments, or create CE cohort memberships.

## Change Rules
- Make the smallest safe change.
- Before editing, inspect the complete target file and relevant dependencies.
- Report changed files, security reasoning, checks run, checks not run, and unresolved risks.
- Do not claim a test passed unless it was actually run and its result is shown.

## Review Focus
Treat tenant isolation, authorization bypass, payment-state errors, role assignment, invitation lifecycle, Stripe webhook handling, and destructive data changes as critical issues.
