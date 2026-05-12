import { useEffect } from 'react'
import { useAppStore } from './stores/useAppStore'
import Sidebar from './components/Sidebar'
import Editor from './components/Editor'
import PolishPanel from './components/PolishPanel'
import Settings from './components/Settings'
import HistoryPanel from './components/HistoryPanel'

export default function App() {
  const {
    loadProjects,
    loadLLMConfig,
    showSettings,
    toggleSettings,
    showSidebar,
    toggleSidebar
  } = useAppStore()

  useEffect(() => {
    loadProjects()
    loadLLMConfig()
  }, [loadProjects, loadLLMConfig])

  return (
    <div className="h-screen flex flex-col">
      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800/80 border-b border-gray-700/60 select-none">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSidebar}
            className="text-gray-500 hover:text-gray-300 text-xs px-1.5 py-0.5 rounded hover:bg-gray-700 transition-colors"
            title={showSidebar ? '隐藏侧栏' : '显示侧栏'}
          >
            {showSidebar ? '◀' : '▶'}
          </button>
          <h1 className="text-xs font-medium text-gray-400">网文写作助手</h1>
        </div>
        <button
          onClick={toggleSettings}
          className="text-[11px] text-gray-500 hover:text-gray-300 px-2 py-0.5 rounded hover:bg-gray-700 transition-colors"
        >
          ⚙ 设置
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {showSidebar && <Sidebar />}
        <Editor />
        <PolishPanel />
      </div>

      {/* Modals */}
      {showSettings && <Settings />}
      <HistoryPanel />
    </div>
  )
}
