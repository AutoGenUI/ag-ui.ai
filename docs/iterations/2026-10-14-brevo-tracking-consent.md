# Brevo 收件人级跟踪退出（2026-10-14）

用户明确授权实施 `contactPixelTrackingConsent: false`、提交推送并更新应用。基线为 main `983a21cf579eb11176bd307fc9016286f6ef9780`、已发布 Sites v17；保留 v1.0.0/v1.0.1 标签，未创建新语义化版本。

## 实现与边界

共享 Brevo `POST /v3/smtp/email` 的 `to` 收件人对象明确携带布尔值 `contactPixelTrackingConsent: false`。确认邮件和周报、中英文、公众与 owner 测试邮件均走此入口。没有添加请求级同名字段、允许跟踪的回退或第二次发送。订阅/退订、配额、抑制、幂等、签名和回调鉴权保持原样；跟踪事件不作为送达或已读证据。

依据 2026-10-14 查阅的 [Brevo 官方说明](https://help.brevo.com/api/v2/help_center/en-us/articles/37113920427922.json)，API 参数属于每个 `to`/`cc`/`bcc` 收件人，当前本站仅使用 `to`。该功能还要求先在账户 Settings → Contacts → Per-contact pixel tracking consent 中启用；将未知同意状态跟踪设为 No。此设置不影响 delivered、bounce、spam、invalid、blocked、unsubscribed 等投递/抑制事件。

账户设置于 2026-10-14 由所有者确认已完成：启用 per-contact consent，并按此前给出的步骤将未知同意状态跟踪设为 No。浏览器登录跳转连接失败，本代理没有独立读回设置，证据归因所有者确认。不读取密码、会话或密钥；API 参数与账户设置分别记录，不能由代码部署推断账户状态。中英订阅页、隐私页和模板同步说明“要求关闭打开与点击跟踪”，并保留最终邮件像素与链接改写是否完全移除的未验证边界。本轮没有发送真实邮件或检查真实 MIME，不能据账户确认或本地 mock 宣称所有客户端完全无跟踪。

## 验证与发布记录

- 隔离数据库和 mock provider：新闻/邮件 69 项通过；新增中英 × 公众/测试四组，验证确认和周报都携带退出参数、投递关联仍在、提交与送达区分、跟踪事件不改变状态、硬退信抑制及额度保留。
- 本地共 124 项通过：35 基础、69 新闻/邮件、12 订阅 UI、8 隔离 Worker HTTP；内容校验、TypeScript、lint、构建与原预算通过。审计仍为 8 moderate、0 high/critical，lint 两项既有 warning。JS 919926/gzip267601、CSS116185/gzip23035 字节，未放宽预算。
- 独立只读代码审查未发现问题。本地浏览器核对中英订阅和隐私文案，390×844 英文订阅无横向溢出；本地邮件关闭，不代表真实收件或生产 DOM。以下记录实际 CI 与部署结果。
- 未修改 DNS、Sites 环境、D1 schema、任务、生产邮件开关或额度；不调用真实发信或投递队列。测试与真实收件验收分开记录。

## GitHub 与生产回执

- [PR #15](https://github.com/AutoGenUI/ag-ui.ai/pull/15) 于 2026-10-14T13:49:26Z 正常 rebase 合入，main `0f52548272e40812a31889360f32085e9d376a3e`；[required verify](https://github.com/AutoGenUI/ag-ui.ai/actions/runs/38574795407/job/115888950947) 通过，严格保护未变。
- main 第一次检查的首个匿名本地 `/mcp` 返回 500 而非 403，后续 MCP 检查通过；[同提交 attempt 2](https://github.com/AutoGenUI/ag-ui.ai/actions/runs/38575068866/job/115890916808) 全部通过。未改变断言或加自动重试。缺少当次 Worker 日志，Wrangler POST 转发瞬断只是可能原因，不能宣称根因已确定。
- 原 Sites 项目保存为 **v18**，version `appgprj_6a5dcacfcbb4819193bac2b2104ed926~appgver_498187b5f2b4819193c2017ce0f9f283`；source `44b23a03dad8bd597f564d2187df708e89d473f1`，tree `eea00579439d7f576c310acdddda49cb51ff3af8` 与 GitHub 迭代完全一致。
- deployment `appgdep_6acf894d40c081918a34737f2fbf1c3a` 于 2026-10-14T13:53:31.694330+00:00 返回 succeeded；env revision12、public/active、MCP、2 项既有任务保留。
- 保留 v1.0.0/v1.0.1 原标签；没有新 tag。发布回执的文档 PR 可领先部署提交，不为文档再次部署；最终 main SHA 从 GitHub 查询。

发布后 2026-10-14T13:54:43.214568+00:00 使用 QA User-Agent 只读检查：中英订阅/隐私页 HTTP200 且含新披露，三个 RSS 和公开状态200，匿名管理403；公众邮件 enabled，聚合人数2、余位248、容量250。未读取订阅行、访问真实签名链接或调用发信。生产 DOM 与真实邮件未新增验收；当前出口通过不代表所有网络可达。
