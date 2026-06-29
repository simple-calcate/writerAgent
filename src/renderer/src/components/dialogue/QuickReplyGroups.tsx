interface QuickReply {
  label: string
  value: string
}

interface QuestionGroup {
  question: string
  options: QuickReply[]
}

export function QuickReplyGroups({ groups, onSend }: { groups: QuestionGroup[]; onSend: (value: string) => void }) {
  if (groups.length === 0) return null

  return (
    <div className="space-y-2">
      {groups.map((group, gi) => (
        <div key={gi}>
          {group.question && (
            <p className="text-[11px] text-[var(--nw-text-muted)] mb-1.5 pl-2.5 border-l-2 border-[var(--nw-border)]">
              {group.question}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {group.options.map((reply, ri) => (
              <button
                key={ri}
                onClick={() => onSend(reply.value)}
                className="px-2.5 py-1.5 text-[11px] bg-[var(--nw-surface-2)] hover:bg-[var(--nw-surface-1)]
                           text-[var(--nw-text-secondary)] hover:text-[var(--nw-text-primary)]
                           shadow-[0_0_0_1px_rgba(255,255,255,0.04)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]
                           hover:translate-y-[-1px]
                           transition-all duration-150 ease-out rounded-md"
              >
                <span className="text-[var(--nw-text-muted)] mr-1.5">{ri + 1}.</span>
                {reply.value}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export type { QuestionGroup }
