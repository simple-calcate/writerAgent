import { useCallback, useRef, useState } from 'react'

interface ResizeHandleProps {
  onResize: (delta: number) => void
  onDoubleClick?: () => void
}

export default function ResizeHandle({ onResize, onDoubleClick }: ResizeHandleProps) {
  const dragging = useRef(false)
  const lastX = useRef(0)
  const [isHover, setIsHover] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    lastX.current = e.clientX
    setIsDragging(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const delta = e.clientX - lastX.current
      lastX.current = e.clientX
      onResize(delta)
    }

    const handleMouseUp = () => {
      dragging.current = false
      setIsDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [onResize])

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
      onDoubleClick={onDoubleClick}
      className="relative shrink-0 cursor-col-resize z-10 group"
      style={{ width: '6px' }}
      title={onDoubleClick ? '拖拽调整宽度 · 双击重置' : '拖拽调整宽度'}
    >
      {/* 背景轨道 */}
      <div
        className="absolute inset-y-0 left-1/2 -translate-x-1/2 rounded-full transition-all duration-200"
        style={{
          width: isDragging ? '3px' : (isHover ? '2.5px' : '1px'),
          backgroundColor: isDragging
            ? 'var(--nw-accent)'
            : (isHover ? 'var(--nw-accent)' : 'var(--nw-border)')
        }}
      />
      {/* 中间抓手指示点（hover/drag 时显示） */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-200"
        style={{
          width: isDragging ? '8px' : (isHover ? '6px' : '0px'),
          height: isDragging ? '24px' : (isHover ? '20px' : '0px'),
          backgroundColor: 'var(--nw-accent)',
          opacity: isDragging ? 1 : (isHover ? 0.7 : 0)
        }}
      />
    </div>
  )
}
