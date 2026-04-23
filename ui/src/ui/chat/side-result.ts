import { normalizeOptionalString } from "../string-coerce.ts";

export type ChatSideResult =
  | {
      kind: "btw";
      runId: string;
      sessionKey: string;
      question: string;
      text: string;
      isError: boolean;
      ts: number;
    }
  | {
      kind: "compaction";
      runId: string;
      sessionKey: string;
      text: string;
      ts: number;
    }
  | {
      kind: "restart";
      runId: string;
      sessionKey: string;
      text: string;
      ts: number;
    };

export function parseChatSideResult(payload: unknown): ChatSideResult | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const candidate = payload as Record<string, unknown>;
  const kind = candidate.kind;

  if (kind === "btw") {
    const runId = normalizeOptionalString(candidate.runId);
    const sessionKey = normalizeOptionalString(candidate.sessionKey);
    const question = normalizeOptionalString(candidate.question);
    const text = normalizeOptionalString(candidate.text);
    if (!(runId && sessionKey && question && text)) {
      return null;
    }
    return {
      kind: "btw",
      runId,
      sessionKey,
      question,
      text,
      isError: candidate.isError === true,
      ts:
        typeof candidate.ts === "number" && Number.isFinite(candidate.ts)
          ? candidate.ts
          : Date.now(),
    };
  }

  if (kind === "compaction") {
    const runId = normalizeOptionalString(candidate.runId);
    const sessionKey = normalizeOptionalString(candidate.sessionKey);
    const text = normalizeOptionalString(candidate.text);
    if (!(runId && sessionKey && text)) {
      return null;
    }
    return {
      kind: "compaction",
      runId,
      sessionKey,
      text,
      ts:
        typeof candidate.ts === "number" && Number.isFinite(candidate.ts)
          ? candidate.ts
          : Date.now(),
    };
  }

  if (kind === "restart") {
    const runId = normalizeOptionalString(candidate.runId);
    const sessionKey = normalizeOptionalString(candidate.sessionKey);
    const text = normalizeOptionalString(candidate.text);
    if (!(runId && sessionKey && text)) {
      return null;
    }
    return {
      kind: "restart",
      runId,
      sessionKey,
      text,
      ts:
        typeof candidate.ts === "number" && Number.isFinite(candidate.ts)
          ? candidate.ts
          : Date.now(),
    };
  }

  return null;
}
