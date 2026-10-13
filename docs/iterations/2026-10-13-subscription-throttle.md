# 订阅申请限流反馈与只读排障（2026-10-13）

## 问题与原因

普通收件人反馈重复申请后页面显示“查看邮件，确认订阅”，但没有收到新邮件。v15 的 `subscribe` 在查身份之前限制同一客户端每固定小时 5 次、同一邮箱每固定日 2 次；超过限制直接返回 `check-inbox`，没有建队列或发信。历史测试身份的无效公众申请也占申请次数，角色释放保留计数，因此释放成功不保证同一天的下一次申请获准。该路径已用隔离数据库与 mock 提供商复现；发布前尚未获得目标的精确只读诊断，不能仅由全站聚合确定其原因。

此限制与本站每日 300 次邮件提交额度、250 个确认名额不同。申请日窗口按 UTC 00:00（新加坡 08:00）切换；小时窗口按整点切换，不是从最后点击再等完整 24 小时。`rate_limits.expires_at` 用于记录保留，不能当作固定 bucket 的重试时间。

## 实现与边界

超过申请限制返回 HTTP 429、`rate-limited` 与下一窗口的 `retryAt`，并设置 `Retry-After`。中英界面在原统一反馈位置明确本次未发送新邮件，并显示新加坡时间的重试时刻；输入与同意保留，用户届时主动申请，不自动重试。保留全部限额、计数、抑制、代际与防重复投递。

新增 owner `mail-test` 的只读 `diagnose`，必须用 `expectedRecipient` 精确匹配服务端已配置目标；只返回该目标的角色/状态、当前申请限流、最多 5 条公众确认投递状态与本站当天提交计数，不返回地址、ID、签名、偏好或原始提供商错误。错目标在数据库读取前拒绝；匿名管理/MCP 仍拒绝。该诊断不发信、不释放身份、不更改配额或订阅；不得放入定时采编。

本轮不读取私有邮箱、服务端秘密或原始订阅行，不发测试邮件、不重置任何生产计数、不购买额度。公开文档不保存实际收件地址或逐人投递记录。生产发信/配置/DNS/任务保留，v1.0.1 仍等用户验收。

## 验证与发布记录

候选基于 main `a7e282095610c62344b7a0f670cd3c454523e84d`。验证、GitHub 与 Sites 结果完成后补录；下述 v15 仍为发布前生产版本。

Local tests: 35 base + 64 news/mail + 12 subscription UI passed, TypeScript and content validation passed. Audit remains 8 moderate / 0 high / 0 critical; lint retains two known warnings and no errors. First build exceeded the unchanged 920000-byte JS budget by 68 bytes; concise equivalent English copy recovers space, final budget pending. No production mail sent.

Final local gate: 119 unique tests (35 base + 64 news/mail + 12 UI + 8 isolated Worker HTTP), TypeScript, content, audit and lint passed. Bundle JS 919961/gzip267637; CSS116185/gzip23035, original limits unchanged. Only 39 raw JS bytes remain; future changes must recheck the budget. Browser verified Chinese desktop and English 390x844, capacity above notice above form, retained consent/input and precise Singapore retry time. Signup responses were local CDP fixtures only; backend HTTP429 and boundary tests use isolated D1 and a mock provider. No live subscription submitted.
