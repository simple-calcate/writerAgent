import type OpenAI from 'openai'

export const skillToolDefinitions: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'extract_skill',
      description: '从当前对话或章节中提取写作技能。需要用户确认后执行。',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '技能名称' },
          category: { type: 'string', description: '技能分类', enum: ['scene', 'dialogue', 'pacing', 'formatting', 'style', 'character', 'custom'] },
          content: { type: 'string', description: '技能内容（写作技巧描述）' },
          source: { type: 'string', description: '技能来源（可选）' }
        },
        required: ['name', 'category', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'refine_skill',
      description: '修正或完善已有写作技能的内容。需要用户确认后执行。',
      parameters: {
        type: 'object',
        properties: {
          skillId: { type: 'string', description: '技能 ID' },
          content: { type: 'string', description: '修正后的技能内容' },
          reason: { type: 'string', description: '修正理由（可选）' }
        },
        required: ['skillId', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_skills',
      description: '查看所有写作技能及其在各功能上的挂载状态。只读操作，无需用户确认。',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'toggle_feature_skill',
      description: '调整技能在指定功能上的挂载状态。需要用户确认后执行。',
      parameters: {
        type: 'object',
        properties: {
          skillId: { type: 'string', description: '技能 ID' },
          feature: { type: 'string', description: '目标功能', enum: ['dialogue', 'polish', 'summary', 'continuation', 'outline', 'chapterContent'] },
          enabled: { type: 'string', description: '启用或禁用（true/false）' }
        },
        required: ['skillId', 'feature', 'enabled']
      }
    }
  }
]
