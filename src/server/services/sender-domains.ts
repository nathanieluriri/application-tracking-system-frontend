import { conflict, notFound, AppError, ErrorCode } from "@server/core/errors";
import { isValidObjectId, nowSeconds, toObjectId } from "@server/schemas/common";
import {
  buildCreateDomainPayload,
  buildFromAddress,
  getResendDomainsClient,
  mapDomainEvent,
  parseDomainResponse,
  ResendApiError,
  type ParsedResendDomain,
  type ResendDomainsClient,
} from "@server/core/email/resend-domains";
import {
  createSenderDomain,
  deleteSenderDomain,
  findExistingDomain,
  getByResendId,
  getSenderDomain,
  getVerifiedDomainForOrg,
  listSenderDomains,
  updateSenderDomain,
} from "@server/repositories/sender-domains";
import { getSettingsDoc } from "@server/repositories/settings";
import {
  senderDomainCreateDoc,
  type SenderDomainCreateInput,
  type SenderDomainOut,
} from "@server/schemas/sender-domains";

/**
 * Sender-domain orchestration: Resend Domains API + persistence. Mirrors
 * `services/sender_domain_service.py`.
 *
 * Customers onboard their own sending domain without ever touching Resend or an
 * API key. We hold a single platform Resend account (`RESEND_API_KEY`);
 * customers only add the DNS records this service hands back.
 *
 * Framework-agnostic: no next/* imports. The Resend client runs in *stub mode*
 * when `RESEND_API_KEY` is absent (see `core/email/resend-domains`), so this
 * service never needs to special-case a missing key the way the FastAPI service
 * raises 503 — the stub keeps the app booting and tests green without a key.
 */

const DEFAULT_REGION = "us-east-1";

function mapResendError(prefix: string, exc: ResendApiError): AppError {
  return new AppError({
    status: 400,
    code: ErrorCode.BAD_REQUEST,
    message: `${prefix}: ${exc.message}`,
    details: exc.body ?? null,
  });
}

/** Fold a parsed Resend response into the fields we persist for a record. */
function applyParsed(
  current: { resend_domain_id: string | null; region: string | null; verified_at: number | null },
  parsed: ParsedResendDomain,
): {
  resend_domain_id: string | null;
  region: string | null;
  status: ParsedResendDomain["status"];
  dns_records: ParsedResendDomain["dns_records"];
  verified_at: number | null;
} {
  let verifiedAt = current.verified_at;
  if (parsed.status === "verified" && verifiedAt == null) {
    verifiedAt = nowSeconds();
  }
  return {
    resend_domain_id: parsed.resend_domain_id ?? current.resend_domain_id,
    region: parsed.region ?? current.region,
    status: parsed.status,
    dns_records: parsed.dns_records,
    verified_at: verifiedAt,
  };
}

export async function createDomainForOrg(
  orgId: string,
  createdBy: string | null,
  payload: SenderDomainCreateInput,
): Promise<SenderDomainOut> {
  const existing = await findExistingDomain(orgId, payload.domain);
  if (existing) {
    throw conflict("This domain is already registered for your organization");
  }

  const region = payload.region ?? DEFAULT_REGION;
  const client = getResendDomainsClient();
  let resp: Record<string, any>;
  try {
    resp = await client.createDomain(
      buildCreateDomainPayload({
        domain: payload.domain,
        region,
        custom_return_path: payload.custom_return_path ?? null,
      }),
    );
  } catch (err) {
    if (err instanceof ResendApiError) throw mapResendError("Resend rejected the domain", err);
    throw err;
  }

  const parsed = parseDomainResponse(resp);
  const applied = applyParsed(
    { resend_domain_id: null, region, verified_at: null },
    parsed,
  );

  return createSenderDomain(
    senderDomainCreateDoc({
      org_id: orgId,
      domain: payload.domain,
      created_by: createdBy,
      resend_domain_id: applied.resend_domain_id,
      region: applied.region,
      status: applied.status,
      dns_records: applied.dns_records,
      verified_at: applied.verified_at,
    }),
  );
}

export async function listDomainsForOrg(orgId: string): Promise<SenderDomainOut[]> {
  return listSenderDomains(orgId);
}

