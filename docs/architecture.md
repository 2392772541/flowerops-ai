# 系统架构

```text
React UI
 ├─ Dashboard / Orders / Lots / Purchasing / Receivables
 ├─ Decision Center / Safe Q&A / Audit
 ↓
Application Service
 ├─ Query path（只读聚合与解释）
 └─ Command path（提案 → 审批 → 执行）
 ↓
Domain Engine
 ├─ Batch inventory & recipe expansion
 ├─ Forecast & replenishment rules
 ├─ Zod proposal Schema + contextual entity validation
 ├─ RBAC role permission matrix
 ├─ Sales / purchase / receivable / lot state machines
 └─ Idempotency, audit events & safe draft execution
 ↓
Local demo repository（localStorage + JSON export）
```

## 关键架构决定

### 查询与命令分离

经营问数只能调用固定的只读查询模板。AI 无法把自然语言直接转换成任意数据库写操作。

### 库存采用流水思路

库存变动通过 InventoryMovement 表达。生产系统中余额应由流水或经过校验的快照重算，避免直接覆盖导致账实不符。

### 业务动作提案

AI 生成 ActionProposal，包含原因、证据、负载、预期影响、风险和幂等键。只有状态为 APPROVED 的提案才能进入执行器。

### 外部副作用

采购发送、消息发送等外部动作无法像数据库事务一样“回滚”。生产实现必须采用幂等键、重试、Outbox 和业务补偿；当前 Demo 仅创建内部草稿，不模拟已经对外发送。


## 提案治理链路

```text
AI_AGENT 生成 ActionProposal
  ↓ Schema 校验
  ↓ 供应商 / 商品 / 客户 / 批次实体校验
  ↓ OWNER / MANAGER / FINANCE 等授权角色人工审批
  ↓ SYSTEM_EXECUTOR 执行前二次校验
  ↓ 幂等键去重
  ↓ 仅创建内部草稿或复核单
  ↓ AuditEvent 记录主体、前后状态、请求 ID 与结果
```

执行器与 AI_AGENT 使用不同角色，避免“提出建议的人”同时拥有审批和执行权限。
