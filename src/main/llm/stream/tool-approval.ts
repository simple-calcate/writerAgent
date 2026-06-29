import type { DialogueToolApprovalResponse } from '../../../shared/types'
import { TOOL_APPROVAL_TIMEOUT } from '../constants'

const pendingApprovals = new Map<string, {
  resolve: (response: DialogueToolApprovalResponse) => void
  reject: (err: Error) => void
}>()

export function waitForApproval(approvalId: string): Promise<DialogueToolApprovalResponse> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingApprovals.delete(approvalId)
      reject(new Error('审批超时'))
    }, TOOL_APPROVAL_TIMEOUT)

    pendingApprovals.set(approvalId, {
      resolve: (response) => {
        clearTimeout(timeout)
        pendingApprovals.delete(approvalId)
        resolve(response)
      },
      reject: (err) => {
        clearTimeout(timeout)
        pendingApprovals.delete(approvalId)
        reject(err)
      }
    })
  })
}

export function handleApprovalResponse(response: DialogueToolApprovalResponse): void {
  const pending = pendingApprovals.get(response.approvalId)
  if (pending) {
    pending.resolve(response)
  }
}
