import type OpenAI from 'openai'

export const chapterToolDefinitions: OpenAI.ChatCompletionTool[] = [
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
      name: 'read_chapter_content',
      description: '读取指定章节的完整正文内容。当你需要查看章节内容来给出建议时使用。需要用户确认。',
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
      description: '为指定章节撰写完整正文内容。需要用户确认后执行。会自动保存版本历史。',
      parameters: {
        type: 'object',
        properties: {
          chapterId: { type: 'string', description: '章节 ID' },
          content: { type: 'string', description: '章节正文内容' }
        },
        required: ['chapterId', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'batch_refine_summaries',
      description: '对指定卷的所有章节进行精炼总结。传入 volumeId 则处理该卷，不传则处理当前卷。',
      parameters: {
        type: 'object',
        properties: {
          volumeId: { type: 'string', description: '卷 ID（可选，不传则处理当前卷）' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_content',
      description: '在指定范围内搜索关键词，返回匹配位置及上下文片段。用于查找特定角色、场景、伏笔、道具等的描写位置。支持三种范围：(1) chapter 章节级——搜索指定章节或当前章节；(2) volume 卷级——搜索指定卷或当前卷的所有章节；(3) book 全书级——搜索当前项目所有章节，结果按卷→章节→匹配位置分层。支持多关键词同时搜索：matchMode="or" 时行包含任一关键词即匹配（适合搜角色别名/相关词组），"and" 时行必须同时包含所有关键词（适合查共现关系）。只读操作，无需用户确认。',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '搜索关键词。支持多关键词同时搜索，用 | 分隔（如 "林婉儿|林姑娘|大小姐"），会被拆分为数组按 matchMode 匹配'
          },
          scope: { type: 'string', enum: ['chapter', 'volume', 'book'], description: '搜索范围，默认 chapter' },
          chapterId: { type: 'string', description: '章节 ID（scope=chapter 时可选，不传则搜索当前章节）' },
          volumeId: { type: 'string', description: '卷 ID（scope=volume 时可选，不传则搜索当前卷）' },
          matchMode: { type: 'string', enum: ['or', 'and'], description: '多关键词匹配模式：or=任一命中即匹配（默认），and=全部命中才匹配' },
          contextLines: { type: 'number', description: '每个匹配位置返回的上下文行数（默认 5，范围 0-20）' },
          maxMatches: { type: 'number', description: '每章最大返回区间数（默认 chapter=5 / volume=3 / book=3，最大 20）' }
        },
        required: ['query']
      }
    }
  }
]
