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
    <div className="rounded-md bg-[--nw-surface-2] shadow-[0_0_0_1px_rgba(255,255,255,0.04)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08)] hover:translate-y-[-1px] transition-all duration-150 ease-out overflow-hidden">
      <button
        onClick={() => toolCall.status === 'done' && setExpanded(!expanded)}
        className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] transition-colors duration-150 ${
          toolCall.status === 'done' ? 'cursor-pointer hover:bg-[--nw-surface-1]' : 'cursor-default'
        }`}
      >
        {toolCall.status === 'running' ? (
          <div className="w-3 h-3 border border-amber-400 border-t-transparent rounded-full animate-spin" />
        ) : toolCall.status === 'pending_approval' ? (
          <span className="text-yellow-400">⏳</span>
        ) : (
          <span className="text-emerald-400">✓</span>
        )}
        <span className={
          toolCall.status === 'running' ? 'text-amber-300' :
          toolCall.status === 'pending_approval' ? 'text-yellow-300' :
          'text-[--nw-text-primary]'
        }>
          {toolCall.displayName}
        </span>
        {toolCall.status === 'done' && (
          <span className="ml-auto text-[--nw-text-muted] text-[10px]">{expanded ? '收起' : '展开'}</span>
        )}
      </button>

      {/* Approval UI */}
      {toolCall.status === 'pending_approval' && approval && (
        <div className="px-3 pb-3 border-t border-[--nw-border] pt-2.5 space-y-2.5">
          <p className="text-[11px] text-[--nw-text-secondary]">{approval.description}</p>

          {approval.cachedResult && CACHEABLE_TOOLS.has(toolCall.toolName) ? (
            <>
              <div className="text-[11px] text-[--nw-text-muted] bg-[--nw-surface-1] rounded-md p-2.5 max-h-32 overflow-y-auto">
                <p className="text-[10px] text-[--nw-text-muted] mb-1">缓存结果：</p>
                {renderMarkdown(approval.cachedResult.substring(0, 200) + (approval.cachedResult.length > 200 ? '...' : ''))}
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => onApprove(approval.approvalId, true, false)}
                  className="flex-1 bg-emerald-600/80 hover:bg-emerald-600 text-white px-2.5 py-2 rounded-md text-[11px] transition-all duration-150 hover:translate-y-[-1px]"
                >
                  使用缓存
                </button>
                <button
                  onClick={() => onApprove(approval.approvalId, true, true)}
                  className="flex-1 bg-[--nw-accent]/80 hover:bg-[--nw-accent] text-white px-2.5 py-2 rounded-md text-[11px] transition-all duration-150 hover:translate-y-[-1px]"
                >
                  刷新
                </button>
                <button
                  onClick={() => onApprove(approval.approvalId, false)}
                  className="flex-1 bg-[--nw-surface-1] hover:bg-[--nw-surface-2] text-[--nw-text-secondary] px-2.5 py-2 rounded-md text-[11px] transition-all duration-150 hover:translate-y-[-1px]"
                >
                  拒绝
                </button>
              </div>
            </>
          ) : (
            <div className="flex gap-1.5">
              <button
                onClick={() => onApprove(approval.approvalId, true)}
                className="flex-1 bg-emerald-600/80 hover:bg-emerald-600 text-white px-2.5 py-2 rounded-md text-[11px] transition-all duration-150 hover:translate-y-[-1px]"
              >
                确认执行
              </button>
              <button
                onClick={() => onApprove(approval.approvalId, false)}
                className="flex-1 bg-red-600/80 hover:bg-red-600 text-white px-2.5 py-2 rounded-md text-[11px] transition-all duration-150 hover:translate-y-[-1px]"
              >
                拒绝
              </button>
            </div>
          )}
        </div>
      )}

      {/* Done: show result */}
      {showResult && toolCall.result && (
        <div className="px-3 pb-3 border-t border-[--nw-border] pt-2.5">
          <div className="text-[11px] text-[--nw-text-secondary] leading-relaxed max-h-64 overflow-y-auto">
            {renderMarkdown(toolCall.result)}
          </div>
        </div>
      )}
    </div>
  )
}
