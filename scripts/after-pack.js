const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

exports.default = async function (context) {
  const appDir = context.appOutDir
  const asarPath = path.join(appDir, 'resources', 'app.asar')

  if (fs.existsSync(asarPath)) {
    try {
      execSync(`npx asarmor -b "${asarPath}"`, { stdio: 'inherit' })
      console.log('asarmor protection applied to', asarPath)
    } catch (e) {
      console.warn('asarmor protection failed:', e.message)
    }
  }
}
