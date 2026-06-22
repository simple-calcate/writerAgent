# AI Agent Design System v4.0（Multi-Agent Runtime）

> From AI Runtime Visualization → Multi-Agent Operating System

## 0. 核心升级思想

v1 → 是"规则集合"
v2 → 是"可执行系统"
v3 → 是"运行时可视化"
v4 → 是"多智能体操作系统"

v4 的本质：
```
UI = Multi-Agent Runtime + Parallel Lanes + Shared Memory + Conflict Resolution
```

你不再做单 Agent 可视化，你在做 AI multi-agent operating system

## 1. Token System

### 1.1 Color Tokens（语义化）

```typescript
export const color = {
  bg: {
    base: "var(--bg)",
    surface: "var(--surface-1)",
    elevated: "var(--surface-2)",
  },

  text: {
    primary: "var(--text-primary)",
    secondary: "var(--text-secondary)",
    muted: "var(--text-muted)",
  },

  border: {
    subtle: "rgba(255,255,255,0.06)",
    default: "rgba(255,255,255,0.08)",
    strong: "rgba(255,255,255,0.12)",
  },

  semantic: {
    user: "#60a5fa",
    ai: "#34d399",
    thinking: "#a78bfa",
    running: "#fbbf24",
    error: "#f87171",
    success: "#22c55e",
  }
}
```

**关键规则：**
- ❌ 不再用 gray 系
- ❌ 不再直接 hex scattered
- ✔ 所有颜色必须语义化

### 1.2 Background Layers（仅 3 层）

```
--bg          base background
--surface-1   card
--surface-2   elevated
```

### 1.3 Text Levels（仅 3 级）

```
--text-primary
--text-secondary
--text-muted
```

### 1.4 Semantic Colors（一色一义）

```
blue   → interaction / user
green  → success / done
yellow → running / warning
red    → error
purple → thinking / agent
```

## 2. Layout Primitive System

### 2.1 统一 Layout Primitive

```typescript
export const layout = {
  stack: "flex flex-col",
  row: "flex items-center",
  center: "flex items-center justify-center",
  between: "flex items-center justify-between",
}
```

### 2.2 Spacing Primitives（8pt Grid）

| Token | Value | Usage |
|-------|-------|-------|
| 1 | 4px | Inline micro gap |
| 2 | 8px | Inline gap |
| 3 | 12px | Card padding |
| 4 | 16px | Section gap |
| 5 | 20px | Large gap |
| 6 | 24px | Page padding |
| 8 | 32px | Section spacing |

**规则：** UI 不再写 px，而是写 system spacing

**禁止：** `px-2.5`, `py-1.5`, `gap-2.5`, 或任何非系统间距

### 2.3 Border Radius（3 级）

| Token | Tailwind | Value |
|-------|----------|-------|
| sm | `rounded-md` | 6px |
| md | `rounded-lg` | 10px |
| lg | `rounded-xl` | 14px |

## 3. Motion System v2

### 3.1 Motion Tokens

```typescript
export const motion = {
  fast: "150ms cubic-bezier(0.2, 0.8, 0.2, 1)",
  normal: "220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
  slow: "320ms cubic-bezier(0.2, 0.8, 0.2, 1)",
}
```

### 3.2 Motion Primitives

```typescript
export const motionClass = {
  hoverLift: "transition-all duration-150 hover:-translate-y-[1px]",
  fadeIn: "animate-fadeIn",
  press: "active:scale-[0.98]",
}
```

### 3.3 Motion Rules

| Action | Animation |
|--------|-----------|
| hover | lift only (translateY -1px) |
| click | press only (scale 0.98) |
| enter | fade + translateY(4px) |
| expand | height + opacity |

**禁止：** bounce, ping（除 thinking dot）, multiple easing

## 4. Shadow System（替代 Borders）

标准卡片：
```
shadow-[0_0_0_1px_rgba(255,255,255,0.04)]
```

Hover：
```
hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]
```

## 5. Component Primitive System

### 5.1 Surface Primitive

```tsx
export function Surface({ children }) {
  return (
    <div className="
      bg-[--surface-1]
      border border-[rgba(255,255,255,0.06)]
      rounded-md
      shadow-[0_0_0_1px_rgba(255,255,255,0.03)]
    ">
      {children}
    </div>
  )
}
```

### 5.2 Card Primitive

```tsx
export function Card({ children }) {
  return (
    <div className="
      bg-[--surface-1]
      rounded-md
      px-3 py-2
      transition-all duration-150
      hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)]
      hover:-translate-y-[1px]
    ">
      {children}
    </div>
  )
}
```

### 5.3 Status Dot（Agent 核心 UI）

