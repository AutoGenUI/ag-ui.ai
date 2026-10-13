# 邮件订阅与投递维护

核对日期：2026-10-13；实现依据 main `24edc498f5c135e283d773d946fcab3e99d239bd`。2026-10-13 05:26 UTC 的 v12 交接记录公众邮件、发信域名认证和真实验收已完成，发件地址 `news@ag-ui.ai`。本次只读代码/官方资料和文档更新没有重验收、发真实邮件或读取生产秘密。交接状态不是实时账户状态；不要用早期“待启用”示例把生产邮件关掉，也不要重复开启。

先读 [维护入口](README.md)、[owner 管理](owner-management.md)；域名认证记录见 [DNS 维护](dns-maintenance.md)，构建、绑定与发布见 [部署维护](deployment-maintenance.md)。

## 配置位置与开关

配置仅存在原 Sites 项目的安全服务端环境中；下表只给名称，不给值。[api.ts](../../lib/news/api.ts) 的 `mailConfig`（第 23 行）读取这些绑定；[runtime.ts](../../lib/news/runtime.ts) 从 Worker env 读取，开发环境可回退到进程环境。`.env*`、`.dev.vars`、私人审计、邮件原始记录和数据库导出不进 Git。

| 配置 | 用途与维护边界 |
| --- | --- |
| `EMAIL_ENABLED`、`BREVO_DOMAIN_VERIFIED`、`EMAIL_ACCEPTANCE_PASSED` | 三者字符串均为 `true` 才允许公众投递；它们是人工维护的安全声明，不会自动向 Brevo 查询认证/验收 |
| `BREVO_API_KEY` | 调用 Brevo 事务邮件 API；只保留在服务端安全配置 |
| `BREVO_SENDER_EMAIL` | 已认证的发件身份；当前交接为 `news@ag-ui.ai`，不等于配置了该邮箱的收件服务 |
| `SUBSCRIPTION_SECRET` | 签确认/管理链接，并派生申请限流键；更换会使已有链接失效 |
| `BREVO_WEBHOOK_SECRET` | 独立回调 Bearer；必须与提供商 webhook 配置协调 |
| `EMAIL_TEST_RECIPIENT` | owner 明确授权的固定验收收件人；工具不可指定/替换地址 |
| `SITE_OWNER_EMAIL` | 管理身份绑定，见 owner 文档；不公开其值 |
| `ANALYTICS_SECRET` | 第一方访问估算的独立密钥；不要复用邮件密钥 |

`GET /api/subscription/status` 只返回 `enabled/confirmedCount/capacity/remaining/full/dailyLimit/weeklyLimit`。`enabled=true` 表示开关与必要配置非空；不证明 API key、域名或投递现在仍有效。`enabled=false` 或 503 时，先在安全配置界面核对名称、存在性和错误类别，不把密钥输出到终端/聊天，也不直接把开关改为 true。

## 申请、确认、偏好与退订

中英页面 `/zh/subscribe`、`/en/subscribe` 支持语言和主题 `model/product/protocol/framework/research/case-study`。申请要求 `consent=true`，进入 pending；确认链接 24 小时有效。`check-inbox` 是兼顾限流/隐私的通用响应，不能证明邮件发出、邮箱存在或订阅已生效。

持有签名链接的读者通过同源 `POST /api/subscription/manage` 执行 `confirm/preferences/unsubscribe/read`。打开 GET 页面或邮箱扫描不确认、不退订；读者主动点击动作才提交。确认原子取得名额，确认成功后改为管理链接；偏好只允许 confirmed 保存；退订取消仍为 queued 的邮件并释放名额。管理链接目前不设独立到期时间，其签名绑定 subscriber ID、创建时间与密钥；不能把真实链接放进日志、截图、工单或公开文档。

已确认重放保持幂等。pending 有效确认代际和到期时间不因重复申请跨日改变；已知到期代际允许开始下一周期并取消旧 queued，`sending/uncertain` 阻止自动轮换。测试 restart 改变创建 epoch 和代际，旧确认、偏好、退订请求不能覆盖新代际；前端 generation/abort 也防止旧请求覆盖现页面。维护时保留这些检查，不通过删除记录、换 run ID 或新建订阅来解除抑制。

## 容量、免费额度与看板

本站 [mail.ts](../../lib/news/mail.ts) 第 15 行起固定策略：正式 confirmed 容量 250；每日提交尝试上限 300；每次普通周报提交要求当天共用计数小于 250，为确认预留 50。确认、周报和测试都消耗同一个保守日计数；失败、不确定或 429 已计数的尝试不回退。250 是站点策略，不是 Brevo 联系人数上限，也不是独立的“每周 250 次”累计计数。

