import type { AgentExecutionContext } from '../../shared/types'
import { callLLMSync } from './base-agent'

const EDITOR_SYSTEM_PROMPT = `你是一位资深的文学编辑。你的任务是对写作内容进行专业的编辑和润色。

编辑要求：
- 修正语法和用词错误
- 提升表达的准确性和生动性
- 统一文风和语气
- 优化句式结构
- 保持原文的核心意思和风格

你必须以严格的 JSON 格式返回结果，不要包含任何其他文字。

JSON 格式：
{
  "editedContent": "编辑后的内容",
  "changes": [
    {
      "type": "fix|improve|style|structure",
      "original": "原文片段",
      "edited": "修改后片段",
      "reason": "修改原因"
    }
  ],
  "summary": "编辑总结"
}`

export interface EditorParams {
  content: string
  instruction?: string
  context: AgentExecutionContext
}

export interface EditorResult {
  editedContent: string
  changes: Array<{
    type: 'fix' | 'improve' | 'style' | 'structure'
    original: string
    edited: string
    reason: string
  }>
  summary: string
}

export async function executeEditor(params: EditorParams): Promise<EditorResult> {
  const { content, instruction, context } = params
  const { config, taskContext, signal } = context

  const contextParts: string[] = []
  if (taskContext.outline) {
    contextParts.push(`## 大纲\n${taskContext.outline}`)
  }
  if (taskContext.styleProfile) {
    contextParts.push(`## 文风要求\n${taskContext.styleProfile}`)
  }

  const userPrompt = `${contextParts.length > 0 ? contextParts.join('\n\n') + '\n\n' : ''}${instruction ? `## 编辑要求\n${instruction}\n\n` : ''}## 待编辑内容\n${content}

请对以上内容进行编辑，并以 JSON 格式返回结果。`

  const result = await callLLMSync({
    config,
    messages: [
      { role: 'system', content: EDITOR_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.3,
    signal
  })

  return parseEditorResult(result.content, content)
}

function parseEditorResult(raw: string, originalContent: string): EditorResult {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { editedContent: originalContent, changes: [], summary: '编辑结果解析失败' }
    }
    const parsed = JSON.parse(jsonMatch[0])
    return {
      editedContent: parsed.editedContent || originalContent,
      changes: Array.isArray(parsed.changes) ? parsed.changes : [],
      summary: parsed.summary || ''
    }
  } catch {
    return { editedContent: originalContent, changes: [], summary: '编辑结果 JSON 解析失败' }
  }
}
