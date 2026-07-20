---
slug: a2ui
title: A2UI
summary: 一种声明式、可移植的 UI 格式，让 Agent 描述可更新界面，再由客户端通过可信组件目录完成原生渲染。
lastVerified: "2026-07-20"
order: 2
layer: declarative
kind: specification
maturity: public-preview
sourceAuthority: primary
chooseWhen:
  - 同一份 Agent 生成的界面意图需要跨 Web、Flutter 或其他原生客户端渲染。
  - 希望采用声明式数据、增量更新和由客户端掌控的可信组件目录。
avoidWhen:
  - 当前必须依赖稳定的一点零版本线协议，或只服务于一个高度受控的 React 应用。
composesWith:
  - ag-ui
  - copilotkit
  - a2a
license: Apache-2.0
primarySource: https://github.com/a2ui-project/a2ui
officialSources:
  - https://github.com/a2ui-project/a2ui
  - https://a2ui.org/
---

## 解决什么问题

A2UI 让 Agent 通过声明式数据“表达界面”。客户端把抽象组件映射为自身可信控件，从而继续掌控样式、无障碍与执行行为。

## 位于哪一层

A2UI 是 UI 载荷和渲染契约，并不替代 Agent 到客户端的传输。其官方资料把 AG-UI 与 A2A 列为兼容传输方式。对需要同时覆盖 Web 和原生端的界面，这种分层尤其有价值。

## 成熟度

项目当前把稳定协议族定位为公开预览，同时推进 1.0 规范。应固定协议版本并隔离 Renderer Adapter，避免升级影响业务组件。

## 安全边界

只注册经过审核的组件与动作；拒绝未知类型，校验绑定、URL 和富文本，并让高影响操作经过明确确认与服务端授权。

## 最小示例

具体 Envelope 会随版本变化，但职责划分保持稳定：

```text
Agent → 声明式组件树 + 数据绑定
客户端目录 → 校验类型和属性 → 原生可信组件
```

在把这条概念链路转化为生产 JSON 前，先固定 A2UI 版本。