```tsx
export function StatusDot({ status }) {
  const map = {
    running: "bg-yellow-400 animate-pulse",
    done: "bg-green-400",
    error: "bg-red-400",
    idle: "bg-gray-500",
  }

  return (
    <span className={`w-2 h-2 rounded-full ${map[status]}`} />
  )
}
```

## 6. Agent UI System

### 6.1 Execution Node（替代 ToolCard）

```tsx
export function ExecutionNode({ step }) {
  return (
    <div className="
      flex items-center justify-between
      px-3 py-2
      rounded-md
      bg-[--surface-1]
      transition-all duration-150
      hover:-translate-y-[1px]
    ">
      <div className="flex items-center gap-2">
        <StatusDot status={step.status} />
        <span className="text-sm">
          {step.name}
        </span>
      </div>

      <span className="text-xs text-[--text-muted]">
        {step.status}
      </span>
    </div>
  )
}
```

**关键：** Tool ≠ Card，Tool = Execution Node

### 6.2 Execution Timeline（Agent 核心）

```tsx
export function ExecutionTimeline({ steps }) {
  return (
    <div className="flex flex-col gap-2 relative">

      <div className="absolute left-1 top-0 bottom-0 w-px bg-white/5" />

      {steps.map(step => (
        <ExecutionNode key={step.id} step={step} />
      ))}

    </div>
  )
}
```

## 7. Message System v2

### 7.1 Message Primitive

```tsx
export function Message({ msg }) {
  return (
    <div className="flex flex-col gap-1">

      <div className="text-xs text-[--text-muted]">
        {msg.role} · {msg.time}
      </div>

      <Card>
        <div className="text-sm leading-relaxed">
          {msg.content}
        </div>
      </Card>

    </div>
  )
}
```

**核心变化：** Message 不再承载系统逻辑

### 7.2 Message Layers

1. **meta** — role + timestamp
2. **content** — main body only
3. **system** — tool/thinking（NEVER inside message）

## 8. System Layer v2

```tsx
export function SystemInspector({ context }) {
  return (
    <div className="
      flex gap-3
      border-t border-white/5
      px-3 py-2
    ">

      <Card className="flex-1">
        Context: {context.usage}%
      </Card>

      <Card className="flex-1">
        Agent State: Active
      </Card>

    </div>
  )
}
```

## 9. UI Architecture（4 层分离）

```
MESSAGE LAYER
  → Message (pure content)

EXECUTION LAYER
  → Execution Timeline
  → Execution Node

SYSTEM LAYER
  → Context / Agent / Memory

CONTROL LAYER
  → Input / Commands
```

**规则：** Layers MUST NOT mix.

## 10. Design Principles

### 10.1 System over UI

UI 不表达"界面"——它表达**系统状态**。

UI 回答三个问题：
1. 现在发生什么（state）
2. 系统在做什么（execution）
3. 用户能做什么（control）

**绝不：** 装饰性 UI、视觉噪音、重复信息层

### 10.2 Restraint Principle

高质量 UI = 减法系统
- 一个区域做一件事
- 一个组件表达一个状态
- 一个颜色表达一个语义

## 11. Forbidden Patterns

| Pattern | Why |
|---------|-----|
| Multiple border types | Visual noise |
| Random gray opacity | Inconsistent |
| Tool in message | Layer violation |
| Thinking as long text | Not event-driven |
| Hover without motion | No weight feel |
| Non-uniform spacing | Dense not refined |
| Non-semantic colors | No meaning |

## 12. Quality = 4 Unifications

1. Spacing system（8pt）
2. Color semantics
3. Motion consistency
4. Hierarchy clarity

## 13. Mental Model

This is NOT a chat app. It is:

> **AI Runtime Visualization System**

Objects: Input → Runtime Graph → Execution Nodes → System State → UI Sync

## 14. v3 Runtime Types

### 14.1 AgentRun（核心运行状态）

```typescript
interface AgentRun {
  id: string
  input: string
  state: "idle" | "running" | "paused" | "done" | "error"
  nodes: ExecutionNode[]
  edges: ExecutionEdge[]
  memory: MemoryState
  context: ContextState
  result?: string
}
```

### 14.2 ExecutionNode（AI 运行单元）

```typescript
interface ExecutionNode {
  id: string
  type: "tool" | "thinking" | "retrieval" | "rewrite"
  label: string
  status: "pending" | "running" | "done" | "error"
  input?: unknown
  output?: unknown
  startTime?: number
  endTime?: number
  metadata?: { tokens?: number; cost?: number }
}
```

### 14.3 ExecutionEdge（AI 思维流）

```typescript
interface ExecutionEdge { from: string; to: string }
```

### 14.4 MemoryState（AI 记忆系统）

