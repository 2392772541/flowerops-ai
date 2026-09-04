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
 ├─ Permission and proposal state machine
 └─ Idempotency & audit events
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
