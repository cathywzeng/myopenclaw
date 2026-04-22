import { describe, it, expect } from "vitest";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import {
  extractTasksFromMessages,
  formatTasksForMemory,
  __testing,
} from "./compaction-task-persist.js";

const { extractTasksFromMessages: extract, formatTasksForMemory: format } = __testing;

describe("compaction-task-persist", () => {
  describe("extractTasksFromMessages", () => {
    it("should extract cron job information", () => {
      const messages: AgentMessage[] = [
        {
          role: "user",
          content: "Create a cron job to run every 30 minutes",
        },
        {
          role: "assistant",
          content: "Created cron job: dreaming-cron scheduled every 30min",
        },
      ];

      const tasks = extractTasksFromMessages(messages);
      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks.some((t) => t.type === "cron")).toBe(true);
    });

    it("should extract dreaming state", () => {
      const messages: AgentMessage[] = [
        {
          role: "assistant",
          content: "Current dreaming phase: deep dreaming session started",
        },
      ];

      const tasks = extractTasksFromMessages(messages);
      expect(tasks.some((t) => t.type === "dreaming")).toBe(true);
    });

    it("should extract TODO items", () => {
      const messages: AgentMessage[] = [
        {
          role: "user",
          content: "TODO: Check the cron status tomorrow",
        },
      ];

      const tasks = extractTasksFromMessages(messages);
      expect(tasks.some((t) => t.type === "todo")).toBe(true);
    });

    it("should deduplicate tasks", () => {
      const messages: AgentMessage[] = [
        {
          role: "assistant",
          content: "Created cron job: dreaming-cron scheduled every 30min",
        },
        {
          role: "assistant",
          content: "Created cron job: dreaming-cron scheduled every 30min",
        },
      ];

      const tasks = extractTasksFromMessages(messages);
      expect(tasks.length).toBe(1);
    });

    it("should handle empty messages", () => {
      const tasks = extractTasksFromMessages([]);
      expect(tasks.length).toBe(0);
    });

    it("should handle messages without content", () => {
      const messages: AgentMessage[] = [
        { role: "user", content: "" },
        { role: "assistant" },
      ] as any;

      const tasks = extractTasksFromMessages(messages);
      expect(tasks.length).toBe(0);
    });
  });

  describe("formatTasksForMemory", () => {
    it("should format tasks as markdown", () => {
      const tasks = [
        {
          type: "cron" as const,
          description: "Dreaming cron job",
          schedule: "every 30min",
        },
        {
          type: "dreaming" as const,
          description: "Dreaming session",
          state: "deep",
        },
      ];

      const markdown = formatTasksForMemory(tasks);
      expect(markdown).toContain("## ⏰ Auto-Saved Tasks (Before Compaction)");
      expect(markdown).toContain("### Scheduled Tasks");
      expect(markdown).toContain("### Dreaming State");
      expect(markdown).toContain("every 30min");
      expect(markdown).toContain("deep");
    });

    it("should return empty string for no tasks", () => {
      const markdown = formatTasksForMemory([]);
      expect(markdown).toBe("");
    });
  });

  describe("extractTasksFromMessages - real scenarios", () => {
    it("should extract complex cron job creation", () => {
      const messages: AgentMessage[] = [
        {
          role: "assistant",
          content: `✅ Created cron job "dreaming-cron":
- Schedule: every 30 minutes
- Next run: 2026-04-22 13:00
- Session: isolated
- Agent: dreaming-agent`,
        },
      ];

      const tasks = extractTasksFromMessages(messages);
      expect(tasks.length).toBeGreaterThan(0);
      const cronTask = tasks.find((t) => t.type === "cron");
      expect(cronTask).toBeDefined();
      expect(cronTask?.description).toContain("dreaming-cron");
    });

    it("should extract dreaming phase transitions", () => {
      const messages: AgentMessage[] = [
        {
          role: "assistant",
          content: "Transitioning from light dreaming to deep dreaming phase",
        },
      ];

      const tasks = extractTasksFromMessages(messages);
      expect(tasks.some((t) => t.type === "dreaming")).toBe(true);
    });
  });
});
