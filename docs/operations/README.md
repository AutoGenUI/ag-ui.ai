# AG-UI.AI 维护交接入口

本目录供后续维护者和编码 agent 接手。先读 [项目上下文](../PROJECT_CONTEXT.md)、[带时间的工程状态](../CURRENT_STATE.json) 和 [AGENTS.md](../../AGENTS.md)，再按任务阅读下表。本文公开记录配置名称、职责和验证方法；账户访问、秘密值、订阅邮箱、签名链接及私人验收材料通过受控渠道移交。

| 维护范围 | 操作说明 | 需要的权限 |
| --- | --- | --- |
| DNS、域名认证、TLS、访问排障 | [DNS 维护](dns-maintenance.md) | DNSPod 域名编辑权；Sites 自定义域名管理；Brevo 域名认证管理 |
| 订阅、确认、周报、退订、回调、额度 | [邮件订阅维护](email-subscriptions.md) | Sites 配置及 owner 工具；Brevo 事务邮件与回调管理 |
| owner 身份、后台、MCP、采编任务 | [Owner 管理](owner-management.md) | 现有 Sites 项目的所有者访问及受信任连接 |
| GitHub、构建、Sites 发布、D1、回滚 | [部署实施维护](deployment-maintenance.md) | GitHub PR/合并权；现有 Sites 项目的源码、版本及部署权 |

## 当前主线与证据

- GitHub 主线为 [AutoGenUI/ag-ui.ai 的 main](https://github.com/AutoGenUI/ag-ui.ai)。v12 源码、依赖安全门槛与资源体积修复已通过 [PR #3](https://github.com/AutoGenUI/ag-ui.ai/pull/3) 合入，2026-10-13 09:18 UTC 清理完成时只保留 main。每次迭代可使用临时 PR 分支，合并并核对内容后清理，不改主分支保护。
- 生产 v12 / 公众邮件开放 / 既有采编任务来自 2026-10-13 的已校验交接。GitHub 修复合并不代表 Sites 已部署这些修复；本轮文档工作未修改生产配置、域名、任务或发送真实邮件。
- 唯一 Sites 项目身份保存于 [.openai/hosting.json](../../.openai/hosting.json)，D1 逻辑绑定为 `DB`。复用此项目，不因交接重新创建网站、域名、数据库或任务。
- DNS 文档另含当日公共解析/TLS 观察；它不能替代 DNSPod 完整 zone 清单、Brevo 认证状态或 Sites 部署状态。所有时间点与缺口必须保留。

## 接手第一轮

1. 检查 checkout、未提交改动、远端、PR、最新 CI 和工作区附着。保留用户文件与依赖目录；不要静默 reset、clean、stash、覆盖锁文件或切换脏工作区。
2. 明确本轮授权：仅代码/文档、发布、DNS、任务、邮件验收是不同动作。按当前授权推进，读取不必要的秘密或发送验收邮件不是接手前提。
3. 通过各平台的安全登录/授权流程确认权限。GitHub 权限、Sites 项目权限和应用 `SITE_OWNER_EMAIL` 身份是不同层；GitHub 写权限不提供生产 owner 权限。账户密码、OTP 和服务端密钥不进入聊天、PR 或命令输出。
4. 需要生产动作时，先取得实际部署版本与源码映射、待执行迁移、D1 备份/恢复能力、DNSPod 完整清单、Brevo sender/domain/webhook 状态及既有任务最后成功记录。当前文档没有重新读取这些账户；缺项先核实，不能用旧快照代替。
5. 本地使用 Node 22、`npm ci`、隔离 D1/Worker 与关闭邮件的配置。完成适用检查后经 required `verify` PR 合入；另获发布授权时才走 Sites 的保存版本、部署及终态验证流程。
6. 回报提交、PR、CI、生产是否变更、证据时间和未完成项；更新公开上下文。机器状态不循环引用自身文档提交 SHA，最新提交用 GitHub 查询。

## 日常与异常处理

| 时点/异常 | 维护动作 |
| --- | --- |
| 采集每天 08:00、20:00；周报每周一 09:00（Asia/Singapore） | 检查既有任务成功 checkpoint、来源失败和投递积压；按稳定 run ID 恢复，避免重复发文/发信。不要重建同名任务或从采编任务调用 `mail-test`。 |
| 超过 36 小时未成功采集 | 检查源访问、任务执行和 owner MCP 连接；保留陈旧提示，按变更通知一次，不以页面 200 代替成功运行。 |
| 发送失败、退信、投诉、`uncertain` | 区分站内队列、Brevo 接受请求、回调和实际收件；遵循抑制与人工对账，不自动重发不确定提交。 |
| 403 / TLS / DNS 异常 | 先保存时间、出口、公共解析和 HTTP/TLS 证据；区分边缘拦截与 Worker 故障，不因单一出口 403 删除记录或改 nameserver。 |
| 代码/迁移发布失败 | 保存失败版本与日志摘要，检查迁移是否已执行；代码回退不会撤销 D1 数据变更。按部署手册处理，保持确认、退订和 owner 入口可用。 |

## 尚需后续验证

- 8 项 moderate 依赖问题与 JS 原始体积仅 1169 字节余量：未来依赖/页面修改重新审计和构建，不降门槛。
- 邮件匿名跟踪已按交接接受并披露；完全关闭像素与链接改写尚未验证。中国大陆可访问性不保证。
- 当前账户权限、完整 DNS 清单、DKIM selector、实际部署版本、迁移 ledger、托管 D1 备份/恢复方式、实时任务状态与 provider 剩余额度均需在授权的生产维护中刷新。
- 真实 queued cancellation 与完整退信场景未全部观察；本地测试和历史验收不能扩写为所有生产情形都已验收。

旧 [首发清单](../LAUNCH_CHECKLIST.md) 和 [2026-07-20 上线记录](2026-07-20-public-launch.md) 仅用于追溯。它们的删 DNS/恢复私有站点方案不适用于已开放邮件的 v12。
