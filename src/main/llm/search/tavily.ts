import type { SearchResult } from './types'

export async function searchTavily(query: string, count: number, apiKey: string): Promise<SearchResult[]> {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({ query, max_results: count })
  })

  if (!response.ok) {
    if (response.status === 401) throw new Error('Tavily API Key 无效')
    if (response.status === 429) throw new Error('Tavily 请求过于频繁')
    throw new Error(`Tavily 请求失败 (HTTP ${response.status})`)
  }

  const data = await response.json()
  const results = data.results || []

  return results.slice(0, count).map((r: any) => ({
    title: r.title || '',
    url: r.url || '',
    description: r.content || ''
  }))
}
