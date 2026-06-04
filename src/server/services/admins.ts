import { badRequest, conflict, notFound, unauthorized } from "@server/core/errors";
import { isValidObjectId, toObjectId } from "@server/schemas/common";
import { createAdmin, getAdmin, getAdmins, deleteAdmin } from "@server/repositories/admins";
import {
  adminCreateDoc,
  publicAdmin,
  type AdminOut,
  type AdminSignup,
  type AdminLogin,
} from "@server/schemas/admins";
import { hashPassword, checkPassword } from "@server/security/hash";
import { issueTokensForRole } from "@server/security/issue-tokens";
import {
  getRefreshToken,
  deleteAccessToken,
  deleteRefreshToken,
  deleteAllTokensForUser,
} from "@server/repositories/tokens";
import { defaultAdminPermissions } from "@server/security/permission-registry";

/**
 * Admin business logic, mirrors `services/admin_service.py`.
 */

async function attachTokens(admin: AdminOut): Promise<AdminOut> {
  const { accessToken, refreshToken } = await issueTokensForRole(admin.id!, "admin");
  admin.access_token = accessToken;
  admin.refresh_token = refreshToken;
  return publicAdmin(admin);
}

export async function addAdmin(
  input: AdminSignup & { invited_by?: string },
): Promise<AdminOut> {
  const existing = await getAdmin({ email: input.email });
  if (existing) throw conflict("Admin Already exists");
  const passwordHash = await hashPassword(input.password);
  const admin = await createAdmin(
    adminCreateDoc({
      full_name: input.full_name,
      email: input.email,
      passwordHash,
      invited_by: input.invited_by,
      accountStatus: input.accountStatus,
      // New admins default to full dashboard access unless a list was supplied.
      permissionList: input.permissionList ?? defaultAdminPermissions(),
    }),
  );
  return attachTokens(admin);
}

export async function authenticateAdmin(input: AdminLogin): Promise<AdminOut> {
  const admin = await getAdmin({ email: input.email });
  if (!admin) throw notFound("Admin not found");
  const ok = await checkPassword(input.password, admin.password ?? "");
  if (!ok) throw unauthorized("Unauthorized, Invalid Login credentials");
  return attachTokens(admin);
}

export async function refreshAdminTokens(
  refreshToken: string,
  expiredAccessTokenId: string,
): Promise<AdminOut> {
  const refreshObj = await getRefreshToken(refreshToken);
  if (refreshObj && refreshObj.previousAccessToken === expiredAccessTokenId) {
    const oid = toObjectId(refreshObj.userId);
    const admin = oid ? await getAdmin({ _id: oid }) : null;
    if (admin) {
      const issued = await attachTokens(admin);
      await deleteAccessToken(expiredAccessTokenId);
      await deleteRefreshToken(refreshToken);
      return issued;
    }
  }
  throw notFound("Invalid refresh token");
}

export async function removeAdmin(adminId: string): Promise<{ deleted: boolean }> {
  if (!isValidObjectId(adminId)) throw badRequest("Invalid admin ID format");
  const result = await deleteAdmin({ _id: toObjectId(adminId)! });
  await deleteAllTokensForUser(adminId);
  if (result.deletedCount === 0) throw notFound("Admin not found");
  return { deleted: true };
}

export async function retrieveAdminById(id: string): Promise<AdminOut> {
  if (!isValidObjectId(id)) throw badRequest("Invalid admin ID format");
  const admin = await getAdmin({ _id: toObjectId(id)! });
  if (!admin) throw notFound("Admin not found");
  return admin;
}

export async function retrieveAdmins(start = 0, stop = 100): Promise<AdminOut[]> {
  return getAdmins(start, stop);
}
