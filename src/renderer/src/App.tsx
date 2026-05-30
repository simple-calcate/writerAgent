import { useEffect, useState, useCallback } from 'react'
import { useAppStore } from './stores/useAppStore'
import { useVisualTheme } from './hooks/useVisualTheme'
import Sidebar from './components/Sidebar'
import Editor from './components/Editor'
import RightPanel from './components/RightPanel'
import Settings from './components/Settings'
import HistoryPanel from './components/HistoryPanel'
import ResizeHandle from './components/ResizeHandle'
import ImportPreviewDialog from './components/ImportPreviewDialog'
import SkillImportPreview from './components/SkillImportPreview'
import UpdateBanner from './components/UpdateBanner'
import BackgroundLayer from './components/BackgroundLayer'
import MouseGlow from './components/MouseGlow'
import RainEffect from './components/RainEffect'
import WhatsNewDialog from './components/WhatsNewDialog'
import ReasoningPanel from './components/ReasoningPanel'

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
      <div className="relative z-[1] flex items-center justify-between px-3 py-1.5 glass-panel border-b select-none">
        <div className="flex items-center gap-2">
          <button
            onClick={() => useAppStore.getState().toggleSidebar()}
            className="text-gray-500 hover:text-gray-300 text-xs px-1.5 py-0.5 rounded hover:bg-gray-700 transition-colors"
            title={showSidebar ? '隐藏侧栏' : '显示侧栏'}
          >
            {showSidebar ? '◀' : '▶'}
          </button>
          <h1 className="text-xs font-medium text-gray-400">网文写作助手</h1>
        </div>
        <div className="flex items-center gap-2">
          <UpdateBanner />
          <button
            onClick={toggleSettings}
            className="text-[11px] text-gray-500 hover:text-gray-300 px-2 py-0.5 rounded hover:bg-gray-700 transition-colors"
          >
            ⚙ 设置
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-[1] flex-1 flex overflow-hidden">
        {showSidebar && (
          <>
            <Sidebar width={sidebarWidth} />
            <ResizeHandle onResize={handleSidebarResize} />
          </>
        )}
        <Editor />
        {rightPanel && <ResizeHandle onResize={handleRightResize} />}
        <RightPanel width={rightWidth} />

        {/* Reasoning Panel */}
        {showReasoningPanel && (
          <div className="w-80 border-l border-gray-700 bg-gray-800/50 shrink-0">
            <ReasoningPanel
              sessionId={reasoningSessionId}
              chainName={reasoningChainName}
              steps={reasoningSteps}
              stepResults={reasoningStepResults}
              status={reasoningStatus}
              includeInContext={reasoningIncludeInContext}
              onClose={toggleReasoningPanel}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {showSettings && <Settings />}
      {whatsNewVersion && (
        <WhatsNewDialog
          version={whatsNewVersion}
          onClose={() => setWhatsNewVersion(null)}
        />
      )}
      <HistoryPanel />
      <ImportPreviewDialog />
      <SkillImportPreview />
    </div>
  )
}
