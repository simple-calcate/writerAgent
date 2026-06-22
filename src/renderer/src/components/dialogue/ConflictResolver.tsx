export default function ConflictResolver({ conflicts }: { conflicts: string[] }) {
  if (conflicts.length === 0) return null

  return (
    <div className="rounded-md bg-[--surface-1] shadow-[0_0_0_1px_rgba(255,255,255,0.04)] p-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
        <span className="text-[11px] text-yellow-400">冲突</span>
        <span className="text-[10px] text-[--text-muted]">{conflicts.length}</span>
      </div>
      <div className="space-y-1">
        {conflicts.slice(-3).map((c, i) => (
          <div key={i} className="text-[11px] text-[--text-secondary] px-2 py-1 rounded bg-yellow-500/5 border border-yellow-500/10">
            {c}
          </div>
        ))}
        {conflicts.length > 3 && (
          <p className="text-[9px] text-[--text-muted] pl-2">+{conflicts.length - 3} 更多</p>
        )}
      </div>
    </div>
  )
}
