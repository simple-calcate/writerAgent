import type { SearchResult } from './types'

interface SearXNGResult {
  title: string
  url: string
  content: string
}

interface SearXNGResponse {
  results: SearXNGResult[]
}

export async function searchSearXNG(
  query: string,
  count: number,
  baseUrl: string
): Promise<SearchResult[]> {
  if (!baseUrl) {
    throw new Error('未配置 SearXNG 基础 URL')
  }

  const normalizedBase = baseUrl.replace(/\/+$/, '')
  const url = new URL(`${normalizedBase}/search`)
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'json')
  url.searchParams.set('language', 'zh-CN')
  url.searchParams.set('pageno', '1')

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'NovelWriter/1.0'
    }
  })

  if (!response.ok) {
    throw new Error(`SearXNG 请求失败 (HTTP ${response.status})`)
  }

  const data = await response.json() as SearXNGResponse

  if (!data.results || !Array.isArray(data.results)) {
    return []
  }

  return data.results.slice(0, count).map(result => ({
    title: result.title || '',
    url: result.url || '',
    description: result.content || ''
  }))
}
