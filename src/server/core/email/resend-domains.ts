/**
 * Resend Domains API client + pure helpers, mirrors the FastAPI
 * `core/email/resend_domains.py` (status/payload helpers) and
 * `core/email/resend_client.py` (the HTTP client for the Domains API).
 *
 * Talks to Resend via `fetch` (no SDK). When `RESEND_API_KEY` is absent the
 * client runs in *stub mode* — exactly like the payment providers stub when
 * their keys are missing — so the app boots and tests pass with no Resend key.
 * `create`/`get`/`verify` return synthetic domain ids, statuses, and DNS
 * records (`stub: true`); `delete` is a no-op. The key is read lazily from
 * `process.env` inside `getResendDomainsClient()` so module import never fails.
 *
 * Framework-agnostic: no next/* imports.
 */

/** Product-facing domain verification vocabulary (Resend's wording normalized). */
export type SenderDomainStatus = "pending" | "verifying" | "verified" | "failed";

const STATUS_MAP: Record<string, SenderDomainStatus> = {
  not_started: "pending",
  pending: "verifying",
  verified: "verified",
  failed: "failed",
  temporary_failure: "verifying",
};

/**
 * Translate a Resend domain status into our normalized status. Unknown, empty,
 * or null/undefined values fall back to "pending" so an unexpected value never
 * reads as "verified".
 */
export function normalizeDomainStatus(resendStatus: string | null | undefined): SenderDomainStatus {
  if (!resendStatus) return "pending";
  return STATUS_MAP[resendStatus.trim().toLowerCase()] ?? "pending";
}

/**
 * Build an RFC 5322 `From` value like `Acme HR <noreply@send.acme.com>`.
 * `localPart` defaults to "noreply". When `senderName` is blank the bare
 * mailbox is returned.
 */
export function buildFromAddress(
  senderName: string | null | undefined,
  localPart: string | null | undefined,
  domain: string,
): string {
  const mailbox = `${(localPart || "noreply").trim()}@${domain.trim()}`;
  if (senderName && senderName.trim()) {
    return `${senderName.trim()} <${mailbox}>`;
  }
  return mailbox;
}

export interface SenderDomainCreateInput {
  domain: string;
  region: string;
  custom_return_path?: string | null;
}

/** Build the JSON body for Resend's `POST /domains` from our create input. */
export function buildCreateDomainPayload(
  create: SenderDomainCreateInput,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { name: create.domain, region: create.region };
  if (create.custom_return_path) payload.custom_return_path = create.custom_return_path;
  return payload;
}

/** A single DNS record the customer must add at their DNS provider. */
export interface DnsRecord {
  record: string | null;
  name: string | null;
  type: string | null;
  value: string | null;
  ttl: string | null;
  priority: number | null;
  status: string | null;
}

/** The fields we care about from a Resend domain create/get response. */
export interface ParsedResendDomain {
  resend_domain_id: string | null;
  domain: string | null;
  region: string | null;
  status: SenderDomainStatus;
  dns_records: DnsRecord[];
}

/**
 * Normalize a Resend domain create/get response into `ParsedResendDomain`.
 * Missing `records` yields an empty list; missing `status` falls back to
 * "pending" via `normalizeDomainStatus`.
 */
export function parseDomainResponse(payload: Record<string, any>): ParsedResendDomain {
  const records: any[] = Array.isArray(payload.records) ? payload.records : [];
  const dnsRecords: DnsRecord[] = records.map((item) => ({
    record: item?.record ?? null,
    name: item?.name ?? null,
    type: item?.type ?? null,
    value: item?.value ?? null,
    ttl: item?.ttl ?? null,
    priority: item?.priority ?? null,
    status: item?.status ?? null,
  }));

  return {
    resend_domain_id: payload.id ?? null,
    domain: payload.name ?? null,
    region: payload.region ?? null,
    status: normalizeDomainStatus(payload.status),
    dns_records: dnsRecords,
  };
}

/** The actionable result of a `domain.*` webhook event. */
export interface DomainWebhookUpdate {
  resend_domain_id: string;
  status: SenderDomainStatus;
  deleted: boolean;
}

/**
 * Map a Resend `domain.*` webhook event to an actionable update. Returns null
 * for non-domain events or events lacking a domain id, so the caller can safely
 * ignore them.
 */
export function mapDomainEvent(event: Record<string, any>): DomainWebhookUpdate | null {
  const eventType: string = event?.type ?? event?.event ?? "";
  if (!eventType.startsWith("domain.")) return null;

  const data: Record<string, any> = event?.data ?? {};
  const resendDomainId = data.id;
  if (!resendDomainId) return null;

  return {
    resend_domain_id: resendDomainId,
    status: normalizeDomainStatus(data.status),
    deleted: eventType === "domain.deleted",
  };
}

