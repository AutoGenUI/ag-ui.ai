---
slug: openui
title: OpenUI
summary: 以紧凑流式语言为核心的 Generative UI 框架，包含 React Runtime、组件库、提示词生成和聊天界面。
lastVerified: "2026-07-20"
order: 3
layer: declarative
kind: framework
maturity: active
sourceAuthority: primary
chooseWhen:
  - 需要面向 React 的端到端框架、紧凑流式 UI 输出与现成组件库。
  - 希望组件白名单、提示词生成和渐进渲染由一个集成工具包提供。
avoidWhen:
  - 最重要的是框架无关的跨平台互操作，而不是 React Runtime 的开发体验。
composesWith:
  - ag-ui
  - copilotkit
license: MIT
primarySource: https://github.com/thesysdev/openui
officialSources:
  - https://github.com/thesysdev/openui
  - https://www.openui.com/
---

## 解决什么问题

OpenUI 将 OpenUI Lang、流式解析与渲染、组件定义、提示词生成、预置组件库和聊天界面组合在一起。它的紧凑语言重点降低生成界面所需的 Token 数量。

## 位于哪一层

OpenUI 是 Generative UI 框架。它可以消费通过 AG-UI 传递的 Agent 输出，但不会替代运行生命周期、共享状态和工具事件等交互契约。

## 取舍

集成路径对 React 团队很高效，但采用专用语言和 Runtime 比采用单纯传输协议更具框架绑定。Token 效率结论应使用自己的组件目录和模型进行验证。

## 安全边界

保持组件白名单精简，校验 Zod 契约，限制动作和 URL，绝不能把生成的 UI 语法当成可直接执行的应用代码。

## 最小示例

```text
模型流 → OpenUI Lang Parser → 已注册组件树 → React Runtime
```

先使用一个只展示数据的卡片和严格组件 Schema，再逐步引入交互动作。
