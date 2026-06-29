import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { useAppStore } from './stores/useAppStore'
import { useVisualTheme } from './hooks/useVisualTheme'
import Sidebar from './components/Sidebar'
import Editor from './components/editor'
import RightPanel from './components/RightPanel'
import ResizeHandle from './components/ResizeHandle'
import BackgroundLayer from './components/BackgroundLayer'
import MouseGlow from './components/MouseGlow'
import RainEffect from './components/RainEffect'
import ErrorBoundary from './components/ErrorBoundary'
import LoadingFallback from './components/LoadingFallback'

// 非首屏组件懒加载（按需显示 / 始终挂载但可延后）
const Settings = lazy(() => import('./components/Settings'))
const HistoryPanel = lazy(() => import('./components/HistoryPanel'))
const ImportPreviewDialog = lazy(() => import('./components/ImportPreviewDialog'))
const SkillImportPreview = lazy(() => import('./components/SkillImportPreview'))
const UpdateBanner = lazy(() => import('./components/UpdateBanner'))
const WhatsNewDialog = lazy(() => import('./components/WhatsNewDialog'))
const ReasoningPanel = lazy(() => import('./components/ReasoningPanel'))

const MIN_SIDEBAR = 160
const MAX_SIDEBAR = 400
const MIN_RIGHT = 240
const MAX_RIGHT = 800

function loadWidth(key: string, fallback: number): number {
  try {
    const v = localStorage.getItem(key)
    if (v) {
      const n = parseInt(v, 10)
      if (!isNaN(n)) return n
    }
  } catch { /* ignore */ }
  return fallback
}