/** Raised when Resend returns a non-2xx response. */
export class ResendApiError extends Error {
  readonly statusCode: number;
  readonly body: unknown;

  constructor(statusCode: number, message: string, body: unknown = null) {
    super(`Resend API error ${statusCode}: ${message}`);
    this.name = "ResendApiError";
    this.statusCode = statusCode;
    this.body = body;
    Object.setPrototypeOf(this, ResendApiError.prototype);
  }
}

const DEFAULT_BASE_URL = "https://api.resend.com";

/**
 * Thin HTTP client for Resend's Domains API. In stub mode (no API key) every
 * method returns synthetic data tagged `stub: true` instead of making a network
 * call, so the app boots and tests run without `RESEND_API_KEY`.
 */
export class ResendDomainsClient {
  private readonly apiKey: string | null;
  private readonly baseUrl: string;

  constructor(opts: { apiKey?: string | null; baseUrl?: string } = {}) {
    this.apiKey = opts.apiKey ?? null;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  }

  get isStub(): boolean {
    return !this.apiKey;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  private async handle(response: Response): Promise<Record<string, any>> {
    let body: any = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (response.status >= 400) {
      let message = "unknown error";
      if (body && typeof body === "object") {
        message = body.message || body.name || message;
      }
      throw new ResendApiError(response.status, message, body);
    }
    return body && typeof body === "object" ? body : {};
  }

  private stubDomain(name: string, region: string, status: string): Record<string, any> {
    const id = `dom_stub_${name.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`;
    return {
      id,
      name,
      status,
      region,
      created_at: new Date().toISOString(),
      records: [
        {
          record: "SPF",
          name: "send",
          type: "MX",
          ttl: "Auto",
          status,
          value: `feedback-smtp.${region}.amazonses.com`,
          priority: 10,
        },
        {
          record: "DKIM",
          name: "resend._domainkey",
          type: "TXT",
          ttl: "Auto",
          status,
          value: "p=STUB_PUBLIC_KEY",
        },
      ],
      stub: true,
    };
  }

  async createDomain(payload: Record<string, any>): Promise<Record<string, any>> {
    if (this.isStub) {
      return this.stubDomain(
        String(payload.name),
        String(payload.region ?? "us-east-1"),
        "not_started",
      );
    }
    const response = await fetch(`${this.baseUrl}/domains`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(payload),
    });
    return this.handle(response);
  }

  async getDomain(resendDomainId: string): Promise<Record<string, any>> {
    if (this.isStub) {
      // A freshly stubbed domain reports as verified once "fetched" so the
      // verify flow resolves deterministically without a live Resend account.
      const name = resendDomainId.replace(/^dom_stub_/, "").replace(/_/g, ".");
      return this.stubDomain(name, "us-east-1", "verified");
    }
    const response = await fetch(`${this.baseUrl}/domains/${resendDomainId}`, {
      method: "GET",
      headers: this.headers(),
    });
    return this.handle(response);
  }

  async verifyDomain(resendDomainId: string): Promise<Record<string, any>> {
    if (this.isStub) {
      return { id: resendDomainId, object: "domain", stub: true };
    }
    const response = await fetch(`${this.baseUrl}/domains/${resendDomainId}/verify`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({}),
    });
    return this.handle(response);
  }

  async deleteDomain(resendDomainId: string): Promise<Record<string, any>> {
    if (this.isStub) {
      return { id: resendDomainId, deleted: true, stub: true };
    }
    const response = await fetch(`${this.baseUrl}/domains/${resendDomainId}`, {
      method: "DELETE",
      headers: this.headers(),
    });
    return this.handle(response);
  }
}

let defaultClient: ResendDomainsClient | null = null;

/**
 * Return a process-wide Resend Domains client. Reads `RESEND_API_KEY` lazily
 * from `process.env` (never at module top-level) so import never breaks boot.
 * When the key is absent the returned client is in stub mode rather than null —
 * mirroring the payment-provider pattern so the app degrades gracefully and the
 * service layer needs no `null` guards.
 */
export function getResendDomainsClient(): ResendDomainsClient {
  const apiKey = process.env.RESEND_API_KEY || null;
  if (defaultClient === null || defaultClient.isStub !== !apiKey) {
    defaultClient = new ResendDomainsClient({ apiKey });
  }
  return defaultClient;
}

/** Test-only: drop the memoized client so a fresh key can be picked up. */
export function resetResendDomainsClient(): void {
  defaultClient = null;
}
