import type OpenAI from 'openai'

export const reasoningToolDefinitions: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'list_reasoning_chains',
      description: '查看所有可用的推理链及其详情。只读操作，无需用户确认。',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_reasoning_chain',
      description: '创建新的推理链。需要用户确认后执行。',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '推理链名称' },
          description: { type: 'string', description: '推理链描述' },
          trigger: { type: 'string', description: '触发方式', enum: ['auto', 'manual', 'both'] },
          steps: { type: 'string', description: '推理步骤（JSON 数组格式，每个元素包含 name 和 prompt）' },
          includeInContext: { type: 'string', description: '是否纳入上下文（true/false）' }
        },
        required: ['name', 'steps']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_reasoning_chain',
      description: '更新已有推理链。需要用户确认后执行。',
      parameters: {
        type: 'object',
        properties: {
          chainId: { type: 'string', description: '推理链 ID' },
          name: { type: 'string', description: '新的推理链名称' },
          description: { type: 'string', description: '新的推理链描述' },
          trigger: { type: 'string', description: '新的触发方式', enum: ['auto', 'manual', 'both'] },
          steps: { type: 'string', description: '新的推理步骤（JSON 数组格式）' },
          includeInContext: { type: 'string', description: '是否纳入上下文（true/false）' }
        },
        required: ['chainId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_reasoning_chain',
      description: '删除指定推理链。需要用户确认后执行。',
      parameters: {
        type: 'object',
        properties: {
          chainId: { type: 'string', description: '推理链 ID' }
        },
        required: ['chainId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'toggle_reasoning_context',
      description: '临时启用或禁用推理链结果纳入上下文。仅对当前对话会话生效。',
      parameters: {
        type: 'object',
        properties: {
          chainId: { type: 'string', description: '推理链 ID' },
          includeInContext: { type: 'string', description: '是否纳入上下文（true/false）' }
        },
        required: ['chainId', 'includeInContext']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'bind_reasoning_to_tool',
      description: '将推理链绑定到指定工具，执行该工具前会自动执行推理。需要用户确认后执行。',
      parameters: {
        type: 'object',
        properties: {
          toolName: { type: 'string', description: '工具名称' },
          chainId: { type: 'string', description: '推理链 ID（留空则解绑）' }
        },
        required: ['toolName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_tool_bindings',
      description: '查看所有工具与推理链的绑定关系。只读操作，无需用户确认。',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  }
]
