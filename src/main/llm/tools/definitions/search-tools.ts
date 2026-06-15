import type OpenAI from 'openai'

export const searchToolDefinitions: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: '搜索互联网获取实时信息。用于查找最新资料、事实核查、参考资料等。返回搜索结果的标题、URL 和摘要。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '搜索关键词' },
          count: { type: 'number', description: '返回结果数量，默认5，最大10' }
        },
        required: ['query']
      }
    }
  }
]
