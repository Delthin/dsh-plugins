# Delthin DSH Plugins

[English](README.en.md)

统一管理源码、CI 和版本记录的 DSH 插件仓库。四个插件独立安装、独立升级，不提供聚合插件。

## 当前状态

仓库骨架已建立，插件源码尚未迁入。以下是计划使用的 npm 名称，不代表已发布；npm scope 权限仍需确认。当前没有本仓库的新市场收录状态。

| 插件 | 目标目录 | 计划包名 |
| --- | --- | --- |
| 飞书工作通知 | packages/feishu-notify | @delthin/dsh-feishu-notify |
| 原生角色管理 | packages/agent-roles | @delthin/dsh-agent-roles |
| Fast 请求处理 | packages/fast | @delthin/dsh-fast |
| 工具封装与发现（原 dsh-tool-discovery） | packages/tool-wrap | @delthin/dsh-tool-wrap |

角色插件既有版本仍见[原仓库](https://github.com/Delthin/dsh-agent-roles)与 [v0.4.0 Release](https://github.com/Delthin/dsh-agent-roles/releases/tag/v0.4.0)。迁移完成前保留原维护入口。

## 开发

使用 Node 22.19+ 或 Node 24，以及 npm 11.5.1+。

~~~sh
npm ci --ignore-scripts
npm run check
~~~

目前 CI 只验证仓库骨架；插件迁入后会执行各包的 check 和 test。完整的打包、隔离安装、宿主 API 和公开安全验收仍待完成。包声明使用经验证的 DSH 最低版本范围，不固定单个宿主版本。

[各包修改交接](docs/package-handoff.md) · [迁移与发布](docs/releasing.md)

## 许可

各包迁移前核实来源并保留原许可。角色插件已有 MIT；其他包许可待确认。根工作区为私有管理包，当前不授予仓库统一许可证。
