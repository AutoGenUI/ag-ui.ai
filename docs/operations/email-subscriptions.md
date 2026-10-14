# 邮件订阅与投递维护

核对日期：2026-10-14。最近正式语义化发布 [v1.0.1](../releases/v1.0.1.md) 已完成标签推送并部署为 Sites v17；名额/反馈布局及普通订阅身份释放属于已完成历史。本轮 [跟踪退出迭代](../iterations/2026-10-14-brevo-tracking-consent.md) 的账户核验与部署另行记录。生产源码、版本与验证范围以 [工程状态](../CURRENT_STATE.json) 为准，不移动历史标签。v12 交接已记录公众邮件、发信域名认证和真实验收完成，发件地址 `news@ag-ui.ai`；不能用早期“待启用”示例重复开关生产服务。

先读 [维护入口](README.md)、[owner 管理](owner-management.md)；域名认证记录见 [DNS 维护](dns-maintenance.md)，构建、绑定与发布见 [部署维护](deployment-maintenance.md)。

## 收件人级跟踪退出

共享发信入口对每个 `to` 收件人设置 `contactPixelTrackingConsent: false`，覆盖公众/测试确认和周报，不按语言例外，也不在参数被拒后去掉它重发。若以后增加 `cc`/`bcc`，每位收件人也必须携带 false。本站不使用打开/点击事件判断已读或控制后续发信，投递与抑制回调继续处理。

