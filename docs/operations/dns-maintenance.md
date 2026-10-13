# DNS 与域名维护

接手入口见 [运维目录](README.md)。邮件处理见 [邮件订阅](email-subscriptions.md)，安全登录与权限交接见 [owner 管理](owner-management.md)，Sites 发布、数据库迁移与版本回滚见 [部署维护](deployment-maintenance.md)。本文件是公开维护说明，不包含登录凭据、DNS 验证码、私有账户信息或真实收件人。

## 维护边界与证据时点

本站继续使用已有 Sites 项目、`ag-ui.ai` 和 `www.ag-ui.ai`。DNS 解析由 [DNSPod](https://www.dnspod.cn/) 管理；网站流量经过 Sites / Cloudflare，发信服务为 Brevo，发件地址为 `news@ag-ui.ai`。这四项服务职责不同：DNSPod 能修改解析，Sites 能绑定域名和部署，Brevo 能验证发信域名，但它们不自动授予彼此的管理权限。

2026-10-13 05:26 UTC 的交接记录 v12 已上线、公众邮件已开放、域名认证和真实邮件验收通过。本次维护文档补充只重新检查公共 DNS、HTTP 响应头和 TLS，没有登录 DNSPod、域名注册商、Brevo 或 Sites，没有修改 DNS、邮件开关或生产配置。这些交接事实不能代替当次登录后的账户状态核验。

下表来自 **2026-10-13 09:25–09:26 UTC（新加坡时间 17:25–17:26）** 的公共只读检查。两台已知权威服务器分别查询；`structure.dnspod.net` 第一次 NS 查询超时，重试成功，其他列出的结果一致。记录是观察值，不是新建或恢复 DNS 的输入模板。

| 名称 / 类型 | 当次公开观察 | 维护含义 |
| --- | --- | --- |
| `ag-ui.ai` / NS | `structure.dnspod.net`、`charcoal.dnspod.net` | 两台权威服务器仍属于 DNSPod；本轮未核验注册商账户或续费状态 |
| `ag-ui.ai` / A | `162.159.143.30`、`172.66.3.26`，TTL 600 秒 | 现有 Sites 路由；后续以同一 Sites 项目的最新域名要求为准 |
| `www.ag-ui.ai` / CNAME | `custom-domains.chatgpt.site.`，TTL 600 秒 | 现有 Sites 路由，不把它改成 DNSPod URL 转发 |
| `ag-ui.ai` / AAAA、MX、CAA | 权威响应 `NOERROR`，无该类型答案 | 无答案不等于查询失败；不自行补 IPv6、收件或证书限制记录 |
| `_openai-site-verification`、`_openai-site-verification.www` / TXT | 每个名称均有一条答案，TTL 600 秒；值省略 | Sites 所有权验证记录，保留；确切值从现有 Sites 项目安全获取 |
| `_cf-custom-hostname`、`_cf-custom-hostname.www` / TXT | 每个名称均有一条答案，TTL 600 秒；值省略 | 托管边缘域名验证记录，保留；不要复用历史验证码 |
| `ag-ui.ai` / TXT | 有一条 Brevo 所有权验证记录，TTL 600 秒；值省略；未观察到 `v=spf1` 记录 | 只证明公开记录存在；不证明当前 Brevo 账户仍判为认证成功 |
| `_dmarc.ag-ui.ai` / TXT | 一条 DMARC 记录，`p=none`，TTL 600 秒；报告地址和值省略 | 当前为监测策略；本轮不提升到 `quarantine` / `reject` |
| DKIM selector / TXT 或 CNAME | 本轮未取得账户内当前 selector，未核验 | 不能靠猜测 selector、查几个常见名字或上述交接状态，宣称 DKIM 当前已验证 |

TLS 当次检查可完成证书链协商；HTTPS 请求未报告证书错误。`ag-ui.ai` 证书有效期为 2026-09-17 至 2026-12-16，`www.ag-ui.ai` 也是同一日期范围，签发方为 Google Trust Services WE1。证书由托管平台负责签发和续期；这些日期不是下一次续期已经完成的保证。

当前出口对 `http://ag-ui.ai/en` 返回 302 到 HTTPS，对 `https://ag-ui.ai/en` 和 `https://www.ag-ui.ai/zh?dns-check=1` 返回 Cloudflare 403。因此本轮**没有重新证明公众页面可读、`www` 的生产 308 跳转或路径与查询参数保留**。源代码 [worker/index.ts](../../worker/index.ts) 仍有 `www` → apex 的 308 逻辑；旧上线记录曾通过独立出口验证，这不能替代当次生产验收。中国大陆及其他特定出口的访问不保证。

## 接手时获取完整现状

1. 先由所有者通过安全登录或服务支持的授权方式进入 DNSPod。需要真人识别、密码或二次验证时由所有者在服务登录页面完成，不在聊天、PR、日志或仓库提供这些值。现有 owner 身份、权限和秘密的管理方式见 [owner 管理](owner-management.md)。
2. 进入 `ag-ui.ai` 的记录管理，核对域名、当前权威服务器、线路、启用状态、TTL 和操作日志。公开 `dig` 查询不能枚举完整 zone，也看不到禁用记录或所有线路策略。
3. 在 DNSPod 的 DNS 解析 → 批量管理 → 导出记录中，选择 `ag-ui.ai` 并导出 TXT、XLS 或 ZONE 格式。完整导出只存放在所有者控制的私有交接位置；公开仓库保存日期、类型、用途和变更摘要，省略验证码、账户标识和私人内容。界面名称可能变化，应依据 [DNSPod 官方导出说明](https://docs.dnspod.cn/dns/record-bulk-export/) 和 [导出格式说明](https://docs.dnspod.cn/dns/parsing-record-file/) 核对。
4. 在同一 Sites 项目读取 apex 和 `www` 的域名状态、TLS 状态、当前要求的解析和验证值；不要新建项目绕过旧项目。域名管理入口和工具可随 Sites 版本变化，见 [部署维护](deployment-maintenance.md)，以当前实际工具 / 管理界面为准。
5. 在 Brevo 的 Settings → Senders, Domains, IPs → Domains 检查已有 `ag-ui.ai`。读取当次显示的认证状态、DKIM 名称、类型和目标，而不是重新添加同名域名。官方可能提供一条 TXT 或两条 CNAME DKIM 记录；每个账户、域名和密钥代际都必须按实际显示值核对。[Brevo 域名认证说明](https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC)
6. 使用两台当前权威服务器和至少一个递归解析器核对该清单。只有账户清单与公开查询都核验后，才将新的“已验证”日期写入公开工程记录；不要把未获取 DKIM selector 等缺口写成通过。

若需 API 自动化，只使用所有者已有的安全凭据来源和最小权限。DNSPod 当前建议 API 3.0 / CAM 权限管理，旧 `Record.List` 文档仅对应传统主账号 Token；不能把两套认证参数混用，也不要在命令行参数中嵌入密钥。[DNSPod API 文档](https://docs.dnspod.cn/api/)、[传统记录列表与认证范围](https://docs.dnspod.cn/api/record-list/)。本仓库没有内置 DNS 写入自动化，站点 `/mcp` 也不是 DNSPod 管理接口。

## 网站解析与邮件认证共存

维护网站时保留发信认证，维护邮件时保留 Sites 路由和验证。`@` 的 A 记录可以与不同用途的 TXT 共存；`www` 的 CNAME 不应再叠加同名 A、URL 转发或 MX。DNSPod 对冲突和缓存含义的说明见 [解析设置相关](https://docs.dnspod.cn/dns/dns-resolve-set/)。不要为“简化”记录将 apex 改为 CNAME，或清空整区后仅恢复网站记录。

发件地址 `news@ag-ui.ai` 不表示已经开通这个地址的收件箱。当前 apex 无 MX 记录，本轮未验证收件服务；新增 MX 必须先有实际邮箱服务和单独的变更授权。Brevo 的普通域名认证要求以账户实际给出的所有权、DKIM 和 DMARC 记录为准，官方并不要求为普通认证自行新增 SPF 或 MX；专用 IP 等其他配置可能不同。[Brevo 域名认证说明](https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC)

不能凭记忆添加 `include:`、复制其他站点的 DKIM 值或使用历史 Brevo 验证码。若未来确实需要 SPF，在同一名称只维护一条有效的 `v=spf1` 策略，先列出所有实际发信服务，再按其官方要求合并，避免破坏其他服务。DMARC 同一名称只维护一条有效记录；提高策略前须确认合法邮件的 DKIM / SPF 对齐、报告和投递验收，不能因为本站一次发信成功就覆盖现有策略。Brevo 自动认证可能提出替换已有 DMARC；已有生产域名维护优先逐项核对，未获本次修改授权不要接受替换。[Brevo 认证及已有 DMARC 的处理说明](https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC)

DKIM 密钥轮换须按照 Brevo 给出的代际和操作流程，保留可能仍在验证的旧 selector，核对新 selector 的权威响应及 Brevo 认证结果后再安排退役。不要同时删除全部 selector；不要将 DKIM 私钥、服务端密钥或认证共享链接复制到公开说明。

## 变更、验证与回滚

DNS、注册商委派、域名迁移或邮件认证变更属于生产操作。本轮用户授权的是补充文档并提交 GitHub，不包含执行这些变更。未来获授权后遵循以下顺序：

1. 写明需要修复的事实、准确记录名称 / 类型、预期影响、最新账户来源、回滚条件和执行窗口；先核对域名续费、注册商控制权、当前 NS、Sites 项目 / 域名绑定与邮件认证。仅有 GitHub 写权限不足以操作 DNS。
2. 保存变更前完整记录及操作日志的私有快照，记录原 TTL、线路和启用状态。无需新买 DNSPod 快照套餐；采用已有导出能力即可。
3. 若要调整 TTL，使用现有套餐支持的值并提前等待旧 TTL 过期。现在观测 600 秒，不表示全网所有旧缓存已同步或 NS 变更也只需 600 秒。TTL 是递归缓存有效期，详见 [DNSPod TTL 说明](https://docs.dnspod.cn/dns/dns-resolve-set/)。
4. 每次只变更确认需要的记录，逐项记录前后差异；同名验证记录以现有项目 / 账户最新值为准。不要批量覆盖整区，不改变 DNSPod NS 委派来处理单个网站 403，不用新增 AAAA 来猜测修复 IPv6。
5. 查询两台权威服务器，区分 `NOERROR` 无答案、`NXDOMAIN`、`SERVFAIL` 和超时；再查递归解析器并比较。验证 apex 和 `www` 的 TLS、HTTP→HTTPS、`www`→apex、路径与查询参数、双语入口和静态资源。邮件变更要检查 Brevo 认证状态；真实投递验收须另有用户授权，并依 [邮件维护说明](email-subscriptions.md) 执行。
6. 达到预设失败条件时，仅恢复本次修改的记录及状态，保留未涉及的网站、邮件与所有权记录；重新核对权威 / 递归结果、TLS 和原服务行为。恢复 DNS 后也要考虑旧缓存，不把“控制台已恢复”等同于所有客户端立即恢复。
7. 在公开工程上下文记录证据时点、变更范围、检查结果和剩余限制。私有原始导出与验证值不随文档提交。

[2026-07-20 初次上线记录](2026-07-20-public-launch.md) 是历史取证，曾以空区为起点。其“删除上线时七条记录、恢复私有站点”的回滚只适用当时初次发布，**不可作为当前 v12 常规回滚操作**。公众邮件和后续数据已存在时，应按本次变更的完整快照恢复；不要从该历史清单覆盖现有区、删除合法记录或复制旧验证码。代码发布失败优先按 [部署维护](deployment-maintenance.md) 恢复已有版本，不通过删除域名制造第二个故障。

## 只读命令与 403 排障

下面命令只查询公开 DNS 与响应头，不登录账户、不发邮件。TXT 输出统一省略值，避免公共日志重新收录所有权验证码。使用终端现有的 `dig`、`curl`、`openssl`；若机器没有工具，先用 DNSPod 控制台的检测能力，不因排障新购服务。

```sh
# 当前递归视角的权威服务器，以及两台权威服务器的已知路由。
dig ag-ui.ai NS +time=2 +tries=1 +noall +comments +answer
for dns_server in structure.dnspod.net charcoal.dnspod.net; do
  dig @"$dns_server" ag-ui.ai A +time=2 +tries=1 +noall +comments +answer
  dig @"$dns_server" ag-ui.ai AAAA +time=2 +tries=1 +noall +comments +answer
  dig @"$dns_server" www.ag-ui.ai CNAME +time=2 +tries=1 +noall +comments +answer
  dig @"$dns_server" ag-ui.ai MX +time=2 +tries=1 +noall +comments +answer
done

# 已知 TXT 名称存在性，不打印验证码、报告地址或 TXT 数据。
for dns_name in ag-ui.ai _dmarc.ag-ui.ai \
  _openai-site-verification.ag-ui.ai _openai-site-verification.www.ag-ui.ai \
  _cf-custom-hostname.ag-ui.ai _cf-custom-hostname.www.ag-ui.ai; do
  dig @charcoal.dnspod.net "$dns_name" TXT +time=2 +tries=1 +noall +comments +answer |
    awk '/^;/ {print; next} NF >= 5 {print $1, $2, $3, $4, "[value withheld]"}'
done

# 递归结果与权威结果比较；若当前网络不能直达此解析器，记录超时。
dig @1.1.1.1 ag-ui.ai A +time=2 +tries=1 +noall +comments +answer
dig @1.1.1.1 www.ag-ui.ai CNAME +time=2 +tries=1 +noall +comments +answer

# HEAD 不执行页面 JS。--noproxy 只作用本次命令，不修改全机代理。
curl --noproxy '*' --head --max-time 12 --user-agent 'AG-UI-maintenance-check/1.0 (read-only HEAD)' http://ag-ui.ai/en
curl --noproxy '*' --head --max-time 12 --user-agent 'AG-UI-maintenance-check/1.0 (read-only HEAD)' https://ag-ui.ai/en
curl --noproxy '*' --head --max-time 12 --user-agent 'AG-UI-maintenance-check/1.0 (read-only HEAD)' 'https://www.ag-ui.ai/zh?dns-check=1'

# 查看公开证书日期与签发方；curl 同时检查 HTTPS 主机名与信任链。
openssl s_client -connect ag-ui.ai:443 -servername ag-ui.ai </dev/null 2>/dev/null |
  openssl x509 -noout -dates -subject -issuer
openssl s_client -connect www.ag-ui.ai:443 -servername www.ag-ui.ai </dev/null 2>/dev/null |
  openssl x509 -noout -dates -subject -issuer
```

DKIM 检查前，把安全账户界面给出的**完整 hostname** 和**真实记录类型**填入受控终端；按上面的 TXT 隐去值模式，或查询相应 CNAME。不要在运行中保留未替换的占位符，不做 zone 全量猜测，也不公开账户内生成的完整认证表。

Cloudflare 的 `Sorry, you have been blocked` / 403 是已经进入 HTTP 层的证据；它与 DNS 无答案、连接失败或证书错误不同。首先分别记录解析、TLS、HTTP 状态、网络 / 代理出口和证据时间；再用所有者可用的另一条网络进行同样检查。旧项目排查曾发现某个香港代理出口被拦、另一个出口可读，这不证明今天同一国家或所有网络的行为。DNS 和 TLS 正常而仅某个出口 403 时，不重复添加记录、变更 NS 或重部署以“修复 DNS”。若多个独立网络均异常，再结合同一 Sites 项目的域名状态、发布状态和运行错误判断托管故障。最终验收需要浏览器实际阅读与重定向检查；HEAD、HTTP 200 或单一出口成功都不能覆盖全球访问能力。
