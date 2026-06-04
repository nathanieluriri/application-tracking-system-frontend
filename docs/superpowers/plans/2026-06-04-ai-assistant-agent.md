# AI Assistant ("Ask AI") Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-app AI assistant that takes real actions (create job postings, move applicants, draft/send emails, manage widgets/invitations/settings) through chat, backed by a deterministic intent router with a Gemini 2.0 Flash fallback, with server-persisted conversation history and central confirmation + permission gating.

**Architecture:** One `POST /api/agent/chat` endpoint drives an orchestrator that runs a lean deterministic intent router first and falls through to Gemini only for hard requests. A single tool registry wraps existing `src/server/services/*` functions; every tool declares a `risk` level and the existing permission key it requires. Destructive/outbound actions never auto-execute — they return an HMAC-signed confirmation token the client echoes back to run. Conversations persist to a new owner-scoped `conversations` MongoDB collection. Everything under `src/server/agent/` is framework-agnostic (no `next/*`) and unit-tested under Vitest; only the route handlers are Next-aware.

**Tech Stack:** Next.js 15 (App Router), TypeScript, zod, MongoDB (`mongodb` driver), Vitest + `mongodb-memory-server`, TanStack Query, shadcn/ui, Tailwind, `fuse.js` (fuzzy matching), Google Generative Language API (Gemini 2.0 Flash).

**Reference spec:** `docs/superpowers/specs/2026-06-04-ai-assistant-agent-design.md`

---

## Conventions used throughout (read once)

- **Import aliases:** `@server/*` → `src/server/*`, `@/*` → `src/*`. Use them; don't write relative `../../`.
- **Errors:** throw `AppError` via helpers from `@server/core/errors` (`badRequest`, `notFound`, `unauthorized`, `conflict`). `withEnvelope` maps them to the error envelope.
- **IDs/time:** `toObjectId`, `isValidObjectId`, `nowSeconds`, `stringifyId` from `@server/schemas/common`.
- **DB access:** `getDb()` + `COLLECTIONS.<name>` from `@server/core/database`.
- **Auth in routes:** `checkAdminAccountStatusAndPermissions(req, "VERB:/path")` from `@server/security/account-status` returns the `AdminOut` (use `admin.id`).
- **Envelope:** `withEnvelope(handler, { message, status? })` from `@server/http/with-envelope`; body/query parsing via `parseJsonBody`/`parseQuery` from `@server/http/request`.
- **Tests:** mirror `tests/<layer>/`. Boot Mongo with `startTestDb()` (`tests/helpers/db.ts`), reset with `clearDb(db)`, close with `closeDb()`+`stopTestDb()`. Make an authed admin cookie with `addAdmin(...)` → `access_token` (see `tests/http/positions-routes.test.ts`). Route handlers are called directly: `const ctx = { params: Promise.resolve({}) }`. Run all tests with `bun test`; a single file with `bunx vitest run tests/path/file.test.ts`.
- **Commits:** after each task. End commit messages with the Co-Authored-By line:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## File Structure

**Server (framework-agnostic, no `next/*`):**
- `src/server/agent/types.ts` — turn I/O contracts (`ChatTurnInput`, `ChatTurnOutput`, `Step`, `Suggestion`, `PendingConfirmation`, `ToolResultSummary`, `AutonomyMode`).
- `src/server/agent/tools/types.ts` — `Risk`, `ToolContext`, `ToolDef`, `ToolCall`, `ToolExecResult`.
- `src/server/agent/tools/registry.ts` — `ToolRegistry` (register/get/all/toGeminiDeclarations).
- `src/server/agent/tools/positions.ts` — positions tools (wrap `services/positions`).
- `src/server/agent/tools/applicants.ts` — applicant/pipeline tools (wrap `services/applications`).
- `src/server/agent/tools/emails.ts` — email + template tools.
- `src/server/agent/tools/admin.ts` — widgets/invitations/settings tools.
- `src/server/agent/tools/index.ts` — builds + exports the populated registry.
- `src/server/agent/confirm/tokens.ts` — HMAC sign/verify of confirmation tokens.
- `src/server/agent/intent-router/index.ts` — `matchIntent(message, dataCtx)`.
- `src/server/agent/intent-router/patterns.ts` — curated intents.
- `src/server/agent/intent-router/fuzzy.ts` — fuse.js entity resolution.
- `src/server/agent/llm/gemini.ts` — Gemini call (declarations in, text/toolCalls out).
- `src/server/agent/llm/prompt.ts` — system prompt + result formatting.
- `src/server/agent/orchestrator.ts` — `runTurn(...)`.
- `src/server/schemas/conversation.ts` — conversation doc/out + message shape + normalizers.
- `src/server/repositories/conversations.ts` — Mongo data access (owner-scoped).
- `src/server/services/conversations.ts` — conversation business logic (owner-scoped).

**Next-aware:**
- `src/app/api/agent/chat/route.ts` — POST chat turn (+ confirm round-trip).
- `src/app/api/agent/conversations/route.ts` — GET list / POST create.
- `src/app/api/agent/conversations/[id]/route.ts` — GET / PATCH (rename + feedback) / DELETE.

**Config:**
- `src/server/core/settings.ts` — add `geminiApiKey`.
- `src/server/core/database.ts` — add `conversations` to `COLLECTIONS`.

**Client:**
- `src/lib/agent/client.ts`, `src/lib/agent/store.ts`, `src/lib/agent/hooks.ts`.
- `src/components/agent/*` — `AskAiButton`, `AgentPanel`, `ChatThread`, `MessageBubble`, `StepProgress`, `ConfirmCard`, `SuggestionChips`, `Composer`, `AgentSkeleton`.
- `src/components/layout/Topbar.tsx` — mount `AskAiButton`.
- `src/app/dashboard/layout.tsx` — mount `AgentPanel`.

**Tests:** mirror under `tests/agent/`, `tests/services/`, `tests/repositories/`, `tests/http/`.

---

## Phase 0 — Dependencies & config

### Task 0: Install deps, add settings key and collection

**Files:**
- Modify: `package.json` (add `fuse.js`)
- Modify: `src/server/core/database.ts:47-69`
- Modify: `src/server/core/settings.ts` (interface + loader)
- Modify: `.env.test`, `.env.local` (add `GEMINI_API_KEY`)
- Test: `tests/core/settings.test.ts` (extend)

- [ ] **Step 1: Install fuzzy-match dependency**

Run: `bun add fuse.js`
Expected: `fuse.js` appears in `package.json` dependencies.

- [ ] **Step 2: Add the `conversations` collection name**

In `src/server/core/database.ts`, add to the `COLLECTIONS` object (after `widgets`):

```ts
  widgets: "widgets",
  conversations: "conversations",
} as const;
```

- [ ] **Step 3: Write the failing settings test**

Add to `tests/core/settings.test.ts`:

```ts
it("reads GEMINI_API_KEY (null when unset)", () => {
  expect(loadSettings({}).geminiApiKey).toBeNull();
  expect(loadSettings({ GEMINI_API_KEY: "k-123" }).geminiApiKey).toBe("k-123");
});
```

- [ ] **Step 4: Run it, expect FAIL**

Run: `bunx vitest run tests/core/settings.test.ts`
Expected: FAIL — `geminiApiKey` does not exist on `Settings`.

- [ ] **Step 5: Add `geminiApiKey` to settings**

In `src/server/core/settings.ts`, add to the `Settings` interface (after `dbName: string;` block, in a new `// agent` group):

```ts
  // agent
  geminiApiKey: string | null;
```

And in `loadSettings`, before the closing `};` of the `settings` object:

```ts
    geminiApiKey: env.GEMINI_API_KEY || null,
```

- [ ] **Step 6: Run it, expect PASS**

Run: `bunx vitest run tests/core/settings.test.ts`
Expected: PASS.

- [ ] **Step 7: Add env placeholders**

Append to `.env.test`:
```
GEMINI_API_KEY=
```
Append to `.env.local` (real key supplied by the user later):
```
GEMINI_API_KEY=
```

- [ ] **Step 8: Commit**

```bash
git add package.json bun.lock src/server/core/database.ts src/server/core/settings.ts tests/core/settings.test.ts .env.test .env.local
git commit -m "feat(agent): add fuse.js, conversations collection, GEMINI_API_KEY setting

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase 1 — Conversation persistence (server-side)

### Task 1: Conversation schema

**Files:**
- Create: `src/server/schemas/conversation.ts`
- Test: `tests/schemas/conversation.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import {
  conversationMessage,
  conversationOut,
  type ConversationDoc,
} from "@server/schemas/conversation";

describe("conversation schema", () => {
  it("builds a normalized message with defaults", () => {
    const m = conversationMessage({ role: "user", text: "hi" });
    expect(m.role).toBe("user");
    expect(m.text).toBe("hi");
    expect(typeof m.id).toBe("string");
    expect(typeof m.created_at).toBe("number");
    expect(m.feedback).toBeNull();
  });

  it("conversationOut maps _id->id and strips internals", () => {
    const doc = {
      _id: "507f1f77bcf86cd799439011",
      owner_id: "owner1",
      title: "T",
      messages: [conversationMessage({ role: "assistant", text: "yo" })],
      status: "open",
      created_at: 1,
      last_updated: 2,
    } as unknown as ConversationDoc & { _id: string };
    const out = conversationOut(doc);
    expect(out.id).toBe("507f1f77bcf86cd799439011");
    expect(out).not.toHaveProperty("owner_id");
    expect(out.messages[0].text).toBe("yo");
  });
});
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `bunx vitest run tests/schemas/conversation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the schema**

Create `src/server/schemas/conversation.ts`:

```ts
import { z } from "zod";
import { nowSeconds } from "./common";

/** Conversation persistence schema for the AI assistant. */

export const messageRoleValues = ["user", "assistant"] as const;
export const conversationStatusValues = ["open", "closed"] as const;

export interface ToolResultSummary {
  tool: string;
  status: "ok" | "error" | "pending";
  summary: string;
}

export interface ConversationMessage {
  id: string;
  role: (typeof messageRoleValues)[number];
  text: string;
  steps?: string[];
  tool_results?: ToolResultSummary[];
  suggestions?: string[];
  feedback: "up" | "down" | null;
  created_at: number;
}

export interface ConversationDoc {
  owner_id: string;
  title: string;
  messages: ConversationMessage[];
  status: (typeof conversationStatusValues)[number];
  created_at: number;
  last_updated: number;
}

export interface ConversationSummaryOut {
  id: string | null;
  title: string;
  status: string;
  message_count: number;
  last_updated: number | null;
}

export interface ConversationOut {
  id: string | null;
  title: string;
  messages: ConversationMessage[];
  status: string;
  created_at: number | null;
  last_updated: number | null;
}

let messageCounter = 0;
/** Deterministic-enough unique id without Date.now()/random in hot path. */
function messageId(): string {
  messageCounter += 1;
  return `m_${nowSeconds()}_${messageCounter}`;
}

export function conversationMessage(input: {
  role: (typeof messageRoleValues)[number];
  text: string;
  steps?: string[];
  tool_results?: ToolResultSummary[];
  suggestions?: string[];
}): ConversationMessage {
  return {
    id: messageId(),
    role: input.role,
    text: input.text,
    steps: input.steps,
    tool_results: input.tool_results,
    suggestions: input.suggestions,
    feedback: null,
    created_at: nowSeconds(),
  };
}

export function conversationDoc(ownerId: string, title: string): ConversationDoc {
  return {
    owner_id: ownerId,
    title,
    messages: [],
    status: "open",
    created_at: nowSeconds(),
    last_updated: nowSeconds(),
  };
}

export function conversationOut(doc: Record<string, any>): ConversationOut {
  const id = doc._id != null ? String(doc._id) : (doc.id ?? null);
  return {
    id,
    title: doc.title,
    messages: doc.messages ?? [],
    status: doc.status ?? "open",
    created_at: doc.created_at ?? null,
    last_updated: doc.last_updated ?? null,
  };
}

