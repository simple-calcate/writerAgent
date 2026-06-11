import type { SearchEngineConfig } from '../../../shared/types'
import type { SearchResult } from './types'
import { searchDuckDuckGo } from './duckduckgo'
import { searchTavily } from './tavily'
import { searchBing } from './bing'
import { searchGoogle } from './google'

export type { SearchResult } from './types'

export async function searchWeb(
  query: string,
  count: number,
  config: SearchEngineConfig
): Promise<SearchResult[]> {
  switch (config.engine) {
    case 'tavily':
      if (!config.tavilyApiKey) throw new Error('未配置 Tavily API Key')
      return searchTavily(query, count, config.tavilyApiKey)
    case 'bing':
      if (!config.bingApiKey) throw new Error('未配置 Bing API Key')
      return searchBing(query, count, config.bingApiKey)
    case 'google':
      if (!config.googleApiKey) throw new Error('未配置 Google API Key')
      if (!config.googleSearchEngineId) throw new Error('未配置 Google 搜索引擎 ID')
      return searchGoogle(query, count, config.googleApiKey, config.googleSearchEngineId)
    default:
      return searchDuckDuckGo(query, count)
  }
}