[Brevo 官方设置说明](https://help.brevo.com/api/v2/help_center/en-us/articles/37113920427922.json) 要求先启用账户功能：Settings → Contacts → Per-contact pixel tracking consent → Yes；Track contacts whose consent is unknown → No；保存后读回。只通过安全账户会话操作，不导出 contacts、会话、原始邮件或秘密。本轮账户登录跳转失败；所有者于 2026-10-14 确认已按上述步骤设置完成，代理未独立读回。记录用户确认与实际账户读回的区别，不能从部署成功推断账户状态。该策略无需新增站内跟踪同意勾选框。

真实 MIME 的像素/链接移除尚未验收；不把 API 参数、匿名统计或本地模板预览当作证明。若后续另获真实邮件验收授权，分别记录提供商提交、送达、收件、最终 HTML/链接检查，保留退订/投诉/硬退信停发机制；不能为了检查参数调用生产队列或重置额度。

## 配置位置与开关

配置仅存在原 Sites 项目的安全服务端环境中；下表只给名称，不给值。[api.ts](../../lib/news/api.ts) 的 `mailConfig`（第 23 行）读取这些绑定；[runtime.ts](../../lib/news/runtime.ts) 从 Worker env 读取，开发环境可回退到进程环境。`.env*`、`.dev.vars`、私人审计、邮件原始记录和数据库导出不进 Git。

| 配置 | 用途与维护边界 |
| --- | --- |
| `EMAIL_ENABLED`、`BREVO_DOMAIN_VERIFIED`、`EMAIL_ACCEPTANCE_PASSED` | 三者字符串均为 `true` 才允许公众投递；它们是人工维护的安全声明，不会自动向 Brevo 查询认证/验收 |
| `BREVO_API_KEY` | 调用 Brevo 事务邮件 API；只保留在服务端安全配置 |
| `BREVO_SENDER_EMAIL` | 已认证的发件身份；当前交接为 `news@ag-ui.ai`，不等于配置了该邮箱的收件服务 |
| `SUBSCRIPTION_SECRET` | 签确认/管理链接，并派生申请限流键；更换会使已有链接失效 |
| `BREVO_WEBHOOK_SECRET` | 独立回调 Bearer；必须与提供商 webhook 配置协调 |
| `EMAIL_TEST_RECIPIENT` | owner 明确授权的固定验收收件人；发信工具不可指定/替换地址，release 的 `expectedRecipient` 仅校验该固定目标 |
| `SITE_OWNER_EMAIL` | 管理身份绑定，见 owner 文档；不公开其值 |
| `ANALYTICS_SECRET` | 第一方访问估算的独立密钥；不要复用邮件密钥 |

`GET /api/subscription/status` 只返回 `enabled/confirmedCount/capacity/remaining/full/dailyLimit/weeklyLimit`。`enabled=true` 表示开关与必要配置非空；不证明 API key、域名或投递现在仍有效。`enabled=false` 或 503 时，先在安全配置界面核对名称、存在性和错误类别，不把密钥输出到终端/聊天，也不直接把开关改为 true。

## 申请、确认、偏好与退订

中英页面 `/zh/subscribe`、`/en/subscribe` 支持语言和主题 `model/product/protocol/framework/research/case-study`。申请要求 `consent=true`，进入 pending；确认链接 24 小时有效。`check-inbox` 是兼顾限流/隐私的通用响应，不能证明邮件发出、邮箱存在或订阅已生效。

持有签名链接的读者通过同源 `POST /api/subscription/manage` 执行 `confirm/preferences/unsubscribe/read`。确认页在状态就绪、`document.visibilityState="visible"` 且非 prerender 时自动 POST confirm，每个 mount 最多自动尝试一次；无需再点页面按钮。GET、HEAD、SSR 或仅 HTTP 预取不执行确认。隐藏页/预渲染页等待实际显示，失败保留原签名入口并提供“重试确认”，不因 focus、容量刷新或重新渲染不断重试。中英切换若重新 mount，可以再执行一次幂等 POST；后端不会因此多占名额。浏览器可见性不是身份验证，能运行 JS 并模拟可见页面的扫描仍可能触发确认，不保证拦住全部机器人。

确认原子取得名额，成功后才改为管理链接；偏好只允许 confirmed 保存。取消 pending 申请或退订 confirmed 订阅仍需读者主动 POST，不随 mount、focus、URL 的 `#unsubscribe` 或邮件扫描自动执行。退订取消仍为 queued 的邮件并释放名额，不能撤回已提交给提供商的邮件。管理链接目前不设独立到期时间，其签名绑定 subscriber ID、创建时间与密钥；不能把真实链接放进日志、截图、工单或公开文档。

当前订阅页面统一按“介绍 → 名额 → 状态/反馈 → 操作表单 → 管理/取消/退订 → 隐私说明”阅读：容量靠上，反馈始终位于它解释的表单及取消/退订操作上方。申请成功保留填写内容，以“查看邮件，确认订阅”提示下一步，移除返回填写按钮并避免重复申请；签名确认页成功后在结果下方继续偏好表单。管理链接支持 pending 主动取消及 confirmed 主动退订，独立区块避免误把退订当确认。签名不绑定原设备、IP 或登录会话，可在另一设备操作；以页面成功结果为准，不将打开邮件或 HTTP 200 当作已确认。v14 的“表单 → 反馈 → 管理 → 名额”是前一轮已发布布局，不是本轮验收目标。

返回原申请页时，focus/visibility 只重新读取公开容量，不代替某个订阅者的确认结果；签名确认页仅依上述首次可见规则尝试确认。中英切换在订阅页保留 `id/token/action`，其他路由不传播这些参数。取消、退订与偏好保存继续为主动操作，前端 generation/abort 防止旧页面响应覆盖新状态。

[Brevo 官方双重确认流程（机器可读文章）](https://help.brevo.com/api/v2/help_center/en-us/articles/208771869.json) 描述点击邮件链接后确认与重定向，没有要求再点网页按钮；v1.0.0 的额外按钮是当时本站选定的扫描防护。取消它是当前用户授权的体验变化，不改变先申请、再验证邮件链接的流程。[Brevo 官方机器人说明（机器可读文章）](https://help.brevo.com/api/v2/help_center/en-us/articles/4406537065618.json) 明确安全软件会自动点链接并模拟用户，故不能宣称自动 POST 是真人证明。这两个 JSON 为对应官方帮助文章的同 ID 入口；网页 403 不等于文档失效。

有效签名管理/确认响应新增 `subscriptionType: "public"|"test"`，仅向对应链接持有人解释身份，不改变公开聚合或暴露邮箱。public 确认占正式名额；test 确认明确显示“测试邮箱已确认”，不占名额、不进入正式周报。新客户端要求身份字段合法，遇到旧 API 缺少字段时保守显示未能确认结果，不把测试确认说成正式订阅。发布或回退后应刷新页面，使客户端与 Worker 来自匹配版本；错误提示不代表数据库操作一定没有执行，重试前按有效管理链接核对状态，不重复申请来绕过测试隔离。

已确认重放保持幂等。pending 有效确认代际和到期时间不因重复申请跨日改变；已知到期代际允许开始下一周期并取消旧 queued，`sending/uncertain` 阻止自动轮换。公众 `unsubscribed` 可通过新的有效 `consent=true` 申请开始下一周期：原子 winner 更新创建 epoch 和确认 expiry，两者单调推进，epoch 也严格晚于历史投递时间，避免同毫秒旧回调撤销新同意；保留历史并取消旧 queued。旧签名、旧 producer、预加载 claim 与旧管理请求不能跨入新 epoch；关联旧代际的 unsubscribe 回调不覆盖新同意，当前或无关联退订仍保守停发，hard bounce/投诉/invalid 跨代际保持抑制。

`suppressed`、测试身份、历史 hardbounce/spam/invalid、任意 `sending/uncertain` 不能因公众重新申请复活；测试 restart 继续走原 owner 授权条件，不能把测试身份自动确认为公众。新的 owner `release` 仅移除固定目标的测试角色，留下普通 `unsubscribed` 身份，仍要新的有效申请和邮箱确认；它不是公众接口，也不解除抑制或未知提交保护，具体边界见下文。公众重新订阅不是“重置记录”或解除抑制，也不是新建重复投递许可。保留原邮箱 2 次/固定 24 小时窗口、client 5 次/固定 1 小时窗口限流；这是原 `rateLimit` 策略，不是本次新增限制。维护时不通过删除记录、换 run ID、重置 quota 或购买额度来恢复。

确认与周报共用 [mail-template.ts](../../lib/news/mail-template.ts)：邮件客户端友好的 presentation table 和 inline CSS，蓝色确认主 CTA、淡灰管理区分开；周报呈现来源、日期、原创摘要与站内报道链接。HTML 动态文本和 URL 保持转义，原始 URL 文本、纯文本版本、24 小时时限、测试标识及 Brevo 跟踪披露保留。`#unsubscribe` 仅定位管理区，不自动退订。模板本身不新增跟踪资源，不代表 Brevo 已关闭像素或链接改写；本地 mock/模板检查不能代替真实邮箱渲染验收。

## 申请限流排障

申请频次超限单独返回 HTTP 429、`rate-limited`、`retryAt` 和 `Retry-After`，明确本次未发新邮件；用户在提示时间后主动重试。保留原 client 每小时 5 次、邮箱每日 2 次及全部计数。bucket 按 UTC 固定日/小时计算：邮箱在新加坡每天 08:00 更新，client 在整点更新；`expires_at` 是记录保留时钟，不是重试边界。历史测试身份的无效申请也计数；角色释放不会重置计数。

先看 owner dashboard；不能从聚合推断某个邮箱。需要固定目标精确排障时，owner 可调用 `mail-test` 的 `action: diagnose` 并传入用户授权的 `expectedRecipient`，必须精确匹配既有服务端配置，不改变发信目标。只返回角色/状态、当前邮箱申请窗口、最多五条公众确认状态和本站当天提交计数，不返回地址、ID、token、偏好或原始提供商错误。它不发信、不写库、不重置配额或抑制；禁止采编任务调用。公开文档不保存实际地址或逐人诊断。详见 [限流反馈迭代](../iterations/2026-10-13-subscription-throttle.md)。

## 容量、免费额度与看板

本站 [mail.ts](../../lib/news/mail.ts) 的固定策略：正式 confirmed 容量 250；每日提交尝试上限 300；每次普通周报提交要求当天共用计数小于 250，为确认预留 50。确认、周报和测试都消耗同一个保守日计数；失败、不确定或 429 已计数的尝试不回退。250 是站点策略，不是 Brevo 联系人数上限，也不是独立的“每周 250 次”累计计数。本次体验问题不能归因为已经证实的额度耗尽；没有为了本轮修改容量/配额、购买或重置生产额度。

只有 `is_test=0 AND status='confirmed'` 占正式名额。pending、unsubscribed、suppressed 和测试身份不占；满额时新申请不收集邮箱，确认返回 HTTP 409 `capacity-full`，未过期 pending 链接可在名额释放后重试。既有偏好和退订仍可用。不要增加容量、购买额度或将测试身份转正式订阅来解决满额。

2026-10-13 核对 [Brevo 免费档官方说明（帮助中心公开 JSON）](https://help.brevo.com/api/v2/help_center/en-us/articles/208580669.json) 与 [官方套餐页](https://www.brevo.com/pricing/)：每日 300 封，未用额度不滚动，保留 Brevo 品牌标识。该 JSON 是同一帮助文章的官方机器可读入口，含标题、正文与可读版地址；帮助中心网页在本轮 CI 返回 403，不能由此推断条款变化。官方还说明达到提供商日限后事务邮件有有限 retry queue；这与本站 D1 的 queued 是两层队列，API 接受的邮件可能仍在提供商等待。本轮未登录账户核对实际套餐、剩余额度或账号限制；站内日界线是 Asia/Singapore，不能假定与提供商账户日界线一致。账号其他发信也可能占额度，本站计数不等于提供商余额。

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

现有代码归一化大小写/下划线及 `invalid_email`，处理 Delivered、hardBounce、softBounce、spam、invalid、blocked、unsubscribed（也识别 error）。hard bounce、spam、invalid 立即 suppressed，不能被随后 signed/provider unsubscribe 降级；unsubscribed 设置退订，但已关联的旧代际回调不撤销新公众同意；无关联回调仍保守停发。取消相应 queued。soft bounce、blocked、error 标失败但不自动将订阅者永久抑制。原始 mailbox 与 provider message ID 或 `X-Mailin-custom: delivery:…` 必须关联既有记录，不凭任意 Delivered 建新记录；失败状态不能被迟到 Delivered 覆盖。回调处理见 [mail.ts](../../lib/news/mail.ts) 的 `mailWebhook`。

回调 401 先查安全认证配置是否匹配及近期轮换，不关闭验证；400 查事件格式；503 查 D1/运行故障。不要向正式 endpoint 投递人工“Delivered”去伪造验收。重复回调、回调早于 API 响应、错误拼写、错配记录等可用本地 fixture 测试；真实投诉/退信和带邮箱原始 payload 只留在安全运营记录。

## 安全验收与已知证据边界

日常代码维护运行 `npm run test:news`、`node --import tsx --test tests/subscription-ui.test.mjs`；它们用隔离内存数据库、合成 `.test` 地址和 mock 提供商，不发送邮件。HTTP 验证必须使用隔离本地 D1/Worker，三个邮件开关均 false、无真实 key，`SITE_TEST_BASE_URL` 只设 loopback；步骤见 [CI 工作流](../../.github/workflows/ci.yml)。不要把 production 配置复制到本地，也不要把 production 当 test target。

`mail-test` 只对 owner 明确授权的验收/角色维护开放；`status/restart/confirmation/weekly` 的严格 schema 拒绝调用者传入收件人。`status` 只读返回 readiness、publicEnabled、`recipientRole`（`test/public/null`）、测试状态、偏好、activeTestRunId 及脱敏投递状态，未返回邮箱/密钥/签名链接；固定目标已是 public 时，不返回原测试明细。`confirmation/weekly` 会向服务端固定测试收件人发真实邮件；真实验收必须另获明确授权，本次文档更新不调用。仅 `release` 接受 `expectedRecipient` 作为固定目标的匹配校验，不作为发送地址。

已授权验收使用稳定 8–80 字符小写字母/数字/连字符 runId，confirmation 后由真人确认，再执行同 runId 的 weekly；重跑不重发已提交/送达/失败/未知记录。测试身份、edition、delivery 均 `is_test=1`，普通周报/drain 和正式转化统计排除它们，但共用额度。改测试地址不能 flush 旧地址队列，正式订阅者不能改作测试。

`restart` 是不发信的状态操作，仅在公众邮件开关关闭、固定测试身份为 unsubscribed、runId 新且不存在 sending/uncertain 时允许；仅 key 缺失导致 `mailReady=false` 不等于允许 restart，它另检查 `mailConfig.enabled=false`。抑制/正式身份拒绝。它记录 marker、保留历史、使旧链接失效，并只允许最新 restart run 发送。生产公众邮件已经开放时不要为了再测试擅自关闭它；需要这类验收时由 owner 另行安排维护窗口和影响方案。禁止定时任务调用 restart 或直接改订阅库。

## 固定测试身份释放为普通读者

本轮用户另行授权：让历史固定测试收件人重新走正常读者申请/确认，而非把测试确认直接计为公众订阅。新增 owner 操作 `mail-test` 的严格参数仅为 `action="release"` 与 `expectedRecipient`。后者必须是有效邮箱，trim/lowercase 后精确等于服务端 `EMAIL_TEST_RECIPIENT`；不接受另一个目标、runId、偏好或发送参数。实际调用必须在获授权的安全运营通道中完成，不把真人地址、请求内容或签名 URL 放进公开文档和日志。

release 不发信，不调用 drain 或提供商，不要求关闭公众邮件，也不依赖投递 key 就绪；它不会改 `EMAIL_TEST_RECIPIENT`、生产开关或额度。它只处理已经存在的固定测试身份：保留 subscriber ID、偏好、原 `is_test=1` edition/delivery 历史，取消其旧 queued，把当前身份改为 `is_test=0/status=unsubscribed` 并清除 confirmed 时间。marker/winner 与旧 epoch CAS 在事务中绑定；新的创建 epoch 严格晚于当前时间、旧创建时间及全部历史投递，确认 expiry 也推进，因此原测试确认/管理链接失效。测试历史不改成公众投递，未提交历史队列不复活。

不存在的身份返回 `test-recipient-not-found`，不会创建订阅；已有 public 身份返回幂等 `already-public`，不改变偏好、确认、退订或抑制。suppressed 返回 `recipient-suppressed`；任何历史 hardbounce/spam/invalid 或 sending/uncertain 返回 `test-release-requires-reconciliation`。事务争用等未取得 winner 返回 `test-release-unavailable`，不得将它当作已释放。成功 `released` 只证明角色操作完成，不证明普通订阅已确认或邮件送达。

释放后由读者重新在正常表单给出 consent、收到新的确认邮件并完成确认，才取得公众名额并参与周报；正常限流、容量、日额度及安全抑制仍适用。旧 producer、测试 claim 以及后续 `confirmation/weekly/restart` 必须拒绝已是 public 的身份，不能继续对其发送测试邮件。关联旧代际的 unsubscribe 回调不能覆盖新同意；hard bounce/投诉/invalid 继续跨代际抑制，当前或无关联退订仍保守停发。

这项独立 owner 授权不扩大定时采编权限，也不允许匿名解除测试隔离、复活抑制地址、处理未知提交或清零 quota。本页记录时，候选代码与本地验证不代表真实固定目标已释放；生产操作及用户后续正常邮箱确认须单独记录证据，不保存地址。

## 真人验收历史与范围

交接记录两轮真人验收、4 封测试邮件、用户退订、鉴权 Delivered 与退订后停发已通过；本轮没有重复，也没有真实 queued cancellation 或全部退信场景的证据。仓库 fixture 通过不能补成真实验收。需保持 [项目上下文](../PROJECT_CONTEXT.md) 中这些边界。

2026-10-13 用户另行报告：用新邮箱完成公众确认后，页面已确认人数为 1。这是用户提供的生产行为证据，不是本次 agent 读取私有订阅库的结果，也不证明候选代码已部署或周报/全部回调已复验；不保存该邮箱、签名链接或邮件内容。

## 隐私、密钥轮换与故障处理

邮件记录含个人信息；管理员聚合不等于数据库匿名。签名管理链接本身具有访问权限，所有公开记录、PR、任务提示、截图和日志必须排除邮箱、密钥、会话与真实签名 URL。浏览统计和邮箱不关联；不利用 opens/clicks 作阅读证明或是否继续发信依据。交接曾接受并披露匿名跟踪；当前每位收件人发送明确退出参数，账户设置由所有者确认完成，未作独立账户读回。匿名化和退出请求均不证明最终像素或改写链接完全移除。HTML/纯文本提供原网址文本可复制，但直接点击/自动识别仍可能经跟踪。全面关闭尚未验证，修改跟踪须同步中英订阅及隐私披露并重新验证，不能只删说明。

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
