# 主进程

## 关键文件

| 文件 | 行数 | 用途 |
|------|------|------|
| index.ts | ~50 | 入口，调用 registerIPC |
| ipc-handlers/ai.ts | ~200 | AI 相关 IPC handler |
| ipc-handlers/data.ts | ~200 | 数据 CRUD IPC handler |
| ipc-handlers/config.ts | ~200 | 配置/更新/视觉效果 handler |
| llm/client.ts | ~80 | createClient + re-export |
| llm/client-polish.ts | ~250 | 润色功能 |
| llm/client-summary.ts | ~140 | 摘要 + 诊断 |
| llm/dialogue.ts | ~5 | re-export 入口 |
| llm/dialogue-reasoning.ts | ~140 | 推理链执行 |
| llm/dialogue-stream.ts | ~410 | 对话流控制 |
| llm/dialogue-tools.ts | ~5 | re-export 入口 |
| llm/tools/definitions.ts | ~350 | 工具定义 |
| llm/tools/helpers.ts | ~100 | 辅助函数 |
| llm/tools/executor.ts | ~600 | 工具执行器 |
| llm/dialogue-prompts.ts | ~440 | 对话提示词 |
| llm/continuation.ts | - | 续写建议生成 |
| llm/streaming.ts | - | 流式传输工具函数 |
| llm/refine-summary.ts | - | 精炼总结 |
| llm/feature-skills.ts | - | 功能技能 |
| llm/reasoning-chains.ts | - | 推理链 |
| store/db.ts | ~5 | barrel file |
| store/db-core.ts | ~260 | Store 初始化、迁移、save |
| store/db-projects.ts | ~100 | 项目 CRUD |
| store/db-chapters.ts | ~150 | 章节 + 卷 + 版本 CRUD |
| store/db-config.ts | ~150 | LLM 配置、对话、大纲、技能、推理链 |
| import-parser.ts | - | TXT 文件导入解析 |
| updater.ts | - | 自动更新（electron-updater） |

## IPC Handler 定位

IPC handler 按功能域分文件：
- `ipc-handlers/ai.ts`：AI 相关（润色、摘要、对话、续写）
- `ipc-handlers/data.ts`：数据 CRUD（项目、卷、章节、版本、大纲、技能、推理链）
- `ipc-handlers/config.ts`：配置、更新、视觉效果

## 验证方式

- 类型检查：`npx tsc --noEmit`
- 功能验证：`npm run dev` 启动应用手动测试
- 无独立单元测试

## 常见任务

- **添加 IPC handler**：在对应 ipc-handlers/*.ts 中添加
- **修改 AI 提示词**：查 llm/dialogue-prompts.ts
- **修改工具调用**：查 llm/tools/ 目录
- **修改数据库操作**：查 store/db-*.ts 文件
- **修改润色逻辑**：查 llm/client-polish.ts
- **修改摘要逻辑**：查 llm/client-summary.ts
