import { useState } from 'react'
import type { ToolCallInfo, DialogueToolApproval } from '../../../../shared/types'
import { renderMarkdown } from './markdownRenderer'

const CACHEABLE_TOOLS = new Set(['summarize_chapter', 'refine_summary'])
const WRITE_TOOLS = new Set(['create_chapter', 'rename_chapter', 'write_outline', 'write_volume_outline', 'write_chapter_outline', 'write_chapter_content'])

export function ToolCallCard({ toolCall, approval, onApprove }: { toolCall: ToolCallInfo; approval?: DialogueToolApproval; onApprove: (approvalId: string, approved: boolean, refreshCache?: boolean) => void }) {
  const isWriteTool = WRITE_TOOLS.has(toolCall.toolName)
  const [expanded, setExpanded] = useState(isWriteTool)
  const showResult = toolCall.status === 'done' && toolCall.result && expanded

  return (
    <div className="border border-gray-700/40 bg-gray-800/40 mb-1.5 overflow-hidden">
      <button
        onClick={() => toolCall.status === 'done' && setExpanded(!expanded)}
        className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs transition-colors ${
          toolCall.status === 'done' ? 'cursor-pointer hover:bg-gray-700/30' : 'cursor-default'
        }`}
      >
        {toolCall.status === 'running' ? (
          <div className="w-3 h-3 border border-amber-400 border-t-transparent rounded-full animate-spin" />
        ) : toolCall.status === 'pending_approval' ? (
          <span className="text-yellow-400">⏳</span>
        ) : (
          <span className="text-green-400">✓</span>
        )}
        <span className={
          toolCall.status === 'running' ? 'text-amber-300' :
          toolCall.status === 'pending_approval' ? 'text-yellow-300' :
          'text-gray-300'
        }>
          {toolCall.displayName}
        </span>
        {toolCall.status === 'done' && (
          <span className="ml-auto text-gray-600 text-[10px]">{expanded ? '收起' : '展开'}</span>
        )}
      </button>

      {/* Approval UI */}
      {toolCall.status === 'pending_approval' && approval && (
        <div className="px-3 pb-3 border-t border-gray-700/40 pt-2 space-y-2">
          <p className="text-xs text-gray-400">{approval.description}</p>

          {/* Cache hit: show cached result + 3 buttons */}
          {approval.cachedResult && CACHEABLE_TOOLS.has(toolCall.toolName) ? (
            <>
              <div className="text-xs text-gray-500 bg-gray-900/40 rounded p-2 max-h-32 overflow-y-auto">
                <p className="text-[10px] text-gray-600 mb-1">缓存结果：</p>
                {renderMarkdown(approval.cachedResult.substring(0, 200) + (approval.cachedResult.length > 200 ? '...' : ''))}
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => onApprove(approval.approvalId, true, false)}
                  className="flex-1 bg-green-600/80 hover:bg-green-600 text-white px-2 py-1.5 rounded text-[11px] transition-colors"
                >
                  使用缓存
                </button>
                <button
                  onClick={() => onApprove(approval.approvalId, true, true)}
                  className="flex-1 bg-blue-600/80 hover:bg-blue-600 text-white px-2 py-1.5 rounded text-[11px] transition-colors"
                >
                  刷新
                </button>
                <button
                  onClick={() => onApprove(approval.approvalId, false)}
                  className="flex-1 bg-gray-600/80 hover:bg-gray-600 text-gray-200 px-2 py-1.5 rounded text-[11px] transition-colors"
                >
                  拒绝
                </button>
              </div>
            </>
          ) : (
            /* Write tool: confirm/reject */
            <div className="flex gap-1.5">
              <button
                onClick={() => onApprove(approval.approvalId, true)}
                className="flex-1 bg-green-600/80 hover:bg-green-600 text-white px-2 py-1.5 rounded text-[11px] transition-colors"
              >
                确认执行
              </button>
              <button
                onClick={() => onApprove(approval.approvalId, false)}
                className="flex-1 bg-red-600/80 hover:bg-red-600 text-white px-2 py-1.5 rounded text-[11px] transition-colors"
              >
                拒绝
              </button>
            </div>
          )}
        </div>
      )}

      {/* Done: show result for write tools (auto-expanded), or collapsible for others */}
      {showResult && toolCall.result && (
        <div className="px-3 pb-3 border-t border-gray-700/40 pt-2">
          <div className="text-xs text-gray-400 leading-relaxed max-h-64 overflow-y-auto">
            {renderMarkdown(toolCall.result)}
          </div>
        </div>
      )}
    </div>
  )
}
