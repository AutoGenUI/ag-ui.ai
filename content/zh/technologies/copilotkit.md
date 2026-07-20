---
slug: copilotkit
title: CopilotKit
summary: 围绕 AG-UI 生态构建的 Agent 前端与 Runtime 平台，覆盖 Generative UI 模式和多种 Agent Framework 集成。
lastVerified: "2026-07-20"
order: 7
layer: implementation
kind: platform
maturity: active
sourceAuthority: primary
chooseWhen:
  - 希望使用围绕 AG-UI 的生产级 React 组件与 Runtime 集成，而不是自行实现全部客户端基础设施。
  - 希望在同一前端栈中覆盖受控式、声明式或 MCP Apps Generative UI 模式。
avoidWhen:
  - 只需要厂商无关的协议类型，或正在构建非 React 且刻意保持最小依赖的客户端。
composesWith:
  - ag-ui
  - a2ui
  - mcp-apps
  - open-json-ui
license: MIT
primarySource: https://github.com/CopilotKit/CopilotKit
officialSources:
  - https://github.com/CopilotKit/CopilotKit
  - https://docs.copilotkit.ai/
---

## 解决什么问题

CopilotKit 为 Agent 应用提供前端组件、Hooks、Runtime 集成和 Generative UI 模式，也是 AG-UI 协议成长出来的项目生态。

## 位于哪一层

可以把 CopilotKit 看作 AG-UI 上方的实现平台。它能够渲染预定义前端工具、集成 A2UI、承载 MCP Apps Middleware，而 AG-UI 仍可被其他客户端与 Runtime 独立实现。

## 取舍

平台能缩短高质量 React 体验的交付路径，但也引入框架约定。应把业务逻辑与协议契约分离，避免前端库迁移牵动 Agent Runtime。

## 安全边界

审核每个前端工具、Middleware 连接和 Renderer Adapter。工具可见不等于拥有权限，高权限副作用必须继续由服务端强制授权。

## 最小示例

```text
React 界面 + CopilotKit 前端工具
  ↕ AG-UI 事件
Copilot Runtime Adapter ↔ Agent Framework
```

先从一个只读前端工具开始；启用写操作前补齐用户确认和服务端授权。
