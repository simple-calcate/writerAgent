import type { SearchResult } from './types'
import type { CustomSearchApiConfig } from '../../../shared/types'

export async function searchCustom(
  query: string,
  count: number,
  config: CustomSearchApiConfig
): Promise<SearchResult[]> {
  if (!config.url) {
    throw new Error('未配置自定义搜索 API URL')
  }

  const method = config.method || 'GET'
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': 'NovelWriter/1.0',
    ...config.headers
  }

  // 替换 URL 中的占位符
  const resolvedUrl = config.url
    .replace('{query}', encodeURIComponent(query))
    .replace('{count}', String(count))

  // 准备请求参数
  const params = new URLSearchParams()
  if (config.params) {
    for (const [key, value] of Object.entries(config.params)) {
      params.set(key, value.replace('{query}', encodeURIComponent(query)).replace('{count}', String(count)))
    }
  }

  let requestUrl = resolvedUrl
  let body: string | undefined

  if (method === 'GET' && params.toString()) {
    const separator = resolvedUrl.includes('?') ? '&' : '?'
    requestUrl = `${resolvedUrl}${separator}${params.toString()}`
  } else if (method === 'POST') {
    body = params.toString()
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
  }

  const response = await fetch(requestUrl, {
    method,
    headers,
    body
  })

  if (!response.ok) {
    throw new Error(`自定义搜索 API 请求失败 (HTTP ${response.status})`)
  }

  const data = await response.json()
  return parseCustomResults(data, count, config)
}

function parseCustomResults(
  data: any,
  count: number,
  config: CustomSearchApiConfig
): SearchResult[] {
  const resultsPath = config.resultsPath || 'results'
  const titlePath = config.titlePath || 'title'
  const urlPath = config.urlPath || 'url'
  const snippetPath = config.snippetPath || 'description'

  // 获取结果数组
  const results = getNestedValue(data, resultsPath)
  if (!Array.isArray(results)) {
    return []
  }

  return results.slice(0, count).map(item => ({
    title: String(getNestedValue(item, titlePath) || ''),
    url: String(getNestedValue(item, urlPath) || ''),
    description: String(getNestedValue(item, snippetPath) || '')
  }))
}

function getNestedValue(obj: any, path: string): any {
  if (!obj || !path) return obj

  const parts = path.split('.')
  let current = obj

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined
    }
    current = current[part]
  }

  return current
}
