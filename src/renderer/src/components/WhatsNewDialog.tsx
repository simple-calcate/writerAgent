import { useState, useEffect } from 'react'

interface WhatsNewDialogProps {
  version: string
  onClose: () => void
}

// Release notes for each version
const RELEASE_NOTES: Record<string, string> = {
  '0.2.5': `## v0.2.5 更新内容

### 新手引导
- 首次打开自动弹出设置页，引导配置 API
- 推荐 DeepSeek，一键配置

### 本地模型支持
- Ollama 诊断功能，分阶段检测连接问题
- 诊断结果可复制，方便反馈

### Gitee 自动下载
- 更新失败时可从 Gitee 自动下载
- 无需手动打开浏览器

### 其他改进
- 更新面板显示更新日志
- 壁纸引擎集成
- 背景图缩放调整
- 鼠标光晕效果修复`,

  '0.2.4': `## v0.2.4 更新内容

### 新功能
- Gitee 自动下载更新
- 本地模型诊断功能

### 修复
- 修复鼠标光晕效果不显示`,

  '0.2.3': `## v0.2.3 更新内容

### 新功能
- 软件相关设置页
- QQ 群：892644653
- 壁纸引擎集成
- 背景图缩放调整

### 修复
- 壁纸引擎预览图正确加载`
}

function formatNotes(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '\n【$1】')
    .replace(/^## (.+)$/gm, '\n【$1】')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '  • ')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export default function WhatsNewDialog({ version, onClose }: WhatsNewDialogProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Small delay for smooth animation
    const timer = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 300)
  }

  // Get release notes for this version (or show generic message)
  const notes = RELEASE_NOTES[version] || `## v${version} 更新内容\n\n本次更新包含性能优化和问题修复。`

  return (
    <div
      className={`fixed inset-0 bg-black/60 flex items-center justify-center z-50 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
      onClick={handleClose}
    >
      <div
        className={`bg-[var(--nw-surface-2)] rounded-lg w-full max-w-md shadow-xl transition-transform duration-300 ${visible ? 'scale-100' : 'scale-95'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-medium text-[var(--nw-text-primary)]">🎉 更新成功</h2>
            <button onClick={handleClose} className="text-[var(--nw-text-muted)] hover:text-[var(--nw-text-secondary)] text-sm">✕</button>
          </div>
          <p className="text-xs text-[var(--nw-text-muted)] mb-3">已更新至 v{version}</p>
          <div className="text-xs text-[var(--nw-text-secondary)] bg-[var(--nw-surface-2)]/50 rounded p-3 max-h-64 overflow-y-auto whitespace-pre-wrap leading-relaxed">
            {formatNotes(notes)}
          </div>
          <button
            onClick={handleClose}
            className="w-full mt-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors"
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  )
}
