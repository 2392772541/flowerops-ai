# Changelog

本项目遵循语义化版本，所有经营数据均为合成演示数据。

## 1.0.0 — 2026-09-04

### 产品能力

- 完成经营总览、AI 决策、订单、批次库存、采购、客户与应收、经营问数和审计中心。
- 建立订单、花束配方、库存批次、供应商、采购和应收领域模型。
- 支持 Demo 重置、JSON 导出和浏览器本地持久化。

### AI 治理

- `AI_AGENT` 只允许读取经营事实和生成 ActionProposal。
- 高影响动作必须经过人工审批、Schema 校验、业务实体校验和角色权限校验。
- `SYSTEM_EXECUTOR` 独立执行已批准提案，使用 Idempotency Key 防止重复写入。
- 审计事件保存人员、角色、状态变化、Request ID、Idempotency Key 和执行结果。

### 质量验证

- 43 条领域规则、权限、提案校验和状态机测试。
- GitHub Actions 自动执行 lint、test 和 production build。
- 桌面端完整业务流程及 390px 移动端导航验收通过。