# Brevo 收件人级跟踪退出（2026-10-14）

用户明确授权实施 `contactPixelTrackingConsent: false`、提交推送并更新应用。基线为 main `983a21cf579eb11176bd307fc9016286f6ef9780`、已发布 Sites v17；保留 v1.0.0/v1.0.1 标签，未创建新语义化版本。

## 实现与边界

共享 Brevo `POST /v3/smtp/email` 的 `to` 收件人对象明确携带布尔值 `contactPixelTrackingConsent: false`。确认邮件和周报、中英文、公众与 owner 测试邮件均走此入口。没有添加请求级同名字段、允许跟踪的回退或第二次发送。订阅/退订、配额、抑制、幂等、签名和回调鉴权保持原样；跟踪事件不作为送达或已读证据。

依据 2026-10-14 查阅的 [Brevo 官方说明](https://help.brevo.com/api/v2/help_center/en-us/articles/37113920427922.json)，API 参数属于每个 `to`/`cc`/`bcc` 收件人，当前本站仅使用 `to`。该功能还要求先在账户 Settings → Contacts → Per-contact pixel tracking consent 中启用；将未知同意状态跟踪设为 No。此设置不影响 delivered、bounce、spam、invalid、blocked、unsubscribed 等投递/抑制事件。

账户状态核验尚未完成：现有浏览器登录跳转连接失败，已请求所有者安全登录或反馈上述开关状态。不读取密码、会话或密钥；代码发出明确退出请求不等于账户功能已启用。中英订阅页、隐私页和模板同步说明“要求关闭打开与点击跟踪”，并保留最终邮件像素与链接改写是否完全移除的未验证边界。本轮没有发送真实邮件或检查真实 MIME，因此即便账户开关后续确认，也不能据本地 mock 宣称所有客户端完全无跟踪。

## 验证与发布记录

- 隔离数据库和 mock provider：新闻/邮件 69 项通过；新增中英 × 公众/测试四组，验证确认和周报都携带退出参数、投递关联仍在、提交与送达区分、跟踪事件不改变状态、硬退信抑制及额度保留。
- 本地共 124 项通过：35 基础、69 新闻/邮件、12 订阅 UI、8 隔离 Worker HTTP；内容校验、TypeScript、lint、构建与原预算通过。审计仍为 8 moderate、0 high/critical，lint 两项既有 warning。JS 919926/gzip267601、CSS116185/gzip23035 字节，未放宽预算。
- 独立只读代码审查未发现问题。本地浏览器核对中英订阅和隐私文案，390×844 英文订阅无横向溢出；本地邮件关闭，不代表真实收件或生产 DOM。CI 与部署凭据完成后另行追加。
- 未修改 DNS、Sites 环境、D1 schema、任务、生产邮件开关或额度；不调用真实发信或投递队列。测试与真实收件验收分开记录。
