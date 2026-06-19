const JavaScriptObfuscator = require('javascript-obfuscator')
const fs = require('fs')
const path = require('path')

const configs = {
  main: {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.4,
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,
    selfDefending: true,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayCallsTransformThreshold: 0.5,
    stringArrayEncoding: ['rc4'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 2,
    stringArrayWrappersType: 'function',
    stringArrayThreshold: 0.75,
    transformObjectKeys: true,
    unicodeEscapeSequence: false
  },
  preload: {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.5,
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,
    stringArray: true,
    stringArrayEncoding: ['rc4'],
    stringArrayThreshold: 0.5,
    selfDefending: true,
    unicodeEscapeSequence: false
  }
}

function obfuscateFile(filePath, configName) {
  if (!fs.existsSync(filePath)) {
    console.warn(`Skipping: ${filePath} (not found)`)
    return
  }
  const code = fs.readFileSync(filePath, 'utf-8')
  const config = configs[configName]
  const result = JavaScriptObfuscator.obfuscate(code, config)
  fs.writeFileSync(filePath, result.getObfuscatedCode())
  console.log(`Obfuscated: ${filePath} (${configName})`)
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
  obfuscateFile(mainIndex, 'main')
} else {
  console.warn('Main index.js not found')
}

const preloadIndex = findIndexFile(path.join(outDir, 'preload'))
if (preloadIndex) {
  obfuscateFile(preloadIndex, 'preload')
} else {
  console.warn('Preload index.js not found')
}

console.log('Obfuscation complete.')
