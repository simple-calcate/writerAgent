# 网文写作助手 / Novel Writer

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/simple-calcate/writerAgent)](../../releases)

> **它不替你写，它帮你写得更好。**
> **It doesn't write for you — it helps you write better.**

AI 深度整合的桌面端网文写作工具，覆盖润色、大纲、摘要、对话、续写全流程。
A desktop writing companion that integrates AI into your entire workflow: polishing, outlining, summarizing, dialogue, and continuation.

---

[English](#english) | 中文

---

## 功能概览

### 💬 AI 对话 — 真正读懂你故事的写作顾问

AI 不是通用聊天机器人，它**读过你写的一切**：书卷大纲、章节大纲、全文、摘要。

**三级对话，精准指导：**

| 层级 | 能力 | 典型场景 |
|------|------|----------|
| **书籍** | 规划下卷、世界观构建、整体节奏 | "新势力怎么跟前面的伏笔呼应？" |
| **卷** | 章节规划、节奏分析、伏笔建议 | "高潮放在哪？过渡怎么处理？" |
| **章节** | 场景展开、描写润色、对话风格 | "这场打斗怎么写得更生动？" |

**内置工具 — AI 能直接操作你的小说：**

| 工具 | 说明 |
|------|------|
| 创建章节 | AI 规划剧情后创建新章节并关联到对应卷 |
| 写大纲 | 让 AI 撰写书籍/卷/章节大纲 |
| 写正文 | AI 根据大纲和前文撰写章节正文 |
| 读内容 | AI 可随时读取任意章节的正文和摘要 |

每次操作都会弹出确认对话框 — 你始终掌控一切。

**计划模式 — AI 自动执行复杂任务：**

告诉 AI 你的想法，它会：
1. 提出两个方案（稳妥路线 + 创意路线）
2. 等你确认或调整
3. 自动执行：创建章节 → 写大纲 → 填充正文，每一步都可干预

### ✨ 智能润色 — 你的私人编辑

选中章节，全篇扫描，AI 找出最需要改进的 5 个段落：
- 点击建议卡片在编辑器中**预览**润色效果
- 接受或跳过，原文始终保留
- 每处修改附带理由，助你成长

### ⚡ 智能续写 — 停笔后的灵感

在章节末尾停笔，AI 根据正文和大纲自动建议续写：
- 编辑器中以灰色幽灵文字显示，不打断思路
- 按 `Tab` 接受，继续输入则消失
- 输入 `//` 注释可触发解释模式

### 📋 大纲系统 — 三级大纲管理

- **书籍大纲** — 整体故事骨架
- **卷大纲** — 每卷主线与支线
- **章节大纲** — 每章关键事件与转折点

AI 生成内容时自动参考相关大纲，确保剧情连贯。

### 📝 摘要与精炼 — 快速回顾

- **结构化摘要**：从人物、事件、伏笔、场景、情感五个维度分析章节
- **精炼总结**：一段话概括章节核心内容
- 支持批量精炼整卷摘要

### 🕐 版本控制 — 一键撤回

- 每次编辑自动保存
- 手动创建版本快照
- 浏览历史、对比差异、恢复任意版本

---

### 🎯 技能系统 — 自定义 AI 写作风格

从你的写作中提取技能，跨书复用：

- **5 个内置技能**：对话风格、场景描写、节奏把控、文风特征、人物塑造
- **自定义技能**：添加、编辑、删除、导入、导出
- **按功能搭载**：AI 对话、智能润色、章节摘要、智能续写、大纲撰写、正文撰写各自独立配置技能
- **AI 提取**：对话中可自动提取和优化技能

### 🔌 多 API 配置 — 灵活接入

支持**多个 API 配置**，每个 AI 功能独立绑定不同供应商：

```
润色    → OpenAI GPT-4o
摘要    → DeepSeek V3
对话    → 本地 Ollama
精炼    → Moonshot
```

**内置供应商快捷配置**，一键填入 Base URL 和默认模型：
OpenRouter · DeepSeek · OpenAI · Claude · 通义千问 · Moonshot · Ollama（完全本地离线）

### 🎨 视觉效果 — 打造你的写作空间

- **自定义背景**：支持图片和视频背景，可调节透明度和模糊度
- **毛玻璃效果**：面板采用毛玻璃设计，优雅通透
- **鼠标光晕**：鼠标周围淡淡的光晕，营造沉浸感
- **雨滴效果**：细密的雨滴动画，适合深夜码字
- **壁纸引擎接入**：可对接 Wallpaper Engine 的壁纸文件

### 🧠 推理链 — AI 写作前的系统性思考

推理链让 AI 在执行写大纲、写正文等任务前，先进行结构化分析：

**内置推理链：**
- **章节创作推理**：人物心理分析 → 人物关系变化 → 场景环境分析 → 动作与交互设计 → 情感节奏规划 → 整合创作指导
- **大纲规划推理**：主线梳理 → 支线分析 → 伏笔检查 → 节奏规划

**核心特性：**
- **自动触发**：绑定到写大纲、写正文等工具，执行前自动推理
- **手动触发**：对话中点击 🧠 按钮选择推理链
- **可配置上下文**：每个推理链可选择参考书籍大纲、卷大纲、章节大纲、前文摘要、对话历史
- **推理面板**：中间编辑器区域实时展示推理过程，支持 Markdown 渲染
- **防止重复**：同一轮对话中推理链只执行一次，AI 基于推理结果重新生成内容
- **自定义推理链**：创建、编辑、删除自定义推理链，设置触发方式和推理步骤

**使用方式：**
1. 书籍 AI 配置中将推理链绑定到指定工具
2. AI 调用该工具时自动执行推理
3. 推理结果反馈给 AI，生成更优质的内容

---

## 下载

| 版本 | 说明 |
|------|------|
| [GitHub 下载](https://github.com/simple-calcate/writerAgent/releases) | 国际源 |
| [Gitee 下载](https://gitee.com/simple-calcate/writerAgent/releases) | 国内源，更稳定 |

**安装包**：
- `novel-writer-setup-0.2.6-beta.0.exe` — 安装版，可选择安装目录
- `novel-writer-setup-0.2.6-beta.0.exe` — 便携版，双击即用

**系统要求**：Windows 10/11 64位

---

## 快速开始

```bash
npm install
npm run dev
```

打开设置 → 配置 API Key → 选择模型 → 开始写作。

首次启动会自动打开设置面板引导配置。

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Z` | 撤销 |
| `Ctrl+S` | 保存 |
| `Tab` | 接受续写建议 |

## 技术栈

Electron + React 18 + TypeScript + Zustand + Tailwind CSS + OpenAI SDK

---

## 许可证

本项目基于 [GNU AGPL v3.0](LICENSE) 许可。可自由使用、修改和分发，但修改后的代码也必须开源。

[下载最新版本](../../releases) · [反馈问题](../../issues)

---

<a id="english"></a>

# Novel Writer — AI-Powered Web Fiction Writing Tool

> **It doesn't write for you — it helps you write better.** A desktop writing companion that integrates AI into your entire workflow: polishing, outlining, summarizing, dialogue, and continuation.

## Features

### AI Dialogue — A Writing Advisor That Actually Knows Your Story

The AI isn't a generic chatbot — it has **read everything you've written**: book outline, volume outlines, chapter outlines, full text, and summaries.

**Three-level dialogue for precise guidance:**

| Level | Capabilities | Typical Scenarios |
|-------|-------------|-------------------|
| **Book** | Plan the next volume, world-building, overall pacing | "How should I connect the new faction to earlier foreshadowing?" |
| **Volume** | Chapter planning, pacing analysis, foreshadowing advice | "Where should the climax be? How to handle transitions?" |
| **Chapter** | Scene development, description polish, dialogue style | "How to make this fight scene more vivid?" |

**Built-in tools — AI can directly operate on your novel:**

| Tool | Description |
|------|-------------|
| **Create Chapter** | AI plans the plot, then creates a new chapter linked to the right volume |
| **Write Outline** | Have AI draft book outlines, volume outlines, or chapter outlines |
| **Write Content** | AI writes chapter text based on outlines and previous content |
| **Read Content** | AI can read any chapter's text and summary at any time |

Every action triggers a confirmation dialog — you're always in control.

**Plan Mode — AI executes complex tasks automatically:**

Tell the AI your idea and it will:
1. Propose two plans (safe route + creative route)
2. Wait for your approval or adjustments
3. Execute automatically: create chapter → write outline → fill content, with intervention at every step

### AI Polish — Your Personal Editor

Select a chapter, run a full scan, and AI identifies the 5 segments that need the most improvement:
- Click a suggestion card to **preview** the polish in the editor
- Accept what works, ignore what doesn't — the original is always preserved
- Every change comes with a reason to help you grow as a writer

### Smart Continuation — Inspiration After You Stop

Pause at the end of a chapter and AI automatically suggests a continuation based on your text and outline:
- Displayed as gray ghost text in the editor — no disruption to your flow
- Press `Tab` to accept; keep typing to dismiss
- Writing `//` comments triggers an explanation mode

### Outline System — Three-Level Outline Management

- **Book Outline** — The full story skeleton
- **Volume Outlines** — Main and sub-plots per volume
- **Chapter Outlines** — Key events and turning points per chapter

AI automatically references relevant outlines when generating content to ensure plot coherence.

### Summary & Refinement — Quick Recaps

- **Structured Summary**: Analyzes chapters across five dimensions — characters, events, foreshadowing, scenes, and emotions
- **Refined Summary**: One-paragraph recap of a chapter's core content
- Batch refinement of entire volume summaries

### Version Control — Undo with One Click

- Auto-save after every edit
- Manual version snapshots
- Browse history, compare diffs, restore any version

### Skill System — Customize Your AI Writing Style

Extract writing skills from your work and reuse them across books:

- **5 built-in skills**: Dialogue style, scene description, pacing control, writing characteristics, character building
- **Custom skills**: Add, edit, delete, import, export
- **Per-feature assignment**: AI Dialogue, Smart Polish, Chapter Summary, Smart Continuation, Outline Writing, and Content Writing each have independent skill configurations
- **AI extraction**: Automatically extract and refine skills during dialogue

### Multi-API Configuration — Flexible Integration

Supports **multiple API configurations**, with each AI feature independently bound to a different provider:

```
Polish    → OpenAI GPT-4o
Summary   → DeepSeek V3
Dialogue  → Local Ollama
Refine    → Moonshot
```

**Built-in provider shortcuts** with one-click Base URL and default model fill:
OpenRouter · DeepSeek · OpenAI · Claude · Qwen · Moonshot · Ollama (fully local, completely offline)

### Visual Effects — Create Your Writing Space

- **Custom Background**: Support image and video backgrounds with adjustable opacity and blur
- **Frosted Glass**: Panels use frosted glass design for an elegant, translucent look
- **Mouse Glow**: Subtle glow around the cursor for an immersive feel
- **Rain Effect**: Delicate rain drop animation, perfect for late-night writing sessions
- **Wallpaper Engine Integration**: Can connect to Wallpaper Engine wallpaper files

### 🧠 Reasoning Chains — Systematic Thinking Before Writing

Reasoning chains make AI perform structured analysis before executing tasks like writing outlines or content:

**Built-in Chains:**
- **Chapter Writing**: Character psychology → Relationship dynamics → Scene environment → Action design → Emotional pacing → Integrated guidance
- **Outline Planning**: Main plot梳理 → Subplot analysis → Foreshadowing check → Pacing planning

**Key Features:**
- **Auto-trigger**: Bind to writing tools, execute reasoning automatically before tool runs
- **Manual trigger**: Click 🧠 button in dialogue to select a reasoning chain
- **Configurable context**: Each chain can reference book outline, volume outline, chapter outline, previous summaries, dialogue history
- **Reasoning panel**: Real-time display of reasoning process in the center editor area with Markdown rendering
- **No repeats**: Each reasoning chain executes only once per dialogue round
- **Custom chains**: Create, edit, delete custom reasoning chains with custom triggers and steps

**Usage:**
1. Bind reasoning chain to a tool in Book AI Settings
2. AI automatically reasons before executing that tool
3. Reasoning results are fed back to AI for better content generation

---

## Download

| Version | Description |
|---------|-------------|
| [GitHub Releases](https://github.com/simple-calcate/writerAgent/releases) | International source |
| [Gitee Releases](https://gitee.com/simple-calcate/writerAgent/releases) | China mirror, more stable |

**Packages**:
- `novel-writer-setup-0.2.6-beta.0.exe` — Installer, choose installation directory
- `novel-writer-setup-0.2.6-beta.0.exe` — Portable version, double-click to run

**System Requirements**: Windows 10/11 64-bit

---

## Quick Start

```bash
npm install
npm run dev
```

Open Settings → Configure API Key → Select Model → Start Writing.

On first launch, the settings panel opens automatically to guide you through configuration.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` | Undo |
| `Ctrl+S` | Save |
| `Tab` | Accept continuation suggestion |

## Tech Stack

Electron + React 18 + TypeScript + Zustand + Tailwind CSS + OpenAI SDK

---

## License

This project is licensed under [GNU AGPL v3.0](LICENSE). You are free to use, modify, and distribute, but modified code must also be open-sourced.

[Download Latest Release](../../releases) · [Report Issues](../../issues)
