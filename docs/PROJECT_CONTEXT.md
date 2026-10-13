# AG-UI.AI 公开工程状态与接续说明

本说明用于在同一个项目中持续迭代。它仅保留可公开的工程事实，未复制私人运营审计、账户、验收邮箱、生产数据或秘密值。机器可读记录见 [CURRENT_STATE.json](CURRENT_STATE.json)。

## 证据时间与状态区分

- **生产交接快照**：2026-10-13 05:26:10 UTC（新加坡时间 13:26:10），来自交接版本 28。本轮读取了经过校验的上下文文件，没有重新读取生产环境或邮件账户。
- **GitHub 本机核验**：2026-10-13 06:19 UTC（新加坡时间 14:19），重新检查本地改动、远端 main、同步分支和 PR。
- **本轮 CI 修复记录**：2026-10-13 08:57 UTC（新加坡时间 16:57），修复提交 `42c1e0c762621294652a9dacfe02b94f940bdf1e` 已完成独立安装、安装后审计、90 项测试、构建体积和本地浏览器验收。此文档提交前 PR #3 仍为草稿且未合并，待推送并通过 required `verify`。
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
| 修复前远端 PR head | `09f361cf01874bd53a19c9cf613c6e3c46030f20`；08:50 UTC 刷新时远端 main 和另一个分支均未改变 |
| 本轮已验证修复 | `42c1e0c762621294652a9dacfe02b94f940bdf1e`；文档提交及 GitHub 检查在其后 |
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

同步使用独立 worktree，已有可恢复 Git 快照；原 main 保留在 `525ec78904ab7e2b97717adc7ac13bfd3f5f3db0`，未覆盖本地工作。首次同步核验时两个 checkout 都没有未提交改动，同步分支与远端一致，远端 main 未新增提交。完整 v12 导入无冲突。本轮修复仅在同步 worktree 中提交；原 checkout 的分支、依赖目录与工作文件保持不变。

首次同步在正式源码之外追加 CI 和公开文档。CI 增加 TypeScript、新闻/邮件、订阅 UI 测试，以及隔离本地 D1/Worker 的初始化、ready 等待与清理；保留全部原检查和阈值。本轮依赖及构建修复是生产 v12 之后的 GitHub 分支迭代，尚未部署到 Sites。

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

## 本轮 CI 修复进度

用户已授权在 `codex/ag-ui-ai-v12-sync` 修复安全审计与资源体积问题，通过现有 PR 合入 main，并保留其他分支和主分支保护。修复开始前已保存可恢复 Git 快照。以下本地验证对应修复提交 `42c1e0c762621294652a9dacfe02b94f940bdf1e`；不能替代最新 PR head 的 GitHub required `verify`。

- 定向更新 Next 和 `eslint-config-next` 至 `16.3.8`，React、React DOM、React Server DOM Webpack 至 `19.2.8`；Cloudflare Vite 插件至 `1.63.1`、Wrangler 至 `4.149.0`，PostCSS 至 `8.5.30`、Sharp 至 `0.35.5`，Vinext 内的 `image-size` 至 `2.0.4`。
- Vinext `0.0.50`、AI SDK `7.0.34`、Zod `4.4.3` 与既有 Markdown 版本保留，避免将本次安全修复扩大为框架迁移。
- 新增 `build/fast-glob-compat/`，使用官方 `tinyglobby 0.2.17` 兼容两个已验证的构建消费者，移除未提供修复版本的 braces/micromatch 链。包公开使用自身名称，根开发依赖与 `$fast-glob` 覆盖指向同一个本地适配包，不伪造上游版本。16 项专项测试覆盖实际消费者解析路径、CJS/ESM、路径行为、未知选项和输入边界；正常模式也与旧库做了外部差分对照。
- 独立回归复核发现原始字符串深度检查可被路径规范化和引号绕过，已改为每模式最多 16 个开括号字符的保守上限，并补充两条复现及转义、ignore、负模式、同步/异步回归。该限制仅服务受信任构建模式，并非完整 fast-glob API。
- Tailwind 扫描范围限定为实际源码，停止为未被页面引用的模板生成工具类；Vite 顶层启用客户端 Terser 两轮压缩，RSC/SSR 保持不压缩。课堂由服务器提供当前语言的展示字段，完整 16 课和双语 RAG 语料保留；客户端仅导入课程类型。页面、AG-UI 传输与 Markdown 功能均保留，未修改原体积预算。

| 本轮检查 | 当前状态与范围 |
| --- | --- |
| 安装后安全审计 | 0 high、0 critical、8 moderate；既有 high 门槛通过，剩余项为 drizzle-kit/esbuild 及 gray-matter/sprintf-js 依赖链，未隐藏或降低门槛 |
| 独立依赖安装 | Node 22.23.1 / npm 10.9.8 的干净 `npm ci` 通过；同步 worktree 使用自己的依赖目录，原 checkout 安装未改变 |
| 测试 | 基础及兼容 35、新闻邮件 40、订阅 UI 7、隔离 Worker HTTP 8，共 90 项通过；测试无真实邮件或付费模型调用 |
| TypeScript、内容、lint、构建 | 通过；24 个双语文档，lint 0 错误、2 条既有警告 |
| 实测体积 / 原预算 | JS 918831 / 920000，JS gzip 266977 / 275000，CSS 115604 / 125000，CSS gzip 22853 / 24000 字节，全部通过；JS 原始体积余量 1169 字节 |
| 浏览器 | 1440×900 和 390×844：新闻查询与筛选、中英课堂、选课、离线回答及 RUN_FINISHED、模型设置、手机课程/事件抽屉、中文时间线/趋势/订阅入口通过；无控制台错误，临时视口已恢复 |
| 独立回归审阅 | 完成；上述边界发现已修复并回归，未发现其他具体绕过；不等于验证了第三方包的全部实现 |
| GitHub required `verify` / 合并 | 本文记录时尚待推送运行。通过最新 head 的必需检查后，将 PR #3 转为 ready 并正常合并；保留其他分支及保护，不使用 bypass |

本文为带时间的本地验证快照。推送、检查和合并的最终状态以 [PR #3](https://github.com/AutoGenUI/ag-ui.ai/pull/3) 及远端 main 为准，后续接续必须刷新；不要把提交前状态当成实时 GitHub 状态。链接门槛仍由 CI 执行。剩余 moderate 项不会被隐藏，也不以降级检查或修改预算换取通过。

## 后续迭代

接续时先核对实际分支、工作区、远端和 PR，复用合适 worktree，保留用户改动。更新本说明时记录来源时点与验证范围，不将私人交接包整包提交。

当前 GitHub/文档接续范围不包含重新部署、DNS、邮件开关、秘密、定时任务或真实邮件。后续功能与发布以用户当轮授权为准，不从交接推定额外权限。保持零新增付费与默认无付费模型调用。

本地 HTTP 验证只用隔离 D1 和本地 Worker，邮件三个开关均 false，无真实密钥，不使用生产站点作 `SITE_TEST_BASE_URL`，不伪造所有者。完整验证入口见 [README](../README.md) 与 [CI 工作流](../.github/workflows/ci.yml)。本地验证已完成，推送并通过最新 head 的 required `verify` 后才能合并。没有重新部署、DNS、生产配置、任务或真实邮件动作。
