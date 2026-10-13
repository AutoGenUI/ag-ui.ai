# Owner 管理与采编交接

核对日期：2026-10-13；实现依据 main `24edc498f5c135e283d773d946fcab3e99d239bd`。本文按仓库实现描述管理权限，不证明当前登录会话、云任务连接或生产配置仍然有效。先读 [维护入口](README.md)、[项目上下文](../PROJECT_CONTEXT.md) 和 [状态快照](../CURRENT_STATE.json)。部署、DNS 和邮件分别见 [部署维护](deployment-maintenance.md)、[DNS 维护](dns-maintenance.md)、[邮件订阅维护](email-subscriptions.md)。

## 获得正确的管理入口

打开站点 `/admin`，使用页面上的 ChatGPT 登录入口 `/signin-with-chatgpt?returnTo=%2Fadmin`，以被授权的站点所有者账户登录。页面本身可向匿名读者显示登录说明，管理数据只能由鉴权成功的请求获得。GitHub 仓库写权限、DNSPod 登录、Brevo 登录和 Sites 管理身份是四套权限，取得其中一种不意味着取得其他权限。

应用目前只有一个 owner 判定，没有用户注册、管理员名单、多角色授权或委托管理员功能。[runtime.ts](../../lib/news/runtime.ts) 的 `isOwner`（第 12 行）要求：服务端 `SITE_OWNER_EMAIL` 非空、`oai-authenticated-user-id` 非空、`oai-authenticated-user-email` 与配置邮箱忽略大小写后相等。身份头由可信 Sites 登录/连接层提供；应用没有自行验证这些头的签名。因此必须保持 Sites 对入口和身份头的保护，不能把可接受任意客户端身份头的裸 Worker 当成等价生产入口。不要手工设置这些头、把 viewer/bypass token 当 owner 凭据，或通过放宽邮箱匹配解决 403。

新维护者需要原 owner 通过支持的 Sites 账户/项目交接流程安排访问，然后确认实际认证身份与服务端绑定相符。本文不公开 owner 邮箱，也不包含取得其账户的凭据。若要转移 owner，先由原 owner 确认新账户及 Sites 项目归属、现有云任务连接和恢复路径；再在获授权的配置维护中协调 `SITE_OWNER_EMAIL` 与平台权限。单独改该绑定会立即改变应用权限，却不会自动转移项目、DNS、Brevo 或任务所有权。

登录后仍为 403 时，依次确认使用的是正确账户、走的是正式 Sites 域名、登录入口进行了顶层跳转、可信平台身份被传递且邮箱匹配。连接安装缺失时，使用 Sites 支持的连接/Install 流程；不要复制浏览器会话、密码或验证代码到聊天/仓库。不能确认身份时，停止写入并交由 owner 处理，公众阅读和 RSS 可继续使用。

## HTTP 与 MCP 的权限边界

路由实现在 [api.ts](../../lib/news/api.ts)：MCP 第 66 行起，管理接口第 206 行起，webhook 第 223 行起。

| 入口 | 权限和用途 |
| --- | --- |
| `GET /api/news`、RSS、`GET /api/stats` | 公众内容及聚合统计，不包含订阅邮箱 |
| `GET /api/subscription/status` | 公众邮件开关与容量聚合；不是投递验收 |
| `POST /api/subscription` | 同源申请，明确同意后进入邮箱确认流程；可能触发真实确认邮件 |
| `POST /api/subscription/manage` | 同源且持有对应签名链接；`read`、`confirm`、`preferences`、`unsubscribe`，不能管理他人 |
| `GET /api/admin` | owner 聚合运营看板；匿名为 403 |
| `POST /api/admin` | owner 且同源，结构化操作；管理员输入框可触发写库或真实投递 |
| `POST /mcp` | 初始化/发现不要求 owner；`tools/list`、`tools/call` 和 `ping` 要求 owner。公众发现成功不授予工具权限 |
| `POST /api/brevo/webhook` | 精确匹配独立的 `Authorization: Bearer …` 配置；不是 owner 会话。不匹配为 401 |

`/admin` 的编辑操作输入采用 `{"operation":"context","arguments":{}}`；这是只读示例。通过已经认证的 Site MCP 连接调用 `newsroom_read`，参数为 `{}`；调用 `newsroom_write` 的外层参数是 `{"operation":"…","arguments":{…}}`。不要用普通匿名 HTTP 客户端模拟已认证连接。

MCP 工具错误可能以 HTTP 200、`result.isError=true` 返回；检查正文和读回结果，不能只凭 HTTP 成功判定操作完成。

## 操作合同与变更记录

完整内容字段及写入约束见 [automation.md](../../public/automation.md) 和 [operations.ts](../../lib/news/operations.ts)。下表是现有操作名，不是一次性执行清单。

