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

## 为什么需要 AI？为什么需要 Agent？

### 传统写作工具的问题

传统写作工具（Word、记事本、Scrivener）只能处理**文字的存储和排版**，不理解你在写什么。当你需要：

- 「这段打斗描写太平淡，帮我改得更有张力」→ 工具无能为力
- 「前 50 章埋的伏笔有哪些还没回收？」→ 只能自己翻
- 「接下来 3 章的节奏怎么安排？」→ 全凭经验

这些任务的本质是**需要"理解"文本**的能力 — 这正是 AI 大语言模型的核心能力。

### AI 解决了什么

大语言模型（LLM）通过海量文本训练，获得了**语义理解**能力：

| 能力 | 传统工具 | AI |
|------|----------|-----|
| 文本润色 | 只能查拼写 | 理解语义，改写表达 |
| 剧情分析 | 无 | 理解人物关系、伏笔、节奏 |
| 内容生成 | 无 | 根据上下文续写、扩写 |
| 知识检索 | 关键词匹配 | 语义搜索、实时联网 |

**但单纯的 AI 对话是不够的。**

### 为什么需要 Agent？

一个普通的 AI 聊天窗口（如 ChatGPT 网页版）存在严重局限：

1. **没有记忆** — 每次对话从零开始，不知道你写了什么
2. **没有工具** — 只能生成文本，不能读写你的文件、管理大纲
3. **没有规划** — 你说「帮我写一章」，它只能一股脑输出，不会分步执行
4. **没有反思** — 输出之后不会检查质量，不会自我修正

**Agent（智能体）** = AI + 工具 + 记忆 + 规划 + 反思。它让 AI 从"对话机器人"进化为"能独立完成复杂任务的助手"：

```
普通 AI：  用户 → 对话 → 回答
Agent：   用户 → 对话 → 思考 → 调用工具 → 观察结果 → 继续思考 → 调用工具 → ... → 最终回答
```

**本项目就是一个写作 Agent**。它具备：

| Agent 能力 | 本项目的实现 |
|------------|-------------|
| **感知** | 读取章节全文、大纲、摘要，理解你的故事上下文 |
| **工具** | 25+ 内置工具：创建章节、写大纲、写正文、搜索联网、提取技能... |
| **规划** | 计划模式：拆解复杂任务为多步骤，自动执行，可干预 |
| **记忆** | 推理链结果纳入上下文、对话历史压缩管理、技能跨会话复用 |
| **反思** | 推理链在写作前进行多维度分析（人物心理、伏笔检查、节奏规划） |
| **并发** | 推理链 DAG 拓扑分层执行，无依赖步骤并发，提升效率 |
| **人机协作** | 写操作需用户审批、快速回复选项、流式输出实时预览 |

---

## 功能概览

### 💬 AI 对话 — 真正读懂你故事的写作顾问

AI 不是通用聊天机器人，它**读过你写的一切**：书卷大纲、章节大纲、全文、摘要。

**终端风格 UI** — 命令行式横板布局，彩色左竖线区分角色，时间戳+角色标签，紧凑高效。

**三级对话，精准指导：**

| 层级 | 能力 | 典型场景 |
|------|------|----------|
| **书籍** | 规划下卷、世界观构建、整体节奏 | "新势力怎么跟前面的伏笔呼应？" |
| **卷** | 章节规划、节奏分析、伏笔建议 | "高潮放在哪？过渡怎么处理？" |
| **章节** | 场景展开、描写润色、对话风格 | "这场打斗怎么写得更生动？" |

**内置工具（25+）— AI 能直接操作你的小说：**

| 工具 | 说明 |
|------|------|
| 创建章节/卷 | AI 规划后创建新章节并关联到对应卷 |
| 写大纲 | 撰写书籍/卷/章节大纲 |
| 写正文 | 根据大纲和前文撰写章节正文 |
| 读内容 | 随时读取任意章节的正文和摘要 |
| **联网搜索** | **Brave Search API 实时搜索，获取最新资料、参考资料** |
| 提取/管理技能 | AI 自动提取写作风格技能 |
| 推理链管理 | 创建、编辑、绑定推理链到工具 |

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

