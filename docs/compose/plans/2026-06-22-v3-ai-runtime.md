# v3 AI Runtime Visualization System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the UI from a "data display" into an "AI runtime visualization system" by introducing a unified data model, an event-driven runtime controller, and DAG-based UI components.

**Architecture:** Three layers — (1) shared types define the runtime data model, (2) a renderer-side `AgentRuntime` class manages state transitions and emits events, (3) React components subscribe to the runtime via a Zustand slice and render the execution graph, memory, and inspector panels.

**Tech Stack:** TypeScript, React, Zustand, TailwindCSS, Electron

**Spec:** `docs/compose/specs/2026-06-22-v3-ai-runtime-design.md`

---

### Task 1: Create v3 Runtime Types

**Covers:** [S3]

**Files:**
- Create: `src/shared/types/runtime.ts`
- Modify: `src/shared/types/index.ts`

- [ ] **Step 1: Create `src/shared/types/runtime.ts`**

```typescript
// ─── v3 AI Runtime Types ───

export type AgentRunState = "idle" | "running" | "paused" | "done" | "error"

export type ExecutionNodeType = "tool" | "thinking" | "retrieval" | "rewrite"

export type ExecutionNodeStatus = "pending" | "running" | "done" | "error"

export interface ExecutionNode {
  id: string
  type: ExecutionNodeType
  label: string
  status: ExecutionNodeStatus
  input?: unknown
  output?: unknown
  startTime?: number
  endTime?: number
  metadata?: {
    tokens?: number
    cost?: number
  }
}

export interface ExecutionEdge {
  from: string
  to: string
}

export interface MemoryState {
  shortTerm: string[]
  longTerm: string[]
  embeddings?: number[]
}

export interface ContextState {
  windowSize: number
  usedTokens: number
  compressionRatio: number
}

export interface AgentRun {
  id: string
  input: string
  state: AgentRunState
  nodes: ExecutionNode[]
  edges: ExecutionEdge[]
  memory: MemoryState
  context: ContextState
  result?: string
}
```

- [ ] **Step 2: Add re-export to `src/shared/types/index.ts`**

Add this line after the existing exports:
```typescript
export * from './runtime'
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 2: Create AgentRuntime Controller

**Covers:** [S4]

**Files:**
- Create: `src/renderer/src/runtime/AgentRuntime.ts`

- [ ] **Step 1: Create `src/renderer/src/runtime/AgentRuntime.ts`**

```typescript
import type { AgentRun, AgentRunState, ExecutionNode, ExecutionEdge, MemoryState, ContextState } from '../../../shared/types'

type RuntimeEvent = 'start' | 'update' | 'pause' | 'resume' | 'finish' | 'error'
type RuntimeListener = (run: AgentRun) => void

let runCounter = 0

function createEmptyRun(input: string): AgentRun {
  return {
    id: `run-${Date.now()}-${++runCounter}`,
    input,
    state: 'idle',
    nodes: [],
    edges: [],
    memory: { shortTerm: [], longTerm: [] },
    context: { windowSize: 128000, usedTokens: 0, compressionRatio: 1 }
  }
}

export class AgentRuntime {
  private run: AgentRun
  private listeners = new Map<RuntimeEvent, Set<RuntimeListener>>()

  constructor(existingRun?: AgentRun) {
    this.run = existingRun ?? createEmptyRun('')
  }

  getRun(): AgentRun {
    return this.run
  }

  start(input: string) {
    this.run = createEmptyRun(input)
    this.run.state = 'running'
    this.emit('start')
  }

  updateNode(nodeId: string, patch: Partial<ExecutionNode>) {
    const node = this.run.nodes.find(n => n.id === nodeId)
    if (!node) return
    Object.assign(node, patch)
    this.emit('update')
  }

  addNode(node: ExecutionNode) {
    this.run.nodes.push(node)
    this.emit('update')
  }

  addEdge(edge: ExecutionEdge) {
    this.run.edges.push(edge)
    this.emit('update')
  }

  removeNode(nodeId: string) {
    this.run.nodes = this.run.nodes.filter(n => n.id !== nodeId)
    this.run.edges = this.run.edges.filter(e => e.from !== nodeId && e.to !== nodeId)
    this.emit('update')
  }

  updateMemory(patch: Partial<MemoryState>) {
    Object.assign(this.run.memory, patch)
    this.emit('update')
  }

