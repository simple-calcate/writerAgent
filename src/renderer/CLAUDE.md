# 渲染进程

## 关键文件

| 文件 | 行数 | 用途 |
|------|------|------|
| stores/useAppStore.ts | 41 | Zustand 组合入口 |
| stores/slices/*.ts | 1642 | 11 个独立 slice |
| stores/useVisualStore.ts | - | 视觉效果状态 |
| components/Settings.tsx | 736 | 设置页主容器 |
| components/settings/tabs/*.tsx | 488 | 设置页 Tab 组件 |
| components/settings/components/*.tsx | 204 | 设置页子组件 |
| components/DialoguePanel.tsx | 902 | AI 对话面板 |
| components/Editor.tsx | 659 | 富文本编辑器 |
| components/Sidebar.tsx | 866 | 侧边栏导航 |
| components/RightPanel.tsx | 541 | 右侧面板容器 |

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

## 设置页组件结构

```
components/settings/
├── tabs/
│   ├── SkillsTab.tsx       # 技能库
│   ├── ReasoningTab.tsx    # 推理链
│   ├── DataStorageTab.tsx  # 数据存储
│   └── AboutTab.tsx        # 软件相关
└── components/
    ├── UpdateCheckButton.tsx # 更新检查
    └── LocalModelDiag.tsx    # 本地模型诊断
```

## 样式系统

TailwindCSS，配置在项目根目录 tailwind.config.js。

## 常见任务

- **修改某个功能**：定位到对应 slice 文件
- **添加新组件**：在 components/ 下创建，从 useAppStore 读取状态
- **修改设置页**：定位到对应 Tab 组件
- **添加 IPC 调用**：通过 window.api（preload 桥接）
