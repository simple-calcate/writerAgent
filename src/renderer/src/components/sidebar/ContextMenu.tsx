import { useState, useEffect, useRef } from 'react'

export interface MenuItem {
  label: string
  action: () => void
  danger?: boolean
}

export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])
  return (
    <div ref={ref} className="fixed z-50 bg-[var(--nw-surface-2)] border border-white/12 rounded-lg shadow-xl py-1.5 min-w-[120px]" style={{ left: x, top: y }}>
      {items.map((item, i) => (
        <button key={i} onClick={() => { item.action(); onClose() }} className={`w-full text-left px-3.5 py-2 text-[12px] transition-colors ${item.danger ? 'text-red-400 hover:bg-red-600/15' : 'text-[var(--nw-text-secondary)] hover:bg-[var(--nw-surface-1)] hover:text-[var(--nw-text-primary)]'}`}>
          {item.label}
        </button>
      ))}
    </div>
  )
}

export function RenameInput({ value, onConfirm, onCancel }: { value: string; onConfirm: (v: string) => void; onCancel: () => void }) {
  const [text, setText] = useState(value)
  return (
    <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') onConfirm(text.trim()); if (e.key === 'Escape') onCancel() }} onBlur={() => onConfirm(text.trim())} className="flex-1 bg-[var(--nw-surface-1)] border border-[var(--nw-accent)] rounded-md px-2.5 py-1.5 text-[12px] text-[var(--nw-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--nw-accent-glow)]" autoFocus onClick={e => e.stopPropagation()} />
  )
}

export function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 px-3.5 py-2.5 text-[12px] text-[var(--nw-text-muted)] hover:text-[var(--nw-text-primary)] hover:bg-[var(--nw-surface-1)] transition-colors w-full text-left border-b border-[var(--nw-panel-border)]">
      <span className="text-[11px]">◀</span>
      <span className="truncate">{label}</span>
    </button>
  )
}

export function SlidePanel({ active, direction, children }: { active: boolean; direction: 'left' | 'right'; children: React.ReactNode }) {
  const translateClass = active ? 'translate-x-0' : direction === 'left' ? '-translate-x-full' : 'translate-x-full'
  return (
    <div className={`absolute inset-0 transition-transform duration-200 ease-out ${translateClass} flex flex-col`}>
      {children}
    </div>
  )
}