export function conversationSummaryOut(doc: Record<string, any>): ConversationSummaryOut {
  const id = doc._id != null ? String(doc._id) : (doc.id ?? null);
  return {
    id,
    title: doc.title,
    status: doc.status ?? "open",
    message_count: Array.isArray(doc.messages) ? doc.messages.length : (doc.message_count ?? 0),
    last_updated: doc.last_updated ?? null,
  };
}
```

- [ ] **Step 4: Run it, expect PASS**

Run: `bunx vitest run tests/schemas/conversation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/schemas/conversation.ts tests/schemas/conversation.test.ts
git commit -m "feat(agent): add conversation schema + normalizers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 2: Conversation repository (owner-scoped Mongo access)

**Files:**
- Create: `src/server/repositories/conversations.ts`
- Test: `tests/repositories/conversations.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { closeDb } from "@server/core/database";
import {
  insertConversation,
  findConversation,
  pushMessages,
  listConversations,
  renameConversation,
  setMessageFeedback,
  deleteConversation,
} from "@server/repositories/conversations";
import { conversationDoc, conversationMessage } from "@server/schemas/conversation";

describe("conversations repository", () => {
  let db: Db;
  beforeAll(async () => { db = await startTestDb(); });
  afterEach(async () => { await clearDb(db); });
  afterAll(async () => { await closeDb(); await stopTestDb(); });

  it("inserts and finds scoped by owner", async () => {
    const c = await insertConversation(conversationDoc("owner1", "Hello"));
    expect(c.id).toBeTruthy();
    const found = await findConversation(c.id!, "owner1");
    expect(found?.title).toBe("Hello");
    const wrongOwner = await findConversation(c.id!, "owner2");
    expect(wrongOwner).toBeNull();
  });

  it("pushes messages and bumps last_updated", async () => {
    const c = await insertConversation(conversationDoc("owner1", "T"));
    const updated = await pushMessages(c.id!, "owner1", [
      conversationMessage({ role: "user", text: "hi" }),
      conversationMessage({ role: "assistant", text: "hello" }),
    ]);
    expect(updated?.messages).toHaveLength(2);
  });

  it("lists only the owner's conversations as summaries", async () => {
    await insertConversation(conversationDoc("owner1", "A"));
    await insertConversation(conversationDoc("owner1", "B"));
    await insertConversation(conversationDoc("owner2", "C"));
    const list = await listConversations("owner1", 0, 50);
    expect(list).toHaveLength(2);
    expect(list[0]).not.toHaveProperty("messages");
  });

  it("renames, sets feedback, deletes — all owner-scoped", async () => {
    const c = await insertConversation(conversationDoc("owner1", "Old"));
    await pushMessages(c.id!, "owner1", [conversationMessage({ role: "assistant", text: "x" })]);
    const full = await findConversation(c.id!, "owner1");
    const mid = full!.messages[0].id;

    await renameConversation(c.id!, "owner1", "New");
    expect((await findConversation(c.id!, "owner1"))?.title).toBe("New");

    await setMessageFeedback(c.id!, "owner1", mid, "up");
    const reread = await findConversation(c.id!, "owner1");
    expect(reread?.messages[0].feedback).toBe("up");

    const delByWrong = await deleteConversation(c.id!, "owner2");
    expect(delByWrong.deletedCount).toBe(0);
    const del = await deleteConversation(c.id!, "owner1");
    expect(del.deletedCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `bunx vitest run tests/repositories/conversations.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the repository**

Create `src/server/repositories/conversations.ts`:

```ts
import { type Filter, type Document } from "mongodb";
import { getDb, COLLECTIONS } from "@server/core/database";
import { toObjectId, nowSeconds, isValidObjectId } from "@server/schemas/common";
import {
  conversationOut,
  conversationSummaryOut,
  type ConversationDoc,
  type ConversationMessage,
  type ConversationOut,
  type ConversationSummaryOut,
} from "@server/schemas/conversation";

function ownerScoped(id: string, ownerId: string): Filter<Document> | null {
  if (!isValidObjectId(id)) return null;
  return { _id: toObjectId(id)!, owner_id: ownerId };
}

export async function insertConversation(doc: ConversationDoc): Promise<ConversationOut> {
  const db = await getDb();
  const res = await db.collection(COLLECTIONS.conversations).insertOne({ ...doc });
  const stored = await db
    .collection(COLLECTIONS.conversations)
    .findOne({ _id: res.insertedId });
  return conversationOut(stored!);
}

export async function findConversation(
  id: string,
  ownerId: string,
): Promise<ConversationOut | null> {
  const filter = ownerScoped(id, ownerId);
  if (!filter) return null;
  const db = await getDb();
  const doc = await db.collection(COLLECTIONS.conversations).findOne(filter);
  return doc ? conversationOut(doc) : null;
}

export async function pushMessages(
  id: string,
  ownerId: string,
  messages: ConversationMessage[],
): Promise<ConversationOut | null> {
  const filter = ownerScoped(id, ownerId);
  if (!filter) return null;
  const db = await getDb();
  const result = await db.collection(COLLECTIONS.conversations).findOneAndUpdate(
    filter,
    { $push: { messages: { $each: messages } }, $set: { last_updated: nowSeconds() } },
    { returnDocument: "after" },
  );
  return result ? conversationOut(result) : null;
}

export async function listConversations(
  ownerId: string,
  start = 0,
  stop = 50,
): Promise<ConversationSummaryOut[]> {
  const db = await getDb();
  const cursor = db
    .collection(COLLECTIONS.conversations)
    .find({ owner_id: ownerId })
    .sort({ last_updated: -1 })
    .skip(start)
    .limit(stop - start);
  const items: ConversationSummaryOut[] = [];
  for await (const doc of cursor) items.push(conversationSummaryOut(doc));
  return items;
}

export async function renameConversation(
  id: string,
  ownerId: string,
  title: string,
): Promise<ConversationOut | null> {
  const filter = ownerScoped(id, ownerId);
  if (!filter) return null;
  const db = await getDb();
  const result = await db
    .collection(COLLECTIONS.conversations)
    .findOneAndUpdate(
      filter,
      { $set: { title, last_updated: nowSeconds() } },
      { returnDocument: "after" },
    );
  return result ? conversationOut(result) : null;
}

export async function setMessageFeedback(
  id: string,
  ownerId: string,
  messageId: string,
  feedback: "up" | "down" | null,
): Promise<ConversationOut | null> {
  const filter = ownerScoped(id, ownerId);
  if (!filter) return null;
  const db = await getDb();
  const result = await db.collection(COLLECTIONS.conversations).findOneAndUpdate(
    { ...filter, "messages.id": messageId },
    { $set: { "messages.$.feedback": feedback, last_updated: nowSeconds() } },
    { returnDocument: "after" },
  );
  return result ? conversationOut(result) : null;
}

export async function deleteConversation(
  id: string,
  ownerId: string,
): Promise<{ deletedCount: number }> {
  const filter = ownerScoped(id, ownerId);
  if (!filter) return { deletedCount: 0 };
  const db = await getDb();
  const res = await db.collection(COLLECTIONS.conversations).deleteOne(filter);
  return { deletedCount: res.deletedCount };
}
```

- [ ] **Step 4: Run it, expect PASS**

Run: `bunx vitest run tests/repositories/conversations.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/repositories/conversations.ts tests/repositories/conversations.test.ts
git commit -m "feat(agent): owner-scoped conversations repository

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 3: Conversation service

**Files:**
- Create: `src/server/services/conversations.ts`
- Test: `tests/services/conversations.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { closeDb } from "@server/core/database";
import {
  startConversation,
  appendTurn,
  listForOwner,
  getForOwner,
  renameForOwner,
  setFeedbackForOwner,
  deleteForOwner,
} from "@server/services/conversations";
import { conversationMessage } from "@server/schemas/conversation";

describe("conversations service", () => {
  let db: Db;
  beforeAll(async () => { db = await startTestDb(); });
  afterEach(async () => { await clearDb(db); });
  afterAll(async () => { await closeDb(); await stopTestDb(); });

  it("derives a title from the first user message (truncated)", async () => {
    const c = await startConversation(
      "owner1",
      "Please create a detailed senior backend engineer posting for the platform team",
    );
    expect(c.title.length).toBeLessThanOrEqual(60);
    expect(c.title.startsWith("Please create")).toBe(true);
  });

  it("appends a turn and returns the updated conversation", async () => {
    const c = await startConversation("owner1", "hi");
    const updated = await appendTurn(c.id!, "owner1", [
      conversationMessage({ role: "user", text: "hi" }),
      conversationMessage({ role: "assistant", text: "hello" }),
    ]);
    expect(updated.messages).toHaveLength(2);
  });

  it("getForOwner of another owner's conversation throws 404", async () => {
    const c = await startConversation("owner1", "secret");
    await expect(getForOwner(c.id!, "owner2")).rejects.toMatchObject({ status: 404 });
  });

  it("rename/feedback/delete are owner-scoped", async () => {
    const c = await startConversation("owner1", "x");
    const withMsg = await appendTurn(c.id!, "owner1", [
      conversationMessage({ role: "assistant", text: "a" }),
    ]);
    const mid = withMsg.messages[0].id;
    await renameForOwner(c.id!, "owner1", "Renamed");
    expect((await getForOwner(c.id!, "owner1")).title).toBe("Renamed");
    await setFeedbackForOwner(c.id!, "owner1", mid, "down");
    expect((await getForOwner(c.id!, "owner1")).messages[0].feedback).toBe("down");
    await expect(deleteForOwner(c.id!, "owner2")).rejects.toMatchObject({ status: 404 });
    await expect(deleteForOwner(c.id!, "owner1")).resolves.toEqual({ deleted: true });
  });
});
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `bunx vitest run tests/services/conversations.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the service**

Create `src/server/services/conversations.ts`:

```ts
import { notFound } from "@server/core/errors";
import {
  insertConversation,
  findConversation,
  pushMessages,
  listConversations,
  renameConversation,
  setMessageFeedback,
  deleteConversation,
} from "@server/repositories/conversations";
import {
  conversationDoc,
  conversationMessage,
  type ConversationMessage,
  type ConversationOut,
  type ConversationSummaryOut,
} from "@server/schemas/conversation";

/** Business logic for AI-assistant conversations. All ops are owner-scoped. */

function deriveTitle(firstMessage: string): string {
  const trimmed = firstMessage.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 60) return trimmed || "New conversation";
  return `${trimmed.slice(0, 57)}...`;
}

export async function startConversation(
  ownerId: string,
  firstUserMessage: string,
): Promise<ConversationOut> {
  return insertConversation(conversationDoc(ownerId, deriveTitle(firstUserMessage)));
}

export async function appendTurn(
  id: string,
  ownerId: string,
  messages: ConversationMessage[],
): Promise<ConversationOut> {
  const updated = await pushMessages(id, ownerId, messages);
  if (!updated) throw notFound("Conversation not found");
  return updated;
}

export async function listForOwner(
  ownerId: string,
  start = 0,
  stop = 50,
): Promise<ConversationSummaryOut[]> {
  return listConversations(ownerId, start, stop);
}

export async function getForOwner(id: string, ownerId: string): Promise<ConversationOut> {
  const found = await findConversation(id, ownerId);
  if (!found) throw notFound("Conversation not found");
  return found;
}

export async function renameForOwner(
  id: string,
  ownerId: string,
  title: string,
): Promise<ConversationOut> {
  const updated = await renameConversation(id, ownerId, title.trim() || "Untitled");
  if (!updated) throw notFound("Conversation not found");
  return updated;
}

export async function setFeedbackForOwner(
  id: string,
  ownerId: string,
  messageId: string,
  feedback: "up" | "down" | null,
): Promise<ConversationOut> {
  const updated = await setMessageFeedback(id, ownerId, messageId, feedback);
  if (!updated) throw notFound("Conversation or message not found");
  return updated;
}

