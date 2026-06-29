import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    // 测试文件位置：与源码同目录的 __tests__/ 或 *.test.ts
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    environment: 'node',
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/main/llm/token-counter.ts', 'src/main/llm/context-compressor.ts', 'src/main/llm/chunking.ts', 'src/main/llm/importance-scorer.ts', 'src/main/llm/reasoning-chains.ts', 'src/main/import-parser.ts']
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/src')
    }
  }
})