只有 `is_test=0 AND status='confirmed'` 占正式名额。pending、unsubscribed、suppressed 和测试身份不占；满额时新申请不收集邮箱，确认返回 HTTP 409 `capacity-full`，未过期 pending 链接可在名额释放后重试。既有偏好和退订仍可用。不要增加容量、购买额度或将测试身份转正式订阅来解决满额。

2026-10-13 核对 [Brevo 免费档官方说明](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan)：每日 300 封，未用额度不滚动，保留 Brevo 品牌标识。官方还说明达到提供商日限后事务邮件有有限 retry queue；这与本站 D1 的 queued 是两层队列，API 接受的邮件可能仍在提供商等待。本轮未登录账户核对实际套餐、剩余额度或账号限制；站内日界线是 Asia/Singapore，不能假定与提供商账户日界线一致。账号其他发信也可能占额度，本站计数不等于提供商余额。

`/admin` 及 owner `dashboard` 展示正式投递/订阅状态计数、本站当天 `used`、容量与运行状态；UI 显示 used/300。可由限额减 used 估算站内余量，不能称为 Brevo 余额。测试排除正式状态汇总，但计入日配额。不展示邮箱和逐条回执；精确对账需 owner 在安全环境查看提供商日志，不能导入公开仓库。

## 周报与投递状态

既有周一 09:00 新加坡时间任务用 `digest` 的 `week` 参数（已经到达的周一日期）建立 edition。按上一次 edition 的收录检查点选择已发布内容，按主题筛订阅者；无新内容返回 `empty`，不发空周报。`edition/subscriber` 稳定投递 ID 与 `INSERT OR IGNORE` 防止重复队列；重跑保持同一个周日期和运行 ID。正文为原创双语摘要与站内链接，不镜像源站全文。

普通 `drain` 每次最多处理 25 条正式队列，确认优先；每条先原子 claim，再取得额度，然后调用事务邮件 API。任务可能需要后续轮次继续 drain，额度耗尽保持 queued，不丢掉队列。只用现有任务，不新建重复 cron；定时采编不调用任何 `mail-test`。合同见 [automation.md](../../public/automation.md)。

| 状态 | 实际含义和下一步 |
| --- | --- |
| `queued` | 本站待提交；额度不足保留，429 重新排队并终止本轮，后续获授权 drain 可继续 |
| `sending` | 已 claim，提交进行中；不要并发强制重发。超过 10 分钟未完成，下一次对应队列处理转 `uncertain` |
| `submitted` | 提供商 API 已接受；通常保存 message ID，不代表送达收件服务器或进 inbox |
| `delivered` | 已认证 Delivered 回调关联成功；仍不等于用户看到邮件、未进入垃圾箱或完成确认 |
| `uncertain` | 超时、提交响应未知、HTTP 5xx 或中断后可能已发送；自动重跑、新 run ID 都不能当作重发许可 |
| `failed` | 非 429 的确定 HTTP 4xx，或回调失败状态；系统不会自动重试该记录 |
| `cancelled` | 未提交队列因退订、抑制、过期/旧代际取消；不能复活 |

`processed/submitted` 计数也是本轮处理结果，不是 inbox 验收。真实未知提交先由 owner 对照私有提供商日志、时间及 delivery/message ID，确认是否接受/送达。本实现没有逐条人工对账或重发 API；需要修复时先形成获授权的操作方案和证据，不直接改生产 status 或重置 quota。

## Webhook 与抑制

