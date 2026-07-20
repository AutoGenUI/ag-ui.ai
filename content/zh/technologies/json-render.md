---
slug: json-render
title: json-render
summary: 模型生成可预测 JSON 规格、并被开发者定义的组件与动作约束的 Generative UI 框架。
lastVerified: "2026-07-20"
order: 4
layer: declarative
kind: framework
maturity: active
sourceAuthority: primary
chooseWhen:
  - 已采用组件目录思路，希望使用 Schema 约束的 JSON 和渐进式渲染。
  - 希望同一目录模型覆盖多种 Web 框架、原生端、文档、邮件、视频或终端 UI。
avoidWhen:
  - 实际缺少的是 Agent 运行传输层，或更偏好为极低 Token 成本优化的非 JSON 语言。
composesWith:
  - ag-ui
  - mcp-apps
license: Apache-2.0
primarySource: https://github.com/vercel-labs/json-render
officialSources:
  - https://github.com/vercel-labs/json-render
  - https://json-render.dev/
---

## 解决什么问题

json-render 提供目录、Schema 与 Renderer 契约，让 AI 输出始终落在已知组件和动作中。其生态覆盖 React、Vue、Svelte、Solid、React Native，以及 PDF、邮件等非屏幕输出。

## 位于哪一层

它是 UI 规格与渲染框架，不是 Agent 交互协议。若同时需要运行生命周期、流式消息、工具和共享状态，可以与 AG-UI 组合。

## 取舍

JSON 熟悉、可检查且便于工具处理，但复杂结构可能比专用语言消耗更多 Token。过大的组件目录也会扩大提示词和测试状态空间。

## 安全边界

生成规格不能选择任意 Import 或执行任意代码。每个节点、动作和绑定都要通过注册目录校验，授权逻辑则应置于 Renderer 之外。

## 最小示例

```json
{
  "type": "MetricCard",
  "props": { "label": "运行中任务", "value": 12 }
}
```

只有本地目录声明了 `MetricCard`、`label` 和 `value` 时 Renderer 才接受它；未知字段按失败关闭处理。