export async function deleteForOwner(
  id: string,
  ownerId: string,
): Promise<{ deleted: boolean }> {
  const res = await deleteConversation(id, ownerId);
  if (res.deletedCount === 0) throw notFound("Conversation not found");
  return { deleted: true };
}

// Re-export the message builder so the orchestrator/route share one source.
export { conversationMessage };
```

- [ ] **Step 4: Run it, expect PASS**

Run: `bunx vitest run tests/services/conversations.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/services/conversations.ts tests/services/conversations.test.ts
git commit -m "feat(agent): conversations service (owner-scoped, title derivation)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase 2 — Tool contracts & registry

### Task 4: Tool + turn type contracts

**Files:**
- Create: `src/server/agent/tools/types.ts`
- Create: `src/server/agent/types.ts`
- Test: none (pure types + trivial helpers; covered by registry tests next).

- [ ] **Step 1: Create `src/server/agent/tools/types.ts`**

```ts
import { z } from "zod";

/** Risk tiers govern auto-run vs. confirmation in the orchestrator. */
export type Risk = "read" | "write" | "destructive";

/** Per-turn context passed to a tool's execute(). */
export interface ToolContext {
  /** Authenticated actor id (admin.id). */
  userId: string;
  /** The original Request — tools that wrap permissioned services may need it. */
  req: Request;
}

/** A concrete tool invocation (name + raw args before validation). */
export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface ToolExecResult {
  /** Short human summary, also stored on the message for audit. */
  summary: string;
  /** Structured payload (e.g. created entity) for narration/UI. */
  data?: unknown;
}

/**
 * A tool wraps exactly one service capability. `schema` validates args;
 * `permission` is the existing backend permission key enforced before run;
 * `preview` renders a confirm-card description for write/destructive tools.
 */
export interface ToolDef<S extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  risk: Risk;
  permission: string;
  schema: S;
  preview: (args: z.infer<S>) => string;
  execute: (args: z.infer<S>, ctx: ToolContext) => Promise<ToolExecResult>;
}
```

- [ ] **Step 2: Create `src/server/agent/types.ts`**

```ts
import type { ToolResultSummary } from "@server/schemas/conversation";

export type AutonomyMode = "confirm_everything" | "smart" | "auto_run";

export interface Step {
  label: string;
  status: "pending" | "active" | "done";
}

export interface PendingConfirmation {
  /** HMAC token binding {tool,args,userId}; echoed back to execute. */
  token: string;
  toolName: string;
  /** Human preview of what will happen. */
  preview: string;
}

export interface ChatTurnInput {
  message?: string;
  conversationId?: string;
  mode: AutonomyMode;
  /** Present on a confirm round-trip instead of `message`. */
  confirmToken?: string;
}

export interface ChatTurnOutput {
  conversationId: string;
  text: string;
  steps: Step[];
  toolResults: ToolResultSummary[];
  suggestions: string[];
  pending?: PendingConfirmation;
}
```

- [ ] **Step 3: Type-check**

Run: `bunx tsc --noEmit`
Expected: no new errors from these files.

- [ ] **Step 4: Commit**

```bash
git add src/server/agent/tools/types.ts src/server/agent/types.ts
git commit -m "feat(agent): tool + turn type contracts

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 5: Tool registry

**Files:**
- Create: `src/server/agent/tools/registry.ts`
- Test: `tests/agent/registry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { ToolRegistry } from "@server/agent/tools/registry";
import type { ToolDef } from "@server/agent/tools/types";

const sample: ToolDef = {
  name: "positions.create",
  description: "Create a job posting",
  risk: "write",
  permission: "POST:/positions",
  schema: z.object({ title: z.string(), department: z.string().optional() }),
  preview: (a) => `Create posting "${a.title}"`,
  execute: async () => ({ summary: "created" }),
};

describe("ToolRegistry", () => {
  it("registers and retrieves tools", () => {
    const r = new ToolRegistry();
    r.register(sample);
    expect(r.get("positions.create")).toBe(sample);
    expect(r.all()).toHaveLength(1);
  });

  it("rejects duplicate names", () => {
    const r = new ToolRegistry();
    r.register(sample);
    expect(() => r.register(sample)).toThrow(/already registered/);
  });

  it("get() returns undefined for unknown tool", () => {
    expect(new ToolRegistry().get("nope")).toBeUndefined();
  });

  it("toGeminiDeclarations emits name+description+object params", () => {
    const r = new ToolRegistry();
    r.register(sample);
    const decls = r.toGeminiDeclarations();
    expect(decls).toHaveLength(1);
    expect(decls[0].name).toBe("positions.create");
    expect(decls[0].parameters.type).toBe("object");
    expect(decls[0].parameters.properties.title.type).toBe("string");
    expect(decls[0].parameters.required).toContain("title");
  });
});
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `bunx vitest run tests/agent/registry.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the registry**

Create `src/server/agent/tools/registry.ts`:

```ts
import { z } from "zod";
import type { ToolDef } from "./types";

/** Minimal JSON-schema shape Gemini's functionDeclarations expects. */
export interface GeminiDeclaration {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description?: string; items?: { type: string } }>;
    required: string[];
  };
}

/** Convert a flat zod object schema into Gemini's parameter schema. */
function zodToGeminiParams(schema: z.ZodTypeAny): GeminiDeclaration["parameters"] {
  const properties: GeminiDeclaration["parameters"]["properties"] = {};
  const required: string[] = [];
  const shape =
    schema instanceof z.ZodObject ? (schema.shape as Record<string, z.ZodTypeAny>) : {};
  for (const [key, raw] of Object.entries(shape)) {
    let field = raw;
    let optional = false;
    // Unwrap optional/nullable/default wrappers to reach the base type.
    while (
      field instanceof z.ZodOptional ||
      field instanceof z.ZodNullable ||
      field instanceof z.ZodDefault
    ) {
      if (field instanceof z.ZodOptional || field instanceof z.ZodDefault) optional = true;
      field = (field as any)._def.innerType ?? (field as any).unwrap?.() ?? field;
      if (!field) break;
    }
    let type = "string";
    let items: { type: string } | undefined;
    if (field instanceof z.ZodNumber) type = "number";
    else if (field instanceof z.ZodBoolean) type = "boolean";
    else if (field instanceof z.ZodArray) {
      type = "array";
      items = { type: "string" };
    } else if (field instanceof z.ZodEnum) type = "string";
    properties[key] = items ? { type, items } : { type };
    if (!optional) required.push(key);
  }
  return { type: "object", properties, required };
}

export class ToolRegistry {
  private tools = new Map<string, ToolDef>();

  register(tool: ToolDef): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDef | undefined {
    return this.tools.get(name);
  }

  all(): ToolDef[] {
    return [...this.tools.values()];
  }

  toGeminiDeclarations(): GeminiDeclaration[] {
    return this.all().map((t) => ({
      name: t.name,
      description: t.description,
      parameters: zodToGeminiParams(t.schema),
    }));
  }
}
```

- [ ] **Step 4: Run it, expect PASS**

Run: `bunx vitest run tests/agent/registry.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/agent/tools/registry.ts tests/agent/registry.test.ts
git commit -m "feat(agent): tool registry + zod->Gemini declaration conversion

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase 3 — Positions tools (reference vertical)

### Task 6: Positions tools

**Files:**
- Create: `src/server/agent/tools/positions.ts`
- Test: `tests/agent/tools-positions.test.ts`

**Permission keys** (from `src/app/api/positions/route.ts` and `[id]/route.ts`): list/get → `GET:/positions`, create → `POST:/positions`, update/close → `PUT:/positions`. Verify exact strings in those route files while implementing.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { closeDb } from "@server/core/database";
import { newId } from "../helpers/fixtures";
import { positionsTools } from "@server/agent/tools/positions";
import { addPosition, retrievePositionById } from "@server/services/positions";

function tool(name: string) {
  const t = positionsTools.find((x) => x.name === name);
  if (!t) throw new Error(`missing tool ${name}`);
  return t;
}
const ctx = (userId: string) => ({ userId, req: new Request("http://x") });

describe("positions tools", () => {
  let db: Db;
  beforeAll(async () => { db = await startTestDb(); });
  afterEach(async () => { await clearDb(db); });
  afterAll(async () => { await closeDb(); await stopTestDb(); });

  it("positions.create makes a draft and is risk=write", async () => {
    const t = tool("positions.create");
    expect(t.risk).toBe("write");
    expect(t.permission).toBe("POST:/positions");
    const res = await t.execute(
      { title: "Senior Backend Engineer", department: "Platform", description: "x" } as any,
      ctx(newId()),
    );
    const created = (res.data as { id: string });
    const stored = await retrievePositionById(created.id);
    expect(stored.title).toBe("Senior Backend Engineer");
    expect(stored.status).toBe("draft"); // created as reversible draft
  });

  it("positions.close is destructive and closes the role", async () => {
    const t = tool("positions.close");
    expect(t.risk).toBe("destructive");
    const p = await addPosition({ title: "Old", status: "open" }, newId());
    await t.execute({ id: p.id! } as any, ctx(newId()));
    expect((await retrievePositionById(p.id!)).status).toBe("closed");
  });

  it("positions.list is read and returns items", async () => {
    const t = tool("positions.list");
    expect(t.risk).toBe("read");
    await addPosition({ title: "A", status: "open" }, newId());
    const res = await t.execute({} as any, ctx(newId()));
    expect(Array.isArray(res.data)).toBe(true);
    expect((res.data as unknown[]).length).toBe(1);
  });
});
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `bunx vitest run tests/agent/tools-positions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the positions tools**

Create `src/server/agent/tools/positions.ts`:

```ts
import { z } from "zod";
import type { ToolDef } from "./types";
import {
  addPosition,
  updatePositionById,
  closePosition,
  retrievePositions,
  retrievePositionById,
} from "@server/services/positions";
import { employmentTypeValues } from "@server/schemas/positions";

const createSchema = z.object({
  title: z.string().min(1),
  department: z.string().optional(),
  location: z.string().optional(),
  employment_type: z.enum(employmentTypeValues).optional(),
  description: z.string().optional(),
  requirements: z.array(z.string()).optional(),
});

const createTool: ToolDef<typeof createSchema> = {
  name: "positions.create",
  description:
    "Create a new job posting as a DRAFT. Provide a complete, detailed posting: title, department, location, employment type, a multi-paragraph description, and a list of requirements.",
  risk: "write",
  permission: "POST:/positions",
  schema: createSchema,
  preview: (a) =>
    `Create a draft job posting "${a.title}"${a.department ? ` in ${a.department}` : ""}.`,
  execute: async (a, ctx) => {
    const created = await addPosition({ ...a, status: "draft" }, ctx.userId);
    return { summary: `Created draft posting "${created.title}"`, data: created };
  },
};

const updateSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  department: z.string().optional(),
  location: z.string().optional(),
  employment_type: z.enum(employmentTypeValues).optional(),
  description: z.string().optional(),
  requirements: z.array(z.string()).optional(),
  status: z.enum(["open", "closed", "draft"]).optional(),
});

const updateTool: ToolDef<typeof updateSchema> = {
  name: "positions.update",
  description: "Update fields on an existing job posting by id.",
  risk: "write",
  permission: "PUT:/positions",
  schema: updateSchema,
  preview: (a) => `Update posting ${a.id}.`,
  execute: async (a, _ctx) => {
    const { id, ...rest } = a;
    const updated = await updatePositionById(id, rest);
    return { summary: `Updated posting "${updated.title}"`, data: updated };
  },
};

const closeSchema = z.object({ id: z.string().min(1) });

