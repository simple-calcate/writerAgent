# 主进程

## 关键文件

| 文件 | 行数 | 用途 |
|------|------|------|
| index.ts | 624 | IPC handler 注册入口 |
| llm/client.ts | 455 | 润色/摘要/诊断 API 调用 |
| llm/dialogue.ts | 495 | 对话流控制（流式） |
| llm/dialogue-tools.ts | 1082 | 对话工具定义（最复杂） |
| llm/dialogue-prompts.ts | 436 | 对话系统提示词 |
| llm/continuation.ts | - | 续写建议生成 |
| llm/streaming.ts | - | 流式传输工具函数 |
| store/db.ts | 663 | SQLite CRUD 操作 |
| import-parser.ts | - | TXT 文件导入解析 |
| updater.ts | - | 自动更新（electron-updater） |

## IPC Handler 定位

在 index.ts 中搜索 `ipcMain.handle('handler-name'` 定位具体 handler。
常见 handler：auto-polish、polish-text、summarize-chapter、refine-summary、dialogue 系列。

## 验证方式

- 类型检查：`npx tsc --noEmit`
- 功能验证：`npm run dev` 启动应用手动测试
- 无独立单元测试

## 常见任务

- **添加 IPC handler**：在 index.ts 的 registerIPC() 中添加
- **修改 AI 提示词**：查 llm/dialogue-prompts.ts
- **修改工具调用**：查 llm/dialogue-tools.ts
- **修改数据库操作**：查 store/db.ts
