/**
 * Context analyzer for debugging context usage before compaction.
 */

import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { createSubsystemLogger } from "../../../logging/subsystem.js";

const log = createSubsystemLogger("context-analyzer");

export function analyzeAndLogContext(params: {
  messages: AgentMessage[];
  prePromptMessageCount: number;
  systemPrompt?: string;
  sessionId?: string;
}): void {
  const { messages, prePromptMessageCount, systemPrompt, sessionId } = params;
  
  // Count messages by role
  const counts = { user: 0, assistant: 0, tool: 0, system: 0 };
  const charCounts = { user: 0, assistant: 0, tool: 0, system: 0 };
  
  let totalChars = 0;
  let toolCallCount = 0;
  let memoryRefCount = 0;
  let agentsMdRefCount = 0;
  
  for (let i = prePromptMessageCount; i < messages.length; i++) {
    const msg = messages[i];
    const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content ?? "");
    const charCount = content.length;
    
    counts[msg.role as keyof typeof counts]++;
    charCounts[msg.role as keyof typeof charCounts] += charCount;
    totalChars += charCount;
    
    // Count special content
    if (msg.role === "tool") {
      if (content.includes("memory_get") || content.includes("MEMORY.md")) memoryRefCount++;
      if (content.includes("AGENTS.md") || content.includes("USER.md") || content.includes("SOUL.md")) agentsMdRefCount++;
    }
    if (msg.role === "assistant" && content.includes("tool_call")) toolCallCount++;
  }
  
  const systemPromptChars = systemPrompt?.length ?? 0;
  const estimatedTokens = Math.round(totalChars / 4);
  const recentTurns = Math.min(counts.user, counts.assistant);
  const oldestMsg = messages[prePromptMessageCount];
  const oldestAge = oldestMsg?.timestamp ? Math.round((Date.now() - oldestMsg.timestamp) / 60000) : 0;
  
  log.warn(
    `[Context Analysis${sessionId ? ` ${sessionId}` : ""}] ` +
    `Messages: ${messages.length - prePromptMessageCount} (U:${counts.user}/A:${counts.assistant}/T:${counts.tool}) | ` +
    `Chars: ${totalChars.toLocaleString()} (est. ${estimatedTokens.toLocaleString()} tokens) | ` +
    `Turns: ${recentTurns} | ` +
    `Oldest: ${oldestAge}min ago | ` +
    `Tool calls: ${toolCallCount} | ` +
    `Memory refs: ${memoryRefCount} | ` +
    `Agents.md refs: ${agentsMdRefCount} | ` +
    `System prompt: ${systemPromptChars.toLocaleString()} chars`
  );
  
  // Detailed breakdown
  log.debug(`  User: ${counts.user} msgs, ${charCounts.user.toLocaleString()} chars`);
  log.debug(`  Assistant: ${counts.assistant} msgs, ${charCounts.assistant.toLocaleString()} chars`);
  log.debug(`  Tool: ${counts.tool} msgs, ${charCounts.tool.toLocaleString()} chars`);
}