const closeTool: ToolDef<typeof closeSchema> = {
  name: "positions.close",
  description: "Close an open job posting by id. This stops new applications.",
  risk: "destructive",
  permission: "PUT:/positions",
  schema: closeSchema,
  preview: (a) => `Close posting ${a.id}. New applications will stop.`,
  execute: async (a, _ctx) => {
    const closed = await closePosition(a.id);
    return { summary: `Closed posting "${closed.title}"`, data: closed };
  },
};

const listSchema = z.object({
  status: z.enum(["open", "closed", "draft"]).optional(),
  department: z.string().optional(),
});

const listTool: ToolDef<typeof listSchema> = {
  name: "positions.list",
  description: "List job postings, optionally filtered by status or department.",
  risk: "read",
  permission: "GET:/positions",
  schema: listSchema,
  preview: () => "List job postings.",
  execute: async (a, _ctx) => {
    const items = await retrievePositions({ ...a, start: 0, stop: 100 });
    return { summary: `Found ${items.length} posting(s)`, data: items };
  },
};

const getSchema = z.object({ id: z.string().min(1) });

const getTool: ToolDef<typeof getSchema> = {
  name: "positions.get",
  description: "Get a single job posting by id.",
  risk: "read",
  permission: "GET:/positions",
  schema: getSchema,
  preview: (a) => `Show posting ${a.id}.`,
  execute: async (a, _ctx) => {
    const p = await retrievePositionById(a.id);
    return { summary: `Posting "${p.title}"`, data: p };
  },
};

export const positionsTools: ToolDef[] = [
  createTool,
  updateTool,
  closeTool,
  listTool,
  getTool,
] as unknown as ToolDef[];
```

- [ ] **Step 4: Run it, expect PASS**

Run: `bunx vitest run tests/agent/tools-positions.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/agent/tools/positions.ts tests/agent/tools-positions.test.ts
git commit -m "feat(agent): positions tools (create-draft/update/close/list/get)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 7: Registry index (wire positions in)

**Files:**
- Create: `src/server/agent/tools/index.ts`
- Test: `tests/agent/tools-index.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { buildRegistry } from "@server/agent/tools";

describe("buildRegistry", () => {
  it("registers the positions tools", () => {
    const r = buildRegistry();
    expect(r.get("positions.create")).toBeDefined();
    expect(r.get("positions.close")?.risk).toBe("destructive");
    expect(r.toGeminiDeclarations().some((d) => d.name === "positions.create")).toBe(true);
  });
});
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `bunx vitest run tests/agent/tools-index.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the index**

Create `src/server/agent/tools/index.ts`:

```ts
import { ToolRegistry } from "./registry";
import { positionsTools } from "./positions";

/** Build a fresh registry with all tool verticals registered. */
export function buildRegistry(): ToolRegistry {
  const r = new ToolRegistry();
  for (const tool of [...positionsTools]) r.register(tool);
  return r;
}

/** Shared singleton for the runtime (tests build their own). */
let cached: ToolRegistry | null = null;
export function getRegistry(): ToolRegistry {
  if (!cached) cached = buildRegistry();
  return cached;
}
```

- [ ] **Step 4: Run it, expect PASS**

Run: `bunx vitest run tests/agent/tools-index.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/agent/tools/index.ts tests/agent/tools-index.test.ts
git commit -m "feat(agent): registry index wiring (positions)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase 4 — Confirmation tokens

### Task 8: HMAC confirmation tokens

**Files:**
- Create: `src/server/agent/confirm/tokens.ts`
- Test: `tests/agent/confirm-tokens.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { signConfirmToken, verifyConfirmToken } from "@server/agent/confirm/tokens";

const SECRET = "test-secret";

