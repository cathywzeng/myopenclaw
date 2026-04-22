# OpenClaw Compaction 配置备忘录

**最后更新**: 2026-04-22  
**目标模型**: MiniMax 2.7 (200k 上下文)  
**核心问题**: Dreaming Cron 在 isolated session 中仍被 compaction drop 掉

---

## 🔍 问题诊断

### 根本原因

1. **Isolated Session 也有独立的 compaction 机制**
   - 每个 isolated session 有自己的 `sessionKey` 和 `totalTokens`
   - 当 isolated session 的 context 满了，也会触发 compaction
   - **compaction 时同样会 drop 掉定时任务信息**

2. **Memory Flush 触发条件**（在 `memory-flush.ts` 中）：
   ```typescript
   const threshold = contextWindow - reserveTokens - softThreshold;
   // 当 totalTokens >= threshold 时触发 memory flush
   ```

3. **Dreaming Cron 的问题**：
   - Dreaming cron 每次执行都会添加新的 dreaming entry 到 session
   - 长期积累后，isolated session 的 context 也会满 (200k)
   - compaction 时把之前的 cron 配置信息总结掉了

---

## ✅ 完整配置（已应用部分，请检查补充）

### ~/.openclaw/openclaw.json

```json
{
  "agents": {
    "defaults": {
      "contextTokens": 200000,
      "compaction": {
        "mode": "safeguard",
        "reserveTokensFloor": 50000,
        "keepRecentTokens": 60000,
        "maxHistoryShare": 0.75,
        "recentTurnsPreserve": 8,
        "customInstructions": "CRITICAL: Preserve ALL cron job definitions, schedules, pending tasks, and dreaming phase states. Never summarize away task continuity. Always include exact next-run times and schedule patterns.",
        "memoryFlush": {
          "enabled": true,
          "softThresholdTokens": 140000,
          "forceFlushTranscriptBytes": "3mb",
          "prompt": "⚠️ **TASK CONTINUITY CRITICAL** ⚠️\n\nBefore context compaction, you MUST write to memory:\n\n## ⏰ Pending Cron Jobs\nList EVERY scheduled task:\n- Job name/ID\n- Next execution time (exact)\n- Schedule pattern (e.g., 'every 30min', 'daily at 09:00', 'cron: 0 */2 * * *')\n- Last execution result\n\n## 🌙 Dreaming State\n- Current dreaming phase (deep/light/REM)\n- Last dreaming session timestamp\n- Pending dreaming tasks\n\n## 📝 Open Action Items\n- Incomplete TODOs\n- Unresolved questions\n\n## ✅ Key Decisions\n- Important conclusions from this session\n\nWrite to `memory/YYYY-MM-DD.md` under clear section headers.\n\n**After writing, respond with NO_REPLY** to avoid adding more context.",
          "systemPrompt": "TASK CONTINUITY IS YOUR HIGHEST PRIORITY. Losing cron jobs or dreaming states during compaction is a CRITICAL FAILURE. Always preserve:\n1. Exact cron schedules\n2. Next run times\n3. Dreaming phase states\n4. Pending task lists\n\nErr on preserving TOO MUCH task information rather than too little."
        },
        "qualityGuard": {
          "enabled": true,
          "maxRetries": 3
        },
        "timeoutSeconds": 1500,
        "notifyUser": true,
        "postCompactionSections": ["Session Startup", "Red Lines", "Task Execution Rules", "GatewayRestart"],
        "truncateAfterCompaction": false,
        "provider": null
      }
    }
  },
  "cron": {
    "enabled": true,
    "maxConcurrentRuns": 6
  }
}
```

---

## 📋 CLI 配置命令（检查哪些已执行）

