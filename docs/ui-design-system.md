# AI Agent UI Design System v1.0

> From Chat UI → Agent OS Interface

## 1. Design Principles

### 1.1 System over UI

UI does not express "interface" — it expresses **system state**.

UI answers exactly three things:
1. What is happening now (state)
2. What the system is doing (execution)
3. What the user can do (control)

**Never:** decorative UI, visual noise, repeated information layers.

### 1.2 Information Hierarchy (3-Layer Separation)

| Layer | Name | Content |
|-------|------|---------|
| L1 | Content Layer | User content (messages, text) |
| L2 | Execution Layer | AI behavior (tools, thinking) |
| L3 | System Layer | System state (context, agent, memory) |

**Rule:** Layers MUST NOT mix.

### 1.3 Restraint Principle

High-quality UI = subtraction system.
- One area does one thing
- One component expresses one state
- One color expresses one semantic meaning

## 2. Visual Language

### 2.1 Color System (Semantic Only)

```
Background — only 3 layers:
  --bg          base background
  --surface-1   card
  --surface-2   elevated

Text — only 3 levels:
  --text-primary
  --text-secondary
  --text-muted

Semantic — one color = one meaning:
  blue   → interaction / user
  green  → success / done
  yellow → running / warning
  red    → error
  purple → thinking / agent
```

**Forbidden:**
- `gray-100` ~ `gray-900` random usage
- Hardcoded hex colors
- Opacity layering

### 2.2 Spacing System (8pt Grid)

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Inline micro gap |
| sm | 8px | Inline gap |
| md | 12px | Card padding |
| lg | 16px | Section gap |
| xl | 24px | Page padding |

**Forbidden:** `px-2.5`, `py-1.5`, `gap-2.5`, or any random spacing.

### 2.3 Border Radius (3 Tiers)

| Token | Tailwind | Value |
|-------|----------|-------|
| sm | `rounded-md` | 6px |
| md | `rounded-lg` | 10px |
| lg | `rounded-xl` | 14px |

### 2.4 Shadow System (Replaces Borders)

Standard card:
```
shadow-[0_0_0_1px_rgba(255,255,255,0.04)]
```

Hover:
```
hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]
```

## 3. Component Standards

### 3.1 Card System

Every card MUST follow:

```tsx
<div className="
  rounded-md
  bg-[--nw-surface-1]
  shadow-[0_0_0_1px_rgba(255,255,255,0.04)]
  hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]
  hover:translate-y-[-1px]
  transition-all duration-150 ease-out
  px-3 py-2
">
```

### 3.2 Message System

Messages have 3 layers:
1. **meta** — role + timestamp (`opacity-60 group-hover:opacity-100`)
2. **content** — main body only
3. **system** — tool/thinking (NEVER inside message)

### 3.3 Execution System

All tool/thinking → **Execution Timeline** with:
- StatusDot (running/pending/done)
- Vertical timeline line
- Flow dots

### 3.4 Thinking System

Ghost layer style:
```
opacity-60 italic border-l border-[--nw-border] pl-2
```

## 4. Layout Architecture

```
┌──────────────────────┐
│ Message Layer        │  ← Results
├──────────────────────┤
│ Execution Layer      │  ← AI actions
├──────────────────────┤
│ System Layer         │  ← State
├──────────────────────┤
│ Input Layer          │  ← Control
└──────────────────────┘
```

## 5. Motion System

### Timing

| Name | Duration | Usage |
|------|----------|-------|
| fast | 150ms | hover, color |
| normal | 220ms | expand/collapse |
| slow | 320ms | page transitions |

### Easing

```
cubic-bezier(0.2, 0.8, 0.2, 1)
```

Tailwind: `ease-out`

### Rules

| Action | Animation |
|--------|-----------|
| enter | fade + translateY(4px) |
| hover | translateY(-1px) + shadow ↑ |
| expand | height + opacity |
| collapse | reverse |

**Forbidden:** bounce, ping (except thinking dot), multiple easing.

## 6. Hover Physics

Every interactive element:

```
hover:translate-y-[-1px]
hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]
transition-all duration-150 ease-out
```

## 7. Forbidden Patterns

| Pattern | Why |
|---------|-----|
| Multiple border types | Visual noise |
| Random gray opacity | Inconsistent |
| Tool in message | Layer violation |
| Thinking as long text | Not event-driven |
| Hover without motion | No weight feel |
| Non-uniform spacing | Dense not refined |
| Non-semantic colors | No meaning |

## 8. Quality = 4 Unifications

1. Spacing system (8pt)
2. Color semantics
3. Motion consistency
4. Hierarchy clarity

## 9. Mental Model

This is NOT a chat app. It is:

> **AI Agent Operating System**

Objects: Intent → Execution → State → Visualization
