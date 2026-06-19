import { getLLMConfig } from '../../../store/db'

export async function handleSearchTools(
  toolName: string,
  args: Record<string, string>
): Promise<string | null> {
  if (toolName !== 'web_search') return null

  const { query, count = 5 } = args
  if (!query) return '错误：缺少搜索关键词'

  const llmConfig = getLLMConfig()
  const searchConfig = llmConfig.searchEngineConfig || { engine: 'tavily' }

  try {
    const { searchWeb } = await import('../../search')
    const results = await searchWeb(query, Math.min(Math.max(1, parseInt(String(count)) || 5), 10), searchConfig)
    if (results.length === 0) return '未找到相关搜索结果'
    return results.map((r, i) =>
      `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.description}`
    ).join('\n\n')
  } catch (err: any) {
    return `错误：搜索请求失败 - ${err.message}`
  }
}