  updateContext(patch: Partial<ContextState>) {
    Object.assign(this.run.context, patch)
    this.emit('update')
  }

  pause() {
    this.run.state = 'paused'
    this.emit('pause')
  }

  resume() {
    this.run.state = 'running'
    this.emit('resume')
  }

  finish(result: string) {
    this.run.state = 'done'
    this.run.result = result
    this.emit('finish')
  }

  error(message: string) {
    this.run.state = 'error'
    this.run.result = message
    this.emit('error')
  }

  reset() {
    this.run = createEmptyRun('')
    this.emit('update')
  }

  on(event: RuntimeEvent, cb: RuntimeListener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(cb)
  }

  off(event: RuntimeEvent, cb: RuntimeListener) {
    this.listeners.get(event)?.delete(cb)
  }

  private emit(event: RuntimeEvent) {
    const cbs = this.listeners.get(event)
    if (cbs) {
      for (const cb of cbs) cb(this.run)
    }
  }
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 3: Create Runtime Zustand Slice

**Covers:** [S4]

**Files:**
- Create: `src/renderer/src/stores/slices/runtimeSlice.ts`
- Modify: `src/renderer/src/stores/useAppStore.ts`
- Modify: `src/renderer/src/stores/slices/index.ts`

- [ ] **Step 1: Create `src/renderer/src/stores/slices/runtimeSlice.ts`**

```typescript
import type { StateCreator } from 'zustand'
import type { AgentRun, ExecutionNode, ExecutionEdge, MemoryState, ContextState } from '../../../../shared/types'
import { AgentRuntime } from '../../runtime/AgentRuntime'
import type { AppState } from '../useAppStore'

export interface RuntimeSlice {
  runtime: AgentRuntime
  currentRun: AgentRun | null

  runtimeStart: (input: string) => void
  runtimeUpdateNode: (nodeId: string, patch: Partial<ExecutionNode>) => void
  runtimeAddNode: (node: ExecutionNode) => void
  runtimeAddEdge: (edge: ExecutionEdge) => void
  runtimeRemoveNode: (nodeId: string) => void
  runtimeUpdateMemory: (patch: Partial<MemoryState>) => void
  runtimeUpdateContext: (patch: Partial<ContextState>) => void
  runtimePause: () => void
  runtimeResume: () => void
  runtimeFinish: (result: string) => void
  runtimeError: (message: string) => void
  runtimeReset: () => void
}

export const createRuntimeSlice: StateCreator<AppState, [], [], RuntimeSlice> = (set, get) => {
  const runtime = new AgentRuntime()

  const sync = () => {
    set({ currentRun: { ...runtime.getRun() } })
  }

  runtime.on('start', sync)
  runtime.on('update', sync)
  runtime.on('pause', sync)
  runtime.on('resume', sync)
  runtime.on('finish', sync)
  runtime.on('error', sync)

  return {
    runtime,
    currentRun: null,

    runtimeStart: (input) => {
      runtime.start(input)
      sync()
    },
    runtimeUpdateNode: (nodeId, patch) => {
      runtime.updateNode(nodeId, patch)
      sync()
    },
    runtimeAddNode: (node) => {
      runtime.addNode(node)
      sync()
    },
    runtimeAddEdge: (edge) => {
      runtime.addEdge(edge)
      sync()
    },
    runtimeRemoveNode: (nodeId) => {
      runtime.removeNode(nodeId)
      sync()
    },
    runtimeUpdateMemory: (patch) => {
      runtime.updateMemory(patch)
      sync()
    },
    runtimeUpdateContext: (patch) => {
      runtime.updateContext(patch)
      sync()
    },
    runtimePause: () => {
      runtime.pause()
      sync()
    },
    runtimeResume: () => {
      runtime.resume()
      sync()
    },
    runtimeFinish: (result) => {
      runtime.finish(result)
      sync()
    },
    runtimeError: (message) => {
      runtime.error(message)
      sync()
    },
    runtimeReset: () => {
      runtime.reset()
      sync()
    }
  }
}
```

- [ ] **Step 2: Update `src/renderer/src/stores/useAppStore.ts`**

Add import:
```typescript
import { createRuntimeSlice, type RuntimeSlice } from './slices/runtimeSlice'
```

Add `RuntimeSlice` to the `AppState` intersection type:
```typescript
export type AppState = ProjectSlice &
  ChapterSlice &
  VersionSlice &
  UISlice &
  PolishSlice &
  SummarySlice &
  DialogueSlice &
  ContinuationSlice &
  SkillSlice &
  ReasoningSlice &
  OutlineSlice &
  ImportSlice &
  RuntimeSlice
```

Add to the store creation:
```typescript
  ...createRuntimeSlice(...a)
```

- [ ] **Step 3: Update `src/renderer/src/stores/slices/index.ts`**

Add:
```typescript
export type { RuntimeSlice } from './runtimeSlice'
```

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 4: Create ExecutionGraphView Component

**Covers:** [S5]

**Files:**
- Create: `src/renderer/src/components/dialogue/ExecutionGraphView.tsx`

- [ ] **Step 1: Create `ExecutionGraphView.tsx`**

```typescript
import { useState } from 'react'
import type { ExecutionNode, ExecutionEdge, ExecutionNodeStatus } from '../../../../shared/types'

const STATUS_COLORS: Record<ExecutionNodeStatus, string> = {
  pending: 'bg-[--nw-text-muted]',
  running: 'bg-amber-500 animate-pulse',
  done: 'bg-emerald-500',
  error: 'bg-red-500'
}

const TYPE_LABELS: Record<string, string> = {
  tool: '🔧',
  thinking: '💭',
  retrieval: '🔍',
  rewrite: '✏️'
}

function StatusDot({ status }: { status: ExecutionNodeStatus }) {
  if (status === 'running') {
    return (
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
      </span>
    )
  }
  return <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[status]}`} />
}

