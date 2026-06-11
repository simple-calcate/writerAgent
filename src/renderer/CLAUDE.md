# 渲染进程

## 关键文件

| 文件 | 行数 | 用途 |
|------|------|------|
| stores/useAppStore.ts | - | Zustand 组合入口 |
| stores/slices/*.ts | - | 独立 slice |
| stores/useVisualStore.ts | - | 视觉效果状态 |
| components/Settings.tsx | ~340 | 设置页主容器 |
| components/settings/ApiTab.tsx | ~240 | API 配置 Tab |
| components/settings/AIFeatureTab.tsx | ~180 | AI 功能 Tab |
| components/settings/tabs/*.tsx | - | 其他 Tab 组件 |
| components/Sidebar.tsx | ~5 | 侧边栏（re-export） |
| components/sidebar/ | - | 侧边栏子模块（7 个文件） |
| components/editor/ | - | 编辑器子模块（3 个文件） |
| components/right-panel/ | - | 右侧面板子模块（3 个文件） |
| components/dialogue-panel/ | - | 对话面板子模块（3 个文件） |
| components/dialogue/ | - | 对话相关组件 |

## 状态管理结构（Zustand Slice Pattern）

store 拆分为独立 slice，修改时定位到对应文件：
| Slice | 文件 | 用途 |
|-------|------|------|
| projectSlice | stores/slices/projectSlice.ts | 项目 + 卷管理 |
| chapterSlice | stores/slices/chapterSlice.ts | 章节 CRUD + 撤销 |
| versionSlice | stores/slices/versionSlice.ts | 版本历史 |
| uiSlice | stores/slices/uiSlice.ts | 导航 + 面板 + 设置 |
| polishSlice | stores/slices/polishSlice.ts | 润色功能 |
| summarySlice | stores/slices/summarySlice.ts | 摘要 + 精炼 |
| dialogueSlice | stores/slices/dialogueSlice.ts | 对话功能 |
| continuationSlice | stores/slices/continuationSlice.ts | 续写建议 |
| skillSlice | stores/slices/skillSlice.ts | 技能管理 |
| reasoningSlice | stores/slices/reasoningSlice.ts | 推理链 |
| outlineSlice | stores/slices/outlineSlice.ts | 大纲管理 |
| importSlice | stores/slices/importSlice.ts | 导入功能 |

## 组件模块化结构

大组件已按功能域拆分为子模块，原文件作为 re-export 入口：

### 侧边栏 sidebar/
```
sidebar/
├── ContextMenu.tsx     # 共享 UI（ContextMenu, RenameInput, BackButton, SlidePanel）
├── ProjectsLevel.tsx   # Level 1: 项目列表
├── ProjectLevel.tsx    # Level 2: 项目内容
├── VolumeLevel.tsx     # Level 3: 卷内容
├── ChapterLevel.tsx    # Level 4: 章节操作
├── AIConfigLevel.tsx   # Level 5: AI 配置
└── index.tsx           # Sidebar 主组件
```

### 编辑器 editor/
```
editor/
├── helpers.ts    # 工具函数（escapeHtml, plainTextToHtml 等）
├── Editor.tsx    # 编辑器主组件
└── index.ts      # re-export
```

### 右侧面板 right-panel/
```
right-panel/
├── ThinkingIndicator.tsx  # 思考指示器
├── RightPanel.tsx         # 右侧面板主组件
└── index.ts               # re-export
```

### 对话面板 dialogue-panel/
```
dialogue-panel/
├── ApprovalCard.tsx    # 审批卡片 + 计划模式标记
├── DialoguePanel.tsx   # 对话面板主组件
└── index.ts            # re-export
```

### 设置页 settings/
```
settings/
├── ApiTab.tsx          # API 配置 Tab
├── AIFeatureTab.tsx    # AI 功能 Tab
├── tabs/               # 其他 Tab 组件
│   ├── SkillsTab.tsx
│   ├── ReasoningTab.tsx
│   ├── DataStorageTab.tsx
│   └── AboutTab.tsx
└── components/
    ├── UpdateCheckButton.tsx
    └── LocalModelDiag.tsx
```

## 样式系统

TailwindCSS，配置在项目根目录 tailwind.config.js。

## 常见任务

- **修改某个功能**：定位到对应 slice 文件
- **添加新组件**：在 components/ 下创建，从 useAppStore 读取状态
- **修改设置页**：定位到对应 Tab 组件或 ApiTab/AIFeatureTab
- **添加 IPC 调用**：通过 window.api（preload 桥接）
- **修改侧边栏**：定位到 sidebar/ 下对应 Level 文件
- **修改编辑器**：定位到 editor/ 下对应文件
