import { useState } from 'react'

interface QuickReply {
  label: string
  value: string
}

interface QuestionGroup {
  question: string
  options: QuickReply[]
}

function extractQuestionGroups(text: string): QuestionGroup[] {
  if (!text) return []

  const lines = text.split('\n')
  const groups: QuestionGroup[] = []
  let currentQuestion = ''
  let currentOptions: QuickReply[] = []

  const numberedPattern = /^[\s]*(\d+)[\.\)、]\s+(.+)/
  const letteredPattern = /^[\s]*([A-Z])[\.、]\s+(.+)/i
  const questionPatterns = [
    /[？?]\s*$/,
    /^.*(?:你想|你想要|请问|选择|哪个|哪种|什么|怎样的?|什么样的)/,
    /^.*(?:方案[一二A-B]|选项[一二1-2])/
  ]

  const flushGroup = () => {
    if (currentOptions.length >= 2) {
      groups.push({
        question: currentQuestion || `问题 ${groups.length + 1}`,
        options: currentOptions.slice(0, 5)
      })
    }
    currentOptions = []
    currentQuestion = ''
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Check if this line is a question
    const isQuestion = questionPatterns.some(p => p.test(trimmed))

    // Check if this line is an option
    const numMatch = trimmed.match(numberedPattern)
    const letMatch = trimmed.match(letteredPattern)

    if (isQuestion && !numMatch && !letMatch) {
      // This is a question line - flush previous group and start new one
      flushGroup()
      currentQuestion = trimmed
    } else if (numMatch) {
      currentOptions.push({
        label: `${numMatch[1]}. ${numMatch[2].trim()}`,
        value: numMatch[2].trim()
      })
    } else if (letMatch) {
      currentOptions.push({
        label: `${letMatch[1].toUpperCase()}. ${letMatch[2].trim()}`,
        value: letMatch[2].trim()
      })
    }
  }

  // Flush last group
  flushGroup()

  // If no groups found but there are options, create a single group
  if (groups.length === 0) {
    const allOptions: QuickReply[] = []
    for (const line of lines) {
      const trimmed = line.trim()
      const numMatch = trimmed.match(numberedPattern)
      const letMatch = trimmed.match(letteredPattern)
      if (numMatch) {
        allOptions.push({
          label: `${numMatch[1]}. ${numMatch[2].trim()}`,
          value: numMatch[2].trim()
        })
      } else if (letMatch) {
        allOptions.push({
          label: `${letMatch[1].toUpperCase()}. ${letMatch[2].trim()}`,
          value: letMatch[2].trim()
        })
      }
    }
    if (allOptions.length >= 2) {
      groups.push({
        question: '请选择',
        options: allOptions.slice(0, 5)
      })
    }
  }

  return groups
}

// Quick Reply Buttons Component - supports multiple question groups
export function QuickReplyGroups({ groups, onSend }: { groups: QuestionGroup[]; onSend: (answers: string) => void }) {
  const [selections, setSelections] = useState<Record<number, string>>({})

  if (groups.length === 0) return null

  const handleSelect = (groupIndex: number, value: string) => {
    setSelections(prev => ({ ...prev, [groupIndex]: value }))
  }

  const handleSend = () => {
    const answers = groups.map((group, i) => {
      const selection = selections[i]
      if (selection) return selection
      return ''
    }).filter(Boolean)

    if (answers.length > 0) {
      onSend(answers.join('；'))
    }
  }

  const allSelected = groups.every((_, i) => selections[i])

  return (
    <div className="space-y-2 mt-2">
      {groups.map((group, gi) => (
        <div key={gi}>
          <p className="text-[10px] text-gray-500 mb-1">{group.question}</p>
          <div className="flex flex-wrap gap-1.5">
            {group.options.map((reply, ri) => (
              <button
                key={ri}
                onClick={() => handleSelect(gi, reply.value)}
                className={`px-2.5 py-1 text-[11px] rounded-full transition-colors ${
                  selections[gi] === reply.value
                    ? 'bg-blue-600 text-white border border-blue-500'
                    : 'bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 hover:text-blue-200 border border-blue-600/30 hover:border-blue-500/50'
                }`}
              >
                {reply.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      {groups.length > 1 && (
        <button
          onClick={handleSend}
          disabled={!allSelected}
          className="w-full py-1.5 text-[11px] bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          发送回答
        </button>
      )}
    </div>
  )
}

export type { QuestionGroup }
