---
slug: mcp-apps
title: MCP Apps
summary: MCP 的正式扩展，让 MCP Server 向兼容对话宿主提供运行在沙箱中的交互式 HTML 界面。
lastVerified: "2026-07-20"
order: 6
layer: embedded
kind: extension
maturity: stable
sourceAuthority: primary
chooseWhen:
  - 界面必须运行在兼容的 AI 对话宿主内，并通过宿主调用服务端工具。
  - 需要表单、仪表盘、富媒体或多步骤流程，同时要求 iframe 隔离和双向上下文。
avoidWhen:
  - 已拥有常规 Web 应用，且不需要宿主内嵌、对话上下文保持或 MCP 工具访问。
composesWith:
  - json-render
  - mcp
license: 规范仓库条款
primarySource: https://modelcontextprotocol.io/extensions/apps/overview
officialSources:
  - https://modelcontextprotocol.io/extensions/apps/overview
  - https://github.com/modelcontextprotocol/ext-apps
---

## 解决什么问题

MCP Apps 将一个 MCP Tool 与 `ui://` Resource 关联。兼容宿主读取 HTML View，在沙箱 iframe 中渲染，并代理 View、模型上下文与服务端工具之间的 JSON-RPC 通信。

## 位于哪一层

这是宿主内嵌应用机制，不是 A2UI 那样可移植的声明式组件树，也不是 AG-UI 那样连接自有前端的通用 Agent 事件协议。

## 宿主依赖

不同客户端的支持能力不一致。选型前必须确认能力协商和客户端兼容矩阵。

## 安全边界

使用强制沙箱，声明最小 CSP 与权限，把工具结果视为不可信输入，并确保服务端授权不依赖 View 展示的任何状态。

## 最小示例

```text
MCP 工具结果 → 引用 ui://atlas/comparison
兼容宿主 → 获取资源 → 沙箱 iframe
iframe 动作 → 宿主桥接 → 已授权 MCP 工具
```

并非所有 MCP 客户端都渲染 Apps，因此必须先检测能力并提供文本降级。