### 🧠 推理链 — AI 写作前的系统性思考 + 并发执行

推理链让 AI 在执行写大纲、写正文等任务前，先进行结构化分析：

**内置推理链：**
- **章节创作推理**：人物心理分析 → 人物关系变化 → 场景环境分析 → 动作与交互设计 → 情感节奏规划 → 整合创作指导
- **大纲规划推理**：主线梳理 → 支线分析 → 伏笔检查 → 节奏规划

**核心特性：**
- **DAG 依赖关系**：每个步骤可声明依赖哪些前序步骤的输出，无依赖的步骤自动并发执行
- **拓扑分层并发**：按依赖关系分层（L0 → L1 → L2...），同层步骤 `Promise.all` 并发
- **可视化编辑器**：依赖选择器 + 分层 DAG 图 + 循环依赖检测
- **自动触发**：绑定到写大纲、写正文等工具，执行前自动推理
- **手动触发**：对话中点击 🧠 按钮选择推理链
- **可配置上下文**：每个推理链可选择参考书籍大纲、卷大纲、章节大纲、前文摘要、对话历史
- **自定义推理链**：创建、编辑、删除自定义推理链，设置触发方式和推理步骤

### 🌐 联网搜索 — AI 对话中实时获取信息

- **Brave Search API**：免费 2000 次/月，无需信用卡
- **无需审批**：搜索是只读操作，AI 可直接执行
- **结构化结果**：返回标题、URL、摘要，AI 基于结果回答问题
- **设置页配置**：在设置 → API 配置底部填入 Brave Search API Key

### 📊 上下文管理 — 精细化 Token 预算

- **上下文窗口手动配置**：每个 API Profile 可手动设置 contextWindow，或留空自动推测
- **6 阶段预算分配**：章节 30% / 大纲 15% / 对话历史 25% / 技能 10% / 推理链 10% / 工具 5%
- **对话历史压缩**：超预算时自动压缩旧消息为摘要
- **工具结果裁剪**：按工具类型限制结果 token 数，防止上下文爆炸

---

## 下载