提供商事务回调目标 `https://ag-ui.ai/api/brevo/webhook`，认证方式 Bearer，与服务端 `BREVO_WEBHOOK_SECRET` 一致。官方 [安全 webhook 文档](https://developers.brevo.com/docs/secured-webhooks) 支持这一配置；回调事件名和 payload 以 [事务 webhook 文档](https://developers.brevo.com/docs/transactional-webhooks) 为准（2026-10-13 核对）。不把回调密钥写入 URL，不将 Brevo API key 复用为 webhook 认证。

现有代码归一化大小写/下划线及 `invalid_email`，处理 Delivered、hardBounce、softBounce、spam、invalid、blocked、unsubscribed（也识别 error）。hard bounce、spam、invalid 立即 suppressed；unsubscribed 设置退订；取消相应 queued。soft bounce、blocked、error 标失败但不自动将订阅者永久抑制。原始 mailbox 与 provider message ID 或 `X-Mailin-custom: delivery:…` 必须关联既有记录，不凭任意 Delivered 建新记录；失败状态不能被迟到 Delivered 覆盖。回调处理在 [mail.ts](../../lib/news/mail.ts) 的 `mailWebhook`（第 550 行）。

回调 401 先查安全认证配置是否匹配及近期轮换，不关闭验证；400 查事件格式；503 查 D1/运行故障。不要向正式 endpoint 投递人工“Delivered”去伪造验收。重复回调、回调早于 API 响应、错误拼写、错配记录等可用本地 fixture 测试；真实投诉/退信和带邮箱原始 payload 只留在安全运营记录。

## 安全验收与已知证据边界

日常代码维护运行 `npm run test:news`、`node --import tsx --test tests/subscription-ui.test.mjs`；它们用隔离内存数据库、合成 `.test` 地址和 mock 提供商，不发送邮件。HTTP 验证必须使用隔离本地 D1/Worker，三个邮件开关均 false、无真实 key，`SITE_TEST_BASE_URL` 只设 loopback；步骤见 [CI 工作流](../../.github/workflows/ci.yml)。不要把 production 配置复制到本地，也不要把 production 当 test target。

`mail-test` 只对 owner 明确授权的真人验收开放，严格 schema 拒绝调用者传入收件人。`status` 只读返回 readiness、publicEnabled、测试状态、偏好、activeTestRunId 及脱敏投递状态，未返回邮箱/密钥/签名链接。`confirmation/weekly` 会向服务端固定测试收件人发真实邮件；真实验收必须另获明确授权，本次文档更新不调用。

已授权验收使用稳定 8–80 字符小写字母/数字/连字符 runId，confirmation 后由真人确认，再执行同 runId 的 weekly；重跑不重发已提交/送达/失败/未知记录。测试身份、edition、delivery 均 `is_test=1`，普通周报/drain 和正式转化统计排除它们，但共用额度。改测试地址不能 flush 旧地址队列，正式订阅者不能改作测试。

`restart` 是不发信的状态操作，仅在公众邮件开关关闭、固定测试身份为 unsubscribed、runId 新且不存在 sending/uncertain 时允许；仅 key 缺失导致 `mailReady=false` 不等于允许 restart，它另检查 `mailConfig.enabled=false`。抑制/正式身份拒绝。它记录 marker、保留历史、使旧链接失效，并只允许最新 restart run 发送。生产公众邮件已经开放时不要为了再测试擅自关闭它；需要这类验收时由 owner 另行安排维护窗口和影响方案。禁止定时任务调用 restart 或直接改订阅库。

交接记录两轮真人验收、4 封测试邮件、用户退订、鉴权 Delivered 与退订后停发已通过；本轮没有重复，也没有真实 queued cancellation 或全部退信场景的证据。仓库 fixture 通过不能补成真实验收。需保持 [项目上下文](../PROJECT_CONTEXT.md) 中这些边界。

## 隐私、密钥轮换与故障处理

邮件记录含个人信息；管理员聚合不等于数据库匿名。签名管理链接本身具有访问权限，所有公开记录、PR、任务提示、截图和日志必须排除邮箱、密钥、会话与真实签名 URL。浏览统计和邮箱不关联；不利用 opens/clicks 作阅读证明或是否继续发信依据。交接接受并公开披露了 Brevo 匿名跟踪；匿名化不证明像素或改写链接已关闭。HTML/纯文本提供原网址文本可复制，但直接点击/自动识别仍可能经跟踪。全面关闭尚未验证，修改跟踪须同步中英订阅及隐私披露并重新验证，不能只删说明。

API key 轮换由 owner 在安全配置中操作：确认当前消费者及任务、配置新 key 并验证获授权的连接后再撤销旧 key；不要在仓库保存旧/new 值。webhook 当前只接受一个 secret，没有双 key 过渡；需协调服务端与 Brevo 回调配置、provider retry 及积压回调的处理，不能单边轮换。`SUBSCRIPTION_SECRET` 没有 key ring，直接换值使所有既有确认/管理链接失效，需先设计读者恢复和重新验收方案。`ANALYTICS_SECRET` 更换可改变当天访客估算，记录统计影响。身份与绑定迁移另见 owner 文档。

| 现象 | 安全排查方向 |
| --- | --- |
| `capacity-full` | 查看聚合名额；等待用户正常退订释放，不扩容/删记录 |
| 无确认邮件、`check-inbox` | 查 pending/queued 聚合、日额度、spam folder 与域名认证；通用提示不证明发送，不以反复申请绕限流 |
| submitted 长期无回调 | owner 查提供商日志、回调认证与配额/账户状态；不可默认重发 |
| uncertain 或长时间 sending | 停止对该记录重试，私下提供商对账；后续处理需具体授权 |
| 已退订仍有邮件 | 区分退订前已提交/提供商队列与本站 queued；检查事件时间及同代际，取消不撤回已提交邮件 |
| 配置/域名认证失效 | 保留现场并通知 owner；获授权后修复，不能用跳过认证/验收恢复发送 |

以上排查先读状态，不默认改变生产开关。真需要停发、换 DNS、转移账户或修改数据时由 owner 明确决定；完成后记录源码版本、时间、实际投递/回调/真人动作及残余限制，公共记录只存可公开结论。
