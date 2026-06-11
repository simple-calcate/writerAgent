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
    <div ref={ref} className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 min-w-[100px]" style={{ left: x, top: y }}>
      {items.map((item, i) => (
        <button key={i} onClick={() => { item.action(); onClose() }} className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${item.danger ? 'text-red-400 hover:bg-red-600/20' : 'text-gray-300 hover:bg-gray-700'}`}>
          {item.label}
        </button>
      ))}
    </div>
  )
}

export function RenameInput({ value, onConfirm, onCancel }: { value: string; onConfirm: (v: string) => void; onCancel: () => void }) {
  const [text, setText] = useState(value)
  return (
    <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') onConfirm(text.trim()); if (e.key === 'Escape') onCancel() }} onBlur={() => onConfirm(text.trim())} className="flex-1 bg-gray-700 border border-blue-500 rounded px-2 py-1 text-xs focus:outline-none" autoFocus onClick={e => e.stopPropagation()} />
  )
}

export function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 transition-colors w-full text-left border-b border-gray-700/50">
      <span className="text-[10px]">◀</span>
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