```bash
# 1. 设置 context tokens
openclaw config set agents.defaults.contextTokens 200000

# 2. 设置 compaction 模式
openclaw config set agents.defaults.compaction.mode safeguard

# 3. 设置 reserve tokens floor (200k 的 25% = 50k)
openclaw config set agents.defaults.compaction.reserveTokensFloor 50000

# 4. 设置 keep recent tokens (200k 的 30% = 60k)
openclaw config set agents.defaults.compaction.keepRecentTokens 60000

# 5. 设置 max history share (75%)
openclaw config set agents.defaults.compaction.maxHistoryShare 0.75

# 6. 设置 recent turns preserve (8 轮)
openclaw config set agents.defaults.compaction.recentTurnsPreserve 8

# 7. 设置 custom instructions (保护任务连续性)
openclaw config set agents.defaults.compaction.customInstructions "CRITICAL: Preserve ALL cron job definitions, schedules, pending tasks, and dreaming phase states. Never summarize away task continuity. Always include exact next-run times and schedule patterns."

# 8. 启用 memory flush
openclaw config set agents.defaults.compaction.memoryFlush.enabled true

# 9. 设置 soft threshold (200k - 50k - 10k = 140k 触发)
openclaw config set agents.defaults.compaction.memoryFlush.softThresholdTokens 140000

# 10. 设置 force flush transcript size (3MB)
openclaw config set agents.defaults.compaction.memoryFlush.forceFlushTranscriptBytes "3mb"

# 11. 设置 memory flush prompt (关键！)
openclaw config set agents.defaults.compaction.memoryFlush.prompt "⚠️ **TASK CONTINUITY CRITICAL** ⚠️\n\nBefore context compaction, you MUST write to memory:\n\n## ⏰ Pending Cron Jobs\nList EVERY scheduled task:\n- Job name/ID\n- Next execution time (exact)\n- Schedule pattern (e.g., 'every 30min', 'daily at 09:00')\n- Last execution result\n\n## 🌙 Dreaming State\n- Current dreaming phase (deep/light/REM)\n- Last dreaming session timestamp\n- Pending dreaming tasks\n\n## 📝 Open Action Items\n- Incomplete TODOs\n- Unresolved questions\n\nWrite to memory/YYYY-MM-DD.md\n\n**After writing, respond with NO_REPLY**"

# 12. 启用 quality guard
openclaw config set agents.defaults.compaction.qualityGuard.enabled true

# 13. 设置 max retries
openclaw config set agents.defaults.compaction.qualityGuard.maxRetries 3

# 14. 设置 compaction 超时 (1500 秒 = 25 分钟)
openclaw config set agents.defaults.compaction.timeoutSeconds 1500

# 15. 启用用户通知
openclaw config set agents.defaults.compaction.notifyUser true

# 重启 gateway
openclaw gateway restart
```

---

## 📊 配置参数详解（MiniMax 2.7 200k）

| 参数 | 值 | 计算逻辑 | 作用 |
|------|-----|---------|------|
| `contextTokens` | 200,000 | MiniMax 2.7 总上下文 | 告诉系统你的上下文窗口大小 |
| `reserveTokensFloor` | 50,000 | 200k × 25% | 保留给回复生成 + tool 输出 |
| `keepRecentTokens` | 60,000 | 200k × 30% | 保留最近的对话原文 |
| `maxHistoryShare` | 0.75 | 75% | 历史最多占 75%，留 25% 给新对话 |
| `recentTurnsPreserve` | 8 | 8 轮 | 保留最近 8 轮完整对话 |
| `softThresholdTokens` | 140,000 | 200k - 50k - 10k | 达到 140k 时触发 memory flush |
| `forceFlushTranscriptBytes` | "3mb" | 3MB | transcript 达到 3MB 强制 flush |
| `timeoutSeconds` | 1500 | 25 分钟 | 200k 总结需要更长时间 |

---

## 🎯 Dreaming Cron 专用 Agent 配置（可选）

为 dreaming cron 创建专用的 agent 配置，进一步保护任务连续性：

