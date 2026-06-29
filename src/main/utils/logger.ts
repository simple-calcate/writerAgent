/**
 * 统一日志工具
 *
 * - debug: 仅开发环境或 NW_DEBUG=1 时输出（生产静默）
 * - info / warn / error: 始终输出
 *
 * 用法: import { log } from '../utils/logger'
 *       log.debug('[polish] raw:', res)   // 调试日志，生产不输出
 *       log.error('[polish] failed:', err) // 错误日志，始终输出
 */

const isDev = process.env.NODE_ENV === 'development' ||
  process.env.ELECTRON_IS_DEV === '1' ||
  !!process.env.ELECTRON_RENDERER_URL
const isDebug = isDev || process.env.NW_DEBUG === '1'

export const log = {
  debug: (...args: unknown[]): void => {
    if (isDebug) console.log('[debug]', ...args)
  },
  info: (...args: unknown[]): void => {
    console.log('[info]', ...args)
  },
  warn: (...args: unknown[]): void => {
    console.warn('[warn]', ...args)
  },
  error: (...args: unknown[]): void => {
    console.error('[error]', ...args)
  }
}
