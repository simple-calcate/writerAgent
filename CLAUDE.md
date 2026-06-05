# 网文写作助手

## 项目概述
Electron 桌面应用，网文写作辅助工具。技术栈：React + TypeScript + Zustand + TailwindCSS + SQLite。
功能：AI 润色、章节摘要、AI 对话、续写建议、大纲管理、版本历史、导入导出。

## 代码库地图

```
src/
├── main/                    # Electron 主进程
│   ├── index.ts             # IPC handler 入口（624行，grep 'ipcMain.handle(' 定位）
│   ├── llm/                 # AI 调用层
│   │   ├── client.ts        # 润色/摘要/诊断（455行）
│   │   ├── dialogue.ts      # 对话流控制（495行）
│   │   ├── dialogue-tools.ts # 对话工具定义（1082行，最复杂）
│   │   ├── dialogue-prompts.ts # 对话提示词（436行）
│   │   ├── continuation.ts  # 续写建议
│   │   ├── streaming.ts     # 流式传输工具
│   │   ├── feature-skills.ts # 功能技能
│   │   └── reasoning-chains.ts # 推理链
│   ├── store/db.ts          # SQLite CRUD（663行）
│   ├── import-parser.ts     # TXT 导入解析
│   └── updater.ts           # 自动更新
├── preload/                 # IPC 桥接（contextBridge）
├── renderer/src/            # 前端 UI
│   ├── App.tsx              # 根组件
│   ├── stores/              # Zustand 状态管理
│   │   ├── useAppStore.ts   # 核心 store（1422行，按功能域分块）
│   │   ├── useVisualStore.ts
│   │   └── slices/          # 状态切片
│   │       ├── dialogueSlice.ts         # 对话状态（280行）
│   │       ├── dialogueStreamHandlers.ts # 对话流处理器（146行）
│   │       └── ...其他切片
│   ├── components/          # UI 组件
│   │   ├── Editor.tsx       # 编辑器（659行）
│   │   ├── DialoguePanel.tsx # 对话面板（509行）
│   │   ├── Settings.tsx     # 设置页（1413行）
│   │   ├── Sidebar.tsx      # 侧边栏导航（866行）
│   │   ├── dialogue/        # 对话相关组件
│   │   │   ├── ToolCallCard.tsx      # 工具调用卡片（103行）
│   │   │   ├── ThinkingIndicator.tsx # 思考指示器（58行）
│   │   │   ├── QuickReplyGroups.tsx  # 快速回复组（160行）
│   │   │   ├── markdownRenderer.tsx  # Markdown渲染器（186行）
│   │   │   └── index.ts              # 导出入口
│   │   └── ...其他组件
│   ├── hooks/               # 自定义 hooks
│   └── styles/              # 全局样式
└── shared/                  # 主进程/渲染进程共享
    ├── types.ts             # 类型定义中心（772行）
    └── novel-knowledge.ts   # 小说知识库
```

## 构建与运行

| 命令 | 用途 |
|------|------|
| `npm run dev` | 开发模式（热重载） |
| `npm run build` | 构建（含 JS 混淆） |
| `npm run dist` | 打包安装程序 |
| `npx tsc --noEmit` | 类型检查（不生成文件） |

## 架构要点

- **IPC 通信**：渲染进程通过 preload 桥接调用主进程，不能直接访问 Node API
- **状态管理**：Zustand 单 store（useAppStore.ts），按功能域分块
- **AI 配置**：支持多 profile、按功能绑定不同模型（润色/摘要/对话/精炼）
- **数据存储**：SQLite（better-sqlite3），数据路径可自定义

## 致命坑点

1. **不要直接读整个大文件**：useAppStore.ts（1422行）、Settings.tsx（1413行）、dialogue-tools.ts（1082行）——先 grep 定位，再用 Read(offset, limit) 读取上下文
2. **shared/types.ts 是类型中心**：改动会影响主进程和渲染进程，修改前检查两端引用
3. **渲染进程不能调 Node API**：必须通过 preload/index.ts 的 contextBridge 桥接
4. **IPC handler 在 index.ts 的 registerIPC() 中**：624 行，grep 'ipcMain.handle(' 定位具体 handler

## Claude 工作规则

1. **任务起点**：先读本文件 → 定位目标目录 → grep 关键词 → 读具体文件
2. **禁止无目的全局搜索**：每次搜索必须有明确目标
3. **修改前先定位**：grep 找到精确行号 → Read(offset, limit) 读上下文
4. **跨文件改动**：先列清单，逐文件修改，每改完一个验证 `npx tsc --noEmit`
5. **子目录规则**：各子目录有独立 CLAUDE.md，自动加载
