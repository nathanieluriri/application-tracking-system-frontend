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

/** Default permissions for a self-signup user (none beyond their own profile). */
export function defaultUserPermissions(): PermissionList {
  return {
    permissions: [
      { name: "get_my_users", methods: ["GET"], path: "/users/me", key: "GET:/users/me" },
    ],
  };
}
