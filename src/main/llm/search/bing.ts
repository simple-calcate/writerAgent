import type { SearchResult } from './types'

export async function searchBing(query: string, count: number, apiKey: string): Promise<SearchResult[]> {
  const url = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=${count}`

  const response = await fetch(url, {
    headers: { 'Ocp-Apim-Subscription-Key': apiKey }
  })

  if (!response.ok) {
    if (response.status === 401) throw new Error('Bing API Key 无效')
    if (response.status === 429) throw new Error('Bing 请求过于频繁')
    throw new Error(`Bing 请求失败 (HTTP ${response.status})`)
  }

  const data: any = await response.json()
  const results = data.webPages?.value || []

  return results.slice(0, count).map((r: any) => ({
    title: r.name || '',
    url: r.url || '',
    description: r.snippet || ''
  }))
}
