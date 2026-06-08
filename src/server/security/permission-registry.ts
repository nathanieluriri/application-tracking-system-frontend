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
 * Users are granted the same wildcard back-office access as admins: in this
 * product `user` and `admin` are the same operator persona, and the dashboard
 * (and the AI assistant that drives it) must work for both. Destructive/outbound
 * actions taken via the assistant remain confirmation-gated regardless of role.
 * Finer-grained permission lists can still be assigned per user and are honoured
 * by `hasPermission`.
 */
export function defaultUserPermissions(): PermissionList {
  return {
    permissions: [{ name: "superuser", methods: ["*"], path: "*", key: "*" }],
  };
}
