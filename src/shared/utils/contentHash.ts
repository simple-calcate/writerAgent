/**
 * 内容哈希工具：用于检测章节内容是否在上次生成摘要后发生过变化。
 *
 * 设计目标：
 * - 不需要加密强度，只需要稳定且对内容变化敏感
 * - 短内容（< 200 字符）直接返回原始长度+全文 hash，避免碰撞
 * - 长内容采样首/中/尾 + 长度，足以检测绝大多数实际编辑
 * - 同一段空白变化（多换行/少换行）应被视为变化，所以不做 normalize
 */

/**
 * 计算字符串的简单哈希（djb2 变体），返回 8 位十六进制。
 * 不对外暴露，仅内部使用。
 */
function djb2(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0
  }
  // 转无符号 32 位再转 16 进制
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * 计算章节内容的"指纹"。
 *
 * - 空内容返回 'empty'
 * - 短内容（≤ 200 字符）：长度 + 全文 djb2
 * - 长内容：长度 + 首 80 + 中 40 + 末 80 的组合 djb2
 *
 * 同一内容必然产生同一哈希；内容发生任何实质性编辑都会改变哈希。
 */
export function contentHash(content: string): string {
  if (!content) return 'empty'
  const len = content.length
  if (len <= 200) {
    return `${len}:${djb2(content)}`
  }
  const head = content.slice(0, 80)
  const mid = content.slice(Math.floor(len / 2) - 20, Math.floor(len / 2) + 20)
  const tail = content.slice(len - 80)
  return `${len}:${djb2(head + '|' + mid + '|' + tail)}`
}

/**
 * 判断章节摘要是否"已过期"——即内容在上次生成摘要后发生过变化。
 *
 * - 未生成过摘要（summaryOfContentHash 为空）→ true（视为过期，需要生成）
 * - 内容为空 → false（空内容无需生成摘要）
 * - 当前内容 hash 与记录的 hash 不同 → true（内容已变化）
 * - 否则 → false（摘要仍然最新）
 */
export function isSummaryStale(chapter: {
  content: string
  summaryResult: string | null
  summaryOfContentHash?: string | null
}): boolean {
  // 空内容无需生成摘要 → 视为"未过期"（避免 UI 显示需要生成）
  if (!chapter.content.trim()) return false
  if (!chapter.summaryResult) return true
  if (!chapter.summaryOfContentHash) return true
  return contentHash(chapter.content) !== chapter.summaryOfContentHash
}

/**
 * 摘要状态枚举（用于 UI 徽章显示）。
 */
export type SummaryStatus = 'none' | 'stale' | 'fresh'

/**
 * 获取章节摘要状态。
 * - none: 未生成过摘要
 * - stale: 摘要已过期（内容已变化）
 * - fresh: 摘要仍最新
 */
export function getSummaryStatus(chapter: {
  content: string
  summaryResult: string | null
  summaryOfContentHash?: string | null
}): SummaryStatus {
  if (!chapter.summaryResult) return 'none'
  if (!chapter.content.trim()) return 'fresh'
  if (!chapter.summaryOfContentHash) return 'stale'
  return contentHash(chapter.content) === chapter.summaryOfContentHash ? 'fresh' : 'stale'
}
