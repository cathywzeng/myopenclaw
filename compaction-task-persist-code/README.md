# Compaction Task Persistence - Code Changes

**Source**: `/home/admin/workspace/openclaw`  
**Branch**: `feat/compaction-task-persistence`  
**Purpose**: Prevent cron jobs and tasks from being dropped during compaction

---

## 📦 Files Changed

### 1. New File: `compaction-task-persist.ts`

**Path**: `src/agents/pi-hooks/compaction-task-persist.ts`

**Purpose**: Utility for extracting and persisting task state before compaction

**Key Functions**:
- `extractTasksFromMessages()` - Extract cron, dreaming, TODO from messages
- `formatTasksForMemory()` - Format as markdown
- `persistTasksToMemory()` - Write to memory/YYYY-MM-DD.md
- `extractAndPersistTaskState()` - Main entry point

---

### 2. New File: `compaction-task-persist.test.ts`

**Path**: `src/agents/pi-hooks/compaction-task-persist.test.ts`

**Purpose**: Unit tests for task extraction and formatting

**Test Coverage**:
- Cron job extraction
- Dreaming state extraction
- TODO extraction
- Deduplication
- Empty message handling

---

### 3. Modified: `compaction-safeguard.ts`

**Path**: `src/agents/pi-hooks/compaction-safeguard.ts`

**Changes**:
```typescript
// Add import at top
import { extractAndPersistTaskState } from "./compaction-task-persist.js";

// Add in session_before_compact hook (after line 725)
api.on("session_before_compact", async (event, ctx) => {
  const { preparation, customInstructions: eventInstructions, signal } = event;
  
  // NEW: Extract and persist task state before compaction
  try {
    const allMessages = [
      ...preparation.messagesToSummarize,
      ...(preparation.turnPrefixMessages ?? []),
    ];
    const taskPersistResult = await extractAndPersistTaskState(
      allMessages as AgentMessage[],
      ctx.sessionKey,
    );
    if (taskPersistResult.taskCount > 0) {
      log.info(
        `Persisted ${taskPersistResult.taskCount} tasks before compaction to ${taskPersistResult.memoryPath}`,
      );
    }
  } catch (err) {
    log.warn(
      `Task persistence failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    // Don't fail compaction if task persistence fails
  }
  
  // ... rest of existing code
```

---

## 🔧 How to Apply to OpenClaw

### Option 1: Manual Copy

```bash
# 1. Copy files to OpenClaw source
cp compaction-task-persist.ts /home/admin/workspace/openclaw/src/agents/pi-hooks/
cp compaction-task-persist.test.ts /home/admin/workspace/openclaw/src/agents/pi-hooks/

# 2. Edit compaction-safeguard.ts (add import and hook code above)

# 3. Build OpenClaw
cd /home/admin/workspace/openclaw
pnpm build

# 4. Restart Gateway
openclaw gateway restart
```

### Option 2: Git Cherry-pick

```bash
# 1. Go to OpenClaw repo
cd /home/admin/workspace/openclaw

# 2. Checkout the feature branch
git checkout feat/compaction-task-persistence

# 3. Verify files
git show --stat

# 4. Merge to main (after testing)
git checkout main
git merge feat/compaction-task-persistence
```

---

## 🧪 Testing

See `../TEST-PLAN.md` for comprehensive test plan.

### Quick Test

```bash
# 1. Check logs for task persistence
tail -f /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log | grep -i "persist.*task"

# 2. Check memory files
cat ~/.openclaw/workspace/memory/$(date +%Y-%m-%d).md | grep -A20 "Auto-Saved"

# 3. Verify cron jobs survive compaction
openclaw cron list
```

---

## 📊 Expected Behavior

### Before Compaction
1. Task extraction scans session messages
2. Finds cron jobs, dreaming states, TODOs
3. Saves to memory/YYYY-MM-DD.md

### During Compaction
1. Log shows: `Persisted X tasks before compaction to ...`
2. Compaction proceeds normally
3. Summary may drop details, but tasks are safe in memory

### After Compaction
1. Memory file contains `## ⏰ Auto-Saved Tasks (Before Compaction)`
2. Cron jobs still configured
3. Dreaming state preserved

---

## 🐛 Troubleshooting

### No task persistence logs

**Check**: Code is compiled and loaded
```bash
ls -la ~/.openclaw/node_modules/openclaw/dist/agents/pi-hooks/compaction-task-persist.js
```

**Fix**: Rebuild OpenClaw
```bash
cd /home/admin/workspace/openclaw
pnpm build
openclaw gateway restart
```

### Memory file not created

**Check**: Memory flush is enabled
```bash
openclaw config get agents.defaults.compaction.memoryFlush.enabled
```

**Fix**: Enable if false
```bash
openclaw config set agents.defaults.compaction.memoryFlush.enabled true
openclaw gateway restart
```

---

## 📝 Commit History

```
commit 881d1b1716
Author: AI Assistant
Date:   2026-04-22

    feat: persist tasks before compaction to ensure continuity
    
    - Add compaction-task-persist.ts utility
    - Integrate into compaction-safeguard hook
    - Add comprehensive test coverage
    - Auto-save tasks to memory before compaction
```

---

## 🔗 Related

- **Test Plan**: `../TEST-PLAN.md`
- **Config Memo**: `../MEMO.md`
- **Source Branch**: `feat/compaction-task-persistence` (in openclaw repo)
