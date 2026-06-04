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

export type PermissionCheck = (req: Request, permissionKey: string) => Promise<unknown>;

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
  if (risk === "destructive") return true;
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

  const parsed = tool.schema.safeParse(call.args);
  if (!parsed.success) {
    return { text: `I need more detail to ${tool.name.replace(".", " ")}.` };
  }

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
  if (input.confirmToken) {
    const v = verifyConfirmToken(input.confirmToken, deps.secret, ctx.userId);
    if (!v.ok) {
      return emptyTurn(input.conversationId, "That confirmation expired — please ask again.");
    }
    const tool = deps.registry.get(v.payload.tool);
    if (!tool) return emptyTurn(input.conversationId, "That action is no longer available.");
    await deps.checkPermission(ctx.req, tool.permission);
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
        if (pending) break;
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