function ExecutionNodeView({ node }: { node: ExecutionNode }) {
  const [expanded, setExpanded] = useState(false)
  const isRunning = node.status === 'running'

  return (
    <div
      className={`
        px-3 py-2 rounded-md
        bg-[--surface-1] shadow-[0_0_0_1px_rgba(255,255,255,0.04)]
        hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08)] hover:translate-y-[-1px]
        transition-all duration-150 ease-out cursor-pointer
        ${isRunning ? 'scale-[1.02]' : ''}
      `}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2">
        <StatusDot status={node.status} />
        <span className="text-[10px]">{TYPE_LABELS[node.type] || '•'}</span>
        <span className="text-[12px] text-[--text-primary] flex-1 truncate">{node.label}</span>
        {node.startTime && node.endTime && (
          <span className="text-[10px] text-[--text-muted]">
            {((node.endTime - node.startTime) / 1000).toFixed(1)}s
          </span>
        )}
        {node.metadata?.tokens && (
          <span className="text-[10px] text-[--text-muted]">
            {node.metadata.tokens} tok
          </span>
        )}
      </div>
      {expanded && node.output && (
        <div className="text-[11px] text-[--text-muted] mt-1.5 pl-6 max-h-24 overflow-y-auto">
          {typeof node.output === 'string'
            ? node.output.slice(0, 200) + (node.output.length > 200 ? '...' : '')
            : JSON.stringify(node.output).slice(0, 200)}
        </div>
      )}
    </div>
  )
}

function ExecutionEdgeView({ fromNode, toNode }: { fromNode?: ExecutionNode; toNode?: ExecutionNode }) {
  if (!fromNode || !toNode) return null
  return (
    <div className="flex items-center justify-center py-0.5">
      <div className="w-px h-3 bg-white/10" />
    </div>
  )
}

