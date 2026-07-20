---
slug: ag-ui
title: AG-UI
summary: 面向 Agent Runtime 与用户应用之间的事件协议，统一承载流式消息、工具调用、共享状态和人在回路交互。
lastVerified: "2026-07-20"
order: 1
layer: interaction
kind: protocol
maturity: active
sourceAuthority: primary
chooseWhen:
  - 需要在 Agent 后端与产品自有前端之间建立双向、可恢复的实时连接。
  - 体验需要同时流式传递文本、工具、状态、活动进度、中断或用户反馈。
avoidWhen:
  - 只缺少组件描述格式，并且已经拥有完整的传输层和运行生命周期。
composesWith:
  - a2ui
  - openui
  - json-render
  - copilotkit
  - a2a
  - mcp
license: MIT
primarySource: https://docs.ag-ui.com/
officialSources:
  - https://docs.ag-ui.com/
  - https://github.com/ag-ui-protocol/ag-ui
---

## 解决什么问题

AG-UI 规范了 Agent 与用户应用之间的实时交互边界。事件流覆盖运行生命周期、消息、工具调用、共享状态、活动与自定义扩展。因此它首先是交互协议，而不是视觉组件库。

## 位于哪一层

AG-UI 位于 Agent Runtime 和前端之间。A2UI 这样的声明式 UI 载荷可以通过 AG-UI 传输，json-render 或 OpenUI 等渲染框架再把结构化输出映射成组件。MCP 与 A2A 分别位于工具/数据和 Agent 协作等相邻边界。

## 安全边界

把所有事件与工具参数视为不可信输入；校验事件结构，在服务端授权工具副作用，不暴露原始思维链，并从可信状态快照恢复连接，而不是盲目重放客户端状态。

## 最小示例

```text
用户动作 → RunAgentInput → Agent Runtime
Agent Runtime → 有序 AG-UI 事件 → 前端状态与界面
```

连接真实模型前，先在事件实验室中完整走通确定性的生命周期。
