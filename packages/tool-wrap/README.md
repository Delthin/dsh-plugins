# @delthin/dsh-tool-wrap

[![npm](https://img.shields.io/npm/v/%40delthin%2Fdsh-tool-wrap?style=flat-square)](https://www.npmjs.com/package/@delthin/dsh-tool-wrap)
[![Node](https://img.shields.io/node/v/%40delthin%2Fdsh-tool-wrap?style=flat-square)](https://www.npmjs.com/package/@delthin/dsh-tool-wrap)
[![DSH](https://img.shields.io/badge/DSH-%E2%89%A50.2.2--rc.1-6366F1?style=flat-square)](https://dshmarket.com/)
[![license](https://img.shields.io/badge/license-Apache--2.0-8A2BE2?style=flat-square)](https://www.apache.org/licenses/LICENSE-2.0)
[![LINUX DO](https://img.shields.io/badge/LINUX%20DO-%E7%A4%BE%E5%8C%BA-FFB000?style=flat-square)](https://linux.do/)

[English](README.en.md) | [变更日志](CHANGELOG.md) | [市场页](https://dshmarket.com/zh/p/Delthin/dsh-plugins--packages-tool-wrap/)

在兼容的 PTC 会话里，tool-wrap 把选中的工具定义折叠成一份简介加工具名目录，并给模型注入一个 `unwrap` 工具，需要时按插件整体取回完整定义，原有工具权限保持不变。提示词的角色、排序、排除以及随包加载属于进一步的编排能力，依赖对宿主文件的额外 host-support 适配（见安装一节）。

适用于 DSH `>= 0.2.2-rc.1` 的 PTC 会话。插件默认关闭，原生工具调用模式和关闭状态下保留宿主原有展示。

## 安装

```bash
npm install @delthin/dsh-tool-wrap
```

安装后按宿主支持的插件导入方式加载 `@delthin/dsh-tool-wrap/origin-bootstrap` 和主插件 `@delthin/dsh-tool-wrap`，然后重启 DSH 服务。`origin-bootstrap` 必须先于其他工具插件加载，否则来源信息不完整（详见下文常见问题）。

要注意的是，npm 安装本身不会完成提示词编排的宿主适配：完整编排（提示词角色、排序、排除及随包说明进入真实消息）需要按 [host-support](host-support/README.md) 的说明人工审核并执行适配脚本，未激活适配时这些功能不可用，工具折叠本身不受影响。

### 从 `dsh-tool-discovery` 升级

本包由原 `dsh-tool-discovery` 迁移而来，模型工具名为 `unwrap`（旧会话的 `discover_tools` 仍可调用），服务名、页面 ID 和配置文件 `tool-discovery.json` 保持不变。升级步骤：

1. 同一宿主实例中不要同时启用新旧两个包（它们共享内部服务名和页面 ID）。
2. 备份 profile 目录下的 `tool-discovery.json`；新包可直接沿用，读取时自动迁移，保存为 `v3`。
3. 移除旧包、接入新包后重启 DSH 服务。

## 使用

### 界面配置

启用插件后，从左侧导航「工具与提示词」或「设置 → 工具与提示词」进入配置页，左侧分「注入 / 不注入 / 工具」三页：

1. 打开顶部开关；要用提示词角色、排序和排除功能，还需开启「提示词编排」。
2. 「注入」页分为「系统提示词」「用户（固定）」「用户（状态）」三个区；后两区都使用真实 user 消息。固定内容未变化时保留原位，状态变化时在当前输入之后追加完整快照。同区拖动或 `Alt + ↑ / ↓` 排序，跨区拖动调整角色与分区；右侧「更多」可移动分区、恢复默认分区及设置加载策略。各区可独立折叠，搜索和移入操作会展开相关区域。
3. 「工具」页点击插件行的「移入」，把整个插件纳入「按需工具包」；点击名称可在右侧逐项选择工具。「移出」则恢复普通工具暴露。包间和外层工具来源独立排序。
4. 「注入」页点击某段的垃圾桶把它移到「不注入」，点击「恢复」可回到「注入」。移除只更改该段的启用状态，保留角色、加载策略和工具选择，可随时恢复。
5. 点击底部「保存设置」。保存前均为草稿，可取消；保存后作用于当前 profile 各会话的后续提示词组装，已在运行的请求不受影响。

工具配置与提示词编排相互独立：移动提示词不会改变工具选择或插件归属，工具页签也不会因提示词操作改变折叠范围。

### 模型端按需加载

在兼容的 PTC 会话中，模型在 `run_code` 里调用 `unwrap`：

1. `return await tools.unwrap({});` —— 列出当前可见的按需插件目录。
2. `return await tools.unwrap({ plugin: "插件精确ID", format: "schema" });` —— 一次取回该插件全部可见工具的完整定义。建议每次只加载一个插件包，避免输出截断。
3. 无插件归属的工具用 `return await tools.unwrap({ tool: "精确工具名", format: "schema" });`。
4. 后续步骤中正常调用 `tools.<name>(...)`。

`format: "schema"` 保留完整原始参数与返回 Schema，省略重复的 SDK 类型文本；省略 `format` 则同时返回 `schemas` 和 `sdk`。发现过程不做关键词搜索、不执行目标工具，也不改变任何执行权限：输出严格取自当前调用者权限范围内可见的工具，条件准入、参数校验、审批和沙箱限制全部保留。

### 插件简介

点击插件名称可在右侧查看或编辑简介（自定义简介优先于插件自带说明，长度 1–2000 字符，最多保存 512 个）。插件没有自带说明时，可点击「生成简介」让当前部署的默认模型根据工具名和描述生成草稿；该操作只发送工具名称与描述，不发送参数 schema 和任何会话内容，可能产生模型调用费用，结果作为草稿需手动保存。

### 用量统计

设置页底部展示折叠前后的对比，统计对象是 PTC 工具说明投影的字符数（含 `unwrap` 自身和目录的开销；只折叠极少量短工具时目录开销可能超过节省量）。token 数按字符差 ÷4 四舍五入粗估，供参考；实际计费和缓存命中以模型服务商返回的 usage 为准。提示词编排和解包返回的内容不计入该统计。

## 提示词编排（进阶）

开启「提示词编排」后可以调整各提示词段的角色、顺序和加载策略，保存后从后续请求开始生效。完整编排（包括随包说明进入真实 system/user 消息）依赖对宿主文件的显式适配：适配脚本和说明见 [host-support](host-support/README.md)，只接受已审核的 `0.2.2-rc.1` 文件形态，需要人工审核并备份后执行；npm 安装本身不会完成编排适配。未激活适配时，页面仍会展示全部已知来源和限制原因，统一编排不可启用。

编排配置独立保存在 `prompt-composition.json`，默认关闭；已有 `prompt-order.json` 会迁移插件优先顺序并保留原文件。

### 自动更新与缓存前缀

固定正文更新追加该来源的新版本，状态变化追加完整替代快照，保留此前的请求前缀；显式排除、角色或分区变更会撤回受影响的旧副本。支持历史内系统更新的模型可继续使用原生增量路径。更新插件后，已有宿主适配须用原备份和 manifest 重新检查、应用，再由用户重启 DSH 并刷新浏览器。实际缓存命中以服务商 usage 为准。

## 配置文件

配置保存在当前 profile 目录的 `tool-discovery.json`：

```json
{
  "version": 3,
  "enabled": false,
  "groups": [],
  "tools": [],
  "exclude": [],
  "descriptions": {}
}
```

- `groups`：按插件 ID 整包纳入按需发现，插件后续新增工具自动纳入。
- `tools` / `exclude`：按精确工具名显式纳入或排除；`exclude` 优先级最高，被排除的工具始终完整展示。
- `run_code`、`unwrap`、`discover_tools` 不可折叠，始终保留。
- 旧版 `v1`、`v2` 配置读取时自动迁移；保存采用临时文件原子重命名，权限 `0600`；文件损坏时报错拒绝覆盖，不静默重置。

## 常见问题

- **工具来源全部未识别。** `origin-bootstrap` 需要在其他工具插件注册之前运行，热加载或刷新页面无法补记来源。确认启动配置包含 `origin-bootstrap` 并重启 DSH 服务。
- **设置保存后的生效时间。** 已在运行的请求不受影响，后续组装按新配置生效。
- **被排除工具仍完整展示。** 检查它是否在 `exclude` 中，排除优先于整包选择。
- **简介生成的发送内容。** 只发送所选插件的名称、工具名和工具描述，不含对话历史和参数 schema。

## 安全边界

设置与生成 API 受宿主认证和同源策略保护，请求体上限 64 KiB。插件不包装工具执行器、不调用 `tools.restrict`；角色变更只由已认证管理界面配置。工具定义作为结果返回当前对话，不回写全局提示词，也没有跨会话共享的“已解锁工具池”。

## 许可证

[`Apache-2.0`](../../LICENSE)，允许商业与非商业使用、修改和分发；分发时保留许可证与声明并标明修改文件。
