# CI/CD 说明

本项目通过 GitHub Actions 自动化构建与发布，配置在 `.github/workflows/`。

## CI（持续集成）

**文件**: `ci.yml`
**触发**: push 或 PR 到 `main` 分支
**运行环境**: ubuntu-latest（Linux 跑类型检查和单元测试足够，速度快）
**任务**:
1. `npm ci` 安装依赖（用 lockfile 保证可重现）
2. `npx tsc --noEmit` 类型检查
3. `npm test` 跑 vitest 单元测试（95 用例）
4. `npx electron-vite build` 验证构建（跳过 obfuscate 加速）
5. push 时上传 `out/` 为 artifact（保留 7 天）

**取消机制**: 同分支新 push 自动取消旧 job（`concurrency.cancel-in-progress: true`）

## Release（发布）

**文件**: `release.yml`
**触发**: 推 `v*` 格式的 tag（如 `v0.2.7`、`v0.3.0-beta.1`）
**运行环境**: windows-latest（打包 Windows 安装包）
**任务**:
1. 跑 tsc + test 确保不发布坏包
2. `electron-vite build` + `electron-builder --win nsis portable`
3. 上传 setup.exe 和 portable.exe 到 GitHub Release
4. 自动生成 release notes（基于 commit）

**权限**: `contents: write`（创建 Release 需要）

## 使用方法

### 日常开发
直接 push 到 main，CI 自动跑验证。PR 也会触发 CI。

### 发布新版本
```bash
# 1. 更新 package.json 的 version
# 2. 提交并打 tag
git tag v0.2.7
git push origin v0.2.7
# 3. Release workflow 自动触发，几分钟后在 GitHub Releases 页面看到安装包
```

## 注意事项

- **CI 跳过 obfuscate**：开源项目混淆意义有限，且拖慢 CI。如需混淆，CI 里改用 `npm run build`，Release 里改用 `npm run dist`
- **缓存**：`actions/setup-node` 的 `cache: npm` 会缓存 npm 缓存目录，二次运行 install 更快
- **Release 不取消**：发布是重要操作，即使推了新 tag 也不会取消正在跑的发布（`cancel-in-progress: false`）
