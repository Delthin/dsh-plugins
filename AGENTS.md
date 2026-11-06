# 插件仓库维护约定

本仓库是 `Delthin/dsh-plugins`，用于统一维护可独立安装、升级和发布的 DSH 插件。后续代理在本仓库及其子工作区工作时遵循本文件。

## 工作区与源码边界

- 跨包修改、新建插件和统一发布在本仓库根工作区进行；单包开发选择对应 `packages/<slug>` 子工作区，并在该工作区新建会话。不要默认在外层 DSH 服务根工作区开发插件。
- 本机仓库位于服务工作区的 `repositories/dsh-plugins`；外层服务工作区用于 npm 安装、配置、部署和运行维护，不是插件源码仓。
- `packages/` 是插件唯一源码；服务工作区的 `plugins/` 仅为部署副本，不能直接修改或分别维护。
- 所有子包使用本仓库的 Git 历史，不在包目录新建嵌套 Git 仓库。每包独立安装、版本和发布，不创建“安装全部”的聚合插件。
- 修改前查看工作树和差异，保留其他会话的未完成改动；只提交本任务已完成的内容，不顺手打包并行功能。

## 命名与包标识

新插件目录使用小写短横线名称 `packages/<slug>`，目录名不重复添加 `dsh-` 前缀；npm 包名采用 `@delthin/dsh-<slug>`，先确认 scope 权限和包名可用性。现有映射如下：

| 源码目录 | npm 包名 |
| --- | --- |
| [packages/feishu-notify](<packages/feishu-notify/>) | `@delthin/dsh-feishu-notify` |
| [packages/agent-roles](<packages/agent-roles/>) | `@delthin/dsh-agent-roles` |
| [packages/fast](<packages/fast/>) | `@delthin/dsh-fast` |
| [packages/tool-wrap](<packages/tool-wrap/>) | `@delthin/dsh-tool-wrap` |

- 工具包装插件对外使用 `tool-wrap` 名称；内部已有设置 ID、服务 ID、存储名和兼容入口按迁移要求保留，不能跟随 npm 包名机械替换。其他插件同理。
- 包清单、`repository.directory`、bundle patch 中的模块名、`exports`、客户端模块注册 ID 和资源引用必须与实际包标识一致；已有内部业务 ID 不属于必须改名的模块标识。

## 新增插件

1. 在仓库根工作区创建 `packages/<slug>`，补齐包清单、入口、bundle patch、`exports`、`files`、必要资源和测试；创建对应目录的子工作区，后续单包开发转到该工作区。
2. 提供中文 README、英文 README、变更记录、许可和通知；中英文说明相互链接，涵盖功能、安装、配置、安全、兼容版本和必要 FAQ。
3. 更新[根中文说明](<README.md>)、[根英文说明](<README.en.md>)、根锁文件和相关打包检查。
4. 同时更新[工作区检查脚本](<scripts/check-workspaces.mjs>)的预期包清单。虽然 npm workspaces 使用 `packages/*`，当前检查脚本显式枚举四包，不能只增加目录。
5. 新包尚未准备好发布时可以保留 `private: true`；正式发布前核对元数据、打包内容和授权。

## 版本、兼容与许可

- [根包清单](<package.json>)保持 `private: true`，不发布根包；各插件版本独立。使用 Changesets 记录受影响包的变更，[Changesets 配置](<.changeset/config.json>)的 `fixed`、`linked` 保持空数组。
- Node、npm 的要求以根包和各插件清单为准，不在本文件重复维护易变版本。
- `engines.dsh` 及宿主 DSH 运行依赖、peer 依赖采用经过核验的“最低支持版本及以上”范围，不精确固定单一宿主版本；用于复现验证的 `devDependencies` 可以精确固定。
- npm 默认 semver 不会自动把不同版本元组的 RC 纳入同一范围；需要时显式声明 OR 范围，不用 `--force` 或 `--legacy-peer-deps` 掩盖依赖问题。声明允许安装与真实宿主 API 验证分别记录。
- 当前统一采用 `Apache-2.0`，允许商业使用；包内发布许可和通知。角色插件与 Fast 保留历史 MIT 授权及对应许可文件，不撤销旧版本已授予的权利。
- 旧角色仓库的历史链接和迁移说明继续保留，不把旧仓或旧版本描述成已归档、已撤销授权，除非实际执行并核实。

## 测试与检查

- 默认少编写测试，只保留能发现真实缺陷的必要覆盖；重复、临时、纯文案、纯实现细节或凑数量的测试应实际删除，不以合并标题代替删除。
- 这不是默认不运行测试：保留 push/PR 自动 CI 和各包 `prepack` 测试入口，不改成仅手动、不关闭测试。
- 开发期按改动定点验证，修复后仅重跑受影响部分，复用仍有效的结果；发布前集中验收。纯文档修改核对内容、链接和差异，不为收尾反复运行全量测试。
- 不弱化断言、删除有效失败用例或更新快照来掩盖缺陷。宿主 API、权限、持久化、迁移和实际打包安装属于需要保留的关键覆盖。
- 发布前在仓库根目录集中执行：

```bash
npm run check
npm run check:public
npm run check:pack
```

`check` 包含各包检查和测试；`check:public` 检查公开边界；`check:pack` 验证实际打包内容及隔离安装。不能依赖本机 profile 或包外未打包源码来证明发布包可用。

## 发布与公开边界

- 发版前核对 npm 已有版本、待发布版本和变更记录，不能重用已发布版本或倒退版本。具体步骤见[发布与市场维护指南](<docs/releasing.md>)。
- GitHub 源码推送、npm 发布和市场收录是独立步骤，分别记录确切版本、地址与结果；徽章只显示已核实的状态。
- 当前由用户本人手动登录 npm、完成 2FA 并发布。未经明确授权，代理不发布 npm、不创建 GitHub Release、不申请市场收录；发布元数据齐全不等于已获发布授权。
- 禁止提交长期令牌、真实认证配置、home/profile、会话、日志、角色种子、真实角色及运行记录、缓存、备份和运行产物。默认配置不带个人绝对路径、私人服务地址、凭据或收件人。
- 公开检查与忽略规则都要核实，不把“已加入忽略规则”当作历史内容和打包内容已安全的证明。

## 本机部署

部署属于外层服务工作区的运行维护操作。按本机现有目录布局，从本仓库根目录可调用：

```bash
node ../../scripts/maintenance/sync-dsh-plugins.mjs --check
node ../../scripts/maintenance/sync-dsh-plugins.mjs --apply
```

- 同步脚本位于仓库外，属于本机服务维护工具，不是本仓库发布内容。`--check` 检查差异；只有用户授权运行更新时才执行 `--apply`，保护私有配置并确认备份。
- 服务重启另外确认时间窗口，不为验证插件擅自启动替代服务。
- 临时文件使用已有缓存目录或服务工作区的 `tmp/`，不创建 `draft/`；临时打包文件不提交源码仓，正式发布产物按服务工作区的发布目录约定保存。
