import type {
  MultiAgentRun, MultiAgentRunState, AgentInstance, MARole, AgentStatus,
  ExecutionNode, ExecutionEdge, ExecutionGraph, GlobalMemory, ExecutionTimeline
} from '../../../shared/types'

type MARuntimeEvent = 'dispatch' | 'memory_update' | 'conflict' | 'pause' | 'resume' | 'replay' | 'finish' | 'update'
type MARuntimeListener = (run: MultiAgentRun) => void

let runCounter = 0

function createAgent(id: string, role: MARole): AgentInstance {
  return { id, role, status: 'idle', graph: { nodes: [], edges: [] } }
}

function createEmptyMARun(roles: MARole[]): MultiAgentRun {
  return {
    id: `marun-${Date.now()}-${++runCounter}`,
    agents: roles.map((role, i) => createAgent(`agent-${i}`, role)),
    sharedMemory: { facts: [], decisions: [], conflictLog: [] },
    timeline: [],
    state: 'running'
  }
}

export class MultiAgentRuntime {
  private run: MultiAgentRun
  private listeners = new Map<MARuntimeEvent, Set<MARuntimeListener>>()

  constructor(existingRun?: MultiAgentRun) {
    this.run = existingRun ?? createEmptyMARun(['planner', 'executor', 'critic'])
  }

  getRun(): MultiAgentRun {
    return this.run
  }

  getAgent(agentId: string): AgentInstance | undefined {
    return this.run.agents.find(a => a.id === agentId)
  }

  start(roles?: MARole[]) {
    this.run = createEmptyMARun(roles ?? ['planner', 'executor', 'critic'])
    this.emit('update')
  }

  dispatch(agentId: string, node: ExecutionNode) {
    const agent = this.run.agents.find(a => a.id === agentId)
    if (!agent) return
    agent.graph.nodes.push(node)
    agent.currentNodeId = node.id
    agent.status = 'active'
    this.run.timeline.push({ agentId, nodes: [node], timestamp: Date.now() })
    this.emit('dispatch')
  }

  addEdge(agentId: string, edge: ExecutionEdge) {
    const agent = this.run.agents.find(a => a.id === agentId)
    if (!agent) return
    agent.graph.edges.push(edge)
    this.emit('update')
  }

  updateNode(agentId: string, nodeId: string, patch: Partial<ExecutionNode>) {
    const agent = this.run.agents.find(a => a.id === agentId)
    if (!agent) return
    const node = agent.graph.nodes.find(n => n.id === nodeId)
    if (!node) return
    Object.assign(node, patch)
    if (patch.status === 'done' || patch.status === 'error') {
      agent.currentNodeId = undefined
      if (!agent.graph.nodes.some(n => n.status === 'running')) {
        agent.status = 'idle'
      }
    }
    this.emit('update')
  }

  setAgentStatus(agentId: string, status: AgentStatus) {
    const agent = this.run.agents.find(a => a.id === agentId)
    if (!agent) return
    agent.status = status
    this.emit('update')
  }

  updateMemory(fact: string) {
    this.run.sharedMemory.facts.push(fact)
    this.emit('memory_update')
  }

  logDecision(decision: string) {
    this.run.sharedMemory.decisions.push(decision)
    this.emit('memory_update')
  }

  logConflict(conflict: string) {
    this.run.sharedMemory.conflictLog.push(conflict)
    this.emit('conflict')
  }

  pause() {
    this.run.state = 'paused'
    this.emit('pause')
  }

  resume() {
    this.run.state = 'running'
    this.emit('resume')
  }

  replay(agentId?: string) {
    this.run.state = 'replaying'
    if (agentId) {
      const agent = this.run.agents.find(a => a.id === agentId)
      if (agent) {
        agent.graph.nodes = []
        agent.graph.edges = []
        agent.currentNodeId = undefined
        agent.status = 'idle'
      }
    }
    this.emit('replay')
  }

  finish() {
    this.run.state = 'done'
    for (const agent of this.run.agents) {
      agent.status = 'idle'
      agent.currentNodeId = undefined
    }
    this.emit('finish')
  }

  on(event: MARuntimeEvent, cb: MARuntimeListener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(cb)
  }

  off(event: MARuntimeEvent, cb: MARuntimeListener) {
    this.listeners.get(event)?.delete(cb)
  }

  private emit(event: MARuntimeEvent) {
    const cbs = this.listeners.get(event)
    if (cbs) for (const cb of cbs) cb(this.run)
  }
}
