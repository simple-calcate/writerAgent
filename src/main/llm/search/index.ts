import type { SearchEngineConfig, SearchEngineType } from '../../../shared/types'
import type { SearchResult } from './types'
import { searchDuckDuckGo } from './duckduckgo'
import { searchTavily } from './tavily'
import { searchBing } from './bing'
import { searchGoogle } from './google'
import { searchSearXNG } from './searxng'
import { searchMojeek } from './mojeek'
import { searchCustom } from './custom'

export type { SearchResult } from './types'

export async function searchWeb(
  query: string,
  count: number,
  config: SearchEngineConfig
): Promise<SearchResult[]> {
  return searchWithBackend(query, count, config.engine, config)
}

export async function searchWithBackend(
  query: string,
  count: number,
  backend: SearchEngineType,
  config: SearchEngineConfig
): Promise<SearchResult[]> {
  switch (backend) {
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
    case 'searxng':
      if (!config.searxngBaseUrl) throw new Error('未配置 SearXNG 基础 URL')
      return searchSearXNG(query, count, config.searxngBaseUrl)
    case 'mojeek':
      return searchMojeek(query, count)
    case 'custom':
      if (!config.customSearchApi) throw new Error('未配置自定义搜索 API')
      return searchCustom(query, count, config.customSearchApi)
    default:
      return searchDuckDuckGo(query, count)
  }
}

export async function searchWebParallel(
  query: string,
  count: number,
  config: SearchEngineConfig
): Promise<SearchResult[]> {
  if (!config.parallelEnabled) {
    return searchWeb(query, count, config)
  }

  const backends = config.parallelBackends || [config.engine]
  const maxBackends = config.parallelMaxBackends || 2
  const selectedBackends = backends.slice(0, maxBackends)

  const results = await Promise.allSettled(
    selectedBackends.map(backend => searchWithBackend(query, count, backend, config))
  )

  const mergedResults: SearchResult[] = []
  const seenUrls = new Set<string>()

  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const item of result.value) {
        const normalizedUrl = normalizeUrl(item.url)
        if (config.dedupeDomains !== false) {
          if (seenUrls.has(normalizedUrl)) continue
          seenUrls.add(normalizedUrl)
        }
        mergedResults.push(item)
      }
    }
  }

  return mergedResults.slice(0, count)
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.hostname}${parsed.pathname}`.replace(/\/+$/, '')
  } catch {
    return url
  }
}
