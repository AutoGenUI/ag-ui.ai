# AG-UI.AI 公开工程状态与接续说明

本说明用于在同一个项目中持续迭代。它仅保留可公开的工程事实，未复制私人运营审计、账户、验收邮箱、生产数据或秘密值。机器可读记录见 [CURRENT_STATE.json](CURRENT_STATE.json)。

## 证据时间与状态区分

- **生产交接快照**：2026-10-13 05:26:10 UTC（新加坡时间 13:26:10），来自交接版本 28。本轮读取了经过校验的上下文文件，没有重新读取生产环境或邮件账户。
- **GitHub 本机核验**：2026-10-13 06:19 UTC（新加坡时间 14:19），重新检查本地改动、远端 main、同步分支和 PR。
- 下表中的生产配置状态来自交接；GitHub 状态来自本机核验。二者不能互相替代。旧报告中的“公众邮件关闭”和交接中的“GitHub 尚未提交”分别属于更早的阶段。

| 项目 | 状态及证据范围 |
| --- | --- |
| 网站 | [ag-ui.ai](https://ag-ui.ai)，保留现有 Sites 项目、公开权限和域名 |
| 生产版本 | 交接记录 v12 正式部署成功 |
| v12 正式源码 | `6027589c4bac13e456ad47d5ef2f0981ef18d94e` |
| 正式源码 tree | `f961865e0d744fffa8fffb3e4d978e8185f56f93` |
| GitHub | [AutoGenUI/ag-ui.ai](https://github.com/AutoGenUI/ag-ui.ai)，默认分支 main |
| 核验时远端 main | `c628886cda20756fedd044c3c076bb6b7850d0e4` |
| GitHub 同步 | [PR #3](https://github.com/AutoGenUI/ag-ui.ai/pull/3)，分支 `codex/ag-ui-ai-v12-sync`，草稿、尚未合并 |
| 代码/CI 核验基线 | `b0f0a40748474e3ce1f5918a7f9c4acff6f1a4f3`，完整导入 v12 后追加隔离本地 Worker 的 CI 修正 |
| 公众邮件 | 交接记录已开放；域名认证与真实投递验收通过，无需重新开启 |

本次文档提交接续上述核验基线。最新 PR head 和检查应以 GitHub 为准，不将文档自身的提交 SHA 循环写入本文。

## 产品与技术入口

网站为独立、中英双语生成式 UI 新闻与研究信息站，提供新闻、发展脉络、趋势、知识库、来源目录与方法论；新闻保留来源、日期、修订、更正和撤回记录。25 条双语事件与 4 个专题是初始种子内容规模，不代表当前新闻总量或技术采用率。

- 保留图谱、比较、技术资料、实验室和学堂。学堂入口为 `/en/learn/academy`、`/zh/learn/academy`，默认无付费模型调用；设计见 [对话学堂架构](architecture/conversational-academy.md)。
- D1 保存动态新闻、运行记录、订阅、周报投递状态和第一方统计。日常新闻更新走所有者工具，不要求重新构建。
- `/admin`、`POST /mcp` 与管理写入接口使用正式所有者鉴权。公开网站访问不授予写入、发信或读取订阅邮箱权限。
- RSS：`/en/feed.xml`、`/zh/feed.xml`，保留 `/feed.xml`；旧技术资料 feed 为 `/legacy-feed.xml`。
- 主要代码为 `lib/news/`、`components/news/`、`worker/index.ts`、`db/schema.ts` 和 `drizzle/`；v12 订阅布局说明见 [subscription-reading.md](design/subscription-reading.md)。
- 编辑政策与自动操作合同见 [EDITORIAL_POLICY.md](../EDITORIAL_POLICY.md) 和 [public/automation.md](../public/automation.md)。保留来源归因和证据边界，不以厂商自测、新闻数量或宣传语代替独立结论。

## 邮件与运营约束

交接记录 `EMAIL_ENABLED`、`EMAIL_ACCEPTANCE_PASSED` 和 `BREVO_DOMAIN_VERIFIED` 均已为 true，公众邮件已开放。发件地址为 `news@ag-ui.ai`。本轮没有读取秘密或再次验收、发送真实邮件，也没有修改这些配置。

生产已有邮件 API、签名、统计、webhook、所有者及固定测试收件人绑定。只记录绑定名称及其用途，不读取、导出或复制值。`BREVO_API_KEY`、`BREVO_WEBHOOK_SECRET`、`SUBSCRIPTION_SECRET`、`ANALYTICS_SECRET`、`SITE_OWNER_EMAIL`、`EMAIL_TEST_RECIPIENT` 均须留在正式安全配置中。

- 网站正式 confirmed 订阅策略容量为 250。每日发送额度 300、周报预算 250 是交接时的免费档与网站策略；不是联系人上限。后续是否变化需重新核验，不自动购买或升级。
- pending、test、unsubscribed、suppressed 不占正式 confirmed 容量。确认原子取得名额；满额返回 `capacity-full`，偏好与退订继续可用；退订释放名额。
- 普通 GET、邮件扫描不确认或退订；用户主动 POST 才执行。保留原始 URL/纯文本后备、状态反馈、请求 epoch 和防旧请求覆盖逻辑。
- 测试身份与正式订阅隔离，不能将测试收件人转为正式订阅。固定测试收件人只取服务器配置，不从工具参数指定。
- 保留 generation、最新 run 原子 claim、restart winner、过期检查、投递幂等和抑制机制；不确定提交不能自动重发。D1 字面前缀使用 `substr`，不要恢复曾触发长度限制的 LIKE prefix 实现。
- 交接记录两轮真实验收完成，合计 4 封测试邮件，用户已退订，鉴权 Delivered 回调与退订后停发通过。本轮没有重复此流程。没有真实 queued cancellation 证据；不宣称真实验证了全部退信情况。
- 服务接受请求、Delivered 回调和用户实际收件分别记录；不依打开/点击判定已读或决定发信。

既有采集任务为新加坡时间每天 08:00、20:00，周报准备为周一 09:00。交接要求保留两项既有任务，不重复创建或从定时采编调用 `mail-test`。本轮没有读取或修改任务配置，也不把交接时间表当作每次运行成功的证据。

## 隐私与访问限制

交接记录已接受并披露 Brevo 匿名跟踪。匿名化不等于关闭像素或链接改写；全面关闭尚未验证，订阅与隐私页面必须保持准确的双语披露。本站浏览统计不存原始 IP、不关联订阅邮箱与浏览轨迹，访客数为估算；这是第一方统计的边界，不代表邮件没有第三方跟踪。

中国大陆部分网络的 Cloudflare 拦截为已知限制。后续手机流程曾成功，不证明拦截原因、地域覆盖或全球可访问性。继续保留 Sites；不能从旧的某个出口成功推断所有网络均已恢复。

## Git 同步与验证记录

代码交接包的 checksum、bundle 前提、174 个受跟踪文件、ZIP 内容、Git blob 与 tree 重新校验一致。正式源码包含相对给定 main 的 11 个提交、102 个差异路径（83 新、19 改、0 删）。原本机 main 的 4 个提交包含在该历史中。

同步使用独立 worktree，已有可恢复 Git 快照；原 main 保留在 `525ec78904ab7e2b97717adc7ac13bfd3f5f3db0`，未覆盖本地工作。核验时两个 checkout 都没有未提交改动，同步分支与远端一致，远端 main 未新增提交。完整 v12 导入无冲突。

正式源码之外，仅 CI 和本次公开文档有差异。CI 增加 TypeScript、新闻/邮件、订阅 UI 测试，以及隔离本地 D1/Worker 的初始化、ready 等待与清理；保留全部原检查和阈值。

下列代码检查对应 `b0f0a407…` 基线，结果来自本对话此前执行与留存的核验记录，不表示本次文档更新重新运行了全部套件：

| 检查 | 结果 |
| --- | --- |
| 基础测试 / 新闻邮件 / 订阅 UI / 匿名本地 HTTP | 18 / 40 / 7 / 8 项通过，共 73 项 |
| TypeScript、内容、构建、链接 | 通过；内容 24 个双语文档；链接 0 错误 |
| Lint | 0 错误，2 条既有提示 |
| 依赖安全审计 | 失败，记录 33 项：11 moderate、21 high、1 critical |
| 体积预算 | 失败；Node 24 构建 JS 934566 / gzip 275319 字节，CSS 132412 / gzip 24990 字节，均超过既有预算 |
| GitHub required `verify` | [基线运行失败](https://github.com/AutoGenUI/ag-ui.ai/actions/runs/38353374564/job/115150601215)，停在安全审计，后续步骤被跳过 |

main 的 required `verify`、严格更新要求、管理员约束、线性历史及禁止 force-push/删除均保留。未绕过失败、降低安全或体积阈值。PR 为草稿且尚未合并；代码已上线不意味着 GitHub 验证通过。

## 后续迭代

接续时先核对实际分支、工作区、远端和 PR，复用合适 worktree，保留用户改动。更新本说明时记录来源时点与验证范围，不将私人交接包整包提交。

当前 GitHub/文档接续范围不包含重新部署、DNS、邮件开关、秘密、定时任务或真实邮件。后续功能与发布以用户当轮授权为准，不从交接推定额外权限。保持零新增付费与默认无付费模型调用。

本地 HTTP 验证只用隔离 D1 和本地 Worker，邮件三个开关均 false，无真实密钥，不使用生产站点作 `SITE_TEST_BASE_URL`，不伪造所有者。完整验证入口见 [README](../README.md) 与 [CI 工作流](../.github/workflows/ci.yml)。修复安全审计和体积超限仍是未完成工程工作，应独立评估并如实更新 PR。
