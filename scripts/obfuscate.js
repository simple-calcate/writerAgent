const JavaScriptObfuscator = require('javascript-obfuscator')
const fs = require('fs')
const path = require('path')

// 轻量混淆策略
// 本项目为 AGPL-3.0 开源，源码已公开，混淆保护意义有限。
// 此前使用的 controlFlowFlattening + deadCodeInjection + rc4 字符串加密会
// 显著拖慢构建和主进程运行时（IPC 启动变慢），收益却很低。
// 现降级为：仅标识符重命名 + 基础字符串数组（不加密），保护 API 端点等字面量即可。
const config = {
  compact: true,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  stringArray: true,
  stringArrayEncoding: [],
  stringArrayThreshold: 0.5,
  // 移除：controlFlowFlattening / deadCodeInjection / selfDefending / rc4
  // 这些会拖慢运行时且对开源项目无实际保护价值
  unicodeEscapeSequence: false
}

function obfuscateFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`Skipping: ${filePath} (not found)`)
    return
  }
  const code = fs.readFileSync(filePath, 'utf-8')
  const result = JavaScriptObfuscator.obfuscate(code, config)
  fs.writeFileSync(filePath, result.getObfuscatedCode())
  console.log(`Obfuscated: ${filePath}`)
}

function findIndexFile(dir) {
  if (!fs.existsSync(dir)) return null
  const files = fs.readdirSync(dir)
  const indexFile = files.find(f => f.startsWith('index') && f.endsWith('.js'))
  return indexFile ? path.join(dir, indexFile) : null
}

const outDir = path.join(__dirname, '..', 'out')

const mainIndex = findIndexFile(path.join(outDir, 'main'))
if (mainIndex) {
  obfuscateFile(mainIndex)
} else {
  console.warn('Main index.js not found')
}

const preloadIndex = findIndexFile(path.join(outDir, 'preload'))
if (preloadIndex) {
  obfuscateFile(preloadIndex)
} else {
  console.warn('Preload index.js not found')
}

console.log('Obfuscation complete.')

