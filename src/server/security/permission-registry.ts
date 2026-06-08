import type { PermissionList } from "@server/schemas/common";

/**
 * Default permission sets.
 *
 * The FastAPI source assigned admins only the admin-router permission keys
 * (`default_permissions()`), which does not cover the dashboard data routes
 * (applications, positions, dashboard, …). To deliver a working dashboard, an
 * invited/seeded admin gets a wildcard grant. Finer-grained permission lists
 * can still be assigned per admin and are honoured by `hasPermission`.
 */
export function defaultAdminPermissions(): PermissionList {
  return {
    permissions: [{ name: "superuser", methods: ["*"], path: "*", key: "*" }],
  };
}

/**
 * Default permissions for a self-signup user.
 *
 * ⚠️ SECURITY — DEMO-ONLY WILDCARD GRANT. DO NOT SHIP TO PRODUCTION WITH REAL DATA. ⚠️
 *
 * This hands EVERY self-signup registrant full superuser access (`*`). Because
 * `POST /api/auth/signup` and Google sign-in are PUBLIC and UNAUTHENTICATED,
 * this means ANYONE on the internet who registers becomes a superuser able to:
 *   - read all applicant PII (names, emails, CVs),
 *   - send email from this system, and
 *   - invite/revoke admins (i.e. escalate further and lock out other admins).
 *
 * This is a CRITICAL privilege-escalation surface, accepted DELIBERATELY for a
 * demo deployment that holds no real data (decision by the project owner). An
 * automated security review flagged it as CRITICAL — that flag is correct.
 *
 * BEFORE any real/production use, revert this to least privilege and grant
 * elevated access only via the admin-driven invitation flow:
 *   return { permissions: [{ name: "get_my_users", methods: ["GET"],
 *            path: "/users/me", key: "GET:/users/me" }] };
 * (and/or make signup invite-only / admin-approved).
 */
export function defaultUserPermissions(): PermissionList {
  return {
    permissions: [{ name: "superuser", methods: ["*"], path: "*", key: "*" }],
  };
}
