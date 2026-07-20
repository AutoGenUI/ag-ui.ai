---
slug: open-json-ui
title: Open-JSON-UI
summary: 由 CopilotKit 生态文档描述的早期声明式 JSON UI 概念，目前未核实到独立的一方 OpenAI 规范仓库。
lastVerified: "2026-07-20"
order: 5
layer: declarative
kind: specification
maturity: emerging
sourceAuthority: ecosystem
chooseWhen:
  - 正在评估 CopilotKit Generative UI 示例中明确描述的 Open-JSON-UI 载荷。
  - 能接受仍在形成中的契约，并会通过自有的校验适配层隔离变化。
avoidWhen:
  - 采购、合规或长期互操作要求一方正式发布的规范和独立一致性测试。
composesWith:
  - ag-ui
  - copilotkit
license: 未核实
primarySource: https://github.com/CopilotKit/generative-ui
officialSources:
  - https://github.com/CopilotKit/generative-ui
  - https://docs.showcase.copilotkit.ai/agno/generative-ui/open-json-ui
---

## 证据状态

CopilotKit 将 Open-JSON-UI 描述为声明式 Generative UI 选项，并提供说明性 JSON 载荷。截至最后核验日期，本图谱没有确认到独立的一方 OpenAI 规范仓库、版本政策或一致性测试套件。

## 解决什么、位于哪里

现有文档中的思路是用 JSON 表达 UI，再由客户端映射到受控组件，因此它位于声明式渲染层，并不定义外围的 Agent 运行或传输生命周期。

## 如何评估

应把现有资料视为“生态文档中的概念”，而不是 OpenAI 官方行业标准的证明。需要追问 Renderer 接受哪个 Schema 版本、兼容性由谁负责、校验规则在哪里定义。

## 安全采用路径

所有 Open-JSON-UI 载荷都通过本地 Adapter 和 Schema Validator，保留迁移到其他组件目录格式的出口，并记录实现所依据的文档快照。

## 最小示例

```json
{
  "type": "Notice",
  "props": { "tone": "info", "text": "需要审核" }
}
```

这只是概念载荷，不代表规范 Schema。仅通过本地版本化适配器与白名单接收。
