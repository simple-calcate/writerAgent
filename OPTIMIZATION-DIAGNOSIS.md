# 网文写作助手 — 项目优化诊断报告

> 体检日期：2026-06-29　·　版本：0.2.7-beta.3　·　代码量：24,102 行（src/）

## 体检结论总览

| 维度 | 状态 | 说明 |
|------|------|------|
| 类型安全 | ✅ 良好 | `tsc --noEmit` 零错误，类型层面干净 |
| 安全漏洞 | ⚠️ 有风险 | 2 个依赖漏洞（1 高 1 中），可一键修复 |
| 错误处理 | ❌ 有缺陷 | 润色/摘要的 LLM 调用裸奔，失败即崩溃 |
| 死代码 | ❌ 较多 | test-agent 测试文件混入生产 + 大量 console.log |
| 构建产物 | ❌ 臃肿 | release 目录 748 MB 堆积历史产物 |
| 混淆策略 | ⚠️ 存疑 | 开源项目用重度混淆，拖慢构建与运行时 |
| 依赖版本 | ⚠️ 严重落后 | electron 33→42、vite 5→8、react 18→19 |
| 设计规范 | ⚠️ 部分违规 | RightPanel/AIConfigLevel 硬编码颜色严重 |
| any 类型 | ⚠️ 较多 | 178 处，preload/summarySlice 重灾 |

**整体判断**：项目架构清晰、模块化做得好、类型零错误，是高质量代码库。但存在 **3 个 P0 级问题**（安全 + 错误处理）需立即处理，另有若干 P1 工程卫生问题值得一次性清理。

---

## P0 — 立即处理（安全 / 正确性）

### P0-1　依赖安全漏洞
- **问题**：`form-data 4.0.0-4.0.5`（高危，CRLF 注入）、`js-yaml ≤4.1.1`（中危，DoS）
- **影响**：供应链风险，form-data 在上传场景可被注入
- **修复**：`npm audit fix`（已验证可自动修复）
- **工作量**：1 条命令

### P0-2　润色/摘要 LLM 调用缺少错误处理
- **位置**：
  - `src/main/llm/client-polish.ts:49,57`（`polishText` 的 LLM 调用未包裹 try/catch）
  - `src/main/llm/client-polish.ts:134,142`（`autoPolish` 同上）
  - `src/main/llm/client-summary.ts:85`（`summarizeChapter` 整函数无 try/catch）
  - `src/main/llm/streaming.ts:56-73`（`streamWithThinking` 流迭代块未包裹）
- **影响**：网络抖动 / API 限流 / JSON 解析失败时，异常直接抛出，用户看不到错误提示，功能静默崩溃
- **修复**：用 try/catch 包裹 LLM 调用，失败时返回结构化错误并提示用户
- **工作量**：4 处包裹，约 1 小时

---

## P1 — 高优先级（工程卫生）

### P1-1　死代码：test-agent 测试文件混入生产源码
- **位置**：`src/main/test-agent.ts`（316 行，99 处 console.log）、`src/main/test-agent-integration.ts`（242 行，19 处 console.log）
- **证据**：全项目搜索 `test-agent`，仅文件头注释自引用，**无任何 import**
- **影响**：被 electron-vite 打入生产 bundle，污染产物；console.log 全部进生产
- **修复**：移至 `scripts/manual-test/` 或删除
- **工作量**：移动 2 个文件

### P1-2　生产代码 console.log 残留
- **位置**（剔除 test-agent 后）：
  - `src/main/llm/wac.ts`：11 处
  - `src/main/llm/wac-critic-loop.ts`：8 处
  - `src/main/ipc-handlers/ai.ts`：4 处
  - `src/main/llm/client-polish.ts`：3 处（行 152/193/218 调试日志）
  - `src/main/llm/task-router.ts`：2 处
- **影响**：污染用户日志，泄露内部状态
- **修复**：替换为可开关的 logger（如 `debug` 库或自建 `log.debug`），默认静默
- **工作量**：建立 logger + 批量替换，约 2 小时

### P1-3　release 目录臃肿（748 MB）
- **现状**：
  - 3 个 beta 版安装包各 80 MB（beta.1 / beta.2 / beta.3），共 ~480 MB
  - `win-unpacked/` 188 MB（含 188 MB 的 `网文写作助手.exe` 解包）
  - 旧 blockmap、yml 等残留