export default function App() {
  useVisualTheme()
  const {
    loadProjects,
    loadLLMConfig,
    showSettings,
    toggleSettings,
    showSidebar,
    rightPanel,
    showReasoningPanel,
    reasoningSessionId,
    reasoningChainName,
    reasoningSteps,
    reasoningStepResults,
    reasoningStatus,
    reasoningIncludeInContext,
    toggleReasoningPanel,
    _handleReasoningStart,
    _handleReasoningStepStart,
    _handleReasoningStepDone,
    _handleReasoningStepError,
    _handleReasoningDone
  } = useAppStore()

  const [sidebarWidth, setSidebarWidth] = useState(() => loadWidth('nw-sidebar-w', 256))
  const [rightWidth, setRightWidth] = useState(() => loadWidth('nw-right-w', 320))
  const [whatsNewVersion, setWhatsNewVersion] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  // Set up reasoning event listeners
  useEffect(() => {
    const unsubStart = window.api.onReasoningStart?.(_handleReasoningStart)
    const unsubStepStart = window.api.onReasoningStepStart?.(_handleReasoningStepStart)
    const unsubStepDone = window.api.onReasoningStepDone?.(_handleReasoningStepDone)
    const unsubStepError = window.api.onReasoningStepError?.(_handleReasoningStepError)
    const unsubDone = window.api.onReasoningDone?.(_handleReasoningDone)

    return () => {
      unsubStart?.()
      unsubStepStart?.()
      unsubStepDone?.()
      unsubStepError?.()
      unsubDone?.()
    }
  }, [_handleReasoningStart, _handleReasoningStepStart, _handleReasoningStepDone, _handleReasoningStepError, _handleReasoningDone])

  useEffect(() => {
    // Load critical data first
    loadProjects()
    loadLLMConfig().then(() => {
      setReady(true)
      const config = useAppStore.getState().llmConfig
      const hasValidProfile = config.profiles.some(p => p.apiKey.trim())

      if (!hasValidProfile) {
        useAppStore.getState().toggleSettings()
      } else {
        // Check version after UI is ready
        window.api.getAppVersion().then(currentVersion => {
          const lastSeen = localStorage.getItem('nw-last-version')
          if (lastSeen && lastSeen !== currentVersion) {
            setWhatsNewVersion(currentVersion)
          }
          localStorage.setItem('nw-last-version', currentVersion)
        })
      }
    })
  }, [loadProjects, loadLLMConfig])

  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth(prev => {
      const next = Math.max(MIN_SIDEBAR, Math.min(MAX_SIDEBAR, prev + delta))
      localStorage.setItem('nw-sidebar-w', String(next))
      return next
    })
  }, [])

  const handleRightResize = useCallback((delta: number) => {
    setRightWidth(prev => {
      const next = prev - delta
      if (next < MIN_RIGHT) {
        useAppStore.getState().setRightPanel(null)
        return prev
      }
      const clamped = Math.min(MAX_RIGHT, next)
      localStorage.setItem('nw-right-w', String(clamped))
      return clamped
    })
  }, [])

  return (
    <div className="h-screen flex flex-col">
      <BackgroundLayer />
      <MouseGlow />
      <RainEffect />

      {/* Title bar */}
      <div className="relative z-[1] flex items-center justify-between px-4 py-2 glass-panel border-b select-none">
        <div className="flex items-center gap-2">
          <button
            onClick={() => useAppStore.getState().toggleSidebar()}
            className="text-gray-400 hover:text-gray-200 text-sm px-2 py-1 rounded-md hover:bg-white/5 transition-all"
            title={showSidebar ? '隐藏侧栏' : '显示侧栏'}
          >
            {showSidebar ? '◀' : '▶'}
          </button>
          <h1 className="text-sm font-medium text-[var(--nw-text-secondary)] tracking-wide">网文写作助手</h1>
        </div>
        <div className="flex items-center gap-2">
          <ErrorBoundary name="更新检查">
            <Suspense fallback={<div className="h-6" />}>
              <UpdateBanner />
            </Suspense>
          </ErrorBoundary>
          <button
            onClick={toggleSettings}
            className="text-[12px] text-gray-400 hover:text-gray-200 px-3 py-1 rounded-md hover:bg-white/5 transition-all"
          >
            ⚙ 设置
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-[1] flex-1 flex overflow-hidden">
        {showSidebar && (
          <>
            <ErrorBoundary name="侧栏">
              <Sidebar width={sidebarWidth} />
            </ErrorBoundary>
            <ResizeHandle onResize={handleSidebarResize} />
          </>
        )}

        {/* Center area - Editor or Reasoning Panel */}
        {showReasoningPanel && reasoningStatus !== 'idle' ? (
          <div className="flex-1 flex flex-col min-w-0 bg-[var(--nw-bg-color)]">
            {/* Tab bar */}
            <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[#2a3347] bg-[var(--nw-surface-1)]">
              <button
                onClick={toggleReasoningPanel}
                className="px-3 py-1 text-[11px] text-[var(--nw-text-muted)] hover:text-[var(--nw-text-primary)] hover:bg-[var(--nw-surface-2)] rounded-md transition-colors"
              >
                ← 返回编辑
              </button>
              <div className="flex-1" />
              <span className="text-[10px] text-[var(--nw-accent)] font-medium tracking-wide">🧠 推理分析</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <ErrorBoundary name="推理面板">
                <Suspense fallback={<LoadingFallback label="加载推理面板" />}>
                  <ReasoningPanel
                    sessionId={reasoningSessionId}
                    chainName={reasoningChainName}
                    steps={reasoningSteps}
                    stepResults={reasoningStepResults}
                    status={reasoningStatus}
                    includeInContext={reasoningIncludeInContext}
                    onClose={toggleReasoningPanel}
                  />
                </Suspense>
              </ErrorBoundary>
            </div>
          </div>
        ) : (
          <ErrorBoundary name="编辑器">
            <Editor />
          </ErrorBoundary>
        )}

        {rightPanel && <ResizeHandle onResize={handleRightResize} />}
        <ErrorBoundary name="右侧面板">
          <RightPanel width={rightWidth} />
        </ErrorBoundary>
      </div>

      {/* Reasoning indicator - show when reasoning is running but panel is closed */}
      {reasoningStatus === 'running' && !showReasoningPanel && (
        <button
          onClick={toggleReasoningPanel}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 px-4 py-2.5 bg-[var(--nw-accent)] hover:bg-[var(--nw-accent-hover)] text-white rounded-xl shadow-lg shadow-[var(--nw-accent-glow)] transition-all duration-200 hover:shadow-xl"
        >
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span className="text-[12px] font-medium">推理进行中...</span>
        </button>
      )}

      {/* Modals - 懒加载，Suspense 包裹 */}
      {showSettings && (
        <ErrorBoundary name="设置">
          <Suspense fallback={<LoadingFallback label="加载设置" />}>
            <Settings />
          </Suspense>
        </ErrorBoundary>
      )}
      {whatsNewVersion && (
        <ErrorBoundary name="更新日志">
          <Suspense fallback={<LoadingFallback label="加载更新日志" />}>
            <WhatsNewDialog
              version={whatsNewVersion}
              onClose={() => setWhatsNewVersion(null)}
            />
          </Suspense>
        </ErrorBoundary>
      )}
      <ErrorBoundary name="历史面板">
        <Suspense fallback={null}>
          <HistoryPanel />
        </Suspense>
      </ErrorBoundary>
      <ErrorBoundary name="导入预览">
        <Suspense fallback={null}>
          <ImportPreviewDialog />
        </Suspense>
      </ErrorBoundary>
      <ErrorBoundary name="技能导入">
        <Suspense fallback={null}>
          <SkillImportPreview />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}
