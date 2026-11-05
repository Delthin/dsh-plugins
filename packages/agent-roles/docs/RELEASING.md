# 发布指南 / Release guide

本文档面向项目维护者，说明 `dsh-agent-roles` 的发布前检查、GitHub Release 创建、npm 发布、插件市场提交流程与回滚规范。

## 发布前准备

1. 在干净的工作区检出目标分支，执行 `npm ci --ignore-scripts` 安装依赖。
2. 同步更新 `package.json`、锁文件与 `CHANGELOG.md` 中的目标版本号，并核对当前 DSH 宿主版本兼容性。
3. 执行 `npm run release:check`，完成语法检查、自动化测试、npm 打包文件清单核对，以及常见凭据与本机路径扫描。脚本检查不能替代人工隐私审阅。
4. 执行 `git diff --check` 并人工审阅全部暂存改动。确认提交内容不包含真实角色定义、会话记录、个人配置、访问令牌、本机绝对路径或运行截图；测试仅使用虚构数据。
5. 生成待发布压缩包并在隔离目录中完成独立安装验证：确认包入口可正常导入、全新角色目录不含角色、默认状态下 Skills 与 Fast 模式均处于关闭状态，同时在现有 DSH 宿主中验证角色管理与原生 Agent Team 成员运行正常。
6. 将通过审阅的发布改动（包括版本号、锁文件与 `CHANGELOG.md`）提交到主分支，确认工作区无未提交改动后再创建版本标签。

## GitHub Release 与 npm 发布

已发布的 GitHub Release 标签不得重复创建或覆盖。下方命令以 `VERSION=0.4.0` 作为示例；实际执行时，必须将 `VERSION` 替换为本次发布的目标版本，且与 `package.json`、锁文件及 `CHANGELOG.md` 严格一致。

```sh
VERSION=0.4.0
TARBALL="dsh-agent-roles-${VERSION}.tgz"

npm run release:check
npm pack
# 此时完成上述隔离安装验证，确认待上传的就是这份产物。

# 确认发布改动已提交后，创建并推送新版本标签
git tag -a "v${VERSION}" -m "Release v${VERSION}"
git push origin main "v${VERSION}"

# 使用同一份经过检查的 tarball 创建 GitHub Release
gh release create "v${VERSION}" "${TARBALL}" --verify-tag --title "v${VERSION}" --notes-file CHANGELOG.md

# 由具备 npm 发布权限的账号持有人在本机完成登录与二次验证后执行
npm publish "${TARBALL}" --access public
```

GitHub Release、npm 公开包与 DSH 插件市场收录是三种独立状态，须分别核对：

- **GitHub Release**：上传后检查 Release 页面资产是否完整。在尚未取得 npm 发布权限或未执行 `npm publish` 时，可单独使用 GitHub Release 产物地址安装，但不得对外宣称 npm 已发布。
- **npm 公开包**：发布后执行 `npm view "dsh-agent-roles@${VERSION}" dist.integrity`，将返回的完整性摘要与本地 `${TARBALL}` 比对一致。项目 CI 仅运行检查，不保存发布令牌，也不执行自动上传或自动发布；npm 身份验证由账号持有人在本机完成，文档与仓库中均不收集或存储凭据。

## DSH 插件市场

DSH 插件市场收录来源于 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 目录仓库，发布到 GitHub 或 npm 不会触发市场自动索引。每次提交或更新前，请重新核对上游最新的 [contributing.md](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md)：

- 插件代码仓库必须保持公开，并添加 `dsh-plugin` topic。
- 按上游当前规则，仓库创建时间满一天后再提交收录申请。
- 向上游仓库提交独立的 `data/plugins/Delthin__dsh-agent-roles.yml` 条目文件，不要手工修改其自动生成的 `README.md`。
- 上游 PR 审核合并、插件市场同步刷新与本项目版本发布相互独立，需分别确认实际状态后再对外说明。

## 回滚与数据安全

已发布的版本标签、GitHub Release 资产与 npm 版本不可原地覆盖或删除重发。发现问题时，应在修复后递增版本号并按完整流程发布新版本；需要临时回退时，指定安装已知正常的旧版本号或对应的 GitHub Release tarball。

在升级或变更数据结构前，请提前备份本地运行目录中的 `roles.json` 与 `runs.json`。公开源码仓库与发布的 npm 压缩包从不包含这些本地运行数据。