- **影响**：仓库膨胀，`git` 操作变慢（若纳入版本控制），磁盘占用
- **修复**：
  1. 仅保留最新 beta.3 安装包，删除 beta.1/beta.2
  2. `win-unpacked/` 加入 `.gitignore`（electron-builder 每次重建）
  3. 可配置 electron-builder `cleanupReleaseDir` 或打包前清理
- **可立即释放**：约 **660 MB**
- **⚠️ 注意**：删除前请确认这些旧安装包未被其他地方引用

### P1-4　过度混淆拖慢构建与运行时
- **位置**：`scripts/obfuscate.js`
- **现状配置**：`controlFlowFlattening(0.75)` + `deadCodeInjection(0.4)` + `stringArrayEncoding: rc4` + `selfDefending`
- **问题**：
  1. 本项目是 **AGPL-3.0 开源**，源码已公开，混淆保护意义有限
  2. 仅混淆 main + preload，**renderer 未混淆**，保护不完整
  3. 控制流平坦化 + 死代码注入有 **显著运行时开销**（主进程 IPC 启动变慢）
  4. rc4 字符串加密拖慢构建
- **建议**：降级为轻量混淆（仅 `identifierNamesGenerator` + `stringArray` 基础项），或直接移除。若为防 API Key 泄露，应靠配置而非混淆
- **工作量**：调整配置，约 30 分钟

### P1-5　依赖版本严重落后
- **关键落后项**：

| 依赖 | 当前 | 最新 | 跨度 |
|------|------|------|------|
| electron | 33 | 42 | 9 个主版本 |
| vite | 5 | 8 | 3 个主版本 |
| react / react-dom | 18 | 19 | 1 个主版本 |
| openai | 4.104 | 6.45 | 2 个主版本 |
| tailwindcss | 3 | 4 | 1 个主版本 |
| typescript | 5 | 6 | 1 个主版本 |
| electron-vite | 2 | 5 | 3 个主版本 |

- **影响**：electron 33 已停止安全更新；vite 5/8 性能差距大；openai SDK 4→6 有 API 变更
- **建议分批升级**（不要一次性全升）：
  1. **第一批（低风险）**：`npm audit fix` 修漏洞；electron-updater、electron-builder 小版本
  2. **第二批（中风险）**：vite 5→8、electron-vite 2→5（构建链统一）
  3. **第三批（高影响）**：electron 33→42（需测全平台）、react 18→19（需审计 useEffect 依赖）
  4. **第四批（按需）**：tailwind 3→4（配置语法变）、typescript 5→6、openai 4→6
- **工作量**：每批半天到一天测试

---

## P2 — 中优先级（可维护性 / 体验）

### P2-1　any 类型滥用（178 处）
- **重灾区**：
  - `src/preload/index.ts`：34 处（`set({...} as any)` 绕过 contextBridge 类型）
  - `src/renderer/src/stores/slices/summarySlice.ts`：24 处
  - `src/main/llm/dialogue-stream.ts`：18 处
  - `src/main/llm/call-with-tools.ts`：12 处
- **影响**：类型安全形同虚设，重构易引入隐藏 bug
- **修复**：优先补 preload 的 IPC 类型（已有 `shared/types/ipc.ts`，应让 preload 严格实现该接口）
- **工作量**：preload 重构约半天，其余逐步替换

### P2-2　硬编码颜色违反设计规范
- **规范**：`docs/ui-design-system.md` 要求用 `--nw-*` 语义变量，禁用 gray 系
- **重灾区**：
  - `right-panel/RightPanel.tsx`：14 处（`#2a3347` / `#3a4255` 重复 7+ 次，且用了 gray 系 11 处）
  - `sidebar/AIConfigLevel.tsx`：14 处
  - `sidebar/ProjectsLevel.tsx`、`SkillManager.tsx`、`sidebar/VolumeLevel.tsx`：各 11 处
  - `editor/Editor.tsx`：`bg-gray-800/95`、`bg-[#2a3347]` 等
