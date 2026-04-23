# Context 分析日志功能

## 📊 功能说明

在每次调用 context engine 的 `assemble()` 之前，自动打印详细的 context 组成分析日志。

## 📍 日志位置

```bash
~/.openclaw/logs/openclaw.log
```

## 🔍 日志格式

### **WARN 级别（主要分析）**

```
[Context Analysis session-xxx] Messages: 45 (U:20/A:18/T:7) | Chars: 125,430 (est. 31,357 tokens) | Turns: 18 | Oldest: 120min ago | Tool calls: 12 | Memory refs: 3 | Agents.md refs: 2 | System prompt: 8,500 chars
```

**字段说明：**
- `Messages`: 总消息数（User/Assistant/Tool）
- `Chars`: 总字符数（估算 tokens = chars / 4）
- `Turns`: 对话轮数（user+assistant 配对）
- `Oldest`: 最旧消息的年龄（分钟）
- `Tool calls`: tool_call 数量
- `Memory refs`: memory_get/MEMORY.md 引用次数
- `Agents.md refs`: AGENTS.md/USER.md/SOUL.md 引用次数
- `System prompt`: system prompt 字符数

### **DEBUG 级别（详细分解）**

```
  User: 20 msgs, 45,230 chars
  Assistant: 18 msgs, 62,100 chars
  Tool: 7 msgs, 18,100 chars
```

## 🎯 使用场景

### **1. 调试 Context 增长过快**

```bash
# 查看 context 分析日志
grep "Context Analysis" ~/.openclaw/logs/openclaw.log | tail -20

# 查看详细信息
grep -A 3 "Context Analysis" ~/.openclaw/logs/openclaw.log | tail -50
```

### **2. 分析 Compaction 触发原因**

```bash
# 查找 compaction 前的 context 状态
grep -B 2 -A 5 "Context Analysis" ~/.openclaw/logs/openclaw.log | grep -A 5 "Auto-compaction"
```

### **3. 监控 Skill/Tool 使用情况**

```bash
# 统计 tool call 频率
grep "Context Analysis" ~/.openclaw/logs/openclaw.log | awk -F'Tool calls:' '{print $2}' | awk '{print $1}' | sort -n | tail -10
```

## 📈 典型问题分析

### **问题 1: Memory 引用过多**

```
Memory refs: 15  # ← 太高了！
```

**可能原因：** 每次对话都读取 MEMORY.md  
**解决：** 检查 memory 配置，增加缓存

### **问题 2: Tool Results 堆积**

```
Tool: 50 msgs, 85,000 chars  # ← Tool 消息太多
```

**可能原因：** Tool result 没有被清理  
**解决：** 检查 tool result truncation 配置

### **问题 3: Agents.md 重复注入**

```
Agents.md refs: 8  # ← 重复注入
```

**可能原因：** postCompactionSections 配置问题  
**解决：** 检查 compaction 后的 context 注入逻辑

### **问题 4: Context 增长过快**

```
# 对比多次调用的 tokens 数
grep "Context Analysis" ~/.openclaw/logs/openclaw.log | awk -F'est.' '{print $2}' | awk '{print $1}'
```

**正常：** 每轮增长 < 2000 tokens  
**异常：** 每轮增长 > 5000 tokens → 检查 compaction 是否正常工作

## 🔧 配置日志级别

在 `~/.openclaw/openclaw.json` 中：

```json
{
  "logging": {
    "consoleLevel": "debug",  // 或 "warn" 只看主要分析
    "consoleStyle": "pretty"
  }
}
```

## 📊 示例输出

```
23:45:12 [context-analyzer] [Context Analysis session-abc123] Messages: 32 (U:15/A:12/T:5) | Chars: 98,450 (est. 24,612 tokens) | Turns: 12 | Oldest: 45min ago | Tool calls: 8 | Memory refs: 2 | Agents.md refs: 1 | System prompt: 7,200 chars
23:45:12 [context-analyzer]   User: 15 msgs, 32,100 chars
23:45:12 [context-analyzer]   Assistant: 12 msgs, 48,200 chars
23:45:12 [context-analyzer]   Tool: 5 msgs, 18,150 chars
```

## 🦞 故障排查

### **没有看到日志？**

1. 检查日志级别是否为 `warn` 或 `debug`
2. 确认 `params.contextEngine` 存在
3. 检查 `prePromptMessageCount` 是否正确设置

### **日志太多？**

- 只保留 WARN 级别：设置 `consoleLevel: "warn"`
- 或注释掉 `analyzeAndLogContext()` 调用

## 📝 相关文件

- `src/agents/pi-embedded-runner/run/context-analyzer.ts` - 分析逻辑
- `src/agents/pi-embedded-runner/run/attempt.ts` - 调用位置（line ~1557）

---

**提示：** 这个功能主要用于调试，生产环境建议只在需要时开启 DEBUG 日志。
