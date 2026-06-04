/**
 * Permission-key derivation + matching, mirrors `security/permissions.py` and
 * the `_has_permission` helper in `security/account_status_check.py`.
 * A permission key is `METHOD:/normalized/path`.
 */

export interface Permission {
  name: string;
  methods: string[];
  path: string;
  key?: string;
  description?: string | null;
}

export interface PermissionList {
  permissions: Permission[];
}

export function makePermissionKey(method: string, path: string): string {
  const normalized =
    "/" +
    path
      .split("/")
      .map((seg) => seg.trim())
      .filter(Boolean)
      .join("/");
  return `${method.toUpperCase()}:${normalized}`;
}

export function hasPermission(
  list: PermissionList,
  ctx: { key: string; name: string; method: string },
): boolean {
  const method = ctx.method.toUpperCase();
  for (const permission of list.permissions) {
    if (permission.key && permission.key === ctx.key) return true;
    // Legacy name+method fallback.
    if (permission.name === ctx.name && permission.methods.map((m) => m.toUpperCase()).includes(method)) {
      return true;
    }
  }
  return false;
}