```typescript
interface MemoryState { shortTerm: string[]; longTerm: string[]; embeddings?: number[] }
```

### 14.5 ContextState（上下文压缩）

```typescript
interface ContextState { windowSize: number; usedTokens: number; compressionRatio: number }
```

## 15. v3 UI Components

### 15.1 ExecutionGraphView
- DAG 可视化，替代 flat timeline
- 每个 node = 一个 AI step
- StatusDot 驱动状态色
- Running node: `scale-[1.02]` + pulse

### 15.2 MemoryPanel
- 短期记忆 + 长期记忆
- 折叠/展开

### 15.3 InspectorPanel
- 状态、节点数、tokens、上下文进度条

### 15.4 CommandCenter
- 运行状态 badge + 暂停/继续控制
- 包裹 InputDock，提供运行时上下文

## 16. v3 Architecture

```
┌─────────────────────────────────────────────┐
│ CommandCenter          (input + run trigger) │
├─────────────────────────────────────────────┤
│  ExecutionGraphView    (DAG visualization)  │
│   ├── ExecutionNodeView (per node)          │
│   └── ExecutionEdgeView (per edge)          │
├──────────────────┬──────────────────────────┤
│ MemoryPanel      │ InspectorPanel           │
│  shortTerm[]     │  tokens / nodes / state  │
│  longTerm[]      │  context compression     │
├──────────────────┴──────────────────────────┤
│ OutputStream           (streaming text)     │
└─────────────────────────────────────────────┘
```

### Runtime Flow
```
input → AgentRuntime.start() → state="running"
  → addNode(tool) → UI renders node
  → updateNode(id, {status:"done"}) → UI updates
  → finish(result) → state="done"
```

### State Integration
```
AgentRuntime → emit events → Zustand runtimeSlice → React re-render
```

## 17. v4 Multi-Agent Types

### 17.1 MultiAgentRun
```typescript
interface MultiAgentRun {
  id: string
  agents: AgentInstance[]
  sharedMemory: GlobalMemory
  timeline: ExecutionTimeline[]
  state: "running" | "paused" | "replaying" | "done"
}
```

### 17.2 AgentInstance
```typescript
interface AgentInstance {
  id: string
  role: MARole  // "planner" | "executor" | "critic" | "researcher"
  status: AgentStatus  // "idle" | "active" | "blocked"
  currentNodeId?: string
  graph: ExecutionGraph  // { nodes: ExecutionNode[], edges: ExecutionEdge[] }
}
```

### 17.3 GlobalMemory
```typescript
interface GlobalMemory {
  facts: string[]
  decisions: string[]
  embeddings?: number[]
  conflictLog: string[]
}
```

## 18. v4 UI Components

### 18.1 MultiAgentCanvas
- 多 Agent 并行轨道可视化
- 每个 agent = 一个 AgentLane（水平节点流）
- 替代 v3 的单一 ExecutionGraphView

### 18.2 AgentSidebar
- Agent 列表 + 状态指示
- 点击聚焦特定 agent

### 18.3 MemoryGraphView
- 共享记忆：事实 + 决策 + 冲突日志
- 替代 v3 的 MemoryPanel

### 18.4 ConflictResolver
- 冲突日志展示
- 多 agent 观点竞争的可视化

### 18.5 ExecutionInspector
- 系统级统计：agent 数量、状态、记忆大小、节点数
- 替代 v3 的 InspectorPanel

### 18.6 CommandCenter (v4)
- 支持 MultiAgentRunState
- 暂停/继续/回放 控制

## 19. v4 Architecture

```
┌─────────────────────────────────────────────┐
│ CommandCenter    (input + multi-agent ctrl) │
├─────────────────────────────────────────────┤
│  MultiAgentCanvas    (parallel lanes)       │
│   ├── AgentLane: planner  [N1] [N2] [N3]   │
│   ├── AgentLane: executor [N1] [N2]        │
│   └── AgentLane: critic   [N1]             │
├──────────────────┬──────────────────────────┤
│ MemoryGraphView  │ ExecutionInspector       │
│  facts[]         │  agents / nodes / state  │
│  decisions[]     │  memory / timeline       │
│  conflictLog[]   │                          │
├──────────────────┴──────────────────────────┤
│ ConflictResolver    (conflict display)      │
├─────────────────────────────────────────────┤
│ OutputStream           (streaming text)     │
└─────────────────────────────────────────────┘
```

### v4 vs v3
| 维度 | v3 | v4 |
|------|----|----|
| Agent | 单体 | 多智能体 |
| Execution | 单 DAG | DAG + 并行 |
| Memory | local | global shared |
| Thinking | linear | graph + conflict |
| UI | debugger | operating system |
