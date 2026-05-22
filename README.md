# Novel Writer — AI-Powered Web Fiction Writing Tool

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE)

> **It doesn't write for you — it helps you write better.** A desktop writing companion that integrates AI into your entire workflow: polishing, outlining, summarizing, and creative dialogue.

## Why This Tool?

The hardest part of writing web fiction isn't ideas — it's **editing** and **consistency**. Novel Writer weaves AI into your writing process. It's not a chatbot; it's your personal editor.

---

## Core Features

### AI Dialogue — A Writing Advisor That Actually Knows Your Story

This is the most powerful feature. The AI isn't a generic chatbot — it has **read everything you've written**: book outline, volume outlines, chapter outlines, full text, and summaries.

**Three-level dialogue for precise guidance:**

| Level | Capabilities | Typical Scenarios |
|-------|-------------|-------------------|
| **Book** | Plan the next volume, world-building, overall pacing | "How should I connect the new faction to earlier foreshadowing?" |
| **Volume** | Chapter planning, pacing analysis, foreshadowing advice | "Where should the climax be? How to handle transitions?" |
| **Chapter** | Scene development, description polish, dialogue style | "How to make this fight scene more vivid?" |

**Built-in tools — AI can directly operate on your novel:**

During dialogue, the AI doesn't just give advice — it can **take action**:

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

### Text Formatting — 8 One-Click Tools

Remove extra spaces, remove blank lines, convert punctuation, paragraph indentation, quote normalization, numbers to Chinese, sentence-ending unification, and more.

---

## Multi-API Configuration — Flexible Integration

Supports **multiple API configurations**, with each AI feature independently bound to a different provider:

```
Polish    → OpenAI GPT-4o
Summary   → DeepSeek V3
Dialogue  → Local Ollama
Refine    → Moonshot
```

**Built-in provider shortcuts** with one-click Base URL and default model fill:
- OpenRouter — Large model aggregator, easy token purchasing
- DeepSeek — Cost-effective Chinese-language model
- OpenAI — GPT-4o series
- Claude — By Anthropic
- Qwen — Alibaba Cloud's LLM
- Moonshot — Kimi with long context
- Ollama — Fully local, completely offline

Each provider includes a **top-up link** to the official recharge page.

## Writing Guidelines — Customize Your AI

Set description guidelines at the book level:
- Dialogue style (casual / character-authentic)
- Scene description (sensory details / vivid imagery)
- Emotion writing (convey through actions / avoid direct statements)
- Pacing (end chapters with suspense / alternate climax and transition)

AI automatically references your guidelines when generating content.

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