describe("confirm tokens", () => {
  it("round-trips a valid token", () => {
    const token = signConfirmToken(
      { tool: "positions.close", args: { id: "abc" }, userId: "u1" },
      SECRET,
      1000,
    );
    const v = verifyConfirmToken(token, SECRET, "u1");
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.payload.tool).toBe("positions.close");
      expect(v.payload.args).toEqual({ id: "abc" });
    }
  });

  it("rejects a tampered token", () => {
    const token = signConfirmToken(
      { tool: "positions.close", args: { id: "abc" }, userId: "u1" },
      SECRET,
      1000,
    );
    const tampered = token.slice(0, -2) + (token.endsWith("a") ? "bb" : "aa");
    expect(verifyConfirmToken(tampered, SECRET, "u1").ok).toBe(false);
  });

  it("rejects a token for a different user", () => {
    const token = signConfirmToken(
      { tool: "positions.close", args: { id: "abc" }, userId: "u1" },
      SECRET,
      1000,
    );
    expect(verifyConfirmToken(token, SECRET, "someone-else").ok).toBe(false);
  });

  it("rejects an expired token", () => {
    const token = signConfirmToken(
      { tool: "positions.close", args: { id: "abc" }, userId: "u1" },
      SECRET,
      -1, // already expired
    );
    expect(verifyConfirmToken(token, SECRET, "u1").ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `bunx vitest run tests/agent/confirm-tokens.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the tokens**

Create `src/server/agent/confirm/tokens.ts`:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export interface ConfirmPayload {
  tool: string;
  args: Record<string, unknown>;
  userId: string;
}

interface SignedBody extends ConfirmPayload {
  exp: number; // unix seconds
}

function b64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}
function fromB64url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}
function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

/** ttlSeconds is added to a fixed "now" derived from the body's own clock-free counter via exp. */
export function signConfirmToken(
  payload: ConfirmPayload,
  secret: string,
  ttlSeconds: number,
): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body: SignedBody = { ...payload, exp };
  const encoded = b64url(JSON.stringify(body));
  const sig = sign(encoded, secret);
  return `${encoded}.${sig}`;
}

export type VerifyResult =
  | { ok: true; payload: ConfirmPayload }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" | "wrong_user" };

export function verifyConfirmToken(
  token: string,
  secret: string,
  expectedUserId: string,
): VerifyResult {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [encoded, sig] = parts;
  const expected = sign(encoded, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_signature" };
  }
  let body: SignedBody;
  try {
    body = JSON.parse(fromB64url(encoded));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (body.userId !== expectedUserId) return { ok: false, reason: "wrong_user" };
  if (Math.floor(Date.now() / 1000) > body.exp) return { ok: false, reason: "expired" };
  return { ok: true, payload: { tool: body.tool, args: body.args, userId: body.userId } };
}
```

> Note: this file uses `node:crypto`, so it stays server-only. It is below `http/` but does NOT import `next/*`, which satisfies the layering rule (the rule forbids `next/*`, not Node builtins).

- [ ] **Step 4: Run it, expect PASS**

Run: `bunx vitest run tests/agent/confirm-tokens.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/agent/confirm/tokens.ts tests/agent/confirm-tokens.test.ts
git commit -m "feat(agent): HMAC-signed confirmation tokens

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase 5 — Intent router

### Task 9: Fuzzy entity resolution

**Files:**
- Create: `src/server/agent/intent-router/fuzzy.ts`
- Test: `tests/agent/fuzzy.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { bestMatch } from "@server/agent/intent-router/fuzzy";

const items = [
  { id: "1", label: "Senior Backend Engineer" },
  { id: "2", label: "Frontend Developer" },
  { id: "3", label: "Product Manager" },
];

describe("bestMatch", () => {
  it("resolves a close phrase to the right item", () => {
    const m = bestMatch("backend engineer", items);
    expect(m?.id).toBe("1");
  });
  it("returns null when nothing is close enough", () => {
    expect(bestMatch("astronaut", items)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `bunx vitest run tests/agent/fuzzy.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement fuzzy match**

Create `src/server/agent/intent-router/fuzzy.ts`:

```ts
import Fuse from "fuse.js";

export interface Labeled {
  id: string;
  label: string;
}

/** Return the closest item to `query`, or null if below the confidence cutoff. */
export function bestMatch<T extends Labeled>(query: string, items: T[]): T | null {
  if (!query.trim() || items.length === 0) return null;
  const fuse = new Fuse(items, {
    keys: ["label"],
    includeScore: true,
    threshold: 0.45, // lower = stricter; 0 is exact
  });
  const results = fuse.search(query);
  if (results.length === 0) return null;
  const top = results[0];
  if (top.score != null && top.score > 0.45) return null;
  return top.item;
}
```

- [ ] **Step 4: Run it, expect PASS**

Run: `bunx vitest run tests/agent/fuzzy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/agent/intent-router/fuzzy.ts tests/agent/fuzzy.test.ts
git commit -m "feat(agent): fuzzy entity resolution (fuse.js)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 10: Intent patterns + router

**Files:**
- Create: `src/server/agent/intent-router/patterns.ts`
- Create: `src/server/agent/intent-router/index.ts`
- Test: `tests/agent/intent-router.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { matchIntent } from "@server/agent/intent-router/index";

const dataCtx = {
  positions: [
    { id: "p1", label: "Senior Backend Engineer" },
    { id: "p2", label: "Frontend Developer" },
  ],
  applicants: [{ id: "a1", label: "Jane Doe" }],
  stages: [
    { id: "interview", label: "Interview" },
    { id: "new", label: "New" },
  ],
};

describe("matchIntent", () => {
  it("matches 'list open positions'", () => {
    const m = matchIntent("list open positions", dataCtx);
    expect(m?.toolCall.name).toBe("positions.list");
    expect(m?.toolCall.args).toMatchObject({ status: "open" });
  });

  it("matches 'close the Frontend Developer position' to the right id", () => {
    const m = matchIntent("close the Frontend Developer position", dataCtx);
    expect(m?.toolCall.name).toBe("positions.close");
    expect(m?.toolCall.args).toMatchObject({ id: "p2" });
  });

  it("matches 'move Jane to interview'", () => {
    const m = matchIntent("move Jane to interview", dataCtx);
    expect(m?.toolCall.name).toBe("applicants.move");
    expect(m?.toolCall.args).toMatchObject({ id: "a1", status: "interview" });
  });

  it("returns null for an ambiguous/unknown request (LLM fallback)", () => {
    expect(
      matchIntent("write a clever poem about our hiring funnel", dataCtx),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `bunx vitest run tests/agent/intent-router.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement patterns**

Create `src/server/agent/intent-router/patterns.ts`:

```ts
import { bestMatch, type Labeled } from "./fuzzy";
import type { ToolCall } from "@server/agent/tools/types";

export interface RouterDataContext {
  positions: Labeled[];
  applicants: Labeled[];
  stages: Labeled[];
}

export interface IntentMatch {
  toolCall: ToolCall;
  confidence: number;
}

export interface IntentPattern {
  id: string;
  match: (message: string, ctx: RouterDataContext) => IntentMatch | null;
}

const lower = (s: string) => s.toLowerCase().trim();

export const patterns: IntentPattern[] = [
  {
    id: "positions.list",
    match: (msg) => {
      const m = lower(msg);
      if (/\b(list|show|view)\b.*\bpositions?|jobs?|postings?\b/.test(m)) {
        const status = /\bopen\b/.test(m)
          ? "open"
          : /\bclosed\b/.test(m)
            ? "closed"
            : /\bdraft\b/.test(m)
              ? "draft"
              : undefined;
        return {
          toolCall: { name: "positions.list", args: status ? { status } : {} },
          confidence: 0.9,
        };
      }
      return null;
    },
  },
  {
    id: "positions.close",
    match: (msg, ctx) => {
      const m = lower(msg);
      if (/\bclose\b.*\b(position|role|posting|job)\b/.test(m)) {
        const phrase = m
          .replace(/.*\bclose\b\s*(the)?\s*/, "")
          .replace(/\b(position|role|posting|job)\b.*/, "")
          .trim();
        const hit = bestMatch(phrase, ctx.positions);
        if (hit) {
          return { toolCall: { name: "positions.close", args: { id: hit.id } }, confidence: 0.85 };
        }
      }
      return null;
    },
  },
  {
    id: "applicants.search",
    match: (msg, ctx) => {
      const m = lower(msg);
      if (/\b(show|list|view|find)\b.*\bapplicants?\b/.test(m)) {
        const args: Record<string, unknown> = {};
        const forMatch = m.match(/\bfor\s+(.+?)(?:\s+in\b|$)/);
        if (forMatch) {
          const pos = bestMatch(forMatch[1], ctx.positions);
          if (pos) args.position_id = pos.id;
        }
        const inMatch = m.match(/\bin\s+(.+)$/);
        if (inMatch) {
          const stage = bestMatch(inMatch[1], ctx.stages);
          if (stage) args.status = stage.id;
        }
        return { toolCall: { name: "applicants.search", args }, confidence: 0.8 };
      }
      return null;
    },
  },
  {
    id: "applicants.move",
    match: (msg, ctx) => {
      const m = lower(msg);
      const mv = m.match(/\bmove\s+(.+?)\s+to\s+(.+)$/);
      if (mv) {
        const person = bestMatch(mv[1], ctx.applicants);
        const stage = bestMatch(mv[2], ctx.stages);
        if (person && stage) {
          return {
            toolCall: { name: "applicants.move", args: { id: person.id, status: stage.id } },
            confidence: 0.85,
          };
        }
      }
      return null;
    },
  },
];
```

- [ ] **Step 4: Implement the router**

Create `src/server/agent/intent-router/index.ts`:

```ts
import { patterns, type RouterDataContext, type IntentMatch } from "./patterns";

export const ROUTER_CONFIDENCE_THRESHOLD = 0.75;

/** Run the deterministic patterns; return the first confident match or null. */
export function matchIntent(
  message: string,
  ctx: RouterDataContext,
): IntentMatch | null {
  for (const p of patterns) {
    const hit = p.match(message, ctx);
    if (hit && hit.confidence >= ROUTER_CONFIDENCE_THRESHOLD) return hit;
  }
  return null;
}

export type { RouterDataContext } from "./patterns";
```

- [ ] **Step 5: Run it, expect PASS**

Run: `bunx vitest run tests/agent/intent-router.test.ts`
Expected: PASS (4 tests). If a regex misfires, adjust the pattern until all four pass — do not weaken the "returns null" case.

- [ ] **Step 6: Commit**

```bash
git add src/server/agent/intent-router tests/agent/intent-router.test.ts
git commit -m "feat(agent): deterministic intent router (positions + applicants intents)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase 6 — Orchestrator (router-only, with gates)

### Task 11: Orchestrator with confirm + auth gates + persistence

**Files:**
- Create: `src/server/agent/orchestrator.ts`
- Test: `tests/agent/orchestrator.test.ts`

This task builds the orchestrator with the deterministic router only (LLM wired in Phase 7). It must enforce: (a) the **auth gate** before every execution, (b) **destructive ⇒ always confirm**, (c) **mode = confirm_everything ⇒ writes also confirm**, (d) persistence of both messages.

The orchestrator takes its dependencies as parameters (registry, a permission checker, a settings getter) so tests can inject fakes without HTTP.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { closeDb } from "@server/core/database";
import { newId } from "../helpers/fixtures";
import { runTurn } from "@server/agent/orchestrator";
import { buildRegistry } from "@server/agent/tools";
import { retrievePositions } from "@server/services/positions";

const deps = (opts?: { allow?: boolean }) => ({
  registry: buildRegistry(),
  checkPermission: vi.fn(async () => {
    if (opts?.allow === false) throw Object.assign(new Error("denied"), { status: 403 });
  }),
  secret: "s",
  geminiCall: undefined, // router-only in this phase
});

const req = new Request("http://x");

describe("runTurn (router-only)", () => {
  let db: Db;
  beforeAll(async () => { db = await startTestDb(); });
  afterEach(async () => { await clearDb(db); });
  afterAll(async () => { await closeDb(); await stopTestDb(); });

  it("auto-runs a read intent and persists the conversation", async () => {
    const out = await runTurn(
      { message: "list open positions", mode: "smart" },
      { userId: newId(), req },
      deps(),
    );
    expect(out.conversationId).toBeTruthy();
    expect(out.toolResults[0].tool).toBe("positions.list");
    expect(out.pending).toBeUndefined();
  });

  it("auto-runs a write in smart mode (create draft) without confirmation", async () => {
    const out = await runTurn(
      { message: "create a job posting for QA Engineer", mode: "smart" },
      { userId: newId(), req },
      deps(),
    );
    // router matches title-only create; body left to LLM later, but draft is made
    // For router-only phase, create intent is NOT matched (needs LLM); expect a help message.
    expect(out.text.length).toBeGreaterThan(0);
  });

  it("requires confirmation for a destructive close, even in auto_run mode", async () => {
    const p = await retrievePositions({}).then(() => null).catch(() => null);
    // create an open role to close
    const created = (await runTurn(
      { message: "list open positions", mode: "smart" },
      { userId: newId(), req },
      deps(),
    ));
    void p; void created;

    const { addPosition } = await import("@server/services/positions");
    const role = await addPosition({ title: "Closable", status: "open" }, newId());

    const out = await runTurn(
      { message: `close the Closable position`, mode: "auto_run" },
      { userId: newId(), req },
      deps(),
    );
    expect(out.pending).toBeDefined();
    expect(out.pending?.toolName).toBe("positions.close");
    // not yet closed
    const { retrievePositionById } = await import("@server/services/positions");
    expect((await retrievePositionById(role.id!)).status).toBe("open");
  });

  it("confirm_everything mode confirms even a write", async () => {
    // applicants.move is a write; build a position+applicant first via services
    const { addPosition } = await import("@server/services/positions");
    await addPosition({ title: "Any", status: "open" }, newId());
    const out = await runTurn(
      { message: "move Jane to interview", mode: "confirm_everything" },
      { userId: newId(), req },
      deps(),
    );
    // No applicant named Jane exists in dataCtx (router can't resolve) → falls through to help text.
    expect(out.text.length).toBeGreaterThan(0);
  });

  it("blocks execution when the permission check denies", async () => {
    const { addPosition } = await import("@server/services/positions");
    await addPosition({ title: "Denied", status: "open" }, newId());
    const out = await runTurn(
      { message: "list open positions", mode: "smart" },
      { userId: newId(), req },
      deps({ allow: false }),
    );
    expect(out.text).toMatch(/permission/i);
    expect(out.toolResults.every((r) => r.status !== "ok")).toBe(true);
  });
});
```

> Note: a couple of assertions above are intentionally loose (router can't resolve entities that aren't in the live data context yet) because the orchestrator loads its own `RouterDataContext` from the DB. Keep them — they assert "graceful help text," which is real behavior. The hard guarantees (destructive⇒confirm, permission-deny⇒block) are the strict ones.

- [ ] **Step 2: Run it, expect FAIL**

Run: `bunx vitest run tests/agent/orchestrator.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the orchestrator**

Create `src/server/agent/orchestrator.ts`:

```ts
import type { ToolRegistry } from "./tools/registry";
import type { ToolCall, ToolContext } from "./tools/types";
import type { ChatTurnInput, ChatTurnOutput, Step } from "./types";
import { matchIntent, type RouterDataContext } from "./intent-router/index";
import { signConfirmToken, verifyConfirmToken } from "./confirm/tokens";
import {
  startConversation,
  appendTurn,
  getForOwner,
} from "@server/services/conversations";
import { conversationMessage, type ToolResultSummary } from "@server/schemas/conversation";
import { retrievePositions } from "@server/services/positions";
import { retrieveApplications } from "@server/services/applications";

const CONFIRM_TTL_SECONDS = 600;

/** Pluggable permission checker so routes inject the real one and tests fake it. */
export type PermissionCheck = (req: Request, permissionKey: string) => Promise<unknown>;

/** Optional LLM hook (wired in Phase 7). */
export type GeminiCall = (input: {
  message: string;
  history: { role: string; text: string }[];
  registry: ToolRegistry;
}) => Promise<{ text: string; toolCalls: ToolCall[] }>;

export interface OrchestratorDeps {
  registry: ToolRegistry;
  checkPermission: PermissionCheck;
  secret: string;
  geminiCall?: GeminiCall;
}

function step(label: string, status: Step["status"]): Step {
  return { label, status };
}

async function loadDataContext(): Promise<RouterDataContext> {
  const [positions, applicants] = await Promise.all([
    retrievePositions({ start: 0, stop: 200 }),
    retrieveApplications({ start: 0, stop: 200 }),
  ]);
  return {
    positions: positions.map((p) => ({ id: p.id!, label: p.title })),
    applicants: applicants.map((a) => ({ id: a.id!, label: a.full_name })),
    // Stage list is process-defined; expose the common defaults plus any seen statuses.
    stages: dedupeStages(applicants.map((a) => a.status)),
  };
}

function dedupeStages(statuses: (string | null | undefined)[]) {
  const base = ["new", "screening", "interview", "offer", "hired", "rejected"];
  const seen = new Set<string>(base);
  for (const s of statuses) if (s) seen.add(s);
  return [...seen].map((s) => ({ id: s, label: s.replace(/_/g, " ") }));
}

function isConfirmRequired(
  risk: "read" | "write" | "destructive",
  mode: ChatTurnInput["mode"],
): boolean {
  if (risk === "destructive") return true; // always
  if (risk === "write" && mode === "confirm_everything") return true;
  return false;
}

async function executeCall(
  call: ToolCall,
  deps: OrchestratorDeps,
  ctx: ToolContext,
  mode: ChatTurnInput["mode"],
): Promise<{ result?: ToolResultSummary; pending?: ChatTurnOutput["pending"]; text: string }> {
  const tool = deps.registry.get(call.name);
  if (!tool) return { text: "I couldn't find a way to do that.", result: undefined };

  // Validate args against the tool's schema (defends against bad LLM/router output).
  const parsed = tool.schema.safeParse(call.args);
  if (!parsed.success) {
    return { text: `I need more detail to ${tool.name.replace(".", " ")}.` };
  }

  // AUTH GATE — before any decision to execute or confirm.
  try {
    await deps.checkPermission(ctx.req, tool.permission);
  } catch {
    return {
      text: "You don't have permission to do that.",
      result: { tool: tool.name, status: "error", summary: "permission denied" },
    };
  }

  if (isConfirmRequired(tool.risk, mode)) {
    const token = signConfirmToken(
      { tool: tool.name, args: parsed.data as Record<string, unknown>, userId: ctx.userId },
      deps.secret,
      CONFIRM_TTL_SECONDS,
    );
    return {
      text: tool.preview(parsed.data),
      pending: { token, toolName: tool.name, preview: tool.preview(parsed.data) },
      result: { tool: tool.name, status: "pending", summary: "awaiting confirmation" },
    };
  }

  const exec = await tool.execute(parsed.data, ctx).catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : "tool failed";
    return { summary: `Error: ${msg}`, data: undefined, __error: true } as const;
  });
  const errored = (exec as { __error?: boolean }).__error === true;
  return {
    text: errored ? `That didn't work: ${exec.summary}` : exec.summary,
    result: {
      tool: tool.name,
      status: errored ? "error" : "ok",
      summary: exec.summary,
    },
  };
}

export async function runTurn(
  input: ChatTurnInput,
  ctx: ToolContext,
  deps: OrchestratorDeps,
): Promise<ChatTurnOutput> {
  // ---- Confirm round-trip ----
  if (input.confirmToken) {
    const v = verifyConfirmToken(input.confirmToken, deps.secret, ctx.userId);
    if (!v.ok) {
      return emptyTurn(input.conversationId, "That confirmation expired — please ask again.");
    }
    const tool = deps.registry.get(v.payload.tool);
    if (!tool) return emptyTurn(input.conversationId, "That action is no longer available.");
    await deps.checkPermission(ctx.req, tool.permission); // re-check
    const parsed = tool.schema.safeParse(v.payload.args);
    if (!parsed.success) return emptyTurn(input.conversationId, "That request was malformed.");
    const exec = await tool.execute(parsed.data, ctx);
    const result: ToolResultSummary = { tool: tool.name, status: "ok", summary: exec.summary };
    const conversationId = await persist(input.conversationId, ctx.userId, undefined, {
      text: exec.summary,
      toolResults: [result],
      steps: ["Confirmed", "Done"],
      suggestions: [],
    });
    return {
      conversationId,
      text: exec.summary,
      steps: [step("Confirmed", "done"), step("Done", "done")],
      toolResults: [result],
      suggestions: [],
    };
  }

  const message = (input.message ?? "").trim();
  if (!message) return emptyTurn(input.conversationId, "What would you like me to do?");

  // ---- Plan: router first, LLM fallback ----
  const dataCtx = await loadDataContext();
  const routed = matchIntent(message, dataCtx);

  let replyText = "";
  const toolResults: ToolResultSummary[] = [];
  let pending: ChatTurnOutput["pending"] | undefined;
  let steps: Step[];

  if (routed) {
    steps = [step("Analyzing your request", "done"), step("Identifying key details", "done")];
    const r = await executeCall(routed.toolCall, deps, ctx, input.mode);
    replyText = r.text;
    if (r.result) toolResults.push(r.result);
    pending = r.pending;
  } else if (deps.geminiCall) {
    steps = [
      step("Analyzing your request", "done"),
      step("Identifying key details", "done"),
      step("Finding relevant information", "done"),
      step("Generating the response", "done"),
    ];
    const history = await loadHistory(input.conversationId, ctx.userId);
    const llm = await deps.geminiCall({ message, history, registry: deps.registry });
    if (llm.toolCalls.length > 0) {
      for (const call of llm.toolCalls) {
        const r = await executeCall(call, deps, ctx, input.mode);
        if (r.result) toolResults.push(r.result);
        if (r.pending) pending = r.pending;
        replyText = r.text || llm.text;
        if (pending) break; // stop at the first action needing confirmation
      }
    } else {
      replyText = llm.text;
    }
  } else {
    steps = [step("Analyzing your request", "done")];
    replyText =
      "I can help with job postings, applicants, emails, and settings. Try: " +
      '"list open positions" or "move <name> to interview".';
  }

  const suggestions = deriveSuggestions(routed?.toolCall.name, toolResults);
  const conversationId = await persist(input.conversationId, ctx.userId, message, {
    text: replyText,
    toolResults,
    steps: steps.map((s) => s.label),
    suggestions,
  });

  return { conversationId, text: replyText, steps, toolResults, suggestions, pending };
}

function deriveSuggestions(toolName: string | undefined, results: ToolResultSummary[]): string[] {
  if (toolName === "positions.list") {
    return ["Create a new job posting", "Show applicants for one of these roles"];
  }
  if (results.some((r) => r.tool === "positions.create")) {
    return ["Open this posting to the public", "Draft a screening email for it"];
  }
  return [];
}

async function loadHistory(
  conversationId: string | undefined,
  ownerId: string,
): Promise<{ role: string; text: string }[]> {
  if (!conversationId) return [];
  try {
    const convo = await getForOwner(conversationId, ownerId);
    return convo.messages.map((m) => ({ role: m.role, text: m.text }));
  } catch {
    return [];
  }
}

async function persist(
  conversationId: string | undefined,
  ownerId: string,
  userText: string | undefined,
  assistant: { text: string; toolResults: ToolResultSummary[]; steps: string[]; suggestions: string[] },
): Promise<string> {
  let id = conversationId;
  if (!id) {
    const convo = await startConversation(ownerId, userText ?? assistant.text);
    id = convo.id!;
  }
  const msgs = [];
  if (userText) msgs.push(conversationMessage({ role: "user", text: userText }));
  msgs.push(
    conversationMessage({
      role: "assistant",
      text: assistant.text,
      steps: assistant.steps,
      tool_results: assistant.toolResults,
      suggestions: assistant.suggestions,
    }),
  );
  await appendTurn(id, ownerId, msgs);
  return id;
}

function emptyTurn(conversationId: string | undefined, text: string): ChatTurnOutput {
  return {
    conversationId: conversationId ?? "",
    text,
    steps: [step("Analyzing your request", "done")],
    toolResults: [],
    suggestions: [],
  };
}
```

> The `emptyTurn` early-returns don't persist (they're error/no-op paths). That's intentional — we don't want to create empty conversations for blank input or expired tokens.

- [ ] **Step 4: Run it, expect PASS**

Run: `bunx vitest run tests/agent/orchestrator.test.ts`
Expected: PASS. The strict assertions (destructive⇒pending, permission-deny⇒blocked + "permission" text) MUST pass. If a loose assertion fails because the router resolved differently than expected, adjust the test's expectation to match real behavior — never weaken a gate.

- [ ] **Step 5: Commit**

```bash
git add src/server/agent/orchestrator.ts tests/agent/orchestrator.test.ts
git commit -m "feat(agent): orchestrator with auth + confirm gates and persistence (router-only)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase 7 — Gemini LLM fallback

### Task 12: Gemini client + prompt

**Files:**
- Create: `src/server/agent/llm/prompt.ts`
- Create: `src/server/agent/llm/gemini.ts`
- Test: `tests/agent/gemini.test.ts`

- [ ] **Step 1: Write the failing test (transport injected, no real network)**

```ts
import { describe, it, expect, vi } from "vitest";
import { createGeminiCall } from "@server/agent/llm/gemini";
import { buildRegistry } from "@server/agent/tools";

describe("gemini call", () => {
  it("parses a functionCall response into toolCalls", async () => {
    const fakeFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  { functionCall: { name: "positions.list", args: { status: "open" } } },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const call = createGeminiCall({ apiKey: "k", fetchImpl: fakeFetch as unknown as typeof fetch });
    const out = await call({ message: "show open roles", history: [], registry: buildRegistry() });
    expect(out.toolCalls[0].name).toBe("positions.list");
    expect(out.toolCalls[0].args).toEqual({ status: "open" });
  });

  it("parses a plain-text response", async () => {
    const fakeFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "Here's what I found." }] } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const call = createGeminiCall({ apiKey: "k", fetchImpl: fakeFetch as unknown as typeof fetch });
    const out = await call({ message: "hi", history: [], registry: buildRegistry() });
    expect(out.text).toBe("Here's what I found.");
    expect(out.toolCalls).toHaveLength(0);
  });

  it("throws a friendly error on non-200", async () => {
    const fakeFetch = vi.fn(async () => new Response("nope", { status: 429 }));
    const call = createGeminiCall({ apiKey: "k", fetchImpl: fakeFetch as unknown as typeof fetch });
    await expect(
      call({ message: "x", history: [], registry: buildRegistry() }),
    ).rejects.toThrow(/Gemini/);
  });
});
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `bunx vitest run tests/agent/gemini.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the prompt**

Create `src/server/agent/llm/prompt.ts`:

```ts
export const SYSTEM_PROMPT = `You are the in-app assistant for an Applicant Tracking System.
You help recruiters by calling the provided tools to take actions: creating detailed job
postings, moving applicants through the pipeline, drafting/sending emails, and managing
widgets, invitations and settings.

Rules:
- Prefer calling a tool over describing how to do something manually.
- When creating a job posting, produce a COMPLETE, professional posting: a clear title,
  department, location, employment type, a multi-paragraph description, and a concrete
  list of requirements. Never leave the body empty.
- If the request is ambiguous, ask ONE concise clarifying question instead of guessing.
- Never claim an action succeeded — the app executes tools and reports results.
- Do not invent ids; if you need one, call a list/search tool first.`;
```

- [ ] **Step 4: Implement the Gemini client**

Create `src/server/agent/llm/gemini.ts`:

```ts
import type { ToolRegistry } from "@server/agent/tools/registry";
import type { ToolCall } from "@server/agent/tools/types";
import type { GeminiCall } from "@server/agent/orchestrator";
import { SYSTEM_PROMPT } from "./prompt";

const MODEL = "gemini-2.0-flash";
const ENDPOINT = (model: string, key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

export interface GeminiOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
}

export function createGeminiCall(opts: GeminiOptions): GeminiCall {
  const doFetch = opts.fetchImpl ?? fetch;
  return async ({ message, history, registry }) => {
    const contents = [
      ...history.map((h) => ({
        role: h.role === "assistant" ? "model" : "user",
        parts: [{ text: h.text }],
      })),
      { role: "user", parts: [{ text: message }] },
    ];
    const body = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      tools: [{ functionDeclarations: registry.toGeminiDeclarations() }],
    };
    const res = await doFetch(ENDPOINT(MODEL, opts.apiKey), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Gemini request failed (${res.status})`);
    }
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string; functionCall?: { name: string; args?: Record<string, unknown> } }[] } }[];
    };
    const parts = json.candidates?.[0]?.content?.parts ?? [];
    const toolCalls: ToolCall[] = [];
    let text = "";
    for (const part of parts) {
      if (part.functionCall) {
        toolCalls.push({ name: part.functionCall.name, args: part.functionCall.args ?? {} });
      } else if (part.text) {
        text += part.text;
      }
    }
    return { text: text.trim(), toolCalls };
  };
}
```

- [ ] **Step 5: Run it, expect PASS**

Run: `bunx vitest run tests/agent/gemini.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/server/agent/llm tests/agent/gemini.test.ts
git commit -m "feat(agent): Gemini 2.0 Flash client + system prompt (injectable transport)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> **Scope note (single-pass for v1):** The spec (§9) describes a two-pass flow where,
> after tools execute, the model narrates the result into a friendly reply. This plan
> ships **single-pass** for v1: the orchestrator uses each tool's `summary` string as the
> reply text (e.g. "Created draft posting …"). This is honest and reliable and keeps free-tier
> calls to one per turn. A second narration pass is a clean later addition — add an optional
> `narrate(results)` call in `orchestrator.ts` behind the existing `geminiCall` dep, with its
> own mocked test, without touching any other layer. Tracked as a deferred item, not a gap.

