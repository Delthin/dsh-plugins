# DSH Agent Roles (`@delthin/dsh-agent-roles`)

[![npm](https://img.shields.io/npm/v/%40delthin%2Fdsh-agent-roles?style=flat-square)](https://www.npmjs.com/package/@delthin/dsh-agent-roles)
[![Node](https://img.shields.io/node/v/%40delthin%2Fdsh-agent-roles?style=flat-square)](https://www.npmjs.com/package/@delthin/dsh-agent-roles)
[![DSH](https://img.shields.io/badge/DSH-%E2%89%A50.2.2--rc.1-6366F1?style=flat-square)](https://dshmarket.com/)
[![license](https://img.shields.io/badge/license-Apache--2.0-8A2BE2?style=flat-square)](https://www.apache.org/licenses/LICENSE-2.0)
[![LINUX DO](https://img.shields.io/badge/LINUX%20DO-%E7%A4%BE%E5%8C%BA-FFB000?style=flat-square)](https://linux.do/)

[English](README.en.md) · [发布记录](CHANGELOG.md) · [市场页](https://dshmarket.com/zh/p/Delthin/dsh-plugins--packages-agent-roles/)

基于 DSH `>= 0.2.2-rc.1` 原生 Agent Team 的角色管理插件。**角色（Role）**是可复用的配置模板，保存职责提示词、模型与思考强度、工具白名单和 Skills；**成员（Member）**是主代理按角色启动的运行实例。主代理能看到所有已启用角色的信息，按任务自行决定何时创建成员。

首次安装是**空角色目录**，不含任何作者预设；升级已有安装则保留本地数据。原独立仓库与历史发布保留在[旧仓库](https://github.com/Delthin/dsh-agent-roles)与[旧发布](https://github.com/Delthin/dsh-agent-roles/releases)。

## 安装

```bash
npm install @delthin/dsh-agent-roles
```

安装无脚本、无编译。按宿主方式导入（如 `cordis.patch.yml`）并启用后，刷新 Web 页面即可在左侧导航看到「多智能体」入口；未自动加载时重启对应 Web profile。插件会启用 DSH 原生团队服务与工具，并按官方实验团队 profile 的方式停用旧的 `tool-subagent` 系列条目；已有自定义团队 bundle 时请检查相同 ID 的覆盖。

## 配置角色

1. 「多智能体 → 角色 → 新增角色」：填写显示名称、分发名称（小写字母、数字、连字符）和职责描述——职责描述供主代理判断何时选用该角色。
2. 选择模型供应商、模型和思考强度；需要时在下方「添加备用模型」配置有序回退链（最多 15 项）。
3. 「提示词」定义职责、边界和交付标准；「工具」勾选该角色的工具白名单；「技能」按需勾选 Skills（默认为空）。
4. 设为启用并保存。

角色启用后直接在主会话里描述任务即可，例如：

> 请把这份改动交给 reviewer 审阅，要求指出有依据的问题；你汇总结果并决定如何处理。

主代理调用 `spawn_role` 启动成员，成员在全新的独立会话中运行，不继承主代理上下文，所以分发时要把必要背景写进提示词；需要追问时通过 `send_message` 继续与同一成员沟通。成员之间不能互相通信，任务拆解和结果汇总由主代理集中负责，可在「多智能体 → 子智能体」查看成员记录、输出摘要并跳转会话。

成员启动时会保存当时的角色提示词、模型设置和 Skills 正文快照；之后修改或删除角色不影响已创建的成员。「请求详情」记录实际使用的模型、思考强度与工具列表，并核对系统提示词、角色提示词和技能正文是否完整加载。

## 模型回退链

每个备用项独立选择供应商、模型、思考强度和标准 / Fast 档位，按顺序生效：

- **额度耗尽**：立即切换到下一项。
- **其他请求错误**：先按 1 / 2 / 4 秒重试 3 次，仍失败再切换；每个模型最多请求 4 次。
- 切换沿用同一成员和原生会话历史，保留已提交的工具结果；整条链全部失败后保留最后错误并结束本次执行。
- 启动时冻结整条调用链，后续编辑角色只影响新成员；未配置备用项的角色保持单模型行为。「子智能体」列表展示当前模型与切换记录。
- 取消或中断成员会停止等待和后续切换，按取消处理，不计为模型错误切换。

回退依赖 DSH `>= 0.2.2-rc.1` 的公开模型选择与 inbox API，作用于宿主规范化后的模型请求失败；准备阶段和工具执行等直接抛出的异常会终止当前执行。

## Skills 与工具边界

勾选的 Skills 在成员启动时通过原生技能服务读取，以 `<skill_content>` 格式完整注入新成员的系统提示词。Skills 只提供文本指令，不自动赋予工具权限；技能所需的外部命令和依赖仍需在宿主和工具白名单中另行配置。所选技能启动时不可用会导致启动失败并报告缺失名称。

工具白名单约束的是模型可调用的工具集；文件读写和命令执行仍受 DSH 全局权限与文件策略控制，两者分别配置。

## 使用成本

主代理和成员处理任务、结果与追问都会产生模型输入输出，勾选的 Skills 完整正文也计入成员会话输入。建议只为角色勾选必要的 Skills；简单直接的任务交给主代理完成即可，无需拆成多智能体协作。

## 数据与配置

数据目录默认为 `$DSH_HOME/agent-roles`（未设置时 `~/.dsh/agent-roles`）：

- `roles.json` 保存角色目录；`runs.json` 保存成员启动快照、请求校验结果和最近输出摘要（完整对话历史在 DSH 原生会话存储中）。
- 快照包含提示词和技能全文，备份时按敏感数据保护；卸载插件或删除角色不会清除已有运行记录。
- 多个独立 DSH 进程请配置不同的 `dataDir`（当前存储无跨进程写锁）。

可在 profile 的 `cordis.patch.yml` 中自定义（以下模型 ID 均为示例占位，请替换为自己环境中的实际模型 ID）：

```yaml
- id: agent-roles
  config:
    dataDir: ~/my-dsh-data/agent-roles
    fastProviders: []
    delegationRules:
      - leaderModel: lead-model-id # 示例占位，替换为实际 ID
        denyModels:
          - blocked-member-model-id # 示例占位，替换为实际 ID
```

- **Fast**：默认 `fastProviders: []`，模型旁的 Fast 按钮不可用。本插件只记录 Fast/标准选择，不内置 priority 传输实现；只有环境中已装好对应传输适配时才把供应商 ID 加入，启用 priority 传输可能改变供应商计费。
- **委派限制**：`delegationRules` 按主代理当前模型拦截被禁止的子代理模型（精确匹配、不区分供应商），保存后立即生效；也可在「多智能体 → 设置」界面配置，宿主缺少 `configEditor` 服务时界面只读。

## 运行限制

单个团队最多 32 个成员、256 个共享任务；并发与委派深度受 DSH 原生 subagent 配置约束。角色管理 API 复用 DSH Web 身份验证，请求体上限 1 MiB。请勿把已登录的 DSH Web 会话暴露给不可信用户。

## 常见问题

- **作者预设与已有数据。** 不带作者预设，首次安装始终是空目录；升级保留原数据。
- **设置页只读。** 在线保存委派规则依赖宿主 `configEditor` 服务，缺失时请直接改 profile 的 `cordis.patch.yml`。
- **Fast 开关不可用。** `fastProviders` 默认为空，需显式配置支持 priority 传输的供应商 ID。

## 开发与校验

在单仓根目录执行 `npm ci --ignore-scripts`、`npm run check`、`npm run check:public`、`npm run check:pack`。源码无构建步骤，测试使用虚构角色与模拟模型。发布流程见[发布指南](docs/RELEASING.md)。提交问题时请附 DSH 版本、插件版本和脱敏日志，勿上传私有角色配置或会话数据。

## 许可证

自 `0.4.1` 起采用 [`Apache-2.0`](./LICENSE)，允许商业与非商业使用、修改和分发，分发时保留许可证与声明并标明修改文件。历史版本 `<= 0.4.0` 已授予的 MIT 许可不撤回，条款保留在 [LICENSE-MIT-legacy](./LICENSE-MIT-legacy)。
