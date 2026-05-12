# 网文写作助手

桌面端网文写作辅助工具，基于 Electron + React + TypeScript。

## 功能

- **AI 润色分析** — 自动扫描章节，找出需要优化的片段
- **实时预览** — 点击建议卡片，编辑器直接显示润色效果，确认后替换
- **原始追溯** — 每处润色保留原文，hover 查看优化理由
- **项目管理** — 多项目/多章节，自动保存
- **自接 API** — 支持任何 OpenAI 兼容接口（OpenAI / DeepSeek / Moonshot 等）

## 快速开始

```bash
npm install
npm run dev
```

## API 配置

启动后点击右上角「设置」，填入：
- **API Key** — 你的 API 密钥
- **Base URL** — API 端点地址（默认 `https://api.openai.com/v1`）
- **模型** — 模型名称（默认 `gpt-4o-mini`）

## 技术栈

- Electron 33
- React 18 + TypeScript
- Vite (electron-vite)
- Zustand 状态管理
- Tailwind CSS
