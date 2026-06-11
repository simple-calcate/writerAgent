import type OpenAI from 'openai'

export function getDialogueTools(): OpenAI.ChatCompletionTool[] {
  return [
    {
      type: 'function',
      function: {
        name: 'summarize_chapter',
        description: '对指定章节进行结构化摘要，按人物、事件、伏笔、场景、情感五个维度分析。如果章节已有缓存摘要，会询问用户是否刷新。',
        parameters: {
          type: 'object',
          properties: {
            chapterId: { type: 'string', description: '章节 ID' }
          },
          required: ['chapterId']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'refine_summary',
        description: '用一段话精炼概括指定章节的核心情节，适合快速了解章节内容。如果章节已有缓存摘要，会询问用户是否使用缓存。',
        parameters: {
          type: 'object',
          properties: {
            chapterId: { type: 'string', description: '章节 ID' }
          },
          required: ['chapterId']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'polish_text',
        description: '润色指定文本片段，改善用词、句式和描写生动度',
        parameters: {
          type: 'object',
          properties: {
            chapterId: { type: 'string', description: '章节 ID（用于获取上下文风格）' },
            text: { type: 'string', description: '需要润色的文本片段' }
          },
          required: ['chapterId', 'text']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'create_chapter',
        description: '创建一个新章节。需要用户确认后执行。注意：必须先有卷才能创建章节，如果当前没有卷，请先使用 create_volume 创建卷。',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: '章节标题' },
            volumeId: { type: 'string', description: '所属卷 ID（必填，先用 create_volume 创建卷）' }
          },
          required: ['title', 'volumeId']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'create_volume',
        description: '创建一个新卷。当还没有卷时，必须先创建卷再创建章节。',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '卷名称' }
          },
          required: ['name']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'rename_chapter',
        description: '重命名指定章节。需要用户确认后执行。',
        parameters: {
          type: 'object',
          properties: {
            chapterId: { type: 'string', description: '章节 ID' },
            newTitle: { type: 'string', description: '新的章节标题' }
          },
          required: ['chapterId', 'newTitle']
        }
      }
    },
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
    },
    {
      type: 'function',
      function: {
        name: 'read_chapter_content',
        description: '读取指定章节的完整正文内容。需要用户确认后执行。当你需要查看某个章节的具体内容来给出建议时使用。',
        parameters: {
          type: 'object',
          properties: {
            chapterId: { type: 'string', description: '章节 ID' }
          },
          required: ['chapterId']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'write_chapter_content',
        description: '根据大纲、章纲或作者的想法，为指定章节撰写完整正文内容。始终需要用户确认。如果章节已有内容，会提示用户确认覆盖。撰写前应先了解章节大纲和上下文。',
        parameters: {
          type: 'object',
          properties: {
            chapterId: { type: 'string', description: '章节 ID' },
            content: { type: 'string', description: '要写入的章节正文内容' }
          },
          required: ['chapterId', 'content']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'extract_skill',
        description: '从当前章节内容中提取可复用的写作技能。分析章节中值得学习的写作模式（如场景描写、对话风格、节奏把控等），保存为技能供其他书籍使用。需要用户确认后执行。',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '技能名称，如"都市打斗场景写法"' },
            category: { type: 'string', enum: ['scene', 'dialogue', 'pacing', 'formatting', 'style', 'character', 'structure', 'custom'], description: '技能分类' },
            content: { type: 'string', description: '结构化的写作指导内容，包含具体规则和示例' },
            source: { type: 'string', description: '来源说明，如"提取自《xxx》第三章"' }
          },
          required: ['name', 'category', 'content']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'refine_skill',
        description: '根据实际写作内容修正已有写作技能。对比技能描述和实际章节内容，更新技能使其更准确。需要用户确认后执行。先用 read_chapter_content 读取相关章节作为参考。',
        parameters: {
          type: 'object',
          properties: {
            skillId: { type: 'string', description: '要修正的技能 ID' },
            content: { type: 'string', description: '修正后的技能内容' },
            reason: { type: 'string', description: '修正理由' }
          },
          required: ['skillId', 'content']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'list_skills',
        description: '查看所有写作技能列表及其在各 AI 功能上的挂载状态。返回技能的 ID、名称、分类、是否内置、以及在对话/润色/摘要/续写四个功能上的启用状态。只读操作，无需用户确认。',
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
        description: '调整写作技能在指定 AI 功能上的挂载状态（启用或禁用）。需要用户确认后执行。可以用来为某个功能添加或移除特定的写作风格技能。',
        parameters: {
          type: 'object',
          properties: {
            skillId: { type: 'string', description: '技能 ID' },
            feature: { type: 'string', enum: ['dialogue', 'polish', 'summary', 'continuation', 'outline', 'chapterContent'], description: '目标功能：dialogue(AI对话)、polish(智能润色)、summary(章节摘要)、continuation(智能续写)、outline(大纲撰写)、chapterContent(正文撰写)' },
            enabled: { type: 'boolean', description: 'true 为启用（挂载），false 为禁用（卸载）' }
          },
          required: ['skillId', 'feature', 'enabled']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'batch_refine_summaries',
        description: '对指定卷的所有章节进行批量精炼总结（一段话概括核心情节）。适合快速了解整卷内容。需要用户确认后执行。',
        parameters: {
          type: 'object',
          properties: {
            volumeId: { type: 'string', description: '卷 ID（可选，不传则使用当前对话的卷）' }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'list_reasoning_chains',
        description: '列出所有可用的推理链。推理链是预定义的思考流程，帮助 AI 在执行特定任务时进行系统性分析。只读操作，无需用户确认。',
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
        description: '创建一个新的推理链。推理链定义了 AI 在执行特定任务时的思考流程。需要用户确认后执行。',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '推理链名称' },
            description: { type: 'string', description: '推理链描述' },
            trigger: { type: 'string', enum: ['auto', 'manual'], description: '触发方式' },
            steps: {
              type: 'array',
              description: '推理步骤列表',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: '步骤名称' },
                  prompt: { type: 'string', description: '步骤提示词' }
                },
                required: ['name', 'prompt']
              }
            },
            includeInContext: { type: 'boolean', description: '推理结果是否纳入上下文' }
          },
          required: ['name', 'steps']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'update_reasoning_chain',
        description: '修改现有推理链的配置。需要用户确认后执行。',
        parameters: {
          type: 'object',
          properties: {
            chainId: { type: 'string', description: '要修改的推理链 ID' },
            name: { type: 'string', description: '新的名称' },
            description: { type: 'string', description: '新的描述' },
            trigger: { type: 'string', enum: ['auto', 'manual'], description: '新的触发方式' },
            steps: {
              type: 'array',
              description: '新的推理步骤列表',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: '步骤名称' },
                  prompt: { type: 'string', description: '步骤提示词' }
                },
                required: ['name', 'prompt']
              }
            },
            includeInContext: { type: 'boolean', description: '推理结果是否纳入上下文' }
          },
          required: ['chainId']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'delete_reasoning_chain',
        description: '删除指定的推理链。内置推理链无法删除。需要用户确认后执行。',
        parameters: {
          type: 'object',
          properties: {
            chainId: { type: 'string', description: '要删除的推理链 ID' }
          },
          required: ['chainId']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'toggle_reasoning_context',
        description: '切换推理结果是否纳入对话上下文。启用后，推理分析结果会注入到系统提示词中，供后续对话参考。需要用户确认后执行。',
        parameters: {
          type: 'object',
          properties: {
            chainId: { type: 'string', description: '推理链 ID' },
            includeInContext: { type: 'boolean', description: 'true 为纳入上下文，false 为不纳入' }
          },
          required: ['chainId', 'includeInContext']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'bind_reasoning_to_tool',
        description: '将推理链绑定到指定工具。绑定后，执行该工具前会自动执行推理链。需要用户确认后执行。',
        parameters: {
          type: 'object',
          properties: {
            toolName: {
              type: 'string',
              enum: ['write_chapter_content', 'write_chapter_outline', 'write_volume_outline', 'write_outline'],
              description: '要绑定的工具名称'
            },
            chainId: { type: 'string', description: '推理链 ID（传空字符串则解绑）' }
          },
          required: ['toolName', 'chainId']
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
    },
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
}
