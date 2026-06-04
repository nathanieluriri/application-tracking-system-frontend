import { AppError, ErrorCode, authPermissionDenied } from "@server/core/errors";
import { hasPermission, type PermissionList } from "@server/security/permissions";
import { requireUser, requireAdmin } from "@server/http/guards";
import { AccountStatus } from "@server/schemas/common";
import { retrieveUserById } from "@server/services/users";
import { retrieveAdminById } from "@server/services/admins";
import { publicUser, type UserOut } from "@server/schemas/users";
import { publicAdmin, type AdminOut } from "@server/schemas/admins";

/**
 * Account-status + permission guards, mirrors
 * `security/account_status_check.py`. The caller passes the backend-style
 * permission key (e.g. "GET:/applications") that the route corresponds to.
 */

function validatePermissionList(
  list: PermissionList | null | undefined,
): asserts list is PermissionList {
  if (!list || !list.permissions || list.permissions.length === 0) {
    throw new AppError({
      status: 403,
      code: ErrorCode.AUTH_PERMISSION_DENIED,
      message: "No permissions assigned",
    });
  }
}

function ensurePermission(list: PermissionList, permissionKey: string): void {
  const method = permissionKey.split(":")[0] || "GET";
  if (!hasPermission(list, { key: permissionKey, name: permissionKey, method })) {
    throw authPermissionDenied(permissionKey);
  }
}

export async function checkUserAccountStatusAndPermissions(
  req: Request,
  permissionKey: string,
): Promise<UserOut> {
  const principal = await requireUser(req);
  const user = await retrieveUserById(principal.userId).catch(() => null);
  if (!user) {
    throw new AppError({
      status: 401,
      code: ErrorCode.AUTH_PRINCIPAL_NOT_FOUND,
      message: "User not found",
    });
  }
  if (user.accountStatus !== AccountStatus.ACTIVE) {
    throw new AppError({
      status: 403,
      code: ErrorCode.AUTH_ACCOUNT_INACTIVE,
      message: "User account is not active",
    });
  }
  validatePermissionList(user.permissionList);
  ensurePermission(user.permissionList, permissionKey);
  return publicUser(user);
}

export async function checkAdminAccountStatusAndPermissions(
  req: Request,
  permissionKey: string,
): Promise<AdminOut> {
  const principal = await requireAdmin(req);
  const admin = await retrieveAdminById(principal.userId).catch(() => null);
  if (!admin) {
    throw new AppError({
      status: 401,
      code: ErrorCode.AUTH_PRINCIPAL_NOT_FOUND,
      message: "Admin not found",
    });
  }
  if (admin.accountStatus !== AccountStatus.ACTIVE) {
    throw new AppError({
      status: 403,
      code: ErrorCode.AUTH_ACCOUNT_INACTIVE,
      message: "Admin account is not active",
    });
  }
  validatePermissionList(admin.permissionList);
  ensurePermission(admin.permissionList, permissionKey);
  return publicAdmin(admin);
}
