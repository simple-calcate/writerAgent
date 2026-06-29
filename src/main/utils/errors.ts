/**
 * 错误处理工具
 */

/**
 * 从未知类型的错误中安全提取 message 字符串。
 *
 * 用法：} catch (err) { log.error(errorMessage(err)) }
 *
 * 替代 `catch (err: any) { err.message }`，符合 strict 模式下 unknown 捕获规范。
 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message: unknown }).message
    return typeof m === 'string' ? m : String(m)
  }
  return String(err)
}

/**
 * 包装未知错误为 Error 实例。
 */
export function toError(err: unknown): Error {
  if (err instanceof Error) return err
  return new Error(errorMessage(err))
}

/**
 * 判断未知错误是否带有指定的 HTTP 状态码。
 * 用于识别 openai SDK 抛出的 APIError（如 400/422 thinking 参数不兼容）。
 */
export function hasErrorStatus(err: unknown, ...codes: number[]): boolean {
  if (err && typeof err === 'object' && 'status' in err) {
    const s = (err as { status: unknown }).status
    return typeof s === 'number' && codes.includes(s)
  }
  return false
}

/**
 * 判断未知错误是否为 AbortError（请求被取消）。
 */
export function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}
