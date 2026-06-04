import crypto from "node:crypto";
import { AppError, ErrorCode, badRequest, notFound } from "@server/core/errors";
import { isValidObjectId, toObjectId, nowSeconds } from "@server/schemas/common";
import { QueueManager } from "@server/core/queue/manager";
import {
  createInvitationRecord,
  getInvitation,
  getInvitations,
  getInvitationByTokenHash,
  updateInvitation,
} from "@server/repositories/invitations";
import {
  invitationCreateDoc,
  type InvitationCreateInput,
  type InvitationAcceptInput,
  type InvitationOut,
  type InvitationVerifyOut,
} from "@server/schemas/invitations";
import { addAdmin } from "@server/services/admins";
import { defaultAdminPermissions } from "@server/security/permission-registry";
import { AccountStatus } from "@server/schemas/common";
import type { AdminOut } from "@server/schemas/admins";

/**
 * Invitation business logic, mirrors `services/invitation_service.py`.
 */

const INVITATION_EXPIRY_SECONDS = 7 * 24 * 3600;

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken, "utf-8").digest("hex");
}

function generateRawToken(): string {
  // URL-safe random string, mirrors `secrets.token_urlsafe(32)`.
  return crypto.randomBytes(32).toString("base64url");
}

/** Raise the FastAPI "410 Gone" used for non-pending / expired invitations. */
function gone(message: string): AppError {
  return new AppError({ status: 410, code: ErrorCode.CONFLICT, message });
}

function acceptUrl(rawToken: string): string {
  const frontendUrl = (process.env.FRONTEND_URL || "").replace(/\/+$/, "");
  return `${frontendUrl}/invite/accept?token=${rawToken}`;
}

export async function createInvitation(
  input: InvitationCreateInput,
  inviterId: string,
  inviterName?: string | null,
): Promise<InvitationOut> {
  const rawToken = generateRawToken();
  const expiresAt = nowSeconds() + INVITATION_EXPIRY_SECONDS;
  const persisted = await createInvitationRecord(
    invitationCreateDoc({
      invitee_email: input.invitee_email,
      invited_by: inviterId,
      role: input.role,
      permission_overrides: input.permission_overrides,
      note: input.note,
      token_hash: hashToken(rawToken),
      expires_at: expiresAt,
    }),
  );

  await QueueManager.enqueueSafely("send_invitation_email", {
    invitee_email: input.invitee_email,
    inviter_name: inviterName || "An admin",
    accept_url: acceptUrl(rawToken),
    expires_at: persisted.expires_at,
  });
  return persisted;
}

export async function listInvitations(opts: {
  inviterId?: string | null;
  start?: number;
  stop?: number;
}): Promise<InvitationOut[]> {
  const filter: Record<string, unknown> = {};
  if (opts.inviterId) filter.invited_by = opts.inviterId;
  return getInvitations(filter, opts.start ?? 0, opts.stop ?? 100);
}

export async function revokeInvitation(invitationId: string): Promise<InvitationOut> {
  if (!isValidObjectId(invitationId)) throw badRequest("Invalid invitation ID format");
  const updated = await updateInvitation(
    { _id: toObjectId(invitationId)!, status: "pending" },
    { status: "revoked" },
  );
  if (!updated) throw notFound("Pending invitation not found");
  return updated;
}

export async function resendInvitation(invitationId: string): Promise<InvitationOut> {
  if (!isValidObjectId(invitationId)) throw badRequest("Invalid invitation ID format");
  const existing = await getInvitation({ _id: toObjectId(invitationId)! });
  if (!existing || existing.status !== "pending") {
    throw notFound("Pending invitation not found");
  }

  const rawToken = generateRawToken();
  const newExpiry = nowSeconds() + INVITATION_EXPIRY_SECONDS;
  const updated = await updateInvitation(
    { _id: toObjectId(invitationId)! },
    { token_hash: hashToken(rawToken), expires_at: newExpiry },
  );
  if (!updated) throw notFound("Invitation not found");

  await QueueManager.enqueueSafely("send_invitation_email", {
    invitee_email: updated.invitee_email,
    inviter_name: "An admin",
    accept_url: acceptUrl(rawToken),
    expires_at: newExpiry,
  });
  return updated;
}

export async function verifyInvitationToken(rawToken: string): Promise<InvitationVerifyOut> {
  const invitation = await getInvitationByTokenHash(hashToken(rawToken));
  if (!invitation) throw notFound("Invitation not found");
  if (invitation.status !== "pending") throw gone(`Invitation is ${invitation.status}`);
  if ((invitation.expires_at ?? 0) < nowSeconds()) {
    await updateInvitation({ _id: toObjectId(invitation.id!)! }, { status: "expired" });
    throw gone("Invitation has expired");
  }
  return {
    invitee_email: invitation.invitee_email,
    invited_by: invitation.invited_by,
    role: invitation.role,
    expires_at: invitation.expires_at ?? 0,
  };
}

export async function acceptInvitation(input: InvitationAcceptInput): Promise<AdminOut> {
  const invitation = await getInvitationByTokenHash(hashToken(input.token));
  if (!invitation) throw notFound("Invitation not found");
  if (invitation.status !== "pending") throw gone(`Invitation is ${invitation.status}`);
  if ((invitation.expires_at ?? 0) < nowSeconds()) throw gone("Invitation has expired");

  const permissionList = invitation.permission_overrides ?? defaultAdminPermissions();

  // `addAdmin` seeds permissions, hashes the password, and attaches auth tokens.
  const newAdmin = await addAdmin({
    full_name: input.full_name,
    email: invitation.invitee_email,
    password: input.password,
    accountStatus: AccountStatus.ACTIVE,
    invited_by: invitation.invited_by,
    permissionList,
  });

  await updateInvitation(
    { _id: toObjectId(invitation.id!)! },
    {
      status: "accepted",
      accepted_at: nowSeconds(),
      accepted_admin_id: newAdmin.id,
    },
  );

  return newAdmin;
}
