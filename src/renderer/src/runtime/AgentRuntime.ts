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