```json
{
  "agents": {
    "list": [
      {
        "id": "dreaming-cron",
        "model": {
          "primary": "bailian/qwen3-max-2026-01-23"
        },
        "contextTokens": 200000,
        "compaction": {
          "mode": "safeguard",
          "reserveTokensFloor": 60000,
          "keepRecentTokens": 70000,
          "maxHistoryShare": 0.8,
          "recentTurnsPreserve": 10,
          "memoryFlush": {
            "enabled": true,
            "softThresholdTokens": 120000,
            "prompt": "🌙 **DREAMING CRON CONTINUITY**\n\nBefore compaction, preserve:\n1. All dreaming cron schedules\n2. Current dreaming phase state\n3. Next scheduled dreaming session\n4. Any incomplete dreaming phases\n\nThis is CRITICAL for dreaming continuity."
          },
          "qualityGuard": {
            "enabled": true,
            "maxRetries": 3
          }
        }
      }
    ]
  }
}
```

**应用命令**：
```bash
# 使用 config patch 应用 dreaming-cron 专用配置
openclaw config patch '{
  "agents": {
    "list": [
      {
        "id": "dreaming-cron",
        "model": {
          "primary": "bailian/qwen3-max-2026-01-23"
        },
        "contextTokens": 200000,
        "compaction": {
          "mode": "safeguard",
          "reserveTokensFloor": 60000,
          "keepRecentTokens": 70000,
          "maxHistoryShare": 0.8,
          "recentTurnsPreserve": 10,
          "memoryFlush": {
            "enabled": true,
            "softThresholdTokens": 120000,
            "prompt": "🌙 **DREAMING CRON CONTINUITY**\\n\\nBefore compaction, preserve:\\n1. All dreaming cron schedules\\n2. Current dreaming phase state\\n3. Next scheduled dreaming session\\n4. Any incomplete dreaming phases\\n\\nThis is CRITICAL for dreaming continuity."
          },
          "qualityGuard": {
            "enabled": true,
            "maxRetries": 3
          }
        }
      }
    ]
  }
}'
```

---

## 🔧 验证配置生效

```bash
# 1. 检查配置是否应用
openclaw config get agents.defaults.compaction

# 2. 检查 gateway 状态
openclaw gateway status

# 3. 查看 compaction 日志
tail -f /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log | grep -i compaction

# 4. 检查 memory flush 是否触发
tail -f /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log | grep -i "memory.*flush"

# 5. 查看当前 cron jobs
openclaw cron list

# 6. 检查 session 状态
openclaw config get sessions
```

---

## 🧹 定期维护命令

```bash
# 清理完成的 cron session（保留最近 7 天）
openclaw cron session-reaper --keep-days 7

# 查看 cron session 状态
openclaw cron status

# 手动触发 memory flush（测试用）
# 需要先找到 session key
openclaw session flush --key <session-key>
```

---

## 🚨 监控告警

### 检查 compaction 是否丢失任务

```bash
# 检查最近的 memory 文件，看是否有 pending tasks
cat ~/.openclaw/workspace/memory/$(date +%Y-%m-%d).md | grep -A20 "Pending"

# 检查 cron jobs 是否还在
openclaw cron list --include-disabled
```

### 日志关键字

```bash
# 查找 compaction 相关警告
grep -i "compaction.*fail\|drop.*task\|lost.*cron" /tmp/openclaw/openclaw-*.log

# 查找 memory flush 成功标记
grep -i "memory.*flush.*success\|task.*persist" /tmp/openclaw/openclaw-*.log
```

---

## 📝 补充建议（未实施）

### 方案 2：增加 Compaction 前 Hook（代码级改进）

**修改位置**: `src/agents/pi-hooks/compaction-safeguard.ts`

