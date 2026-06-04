# AI Assistant ("Ask AI") Agent — Design

**Date:** 2026-06-04
**Status:** Approved (architecture). Pending spec review.
**Author:** brainstorming session

## 1. Goal

Add an in-app AI assistant ("Ask AI") that lets users accomplish work by chatting
instead of clicking through forms. The agent calls real app actions on the user's
behalf — creating detailed job postings, moving applicants through the pipeline,
drafting and sending emails, managing widgets/invitations/settings — so that tasks
that feel too manual are handled conversationally.

The UX target is the Hostinger "Kodee" assistant (reference screenshots provided):
an **"Ask AI" pill in the topbar** that opens a **right-side chat panel** with a
Chat / History tab, suggestion chips, a step-by-step "thinking" progress display
("Analyzing your request → Identifying key details → Finding relevant information →
Generating the response"), per-message thumbs up/down feedback, and tappable
**suggested follow-up messages**.

## 2. Non-goals (v1)

- No voice input (the mic button is shown disabled / "coming soon" — out of scope).
- No file attachments (the "+" button is shown disabled — out of scope).
- No embeddings/classifier NLU — the deterministic layer is a **lean intent router**
  (keyword + regex + fuzzy match). Embeddings can come later.
- No streaming token-by-token output in v1 (we stream **discrete steps**, not tokens;
  see §6). Token streaming can be added later behind the same step protocol.
- No real-time multi-tab sync of an *open* conversation (history is server-persisted —
  see §5a — but a second open tab won't live-update mid-turn; it sees new messages on
  reopen/refetch).

## 3. Core principles

1. **Reuse the service layer.** Every agent tool is a *thin wrapper* over an existing
   `src/server/services/*` function. No business logic is reimplemented in the agent.
2. **The agent can do exactly what the user can — no more.** Every tool declares the
   permission key(s) it needs (e.g. `"POST:/positions"`). The orchestrator enforces
   them via the existing `checkAdminAccountStatusAndPermissions(req, key)` **before**
   executing. A user who can't do X manually cannot get the agent to do X.
3. **Deterministic-first, LLM-fallback.** The lean intent router handles common,
   well-shaped requests with zero LLM calls. Only requests it can't confidently parse
   fall through to Gemini 2.0 Flash (free tier) with the tool schemas.
4. **Central confirmation enforcement.** Destructive/outbound actions are *never*
   executed on the first pass, regardless of autonomy mode. The orchestrator returns a
   `needs_confirmation` step; the client renders a confirm card; only an explicit
   confirm round-trip executes the action.
5. **Layering compliance (per CLAUDE.md).** Everything under `src/server/agent/` is
   framework-agnostic (no `next/*`) and unit-testable under Vitest. Only the route
   handler in `app/api/agent/chat/` is Next-aware.

## 4. Autonomy modes

A per-user setting (stored in localStorage in v1, surfaced in the panel header) with
three modes:

| Mode | read tools | write tools | destructive / outbound tools |
|---|---|---|---|
| **Confirm everything** | auto | confirm | confirm |
| **Smart** (default) | auto | auto | **confirm (always)** |
| **Auto-run** | auto | auto | **confirm (always)** |

**Invariant:** destructive/outbound is *always* confirmed. The mode only changes
whether plain `write` actions are auto-run or confirmed. ("Auto-run" and "Smart"
differ only if we later add a `write` tier the user wants to gate — kept distinct so
the contract is future-proof; in v1 they behave the same for writes and differ only in
intent/labeling. This is intentional and documented so it isn't "fixed" later.)

Each tool's `risk` is one of:
- `read` — no mutation (list/get/search/summarize/draft-without-saving).
- `write` — reversible create/update (create position as *draft*, add note, update fields).
- `destructive` — irreversible or outbound: **send email**, delete, close position,
  refund/charge payment, revoke invitation, ban IP.

## 5. Architecture

```
src/server/agent/
  orchestrator.ts        # runTurn(): router → (tools | gemini) → confirm gate → reply
  intent-router/
    index.ts             # match(message) -> { intent, slots, confidence } | null
    patterns.ts          # curated intent definitions (regex/keyword + slot extractors)
    fuzzy.ts             # small fuzzy matcher (fuse.js) for entity resolution
  tools/
    registry.ts          # ToolRegistry: name -> ToolDef; toGeminiDeclarations()
    positions.ts         # positions.create/update/close/list/get  (wraps services/positions)
    applicants.ts        # applicants.search/get/move/note/bulkStatus (wraps services/applications)
    emails.ts            # emails.draft/compose/send, templates.create/list
    admin.ts             # widgets.*, invitations.*, settings.*
    types.ts             # ToolDef, ToolContext, Risk, ToolResult
  llm/
    gemini.ts            # callGemini(messages, declarations) -> text | toolCalls[]
    prompt.ts            # system prompt + tool-result formatting
  confirm/
    tokens.ts            # sign/verify a confirmation token (HMAC w/ secretKey)
  types.ts               # ChatTurnInput, ChatTurnOutput, Step, Suggestion, Pending...

  conversations/
    repository.ts        # Mongo data access for the `conversations` collection
    service.ts           # createConversation/appendMessages/listForUser/get/rename/delete
  schemas/
    conversation.ts      # zod ConversationDoc/Out + message shape + normalizers

src/app/api/agent/chat/route.ts            # thin controller: requireUser + withEnvelope -> runTurn
src/app/api/agent/conversations/route.ts   # GET list (History tab), POST new
src/app/api/agent/conversations/[id]/route.ts  # GET one, PATCH rename, DELETE

src/components/agent/
  AskAiButton.tsx        # the topbar pill that opens the panel
  AgentPanel.tsx         # right-side sheet shell; Chat/History tabs; mode selector
  ChatThread.tsx         # message list
  MessageBubble.tsx      # user/assistant bubble; renders steps, feedback, suggestions
  StepProgress.tsx       # the "Analyzing… → Generating…" step display
  ConfirmCard.tsx        # preview + Confirm/Cancel for pending actions
  SuggestionChips.tsx    # tappable suggested follow-ups
  Composer.tsx           # textarea + send; disabled mic/+ buttons
  AgentSkeleton.tsx      # loading skeleton for the panel (per loading rules)
src/lib/agent/
  client.ts              # typed wrappers: chat() + conversations CRUD
  store.ts               # zustand/context: open state, mode, current conversation id
  hooks.ts               # TanStack Query hooks for conversations list/detail
```

## 5a. Conversation persistence (server-side, v1)

Chat history is stored in MongoDB, not the browser. This syncs across devices,
survives cache clears, and gives an audit trail of agent actions per user.

**Collection:** `conversations` (added to `COLLECTIONS` in `core/database.ts`).

**`ConversationDoc` (schema/conversation.ts, mirrors the existing schema pattern):**
```
{
  _id, owner_id,                       // the admin/user who owns it (scopes all queries)
  title,                              // auto-derived from first user message; renamable
  messages: [
    {
      id, role,                       // "user" | "assistant"
      text,
      steps?,                         // the plan steps shown (assistant only)
      tool_results?,                  // [{ tool, status, summary }] — what ran (audit)
      suggestions?,                   // suggested follow-ups offered
      feedback?,                      // "up" | "down" | null (thumbs)
      created_at
    }
  ],
  status,                            // "open" | "closed"
  created_at, last_updated
}
```
A `ConversationOut` normalizer maps `_id`→`id` and strips internal fields, exactly like
`positionOut`. All repository queries are **scoped by `owner_id`** so a user can only
ever read/modify their own conversations (enforced again at the service layer from the
authenticated principal — never trust an `owner_id` from the client).

**Service** (`agent/conversations/service.ts`): `createConversation(ownerId, firstMsg)`,
`appendMessages(id, ownerId, msgs)`, `listForUser(ownerId, start, stop)` (returns
lightweight summaries: id, title, last_updated, status — not full message arrays),
`getForUser(id, ownerId)`, `rename(id, ownerId, title)`, `setFeedback(id, ownerId,
messageId, value)`, `deleteForUser(id, ownerId)`.

**Persistence in the turn:** `runTurn` receives an optional `conversationId`. If absent,
it creates a conversation (title from the first message) and returns the new id. After
producing the reply it appends both the user message and the assistant message
(including `tool_results` for audit). A **pending-confirmation** turn persists the
assistant message with the pending action recorded; the later confirm turn appends the
execution result to the same conversation.

**Endpoints:**
- `GET /api/agent/conversations?start&stop` → History tab list (summaries).
- `POST /api/agent/conversations` → start an empty conversation (optional; chat can
  auto-create).
- `GET /api/agent/conversations/[id]` → full thread (owner-scoped).
- `PATCH /api/agent/conversations/[id]` → rename.
- `DELETE /api/agent/conversations/[id]` → delete.
- Thumbs feedback: `PATCH /api/agent/conversations/[id]` with `{ messageId, feedback }`.

All endpoints are `requireUser` + `withEnvelope` and owner-scoped.

### Turn flow

```
runTurn(message, history, mode, req):
  1. router = intentRouter.match(message)
  2. plan:
       if router && router.confidence >= THRESHOLD:
            toolCalls = [buildToolCall(router.intent, router.slots)]
            steps = ["Analyzing your request", "Identifying key details"]
       else:
            steps = ["Analyzing your request", "Identifying key details",
                     "Finding relevant information"]
            { text, toolCalls } = gemini.call(history+message, registry.toGeminiDeclarations())
  3. for each toolCall:
       tool = registry.get(toolCall.name)
       await checkAdminAccountStatusAndPermissions(req, tool.permission)  // AUTH GATE
       if tool.risk == destructive OR (tool.risk == write && mode == "confirm everything"):
            pending = { token: sign(toolCall), preview: tool.preview(args) }
            return reply(text, steps, suggestions, pending)   // do NOT execute
       else:
            result = await tool.execute(args, { userId, req })
  4. compose final text (+ optionally a second Gemini pass to narrate results)
  5. suggestions = deriveSuggestions(intent/result)
  6. persist: ensure conversation (create if no conversationId), append user +
     assistant messages (with tool_results for audit)
  7. return { conversationId, text, steps, toolResults, suggestions, pending? }
```

### Confirm round-trip

The client, on Confirm, re-POSTs to `/api/agent/chat` with `{ confirmToken }`.
The route verifies the HMAC token (binds tool name + args + userId, short TTL),
re-runs the **auth gate**, executes the tool, and returns the result. Cancel just
drops the token client-side.

## 6. Step streaming protocol

v1 does **not** stream LLM tokens. Instead the response is a normal JSON envelope
whose `data.steps` is an ordered list of `{ label, status }`. To get the *animated*
"Analyzing → … → Generating" effect like the screenshots without true streaming, the
client plays the returned steps with short timed transitions as the request is
in-flight, then snaps to the final reply when the response lands. This is honest
(steps reflect the real plan: router-only turns show fewer steps than Gemini turns)
and cheap. A later upgrade to SSE/streaming can replace the timed playback with real
server-pushed step events behind the same `Step` type.

## 7. Tool registry (v1 surface)

Wrappers over existing services. `permission` is the existing backend permission key.

**Positions** (`services/positions.ts`)
- `positions.list` (read, `GET:/positions`) → `retrievePositions`
- `positions.get` (read, `GET:/positions`) → `retrievePositionById`
- `positions.create` (write, `POST:/positions`) → `addPosition` — **LLM drafts full
  posting** (title, department, description, requirements, etc.) from a short brief;
  created as a **draft** (reversible) so `write`, not `destructive`.
- `positions.update` (write, `PUT:/positions`) → `updatePositionById`
- `positions.close` (destructive, `PUT:/positions`) → `closePosition` (cascades)

**Applicants & pipeline** (`services/applications.ts`)
- `applicants.search` (read) → list with filters
- `applicants.get` (read) → single applicant
- `applicants.move` (write) → change pipeline status
- `applicants.note` (write) → add note
- `applicants.bulkStatus` (write) → bulk status update

**Emails & templates** (`services/outbound-emails.ts`, `services/email-templates.ts`)
- `emails.draft` (read) → compose draft text only, nothing saved/sent
- `templates.create` (write) → create email template
- `templates.list` (read)
- `emails.send` (**destructive/outbound**) → compose + send

**Admin** (`services/widgets.ts`, `invitations.ts`, `settings.ts`)
- `widgets.create` (write), `widgets.duplicate` (write), `widgets.list` (read)
- `invitations.create` (write — sends invite email → treat as **destructive/outbound**),
  `invitations.revoke` (destructive), `invitations.list` (read)
- `settings.get` (read), `settings.update` (write)

Exact permission keys are taken from the corresponding route handlers during
implementation (each route already declares its key in
`checkAdminAccountStatusAndPermissions`).

## 8. Intent router (lean, v1)

`patterns.ts` holds a curated list of intents, each:
`{ id, examples[], match(message) -> slots | null, toolCall(slots), confidence }`.

Coverage target for v1 (high-frequency phrasings):
- "close the <X> position" → `positions.close`
- "show/list applicants [for <position>] [in <stage>]" → `applicants.search`
- "move <name> to <stage>" → `applicants.move`
- "create a job posting for <title>" → `positions.create` (LLM fills the body even on
  router match — the router resolves *intent + title*, then delegates body-drafting to
  Gemini; this is the one place a router match still uses the LLM, for content only).
- "list open positions" → `positions.list`

Fuzzy matching (`fuse.js`) resolves entity references (position title, applicant name,
stage name) against current data so "move jane to interview" maps to the right ids.
Below `THRESHOLD` confidence → fall through to Gemini. The router is a pure function
(message + a small data context) → unit-testable with no network.

## 9. LLM integration (Gemini 2.0 Flash, free tier)

- `GEMINI_API_KEY` added to `Settings` (`core/settings.ts`) and `.env.local`.
- `llm/gemini.ts` calls the Generative Language API `generateContent` with
  `tools: [{ functionDeclarations }]` derived from the registry (zod → Gemini schema).
- Two-pass when tools run: (1) model picks tool(s) + args; (2) after execution, model
  narrates the result into a friendly reply. Both passes are cheap Flash calls.
- Graceful degradation: if the key is missing or the API errors/rate-limits, the agent
  still serves router-matched intents and returns a clear "I can't reason about that
  right now" message for fall-through requests (no crash).

## 10. Security & safety

- **Auth gate before every tool execution** (and again on confirm), via the existing
  permission helper — agent ≤ user's own permissions.
- **Confirmation token** is HMAC-signed (`secretKey`), binds `{ tool, args, userId }`,
  short TTL; prevents a client from executing an action it wasn't offered.
- **No secrets to the model.** The system prompt and tool schemas never include API
  keys, tokens, or PII beyond what the user already sees. Tool *results* passed back to
  Gemini for narration are scrubbed of sensitive fields.
- **Rate limiting** reuses the existing role rate-limit mechanism on `/api/agent/chat`.
- **No token/PII logging** (per CLAUDE.md §11).
- **Prompt-injection awareness:** tool args proposed by the LLM are re-validated against
  each tool's zod schema before execution; the LLM cannot invent a tool or bypass the
  risk gate (risk is server-side metadata, not model-supplied).

## 11. UI details (matching the reference)

- **Topbar:** an `AskAiButton` pill ("✦ Ask AI") added to `Topbar.tsx`, left of Log out.
- **Panel:** right-side `<Sheet>`-style panel (this is an *assistant surface*, not a
  primary CRUD flow, so the no-modal rule in §2 of CLAUDE.md doesn't apply — documented
  exception). Header: title, sparkle/new-chat/expand icons, Chat/History tabs, and an
  autonomy-mode selector.
- **Empty state:** "Hello <name> 👋 How can I help you today?" + category chips
  (Positions / Applicants / Emails / Admin) + a few starter suggestions.
- **Assistant message:** bubble + `StepProgress` (collapses to checkmarks when done) +
  thumbs up/down + `SuggestionChips`.
- **Confirm card:** preview of the pending action with Confirm / Cancel.
- **Composer:** textarea, send button; mic and "+" rendered **disabled** (v1 non-goals).
- **History tab:** server-backed list of the user's past conversations (TanStack Query
  over `GET /api/agent/conversations`), click to reopen the full thread; rename/delete
  available. Optimistic thumbs up/down persisted via PATCH.
- **Loading/feedback:** follows CLAUDE.md §3 — `AgentSkeleton` for cold panel load,
  `<ButtonLoading>` semantics on send, reduced-motion respected on step animation, one
  live region for the in-flight status.

## 12. Data flow summary

```
Composer.send(text)
  → lib/agent/client.chat({ conversationId?, message, mode })
  → POST /api/agent/chat  (requireUser, withEnvelope)
  → orchestrator.runTurn(...)  → persists messages to `conversations`
  → { conversationId, text, steps, toolResults, suggestions, pending? }
  → ChatThread renders; if pending → ConfirmCard
  → on Confirm: client.chat({ conversationId, confirmToken }) → executes → appended
  → History tab reads server conversations via TanStack Query (no localStorage)
```
History context sent to the LLM is loaded **server-side** from the conversation by id
(the client sends `conversationId`, not the full transcript), so the browser can't
tamper with prior turns and the payload stays small.

## 13. Error handling

- Tool execution errors surface as a friendly assistant message + a sonner toast; the
  raw error is never shown. Envelope error codes from services map to readable text.
- LLM errors / rate limits → graceful message (see §9), router intents still work.
- Permission denied → "You don't have permission to do that" (no leak of what exists).
- Confirm token expired/invalid → ask the user to re-issue the request.

## 14. Testing

- **Intent router:** pure unit tests over a phrase corpus (Vitest), no network.
- **Tool registry:** each tool unit-tested against in-memory Mongo (existing harness),
  asserting it calls the right service and respects `risk`.
- **Orchestrator:** unit tests for the confirm gate (destructive never auto-executes;
  mode matrix), auth gate (permission denied blocks execution), and token round-trip.
- **Gemini layer:** mocked; assert declaration generation from registry and tool-call
  parsing. No real API calls in tests.
- **Conversation service/repo:** owner-scoping (user A cannot read/rename/delete user
  B's conversation), append on each turn, list returns summaries not full threads,
  feedback PATCH — against in-memory Mongo.
- **Route integration:** `/api/agent/chat` happy path + confirm round-trip + auth
  failure; `/api/agent/conversations*` list/get/rename/delete with owner-scoping — via
  the existing route integration harness.
- **UI:** component tests for ConfirmCard (Confirm executes, Cancel drops),
  SuggestionChips (click sends), StepProgress (reduced-motion).

## 15. Build order (informs the plan)

1. `agent/types.ts` + `tools/types.ts` + `tools/registry.ts` (contracts first).
2. **Conversation persistence:** `conversations` collection, `schemas/conversation.ts`,
   repository + service (owner-scoped) + tests (in-memory Mongo).
3. Tool wrappers for **Positions** + registry wiring + tests (reference vertical).
4. Intent router (positions intents) + tests.
5. Orchestrator with confirm + auth gates + persistence + tests (no LLM yet — router-only).
6. `/api/agent/chat` + `/api/agent/conversations*` routes + integration tests
   (router-only end to end, incl. history list/get/rename/delete + owner-scoping).
7. Gemini layer (`settings` key, `gemini.ts`, two-pass) + mocked tests; wire fallback.
8. Remaining tool verticals: Applicants, Emails/templates, Admin (+ tests each).
9. UI: panel shell + topbar button → thread → steps → confirm → suggestions →
   History tab (server-backed) → thumbs feedback.
10. Polish: skeletons, reduced-motion, mode selector, empty state, disabled mic/+.

Each step is independently testable and leaves the app working.

## 16. Open decisions deferred to later (not v1)

- Token streaming via SSE.
- Real-time multi-tab live sync of an open conversation.
- Voice input and file attachments.
- Embeddings-based NLU.
- "Auto-run" vs "Smart" divergence for a future granular `write` gate.
