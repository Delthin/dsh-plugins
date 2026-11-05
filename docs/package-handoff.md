# 各插件修改交接

以下内容供各插件对话分别执行。只修改各自现有插件目录，不改 monorepo，不推送 GitHub，不发布 npm，不提交市场申请。合仓负责人后续统一迁移、锁文件、CI 与发布。

## 四包共同要求

- npm 包采用下表的 scoped 名称。同步修改补丁的包名、包自引用、前端资源解析路径、文档和相关断言。YAML 中以 @ 开头的包名须加引号。
- 包名调整不等于内部协议迁移：已有插件 id、服务名、工具名、配置键和数据目录不要机械替换；确需变更时提供兼容或迁移方案。
- repository 使用 type=git、url=git+https://github.com/Delthin/dsh-plugins.git，以及对应 repository.directory；homepage 和 bugs 指向新仓库的对应目录与 Issues。新仓库当前为私有。
- 补齐中文 README.md、英文 README.en.md、CHANGELOG、明确的 LICENSE/license。保留上游版权与许可；来源或授权不明的内容列为待确认，不擅自统一为 MIT。
- 文档覆盖功能、安装、配置、安全、最低支持 DSH 版本、FAQ、变更记录和许可；两种语言相互链接。尚未发布的 npm 安装命令标注“发布后可用”。
- 提供 npm run check 和 npm test。测试需要的宿主包显式写入 devDependencies，并用实际测试目标准备干净环境；不借用上层 node_modules。DSH 兼容声明保持经验证的最低版本及以上范围。
- 审核 exports/files/dsh.bundle.patch、前端入口、图标和语言资源，核对真实 npm pack 产物并隔离安装。运行测试后记录实际通过项与未验证项。
- 现有 private: true 保持不变；角色插件的发布开关暂不调整。不得发布、修改市场状态或提前添加 npm/收录成功徽章。
- 不提交或打包 profile、会话、日志、密钥、用户配置、缓存、node_modules、tarball 或本机路径。干净测试使用临时 profile；任何会真实发消息或请求第三方的验证先取得授权。
- 交付修改文件清单、打包公开文件白名单、精确测试命令与结果、旧配置升级办法、仍需用户确认的许可或行为决策。不自行确定首次 scoped 版本。

| 插件 | 目标包名 | repository.directory |
| --- | --- | --- |
| 飞书通知 | @delthin/dsh-feishu-notify | packages/feishu-notify |
| 角色管理 | @delthin/dsh-agent-roles | packages/agent-roles |
| Fast | @delthin/dsh-fast | packages/fast |
| 工具封装与发现 | @delthin/dsh-tool-wrap | packages/tool-wrap |

## 转发给飞书通知对话

修改现有 feishu-notify 插件，按共同要求准备 @delthin/dsh-feishu-notify。

1. 更新 package.json 的 name、仓库元数据和 cordis.patch.yml 的包名，检查前端资源与语言资源是否引用旧包名；保留 feishu-notify 内部插件 id 与既有配置兼容。
2. 补上 check 脚本；保留并运行 core.test.js、summary.test.js，补齐干净测试依赖。
3. 补齐英文文档、许可与变更记录；将需要随包交付的文档和资源纳入 files。
4. 公开配置示例仅使用占位值，说明凭据保存位置、通知接收方、免打扰、测试消息和真实发送边界。核对对外配置接口不会返回应用密钥。
5. 打包隔离安装后验证配置界面与通知工具加载；真实飞书发送只在获授权后测试。

## 转发给角色管理对话

修改现有 dsh-agent-roles 插件，按共同要求准备 @delthin/dsh-agent-roles。

1. 更新 name、补丁包名、仓库子目录和相关包名断言，保留 MIT、现有原生 Agent Team 行为和最低版本范围。
2. 同步调整 scripts/check-package.mjs 中受包名、仓库布局或公开文件清单影响的检查；保留现有 check、test、prepack 和 release:check 的实质检查。
3. 沿用已有双语说明，补上 scoped 安装方式与迁移说明；保留旧 v0.4.0 Release 安装链接。此对话不修改远端旧仓库说明，不归档仓库，不迁 Git 历史。
4. seed-roles.json、真实 roles.json/runs.json、旧 tarball 不进入公开文件白名单；明确区分测试 fixtures 和真实角色数据。
5. 验证全新安装不依赖本机种子角色，角色保存、原生团队调用与技能选择在干净 profile 下可用。说明旧安装切换到 scoped 包时如何保留数据，避免同时加载两份。

## 转发给 Fast 对话

修改现有 dsh-fast 插件，按共同要求准备 @delthin/dsh-fast。

1. 更新 name 与补丁包名。去掉 cordis.patch.yml 和配置定义中的个人供应商、真实转发域名及本机角色运行记录绝对路径；改为用户显式配置，未配置时保持安全、可解释的状态。
2. roleRunsPath 不作为普通 Fast 功能的硬性前提。将角色联动做成可选能力：没有角色插件或角色文件时，普通会话功能仍可工作；解释启用联动的方法。
3. 明确请求源与目标匹配规则、转发携带的认证头、目标地址信任要求和 Fast/priority 的实际含义。不得把用户凭据默认发送到预设第三方域名。
4. 增加 check、test 脚本并运行已有 state.test.js、transport.test.js；针对本次配置与可选联动变更补必要用例，覆盖缺配置和无角色文件。
5. 补齐双语 README、许可、CHANGELOG 与清单元数据；核对 bundle patch 和 package.json 的子路径可访问性，并实际打包验证，不为对称而新增无用 exports。
6. 使用模拟请求验证转发逻辑；会产生真实请求或费用的端到端测试先取得授权。

## 转发给工具发现对话

修改现有 dsh-tool-discovery 插件，目标名称改为 @delthin/dsh-tool-wrap；当前源目录暂不改名，合仓时进入 packages/tool-wrap。

1. 更新 package.json 的 name、根补丁包名，以及 origin-bootstrap 子路径引用。例如补丁中两处包名应分别变为 '@delthin/dsh-tool-wrap/origin-bootstrap' 与 '@delthin/dsh-tool-wrap'。
2. 检查源码、测试、前端资源、文档中的旧包名引用。保留已有 tool-discovery 内部 id、toolDiscoveryOriginsReady 服务和配置兼容；不要把所有 discovery 字样全量替换为 wrap。
3. 保留 origin-bootstrap 导出及来源捕获依赖门控，验证改名后启动顺序与延迟工具加载仍正确，PTC 与相关宿主 API 正常。
4. 增加 check 脚本，保留 test/*.test.js；显式声明 test/fixture.js 导入的宿主测试依赖，在干净目录运行，不能依赖当前 DSH 安装环境恰好存在的包。
5. 保持经验证的 DSH 最低版本范围，当前声明为 >=0.2.2-rc.1；补齐双语文档、许可、CHANGELOG。清理 VALIDATION.md 中本机与会话相关信息，只保留可公开复现的证据。
6. npm pack 后验证 origin-bootstrap.js、核心模块、client、locale、图标与补丁都在包内，并通过新的 scoped 子路径解析。