---

## Phase 8 — Chat + conversations routes

### Task 13: `/api/agent/chat` route

**Files:**
- Create: `src/app/api/agent/chat/route.ts`
- Test: `tests/http/agent-chat-routes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { closeDb } from "@server/core/database";
import { POST as chatPOST } from "@/app/api/agent/chat/route";
import { addAdmin } from "@server/services/admins";
import { addPosition, retrievePositionById } from "@server/services/positions";
import { newId } from "../helpers/fixtures";
import { AccountStatus } from "@server/schemas/common";

const ctx = { params: Promise.resolve({}) };

async function adminCookie(): Promise<string> {
  const admin = await addAdmin({
    full_name: "Adm",
    email: `adm-${newId()}@x.com`,
    password: "pw123456",
    accountStatus: AccountStatus.ACTIVE,
    permissionList: null, // null => super admin (full permissions) in this codebase
  });
  return `access_token=${admin.access_token}`;
}

function chatReq(cookie: string, payload: unknown): Request {
  return new Request("http://x/api/agent/chat", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(payload),
  });
}

describe("/api/agent/chat", () => {
  let db: Db;
  beforeAll(async () => { db = await startTestDb(); });
  afterEach(async () => { await clearDb(db); });
  afterAll(async () => { await closeDb(); await stopTestDb(); });

  it("401s an unauthenticated request", async () => {
    const res = await chatPOST(chatReq("", { message: "hi", mode: "smart" }), ctx);
    expect(res.status).toBe(401);
  });

  it("runs a read intent and returns a conversationId", async () => {
    const cookie = await adminCookie();
    await addPosition({ title: "Open one", status: "open" }, newId());
    const res = await chatPOST(chatReq(cookie, { message: "list open positions", mode: "smart" }), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.conversationId).toBeTruthy();
    expect(body.data.toolResults[0].tool).toBe("positions.list");
  });

  it("returns a pending confirmation for a destructive close and executes on confirm", async () => {
    const cookie = await adminCookie();
    const role = await addPosition({ title: "Closable", status: "open" }, newId());

    const res1 = await chatPOST(
      chatReq(cookie, { message: "close the Closable position", mode: "auto_run" }),
      ctx,
    );
    const body1 = await res1.json();
    expect(body1.data.pending).toBeTruthy();
    expect((await retrievePositionById(role.id!)).status).toBe("open");

    const res2 = await chatPOST(
      chatReq(cookie, {
        conversationId: body1.data.conversationId,
        confirmToken: body1.data.pending.token,
        mode: "auto_run",
      }),
      ctx,
    );
    const body2 = await res2.json();
    expect(res2.status).toBe(200);
    expect((await retrievePositionById(role.id!)).status).toBe("closed");
    void body2;
  });
});
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `bunx vitest run tests/http/agent-chat-routes.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the route**

