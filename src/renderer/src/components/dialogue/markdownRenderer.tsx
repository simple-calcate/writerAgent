import React from 'react'

export function renderMarkdown(text: string): React.ReactNode[] {
  if (!text) return []
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    if (line.match(/^```/)) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].match(/^```/)) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing ```
      elements.push(
        <pre key={`code-${elements.length}`} className="bg-[var(--nw-surface-2)]/80 border border-white/10/50 rounded p-2 my-1.5 overflow-x-auto">
          <code className="text-[11px] text-green-300 font-mono leading-relaxed whitespace-pre">{codeLines.join('\n')}</code>
        </pre>
      )
      continue
    }

    // Headers
    const headerMatch = line.match(/^(#{1,6})\s+(.+)/)
    if (headerMatch) {
      const level = headerMatch[1].length
      const sizes = ['text-base', 'text-sm', 'text-xs', 'text-xs', 'text-[11px]', 'text-[11px]']
      elements.push(
        <div key={i} className={`font-semibold text-[var(--nw-text-primary)] ${sizes[level - 1]} ${level <= 2 ? 'mt-3 mb-1.5' : 'mt-2 mb-1'} border-b border-white/10/30 pb-0.5`}>
          {renderInline(headerMatch[2])}
        </div>
      )
      i++
      continue
    }

    // Horizontal rule
    if (line.match(/^(\*{3,}|-{3,}|_{3,})\s*$/)) {
      elements.push(<hr key={i} className="border-white/10/50 my-2" />)
      i++
      continue
    }

    // Table
    if (line.includes('|') && i + 1 < lines.length && lines[i + 1].match(/^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/)) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i])
        i++
      }
      const parseRow = (row: string) => row.split('|').map(c => c.trim()).filter(Boolean)
      const headers = parseRow(tableLines[0])
      const rows = tableLines.slice(2).map(parseRow)
      elements.push(
        <div key={`table-${elements.length}`} className="my-1.5 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>{headers.map((h, hi) => <th key={hi} className="border border-white/10/50 px-2 py-1 text-left text-[var(--nw-text-secondary)] bg-[var(--nw-surface-2)]/60 font-medium">{renderInline(h)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>{row.map((cell, ci) => <td key={ci} className="border border-white/10/50 px-2 py-1 text-[var(--nw-text-secondary)]">{renderInline(cell)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    // Blockquote
    if (line.match(/^>\s?/)) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].match(/^>\s?/)) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      elements.push(
        <blockquote key={`bq-${elements.length}`} className="border-l-2 border-blue-500/50 pl-3 my-1.5 text-xs text-[var(--nw-text-secondary)] italic">
          {quoteLines.map((ql, qi) => <p key={qi}>{renderInline(ql)}</p>)}
        </blockquote>
      )
      continue
    }

    // Unordered list
    if (line.match(/^[\-\*]\s+/)) {
      elements.push(
        <div key={i} className="flex gap-1.5 text-xs text-[var(--nw-text-secondary)] leading-relaxed ml-1">
          <span className="shrink-0 mt-1.5 w-1 h-1 rounded-full bg-[var(--nw-text-muted)]" />
          <span>{renderInline(line.replace(/^[\-\*]\s+/, ''))}</span>
        </div>
      )
      i++
      continue
    }

    // Numbered list
    const numMatch = line.match(/^(\d+)[\.\)]\s+(.+)/)
    if (numMatch) {
      elements.push(
        <div key={i} className="flex gap-1.5 text-xs text-[var(--nw-text-secondary)] leading-relaxed ml-1">
          <span className="shrink-0 text-[var(--nw-text-muted)] w-4">{numMatch[1]}.</span>
          <span>{renderInline(numMatch[2])}</span>
        </div>
      )
      i++
      continue
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<div key={i} className="h-1.5" />)
      i++
      continue
    }

    // Normal text
    elements.push(
      <p key={i} className="text-xs text-[var(--nw-text-secondary)] leading-relaxed">{renderInline(line)}</p>
    )
    i++
  }

  return elements
}

function renderInline(text: string): React.ReactNode {
  if (!text) return text

  const parts: React.ReactNode[] = []
  let remaining = text
  let keyCounter = 0
  const codeRegex = /`([^`]+)`/g
  let lastIdx = 0
  let m: RegExpExecArray | null

  while ((m = codeRegex.exec(remaining)) !== null) {
    if (m.index > lastIdx) {
      parts.push(...processInlineFormatting(remaining.slice(lastIdx, m.index), keyCounter++))
    }
    parts.push(<code key={`ic-${keyCounter++}`} className="bg-[var(--nw-surface-2)] text-amber-300 px-1 py-0.5 rounded text-[11px] font-mono">{m[1]}</code>)
    lastIdx = m.index + m[0].length
  }
  if (lastIdx < remaining.length) {
    parts.push(...processInlineFormatting(remaining.slice(lastIdx), keyCounter++))
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>
}

function processInlineFormatting(text: string, keyPrefix: number): React.ReactNode[] {
  if (!text) return []
  const parts: React.ReactNode[] = []
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~|\[([^\]]+)\]\(([^)]+)\)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    if (match[1]) {
      parts.push(<strong key={`b-${keyPrefix}-${match.index}`} className="text-[var(--nw-text-primary)] font-semibold">{match[1]}</strong>)
    } else if (match[2]) {
      parts.push(<em key={`i-${keyPrefix}-${match.index}`} className="text-[var(--nw-text-secondary)] italic">{match[2]}</em>)
    } else if (match[3]) {
      parts.push(<del key={`s-${keyPrefix}-${match.index}`} className="text-[var(--nw-text-muted)] line-through">{match[3]}</del>)
    } else if (match[4] && match[5]) {
      parts.push(
        <a key={`a-${keyPrefix}-${match.index}`} href={match[5]} target="_blank" rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline">{match[4]}</a>
      )
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}
