/**
 * LLM 调用相关常量
 *
 * 集中管理超时、token 预算、截断阈值等魔法数字，
 * 便于统一调优和避免散落在各处的硬编码。
 */

/** 网络请求超时（毫秒） */
export const TIMEOUT = {
  /** 本地模型连接检测 */
  LOCAL_CONNECT: 5000,
  /** 本地模型对话测试 */
  LOCAL_CHAT: 10000,
} as const

/** 工具调用审批超时（毫秒）— 5 分钟 */
export const TOOL_APPROVAL_TIMEOUT = 5 * 60 * 1000

/** Token 预算（用于上下文构建） */
export const TOKEN_BUDGET = {
  /** 默认对话上下文预算 */
  DIALOGUE: 4000,
  /** 摘要预算 */
  SUMMARY: 2000,
  /** 续写预算 */
  CONTINUATION: 3000,
} as const

/** 内容截断阈值（字符数） */
export const TRUNCATE = {
  /** 章节内容截断 */
  CHAPTER: 10000,
  /** 卷内容截断 */
  VOLUME: 5000,
  /** 书籍内容截断 */
  BOOK: 3000,
} as const

/** 默认上下文窗口大小（tokens） */
export const DEFAULT_CONTEXT_WINDOW = 128000

/** 历史压缩相关 */
export const COMPRESSION = {
  /** 上下文窗口的 25% 用于历史 */
  HISTORY_BUDGET_RATIO: 0.25,
  /** 历史预算占整体的比例 */
  HISTORY_BUDGET_OF_WINDOW: 0.25,
  /** 保留最近消息轮数 */
  KEEP_RECENT_ROUNDS: 20,
} as const
