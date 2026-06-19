import type { SubTask, AgentIntent, AgentExecutionContext } from '../../shared/types'
import { callLLMSync } from './base-agent'

const PLANNER_SYSTEM_PROMPT = `你是一位专业的写作策划师。你的任务是理解用户的写作意图，将复杂的写作请求拆解为可执行的子任务。

你必须以严格的 JSON 格式返回结果，不要包含任何其他文字。

JSON 格式：
{
  "intent": "write|plan|critique|edit|chat|research|continue|summarize|revise",
  "description": "对整体任务的简要描述",
  "subTasks": [
    {
      "id": "task_1",
      "description": "子任务描述",
      "agentRole": "planner|writer|critic|editor|researcher",
      "priority": 1,
      "dependsOn": []
    }
  ]
}

子任务拆解原则：
- 每个子任务应该是一个独立可执行的单元
- 明确指定由哪个 agent 角色执行
- 用 priority 表示执行优先级（数字越小越优先）
- 用 dependsOn 表示依赖关系
- 对于简单请求，可以只有一个子任务

意图识别规则：
- write：生成新的小说内容
- plan：规划大纲、结构设计
- critique：评估、评分已有内容
- edit：润色、修改已有内容
- chat：普通对话问答
- research：查找资料、设定检查
- continue：续写已有内容
- summarize：生成摘要
- revise：根据评审意见修改`

interface PlanResult {
  intent: AgentIntent
  description: string
  subTasks: SubTask[]
}

export async function executePlanner(
  userRequest: string,
  context: AgentExecutionContext
): Promise<PlanResult> {
  const { config, taskContext, signal } = context

  const contextParts: string[] = []
  if (taskContext.outline) {
    contextParts.push(`## 大纲\n${taskContext.outline}`)
  }
  if (taskContext.currentContent) {
    contextParts.push(`## 当前内容（前 2000 字）\n${taskContext.currentContent.substring(0, 2000)}`)
  }
  if (taskContext.previousSummaries && taskContext.previousSummaries.length > 0) {
    contextParts.push(`## 前文摘要\n${taskContext.previousSummaries.join('\n')}`)
  }

  const userPrompt = `用户请求：${userRequest}

${contextParts.length > 0 ? contextParts.join('\n\n') + '\n\n' : ''}请分析用户意图，拆解为子任务，并以 JSON 格式返回。`

  const result = await callLLMSync({
    config,
    messages: [
      { role: 'system', content: PLANNER_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.3,
    signal
  })

  return parsePlanResult(result.content)
}

function parsePlanResult(raw: string): PlanResult {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return createDefaultPlan(raw)
    }
    const parsed = JSON.parse(jsonMatch[0])
    return {
      intent: validIntent(parsed.intent),
      description: parsed.description || '写作任务',
      subTasks: Array.isArray(parsed.subTasks)
        ? parsed.subTasks.map((st: any, i: number) => ({
            id: st.id || `task_${i + 1}`,
            description: st.description || '',
            agentRole: validAgentRole(st.agentRole),
            priority: typeof st.priority === 'number' ? st.priority : i + 1,
            dependsOn: Array.isArray(st.dependsOn) ? st.dependsOn : [],
            status: 'pending' as const
          }))
        : [createDefaultSubTask(raw)]
    }
  } catch {
    return createDefaultPlan(raw)
  }
}

function validIntent(val: unknown): AgentIntent {
  const valid: AgentIntent[] = ['write', 'plan', 'critique', 'edit', 'chat', 'research', 'continue', 'summarize', 'revise']
  return valid.includes(val as AgentIntent) ? (val as AgentIntent) : 'chat'
}

function validAgentRole(val: unknown): SubTask['agentRole'] {
  const valid: SubTask['agentRole'][] = ['planner', 'writer', 'critic', 'editor', 'researcher']
  return valid.includes(val as SubTask['agentRole']) ? (val as SubTask['agentRole']) : 'writer'
}

function createDefaultSubTask(content: string): SubTask {
  return {
    id: 'task_1',
    description: content.substring(0, 200),
    agentRole: 'writer',
    priority: 1,
    dependsOn: [],
    status: 'pending'
  }
}

function createDefaultPlan(content: string): PlanResult {
  return {
    intent: 'chat',
    description: '直接对话',
    subTasks: [createDefaultSubTask(content)]
  }
}
