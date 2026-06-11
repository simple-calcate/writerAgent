# 网文写作助手

## 项目概述
Electron 桌面应用，网文写作辅助工具。技术栈：React + TypeScript + Zustand + TailwindCSS + SQLite。
功能：AI 润色、章节摘要、AI 对话、续写建议、大纲管理、版本历史、导入导出。

## 代码库地图

```
src/
├── main/                         # Electron 主进程
│   ├── index.ts                  # 入口（~50行，调用 registerIPC）
│   ├── ipc-handlers/             # IPC handler 分模块注册
│   │   ├── ai.ts                 # AI 相关 handler
│   │   ├── data.ts               # 数据 CRUD handler
│   │   └── config.ts             # 配置/更新/视觉效果 handler
│   ├── llm/                      # AI 调用层
│   │   ├── client.ts             # createClient + re-export
│   │   ├── client-polish.ts      # 润色功能（autoPolish, polishText）
│   │   ├── client-summary.ts     # 摘要 + 诊断（summarizeChapter, diagnoseLocalModel）
│   │   ├── dialogue.ts           # re-export 入口
│   │   ├── dialogue-reasoning.ts # 推理链执行
│   │   ├── dialogue-stream.ts    # 对话流控制
│   │   ├── dialogue-tools.ts     # re-export 入口
│   │   ├── tools/                # 对话工具（模块化）
│   │   │   ├── definitions.ts    # 工具定义（getDialogueTools）
│   │   │   ├── helpers.ts        # 辅助函数（needsApproval, checkCache 等）
│   │   │   ├── executor.ts       # 工具执行器（executeTool）
│   │   │   └── index.ts          # barrel file
│   │   ├── dialogue-prompts.ts   # 对话提示词
│   │   ├── continuation.ts       # 续写建议
│   │   ├── streaming.ts          # 流式传输工具
│   │   ├── feature-skills.ts     # 功能技能
│   │   ├── refine-summary.ts     # 精炼总结
│   │   └── reasoning-chains.ts   # 推理链
│   ├── store/                    # 数据存储
│   │   ├── db.ts                 # barrel file（re-export 所有 CRUD）
│   │   ├── db-core.ts            # Store 初始化、迁移、save
│   │   ├── db-projects.ts        # 项目 CRUD
│   │   ├── db-chapters.ts        # 章节 + 卷 + 版本 CRUD
│   │   └── db-config.ts          # LLM 配置、对话、大纲、技能、推理链 CRUD
│   ├── import-parser.ts          # TXT 文件导入解析
│   └── updater.ts                # 自动更新
├── preload/                      # IPC 桥接（contextBridge）
│   └── index.ts
├── renderer/src/                 # 前端 UI
│   ├── App.tsx                   # 根组件
│   ├── stores/                   # Zustand 状态管理
│   │   ├── useAppStore.ts        # 核心 store（按功能域分块）
│   │   ├── useVisualStore.ts     # 视觉效果状态
│   │   └── slices/               # 状态切片
│   │       ├── dialogueSlice.ts
│   │       ├── dialogueStreamHandlers.ts
│   │       └── ...其他切片
│   ├── components/               # UI 组件
│   │   ├── Settings.tsx          # 设置页主容器（re-export）
│   │   ├── settings/             # 设置页子模块
│   │   │   ├── ApiTab.tsx        # API 配置 Tab
│   │   │   ├── AIFeatureTab.tsx  # AI 功能 Tab
│   │   │   ├── tabs/             # 其他 Tab 组件
│   │   │   └── components/       # 设置页子组件
│   │   ├── Sidebar.tsx           # 侧边栏（re-export）
│   │   ├── sidebar/              # 侧边栏子模块
│   │   │   ├── ContextMenu.tsx   # 共享 UI 组件
│   │   │   ├── ProjectsLevel.tsx # Level 1: 项目列表
│   │   │   ├── ProjectLevel.tsx  # Level 2: 项目内容
│   │   │   ├── VolumeLevel.tsx   # Level 3: 卷内容
│   │   │   ├── ChapterLevel.tsx  # Level 4: 章节
│   │   │   ├── AIConfigLevel.tsx # Level 5: AI 配置
│   │   │   └── index.tsx         # Sidebar 主组件
│   │   ├── editor/               # 编辑器子模块
│   │   │   ├── helpers.ts        # 工具函数
│   │   │   ├── Editor.tsx        # 编辑器主组件
│   │   │   └── index.ts          # re-export
│   │   ├── right-panel/          # 右侧面板子模块
│   │   │   ├── ThinkingIndicator.tsx
│   │   │   ├── RightPanel.tsx
│   │   │   └── index.ts
│   │   ├── dialogue-panel/       # 对话面板子模块
│   │   │   ├── ApprovalCard.tsx
│   │   │   ├── DialoguePanel.tsx
│   │   │   └── index.ts
│   │   └── dialogue/             # 对话相关组件
│   │       ├── ToolCallCard.tsx
│   │       ├── ThinkingIndicator.tsx
│   │       ├── QuickReplyGroups.tsx
│   │       ├── markdownRenderer.tsx
│   │       └── index.ts
│   ├── hooks/                    # 自定义 hooks
│   └── styles/                   # 全局样式
└── shared/                       # 主进程/渲染进程共享
    ├── types.ts                  # re-export 入口
    ├── types/                    # 类型定义（模块化）
    │   ├── api.ts                # API 配置类型
    │   ├── models.ts             # 数据模型
    │   ├── dialogue.ts           # 对话相关类型
    │   ├── ipc.ts                # IPC 接口定义
    │   ├── builtin-skills.ts     # 内置技能数据
    │   └── index.ts              # barrel file
    └── novel-knowledge.ts        # 小说知识库
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
- **数据存储**：JSON 文件存储（store.json），数据路径可自定义
- **模块化拆分**：大文件已按功能域拆分为子模块，原文件作为 re-export 入口保持向后兼容

## 致命坑点

1. **不要直接读整个大文件**：先 grep 定位，再用 Read(offset, limit) 读取上下文
2. **shared/types/ 是类型中心**：改动会影响主进程和渲染进程，修改前检查两端引用
3. **渲染进程不能调 Node API**：必须通过 preload/index.ts 的 contextBridge 桥接
4. **IPC handler 在 ipc-handlers/ 目录中**：按功能域分为 ai.ts、data.ts、config.ts
5. **re-export 入口**：原文件（如 db.ts、dialogue.ts）是 barrel file，实际实现在子模块中

## Claude 工作规则

1. **任务起点**：先读本文件 → 定位目标目录 → grep 关键词 → 读具体文件
2. **禁止无目的全局搜索**：每次搜索必须有明确目标
3. **修改前先定位**：grep 找到精确行号 → Read(offset, limit) 读上下文
4. **跨文件改动**：先列清单，逐文件修改，每改完一个验证 `npx tsc --noEmit`
5. **子目录规则**：各子目录有独立 CLAUDE.md，自动加载
