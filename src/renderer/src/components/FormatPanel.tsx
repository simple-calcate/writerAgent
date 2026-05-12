import { useState } from 'react'
import { useAppStore } from '../stores/useAppStore'

interface FormatRule {
  name: string
  desc: string
  fn: (text: string) => string
}

const FORMAT_RULES: FormatRule[] = [
  {
    name: '去多余空格',
    desc: '删除行首行尾空格、连续空格合并为一个',
    fn: (t) => t.split('\n').map(l => l.replace(/ +/g, ' ').trim()).join('\n')
  },
  {
    name: '去空行',
    desc: '删除连续空行，保留单个换行',
    fn: (t) => t.replace(/\n{3,}/g, '\n\n')
  },
  {
    name: '中英文标点',
    desc: '英文标点转中文标点（逗号、句号、问号、感叹号、冒号、分号）',
    fn: (t) => {
      const map: [string, string][] = [
        [',', '，'], ['.', '。'], ['?', '？'], ['!', '！'],
        [':', '：'], [';', '；'], ['(', '（'], [')', '）']
      ]
      let result = t
      for (const [from, to] of map) {
        // Only replace if not already Chinese punctuation context
        result = result.replaceAll(from, to)
      }
      return result
    }
  },
  {
    name: '加段首缩进',
    desc: '每个段落开头加两个全角空格（中文标准格式）',
    fn: (t) => t.split('\n').map(l => l.trim() ? '　　' + l.trim() : '').join('\n')
  },
  {
    name: '去段首缩进',
    desc: '删除段落开头的全角/半角空格',
    fn: (t) => t.split('\n').map(l => l.replace(/^[\s　]+/, '')).join('\n')
  },
  {
    name: '引号规范化',
    desc: '直引号转弯引号',
    fn: (t) => {
      let r = t
      r = r.replace(/"([^"]*?)"/g, '「$1」')
      r = r.replace(/"([^"]*?)"/g, '「$1」')
      r = r.replace(/'([^']*?)'/g, '『$1』')
      r = r.replace(/'([^']*?)'/g, '『$1』')
      return r
    }
  },
  {
    name: '数字转中文',
    desc: '简单阿拉伯数字转中文（0-10）',
    fn: (t) => {
      const cn = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
      return t.replace(/\b(\d{1,2})\b/g, (_, d) => cn[parseInt(d)] || d)
    }
  },
  {
    name: '句尾统一',
    desc: '确保每段最后一个非空字符是句号',
    fn: (t) => t.split('\n').map(l => {
      const trimmed = l.trim()
      if (!trimmed) return ''
      const last = trimmed[trimmed.length - 1]
      if ('。！？…'.includes(last)) return trimmed
      return trimmed + '。'
    }).join('\n')
  }
]

export default function FormatPanel() {
  const { currentChapter, updateChapterContent, saveChapter, pushUndo } = useAppStore()
  const [showPanel, setShowPanel] = useState(false)
  const [lastApplied, setLastApplied] = useState<string | null>(null)

  if (!currentChapter) return null

  const apply = (rule: FormatRule) => {
    pushUndo()
    const formatted = rule.fn(currentChapter.content)
    updateChapterContent(formatted)
    saveChapter()
    setLastApplied(rule.name)
    setTimeout(() => setLastApplied(null), 2000)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
      >
        格式化
      </button>

      {showPanel && (
        <div className="absolute top-full right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-3 w-72 z-50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-300">快速格式化</h3>
            <button
              onClick={() => setShowPanel(false)}
              className="text-gray-500 hover:text-gray-300 text-xs"
            >
              x
            </button>
          </div>

          {lastApplied && (
            <div className="text-xs text-green-400 bg-green-500/10 rounded px-2 py-1 mb-2">
              已应用：{lastApplied}
            </div>
          )}

          <div className="space-y-1 max-h-80 overflow-y-auto">
            {FORMAT_RULES.map((rule) => (
              <button
                key={rule.name}
                onClick={() => apply(rule)}
                className="w-full text-left px-3 py-2 rounded hover:bg-gray-700 transition-colors group"
              >
                <p className="text-xs text-gray-200 group-hover:text-white">{rule.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{rule.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