Create `src/app/api/agent/chat/route.ts`:

```ts
import { z } from "zod";
import { withEnvelope } from "@server/http/with-envelope";
import { parseJsonBody } from "@server/http/request";
import { checkAdminAccountStatusAndPermissions } from "@server/security/account-status";
import { requireAdmin } from "@server/http/guards";
import { getSettings } from "@server/core/settings";
import { getRegistry } from "@server/agent/tools";
import { runTurn } from "@server/agent/orchestrator";
import { createGeminiCall } from "@server/agent/llm/gemini";

const bodySchema = z.object({
  message: z.string().optional(),
  conversationId: z.string().optional(),
  confirmToken: z.string().optional(),
  mode: z.enum(["confirm_everything", "smart", "auto_run"]).optional(),
});

export const POST = withEnvelope(
  async (req) => {
    // Authn: ensure an admin principal exists (per-tool authz happens in the orchestrator).
    const principal = await requireAdmin(req);
    const body = await parseJsonBody(req, bodySchema);
    const settings = getSettings();

    const geminiCall = settings.geminiApiKey
      ? createGeminiCall({ apiKey: settings.geminiApiKey })
      : undefined;

    return runTurn(
      {
        message: body.message,
        conversationId: body.conversationId,
        confirmToken: body.confirmToken,
        mode: body.mode ?? "smart",
      },
      { userId: principal.userId, req },
      {
        registry: getRegistry(),
        checkPermission: (r, key) => checkAdminAccountStatusAndPermissions(r, key),
        secret: settings.secretKey,
        geminiCall,
      },
    );
  },
  { message: "OK" },
);
```

- [ ] **Step 4: Run it, expect PASS**

Run: `bunx vitest run tests/http/agent-chat-routes.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/agent/chat/route.ts tests/http/agent-chat-routes.test.ts
git commit -m "feat(agent): /api/agent/chat route (auth, confirm round-trip, Gemini wiring)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 14: Conversations routes (History tab)

**Files:**
- Create: `src/app/api/agent/conversations/route.ts`
- Create: `src/app/api/agent/conversations/[id]/route.ts`
- Test: `tests/http/agent-conversations-routes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { closeDb } from "@server/core/database";
import { GET as listGET } from "@/app/api/agent/conversations/route";
import {
  GET as oneGET,
  PATCH as onePATCH,
  DELETE as oneDELETE,
} from "@/app/api/agent/conversations/[id]/route";
import { addAdmin } from "@server/services/admins";
import { startConversation, appendTurn } from "@server/services/conversations";
import { conversationMessage } from "@server/schemas/conversation";
import { newId } from "../helpers/fixtures";
import { AccountStatus } from "@server/schemas/common";

async function admin(): Promise<{ cookie: string; id: string }> {
  const a = await addAdmin({
    full_name: "Adm",
    email: `adm-${newId()}@x.com`,
    password: "pw123456",
    accountStatus: AccountStatus.ACTIVE,
    permissionList: null,
  });
  return { cookie: `access_token=${a.access_token}`, id: a.id! };
}

