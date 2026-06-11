// ─── Helpers ──────────────────────────────────────────────

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Plain text (with \n\n paragraphs) → HTML paragraphs */
export function plainTextToHtml(text: string): string {
  if (!text) return '<p><br></p>'
  const paragraphs = text.split(/\n\n+/)
  const html = paragraphs.map(p => {
    const trimmed = p.trim()
    if (!trimmed) return ''
    if (trimmed.startsWith('//')) {
      return `<p class="comment">${escapeHtml(trimmed)}</p>`
    }
    const inner = escapeHtml(trimmed).replace(/\n/g, '<br>')
    return `<p>${inner}</p>`
  }).filter(Boolean).join('')
  return html || '<p><br></p>'
}

/** contentEditable DOM → plain text with \n\n paragraph separators */
export function htmlToPlainText(container: HTMLElement): string {
  const paragraphs: string[] = []
  for (const child of Array.from(container.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement
      const tag = el.tagName.toLowerCase()
      if (tag === 'p' || tag === 'div') {
        paragraphs.push(el.innerText)
      }
    }
  }
  return paragraphs.join('\n\n')
}

/** Get cursor position as a plain-text character offset within the editor */
export function getCursorOffset(container: HTMLElement): number {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return 0
  const range = sel.getRangeAt(0)

  let offset = 0
  const paragraphs = container.querySelectorAll('p')
  for (const p of paragraphs) {
    if (p.contains(range.startContainer)) {
      const preRange = document.createRange()
      preRange.selectNodeContents(p)
      preRange.setEnd(range.startContainer, range.startOffset)
      offset += preRange.toString().length
      break
    } else {
      offset += p.innerText.length + 2
    }
  }
  return offset
}

/** Set cursor at a plain-text character offset within the editor */
export function setCursorAtOffset(container: HTMLElement, targetOffset: number) {
  const paragraphs = container.querySelectorAll('p')
  let accumulated = 0

  for (const p of paragraphs) {
    const text = p.innerText
    const paraLen = text.length

    if (accumulated + paraLen >= targetOffset) {
      const localOffset = Math.max(0, Math.min(targetOffset - accumulated, paraLen))
      const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT)
      let charCount = 0
      while (walker.nextNode()) {
        const node = walker.currentNode as Text
        if (charCount + node.length >= localOffset) {
          try {
            const range = document.createRange()
            range.setStart(node, localOffset - charCount)
            range.collapse(true)
            const sel = window.getSelection()
            if (sel) {
              sel.removeAllRanges()
              sel.addRange(range)
            }
          } catch { /* ignore range errors */ }
          // Scroll into view + flash highlight
          p.scrollIntoView({ behavior: 'smooth', block: 'center' })
          p.classList.add('polish-preview-flash')
          p.addEventListener('animationend', () => p.classList.remove('polish-preview-flash'), { once: true })
          return
        }
        charCount += node.length
      }
      break
    }
    accumulated += paraLen + 2
  }
}
