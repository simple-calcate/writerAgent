import type { SearchResult } from './types'

export async function searchDuckDuckGo(query: string, count: number): Promise<SearchResult[]> {
  const url = 'https://lite.duckduckgo.com/lite/'
  const body = `q=${encodeURIComponent(query)}&kl=cn-zh`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })

  if (!response.ok) {
    throw new Error(`DuckDuckGo 请求失败 (HTTP ${response.status})`)
  }

  const html = await response.text()
  return parseDuckDuckGoHtml(html, count)
}

function parseDuckDuckGoHtml(html: string, count: number): SearchResult[] {
  const results: SearchResult[] = []

  const linkRe = /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
  const snippetRe = /<td[^>]+class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi

  const links: { url: string; title: string }[] = []
  let match: RegExpExecArray | null

  while ((match = linkRe.exec(html)) !== null) {
    let url = match[1]
    const title = match[2].replace(/<[^>]+>/g, '').trim()
    if (url.startsWith('//duckduckgo.com/l/')) {
      const uMatch = url.match(/uddg=([^&]+)/)
      if (uMatch) url = decodeURIComponent(uMatch[1])
    }
    if (url.startsWith('http')) {
      links.push({ url, title })
    }
  }

  const snippets: string[] = []
  while ((match = snippetRe.exec(html)) !== null) {
    snippets.push(match[1].replace(/<[^>]+>/g, '').trim())
  }

  for (let i = 0; i < Math.min(links.length, count); i++) {
    results.push({
      title: links[i].title,
      url: links[i].url,
      description: snippets[i] || ''
    })
  }

  return results
}
