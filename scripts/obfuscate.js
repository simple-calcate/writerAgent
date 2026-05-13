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

const outDir = path.join(__dirname, '..', 'out')

obfuscateFile(path.join(outDir, 'main', 'index.js'), 'main')
obfuscateFile(path.join(outDir, 'preload', 'index.js'), 'preload')

console.log('Obfuscation complete.')