**添加代码**：
```typescript
// 在 compaction 开始前，提取并持久化任务状态
async function extractAndPersistTaskState(
  messages: AgentMessage[],
  sessionKey: string,
): Promise<void> {
  // 1. 扫描所有消息，提取 cron 任务相关信息
  const pendingTasks = extractCronTasksFromMessages(messages);
  
  // 2. 写入 memory 文件
  if (pendingTasks.length > 0) {
    const memoryPath = path.join(
      os.homedir(),
      '.openclaw/workspace/memory',
      `${new Date().toISOString().split('T')[0]}.md`
    );
    
    await fs.appendFile(
      memoryPath,
      `\n## ⏰ Pending Cron Tasks (Auto-saved before compaction)\n${pendingTasks.join('\n')}\n`
    );
  }
}

function extractCronTasksFromMessages(messages: AgentMessage[]): string[] {
  const tasks: string[] = [];
  
  for (const msg of messages) {
    // 查找包含 cron 任务创建/修改的消息
    if (msg.role === 'user' && /cron.*add|schedule|remind/.test(msg.content)) {
      tasks.push(`- ${msg.content}`);
    }
    if (msg.role === 'assistant' && /created.*cron|scheduled/.test(msg.content)) {
      tasks.push(`- ${msg.content}`);
    }
  }
  
  return tasks;
}
```

---

### 方案 3：Task State 专用存储（长期方案）

**修改位置**: 新建 `src/cron/task-state-persist.ts`

**实现思路**：
```typescript
// 任务状态持久化器
class CronTaskStatePersister {
  private statePath = path.join(os.homedir(), '.openclaw/cron-task-state.json');
  
  async saveTask(task: {
    id: string;
    name: string;
    schedule: string;
    payload: any;
    nextRun: string;
    createdAt: string;
    sessionKey: string;
  }): Promise<void> {
    const state = await this.load();
    state.tasks.push(task);
    await this.save(state);
  }
  
  async loadTasks(): Promise<Array<any>> {
    const state = await this.load();
    return state.tasks.filter(t => !t.completed);
  }
  
  private async load(): Promise<any> {
    try {
      return JSON.parse(await fs.readFile(this.statePath, 'utf-8'));
    } catch {
      return { tasks: [], version: 1 };
    }
  }
  
  private async save(state: any): Promise<void> {
    await fs.writeFile(this.statePath, JSON.stringify(state, null, 2));
  }
}
```

**在 compaction 时调用**：
```typescript
// compaction 前自动保存所有 pending tasks
const persister = new CronTaskStatePersister();
await persister.saveAllPendingTasks();
```

---

## 📋 配置检查清单

- [ ] `contextTokens` 设置为 200000
- [ ] `compaction.mode` 设置为 safeguard
- [ ] `reserveTokensFloor` 设置为 50000
- [ ] `keepRecentTokens` 设置为 60000
- [ ] `maxHistoryShare` 设置为 0.75
- [ ] `recentTurnsPreserve` 设置为 8
- [ ] `customInstructions` 包含任务连续性保护
- [ ] `memoryFlush.enabled` 为 true
- [ ] `memoryFlush.softThresholdTokens` 设置为 140000
- [ ] `memoryFlush.forceFlushTranscriptBytes` 设置为 "3mb"
- [ ] `memoryFlush.prompt` 包含 cron jobs 和 dreaming state
- [ ] `qualityGuard.enabled` 为 true
- [ ] `qualityGuard.maxRetries` 设置为 3
- [ ] `timeoutSeconds` 设置为 1500
- [ ] `notifyUser` 设置为 true
- [ ] Gateway 已重启

---

## 🔗 相关文件

- **Compaction 主逻辑**: `src/agents/pi-hooks/compaction-safeguard.ts`
- **Memory Flush**: `src/auto-reply/reply/memory-flush.ts`
- **Compaction 质量检查**: `src/agents/pi-hooks/compaction-safeguard-quality.ts`
- **Cron Isolated Session**: `src/cron/isolated-agent/run.ts`
- **Session State**: `src/cron/isolated-agent/run-session-state.ts`

---

**最后检查**: 配置应用后，观察 1-2 个 compaction 周期，确认 memory 文件中有 pending tasks 记录。
