import type { DialogueToolApprovalResponse } from '../../../shared/types'

const pendingApprovals = new Map<string, {
  resolve: (response: DialogueToolApprovalResponse) => void
  reject: (err: Error) => void
}>()

export function waitForApproval(approvalId: string): Promise<DialogueToolApprovalResponse> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingApprovals.delete(approvalId)
      reject(new Error('审批超时'))
    }, 5 * 60 * 1000)

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
