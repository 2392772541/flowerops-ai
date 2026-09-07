import type { AppState } from '../domain/types'

export const demoState: AppState = {
  schemaVersion: 1,
  products: [
    { id: 'P-ROSE-R', name: '云南红玫瑰', category: '玫瑰', unit: '枝', salePrice: 5.8, defaultCost: 2.6, safetyStock: 180 },
    { id: 'P-EUS-W', name: '白色洋桔梗', category: '配花', unit: '枝', salePrice: 7.2, defaultCost: 3.8, safetyStock: 90 },
    { id: 'P-EUC', name: '尤加利叶', category: '叶材', unit: '枝', salePrice: 3.2, defaultCost: 1.4, safetyStock: 100 },
    { id: 'P-SUN', name: '向日葵', category: '主花', unit: '枝', salePrice: 8.8, defaultCost: 4.1, safetyStock: 80 },
    { id: 'B-LOVE', name: '心动红玫瑰花束', category: '花束', unit: '束', salePrice: 199, defaultCost: 82, safetyStock: 0 },
    { id: 'B-SUN', name: '元气向日葵花束', category: '花束', unit: '束', salePrice: 159, defaultCost: 68, safetyStock: 0 }
  ],
  recipes: [
    { id: 'R-LOVE', name: '心动花束配方', outputProductId: 'B-LOVE', items: [{ productId: 'P-ROSE-R', quantity: 19 }, { productId: 'P-EUS-W', quantity: 5 }, { productId: 'P-EUC', quantity: 6 }] },
    { id: 'R-SUN', name: '元气花束配方', outputProductId: 'B-SUN', items: [{ productId: 'P-SUN', quantity: 7 }, { productId: 'P-EUS-W', quantity: 4 }, { productId: 'P-EUC', quantity: 5 }] }
  ],
  lots: [
    { id: 'LOT-R01', productId: 'P-ROSE-R', batchNo: 'YN-R-0901', qtyOnHand: 260, qtyReserved: 86, qtyQualityHold: 12, qtyExpired: 0, receivedAt: '2026-09-01', sellBy: '2026-09-05', unitCost: 2.5, supplierId: 'S-YN01', qualityGrade: 'A', status: 'NEAR_EXPIRY' },
    { id: 'LOT-R02', productId: 'P-ROSE-R', batchNo: 'YN-R-0903', qtyOnHand: 420, qtyReserved: 120, qtyQualityHold: 0, qtyExpired: 0, receivedAt: '2026-09-03', sellBy: '2026-09-09', unitCost: 2.8, supplierId: 'S-YN01', qualityGrade: 'A', status: 'AVAILABLE' },
    { id: 'LOT-E01', productId: 'P-EUS-W', batchNo: 'KM-E-0901', qtyOnHand: 150, qtyReserved: 36, qtyQualityHold: 10, qtyExpired: 0, receivedAt: '2026-09-01', sellBy: '2026-09-06', unitCost: 3.6, supplierId: 'S-KM02', qualityGrade: 'B', status: 'NEAR_EXPIRY' },
    { id: 'LOT-U01', productId: 'P-EUC', batchNo: 'YN-U-0902', qtyOnHand: 280, qtyReserved: 70, qtyQualityHold: 0, qtyExpired: 0, receivedAt: '2026-09-02', sellBy: '2026-09-10', unitCost: 1.3, supplierId: 'S-YN01', qualityGrade: 'A', status: 'AVAILABLE' },
    { id: 'LOT-S01', productId: 'P-SUN', batchNo: 'GX-S-0901', qtyOnHand: 105, qtyReserved: 49, qtyQualityHold: 0, qtyExpired: 8, receivedAt: '2026-09-01', sellBy: '2026-09-05', unitCost: 4.0, supplierId: 'S-GX03', qualityGrade: 'B', status: 'NEAR_EXPIRY' }
  ],
  movements: [
    { id: 'MOV-05', lotId: 'LOT-R01', productId: 'P-ROSE-R', type: 'RESERVE', quantity: -86, referenceId: 'SO-26090401', occurredAt: '2026-09-04T09:10:00+08:00', operator: '订单服务', note: '企业订单确认后预留' },
    { id: 'MOV-04', lotId: 'LOT-S01', productId: 'P-SUN', type: 'SCRAP', quantity: -8, referenceId: 'SCRAP-0904', occurredAt: '2026-09-04T08:30:00+08:00', operator: '仓管 · 周岚', note: '开箱发现折损，待复核' },
    { id: 'MOV-03', lotId: 'LOT-R02', productId: 'P-ROSE-R', type: 'RECEIPT', quantity: 420, referenceId: 'PO-260901', occurredAt: '2026-09-03T06:50:00+08:00', operator: '仓管 · 周岚', note: '到货验收 A 级' }
  ],
  suppliers: [
    { id: 'S-YN01', name: '昆明云花直采', leadTimeDays: 2, reliability: 0.96, paymentTerms: '到货后7天', products: ['P-ROSE-R', 'P-EUC'] },
    { id: 'S-KM02', name: '斗南桔梗合作社', leadTimeDays: 2, reliability: 0.91, paymentTerms: '现结', products: ['P-EUS-W'] },
    { id: 'S-GX03', name: '广西向阳花场', leadTimeDays: 3, reliability: 0.88, paymentTerms: '到货后3天', products: ['P-SUN'] }
  ],
  purchaseOrders: [
    { id: 'PO-260901', supplierId: 'S-YN01', status: 'RECEIVED', amount: 1176, expectedAt: '2026-09-03', createdAt: '2026-09-01T10:00:00+08:00', items: [{ productId: 'P-ROSE-R', quantity: 420, unitCost: 2.8 }] },
    { id: 'PO-260903', supplierId: 'S-KM02', status: 'SENT', amount: 760, expectedAt: '2026-09-05', createdAt: '2026-09-03T14:20:00+08:00', items: [{ productId: 'P-EUS-W', quantity: 200, unitCost: 3.8 }] }
  ],
  customers: [
    { id: 'C-001', name: '拾光婚礼策划', type: '企业客户', creditLimit: 30000, paymentTermsDays: 30, level: 'A' },
    { id: 'C-002', name: '花间工作室', type: '花艺工作室', creditLimit: 12000, paymentTermsDays: 15, level: 'B' },
    { id: 'C-003', name: '门店散客', type: '零售散客', creditLimit: 0, paymentTermsDays: 0, level: 'C' }
  ],
  orders: [
    { id: 'SO-26090401', customerId: 'C-001', source: '企业合同', status: 'STOCK_RESERVED', deliveryAt: '2026-09-06T10:00:00+08:00', totalAmount: 3582, items: [{ productId: 'B-LOVE', quantity: 18, unitPrice: 199 }] },
    { id: 'SO-26090402', customerId: 'C-002', source: '微信', status: 'PREPARING', deliveryAt: '2026-09-04T18:00:00+08:00', totalAmount: 1272, items: [{ productId: 'B-SUN', quantity: 8, unitPrice: 159 }] },
    { id: 'SO-26090308', customerId: 'C-003', source: '门店', status: 'COMPLETED', deliveryAt: '2026-09-03T16:30:00+08:00', totalAmount: 796, items: [{ productId: 'B-LOVE', quantity: 4, unitPrice: 199 }] }
  ],
  receivables: [
    { id: 'AR-001', customerId: 'C-001', orderId: 'SO-26081803', amount: 12600, paidAmount: 4000, dueDate: '2026-09-02', status: 'OVERDUE' },
    { id: 'AR-002', customerId: 'C-002', orderId: 'SO-26082507', amount: 5800, paidAmount: 2800, dueDate: '2026-09-09', status: 'PARTIALLY_PAID' }
  ],
  proposals: [
    { id: 'AP-001', type: 'CREATE_PURCHASE_ORDER', title: '补充 260 枝红玫瑰，覆盖周末订单', reason: '未来三天已确认花束订单将消耗 342 枝红玫瑰；临期批次有效库存折损后，预计周六出现 118 枝缺口。', evidence: [{ label: '未来需求', value: '342 枝', detail: '18束已确认订单 × 19枝配方' }, { label: '有效库存', value: '356 枝', detail: '可售库存按新鲜度系数折算' }, { label: '安全库存', value: '180 枝', detail: '当前演示配置，可由经营者调整' }], payload: { supplierId: 'S-YN01', productId: 'P-ROSE-R', quantity: 260, unitCost: 2.9 }, expectedImpact: '情景计算仅展示采购草稿资金占用，不预测真实缺货率或销售提升。', risk: 'MEDIUM', status: 'AWAITING_APPROVAL', idempotencyKey: 'purchase-rose-20260904-v1', generatedAt: '2026-09-04T09:30:00+08:00' },
    { id: 'AP-002', type: 'CREATE_WASTE_PROPOSAL', title: '复核向日葵临期批次并制定促销去化', reason: '批次 GX-S-0901 明日到可售期限，剩余可售 48 枝；按近四周同星期销量，当前样例规则把剩余时间和历史需求标记为高关注，但没有经过真实销量校准。', evidence: [{ label: '剩余可售', value: '48 枝', detail: '105在库 - 49预留 - 8过期' }, { label: '剩余时间', value: '1 天', detail: '可售期限为 2026-09-05' }, { label: '样例库存成本', value: '¥192', detail: '48 枝 × ¥4/枝；不含售罄概率预测' }], payload: { lotId: 'LOT-S01', suggestedDiscount: 0.15 }, expectedImpact: '情景计算展示全部售出时的收入上限，不代表真实售罄概率或损耗改善。', risk: 'LOW', status: 'AWAITING_APPROVAL', idempotencyKey: 'waste-sun-20260904-v1', generatedAt: '2026-09-04T09:35:00+08:00' },
    { id: 'AP-003', type: 'CREATE_COLLECTION_DRAFT', title: '为拾光婚礼策划生成温和催款草稿', reason: '该客户有 ¥8,600 已逾期 2 天，历史付款稳定且信用等级为 A，适合先采用温和提醒。', evidence: [{ label: '逾期余额', value: '¥8,600', detail: '应收 ¥12,600，已支付 ¥4,000' }, { label: '逾期天数', value: '2 天', detail: '到期日 2026-09-02' }, { label: '客户等级', value: 'A', detail: '历史合作稳定' }], payload: { customerId: 'C-001', tone: '友好提醒' }, expectedImpact: '仅生成可编辑沟通草稿，不预测回款时间或催收成功率。', risk: 'LOW', status: 'AWAITING_APPROVAL', idempotencyKey: 'collection-c001-20260904-v1', generatedAt: '2026-09-04T09:40:00+08:00' }
  ],
  auditEvents: [
    { id: 'AUD-003', eventType: 'INVENTORY_RESERVED', entityType: 'SalesOrder', entityId: 'SO-26090401', actor: '订单服务', actorRole: 'SYSTEM_EXECUTOR', occurredAt: '2026-09-04T09:10:00+08:00', requestId: 'REQ-0401', idempotencyKey: 'reserve-so-26090401', before: 'CONFIRMED', after: 'STOCK_RESERVED', result: 'SUCCESS', detail: '按照花束配方展开并预留对应花材' },
    { id: 'AUD-002', eventType: 'QUALITY_HOLD_CREATED', entityType: 'InventoryLot', entityId: 'LOT-R01', actor: '仓管 · 周岚', actorRole: 'WAREHOUSE', occurredAt: '2026-09-04T08:40:00+08:00', requestId: 'REQ-0398', before: 'AVAILABLE', after: 'QUALITY_HOLD', result: 'SUCCESS', detail: '12枝花头受损，进入质量冻结，未计入可售库存' },
    { id: 'AUD-001', eventType: 'AI_PROPOSALS_GENERATED', entityType: 'DecisionRun', entityId: 'RUN-0904', actor: '规则AI', actorRole: 'AI_AGENT', occurredAt: '2026-09-04T08:00:00+08:00', requestId: 'REQ-0390', result: 'SUCCESS', detail: '使用固定、可解释规则扫描库存、订单和应收异常' }
  ],
  executedKeys: []
}
