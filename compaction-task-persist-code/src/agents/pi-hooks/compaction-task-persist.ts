/**
 * Task State Persistence for Compaction
 * 
 * Extracts and persists pending tasks, cron jobs, and dreaming states
 * before compaction to ensure task continuity.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("compaction-task-persist");

/**
 * Extracted task information from session messages
 */
export type ExtractedTask = {
  type: "cron" | "dreaming" | "todo" | "decision";
  description: string;
  schedule?: string;
  nextRun?: string;
  state?: string;
  timestamp?: string;
};

/**
 * Extract pending tasks from session messages
 * 
 * Scans messages for:
 * - Cron job creation/modification
 * - Dreaming phase states
 * - TODO items
 * - Key decisions
 */
export function extractTasksFromMessages(messages: AgentMessage[]): ExtractedTask[] {
  const tasks: ExtractedTask[] = [];
  const now = new Date().toISOString();

  for (const msg of messages) {
    if (!msg || typeof msg !== "object" || typeof msg.content !== "string") {
      continue;
    }

    const content = msg.content;
    const role = msg.role;

    // Extract cron job information
    const cronPatterns = [
      /(?:created|scheduled|added).*cron.*?:\s*(.+)/i,
      /cron.*?(?:every|daily|weekly|monthly|at|on)\s*([^.\n]+)/i,
      /(?:schedule|reminder).*(?:every|at|on)\s*([^.\n]+)/i,
      /next.*run.*?:\s*([^\n]+)/i,
      /cron.*?id.*?:\s*([^\n]+)/i,
    ];

    for (const pattern of cronPatterns) {
      const match = content.match(pattern);
      if (match) {
        tasks.push({
          type: "cron",
          description: content.trim().slice(0, 200),
          schedule: match[1]?.trim(),
          timestamp: now,
        });
        break;
      }
    }

    // Extract dreaming state
    const dreamingPatterns = [
      /dreaming.*?(?:phase|state).*?:\s*(deep|light|rem)/i,
      /(?:deep|light|rem).*dreaming/i,
      /dreaming.*?session.*?:\s*([^\n]+)/i,
    ];

    for (const pattern of dreamingPatterns) {
      const match = content.match(pattern);
      if (match) {
        tasks.push({
          type: "dreaming",
          description: content.trim().slice(0, 200),
          state: match[1]?.trim(),
          timestamp: now,
        });
        break;
      }
    }

    // Extract TODO items
    const todoPatterns = [
      /(?:todo|task|action item).*?:\s*(.+)/i,
      /need to\s+(.+)/i,
      /must\s+(.+)/i,
    ];

    for (const pattern of todoPatterns) {
      const match = content.match(pattern);
      if (match && !content.includes("completed")) {
        tasks.push({
          type: "todo",
          description: match[1]?.trim().slice(0, 200) || content.trim().slice(0, 200),
          timestamp: now,
        });
        break;
      }
    }
  }

  // Deduplicate tasks
  const seen = new Set<string>();
  return tasks.filter((task) => {
    const key = `${task.type}:${task.description.slice(0, 50)}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Format extracted tasks as markdown for memory file
 */
export function formatTasksForMemory(tasks: ExtractedTask[]): string {
  if (tasks.length === 0) {
    return "";
  }

  const sections: { type: string; tasks: ExtractedTask[] }[] = [];

  // Group by type
  for (const task of tasks) {
    let section = sections.find((s) => s.type === task.type);
    if (!section) {
      section = { type: task.type, tasks: [] };
      sections.push(section);
    }
    section.tasks.push(task);
  }

  // Format as markdown
  const lines: string[] = [];
  lines.push("## ⏰ Auto-Saved Tasks (Before Compaction)");
  lines.push("");
  lines.push(`_Auto-saved at ${new Date().toISOString()}_`);
  lines.push("");

  for (const section of sections) {
    const typeLabel = {
      cron: "### Scheduled Tasks",
      dreaming: "### Dreaming State",
      todo: "### Open Action Items",
      decision: "### Key Decisions",
    }[section.type];

    lines.push(typeLabel);
    lines.push("");

    for (const task of section.tasks) {
      let line = `- ${task.description}`;
      if (task.schedule) {
        line += ` (Schedule: ${task.schedule})`;
      }
      if (task.nextRun) {
        line += ` (Next: ${task.nextRun})`;
      }
      if (task.state) {
        line += ` (State: ${task.state})`;
      }
      lines.push(line);
    }

    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Persist tasks to memory file
 */
export async function persistTasksToMemory(
  tasks: ExtractedTask[],
  options?: {
    memoryDir?: string;
    date?: string;
  },
): Promise<string | null> {
  if (tasks.length === 0) {
    log.info("No tasks to persist");
    return null;
  }

  const memoryDir = options?.memoryDir ?? path.join(process.env.HOME || "~", ".openclaw/workspace/memory");
  const date = options?.date ?? new Date().toISOString().split("T")[0];
  const memoryPath = path.join(memoryDir, `${date}.md`);

  try {
    // Ensure memory directory exists
    await fs.mkdir(memoryDir, { recursive: true });

    // Check if file exists
    let existingContent = "";
    try {
      existingContent = await fs.readFile(memoryPath, "utf-8");
    } catch {
      // File doesn't exist, will create new
    }

    // Check if we already saved tasks in this compaction cycle
    const autoSaveMarker = "## ⏰ Auto-Saved Tasks (Before Compaction)";
    if (existingContent.includes(autoSaveMarker)) {
      log.info("Tasks already saved in this compaction cycle");
      return memoryPath;
    }

    // Format and append tasks
    const taskContent = formatTasksForMemory(tasks);
    const newContent = existingContent.trim() + "\n\n" + taskContent.trim();

    await fs.writeFile(memoryPath, newContent, "utf-8");
    log.info(`Persisted ${tasks.length} tasks to ${memoryPath}`);

    return memoryPath;
  } catch (error) {
    log.error(
      `Failed to persist tasks: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

/**
 * Main entry point: extract and persist tasks before compaction
 */
export async function extractAndPersistTaskState(
  messages: AgentMessage[],
  sessionKey: string,
  options?: {
    memoryDir?: string;
    date?: string;
  },
): Promise<{
  success: boolean;
  taskCount: number;
  memoryPath?: string | null;
}> {
  log.info(`Extracting tasks from session ${sessionKey}`);

  const tasks = extractTasksFromMessages(messages);
  log.info(`Extracted ${tasks.length} tasks`);

  if (tasks.length === 0) {
    return {
      success: true,
      taskCount: 0,
    };
  }

  const memoryPath = await persistTasksToMemory(tasks, options);

  return {
    success: memoryPath !== null,
    taskCount: tasks.length,
    memoryPath,
  };
}

// Export for testing
export const __testing = {
  extractTasksFromMessages,
  formatTasksForMemory,
  persistTasksToMemory,
};
