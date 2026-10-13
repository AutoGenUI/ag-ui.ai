# 2026-10-13 名额、反馈布局与正常订阅

本文记录 [订阅打磨 v14](2026-10-13-subscription-polish.md) 之后的新一轮用户授权：容量靠上，统一反馈放在表单及取消/退订动作上方；历史固定测试身份可由 owner 安全释放，再由读者自己走正常订阅确认。Sites v15 已部署，owner 无发信操作已释放指定历史测试角色并读回确认；正常读者的新邮件使用仍由用户验收，v1.0.1 等待用户确认。当前 GitHub/Sites 映射以 [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md) 和 [CURRENT_STATE.json](../CURRENT_STATE.json) 为准，不记录真人邮箱或签名。

## 统一阅读顺序

中英申请、确认和管理页统一为“介绍 → 名额 → 状态/反馈 → 操作表单 → 取消/退订 → 隐私说明”。容量与剩余名额靠上，成功、失败、pending、确认等反馈在操作表单和取消/退订区之前，避免不同签名状态出现相反顺序。保留填写内容、“查看邮件，确认订阅”提示、明确偏好保存/取消/退订按钮以及既有隐私披露。v14 的“表单 → 反馈 → 管理 → 名额”只作为上一轮已发布历史。

布局调整保留可见、非预渲染、就绪的签名确认页自动同源 POST，每个 mount 自动尝试最多一次；语言 remount 可以幂等重试。GET、HEAD、SSR 和仅 HTTP 预取无确认/退订副作用。取消、退订及保存偏好仍需明确 POST；JS 扫描器可以模拟可见页面，不能宣称识别了真人。继续保留 generation/abort、容量、测试隔离、签名语言切换与不泄露到其他路由的边界。

## 从测试角色回到正常读者流程

新增 owner `mail-test` 的 state-only `release`，严格参数为 `action="release"`、`expectedRecipient`，不允许 runId、偏好或发信参数。expectedRecipient 规范化后必须精确匹配服务器固定 `EMAIL_TEST_RECIPIENT`，只作误操作校验，不选择或修改目标；公共仓库与本页不记录该邮箱值。

release 不调用提供商/drain、不发送邮件、不关闭或开启公众邮件、不清零额度。现有测试身份转为普通 `unsubscribed`，清除 confirmed 时间；保留 ID、偏好、原测试 edition/delivery 历史，取消旧 queued，轮换创建 epoch 与确认 expiry。事务 marker、winner 和旧 epoch CAS 保证并发只能取得一个结果；epoch 严格晚于当前时间、旧 subscriber 和全部历史 delivery，旧签名不能继续操作。原测试历史保持 `is_test=1`，不混入公众投递或正式名额。

不存在目标不新建；已是 public 时幂等，不把现有读者变回 test。suppressed、历史 hardbounce/spam/invalid、任何 sending/uncertain 均阻止测试释放，不通过 release 绕过抑制或未知提交。测试 producer/claim 和后续测试发送/restart 继续要求 test 角色，已释放身份不能再发测试邮件；关联旧 unsubscribe 回调不能撤销新同意，hard failure/投诉跨代际仍抑制，当前/无关联退订仍保守停发。

成功释放仅为角色解除：读者仍需正常表单的有效 consent、新确认邮件和邮箱确认，才计入公众 confirmed 或周报。不自动复用旧测试确认，不直接加入周报，不把 state-only 成功、API 接受或页面 HTTP 200 写成收件箱验收。公众匿名接口不能自行解除测试隔离；定时采编不得调用任何 `mail-test`。

邮箱每固定 24 小时窗口 2 次、client 每固定 1 小时窗口 5 次、正式容量 250、共用日提交上限 300、周报提交阈值 250 均保留。不把本次体验问题归为已证实的额度耗尽，不购买、扩容或重置生产额度。release 不要求 API key/domain ready 或 public disabled，也不能把它的成功当作投递配置已验证。

## 有效确认周期的偏好并发修复

复核发现既有 pending 行的确认 token 仍有效、但缺少投递历史时，并发补发请求可能保留旧 expiry，却用抢先请求覆盖原 locale/topics。以英文/研究请求先于中文/产品请求的确定顺序复现后，改为有效周期同时保留原语言、主题和 expiry；仅 expiry 已过期或为 NULL 的新 winner 更新这些字段。新建 subscriber 仍使用最初插入 winner 的偏好，不改变已确认订阅的主动偏好保存。

新闻/邮件/模板套件最初一次截断输出为 60/61，具体失败来源未定位；不能将这次输出归因为已经证实的偏好竞态。上述偏好问题由另行强制英文请求先赢的用例确定复现并修复，修复后完整 61 项连续 20 轮通过。记录稳定性证据不等于解释了首次截断失败的精确原因。

## 验证与发布边界

