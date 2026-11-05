# 迁移与发布

## 当前边界

本轮建立私有源码仓库骨架，不迁移插件源码，不发布 npm，不创建 GitHub Release，不提交市场申请。现有插件由各自对话修改。

## 迁移

1. 各包完成交接清单后，由合仓负责人按文件白名单迁入 packages 对应目录；不整目录复制。
2. 角色插件保留现有 Git 历史，具体迁移时再执行历史导入。旧仓库与 Release 保留；迁移成功后更新入口。
3. 检查根锁文件与干净安装。仅迁入源码、测试、许可、公开文档和资源。
4. 增补 npm pack 的产物审查、隔离安装、密钥检查与真实 DSH API 验证；当前基础 CI 尚不覆盖这些验收。
5. 四个插件分别安装与卸载验证，然后验证组合使用。记录每包实际验证过的最低 DSH 版本与当前版本。

## 发布

1. 确认 npm scope 所有权、许可证、包名、各包首次版本与明确发布授权。scoped 名称视为新包，不自动承接无 scope 包的发布身份。
2. 根 package.json 永远 private。子包仅在发布准备完毕并获授权后移除 private，并设置 publishConfig.access 为 public。
3. 使用 Changesets 管理独立版本与 changelog；不得把四包设为 fixed 或 linked。
4. 首次发布由账号持有人完成；随后逐包设置 GitHub Actions OIDC trusted publishing，核对届时 npm 的要求与允许动作。
5. 发布工作流采用人工批准；本骨架不提供自动发布工作流，也不保存 npm token。
6. 分包创建 GitHub Release，使用包含包名的标签，避免多个包的 v1.0.0 冲突。
7. 分别申请 Awesome DSH Plugin 与 dshopen；按实际结果启用 npm 和市场徽章。

发布记录分别写明“源码已推送”“npm 已发布”“市场待审核/已收录”，并附精确版本、提交和地址。
