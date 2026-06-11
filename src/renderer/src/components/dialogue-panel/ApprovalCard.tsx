import type { DialogueToolApproval } from '../../../../shared/types'
import { renderMarkdown } from '../dialogue'

// ─── Standalone Pending Approval Card (for approvals arriving before tool-start) ───

export function PendingApprovalCard({ approval, onApprove }: { approval: DialogueToolApproval; onApprove: (approvalId: string, approved: boolean, refreshCache?: boolean) => void }) {
  return (
    <div className="border border-yellow-600/30 bg-yellow-900/5 mb-1.5 overflow-hidden">
      <div className="flex items-center gap-2 px-2.5 py-1.5 text-xs">
        <span className="text-yellow-400">⏳</span>
        <span className="text-yellow-300">{approval.displayName}</span>
        <span className="ml-auto text-[10px] text-yellow-600">等待确认</span>
      </div>
      <div className="px-2.5 pb-2.5 border-t border-gray-700/30 pt-2 space-y-2">
        <p className="text-xs text-gray-400">{approval.description}</p>

        {approval.cachedResult ? (
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
    </div>
  )
}

// ─── Plan Mode Badge ───

export function PlanModeBadge() {
  return (
    <div className="flex items-center gap-2 px-2 py-1 bg-purple-900/15 border-l-2 border-purple-500 mb-1.5 text-xs">
      <span className="text-purple-400">📋</span>
      <span className="text-purple-300 font-medium">计划模式</span>
      <span className="text-[10px] text-purple-500">AI 正在进行剧情规划</span>
    </div>
  )
}
