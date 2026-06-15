import type OpenAI from 'openai'

export const outlineToolDefinitions: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'write_outline',
      description: '撰写或更新书籍大纲（Markdown 格式）。需要用户确认后执行。',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: '大纲内容（Markdown 格式）' }
        },
        required: ['content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_volume_outline',
      description: '撰写或更新指定卷的卷纲（Markdown 格式）。需要用户确认后执行。',
      parameters: {
        type: 'object',
        properties: {
          volumeId: { type: 'string', description: '卷 ID' },
          content: { type: 'string', description: '卷纲内容（Markdown 格式）' }
        },
        required: ['volumeId', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_chapter_outline',
      description: '撰写或更新指定章节的章纲（Markdown 格式）。需要用户确认后执行。',
      parameters: {
        type: 'object',
        properties: {
          chapterId: { type: 'string', description: '章节 ID' },
          content: { type: 'string', description: '章纲内容（Markdown 格式）' }
        },
        required: ['chapterId', 'content']
      }
    }
  }
]