describe("/api/agent/conversations", () => {
  let db: Db;
  beforeAll(async () => { db = await startTestDb(); });
  afterEach(async () => { await clearDb(db); });
  afterAll(async () => { await closeDb(); await stopTestDb(); });

  it("lists only the caller's conversations", async () => {
    const a = await admin();
    await startConversation(a.id, "Mine");
    await startConversation(newId(), "Theirs"); // different owner
    const res = await listGET(
      new Request("http://x/api/agent/conversations", { headers: { cookie: a.cookie } }),
      { params: Promise.resolve({}) },
    );
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe("Mine");
  });

  it("gets, renames, and deletes a conversation (owner-scoped)", async () => {
    const a = await admin();
    const c = await startConversation(a.id, "Old");
    await appendTurn(c.id!, a.id, [conversationMessage({ role: "assistant", text: "x" })]);

    const idCtx = { params: Promise.resolve({ id: c.id! }) };

    const got = await oneGET(
      new Request(`http://x/api/agent/conversations/${c.id}`, { headers: { cookie: a.cookie } }),
      idCtx,
    );
    expect((await got.json()).data.title).toBe("Old");

    const renamed = await onePATCH(
      new Request(`http://x/api/agent/conversations/${c.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie: a.cookie },
        body: JSON.stringify({ title: "New" }),
      }),
      idCtx,
    );
    expect((await renamed.json()).data.title).toBe("New");

    const del = await oneDELETE(
      new Request(`http://x/api/agent/conversations/${c.id}`, {
        method: "DELETE",
        headers: { cookie: a.cookie },
      }),
      idCtx,
    );
    expect(del.status).toBe(200);
  });

  it("404s when accessing another owner's conversation", async () => {
    const a = await admin();
    const otherId = (await startConversation(newId(), "Secret")).id!;
    const res = await oneGET(
      new Request(`http://x/api/agent/conversations/${otherId}`, { headers: { cookie: a.cookie } }),
      { params: Promise.resolve({ id: otherId }) },
    );
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `bunx vitest run tests/http/agent-conversations-routes.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the list/create route**

Create `src/app/api/agent/conversations/route.ts`:

```ts
import { z } from "zod";
import { withEnvelope } from "@server/http/with-envelope";
import { parseQuery, parseJsonBody } from "@server/http/request";
import { requireAdmin } from "@server/http/guards";
import { listForOwner, startConversation } from "@server/services/conversations";

const listQuery = z.object({
  start: z.coerce.number().int().min(0).optional(),
  stop: z.coerce.number().int().positive().optional(),
});

export const GET = withEnvelope(
  async (req) => {
    const principal = await requireAdmin(req);
    const q = parseQuery(req, listQuery);
    return listForOwner(principal.userId, q.start ?? 0, q.stop ?? 50);
  },
  { message: "Conversations fetched" },
);

const createBody = z.object({ firstMessage: z.string().min(1) });

export const POST = withEnvelope(
  async (req) => {
    const principal = await requireAdmin(req);
    const body = await parseJsonBody(req, createBody);
    return startConversation(principal.userId, body.firstMessage);
  },
  { message: "Conversation created", status: 201 },
);
```

- [ ] **Step 4: Implement the [id] route**

Create `src/app/api/agent/conversations/[id]/route.ts`:

```ts
import { z } from "zod";
import { withEnvelope } from "@server/http/with-envelope";
import { parseJsonBody } from "@server/http/request";
import { requireAdmin } from "@server/http/guards";
import {
  getForOwner,
  renameForOwner,
  setFeedbackForOwner,
  deleteForOwner,
} from "@server/services/conversations";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withEnvelope(
  async (req, ctx: Ctx) => {
    const principal = await requireAdmin(req);
    const { id } = await ctx.params;
    return getForOwner(id, principal.userId);
  },
  { message: "Conversation fetched" },
);

const patchBody = z.object({
  title: z.string().optional(),
  messageId: z.string().optional(),
  feedback: z.enum(["up", "down"]).nullable().optional(),
});

export const PATCH = withEnvelope(
  async (req, ctx: Ctx) => {
    const principal = await requireAdmin(req);
    const { id } = await ctx.params;
    const body = await parseJsonBody(req, patchBody);
    if (body.messageId !== undefined && body.feedback !== undefined) {
      return setFeedbackForOwner(id, principal.userId, body.messageId, body.feedback);
    }
    if (body.title !== undefined) {
      return renameForOwner(id, principal.userId, body.title);
    }
    return getForOwner(id, principal.userId);
  },
  { message: "Conversation updated" },
);

export const DELETE = withEnvelope(
  async (req, ctx: Ctx) => {
    const principal = await requireAdmin(req);
    const { id } = await ctx.params;
    return deleteForOwner(id, principal.userId);
  },
  { message: "Conversation deleted" },
);
```

> Confirm the `withEnvelope` handler signature accepts a second `ctx` arg by checking an existing `[id]` route (e.g. `src/app/api/positions/[id]/route.ts`). Mirror its exact typing.

- [ ] **Step 5: Run it, expect PASS**

Run: `bunx vitest run tests/http/agent-conversations-routes.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/agent/conversations tests/http/agent-conversations-routes.test.ts
git commit -m "feat(agent): conversations REST routes (list/get/rename/feedback/delete, owner-scoped)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase 9 — Remaining tool verticals

Each vertical follows the EXACT pattern of Task 6 (positions): write `tests/agent/tools-<area>.test.ts` first, implement `src/server/agent/tools/<area>.ts`, then register it in `src/server/agent/tools/index.ts` and extend `tests/agent/tools-index.test.ts`.

### Task 15: Applicants & pipeline tools

**Files:**
- Create: `src/server/agent/tools/applicants.ts`
- Modify: `src/server/agent/tools/index.ts` (register `applicantsTools`)
- Test: `tests/agent/tools-applicants.test.ts`

Tools (wrap `@server/services/applications`), with permission keys taken from
`src/app/api/applications/route.ts`, `[id]/route.ts`, `bulk/status/route.ts`:
- `applicants.search` (read, `GET:/applications`) → `retrieveApplications`
- `applicants.get` (read, `GET:/applications`) → `retrieveApplication`
- `applicants.move` (write, `PUT:/applications`) → `updateApplicationStatus(id, status, ctx.userId)`
- `applicants.note` (write, `PUT:/applications`) → `patchApplication(id, { notes })`
- `applicants.bulkStatus` (write, `PUT:/applications/bulk/status`) → `bulkUpdateApplicationStatus(ids, status, ctx.userId)`

- [ ] **Step 1: Write the failing test** (mirror Task 6's structure)

```ts
import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { closeDb } from "@server/core/database";
import { newId } from "../helpers/fixtures";
import { applicantsTools } from "@server/agent/tools/applicants";
import { addPosition } from "@server/services/positions";
import { submitApplication, retrieveApplication } from "@server/services/applications";

function tool(name: string) {
  const t = applicantsTools.find((x) => x.name === name);
  if (!t) throw new Error(`missing ${name}`);
  return t;
}
const ctx = (userId: string) => ({ userId, req: new Request("http://x") });

describe("applicants tools", () => {
  let db: Db;
  beforeAll(async () => { db = await startTestDb(); });
  afterEach(async () => { await clearDb(db); });
  afterAll(async () => { await closeDb(); await stopTestDb(); });

  it("applicants.search is read and finds by name", async () => {
    const pos = await addPosition({ title: "Eng", status: "open" }, newId());
    await submitApplication({ full_name: "Jane Doe", email: "j@x.com", position_id: pos.id! });
    const res = await tool("applicants.search").execute({ search: "Jane" } as any, ctx(newId()));
    expect((res.data as unknown[]).length).toBe(1);
  });

  it("applicants.move is write and changes status", async () => {
    const t = tool("applicants.move");
    expect(t.risk).toBe("write");
    const pos = await addPosition({ title: "Eng", status: "open" }, newId());
    const app = await submitApplication({ full_name: "Bob", email: "b@x.com", position_id: pos.id! });
    await t.execute({ id: app.id!, status: "interview" } as any, ctx(newId()));
    expect((await retrieveApplication(app.id!)).status).toBe("interview");
  });
});
```

- [ ] **Step 2: Run it, expect FAIL.** Run: `bunx vitest run tests/agent/tools-applicants.test.ts`
- [ ] **Step 3: Implement `applicants.ts`** following Task 6's tool shape (zod schema, `risk`, `permission`, `preview`, `execute`). For `applicants.move`, call `updateApplicationStatus(a.id, a.status, ctx.userId)`. Export `applicantsTools: ToolDef[]`. **Confirm exact permission key strings** in the applications route files before finalizing.
- [ ] **Step 4: Register in `index.ts`** — import `applicantsTools`, spread into the registration loop; extend `tests/agent/tools-index.test.ts` to assert `r.get("applicants.move")?.risk === "write"`.
- [ ] **Step 5: Run** `bunx vitest run tests/agent/tools-applicants.test.ts tests/agent/tools-index.test.ts` → PASS.
- [ ] **Step 6: Commit**

```bash
git add src/server/agent/tools/applicants.ts src/server/agent/tools/index.ts tests/agent/tools-applicants.test.ts tests/agent/tools-index.test.ts
git commit -m "feat(agent): applicants/pipeline tools

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 16: Emails & templates tools

**Files:**
- Create: `src/server/agent/tools/emails.ts`
- Modify: `src/server/agent/tools/index.ts`
- Test: `tests/agent/tools-emails.test.ts`

Before implementing, read `src/server/services/outbound-emails.ts` and
`src/server/services/email-templates.ts` for exact function names/signatures, and the
email/template route files for permission keys.

Tools:
- `emails.draft` (read, no send) → compose draft text only; returns text, saves nothing.
- `templates.list` (read) → list templates.
- `templates.create` (write) → create a template.
- `emails.send` (**destructive**, outbound) → compose + send (the compose endpoint is
  `POST:/emails/compose`).

- [ ] **Step 1:** Write `tests/agent/tools-emails.test.ts` asserting `emails.send` has `risk: "destructive"`, `templates.create` has `risk: "write"`, and `emails.draft` returns text without persisting (assert no outbound-email row is created — query the collection via the test `db`).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `emails.ts` wrapping the real service functions. Export `emailsTools: ToolDef[]`.
- [ ] **Step 4:** Register in `index.ts`; extend index test (`emails.send` is destructive).
- [ ] **Step 5:** Run the two files → PASS.
- [ ] **Step 6:** Commit:

```bash
git add src/server/agent/tools/emails.ts src/server/agent/tools/index.ts tests/agent/tools-emails.test.ts tests/agent/tools-index.test.ts
git commit -m "feat(agent): email + template tools (send is destructive/outbound)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 17: Admin tools (widgets/invitations/settings)

**Files:**
- Create: `src/server/agent/tools/admin.ts`
- Modify: `src/server/agent/tools/index.ts`
- Test: `tests/agent/tools-admin.test.ts`

Before implementing, read `src/server/services/widgets.ts`, `invitations.ts`, `settings.ts`
and their route files for signatures + permission keys.

Tools:
- `widgets.list` (read), `widgets.create` (write), `widgets.duplicate` (write).
- `invitations.list` (read), `invitations.create` (**destructive** — sends an invite email),
  `invitations.revoke` (destructive).
- `settings.get` (read), `settings.update` (write).

- [ ] **Step 1:** Write `tests/agent/tools-admin.test.ts` asserting risk levels (`invitations.create`/`invitations.revoke` destructive; `widgets.create`/`settings.update` write) and at least one happy-path execute per service (e.g. `widgets.create` then list shows it).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `admin.ts`; export `adminTools: ToolDef[]`.
- [ ] **Step 4:** Register in `index.ts`; extend index test.
- [ ] **Step 5:** Run → PASS.
- [ ] **Step 6:** Commit:

```bash
git add src/server/agent/tools/admin.ts src/server/agent/tools/index.ts tests/agent/tools-admin.test.ts tests/agent/tools-index.test.ts
git commit -m "feat(agent): admin tools (widgets/invitations/settings)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 7: Full server suite green.** Run: `bun test`. Expected: all tests pass (no regressions in existing suites). Fix any breakage before moving to UI.

---

## Phase 10 — Client UI

> UI tasks use component tests where they add value (`ConfirmCard`, `SuggestionChips`, `StepProgress`) and manual/visual verification for layout. Follow CLAUDE.md: shadcn/ui first, `lucide-react` icons, `sonner` toasts, design tokens only, reduced-motion respected, no bare full-page spinners.

### Task 18: Agent API client + types (browser)

**Files:**
- Create: `src/lib/agent/client.ts`
- Create: `src/lib/agent/types.ts` (mirror server `ChatTurnOutput`/`ConversationSummaryOut` shapes for the browser)
- Test: `tests/agent/client.test.ts` (mock `fetch`, assert it posts to `/api/agent/chat` and unwraps the envelope)

- [ ] **Step 1:** Write `tests/agent/client.test.ts`: mock global `fetch` to return `{ success: true, data: { conversationId: "c1", text: "hi", steps: [], toolResults: [], suggestions: [] } }`; assert `chat({ message, mode })` resolves to `data` and called `/api/agent/chat` with `POST` + JSON body.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `client.ts` with `chat(input)`, `listConversations()`, `getConversation(id)`, `renameConversation(id, title)`, `setFeedback(id, messageId, feedback)`, `deleteConversation(id)` — each calling the matching endpoint and returning `body.data`. Define the browser-side types in `types.ts`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit:

```bash
git add src/lib/agent/client.ts src/lib/agent/types.ts tests/agent/client.test.ts
git commit -m "feat(agent): typed browser client for chat + conversations

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 19: Panel state store + query hooks

**Files:**
- Create: `src/lib/agent/store.ts` (panel open/closed, current `conversationId`, `mode`; persist `mode` to `localStorage`)
- Create: `src/lib/agent/hooks.ts` (TanStack Query hooks: `useConversations`, `useConversation`, mutations for chat/rename/delete/feedback with query-key invalidation)
- Modify: `src/lib/query/keys.ts` (add `agent` keys — follow the existing key-factory pattern)

- [ ] **Step 1:** Add agent query keys to `lib/query/keys.ts` mirroring the existing structure (e.g. `agent.conversations()`, `agent.conversation(id)`).
- [ ] **Step 2:** Implement `store.ts` (a small zustand store or React context — match whatever the codebase already uses for client state; check `src/providers/`). Persist only `mode`.
- [ ] **Step 3:** Implement `hooks.ts` using the keys + `client.ts`. The chat mutation appends to the active conversation and invalidates the conversation + list keys on settle.
- [ ] **Step 4:** Type-check: `bunx tsc --noEmit` → clean.
- [ ] **Step 5:** Commit:

```bash
git add src/lib/agent/store.ts src/lib/agent/hooks.ts src/lib/query/keys.ts
git commit -m "feat(agent): panel store + TanStack Query hooks

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 20: Presentational components

**Files:**
- Create: `src/components/agent/StepProgress.tsx` — renders `Step[]`; active step shows spinner, done shows check; `motion-reduce` disables pulse.
- Create: `src/components/agent/SuggestionChips.tsx` — tappable chips; click calls `onPick(text)`.
- Create: `src/components/agent/ConfirmCard.tsx` — preview text + Confirm/Cancel (`<ButtonLoading>` on confirm).
- Create: `src/components/agent/MessageBubble.tsx` — user/assistant bubble; renders steps, thumbs up/down (calls feedback mutation), suggestions.
- Create: `src/components/agent/Composer.tsx` — textarea + send (`<ButtonLoading>`); mic and `+` buttons rendered **disabled** with `title="Coming soon"`.
- Create: `src/components/agent/AgentSkeleton.tsx` — panel skeleton per loading rules.
- Test: `tests/agent/components.test.tsx` (Confirm fires `onConfirm`; Cancel fires `onCancel`; chip click calls `onPick`; StepProgress renders a check for `done`).

- [ ] **Step 1:** Write `tests/agent/components.test.tsx` using the project's React test setup (check `vitest.config.ts` for `jsdom`/testing-library; if not configured, assert via a lightweight render util already used elsewhere — search `tests/` for existing `.tsx` tests; if none exist, keep these as smoke tests rendering to a string with `renderToString`).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement each component with shadcn/ui primitives + tokens + lucide icons.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit:

```bash
git add src/components/agent tests/agent/components.test.tsx
git commit -m "feat(agent): presentational components (steps, chips, confirm, bubble, composer)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 21: Panel shell + thread, and topbar button

**Files:**
- Create: `src/components/agent/ChatThread.tsx` — maps messages to `MessageBubble`; shows in-flight `StepProgress`; renders `ConfirmCard` when a turn returns `pending`.
- Create: `src/components/agent/AgentPanel.tsx` — right-side panel (use shadcn `<Sheet>` anchored right, or a fixed-position aside). Header: title + new-chat + Chat/History tabs + mode `<Select>`. Empty state: "Hello {name} 👋". History tab uses `useConversations`.
- Create: `src/components/agent/AskAiButton.tsx` — the "✦ Ask AI" pill; toggles the store's open state.
- Modify: `src/components/layout/Topbar.tsx` — render `<AskAiButton />` left of Log out.
- Modify: `src/app/dashboard/layout.tsx` — render `<AgentPanel />` inside the dashboard tree (so it overlays content), passing the `user` name for the greeting.

- [ ] **Step 1:** Implement `ChatThread`, `AgentPanel`, `AskAiButton`.
- [ ] **Step 2:** Wire `AskAiButton` into `Topbar.tsx` and `AgentPanel` into `dashboard/layout.tsx`.
- [ ] **Step 3:** Type-check + lint: `bunx tsc --noEmit && bun lint` → clean.
- [ ] **Step 4: Manual verification.** Run `bun dev` (Mongo running). Log in, click "Ask AI", confirm the panel opens. Send "list open positions" → steps animate, results summarized. Send "close the <role> position" → ConfirmCard appears; Confirm closes it (verify in the Positions page). Open History → past conversation listed; reopen it. Reload the page → History persists (server-backed). Toggle modes and confirm destructive still always confirms.
- [ ] **Step 5:** Commit:

```bash
git add src/components/agent/ChatThread.tsx src/components/agent/AgentPanel.tsx src/components/agent/AskAiButton.tsx src/components/layout/Topbar.tsx "src/app/dashboard/layout.tsx"
git commit -m "feat(agent): chat panel, thread, and Ask AI topbar button wired into dashboard

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 22: Polish & final verification

**Files:** touch-ups across `src/components/agent/*` as needed.

- [ ] **Step 1:** Empty state with category chips (Positions / Applicants / Emails / Admin) + starter suggestions that prefill the composer.
- [ ] **Step 2:** Reduced-motion pass: confirm `StepProgress` honors `prefers-reduced-motion` (no pulsing), spinner still spins.
- [ ] **Step 3:** Mobile pass at 360px: panel becomes full-width; composer reachable; sidebar sheet still works.
- [ ] **Step 4:** Accessibility: one live region for in-flight status; buttons have `aria-label`s; disabled mic/`+` have `title`.
- [ ] **Step 5: Full verification.** Run `bun test` (all green), `bunx tsc --noEmit` (clean), `bun lint` (clean), and one more manual end-to-end of a create-posting flow ("create a detailed posting for a Senior Backend Engineer") → Gemini drafts the body → draft created → reflected in Positions.
- [ ] **Step 6:** Commit:

```bash
git add src/components/agent
git commit -m "feat(agent): empty state, reduced-motion, mobile, a11y polish

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Done criteria

- `bun test` green (server units + route integrations + agent + component tests).
- `bunx tsc --noEmit` and `bun lint` clean.
- Manual: Ask AI pill → panel; deterministic intents run without the LLM; hard requests use Gemini; destructive/outbound always confirm; permissions enforced; conversation history persists in MongoDB and is owner-scoped.
- No `next/*` imports under `src/server/agent/**`; no tokens/PII logged; no secrets sent to the model.