| 项目 | 本页当前记录状态 |
| --- | --- |
| 布局与角色释放代码 | 已部署；独立只读复核未发现具体阻塞，实际 owner 角色释放已读回确认 |
| 隔离本地测试 | 基础 35、新闻/邮件 57 + 模板 4 = 61、订阅 UI 11、HTTP 8，共 115 项通过；新闻/邮件/模板修复后连续 20 轮完整通过；合成身份、隔离数据库和 mock 提供商，无真实投递 |
| release 回归 | 新增 6 组：状态操作不发信/历史和额度保留、精确固定目标、抑制与未知提交及事务重查、并发 winner/幂等、预加载 producer/claim/签名管理、事务内历史时钟与跨代际回调；匿名 admin/MCP release 在调用数据库前拒绝，隔离 HTTP 覆盖匿名 403 |
| TypeScript、lint 与依赖审计 | TypeScript 通过；lint 0 错误、2 条既有警告；audit 8 moderate、0 high、0 critical，原门槛保留 |
| 最终构建与体积 | 最终源码重建与预算检查通过：JS 919522 / 920000、JS gzip 267400 / 275000、CSS 116185 / 125000、CSS gzip 23035 / 24000 字节；原预算不变，JS 原始余量 478 字节 |
| 本地桌面浏览器 | 中英签名管理切换保留参数；合成公众确认自动 POST，人数 `0→1`；1440px 下容量在反馈上方、反馈在偏好表单上方的实际矩形顺序通过 |
| 本地手机浏览器 | 英文 390px 保存偏好后，容量在反馈上方且反馈在表单上方；表单实际宽度 331px。该检查不是另一台物理设备或生产浏览器证据 |
| 申请 UI-only mock | CDP 只 mock status/signup，表单保留、反馈在表单上方、容量在反馈上方，返回按钮数量 0；未真实收集地址或发送邮件 |
| 退订与 pending 取消 | 合成英文订阅主动退订后公众人数为 0、表单数量 0，容量仍在反馈之前；合成中文 pending 管理 GET 的状态在取消按钮上方，GET 不取消，明确点击后进入退订终态 |
| 浏览器范围与控制台 | 桌面 1440px、手机 390px；本轮上述本地浏览器控制台错误为 0。合成身份和 UI-only mock 不等于真实邮箱/生产 DOM 验收 |
| required GitHub verify、PR 合并 | PR #9 正常合入 main，PR 与 main required verify 均通过 |
| 本轮 Sites 部署、源码树与配置保留 | Sites v15 succeeded，源码树匹配；env revision12、public、MCP和2项任务保留 |
| 真实固定目标释放 | owner release 返回 released/public，另一次 owner status 确认 public；无发信或自动订阅 |
| 读者正常申请/确认或新真实投递 | 未记录本轮真实验收；须区分用户报告、provider 提交、回调与实际收件 |

隔离 HTTP 首轮在新启动的本地 dev ProxyWorker 请求 `/mcp` 时出现一次 `Network connection lost`/500，失败日志已保留。后续直接请求返回预期匿名 403，ready 后完整 8 项通过；这是本地开发代理瞬断观察，没有为此修改源码，也不能用后续通过抹去首次失败或推断生产故障。

schema、DNS、生产邮件开关、秘密、定时任务和免费预算应保持原配置；本页的文档工作未触碰它们。Sites 延续既有项目、域名、D1 与 owner 鉴权，正式操作另记录结果而非模拟 owner 请求头。生产测试需遵守已授权范围，不访问真人签名链接、不公开邮箱或订阅行。

本轮先供用户验收，不创建 `v1.0.1` tag 或 GitHub Release；用户确认后才能另行标记版本。不可变 `v1.0.0` 与 v14 公开回执保留为历史，不移动旧标签。受保护 main 通过临时 PR 分支正常合并；完成核对后恢复长期仅 main 的策略。

Brevo 既有跟踪披露、提交/送达/收件区别和部分网络 Cloudflare 拦截继续保留；本地 mock、邮件合成预览或 HTTP 200 不扩大为真实投递/全网络可达证据。维护入口为 [邮件维护](../operations/email-subscriptions.md)、[owner 管理](../operations/owner-management.md)、[部署维护](../operations/deployment-maintenance.md) 与 [采编合同](../../public/automation.md)。

## 发布与角色释放回执

[PR #9](https://github.com/AutoGenUI/ag-ui.ai/pull/9) 与合并后 main 的 required verify 全通过。Sites 平台 v15 于 2026-10-13 12:42:27 UTC succeeded；源码与 GitHub tree 一致，env revision12、public、MCP、原2项任务保留。完整 SHA、opaque ID 与检查链接见 PROJECT_CONTEXT/CURRENT_STATE。

部署后 owner 使用精确匹配的 expectedRecipient 执行无发信 release，返回 released/public，另一次 status 确认 public。它不直接确认订阅或发送邮件；用户仍须申请并使用新确认邮件。公开人数仍1/250、余位249；中英订阅、三个RSS与状态200，匿名管理403。未读取秘密、实际邮箱内容或其他订阅行，未触发真实发送，也未新获生产DOM验收。

v1.0.1 标签与 GitHub Release 尚未创建，等待用户确认部署结果；v1.0.0 未移动。后续公开回执为文档提交，不追加一次部署。
