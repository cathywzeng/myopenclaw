# Compaction Task Persistence - 测试计划

**分支**: `test/compaction-task-persistence`  
**创建时间**: 2026-04-22  
**目标**: 验证 compaction 配置改动和代码级改动是否有效保护定时任务

---

## 🎯 测试目标

验证以下改动是否能防止 Dreaming Cron 在 compaction 时被 drop：

1. **配置级改动**: Compaction 参数优化（MiniMax 2.7 200k）
2. **代码级改动**: Task State Persistence（自动保存任务到 memory）

---

## 📋 测试清单

### 阶段 1: 配置验证

```bash
# 1. 检查配置是否应用
openclaw config get agents.defaults.compaction

# 2. 验证关键参数
openclaw config get agents.defaults.contextTokens
# 期望：200000

openclaw config get agents.defaults.compaction.reserveTokensFloor
# 期望：50000

openclaw config get agents.defaults.compaction.memoryFlush.enabled
# 期望：true

openclaw config get agents.defaults.compaction.memoryFlush.softThresholdTokens
# 期望：140000
```

**预期结果**: 所有参数与 MEMO.md 中配置一致

---

### 阶段 2: Memory Flush 测试

```bash
# 1. 查看当前 memory 文件
cat ~/.openclaw/workspace/memory/$(date +%Y-%m-%d).md

# 2. 检查是否有 pending tasks 章节
grep -A20 "Pending" ~/.openclaw/workspace/memory/$(date +%Y-%m-%d).md
```

**预期结果**: 
- Memory 文件中有 `## ⏰ Pending Cron Jobs` 或 `## ⏰ Auto-Saved Tasks` 章节
- 包含 dreaming cron 的 schedule 和 next run time

---

### 阶段 3: Compaction 触发测试

```bash
# 1. 监控 compaction 日志
tail -f /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log | grep -i compaction

# 2. 等待 compaction 触发（或手动触发）
# 观察日志中是否有 "Persisted X tasks before compaction"

# 3. 检查 compaction 后的 memory 文件
cat ~/.openclaw/workspace/memory/$(date +%Y-%m-%d).md
```

**预期结果**:
- 日志中出现 `Persisted X tasks before compaction to ...`
- Memory 文件中有新保存的任务

---

### 阶段 4: Dreaming Cron 连续性测试

```bash
# 1. 查看当前 cron jobs
openclaw cron list

# 2. 记录 dreaming cron 的详细信息
openclaw cron list --json | jq '.[] | select(.name | contains("dream"))'

# 3. 等待 compaction 发生

# 4. compaction 后再次检查 cron jobs
openclaw cron list

# 5. 对比 compaction 前后 cron 配置是否一致
```

**预期结果**:
- Compaction 前后 cron jobs 配置一致
- schedule 和 next run time 没有丢失

---

### 阶段 5: 日志分析

```bash
# 1. 搜索 task persistence 相关日志
grep -i "task.*persist\|persist.*task" /tmp/openclaw/openclaw-*.log

# 2. 搜索 memory flush 相关日志
grep -i "memory.*flush" /tmp/openclaw/openclaw-*.log

# 3. 搜索 compaction 相关警告
grep -i "compaction.*fail\|drop.*task\|lost.*cron" /tmp/openclaw/openclaw-*.log
```

**预期结果**:
- 有 task persistence 成功日志
- 没有任务丢失的警告

---

## 🧪 测试场景

### 场景 1: 正常 Compaction

**步骤**:
1. 运行 main session 进行长时间对话
2. 触发 compaction（context 达到 140k tokens）
3. 检查 memory 文件

**期望**:
- ✅ Memory 文件包含 pending tasks
- ✅ Dreaming cron 配置保留

---

### 场景 2: Dreaming Cron 执行后 Compaction

**步骤**:
1. 等待 dreaming cron 自动执行
2. 执行后不久触发 compaction
3. 检查 cron 状态

**期望**:
- ✅ Cron 执行记录保留
- ✅ Next run time 正确更新
- ✅ Dreaming phase state 保留

---

### 场景 3: Isolated Session Compaction

**步骤**:
1. 检查 isolated session 的状态
2. 触发 isolated session 的 compaction
3. 检查任务连续性

**期望**:
- ✅ Isolated session 的任务也保存
- ✅ 不依赖 main session

---

## 📊 成功标准

| 标准 | 检查方法 | 期望结果 |
|------|---------|---------|
| **配置应用** | `openclaw config get` | 所有参数正确 |
| **Memory Flush** | 检查 memory 文件 | 有 pending tasks 章节 |
| **Task Persistence** | 日志分析 | 有 "Persisted X tasks" 日志 |
| **Cron 连续性** | compaction 前后对比 | cron 配置一致 |
| **无任务丢失** | 日志警告 | 没有 "lost cron" 警告 |

---

## 🐛 故障排查

### 问题 1: Memory 文件没有 pending tasks

**可能原因**:
- Memory flush 未触发
- Prompt 没有生效

**排查步骤**:
```bash
# 检查 memory flush 配置
openclaw config get agents.defaults.compaction.memoryFlush

# 检查日志中是否有 memory flush
grep -i "memory.*flush" /tmp/openclaw/openclaw-*.log

# 手动触发 memory flush（测试用）
# 需要找到 session key
```

---

### 问题 2: Task persistence 没有日志

**可能原因**:
- 代码未编译
- Hook 未触发

**排查步骤**:
```bash
# 检查代码是否编译
ls -la ~/.openclaw/node_modules/openclaw/dist/agents/pi-hooks/compaction-task-persist.js

# 如果没有，需要 build
cd /home/admin/workspace/openclaw
pnpm build

# 重启 gateway
openclaw gateway restart
```

---

### 问题 3: Cron 仍然被 drop

**可能原因**:
- Compaction summary 质量不够
- Quality guard 未生效

**排查步骤**:
```bash
# 检查 quality guard 配置
openclaw config get agents.defaults.compaction.qualityGuard

# 检查 compaction summary 内容
# 查看 session transcript 中的 compaction entry
```

---

## 📝 测试报告模板

```markdown
# Compaction Task Persistence 测试报告

**测试日期**: 2026-04-22
**测试分支**: test/compaction-task-persistence
**测试人**: [你的名字]

## 配置验证

- [ ] contextTokens = 200000
- [ ] reserveTokensFloor = 50000
- [ ] memoryFlush.enabled = true
- [ ] memoryFlush.softThresholdTokens = 140000

## Memory Flush 测试

- [ ] Memory 文件包含 pending tasks
- [ ] 包含 dreaming cron schedule
- [ ] 包含 next run time

## Compaction 测试

- [ ] 日志中有 "Persisted X tasks" 
- [ ] Compaction 后 cron 配置一致
- [ ] 没有任务丢失警告

## 问题记录

[记录发现的问题]

## 结论

[通过/失败] - [简要说明]
```

---

## 🔗 相关文件

- **配置备忘录**: `/home/admin/workspace/myopenclaw/MEMO.md`
- **代码改动**: `/home/admin/workspace/openclaw/src/agents/pi-hooks/compaction-task-persist.ts`
- **日志文件**: `/tmp/openclaw/openclaw-$(date +%Y-%m-%d).log`
- **Memory 文件**: `~/.openclaw/workspace/memory/YYYY-MM-DD.md`

---

## ✅ 下一步

1. **应用配置** (如果还未应用)
2. **运行测试** (按上述测试清单)
3. **填写报告** (使用上面模板)
4. **决定** (合并配置 / 调整参数 / 需要更多改动)
