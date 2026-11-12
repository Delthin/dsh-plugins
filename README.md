# Delthin DSH Plugins

[![tool-wrap](https://img.shields.io/npm/v/%40delthin%2Fdsh-tool-wrap?style=flat-square&label=tool-wrap)](https://www.npmjs.com/package/@delthin/dsh-tool-wrap)
[![agent-roles](https://img.shields.io/npm/v/%40delthin%2Fdsh-agent-roles?style=flat-square&label=agent-roles)](https://www.npmjs.com/package/@delthin/dsh-agent-roles)
[![license](https://img.shields.io/badge/license-Apache--2.0-8A2BE2?style=flat-square)](https://www.apache.org/licenses/LICENSE-2.0)
[![LINUX DO](https://img.shields.io/badge/LINUX%20DO-%E7%A4%BE%E5%8C%BA-FFB000?style=flat-square)](https://linux.do/)

这里是维护六个 DeepSeek Harness（DSH）插件的仓库，每个插件独立开发、独立版本、单独安装。语言：[English](./README.en.md)｜[发布与市场维护指南](./docs/releasing.md)｜[日常维护说明](./docs/package-handoff.md)

## 插件一览

| 插件 | 用途 |
| :--- | :--- |
| [`feishu-notify`](./packages/feishu-notify/README.md) | 飞书通知与任务完成提醒 |
| [`agent-roles`](./packages/agent-roles/README.md) | 基于原生 Agent Team 的可复用子代理角色管理 |
| [`fast`](./packages/fast/README.md) | Standard / Fast 档位与模型推理强度切换 |
| [`tool-wrap`](./packages/tool-wrap/README.md) | 按需折叠插件工具与提示词，精简常驻上下文 |
| [`global-pins`](./packages/global-pins/README.md) | 全局置顶对话 |
| [`cardex`](./packages/cardex/README.md) | 用 `/cardex` 把会话整理成知识卡片、知识树和图谱 |

各包配置与使用说明见对应目录下的 `README.md` / `README.en.md` 和 `CHANGELOG.md`。

## 安装

下面命令按需选择：

```bash
npm install @delthin/dsh-feishu-notify
npm install @delthin/dsh-agent-roles
npm install @delthin/dsh-fast
npm install @delthin/dsh-tool-wrap
npm install @delthin/dsh-global-pins
npm install @delthin/dsh-cardex
```

加载和配置入口见各插件说明。首次安装或升级后建议重启 DSH 服务。

## 使用注意

- `fast` 会把原始 `Authorization` 请求头转发到配置的目标网关，只配置完全受信任的地址；`priority` 档位计费可能更高。
- `feishu-notify` 的 `AppSecret` 只通过 Web UI 录入，本地以 `0600` 权限落盘，不写进仓库或环境变量。
- `tool-wrap` 默认关闭，只在 PTC 会话中生效；开启简介自动生成会调用当前默认模型，可能产生费用。

## 开发与校验

源码为纯 JavaScript，无构建步骤。开发要求 `Node.js >= 22.19.0`、`npm >= 11.5.1`。发布前在仓库根目录依次执行：

```bash
npm ci --ignore-scripts
npm run check          # 逐包语法、测试、清单与 locale 检查
npm run check:public   # 公开与隐私边界扫描
npm run check:pack     # 打包与隔离安装验证
```

运行 profile、日志、密钥和 `.tgz` 产物不入库。

## 许可证

本仓库及各子包当前版本采用 [`Apache-2.0`](./LICENSE)，允许个人与商业使用、修改和分发；分发时保留许可证与声明并标明修改。历史许可见 [agent-roles](./packages/agent-roles/LICENSE-MIT-legacy) 和 [Fast](./packages/fast/LICENSE-MIT-legacy)。