- **修复**：`#2a3347`→`var(--nw-border)`，抽 `Card` 组件统一 `bg-[--nw-surface-2] border ... rounded-lg p-3`

### P2-3　重复 className 应抽组件/常量
- **位置**：`RightPanel.tsx` 中
  - `border-[#2a3347]` 出现 7+ 次 → 改语义 token
  - `bg-[--nw-surface-2] border border-[#2a3347] rounded-lg p-3`（行 225/243/286）→ 抽 `Card` 组件
  - tab 按钮态（行 116/547/557）、次级按钮（行 93/250/323）→ 抽 `cn()` 常量或组件

### P2-4　无障碍缺陷
- **位置**：`right-panel/RightPanel.tsx:157` — `<div className="p-3.5 cursor-pointer" onClick>` 整卡可点，键盘用户无法操作
- **修复**：改 `<button>` 或加 `role="button" tabIndex={0} onKeyDown`

### P2-5　DialoguePanel IPC 调用缺错误处理
- **位置**：
  - `dialogue-panel/DialoguePanel.tsx:159` — `getReasoningChains().then(set…)` 无 `.catch`
  - 行 163 — `getLLMConfig` `.catch(()=>{})` 静默吞错
  - 行 169 — `resolveDialogueContextWindow` 无错误处理
- **修复**：补 `.catch` 并设置 error 状态展示

### P2-6　魔法数字硬编码
- **位置**：
  - `client-summary.ts:25,61` — 超时 5000/10000 ms
  - `stream/tool-approval.ts:13` — 审批超时 `5*60*1000`
  - `context-builders.ts:64,95,103,129` — token 预算 4000/2000/3000
  - `chapter-tools.ts:52-53` — 截断阈值 10000/5000/3000
- **修复**：抽 `src/main/llm/constants.ts` 集中管理

### P2-7　内联 style 滥用
- **位置**：`dialogue-panel/DialoguePanel.tsx:284-286` — 3 个 bounce dot 各用 `style={{animationDelay}}`，应改 CSS 类

---

## P3 — 低优先级（锦上添花）

### P3-1　vite renderer 缺 chunk 拆分
- **现状**：`electron.vite.config.ts` renderer 部分无 `manualChunks`，react/react-dom 等未独立拆包
- **影响**：首屏加载稍慢，缓存利用率低
- **修复**：加 `build.rollupOptions.output.manualChunks` 拆分 vendor

### P3-2　非 8pt spacing 零星违规
- `RightPanel.tsx:107`（`w-8.5 py-2.5 gap-1.5`）、`162`（`ml-7.5`）、`Editor.tsx:35`（`px-2.5 py-1.5`）
- **修复**：对齐到 8pt 网格

### P3-3　奇怪透明度
- `Settings.tsx:320` — `bg-white/[0.01]`（0.01 几乎不可见，疑似笔误）

---

## 推荐执行路线图

```
第 1 步（半小时，立即）─ 安全与清理
  ├─ npm audit fix          ← P0-1
  ├─ 删除 release 旧安装包   ← P1-3（释放 660 MB）
  └─ win-unpacked 加 .gitignore

第 2 步（半天）─ 错误处理 + 死代码
  ├─ 补 LLM 调用 try/catch   ← P0-2
  ├─ test-agent 移出 src     ← P1-1
  └─ 建 logger 替换 console.log ← P1-2

第 3 步（半天）─ 混淆降级
  └─ 调整 obfuscate.js 配置   ← P1-4

第 4 步（1-2 天）─ UI 规范化
  ├─ 抽 Card 组件 + 色彩 token ← P2-2/3
  ├─ 补 a11y 与 IPC 错误处理   ← P2-4/5
  └─ 抽常量文件               ← P2-6

第 5 步（按需，分批）─ 依赖升级 ← P1-5
  └─ 按 4 批顺序升级，每批回归测试
```

---

## 附：健康指标

- ✅ `tsc --noEmit` 零错误
- ✅ 渲染进程零 console.log（已清理）
- ✅ helpers.ts 无重复实现
- ✅ 代码标记（TODO/FIXME）干净
- ✅ 模块化拆分清晰，最大文件 572 行（合理）
- ✅ CLAUDE.md 文档完善，架构地图清晰