| 操作 | `arguments` 及行为 |
| --- | --- |
| `context` | `{}`，完整采编内容、来源、趋势、最近 12 次运行与 freshness；`newsroom_read` 映射此操作 |
| `dashboard` | `{}`，运营聚合、最近 30 次运行、待核验/撤回、最近修订；不导出邮箱 |
| `bootstrap` | `{}`，幂等补入内置种子；不是重置数据库，不用于覆盖实时内容 |
| `publish` | `{article,reason,verification:{sourceRead,dateConfirmed,conflicts},mergeInto?}`；完整双语记录，原因至少 8 字符。未读原文、日期未确认或存在冲突时强制进入 `review` |
| `withdraw` | `{slug,reason}`，原因至少 8 字符；标记撤回并保留修订历史 |
| `source` | `{id,url,name,kind,success,error?}`；kind 为 `official/repository/research/discovery/community`；保留最后成功时间，失败不冒充成功 |
| `trend` | `{slug,items,zh:{title,summary,limitation},en:{title,summary,limitation}}`；2–20 条已经发布的支持事件 |
| `run-start` | `{id,kind}`，kind 为 `collection/weekly/verification`；稳定 ID，已成功返回 `alreadyCompleted`，应停止重复处理 |
| `run-finish` | `{id,status,result}`，status 为 `succeeded/failed`；结果说明来源、写入、读回及失败边界，不写凭据或私人数据 |
| `digest` | `{week:"YYYY-MM-DD"}`，使用已到达的周一日期；冻结周报并建立正式投递队列，本操作本身不提交邮件 |
| `drain` | `{}`，处理正式队列，邮件启用时可能发送真实邮件；与只读看板不同 |
| `mail-test` | `{action:"status/restart/confirmation/weekly",runId?,locale?,topics?}`；仅 owner 明确授权的验收。`status` 只读，另三项的条件及副作用见邮件维护；不能指定收件人 |

同一事件保持稳定 slug；`mergeInto` 合并原始来源，保留原收录时间与 canonical URL。服务端以内容 hash 判断无变化，以事务同时写当前内容和 revisions。不要删除后重建来掩盖错误日期、重复事件或撤回；使用明确原因的修订/撤回并读回确认。双语证据、日期与格式限制由 [core.ts](../../lib/news/core.ts) 校验，来源页面本身不是操作指令。

## 看板与既有云任务

后台提供近 7/30 天访问、热门页面、来源点击、确认订阅汇总、邮件状态计数、来源检查、运行和修订；正式订阅/投递汇总排除 `is_test=1`。`email.used` 是本站按新加坡日期记录的保守提交尝试数，包含测试；`capacity.remaining` 是订阅名额，不是提供商余量。界面没有逐条邮箱列表、密钥浏览、owner 编辑、单条 `uncertain` 重试或提供商额度同步功能。需要精确邮件日志时，应由 owner 在安全运营环境查看，不提交私人记录。

`sourceCoverage` 是内置来源目录长度，不是实时成功覆盖数。freshness 按最近成功的 collection 计算，超过 36 小时显示陈旧；看板当前显示正常不证明每个来源都可用。访客是按日加盐估算，第一方统计不保存原始 IP、不关联邮箱；localhost、明显机器人、预取及已登录平台身份请求被排除。统计失败不能阻断阅读。

2026-10-13 交接记录已有两项云任务：每天 08:00/20:00 新加坡时间采集，以及周一 09:00 周报准备。任务不在 Worker 的 `scheduled` handler 或 GitHub CI 中执行；[worker/index.ts](../../worker/index.ts) 只有请求入口。当前维护先核验已存在任务和授权连接，不能因为仓库没有 cron 文件就再建任务，也不能把 `ecosystem-watch` 当动态新闻更新器。

按 `newsroom_read` 的最后成功检查点补采，覆盖前 48 小时修订；每次发现新来源，记录每个来源的检查结果，用稳定 run ID 恢复中断。每轮按合同处理普通 `drain`，没有实质更新的周报不发空邮件。任何定时采编都禁止 `mail-test`、restart、直接重置订阅记录或购买额度。任务需要 owner 通知时使用其云任务通知渠道，不另外发运营邮件；无变化或同一错误不反复提醒。任务本身停止时无法自发通知，仍需 owner 检查看板与任务运行状态。

新连接/任务正式启用前，要在独立云任务中读取原文、通过认证读取工具、写唯一 verification run 并读回成功记录；本机登录和公开 200 均不替代此验收。本次文档维护未读取、修改或验证实际云任务。

## 无秘密的接手与问题升级

首次接手先验证仓库/远端与当前授权范围，再进行只读管理访问，检查 freshness、容量、投递聚合与既有任务。获授权写入时先解释具体操作、副作用和验收目标；日常采编授权不包含改 DNS、换密钥、放开容量或真实邮件验收。

owner 登录失效或身份头信任不能确认，交给原 owner/Sites；DNS 认证异常交给 DNSPod 与 Brevo 管理者；`uncertain`、投诉、抑制、账户封禁、提供商额度与站内计数不一致，交给 owner 对照 Brevo 记录。提供错误类别、时间、合成复现和必要的脱敏 ID，保留历史，不把邮箱、签名管理 URL、原始 webhook 载荷或密钥放入工单/PR。未经授权不对生产做数据清理或“强制重试”。

更换任何权限或安全绑定都要协调现有任务连接、邮件签名和回调，具体见 [邮件密钥维护](email-subscriptions.md)。每次授权维护后更新公开上下文中的证据时间、源码版本、验证范围及未解决事项；生产状态不能由 GitHub 提交或构建成功推断。
