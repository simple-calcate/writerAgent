import { useEffect } from 'react'
import { useAppStore } from './stores/useAppStore'
import Sidebar from './components/Sidebar'
import Editor from './components/Editor'
import PolishPanel from './components/PolishPanel'
import Settings from './components/Settings'

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
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 select-none">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSidebar}
            className="text-gray-400 hover:text-gray-200 text-sm"
            title="切换侧栏"
          >
            {showSidebar ? '<<' : '>>'}
          </button>
          <h1 className="text-sm font-semibold text-gray-200">网文写作助手</h1>
        </div>
        <button
          onClick={toggleSettings}
          className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-700 transition-colors"
        >
          设置
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {showSidebar && <Sidebar />}
        <Editor />
        <PolishPanel />
      </div>

      {/* Settings modal */}
      {showSettings && <Settings />}
    </div>
  )
}
