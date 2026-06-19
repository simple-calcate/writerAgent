import type { DialogueToolApproval } from '../../../../shared/types'
import { renderMarkdown } from '../dialogue'

// ─── Standalone Pending Approval Card (for approvals arriving before tool-start) ───

export function PendingApprovalCard({ approval, onApprove }: { approval: DialogueToolApproval; onApprove: (approvalId: string, approved: boolean, refreshCache?: boolean) => void }) {
  return (
    <div className="mt-2 rounded-md bg-yellow-900/8 shadow-[0_0_0_1px_rgba(234,179,8,0.15)] hover:shadow-[0_0_0_1px_rgba(234,179,8,0.25)] hover:translate-y-[-1px] transition-all duration-150 ease-out overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 text-[11px]">
        <span className="text-yellow-400">⏳</span>
        <span className="text-yellow-300">{approval.displayName}</span>
        <span className="ml-auto text-[10px] text-yellow-600">等待确认</span>
      </div>
      <div className="px-3 pb-2.5 border-t border-[--nw-border] pt-2.5 space-y-2.5">
        <p className="text-[11px] text-[--nw-text-secondary]">{approval.description}</p>

        {approval.cachedResult ? (
          <>
            <div className="text-[11px] text-[--nw-text-muted] bg-[--nw-surface-2] rounded-md p-2.5 max-h-32 overflow-y-auto">
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
    </div>
  )
}

// ─── Plan Mode Badge ───

export function PlanModeBadge() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-purple-900/15 rounded-md mb-2 text-[11px]">
      <span className="text-purple-400">📋</span>
      <span className="text-purple-300 font-medium">计划模式</span>
      <span className="text-[10px] text-purple-500">AI 正在进行剧情规划</span>
    </div>
  )
}
