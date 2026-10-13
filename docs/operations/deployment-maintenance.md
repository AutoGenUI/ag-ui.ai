# 部署、数据库与运行维护

本文件供后续维护者和编码 agent 接手。编写依据是 2026-10-13 的公开源码、交接记录及 Sites 工作流说明，**不是一次新的生产巡检或发布**。先读 [维护总入口](README.md)、[项目上下文](../PROJECT_CONTEXT.md) 和 [机器状态](../CURRENT_STATE.json)；DNS、邮件和所有者操作分别见 [DNS 维护](dns-maintenance.md)、[邮件订阅](email-subscriptions.md)、[owner 管理](owner-management.md)。

## 现有资源与证据边界

| 资源 | 已知信息 | 接手时如何核实 |
| --- | --- | --- |
| GitHub | `AutoGenUI/ag-ui.ai`，长期分支仅 `main` | 刷新远端、工作区和 PR，不把本文 SHA 当作最新 HEAD |
| 已合并验证基线 | `24edc498f5c135e283d773d946fcab3e99d239bd`；[PR #3](https://github.com/AutoGenUI/ag-ui.ai/pull/3) 与 [main CI](https://github.com/AutoGenUI/ag-ui.ai/actions/runs/38373624876/job/115216417348) 已通过 | 这是本次维护文档之前的基线，不预写当前文档提交的 SHA |
| Sites 项目 | `appgprj_6a5dcacfcbb4819193bac2b2104ed926` | 从 [hosting.json](../../.openai/hosting.json) 复制，使用 Sites `get_site` 核对同一项目；不可由域名推导或重新创建 |
| 正式域名 | `https://ag-ui.ai`，`www` 在 Worker 中 308 跳转到主域并保留路径和查询 | 核对现有项目的自定义域名和 TLS 状态，不替换 DNS |
| Sites 访问权限 | 交接记录为公开网站 | 接续时核对当前 audience，部署时保留；公众可读不授予 owner 写入权限 |
| 生产版本 | 交接记录 v12，源码 `6027589c4bac13e456ad47d5ef2f0981ef18d94e`，tree `f961865e0d744fffa8fffb3e4d978e8185f56f93` | 交接时间为 `2026-10-13T05:26:10.881Z`；本次 GitHub 修复与文档同步未重新部署 |
| 托管数据 | D1 逻辑绑定 `DB`；R2 为 `null`；能力声明为 `mcp` | Sites 为该项目配置真实资源；仓库没有生产数据库 ID 或 Cloudflare 账户凭据 |

GitHub 合并、CI 通过、Sites 保存版本和 Sites 部署成功是四个不同的状态。仓库目前只有 [CI](../../.github/workflows/ci.yml) 与 [生态检查](../../.github/workflows/ecosystem-watch.yml)，没有执行 Sites 部署的 GitHub 工作流。外部连接是否配置了发布钩子未在本轮核实；不能承诺一次 push 必然发布，也不能以 GitHub 绿色代替 Sites 生产部署记录。

## 接手与 Git 流程

1. 读取 AGENTS、上下文和本文件；确认本轮是代码、资料、运行配置还是生产发布授权。
2. 检查 `git status --short --branch`、远端地址、`git worktree list`、当前 HEAD 和最新 `origin/main`；先保存需要的可恢复快照。保留用户修改和已有远端提交，不静默 stash、clean、reset 或 force-push。
3. 后续开发使用短期 `codex/…` 分支及 PR。`main` 的 required `verify`、严格更新要求、管理员约束、线性历史及禁止 force-push/删除必须保留。仅保留 main 指长期分支策略，不等于绕过 PR 保护直接发布。
4. 运行与改动相应的检查，保持安全审计和资产预算；通过最新 head 的必需检查后正常合并。核实无独有工作并有恢复依据后删除短期分支。
5. 在 [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md) 和 [CURRENT_STATE.json](../CURRENT_STATE.json) 记录日期、来源修订、验证范围、限制及 GitHub/生产差异。只有明确授权的下一次发布才执行下面的 Sites 流程。

## 检查与体积门槛

CI 使用 Node 22；工程要求至少 22.13。已验证基线使用 Node `22.23.1` / npm `10.9.8` 的独立安装。以提交的 lockfile 执行 `npm ci`，不通过临时 npm 更新替换待验收依赖。

```sh
npm ci
npm run security:audit
npm run content:validate
npm test
npx tsc --noEmit
npm run test:news
node --import tsx --test tests/subscription-ui.test.mjs
npm run lint
npm run build
npm run check:bundle
```

HTTP 测试需要下文的隔离 Worker；CI 另有链接检查。上一轮结果为基础与兼容 35、新闻邮件 40、订阅 UI 7、本地 HTTP 8，共 **90 项通过**；24 个双语内容文档通过，lint 0 错误、2 条既有警告。它们是带修订号的已有证据，不代表本次文档更新重新执行了全部套件。

安全门槛仍是 `npm audit --registry=https://registry.npmjs.org --audit-level=high`。上一轮 0 high、0 critical、8 moderate，剩余为 drizzle-kit/esbuild 和 gray-matter/sprintf-js 依赖链；后续安装必须重新审计，不能隐藏告警或降低门槛。构建适配包的限制与专项测试见 [fast-glob 兼容说明](../../build/fast-glob-compat/README.md)，新增消费者前先验证它支持所需 API。

| 全站客户端资产 | 原预算（字节） | 上一轮实测（字节） |
| --- | ---: | ---: |
| JS | 920000 | 918831 |
| JS gzip | 275000 | 266977 |
| CSS | 125000 | 115604 |
| CSS gzip | 24000 | 22853 |

JS 原始体积仅剩 **1169 字节**。新增页面、依赖或客户端字段都要重新运行 [check-bundle](../../scripts/check-bundle.mjs)。保留 [Vite](../../vite.config.ts) 的顶层 Terser 配置、RSC/SSR 边界、当前语言课程投影和 Tailwind 实际源码扫描；不能靠删除已有功能或抬高预算完成验收。

## 隔离本地 D1 与 Worker

使用不带真实密钥的干净测试 checkout。不要读取、复制或加载现有生产 `.env*`、`.dev.vars*`；确认启动的进程没有继承真实邮件/模型凭据。所有命令均为 `--local`，使用本次新建的临时目录，不借用现有 `.wrangler/state`。以下 Bash 脚本在 `npm run build` 成功后执行，需本机 4173 端口空闲：

```bash
set -euo pipefail
ci_runtime_dir="$(mktemp -d "${TMPDIR:-/tmp}/ag-ui-ai-http.XXXXXX")"
worker_pid=""
cleanup() {
  if [[ -n "$worker_pid" ]]; then
    kill "$worker_pid" 2>/dev/null || true
    wait "$worker_pid" 2>/dev/null || true
  fi
  rm -rf "$ci_runtime_dir"
}
trap cleanup EXIT

for migration in drizzle/0000_medical_katie_power.sql drizzle/0001_mail_acceptance_isolation.sql; do
  WRANGLER_LOG_PATH="$ci_runtime_dir/wrangler.log" \
    node node_modules/wrangler/bin/wrangler.js d1 execute DB \
    --local --config dist/server/wrangler.json \
    --persist-to "$ci_runtime_dir/state" --file "$migration"
done

WRANGLER_LOG_PATH="$ci_runtime_dir/wrangler.log" \
  node node_modules/wrangler/bin/wrangler.js dev \
  --config dist/server/wrangler.json --local \
  --persist-to "$ci_runtime_dir/state" --ip 127.0.0.1 \
  --port 4173 --inspector-port 0 \
  --var EMAIL_ENABLED:false --var BREVO_DOMAIN_VERIFIED:false \
  --var EMAIL_ACCEPTANCE_PASSED:false \
  >"$ci_runtime_dir/worker.log" 2>&1 &
worker_pid=$!

worker_ready=false
for attempt in {1..30}; do
  if ! kill -0 "$worker_pid" 2>/dev/null; then
    cat "$ci_runtime_dir/worker.log"
    exit 1
  fi
  if curl --noproxy 127.0.0.1 --fail --silent --show-error --max-time 1 \
    http://127.0.0.1:4173/api/subscription/status >/dev/null 2>&1; then
    worker_ready=true
    break
  fi
  sleep 1
done
[[ "$worker_ready" == true ]]
kill -0 "$worker_pid"
SITE_TEST_BASE_URL=http://127.0.0.1:4173 npm run test:render
```

浏览器检查需要在 cleanup 前继续使用同一进程，可在测试后、脚本退出前暂停于本机受控终端。验证中英文新闻查询/筛选、文章与来源、时间线、专题、学堂 16 课和离线 `RUN_FINISHED`、手机抽屉、订阅入口及 RSS。邮件三个开关在此处必须为 false，不将本地 `pending-activation` 状态传播回生产。

本地 `dist/server/wrangler.json` 来源是 Vite 的 Cloudflare 本地绑定配置：`site-creator-d1` 和 `00000000-0000-4000-8000-000000000000` 是占位资源。**不可删除 `--local`、加 `--remote`，也不可用它执行 `wrangler deploy`**。该文件不能定位 Sites 生产 D1，不能据此选择自己的 Cloudflare 账户或创建替代生产资源。

## Sites 正式发布步骤

下面是下一次已获授权发布的操作说明。本次维护文档提交不会执行这些步骤。

1. 使用有权管理该项目的 Sites 连接，从 hosting manifest 复制既有 `project_id`，调用 `get_site`。只保留项目、audience、现有发布版本/状态及关联任务等公开元数据；不要把完整响应、bypass token 或运行秘密写入日志。确认域名仍指向同一项目，保留公开访问策略。
2. 调用同一项目的 `create_source_repository_write_credential`，通过当时已安装的 Sites 技能和 source helper 打开现有 Sites 源码。使用独立的发布暂存目录及工具返回的 `checkout_path`；不要覆盖用户的 GitHub checkout。凭据只保留在会话内，并通过隐藏 stdin 交给 helper，不放在 shell 参数、文件、Git 或截图中。
3. 将经 PR/CI 验证的 GitHub 修订整合到该 Sites 源码 checkout。保留该项目的 manifest、Sites 源码历史和构建集成；检查完整受跟踪差异，排除私密交接包、运行数据、环境文件和 `node_modules`。不要盲目复制目录或把 Sites 源码仓库当成 GitHub `origin`。记录发布候选的 GitHub SHA 与 helper 最终 Sites `commit_sha` 的对应关系。
4. 核实托管配置仍存在，保留原值：owner、邮件 API/发件人/webhook、订阅签名、统计秘密、固定测试收件人、邮件三个门槛及现有任务。只核对名称/配置状态，不导出秘密。v12 的公众邮件已开放，不得应用历史初始安装的 false 示例，或为发布测试关闭正式邮件。
5. 按 Sites 技能定位当前插件路径，使用 `site-workflow.mjs --project-id <既有ID>`：其 stdin JSON 使用返回的 credential、完整 source 结果、尚未执行的 checks/build `commands` 和绝对 `archivePath`。框架打包使用该技能的 `build-site.mjs`；helper 负责源码 commit/push、按顺序检查和打包。只使用它最终验证的 `project_id`、`commit_sha` 和 `archive`；未知结果先恢复原操作，不新建项目或重复发布。
6. 本站为公开 audience，正常流程是 `save_site_version`，保存其返回的版本 ID，再 `deploy_site_version`。不能用 owner-private 发布工具或修改 audience 来绕过访问。保存成功不等于部署成功；未完成 archive 的 source-only 版本也不等于可部署版本。
7. 对返回的 pending/building/publishing 状态继续查询 `get_deployment_status`，直至 succeeded 或失败。记录同一部署的项目 ID、版本 ID、Sites commit、候选 GitHub SHA、开始/结束时间和结果，不在未知状态重复启动。
8. 部署成功后进行下面的无邮件验收，并更新公开工程记录。失败则保留日志中的非敏感错误和 migration 状态，按回退规则处理。

[sites() 构建插件](../../build/sites-vite-plugin.ts) 会将 manifest 与 `drizzle/` 打包至 `dist/.openai/`。发布前核对 `dist/.openai/hosting.json` 仍是既有项目与 `DB` 绑定，迁移目录完整。不能仅上传 `dist/client` 丢失 Worker、托管配置和迁移。

## Schema 升级、备份与回退

现有迁移按 [Drizzle journal](../../drizzle/meta/_journal.json) 顺序为：

- [0000](../../drizzle/0000_medical_katie_power.sql)：建立新闻、来源、专题、修订、运行、订阅、周报、投递、限额与统计表。
- [0001](../../drizzle/0001_mail_acceptance_isolation.sql)：为 subscribers、editions、deliveries 加 `is_test NOT NULL DEFAULT 0`，保留测试邮件与正式运营隔离。

Sites 在上传新 Worker 前应用未执行的托管 schema 迁移。**部署失败仍可能已应用迁移**。已执行 SQL、snapshot 与 journal 不可改写或重复执行；新增 schema 先改 [db/schema.ts](../../db/schema.ts)，`npm run db:generate` 后人工核对 SQL/元数据，追加新迁移并测试现有数据库升级。迁移仅做有界 schema 变更，种子与回填不能塞入迁移；已有初始内容在运行入口幂等插入，日常采编更新走 owner 工具。

升级前由 owner 确认当前生产数据库绑定、已应用迁移和可恢复备份/恢复点。可将数据库结构概览与迁移状态用于核实，不读取订阅行或投递中的私人地址；若恢复工作必须接触这些数据，另行明确授权和安全存储方式。生产备份属于私有运行资料，不能提交仓库。

现有仓库与工具说明没有提供可直接调用的 Sites 托管 D1 导出/恢复命令，也未核实该项目的恢复保留期。不能把 Cloudflare 账户中的其他数据库或本地占位 ID 当成它。需要 owner 在该项目的 Sites 管理界面/平台支持中取得：真实绑定的安全操作入口、恢复点/备份机制、保留期、恢复所需权限与操作后验证方式。若平台无法提供可验证恢复方案，对需要回退保障的 schema 变更应先完成这项前置工作。

代码回退优先选择该项目已有、带完整 archive 的已知成功版本，由 Sites 正常部署；source-only 旧版本需先恢复其匹配产物。回退前验证它与当前 schema、测试隔离字段、队列状态、签名 generation 和邮件门槛兼容。现有两份 SQL 没有 down migration，切换 Worker **不会回滚 D1**。

v1.0.0 候选没有 schema 迁移，但签名订阅响应新增 `subscriptionType`，新客户端遇到旧 API 缺少字段会保守拒绝成功提示。正式发布与回退都应使用同一个已验证版本的客户端和 Worker，完成后刷新浏览器再验收；混用缓存中的新客户端与旧 Worker 可能显示“未能确认结果”，并不证明数据库未更新。不要为了兼容提示解除测试隔离或恢复 GET 自动确认。GitHub `v1.0.0` tag 与 Sites 的递增数字版本是独立标识，按 [发布记录](../releases/v1.0.0.md) 查询实际部署，不能由 tag 名推断生产版本。

对于不兼容 schema，优先追加兼容修复并向前发布；确需恢复数据库时，由 owner 授权协调停止受影响的写入/投递任务、恢复与版本配套的数据、核对抑制和已提交邮件状态，再恢复运行。不得盲目清库、回放旧投递或恢复旧签名链接；不确定邮件必须向 provider 对账。切勿以“回滚”为理由应用 [2026-07-20 首发记录](2026-07-20-public-launch.md) 中删除域名、恢复私有 audience 的历史首发撤销流程。正常源码回退应保留现有域名、公开权限和生产配置。

## 部署后与日常验收

先做不会发信的检查；真实邮箱验收按 [邮件维护](email-subscriptions.md) 取得单独授权，不能借一次代码发布重复发送。

| 检查 | 通过条件与限制 |
| --- | --- |
| Sites 发布 | 平台返回同一项目/版本的成功状态；GitHub 绿色或 HTTP 200 不能替代它 |
| 浏览器和旧链接 | 桌面与 390px 手机下 `/en`、`/zh`、news、timeline、trends、knowledge、map、compare、technologies、learn/academy、lab 均可用；canonical、语言切换与旧链接保留 |
| RSS | `/en/feed.xml`、`/zh/feed.xml`、`/feed.xml` 为新闻 RSS，`/legacy-feed.xml` 仍是旧资料 feed；生产数据数量随采编变化，不套用本地固定 25 条断言 |
| 公开只读接口 | `/api/news`、`/api/subscription/status`、`/api/stats` 返回预期数据；首页可能在 D1 故障时降级显示种子，因此首页 200 不是数据库健康证据 |
| 管理隔离 | 匿名 `/admin` 只显示登录入口；匿名 `/api/admin` 和 MCP tools/call 返回 403；不带认证的 Brevo webhook 返回 401。MCP discover/initialize 可公开，不据此判定写入权限失效 |
| 统计 | 页脚与 `/api/stats` 在缓存/刷新窗口后相符；owner 看聚合趋势，访客标注估算；不伪造 owner 请求头获取管理数据 |
| 学堂成本 | 不设置付费模型密钥的离线路径可完成 `RUN_FINISHED`；共享试用默认关闭，任何模型或预算变更需明确授权 |
| 邮件状态 | 只核对公开聚合状态/owner 就绪状态和既有门槛；不进行 signup、drain、mail-test 或伪造回调。submitted、delivered、真实收件分别判定 |

公开站点验收用已有自动化 user-agent；代码也排除 localhost、prefetch、明显机器人和 Sites 已登录流量，避免把测试混入正式统计。不关闭正式统计、不补造历史流量；原始 IP 不持久化，日常访客为加盐估算，30 秒可见阅读才记 engaged。统计失败不应阻断阅读。Brevo 匿名 tracking 不等于关闭像素或链接改写；完整关闭仍未验证，双语披露必须保留。

保留既有两项 Sites 任务：新加坡时间每天 08:00/20:00 采编、周一 09:00 周报准备。它们与 GitHub 每周生态 review issue 工作流不同。日常新闻直接写 D1，不重新部署；续跑、重试、去重、证据冲突与投递队列操作遵循 [automation.md](../../public/automation.md)。检查任务的最新成功 checkpoint、source 检查状态与失败原因，不从任务存在推断运行成功。

超过 36 小时无成功采集时应显示陈旧提示，并使用既有任务通知渠道向 owner 报告有意义的新变化；不要无变化重复通知、创建重复 schedule 或用 `mail-test` 通知。修改既有任务前核对 Sites 关联任务和 enabled/paused 状态；新的无人值守写入路径必须通过独立原文读取、认证工具调用与持久化读回验证。

若出现 Cloudflare 403 / blocked，分别核查权威 DNS、TLS、Sites 部署、主域与 fallback、不同网络出口与代理。历史某个香港出口被拦并在其他出口成功，不是所有网络恢复的证明；中国大陆可访问性仍不保证。记录网络与时间、响应及验证范围，不单凭一个出口 403 修改 DNS、移除安全机制或重建站点。

## 尚需 owner 在接手时提供的访问

需要的是现有 Sites 项目的受授权连接/管理入口、DNSPod 与 Brevo 的安全登录方式，以及发布/恢复的具体授权；不是把密码、API key、邮件地址清单、登录验证码或签名链接粘贴到对话。若工具/账号缺失，请 owner 在受支持的安全登录或接管界面完成连接。随后仅核对已授权范围，保留现有配置；无人值守 agent 不借用上一次浏览器会话假定自己已有 owner 权限。

每次交付至少留下：来源 SHA 与 tree、PR/CI、Sites 项目与版本/部署状态（若真的发布）、migration 状态、验证时间/环境/网络、是否使用真实邮件或付费资源、剩余风险和恢复依据。秘密值、私人数据库内容及备份只保留在正式安全存储中。
