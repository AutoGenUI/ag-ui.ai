# 2026-10-13 订阅交互与邮件排版发布

本文记录 [v1.0.0 正式发布](../releases/v1.0.0.md) 之后的订阅迭代，Sites 平台 v14 已部署成功；`v1.0.0` tag/回执保留为历史且不移动。最新工程证据与最终发布映射由 [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md) 和 [CURRENT_STATE.json](../CURRENT_STATE.json) 记录。本页不含私有邮箱、签名链接、订阅行或秘密值。

## 交互与自动确认

申请/管理页按“信息表单 → 反馈 → 管理/取消/退订 → 名额”组织。申请成功保留填写内容，显示“查看邮件，确认订阅”，移除返回填写按钮并避免重复申请；签名确认成功后在结果下方继续偏好编辑。pending 管理链接可主动取消申请，confirmed 可主动退订；独立管理区与确认主动作区分，`#unsubscribe` 仅定位区块。

签名确认页在状态就绪、document 可见且非 prerender 后，自动发同源 POST confirm，无需二次点击页面。每个 mount 最多自动尝试一次；可取消微任务和同步提交锁避免重复，容量/visibility 刷新不形成重试循环。中英切换若 remount，可再提交一次幂等确认；成功才替换管理 token，旧请求受 generation/abort 保护。失败保留签名入口与手动重试；过期、满额或抑制不能显示成功。

GET、HEAD、SSR 和仅 HTTP 预取不确认或退订；隐藏/预渲染页面等待实际显示。取消、退订、偏好保存仍为读者主动 POST。能执行 JS 并模拟可见文档的邮箱安全扫描仍可能误确认，不能把可见性宣传为真人识别或完整扫描防护。原先的额外页面按钮是本站选定的防护，与 Brevo 是否要求二次页面点击无关。

## 重新订阅与投递隔离

公众 unsubscribed 可在新的有效同意下开始一轮 pending/邮件确认。D1 原子 winner 推进创建 epoch 与确认 expiry；epoch 严格晚于当前时钟、旧创建时间和历史投递时间，覆盖同毫秒及时钟修正场景。保留历史，取消旧 queued；旧确认/管理链接、旧 producer、预加载 claim、旧管理事务与已关联的旧 unsubscribe 回调不能跨新 epoch。当前或无关联退订回调仍保守停发，hard bounce/spam/invalid 跨代际抑制。

suppressed、测试身份、历史硬失败和任意 sending/uncertain 不因公众申请复活；测试验收仍使用原 owner 授权流程。邮箱每固定 24 小时窗口 2 次、client 每固定 1 小时窗口 5 次、正式容量 250、共用日计数 300、周报提交阈值 250 均保留。未将体验问题认定为已证实的额度耗尽，没有购买、扩容、清零 quota 或修改生产开关。

## 邮件表达

[mail-template.ts](../../lib/news/mail-template.ts) 共用确认/周报 renderer，以 presentation table 和 inline CSS 适配邮件客户端。确认采用蓝色主 CTA，淡灰区单独管理或取消；周报呈现来源、日期、原创摘要和报道链接。保留 HTML 转义、原始 URL、纯文本、24 小时时限、测试标签与现有 Brevo 跟踪披露。模板不新增跟踪资源，不证明提供商像素/链接改写已关闭。本地模板 fixture 不等于真实 Gmail、QQ 或其他邮箱渲染验收。

## 当前验证范围

| 检查 | 本页记录时状态 |
| --- | --- |
| 本轮完整本地测试 | 基础 35 + 新闻/邮件/模板 55 + 订阅 UI 11 + 隔离 HTTP 8，共 109 项全部通过；合成身份、隔离数据库、mock 提供商，无真实投递 |
| TypeScript、构建及体积检查 | 已通过 |
| Lint | 0 错误，2 条既有警告 |
| 依赖安全审计 | 0 high、0 critical、8 moderate；原 high 安全门槛通过，未降级或隐藏剩余问题 |
| 构建体积 / 原预算 | JS 919576 / 920000，JS gzip 267411 / 275000，CSS 116185 / 125000，CSS gzip 23035 / 24000 字节；预算未调整，JS 原始余量 424 字节 |
| 隔离本地浏览器：确认与退订 | 合成邮件按钮仅点击一次，页面自动执行 1 次 POST confirm，公众人数 `0→1`；打开显式管理 GET 不退订，主动点退订按钮后人数 `1→0`；测试确认不占公开名额 |
| 申请页面布局 | UI-only mock signup 保留上方表单、下方反馈，返回按钮数量为 0；这项 mock 不证明邮件已发送 |
| 合成 HTML 邮件预览 | 桌面和 390px 视口无横向溢出；只验证本地合成预览，不是真实邮箱投递/渲染 |
| 隔离本地浏览器：过期确认 | 合成过期链接落地自动提交后显示“未能核验操作结果”与“重试确认”，不误报成功；公众 `0/250` 不变 |
| 隔离本地浏览器：pending 取消 | 管理 URL 的 `#unsubscribe` 仅显示尚未确认及下方取消申请；明确点击后显示已退订，公众 `0/250` 不变 |
| 本地控制台与视觉复核 | 测试确认、周报管理和过期页控制台错误均为 0；390px 确认邮件层次清晰、无横向溢出；桌面申请反馈截图中表单在反馈上方、无返回按钮 |
| required CI、PR 合并与 Sites 发布 | PR #7 与合并后 main verify 全通过；Sites v14 部署成功，源码树一致。完整 ID、SHA 与检查链接见 PROJECT_CONTEXT/CURRENT_STATE |

上述本地验收证据，不证明真实确认邮件、周报、退信/投诉回调或 inbox 展示。本轮没有读取秘密或生产订阅行、发送新增真实邮件、变更 schema、DNS、生产邮件开关或定时任务，也没有新增付费调用。网络、提供商跟踪与真实投递的未核验范围继续保留，不凭页面 200 扩大结论。

## 来源与维护入口

[Brevo 双重确认官方文章 JSON](https://help.brevo.com/api/v2/help_center/en-us/articles/208771869.json) 描述邮件链接确认与可选重定向；没有要求额外网页按钮。[Brevo 邮件机器人官方文章 JSON](https://help.brevo.com/api/v2/help_center/en-us/articles/4406537065618.json) 说明安全软件会点链接并模拟用户，存在意外动作风险。它们是同 ID 官方帮助正文的机器入口，避免把 HTML 帮助页面 403 当成文章不存在；本轮公开读取两个 JSON 均 HTTP 200。

接手参见 [邮件维护](../operations/email-subscriptions.md)、[owner 管理](../operations/owner-management.md)、[部署维护](../operations/deployment-maintenance.md) 和 [采编合同](../../public/automation.md)。采编任务不得访问真实签名链接来代替读者确认、退订或发起 `mail-test`，不得重置生产订阅/投递记录。

生产只读 HTTP 的中英订阅页、三项 RSS 与状态接口通过，匿名管理 403，公开人数 1、余位 249。代理浏览器对两个生产域名阻止导航，没有生产 DOM 验收结论。Sites env revision 12、public、active、MCP 和原 2 项任务保留；来源历史 v1.0.0 标签未移动。后续公开回执是文档提交，不再次部署。