export default function ExecutionGraphView({ nodes, edges }: { nodes: ExecutionNode[]; edges: ExecutionEdge[] }) {
  const [collapsed, setCollapsed] = useState(false)

  if (nodes.length === 0) return null

  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const activeCount = nodes.filter(n => n.status === 'running').length
  const doneCount = nodes.filter(n => n.status === 'done').length

  return (
    <div className="rounded-md bg-[--surface-1] shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3 py-2 text-[11px] text-[--text-muted] hover:text-[--text-secondary] transition-colors duration-150"
      >
        <div className="flex items-center gap-2">
          {activeCount > 0 ? (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          )}
          <span>执行图</span>
          <span className="text-[10px] text-[--text-muted]">
            {doneCount}/{nodes.length}
          </span>
        </div>
        <svg className={`w-3 h-3 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {!collapsed && (
        <div className="px-3 pb-2 space-y-0">
          {nodes.map((node, idx) => (
            <div key={node.id}>
              <ExecutionNodeView node={node} />
              {idx < nodes.length - 1 && (
                <ExecutionEdgeView
                  fromNode={node}
                  toNode={nodes[idx + 1]}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 5: Create MemoryPanel Component

**Covers:** [S5]

**Files:**
- Create: `src/renderer/src/components/dialogue/MemoryPanel.tsx`

- [ ] **Step 1: Create `MemoryPanel.tsx`**

```typescript
import { useState } from 'react'
import type { MemoryState } from '../../../../shared/types'

export default function MemoryPanel({ memory }: { memory: MemoryState }) {
  const [collapsed, setCollapsed] = useState(false)
  const [showLongTerm, setShowLongTerm] = useState(false)

  const hasContent = memory.shortTerm.length > 0 || memory.longTerm.length > 0
  if (!hasContent) return null

  return (
    <div className="rounded-md bg-[--surface-1] shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3 py-2 text-[11px] text-[--text-muted] hover:text-[--text-secondary] transition-colors duration-150"
      >
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          <span>记忆</span>
          <span className="text-[10px] text-[--text-muted]">
            {memory.shortTerm.length + memory.longTerm.length} 条
          </span>
        </div>
        <svg className={`w-3 h-3 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {!collapsed && (
        <div className="px-3 pb-2 space-y-2">
          {/* Short-term */}
          <div>
            <p className="text-[10px] text-[--text-muted] mb-1">短期记忆</p>
            {memory.shortTerm.length > 0 ? (
              <div className="space-y-0.5">
                {memory.shortTerm.slice(-5).map((m, i) => (
                  <div key={i} className="text-[11px] text-[--text-secondary] truncate px-2 py-0.5 rounded bg-[--surface-2]">
                    {m}
                  </div>
                ))}
                {memory.shortTerm.length > 5 && (
                  <p className="text-[9px] text-[--text-muted] pl-2">+{memory.shortTerm.length - 5} 更多</p>
                )}
              </div>
            ) : (
              <p className="text-[10px] text-[--text-muted] italic">暂无</p>
            )}
          </div>

          {/* Long-term toggle */}
          {memory.longTerm.length > 0 && (
            <div>
              <button
                onClick={() => setShowLongTerm(!showLongTerm)}
                className="text-[10px] text-[--text-muted] hover:text-[--text-secondary] transition-colors"
              >
                长期记忆 ({memory.longTerm.length}) {showLongTerm ? '▾' : '▸'}
              </button>
              {showLongTerm && (
                <div className="mt-1 space-y-0.5">
                  {memory.longTerm.slice(-5).map((m, i) => (
                    <div key={i} className="text-[11px] text-[--text-secondary] truncate px-2 py-0.5 rounded bg-[--surface-2]">
                      {m}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 6: Create InspectorPanel Component

**Covers:** [S5]

**Files:**
- Create: `src/renderer/src/components/dialogue/InspectorPanel.tsx`

- [ ] **Step 1: Create `InspectorPanel.tsx`**

```typescript
import type { AgentRun, AgentRunState } from '../../../../shared/types'

const STATE_LABELS: Record<AgentRunState, string> = {
  idle: '空闲',
  running: '运行中',
  paused: '已暂停',
  done: '已完成',
  error: '错误'
}

const STATE_COLORS: Record<AgentRunState, string> = {
  idle: 'text-[--text-muted]',
  running: 'text-amber-400',
  paused: 'text-yellow-400',
  done: 'text-emerald-400',
  error: 'text-red-400'
}

function ContextBar({ used, total }: { used: number; total: number }) {
  const percent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  const barColor = percent > 90 ? 'bg-red-500' : percent > 70 ? 'bg-yellow-500' : 'bg-blue-500'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[--text-muted]">上下文</span>
        <span className="text-[10px] text-[--text-muted]">
          {used.toLocaleString()} / {total.toLocaleString()} tok
        </span>
      </div>
      <div className="h-1 bg-[--surface-2] rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all duration-300`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

export default function InspectorPanel({ run }: { run: AgentRun }) {
  const activeNodes = run.nodes.filter(n => n.status === 'running').length
  const doneNodes = run.nodes.filter(n => n.status === 'done').length
  const totalTokens = run.nodes.reduce((sum, n) => sum + (n.metadata?.tokens ?? 0), 0)

  return (
    <div className="rounded-md bg-[--surface-1] shadow-[0_0_0_1px_rgba(255,255,255,0.04)] p-3 space-y-2.5">
      {/* State row */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[--text-muted]">状态</span>
        <span className={`text-[11px] font-medium ${STATE_COLORS[run.state]}`}>
          {STATE_LABELS[run.state]}
        </span>
      </div>

      {/* Node stats */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[--text-muted]">节点</span>
        <span className="text-[11px] text-[--text-secondary]">
          {doneNodes}/{run.nodes.length}
          {activeNodes > 0 && <span className="text-amber-400 ml-1">({activeNodes} 运行中)</span>}
        </span>
      </div>

      {/* Total tokens */}
      {totalTokens > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[--text-muted]">Tokens</span>
          <span className="text-[11px] text-[--text-secondary]">{totalTokens.toLocaleString()}</span>
        </div>
      )}

      {/* Compression ratio */}
      {run.context.compressionRatio < 1 && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[--text-muted]">压缩率</span>
          <span className="text-[11px] text-[--text-secondary]">
            {(run.context.compressionRatio * 100).toFixed(0)}%
          </span>
        </div>
      )}

      {/* Context bar */}
      <ContextBar used={run.context.usedTokens} total={run.context.windowSize} />
    </div>
  )
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 7: Create CommandCenter Component

**Covers:** [S5]

**Files:**
- Create: `src/renderer/src/components/dialogue/CommandCenter.tsx`

- [ ] **Step 1: Create `CommandCenter.tsx`**

```typescript
import type { AgentRunState } from '../../../../shared/types'

const STATE_BADGES: Record<AgentRunState, { label: string; color: string }> = {
  idle: { label: '就绪', color: 'bg-[--surface-2] text-[--text-muted]' },
  running: { label: '运行中', color: 'bg-amber-500/20 text-amber-400' },
  paused: { label: '已暂停', color: 'bg-yellow-500/20 text-yellow-400' },
  done: { label: '已完成', color: 'bg-emerald-500/20 text-emerald-400' },
  error: { label: '错误', color: 'bg-red-500/20 text-red-400' }
}

export default function CommandCenter({
  runState,
  onPause,
  onResume,
  children
}: {
  runState: AgentRunState
  onPause?: () => void
  onResume?: () => void
  children: React.ReactNode
}) {
  const badge = STATE_BADGES[runState]

  return (
    <div className="border-t border-white/5 p-3 bg-[--surface-1]">
      {/* State badge + controls */}
      {runState !== 'idle' && (
        <div className="flex items-center justify-between mb-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${badge.color}`}>
            {badge.label}
          </span>
          <div className="flex gap-1.5">
            {runState === 'running' && onPause && (
              <button
                onClick={onPause}
                className="text-[10px] text-[--text-muted] hover:text-yellow-400 px-2 py-0.5 rounded hover:bg-yellow-500/10 transition-colors"
              >
                暂停
              </button>
            )}
            {runState === 'paused' && onResume && (
              <button
                onClick={onResume}
                className="text-[10px] text-[--text-muted] hover:text-emerald-400 px-2 py-0.5 rounded hover:bg-emerald-500/10 transition-colors"
              >
                继续
              </button>
            )}
          </div>
        </div>
      )}

      {/* Input area (children = existing InputDock content) */}
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 8: Integrate v3 Components into DialoguePanel

**Covers:** [S5]

**Files:**
- Modify: `src/renderer/src/components/dialogue-panel/DialoguePanel.tsx`
- Modify: `src/renderer/src/components/dialogue/index.ts`

- [ ] **Step 1: Update `dialogue/index.ts` — add new exports**

Add:
```typescript
export { default as ExecutionGraphView } from './ExecutionGraphView'
export { default as MemoryPanel } from './MemoryPanel'
export { default as InspectorPanel } from './InspectorPanel'
export { default as CommandCenter } from './CommandCenter'
```

- [ ] **Step 2: Update DialoguePanel — import new components**

Add imports at the top of `DialoguePanel.tsx`:
```typescript
import ExecutionGraphView from '../dialogue/ExecutionGraphView'
import MemoryPanel from '../dialogue/MemoryPanel'
import InspectorPanel from '../dialogue/InspectorPanel'
import CommandCenter from '../dialogue/CommandCenter'
```

- [ ] **Step 3: Update DialoguePanel — wire runtime state**

In the `DialoguePanel` component function, add runtime state from the store:
```typescript
const { currentRun, runtimePause, runtimeResume } = useAppStore()
```

- [ ] **Step 4: Replace ExecutionTimeline with ExecutionGraphView**

Replace the EXECUTION LAYER section (lines ~673-688) with:
```typescript
{/* EXECUTION LAYER — v3 Graph */}
{(streamingToolCalls.length > 0 || pendingApprovals.length > 0) && (
  <div className="border-t border-[--nw-border] px-4 py-2">
    <ExecutionGraphView
      nodes={currentRun?.nodes ?? []}
      edges={currentRun?.edges ?? []}
    />
    {pendingApprovals
      .filter(a => !streamingToolCalls.some(tc => tc.id === a.toolCallId))
      .map(a => (
        <PendingApprovalCard key={a.approvalId} approval={a} onApprove={approveTool} />
      ))}
  </div>
)}
```

- [ ] **Step 5: Replace SystemInspector with MemoryPanel + InspectorPanel**

Replace the SYSTEM INSPECTOR section (lines ~690-694) with:
```typescript
{/* SYSTEM INSPECTOR — v3 */}
{currentRun && (
  <div className="border-t border-[--nw-border] px-4 py-2 space-y-2">
    <InspectorPanel run={currentRun} />
    <MemoryPanel memory={currentRun.memory} />
    <AgentFlowPanel />
    <AgentTrajectoryPanel />
    <RewriteApprovalCard />
  </div>
)}
```

- [ ] **Step 6: Wrap InputDock with CommandCenter**

Replace the INPUT DOCK section (lines ~697-714) with:
```typescript
{/* INPUT DOCK — v3 CommandCenter */}
<CommandCenter
  runState={currentRun?.state ?? 'idle'}
  onPause={runtimePause}
  onResume={runtimeResume}
>
  <InputDock
    input={input}
    setInput={setInput}
    onSend={handleSend}
    onKeyDown={handleKeyDown}
    isStreaming={isStreaming}
    selectedChains={selectedChains}
    onRemoveChain={handleRemoveChain}
    onToggleChain={handleToggleChain}
    showChainSelector={showChainSelector}
    setShowChainSelector={setShowChainSelector}
    reasoningChains={reasoningChains}
    chainSelectorRef={chainSelectorRef as React.RefObject<HTMLDivElement>}
    showQuickReplies={showQuickReplies}
    questionGroups={questionGroups}
    onQuickReply={handleQuickReply}
    cancelStream={cancelDialogueStream}
  />
</CommandCenter>
```

- [ ] **Step 7: Verify types compile**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 8: Verify build**

Run: `npm run build`
Expected: Build succeeds

---

### Task 9: Update Design System Doc to v3

**Covers:** [S1]

**Files:**
- Modify: `docs/ui-design-system.md`

- [ ] **Step 1: Update version header and core concept**

Change the header from `v2.0` to `v3.0` and update the core concept:
```markdown
# AI Agent Design System v3.0（Runtime Grade）

> From Agent OS Interface → AI Runtime Visualization System

## 0. 核心升级思想

v1 → 是"规则集合"
v2 → 是"可执行系统"
v3 → 是"运行时可视化"

v3 的本质：
```
UI = Runtime + Execution Graph + Memory + Inspector
```

你不再做聊天 UI，你在做 AI runtime visualization system
```

- [ ] **Step 2: Add v3 Runtime Types section**

After the existing token system section, add:
```markdown
## 2. v3 Runtime Types

### 2.1 AgentRun（核心运行状态）

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

### 2.2 ExecutionNode（AI 运行单元）

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

### 2.3 ExecutionEdge（AI 思维流）

```typescript
interface ExecutionEdge { from: string; to: string }
```

### 2.4 MemoryState（AI 记忆系统）

```typescript
interface MemoryState { shortTerm: string[]; longTerm: string[]; embeddings?: number[] }
```

### 2.5 ContextState（上下文压缩）

```typescript
interface ContextState { windowSize: number; usedTokens: number; compressionRatio: number }
```
```

- [ ] **Step 3: Add v3 UI Components section**

Add:
```markdown
## 3. v3 UI Components

### 3.1 ExecutionGraphView
- DAG 可视化，替代 flat timeline
- 每个 node = 一个 AI step
- StatusDot 驱动状态色
- Running node: `scale-[1.02]` + pulse

### 3.2 MemoryPanel
- 短期记忆 + 长期记忆
- 折叠/展开

### 3.3 InspectorPanel
- 状态、节点数、tokens、上下文进度条

### 3.4 CommandCenter
- 运行状态 badge + 暂停/继续控制
```

- [ ] **Step 4: Verify no markdown syntax errors**

Read the updated file and confirm structure is clean.