| 版本 | 说明 |
|------|------|
| [GitHub 下载](https://github.com/simple-calcate/writerAgent/releases) | 国际源 |
| [Gitee 下载](https://gitee.com/simple-calcate/writerAgent/releases) | 国内源，更稳定 |

**安装包**：
- `novel-writer-setup-0.2.6.exe` — 安装版，可选择安装目录
- `novel-writer-setup-0.2.6.exe` — 便携版，双击即用

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

## Why AI? Why Agent?

Traditional writing tools (Word, Scrivener) only handle **text storage and formatting** — they don't understand what you're writing. When you need to improve a fight scene, track foreshadowing across 50 chapters, or plan the pacing of your next arc, these tools can't help.

**AI (LLM)** brings semantic understanding — it can comprehend your story's characters, plot, and style. But a plain AI chat window (like ChatGPT) has critical limitations: no memory of your story, no tools to read/write files, no planning ability, no self-reflection.

**Agent = AI + Tools + Memory + Planning + Reflection.** It transforms AI from a "chat bot" into an "autonomous assistant that can execute complex tasks":

| Agent Capability | This Project's Implementation |
|-----------------|------------------------------|
| **Perception** | Reads chapter text, outlines, summaries — understands your full story context |
| **Tools** | 25+ built-in tools: create chapters, write outlines, write content, web search, extract skills... |
| **Planning** | Plan mode: decomposes complex tasks into multi-step sequences, auto-executes with intervention points |
| **Memory** | Reasoning chain results in context, dialogue history compression, skills persist across sessions |
| **Reflection** | Multi-dimensional analysis before writing (character psychology, foreshadowing check, pacing) |
| **Concurrency** | DAG-based reasoning chains — independent steps run in parallel |
| **Human-in-the-loop** | Write operations require approval, quick reply options, streaming preview |

## Features

### AI Dialogue — A Writing Advisor That Actually Knows Your Story

**Terminal-style UI** — command-line horizontal layout with colored left borders, timestamps, role labels, compact and efficient.

The AI isn't a generic chatbot — it has **read everything you've written**: book outline, volume outlines, chapter outlines, full text, and summaries.

**Three-level dialogue for precise guidance:**

| Level | Capabilities | Typical Scenarios |
|-------|-------------|-------------------|
| **Book** | Plan the next volume, world-building, overall pacing | "How should I connect the new faction to earlier foreshadowing?" |
| **Volume** | Chapter planning, pacing analysis, foreshadowing advice | "Where should the climax be? How to handle transitions?" |
| **Chapter** | Scene development, description polish, dialogue style | "How to make this fight scene more vivid?" |

**Built-in tools (25+) — AI can directly operate on your novel:**

| Tool | Description |
|------|-------------|
| **Create Chapter/Volume** | AI plans the plot, then creates a new chapter linked to the right volume |
| **Write Outline** | Have AI draft book outlines, volume outlines, or chapter outlines |
| **Write Content** | AI writes chapter text based on outlines and previous content |
| **Read Content** | AI can read any chapter's text and summary at any time |
| **Web Search** | **Brave Search API real-time search for references and research** |
| **Extract/Manage Skills** | AI automatically extracts writing style skills |
| **Reasoning Chains** | Create, edit, bind reasoning chains to tools |

Every action triggers a confirmation dialog — you're always in control.

**Plan Mode — AI executes complex tasks automatically:**

Tell the AI your idea and it will:
1. Propose two plans (safe route + creative route)
2. Wait for your approval or adjustments
3. Execute automatically: create chapter → write outline → fill content, with intervention at every step

### 🧠 Reasoning Chains — Systematic Thinking + Concurrent Execution

Reasoning chains make AI perform structured analysis before executing tasks like writing outlines or content:

**Built-in Chains:**
- **Chapter Writing**: Character psychology → Relationship dynamics → Scene environment → Action design → Emotional pacing → Integrated guidance
- **Outline Planning**: Main plot → Subplot analysis → Foreshadowing check → Pacing planning

**Key Features:**
- **DAG Dependencies**: Each step can declare dependencies on other steps' outputs; independent steps run concurrently
- **Topological Layering**: Steps are grouped into layers (L0 → L1 → L2...), same-layer steps run via `Promise.all`
- **Visual Editor**: Dependency selector + layered DAG diagram + cycle detection
- **Auto-trigger**: Bind to writing tools, execute reasoning automatically before tool runs
- **Manual trigger**: Click 🧠 button in dialogue to select a reasoning chain
- **Custom chains**: Create, edit, delete custom reasoning chains with custom triggers and steps

### 🌐 Web Search — Real-time Information During Dialogue

- **Brave Search API**: Free 2000 queries/month, no credit card required
- **No approval needed**: Read-only operation, AI executes directly
- **Structured results**: Returns title, URL, description for AI to reference

### 📊 Context Management — Fine-grained Token Budget

- **Manual context window**: Per-profile contextWindow config, or auto-detect by model name
- **6-stage budget**: Chapter 30% / Outlines 15% / History 25% / Skills 10% / Reasoning 10% / Tools 5%
- **History compression**: Auto-compress old messages when over budget
- **Tool result trimming**: Per-tool token limits to prevent context explosion

---

## Download

| Version | Description |
|---------|-------------|
| [GitHub Releases](https://github.com/simple-calcate/writerAgent/releases) | International source |
| [Gitee Releases](https://gitee.com/simple-calcate/writerAgent/releases) | China mirror, more stable |

**Packages**:
- `novel-writer-setup-0.2.6.exe` — Installer, choose installation directory
- `novel-writer-setup-0.2.6.exe` — Portable version, double-click to run

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
