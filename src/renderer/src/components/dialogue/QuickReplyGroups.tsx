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
            <p className="text-[11px] text-gray-400 mb-1.5 pl-2 border-l-2 border-gray-600">
              {group.question}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {group.options.map((reply, ri) => (
              <button
                key={ri}
                onClick={() => onSend(reply.value)}
                className="px-2 py-1 text-[11px] bg-gray-800/80 hover:bg-gray-700 
                           text-gray-300 hover:text-white border border-gray-700/60 
                           hover:border-gray-500 transition-colors"
              >
                <span className="text-gray-500 mr-1">{ri + 1}.</span>
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
