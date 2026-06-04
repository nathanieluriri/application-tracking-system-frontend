import { MongoClient, type Db } from "mongodb";

/**
 * Shared MongoDB client singleton (mirrors the motor client in
 * `core/database.py`). The connection promise is cached so concurrent callers
 * share one client. MONGODB_URI / DB_NAME are read at connect time so tests can
 * point the singleton at an in-memory server before the first `getDb()`.
 */

let clientPromise: Promise<MongoClient> | null = null;
let connectedUri: string | null = null;

function uri(): string {
  return process.env.MONGODB_URI || process.env.MONGO_URL || "mongodb://localhost:27017";
}

function dbName(): string {
  return process.env.DB_NAME || "ats";
}

export async function getClient(): Promise<MongoClient> {
  const target = uri();
  if (clientPromise === null || connectedUri !== target) {
    connectedUri = target;
    const client = new MongoClient(target, { serverSelectionTimeoutMS: 5000 });
    clientPromise = client.connect();
  }
  return clientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(dbName());
}

/** Close the shared client (used in test teardown and graceful shutdown). */
export async function closeDb(): Promise<void> {
  if (clientPromise) {
    const client = await clientPromise.catch(() => null);
    await client?.close();
  }
  clientPromise = null;
  connectedUri = null;
}

/** Canonical collection names used across repositories. */
export const COLLECTIONS = {
  applications: "applications",
  applicationStatusHistory: "application_status_history",
  applicationProcesses: "application_processes",
  positions: "positions",
  users: "users",
  admins: "admins",
  accessToken: "accessToken",
  refreshToken: "refreshToken",
  documents: "documents",
  emailTemplates: "email_templates",
  outboundEmails: "outbound_emails",
  invitations: "invitations",
  settings: "settings",
  payments: "payments",
  rateLimits: "rate_limits",
  cache: "cache",
  jobs: "jobs",
  adminLogs: "admin_logs",
  secretKeys: "secret_keys",
  senderDomains: "sender_domains",
  widgets: "widgets",
  conversations: "conversations",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