export async function verifyDomainForOrg(
  orgId: string,
  recordId: string,
): Promise<SenderDomainOut> {
  if (!isValidObjectId(recordId)) throw notFound("Domain not found");
  const record = await getSenderDomain(orgId, recordId);
  if (!record || !record.resend_domain_id) throw notFound("Domain not found");

  const client = getResendDomainsClient();
  let resp: Record<string, any>;
  try {
    await client.verifyDomain(record.resend_domain_id);
    // verify() is async on Resend's side — re-fetch to get the latest status/records.
    resp = await client.getDomain(record.resend_domain_id);
  } catch (err) {
    if (err instanceof ResendApiError) throw mapResendError("Verification failed", err);
    throw err;
  }

  const applied = applyParsed(record, parseDomainResponse(resp));
  await updateSenderDomain(
    { _id: toObjectId(recordId)!, org_id: orgId },
    {
      status: applied.status,
      dns_records: applied.dns_records,
      verified_at: applied.verified_at,
    },
  );

  const refreshed = await getSenderDomain(orgId, recordId);
  return refreshed ?? record;
}

export async function refreshDomainForOrg(
  orgId: string,
  recordId: string,
): Promise<SenderDomainOut> {
  if (!isValidObjectId(recordId)) throw notFound("Domain not found");
  const record = await getSenderDomain(orgId, recordId);
  if (!record || !record.resend_domain_id) throw notFound("Domain not found");

  const client = getResendDomainsClient();
  let resp: Record<string, any>;
  try {
    resp = await client.getDomain(record.resend_domain_id);
  } catch (err) {
    if (err instanceof ResendApiError) throw mapResendError("Could not refresh", err);
    throw err;
  }

  const applied = applyParsed(record, parseDomainResponse(resp));
  await updateSenderDomain(
    { _id: toObjectId(recordId)!, org_id: orgId },
    { status: applied.status, verified_at: applied.verified_at },
  );

  const refreshed = await getSenderDomain(orgId, recordId);
  return refreshed ?? record;
}

export async function deleteDomainForOrg(orgId: string, recordId: string): Promise<boolean> {
  if (!isValidObjectId(recordId)) throw notFound("Domain not found");
  const record = await getSenderDomain(orgId, recordId);
  if (!record) throw notFound("Domain not found");

  if (record.resend_domain_id) {
    const client = getResendDomainsClient();
    try {
      await client.deleteDomain(record.resend_domain_id);
    } catch (err) {
      // Already gone on Resend's side — still remove locally.
      if (!(err instanceof ResendApiError)) throw err;
    }
  }

  return deleteSenderDomain(orgId, recordId);
}

/** Resolved Resend sending identity for an org with a verified domain. */
export interface ResendSender {
  client: ResendDomainsClient;
  fromAddress: string;
  replyTo: string | null;
}

/**
 * Return a Resend sender for `orgId` when it has a verified domain. Returns null
 * when Resend isn't configured (stub mode) or the org has no verified domain, so
 * callers fall back to the existing transport.
 */
export async function resolveOutboundSender(orgId: string): Promise<ResendSender | null> {
  const client = getResendDomainsClient();
  if (client.isStub) return null;

  const domain = await getVerifiedDomainForOrg(orgId);
  if (domain === null) return null;

  let senderName = "HR Team";
  let replyTo: string | null = null;
  try {
    const settings = await getSettingsDoc();
    if (settings && settings.email) {
      senderName = settings.email.sender_name || senderName;
      replyTo = settings.email.reply_to ?? null;
    }
  } catch {
    // settings are optional — fall back to defaults
  }

  return {
    client,
    fromAddress: buildFromAddress(senderName, "noreply", domain.domain),
    replyTo,
  };
}

/**
 * Apply a Resend `domain.*` webhook to the matching local record. Mirrors
 * `handle_domain_webhook_event`. Provided for the emails webhook to call in the
 * future — the webhook route currently only handles `email.*` events.
 */
export async function handleDomainWebhookEvent(event: Record<string, any>): Promise<boolean> {
  const update = mapDomainEvent(event);
  if (update === null) return false;

  const record = await getByResendId(update.resend_domain_id);
  if (record === null || record.id === null) return false;

  if (update.deleted) {
    return deleteSenderDomain(record.org_id, record.id);
  }

  const fields: Record<string, unknown> = { status: update.status };
  if (update.status === "verified" && record.verified_at == null) {
    fields.verified_at = nowSeconds();
  }
  return updateSenderDomain(
    { _id: toObjectId(record.id)!, org_id: record.org_id },
    fields,
  );
}
