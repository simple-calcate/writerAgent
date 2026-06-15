import type { SearchResult } from './types'

export async function searchMojeek(query: string, count: number): Promise<SearchResult[]> {
  const url = `https://www.mojeek.com/search?q=${encodeURIComponent(query)}&fmt=json`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    }
  })

  if (!response.ok) {
    throw new Error(`Mojeek 请求失败 (HTTP ${response.status})`)
  }

  const data = await response.json() as {
    response?: {
      docs?: Array<{
        title?: string
        url?: string
        desc?: string
      }>
    }
  }

  const docs = data.response?.docs
  if (!Array.isArray(docs)) {
    return []
  }

  return docs.slice(0, count).map(doc => ({
    title: doc.title || '',
    url: doc.url || '',
    description: doc.desc || ''
  }))
}
