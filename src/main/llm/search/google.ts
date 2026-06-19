import type { SearchResult } from './types'

export async function searchGoogle(query: string, count: number, apiKey: string, searchEngineId: string): Promise<SearchResult[]> {
  const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(searchEngineId)}&q=${encodeURIComponent(query)}&num=${count}`

  const response = await fetch(url)

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error('Google API Key 无效')
    if (response.status === 429) throw new Error('Google 请求过于频繁')
    throw new Error(`Google 请求失败 (HTTP ${response.status})`)
  }

  const data: any = await response.json()
  const results = data.items || []

  return results.slice(0, count).map((r: any) => ({
    title: r.title || '',
    url: r.link || '',
    description: r.snippet || ''
  }))
}
